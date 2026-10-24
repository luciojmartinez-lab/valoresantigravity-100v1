'use strict';

const LEGACY_ETFS = ['SPY', 'QQQ', 'DIA', 'IWM', 'EEM', 'GLD', 'SLV', 'VTI', 'TLT', 'ARKK', 'USO', 'VOO', 'IVV', 'VEA', 'VWO', 'AGG', 'BND', 'VUG', 'VTV', 'SCHD'];
const LEGACY_STOCKS = ['SAN.MC', 'BBVA.MC', 'CABK.MC', 'ITX.MC', 'IBE.MC', 'FER.MC'];
const DEFAULT_SELECTION = ['SPY', 'QQQ', 'GLD', 'BDE:ES1Y', 'BDE:ES3Y', 'BDE:ES5Y', 'BDE:ES10Y'];
const fixedAssets = [
    ['GC=F', 'Oro (futuro)', 1], ['SI=F', 'Plata (futuro)', 1],
    ['BTC-USD', 'Bitcoin', 1], ['ETH-USD', 'Ethereum', 1], ['BZ=F', 'Brent (futuro)', 1],
    ['^IRX', 'EE.UU. · 13 semanas', 2, 'yield'], ['^FVX', 'EE.UU. · 5 años', 2, 'yield'],
    ['^TNX', 'EE.UU. · 10 años', 2, 'yield'], ['^TYX', 'EE.UU. · 30 años', 2, 'yield'],
    ['^IBEX', 'IBEX 35', 3, 'index'], ['^GSPC', 'S&P 500', 4, 'index'],
    ['^NDX', 'Nasdaq 100', 4, 'index'], ['^DJI', 'Dow Jones', 4, 'index'],
    ['USDEUR=X', 'Dólar / Euro', 4, 'forex'],
    ['EURSEK=X', 'EUR / SEK', 4, 'forex'], ['EURNOK=X', 'EUR / NOK', 4, 'forex'],
    ['EURDKK=X', 'EUR / DKK', 4, 'forex'], ['EURPLN=X', 'EUR / PLN', 4, 'forex'],
    ['EURGBP=X', 'EUR / GBP', 4, 'forex'], ['EURJPY=X', 'EUR / JPY', 4, 'forex'],
    ['EURKRW=X', 'EUR / KRW', 4, 'forex']
].map(([ticker, name, col, kind]) => ({ticker, name, col, kind: kind || 'price', source: 'yahoo'}));
const bondAssets = [
    ['BDE:ES1Y', 'España · 12 meses'], ['BDE:ES3Y', 'España · 3 años'],
    ['BDE:ES5Y', 'España · 5 años'], ['BDE:ES10Y', 'España · 10 años'],
    ['BDE:DE10Y', 'Alemania · 10 años']
].map(([ticker, name]) => ({ticker, name, currency: '%', exchange: 'Banco de España',
    group: 'bonds', category: 'bond', kind: 'yield', source: 'bde', col: 3}));
const defaults = LEGACY_ETFS.map(ticker => ({ticker, name: ticker, currency: 'USD',
    group: 'us', category: 'etf', source: 'yahoo', exchange: 'EE.UU.'}));
const spanishDefaults = LEGACY_STOCKS.map(ticker => ({ticker, name: ticker, currency: 'EUR', group: 'es', category: 'stock', source: 'yahoo', exchange: 'Madrid'}));
let catalogue = [...defaults, ...spanishDefaults, ...bondAssets];
let byTicker = new Map(catalogue.map(item => [item.ticker, item]));
let coverage = null;
let catalogueDate = '';
let currentCurrency = 'USD';
let selected = new Set(DEFAULT_SELECTION);
let quotes = {};
let rates = {EUR: 1};
let autoRefresh = false;
let refreshTimer = null;
let refreshing = false;
let refreshQueued = false;
let lastFullRefreshStartedAt = 0;
let page = 0;
const pageSize = 60;
let chartInstance = null;
let chartTicker = '';
let chartRequest = 0;
let onlineSearchId = 0;
let onlineResults = [];

