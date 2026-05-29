// 1. Trampa para engañar al escáner de Netlify y que empaquete la librería
try { require('yahoo-finance2'); } catch(e) {}

// 2. Nuestro código real a prueba de fallos
exports.handler = async function(event, context) {
    try {
        // Cargar la librería dinámicamente y sacar el objeto correcto (esté donde esté)
        const modulo = await import('yahoo-finance2');
        const yahooFinance = modulo.default || modulo;
        
        const symbolsParam = event.queryStringParameters.symbols;
        
        if (!symbolsParam) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
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
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                quoteResponse: {
                    result: Array.isArray(quotes) ? quotes : [quotes]
                }
            })
        };
    } catch (error) {
        console.error("Error:", error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'Error interno' })
        };
    }
};
