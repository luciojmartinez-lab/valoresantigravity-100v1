const YAHOO_CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const REQUEST_TIMEOUT_MS = 12000;

function jsonResponse(statusCode, payload) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(payload)
    };
}

async function fetchWithTimeout(url) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        return await fetch(url, { signal: controller.signal });
    } finally {
        clearTimeout(timeoutId);
    }
}

function getRegularMarketChangePercent(meta) {
    const price = meta.regularMarketPrice;
    const previousClose = meta.chartPreviousClose || meta.previousClose;

    if (typeof price !== 'number' || typeof previousClose !== 'number' || previousClose === 0) {
        return 0;
    }

    return ((price - previousClose) / previousClose) * 100;
}

async function getQuote(symbol) {
    const url = `${YAHOO_CHART_URL}${encodeURIComponent(symbol)}?interval=1d&range=5d`;
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
        throw new Error(`Yahoo ${response.status}`);
    }

    const data = await response.json();
    const chart = data && data.chart;

    if (chart && chart.error) {
        throw new Error(chart.error.description || chart.error.code || 'Yahoo chart error');
    }

    const result = chart && chart.result && chart.result[0];
    const meta = result && result.meta;

    if (!meta || typeof meta.regularMarketPrice !== 'number') {
        throw new Error('Sin precio de mercado');
    }

    return {
        symbol,
        regularMarketPrice: meta.regularMarketPrice,
        regularMarketChangePercent: getRegularMarketChangePercent(meta),
        currency: meta.currency,
        regularMarketTime: meta.regularMarketTime,
        exchangeName: meta.exchangeName
    };
}

exports.handler = async function(event) {
    try {
        const symbolsParam = event.queryStringParameters && event.queryStringParameters.symbols;

        if (!symbolsParam) {
            return jsonResponse(400, { error: 'Falta el parametro symbols' });
        }

        const symbols = [...new Set(
            symbolsParam
                .split(',')
                .map(symbol => symbol.trim())
                .filter(Boolean)
        )];

        if (symbols.length === 0) {
            return jsonResponse(400, { error: 'No hay simbolos validos' });
        }

        const settledQuotes = await Promise.allSettled(symbols.map(getQuote));
        const result = [];
        const errors = [];

        settledQuotes.forEach((settled, index) => {
            const symbol = symbols[index];

            if (settled.status === 'fulfilled') {
                result.push(settled.value);
            } else {
                errors.push({
                    symbol,
                    message: settled.reason && settled.reason.message ? settled.reason.message : 'Error desconocido'
                });
            }
        });

        return jsonResponse(200, {
            quoteResponse: { result },
            errors,
            updatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error quote function:', error);
        return jsonResponse(500, {
            error: 'Error interno',
            message: error && error.message ? error.message : String(error)
        });
    }
};