const el = id => document.getElementById(id);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const number = (value, decimals = 2) => Number.isFinite(value)
    ? value.toLocaleString('es-ES', {minimumFractionDigits: decimals, maximumFractionDigits: decimals}) : '—';
const isSymbol = value => typeof value === 'string' && /^[A-Za-z0-9^=.:_+\-]{1,45}$/.test(value);

async function api(path, timeout = 45000) {
    if (location.protocol === 'file:') throw new Error('Abre la aplicación con Iniciar.cmd para conectar con los mercados.');
    const response = await fetch(path, {signal: AbortSignal.timeout(timeout)});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No se ha podido completar la consulta.');
    return data;
}

function asset(ticker) {
    return fixedAssets.find(item => item.ticker === ticker) || byTicker.get(ticker);
}

function optionalAssets() {
    return [...selected].map(ticker => byTicker.get(ticker)).filter(Boolean);
}

function visibleAssets() {
    return [...fixedAssets, ...optionalAssets()];
}

function loadState() {
    try {
        const saved = JSON.parse(localStorage.getItem('val_100v14_state') || 'null');
        if (saved) {
            applyState(saved);
            const savedQuotes = JSON.parse(localStorage.getItem('val_100v14_quotes') || '{}');
            for (const [ticker, quote] of Object.entries(savedQuotes)) {
                if (isSymbol(ticker) && Number.isFinite(quote.price) && quote.source && (quote.timestamp || quote.date)) quotes[ticker] = quote;
            }
            return;
        }
        currentCurrency = localStorage.getItem('val_100v13_currency') === 'EUR' ? 'EUR' : 'USD';
        const old = JSON.parse(localStorage.getItem('val_100v13_selected_etfs') || 'null');
        if (Array.isArray(old)) selected = new Set([...old.map(s => String(s).toUpperCase()).filter(s => LEGACY_ETFS.includes(s)), ...LEGACY_STOCKS, ...DEFAULT_SELECTION.filter(s => s.startsWith('BDE:'))]);
    } catch (error) { console.warn('No se pudo recuperar la configuración:', error); }
}

function applyState(state) {
    if (!state || !['EUR', 'USD'].includes(state.currentCurrency)) throw new Error('La copia no contiene una moneda válida.');
    let tickers;
    if (Array.isArray(state.selectedTickers)) {
        tickers = state.selectedTickers;
    } else if (Array.isArray(state.selectedETFs)) {
        tickers = [...state.selectedETFs.map(s => String(s).toUpperCase()).filter(s => LEGACY_ETFS.includes(s)), ...LEGACY_STOCKS, ...DEFAULT_SELECTION.filter(s => s.startsWith('BDE:'))];
    } else throw new Error('La copia no contiene una selección compatible.');
    if (tickers.length > 1000 || !tickers.every(isSymbol)) throw new Error('La selección de la copia no es válida.');
    const extra = [];
    for (const item of state.selectedAssets || []) {
        if (!item || !isSymbol(item.ticker) || !['us', 'eu', 'es', 'bonds'].includes(item.group)) continue;
        if (item.group === 'bonds') continue; // Los identificadores oficiales se mantienen en el programa.
        extra.push({ticker: item.ticker, name: String(item.name || item.ticker).slice(0, 300),
            currency: String(item.currency || '').slice(0, 8), exchange: String(item.exchange || '').slice(0, 80),
            group: item.group, category: item.group === 'es' ? 'stock' : 'etf', source: 'yahoo'});
    }
    const merged = new Map(catalogue.map(item => [item.ticker, item]));
    extra.forEach(item => merged.set(item.ticker, item));
    catalogue = [...merged.values()];
    byTicker = merged;
    currentCurrency = state.currentCurrency;
    selected = new Set(tickers);
    autoRefresh = state.autoRefresh === true;
}

