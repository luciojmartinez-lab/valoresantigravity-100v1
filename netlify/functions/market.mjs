import fallbackBonds from '../../data/deuda-ultima.json' with {type: 'json'};

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36';
const BDE_URL = 'https://www.bde.es/webbe/es/estadisticas/compartido/datos/csv/si_1_2.csv';
const BDE_SERIES = {'BDE:ES1Y': 'DPUDTES00U7', 'BDE:ES3Y': 'DPUG0B1F0ZN',
    'BDE:ES5Y': 'DPUG0B1F0ZO', 'BDE:ES10Y': 'DPUG0B1F0ZP', 'BDE:DE10Y': 'DPUDNBBN308'};
const priceCache = new Map();
let bondsCache;
let bondsLoadedAt = 0;

async function remote(url) {
    const response = await fetch(url, {headers: {'User-Agent': UA}, signal: AbortSignal.timeout(18000)});
    if (!response.ok) throw new Error(`La fuente no responde (HTTP ${response.status}).`);
    return response;
}

async function chart(symbol, range, interval) {
    const response = await remote(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`);
    const data = await response.json();
    if (data.chart?.error || !data.chart?.result?.[0]) throw new Error('Yahoo no dispone de datos para este símbolo.');
    return data.chart.result[0];
}

async function quote(symbol) {
    const cached = priceCache.get(symbol);
    if (cached && Date.now() - cached.loadedAt < 45000) return cached.value;
    const data = await chart(symbol, '5d', '1d');
    const meta = data.meta;
    if (!Number.isFinite(meta.regularMarketPrice)) throw new Error('No hay un precio disponible.');
    // chartPreviousClose de un rango de cinco días no es el cierre de ayer.
    const closes = data.indicators?.quote?.[0]?.close || [];
    const timestamps = data.timestamp || [];
    const day = new Date(meta.regularMarketTime * 1000).toISOString().slice(0, 10);
    const prior = closes.map((close, i) => ({close, day: new Date(timestamps[i] * 1000).toISOString().slice(0, 10)}))
        .filter(row => Number.isFinite(row.close) && row.day < day).at(-1)?.close;
    const previous = Number.isFinite(meta.previousClose) ? meta.previousClose : prior;
    const change = Number.isFinite(meta.regularMarketChangePercent) ? meta.regularMarketChangePercent
        : Number.isFinite(previous) && previous !== 0 ? (meta.regularMarketPrice - previous) / previous * 100 : null;
    const value = {ticker: symbol, price: meta.regularMarketPrice, change, currency: meta.currency || '',
        timestamp: meta.regularMarketTime, source: 'Yahoo Finance', fetchedAt: new Date().toISOString()};
    priceCache.set(symbol, {loadedAt: Date.now(), value});
    return value;
}

function parseCsv(text) {
    const rows = [];
    let row = [], field = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === '"') {
            if (quoted && text[i + 1] === '"') { field += '"'; i++; }
            else quoted = !quoted;
        } else if (c === ',' && !quoted) { row.push(field); field = ''; }
        else if (c === '\n' && !quoted) { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
        else field += c;
    }
    if (field || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
    return rows;
}

async function bonds() {
    if (bondsCache && Date.now() - bondsLoadedAt < 3600000) return {data: bondsCache, cached: false};
    try {
        const response = await remote(BDE_URL);
        const rows = parseCsv(new TextDecoder('windows-1252').decode(await response.arrayBuffer()));
        const codes = rows[0];
        const descriptions = rows.find(row => row[0] === 'DESCRIPCIÓN DE LA SERIE');
        const months = {ENE:'01',FEB:'02',MAR:'03',ABR:'04',MAY:'05',JUN:'06',JUL:'07',AGO:'08',SEP:'09',OCT:'10',NOV:'11',DIC:'12'};
        const data = {};
        for (const [ticker, code] of Object.entries(BDE_SERIES)) {
            const index = codes.indexOf(code);
            if (index < 1 || !descriptions) throw new Error('El formato de la fuente ha cambiado.');
            const history = [];
            for (const row of rows) {
                const match = /^(\d{2}) ([A-Z]{3}) (\d{4})$/.exec(row[0]);
                if (!match || !months[match[2]] || !row[index]?.trim()) continue;
                const value = Number(row[index]);
                if (Number.isFinite(value)) history.push({date: `${match[3]}-${months[match[2]]}-${match[1]}`, value});
            }
            history.sort((a, b) => a.date.localeCompare(b.date));
            const latest = history.at(-1);
            if (!latest) throw new Error('Serie sin observaciones válidas.');
            data[ticker] = {ticker, price: latest.value, date: latest.date,
                change: history.length > 1 ? latest.value - history.at(-2).value : null,
                changeUnit: 'pp', source: 'Banco de España', series: code,
                description: descriptions[index], url: BDE_URL, history, fetchedAt: new Date().toISOString()};
        }
        bondsCache = data;
        bondsLoadedAt = Date.now();
        return {data, cached: false};
    } catch (_) {
        return {data: bondsCache || fallbackBonds, cached: true};
    }
}

function json(payload, status = 200) {
    return Response.json(payload, {status, headers: {'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}});
}

export default async request => {
    const url = new URL(request.url);
    const get = (key, fallback = '') => url.searchParams.get(key) || fallback;
    try {
        if (url.pathname === '/api/quotes') {
            const symbols = [...new Set(get('symbols').split(','))];
            if (symbols.length > 100 || !symbols.every(s => /^[A-Za-z0-9^=._+\-]{1,45}$/.test(s))) return json({error: 'Símbolos no válidos.'}, 400);
            const items = [], errors = [];
            const startedAt = Date.now();
            for (let start = 0; start < symbols.length; start += 10) {
                if (Date.now() - startedAt > 25000) { errors.push(...symbols.slice(start)); break; }
                const chunk = symbols.slice(start, start + 10);
                const results = await Promise.allSettled(chunk.map(quote));
                results.forEach((result, index) => result.status === 'fulfilled' ? items.push(result.value) : errors.push(chunk[index]));
            }
            return json({items, errors, fetchedAt: new Date().toISOString()});
        }
        if (url.pathname === '/api/bonds') {
            const {data, cached} = await bonds();
            return json({items: Object.values(data).map(({history, ...item}) => item), cached});
        }
        if (url.pathname === '/api/history') {
            const symbol = get('symbol'), period = get('period', 'month');
            if (!/^[A-Za-z0-9^=.:_+\-]{1,45}$/.test(symbol) || !['month','year','5years'].includes(period)) return json({error: 'Histórico solicitado no válido.'}, 400);
            if (BDE_SERIES[symbol]) {
                const {data, cached} = await bonds();
                const since = new Date();
                if (period === 'month') since.setUTCDate(since.getUTCDate() - 31);
                if (period === 'year') { since.setUTCMonth(0, 1); }
                if (period === '5years') since.setUTCFullYear(since.getUTCFullYear() - 5);
                return json({values: data[symbol].history.filter(row => row.date >= since.toISOString().slice(0,10)), currency: '%', source: 'Banco de España', cached});
            }
            const [range, interval] = {month:['1mo','1d'],year:['ytd','1d'],'5years':['5y','1wk']}[period];
            const data = await chart(symbol, range, interval);
            const closes = data.indicators?.quote?.[0]?.close || [];
            const values = (data.timestamp || []).map((stamp, i) => ({date: new Date(stamp * 1000).toISOString().slice(0,10), value: closes[i]})).filter(row => Number.isFinite(row.value));
            return json({values, currency: data.meta.currency, source: 'Yahoo Finance'});
        }
        if (url.pathname === '/api/search') {
            const q = get('q').trim().slice(0,100);
            if (q.length < 2) return json({quotes: []});
            const response = await remote('https://query1.finance.yahoo.com/v1/finance/search?' + new URLSearchParams({q, quotesCount:'50', newsCount:'0'}));
            const data = await response.json();
            return json({quotes: data.quotes || []});
        }
        return json({error: 'No encontrado.'}, 404);
    } catch (error) { return json({error: error.message || 'No se ha podido consultar la fuente.'}, 502); }
};

export const config = {path: ['/api/quotes', '/api/bonds', '/api/history', '/api/search'], method: 'GET'};
