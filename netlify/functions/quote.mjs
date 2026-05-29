exports.handler = async function(event, context) {
    try {
        // Truco definitivo: Cargar la librería ESM dinámicamente dentro de CommonJS
        const yahooFinance = (await import('yahoo-finance2')).default;
        
        const symbolsParam = event.queryStringParameters.symbols;
        
        if (!symbolsParam) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({ error: 'Falta el parámetro symbols' })
            };
        }

        const symbolsArray = symbolsParam.split(',');
        
        const quotes = await yahooFinance.quote(symbolsArray);
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                quoteResponse: {
                    result: Array.isArray(quotes) ? quotes : [quotes]
                }
            })
        };
    } catch (error) {
        console.error("Error consultando Yahoo Finance:", error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ error: 'Error interno obteniendo los datos' })
        };
    }
};