function stateData() {
    return {version: '100v14', currentCurrency, autoRefresh, selectedTickers: [...selected], selectedAssets: optionalAssets()};
}

function saveState() {
    try {
        localStorage.setItem('val_100v14_state', JSON.stringify(stateData()));
        localStorage.setItem('val_100v14_quotes', JSON.stringify(quotes));
    } catch (error) { setStatus('No se ha podido guardar la configuración en este navegador.'); }
}

function setStatus(message) {
    el('market-status').textContent = message;
}

async function loadCatalogue(refresh = false) {
    const status = el('catalogue-status');
    status.textContent = refresh ? 'Recargando el catálogo publicado…' : 'Cargando catálogo…';
    el('refresh-catalogue').disabled = true;
    try {
        const data = await api('/api/catalog', 600000);
        const merged = new Map(data.items.map(item => [item.ticker, item]));
        optionalAssets().forEach(item => { if (!merged.has(item.ticker)) merged.set(item.ticker, item); });
        bondAssets.forEach(item => merged.set(item.ticker, item));
        catalogue = [...merged.values()];
        byTicker = merged;
        coverage = data.coverage;
        catalogueDate = data.generatedAt;
        const counts = ['us', 'eu', 'es'].map(group => number(coverage[group].downloaded, 0));
        status.textContent = `${counts[0]} ETF EE.UU. · ${counts[1]} ETF Europa · ${counts[2]} acciones España. Catálogo: ${new Date(catalogueDate).toLocaleDateString('es-ES')}.`;
        saveState();
        renderCatalogue();
        renderDashboard();
    } catch (error) {
        status.textContent = `${error.message} Se mantiene el catálogo ya cargado.`;
    } finally { el('refresh-catalogue').disabled = false; }
}

function matchesFilter(item, group, query) {
    return (!group || item.group === group || (group === 'selected' && selected.has(item.ticker)))
        && (!query || norm(`${item.ticker} ${item.name} ${item.exchange}`).includes(query));
}

function renderCatalogue(reset = false) {
    if (reset) page = 0;
    const group = el('asset-group').value;
    const query = norm(el('asset-search').value.trim());
    const all = catalogue.filter(item => matchesFilter(item, group, query));
    const countPages = Math.max(1, Math.ceil(all.length / pageSize));
    page = Math.max(0, Math.min(page, countPages - 1));
    const rows = all.slice(page * pageSize, (page + 1) * pageSize);
    el('etf-table-body').innerHTML = rows.map(item => rowHtml(item)).join('') || '<tr><td colspan="5">No hay coincidencias. Prueba otro nombre o ticker.</td></tr>';
    el('catalogue-count').textContent = `${number(all.length, 0)} resultados · página ${page + 1} de ${countPages}`;
    el('previous-page').disabled = page === 0;
    el('next-page').disabled = page + 1 >= countPages;
    el('selected-count').textContent = `${selected.size} seleccionados`;
    el('selected-list').innerHTML = optionalAssets().map(item => `<button class="selection-chip" type="button" data-remove="${escapeHtml(item.ticker)}" title="Quitar ${escapeHtml(item.name)}">${escapeHtml(item.ticker)} ×</button>`).join('') || 'Ninguno seleccionado';
}

function rowHtml(item) {
    return `<tr><td class="checkbox-cell"><input type="checkbox" aria-label="Mostrar ${escapeHtml(item.name)}" data-ticker="${escapeHtml(item.ticker)}" ${selected.has(item.ticker) ? 'checked' : ''}></td>
        <td><span class="ticker-badge">${escapeHtml(item.ticker)}</span></td>
        <td><strong>${escapeHtml(item.name)}</strong></td><td>${escapeHtml(item.exchange || groupLabel(item.group))}</td><td>${escapeHtml(item.currency)}</td></tr>`;
}

function groupLabel(group) {
    return {us: 'ETF EE.UU.', eu: 'ETF Europa', es: 'Acciones España', bonds: 'Renta fija europea'}[group] || '';
}

