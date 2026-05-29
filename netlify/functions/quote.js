const yahooFinance = require('yahoo-finance2').default;

exports.handler = async function(event, context) {
    try {
        // Obtenemos los símbolos de la URL (ej: ?symbols=AAPL,MSFT,EURUSD=X)
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
        
        // yahoo-finance2 se encarga de saltar las protecciones de Yahoo automáticamente
        const quotes = await yahooFinance.quote(symbolsArray);
        
        // El frontend original espera que la respuesta tenga este formato exacto:
        // { quoteResponse: { result: [...] } }
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
