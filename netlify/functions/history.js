const YAHOO_CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const REQUEST_TIMEOUT_MS = 12000;

const TIMEFRAME_CONFIG = {
    day: { range: '1d', interval: '1h' },
    week: { range: '5d', interval: '1d' },
    month: { range: '1mo', interval: '1d' },
    year: { range: '1y', interval: '1mo' },
    '5years': { range: '5y', interval: '3mo' }
};

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

exports.handler = async function(event) {
    try {
        const params = event.queryStringParameters || {};
        const symbol = params.symbol && params.symbol.trim();
        const timeframe = params.timeframe || 'month';
        const config = TIMEFRAME_CONFIG[timeframe] || TIMEFRAME_CONFIG.month;

        if (!symbol) {
            return jsonResponse(400, { error: 'Falta el parametro symbol' });
        }

        const url = `${YAHOO_CHART_URL}${encodeURIComponent(symbol)}?interval=${config.interval}&range=${config.range}`;
        const response = await fetchWithTimeout(url);

        if (!response.ok) {
            return jsonResponse(response.status, { error: `Yahoo ${response.status}` });
        }

        const data = await response.json();
        const chart = data && data.chart;

        if (chart && chart.error) {
            return jsonResponse(502, {
                error: chart.error.description || chart.error.code || 'Yahoo chart error'
            });
        }

        const result = chart && chart.result && chart.result[0];
        const timestamps = result && result.timestamp;
        const closes = result && result.indicators && result.indicators.quote &&
            result.indicators.quote[0] && result.indicators.quote[0].close;
        const meta = result && result.meta;

        if (!Array.isArray(timestamps) || !Array.isArray(closes)) {
            return jsonResponse(502, { error: 'Respuesta historica no valida' });
        }

        const points = timestamps
            .map((timestamp, index) => ({
                timestamp,
                close: closes[index]
            }))
            .filter(point => typeof point.close === 'number');

        return jsonResponse(200, {
            symbol,
            timeframe,
            currency: meta && meta.currency,
            points,
            updatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error history function:', error);
        return jsonResponse(500, {
            error: 'Error interno',
            message: error && error.message ? error.message : String(error)
        });
    }
};