function toggleTicker(ticker, enabled) {
    if (!byTicker.has(ticker)) return;
    if (enabled) selected.add(ticker); else selected.delete(ticker);
    saveState();
    renderCatalogue();
    renderOnlineResults();
    renderDashboard();
    if (enabled) fetchRealMarketData([ticker]);
}

async function searchOnline() {
    const query = el('asset-search').value.trim();
    const id = ++onlineSearchId;
    if (query.length < 2) { el('online-status').textContent = 'Escribe al menos dos caracteres para buscar en Yahoo.'; return; }
    el('online-status').textContent = 'Buscando en Yahoo…';
    onlineResults = [];
    renderOnlineResults();
    try {
        const data = await api('/api/search?q=' + encodeURIComponent(query));
        if (id !== onlineSearchId) return;
        const europeSuffixes = /\.(DE|F|BE|DU|HM|HA|MU|SG|L|PA|AS|MI|MC|SW|VI|BR|LS|ST|OL|HE|CO|WA|PR|AT|IS|IR|IC|VS|RG|TL)$/;
        onlineResults = data.quotes.filter(q => (q.quoteType === 'ETF' && (europeSuffixes.test(q.symbol) || !q.symbol.includes('.'))) || (q.quoteType === 'EQUITY' && q.symbol.endsWith('.MC')))
            .map(q => ({ticker: q.symbol, name: q.longname || q.shortname || q.symbol,
                category: q.quoteType === 'ETF' ? 'etf' : 'stock',
                group: q.quoteType === 'EQUITY' ? 'es' : europeSuffixes.test(q.symbol) ? 'eu' : 'us',
                exchange: q.exchDisp || q.exchange || '', currency: q.currency || '', source: 'yahoo'}));
        onlineResults.forEach(item => {
            if (!byTicker.has(item.ticker)) { catalogue.push(item); byTicker.set(item.ticker, item); }
        });
        el('online-status').textContent = onlineResults.length ? `${onlineResults.length} coincidencias de Yahoo. Cada mercado o clase tiene su propio ticker.` : 'Yahoo no ha devuelto coincidencias de estos mercados. Prueba el ticker completo.';
        renderOnlineResults();
        renderCatalogue();
    } catch (error) { if (id === onlineSearchId) el('online-status').textContent = error.message; }
}

function renderOnlineResults() {
    el('online-table-body').innerHTML = onlineResults.map(rowHtml).join('');
    el('online-results').classList.toggle('hidden', !onlineResults.length);
}

async function fetchRealMarketData(only = null) {
    if (refreshing) { refreshQueued = true; return; }
    refreshing = true;
    if (!only) lastFullRefreshStartedAt = Date.now();
    el('refresh-market').disabled = true;
    setStatus('Consultando los activos del panel…');
    const items = visibleAssets().filter(item => !only || only.includes(item.ticker));
    const symbols = [...new Set([...items.filter(item => item.source === 'yahoo').map(item => item.ticker), 'EURUSD=X'])];
    const errors = [];
    try {
        const jobs = [];
        for (let i = 0; i < symbols.length; i += 100) {
            const chunk = symbols.slice(i, i + 100);
            jobs.push(api('/api/quotes?symbols=' + encodeURIComponent(chunk.join(','))).then(data => {
                const found = new Set();
                for (const q of data.items) {
                    quotes[q.ticker] = q;
                    found.add(q.ticker);
                    const item = byTicker.get(q.ticker);
                    if (item && q.currency) item.currency = q.currency;
                }
                if (chunk.some(ticker => !found.has(ticker))) errors.push('Algunos símbolos no tienen cotización disponible.');
            }));
        }
        if (items.some(item => item.source === 'bde')) {
            jobs.push(api('/api/bonds').then(data => {
                data.items.forEach(q => { quotes[q.ticker] = q; });
                if (data.cached) errors.push('Deuda española: se utiliza la última descarga guardada.');
            }));
        }
        const results = await Promise.allSettled(jobs);
        results.forEach(result => { if (result.status === 'rejected') errors.push(result.reason.message); });
        if (Number.isFinite(quotes['EURUSD=X']?.price)) rates.USD = quotes['EURUSD=X'].price;
        const currencies = [...new Set(visibleAssets().map(item => normalizeCurrency(quotes[item.ticker]?.currency).currency))]
            .filter(currency => currency && !['EUR', 'USD', '%'].includes(currency));
        if (currencies.length) {
            try {
                const data = await api('/api/quotes?symbols=' + encodeURIComponent(currencies.map(currency => `EUR${currency}=X`).join(',')));
                data.items.forEach(q => { if (q.price > 0) rates[q.ticker.slice(3, -2)] = q.price; });
            } catch (error) { errors.push('Algunas cotizaciones se muestran en su moneda original.'); }
        }
        saveState();
        renderDashboard();
        const time = new Date().toLocaleTimeString('es-ES', {hour: '2-digit', minute: '2-digit'});
        setStatus(errors.length ? [...new Set(errors)].join(' ') : `Consulta completada a las ${time}. Cada tarjeta indica la fecha del dato.`);
    } catch (error) { setStatus(error.message); }
    finally {
        refreshing = false;
        el('refresh-market').disabled = false;
        if (refreshQueued) { refreshQueued = false; fetchRealMarketData(); }
    }
}

function normalizeCurrency(currency) {
    if (currency === 'GBp' || currency === 'GBX') return {currency: 'GBP', scale: 0.01};
    return {currency: currency || '', scale: 1};
}

function displayPrice(item, q) {
    if (!Number.isFinite(q?.price)) return {text: 'Sin datos', note: ''};
    if (item.kind === 'yield' || item.category === 'bond') return {text: `${number(q.price)} %`, note: ''};
    if (item.kind === 'index') return {text: `${number(q.price)} puntos`, note: ''};
    if (item.kind === 'forex') {
        if (item.ticker !== 'USDEUR=X') return {text: `1 EUR = ${number(q.price, 4)} ${item.ticker.slice(3, -2)}`, note: ''};
        return {text: currentCurrency === 'EUR' ? `1 USD = ${number(q.price, 4)} EUR` : `1 EUR = ${number(1 / q.price, 4)} USD`, note: ''};
    }
    const {currency, scale} = normalizeCurrency(q.currency || item.currency);
    let value = q.price * scale;
    if (currency === currentCurrency) return {text: `${number(value)} ${currency}`, note: ''};
    if (rates[currency] > 0 && rates[currentCurrency] > 0) {
        value = value / rates[currency] * rates[currentCurrency];
        return {text: `${number(value)} ${currentCurrency}`, note: `${number(q.price * scale)} ${currency} de origen`};
    }
    return {text: `${number(value)} ${currency}`, note: 'Moneda original; conversión no disponible'};
}

function quoteDate(q) {
    if (q?.date) return new Date(q.date + 'T12:00:00').toLocaleDateString('es-ES');
    if (q?.timestamp) return new Date(q.timestamp * 1000).toLocaleString('es-ES', {day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'});
    return '';
}

function renderDashboard() {
    for (let col = 1; col <= 6; col++) el(`col-${col}`).innerHTML = '';
    for (const item of visibleAssets()) {
        const q = quotes[item.ticker];
        const display = displayPrice(item, q);
        const change = Number.isFinite(q?.change) ? `${q.change >= 0 ? '+' : ''}${number(q.change)}${q.changeUnit === 'pp' ? ' pp' : '%'}` : '—';
        const col = item.col || (item.category === 'stock' ? 6 : 5);
        const stamp = quoteDate(q);
        const note = q ? `${q.source} · ${stamp}${q.source === 'Banco de España' ? ' · referencia diaria' : q.delay ? ` · retraso ${q.delay} min` : ''}` : 'Pendiente de consulta';
        el(`col-${col}`).insertAdjacentHTML('beforeend', `<div class="value-card">
            <div class="card-top"><span class="card-title" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
            <span class="card-change ${q?.change >= 0 ? 'change-up' : 'change-down'}">${change}</span></div>
            <div class="asset-symbol">${escapeHtml(item.ticker)}</div><div class="card-price">${escapeHtml(display.text)}</div>
            ${display.note ? `<div class="quote-note">${escapeHtml(display.note)}</div>` : ''}
            <div class="quote-note">${escapeHtml(note)}</div>
            <div class="card-actions"><button type="button" class="btn-action" data-refresh="${escapeHtml(item.ticker)}" title="Actualizar este activo" aria-label="Actualizar ${escapeHtml(item.name)}">↻</button>
            <button type="button" class="btn-action btn-chart" data-chart="${escapeHtml(item.ticker)}" title="Ver histórico real" aria-label="Ver histórico de ${escapeHtml(item.name)}">▥</button></div></div>`);
    }
    for (const col of [3, 5, 6]) {
        if (!el(`col-${col}`).children.length) el(`col-${col}`).innerHTML = '<p class="empty-column">Elige activos en Configuración.</p>';
    }
}

function setCurrency(currency) {
    currentCurrency = currency;
    saveState();
    renderSettings();
    renderDashboard();
}

function renderSettings() {
    ['EUR', 'USD'].forEach(currency => el(`btn-curr-${currency}`).classList.toggle('active', currentCurrency === currency));
    el('refresh-mode').value = autoRefresh ? 'auto' : 'manual';
    renderCatalogue();
}

function configureRefresh() {
    clearInterval(refreshTimer);
    el('refresh-timer').textContent = autoRefresh ? 'Al abrir · cada 5 min' : 'Al abrir y al volver';
    if (autoRefresh) refreshTimer = setInterval(() => {
        if (!document.hidden) fetchRealMarketData();
    }, 300000);
}

function refreshOnReturn() {
    // Una PWA del móvil suele volver del segundo plano sin volver a cargar el HTML.
    // Se agrupan focus, pageshow y visibilitychange para evitar consultas duplicadas.
    if (!document.hidden && !refreshing && Date.now() - lastFullRefreshStartedAt >= 60000) {
        fetchRealMarketData();
    }
}

function exportBackup() {
    const blob = new Blob([JSON.stringify(stateData(), null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Copia_Valores100v14_LucioJMartinez.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function importBackup(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
        if (file.size > 2000000) throw new Error('La copia es demasiado grande.');
        const data = JSON.parse(await file.text());
        applyState(data);
        saveState();
        renderSettings();
        renderDashboard();
        configureRefresh();
        fetchRealMarketData();
        el('backup-status').textContent = 'Configuración importada correctamente.';
    } catch (error) { el('backup-status').textContent = error.message; }
    event.target.value = '';
}

function switchScreen(screen) {
    if (!['welcome', 'dashboard', 'simulator', 'settings'].includes(screen)) screen = 'welcome';
    ['welcome', 'dashboard', 'simulator', 'settings'].forEach(id => el(`screen-${id}`).classList.toggle('hidden', id !== screen));
    ['welcome', 'dashboard', 'simulator'].forEach(id => el(`nav-${id}`).classList.toggle('active', id === screen));
    el('nav-item-settings').classList.toggle('active', screen === 'settings');
    try { localStorage.setItem('val_100v14_screen', screen); } catch (_) { }
}

async function showChart(ticker) {
    chartTicker = ticker;
    el('modal-title').textContent = asset(ticker)?.name || ticker;
    el('chart-timeframe').value = 'month';
    el('chart-modal').classList.remove('hidden');
    await updateChartData();
}

function closeChartModal() {
    chartRequest++;
    el('chart-modal').classList.add('hidden');
    if (chartInstance) chartInstance.destroy();
    chartInstance = null;
}

async function updateChartData() {
    const id = ++chartRequest;
    el('chart-status').textContent = 'Cargando histórico real…';
    if (chartInstance) chartInstance.destroy();
    chartInstance = null;
    try {
        const data = await api(`/api/history?symbol=${encodeURIComponent(chartTicker)}&period=${el('chart-timeframe').value}`);
        if (id !== chartRequest) return;
        if (!data.values.length) throw new Error('No hay observaciones para este periodo.');
        if (typeof Chart === 'undefined') throw new Error('No se pudo cargar el componente de gráficos. Comprueba la conexión a Internet.');
        const last = data.values[data.values.length - 1];
        el('chart-status').textContent = `${data.source} · ${data.currency} de origen · último dato ${last.date}`;
        chartInstance = new Chart(el('historyChart').getContext('2d'), {
            type: 'line', data: {labels: data.values.map(row => row.date), datasets: [{label: `Cotización (${data.currency})`,
                data: data.values.map(row => row.value), borderColor: '#1976d2', borderWidth: 2, pointRadius: 0, tension: 0.1}]},
            options: {responsive: true, maintainAspectRatio: false, plugins: {legend: {display: false}},
                scales: {x: {ticks: {maxTicksLimit: 6, font: {size: 9}}}, y: {ticks: {font: {size: 9}, callback: value => number(value)}}}}
        });
    } catch (error) { if (id === chartRequest) el('chart-status').textContent = error.message; }
}

document.addEventListener('DOMContentLoaded', () => {
    window.ValoresMarket = {catalogue: () => catalogue, quote: ticker => quotes[ticker], rate: currency => rates[currency], api};
    loadState();
    renderSettings();
    renderDashboard();
    configureRefresh();
    try { switchScreen(localStorage.getItem('val_100v14_screen') || localStorage.getItem('val_100v13_current_screen') || 'welcome'); } catch (_) { }
    const updateClock = () => {
        const now = new Date();
        el('welcome-date').textContent = now.toLocaleDateString('es-ES', {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'});
        el('welcome-time').textContent = now.toLocaleTimeString('es-ES');
    };
    updateClock();
    setInterval(updateClock, 1000);
    el('asset-search').addEventListener('input', () => { onlineSearchId++; onlineResults = []; renderOnlineResults(); renderCatalogue(true); });
    el('asset-search').addEventListener('keydown', event => { if (event.key === 'Enter') searchOnline(); });
    el('asset-group').addEventListener('change', () => renderCatalogue(true));
    el('previous-page').addEventListener('click', () => { page--; renderCatalogue(); });
    el('next-page').addEventListener('click', () => { page++; renderCatalogue(); });
    el('search-online').addEventListener('click', searchOnline);
    el('refresh-catalogue').addEventListener('click', () => loadCatalogue(true));
    el('refresh-market').addEventListener('click', () => fetchRealMarketData());
    el('refresh-mode').addEventListener('change', () => { autoRefresh = el('refresh-mode').value === 'auto'; saveState(); configureRefresh(); });
    document.addEventListener('change', event => {
        if (event.target.matches('input[data-ticker]')) toggleTicker(event.target.dataset.ticker, event.target.checked);
    });
    document.addEventListener('click', event => {
        const remove = event.target.closest('[data-remove]');
        const refresh = event.target.closest('[data-refresh]');
        const chart = event.target.closest('[data-chart]');
        if (remove) toggleTicker(remove.dataset.remove, false);
        if (refresh) fetchRealMarketData([refresh.dataset.refresh]);
        if (chart) showChart(chart.dataset.chart);
    });
    document.addEventListener('visibilitychange', refreshOnReturn);
    window.addEventListener('focus', refreshOnReturn);
    window.addEventListener('pageshow', event => { if (event.persisted) refreshOnReturn(); });
    window.addEventListener('online', () => { if (!document.hidden && !refreshing) fetchRealMarketData(); });
    loadCatalogue();
    fetchRealMarketData();
});
