import {defaults} from './simulation-engine.mjs';

// Precios, tickers, dividendos y cambios de práctica: independientes de las cotizaciones.
export const LESSONS = [
    {id:'first',level:1,title:'1. Mi primera compra',capital:1000,tag:'Empieza aquí',summary:'Una empresa, 50 acciones y un cambio de precio fácil de entender.',
        learn:'Aprenderás a separar el dinero que aportas, el que inviertes y la ganancia después de gastos.',
        story:'Dispones de 1.000 €. Compras 50 acciones a 10 €: inviertes 500 € más la comisión. Pruebas qué ocurriría si las vendieras a 11 €. El resto del dinero sigue siendo tuyo y permanece sin invertir.',
        try:'Cambia el precio final de 11 a 9 €. Después prueba 10 y 12 €. Aunque vendas al mismo precio de compra, las comisiones generan una pequeña pérdida.'},
    {id:'loss',level:1,title:'2. También se puede perder',capital:1000,tag:'Básico',summary:'La misma compra, con una bajada de precio.',
        learn:'Verás que una pérdida no se convierte automáticamente en una devolución de impuestos.',
        story:'Compras 50 acciones a 10 € y las vendes a 9 €. Recuperas menos dinero del que invertiste y también pagas los gastos de operar. No se calcula IRPF adicional sobre esa pérdida.',
        try:'Compara el resultado con el primer ejemplo. Cambia el precio final a 10 € y observa que recuperar el precio inicial no cubre las comisiones.'},
    {id:'basket',level:1,title:'3. Repartir 1.000 €',capital:1000,tag:'Básico',summary:'Dos empresas y un ETF: unas posiciones suben y otras bajan.',
        learn:'Entenderás qué es una cartera y por qué importa el resultado conjunto.',
        story:'Repartes parte del capital entre tres líneas: una empresa sube, otra baja y un ETF sube un poco. La aplicación suma las ganancias, las pérdidas y los gastos de todas ellas. Un ETF es un fondo que cotiza en bolsa; puede repartir su inversión entre varios activos y también puede perder valor.',
        try:'Baja el precio final del ETF de 105 a 90 €. Repartir la inversión no garantiza evitar pérdidas. Mira también cuánto pesan las comisiones al hacer varias operaciones pequeñas.'},
    {id:'dividend',level:1,title:'4. Cobrar un dividendo',capital:1000,tag:'Básico',summary:'El precio acaba igual, pero la empresa reparte un importe por acción.',
        learn:'Distinguirás un dividendo bruto del beneficio neto de toda la operación.',
        story:'Tienes 50 acciones y cada una paga 0,20 € durante el periodo: son 10 € brutos. El precio final es igual al inicial. Las comisiones y la fiscalidad reducen el resultado. El dividendo no asegura una rentabilidad positiva ni evita que caiga la cotización.',
        try:'Prueba un dividendo de 0 € y luego de 0,40 €. Es un importe total por acción durante el periodo, no un porcentaje anual.'},
    {id:'currency',level:2,title:'5. ¿Y si compro en dólares?',capital:1000,tag:'Divisas',summary:'La acción no cambia de precio en dólares; el resultado en euros sí.',
        learn:'Descubrirás el efecto del cambio de moneda.',
        story:'Compras cinco acciones a 100 USD. Al entrar, 1 € compra 1,10 USD; al salir, compra 1,20 USD. Como necesitas menos euros para obtener los mismos dólares, tus acciones valen menos en euros aunque su precio en dólares no cambie. El coste de conversión del ejemplo es una suposición del 0,15 % por cambio.',
        try:'Cambia únicamente el cambio final de 1,20 a 1,00. Ahora esos dólares se convierten en más euros. Mantén el precio de la acción en 100 para aislar el efecto de la moneda.'},
    {id:'call',level:2,title:'6. Comprar una call',capital:1000,tag:'Opciones · después',summary:'Pagar una prima por el derecho a comprar a un precio acordado.',
        learn:'Distinguirás el coste del derecho y el dinero necesario para ejercerlo.',
        story:'Una call da a su comprador el derecho a comprar. Aquí la prima es 0,40 USD por acción y el contrato abarca 100 acciones: pagas 40 USD, más gastos. El precio acordado, llamado strike, es 5 USD. A vencimiento se prueba un subyacente a 6 USD. Pagar la prima no equivale a haber comprado las 100 acciones.',
        try:'Baja el precio final a 4 USD. El derecho no tendría valor intrínseco al vencer y perderías la prima pagada y los gastos. Si ejercieras para recibir acciones, necesitarías además el importe del strike multiplicado por 100. El ejemplo calcula una liquidación económica equivalente, no ejecuta el ejercicio físico.'},
    {id:'put',level:2,title:'7. Proteger acciones con una put',capital:1500,tag:'Opciones · después',summary:'Comprar acciones y pagar por un derecho a venderlas.',
        learn:'Verás que una protección también tiene un coste.',
        story:'Compras 100 acciones a 10 USD y una put con strike 10 USD, pagando una prima de 0,60 USD por acción. Pruebas una caída a 8 USD: las acciones pierden valor y la put adquiere valor intrínseco. Los títulos y la opción comparten el mismo precio final y cambio de moneda.',
        try:'Usa los botones de «Probar otra situación» de esta práctica para cambiar a la vez ambas líneas. Si el precio acaba en 12 USD, la put no tiene valor intrínseco al vencer y su prima sigue siendo un coste.'},
    {id:'covered',level:3,title:'8. Vender una call cubierta',capital:1500,tag:'Avanzado',summary:'Cobrar una prima a cambio de limitar la subida que aprovecharías.',
        learn:'Comprenderás la obligación de entregar acciones si te asignan la opción.',
        story:'Tienes 100 acciones y vendes una call sobre esas mismas 100, con strike 11 USD. Cobras una prima, pero si te asignan tendrás que entregar los títulos al precio acordado. La cobertura evita una venta call descubierta; no evita que tus acciones pierdan valor.',
        try:'Prueba precios finales de 8, 10 y 14 USD con los botones de esta práctica. Observa la pérdida cuando la acción cae y cómo se limita el beneficio cuando sube mucho. Una opción americana vendida puede asignarse antes del vencimiento; este ejemplo no simula ese momento.'},
    {id:'short-put',level:3,title:'9. Vender una put con efectivo',capital:1500,tag:'Avanzado',summary:'Cobrar una prima asumiendo la posible obligación de comprar.',
        learn:'Verás por qué una prima cobrada no es un beneficio asegurado.',
        story:'Vendes una put con strike 10 USD sobre 100 acciones y cobras una prima de 0,50 USD por acción. Se reservan 1.000 USD, convertidos a euros al cambio inicial, para una posible compra. Si la acción cae mucho, la pérdida puede superar ampliamente la prima recibida.',
        try:'Prueba precios finales de 12, 8 y 0 USD. Una prima pequeña puede acompañar una pérdida importante. La reserva no es una comisión: es dinero comprometido. Los gastos y el cambio de divisa pueden aumentar lo necesario.'},
    {id:'mixed',level:3,title:'10. El ejemplo completo de 10.000 €',capital:10000,tag:'Avanzado',summary:'Acciones, ETF, call y put en una misma simulación.',
        learn:'Reunirás los conceptos de las prácticas anteriores.',
        story:'La cartera combina cuatro líneas para que puedas revisar cada resultado y el total. Todos los nombres y precios son de práctica. La retirada final de 7 € y el coste de cambio del 0,15 % forman parte de este escenario; puedes modificarlos.',
        try:'Lee primero el resultado por posición y después el total neto. El capital final incluye el dinero que dejaste sin invertir. Usa el gráfico de sensibilidad para probar variaciones conjuntas, sin interpretarlas como probabilidades.'}
];

export function createLesson(id, date = new Date().toISOString().slice(0,10)) {
    const lesson=LESSONS.find(x=>x.id===id);
    if(!lesson)throw new Error('Ejemplo no disponible.');
    const s={...defaults(),date,endDate:`${date.slice(0,4)}-12-31`,name:lesson.title,capital:lesson.capital,practiceExample:id};
    const row=(changes={})=>({ticker:'DEMO.A',name:'Empresa A · práctica',kind:'stock',side:'buy',qty:50,currency:'EUR',entry:10,target:11,
        premium:0,closePremium:0,multiplier:100,strike:10,expiry:s.endDate,exitMode:'expiry',optionMarket:'other',dividend:0,
        fxEntry:1,fxExit:1,feeUsdEntry:1.1,feeUsdExit:1.1,withholdForeign:0,withholdSpain:0,buyTax:0,sellTax:0,slippage:0,
        extraEntry:0,extraExit:0,exerciseFee:0,quoteNote:'Práctica con ticker, precios y cambios ficticios. No corresponde a una orden ni a una recomendación de inversión.',...changes});
    const usa=(changes={})=>row({ticker:'DEMO.USA',name:'Empresa en dólares · práctica',currency:'USD',qty:100,fxEntry:1.1,fxExit:1.1,entry:10,target:8,optionMarket:'us',...changes});
    if(id==='first')s.positions=[row()];
    if(id==='loss')s.positions=[row({target:9})];
    if(id==='basket')s.positions=[row({qty:20}),row({ticker:'DEMO.B',name:'Empresa B · práctica',qty:10,entry:20,target:18}),row({ticker:'DEMO.ETF',name:'ETF de práctica',qty:4,entry:100,target:105})];
    if(id==='dividend')s.positions=[row({target:10,dividend:.2})];
    if(id==='currency'){s.positions=[usa({qty:5,entry:100,target:100,fxExit:1.2})];s.fxPct=.15;}
    if(id==='call')s.positions=[usa({kind:'call',qty:1,entry:5,target:6,strike:5,premium:.4,exerciseFee:2})];
    if(id==='put')s.positions=[usa(),usa({kind:'put',qty:1,premium:.6,exerciseFee:2})];
    if(id==='covered')s.positions=[usa({target:12}),usa({kind:'call',side:'sell',qty:1,target:12,strike:11,premium:.5,exerciseFee:2})];
    if(id==='short-put')s.positions=[usa({kind:'put',side:'sell',qty:1,premium:.5,exerciseFee:2})];
    if(id==='mixed'){
        s.fxPct=.15;s.withdrawal=7;
        s.positions=[row({qty:300,entry:8,target:8.8,dividend:.2,buyTax:.2,withholdSpain:19}),row({ticker:'DEMO.ETF',name:'ETF de práctica',qty:20,entry:140,target:150}),
            usa({kind:'call',qty:1,entry:40,target:46,strike:42,premium:2.2,exerciseFee:2}),usa({kind:'put',qty:1,entry:40,target:46,strike:38,premium:1.5,exerciseFee:2})];
    }
    return s;
}

export const TUTORIAL = [
    {title:'Aquí puedes equivocarte sin gastar dinero',paragraphs:['Una simulación es una prueba con números. No abre una cuenta, no compra nada y no mueve tu dinero. El resultado depende del precio final que tú pongas: no es una predicción.','Vamos a practicar con 1.000 € ficticios, una sola empresa y dos precios. Las opciones pueden esperar. Pulsa «Cargar mi primera práctica» para prepararla.']},
    {title:'Capital y acciones: no son lo mismo',paragraphs:['Capital inicial es todo el dinero disponible. Número de acciones es la cantidad que compras. Precio inicial es lo que cuesta cada una.','En la primera práctica: 50 acciones × 10 € = 500 €. La comisión de compra se añade a esos 500 €. El dinero restante sigue dentro del capital final como efectivo sin invertir. No es obligatorio invertir los 1.000 € enteros.']},
    {title:'Prueba una subida y una bajada',paragraphs:['Precio final es el precio de venta que quieres probar. Nadie conoce el precio futuro: ensaya distintas situaciones. Los botones de abajo cambian únicamente ese supuesto en la primera práctica.','Vender a 11 € daría 50 € de ganancia antes de gastos: (11 − 10) × 50. Vender a 9 € produciría una pérdida de 50 € antes de gastos. Comprueba también qué ocurre a 10 €.']},
    {title:'Lee estas cuatro cifras',paragraphs:['Capital final: lo que quedaría al liquidar todo, incluido lo que no invertiste. Beneficio o pérdida neta: cuánto ganas o pierdes después de los costes y el impuesto estimado.','Costes: comisiones y demás gastos del escenario. IRPF adicional estimado: la provisión de impuesto por esa cartera; no significa que el bróker lo haya retenido ya. El detalle está más abajo, en «Resultado estimado».']},
    {title:'Los gastos importan, aunque inviertas poco',paragraphs:['El intermediario o bróker cobra por ejecutar tus órdenes. Comprar y vender suelen ser dos operaciones. Con importes pequeños, esas comisiones pueden consumir buena parte de una subida.','Con los números originales de la primera práctica: 50 € de subida − 6 € de comisiones = 44 € antes del IRPF. Sin otras rentas ni ajustes fiscales, el 19 % de 44 € son 8,36 €. Quedarían 35,64 € netos. Al cambiar los datos, también cambia este resultado.','El IRPF se estima sobre las ganancias computables, no sobre el dinero que aportaste. Si añades dividendos, otras rentas o inversiones en moneda extranjera, aparecen más factores. Los campos avanzados permiten ajustarlos; las cifras fiscales son una estimación para el escenario.']},
    {title:'Tu siguiente práctica',paragraphs:['Prueba «También se puede perder» y «Repartir 1.000 €». Después, dividendos y divisas. Puedes volver a esta ayuda siempre que quieras.','Para crear una cartera con valores del catálogo: elige «Nueva simulación», escribe tu capital, busca un valor, añádelo y consulta su precio inicial. Pon la cantidad de acciones y un precio final de prueba. Revisa que no falte capital y compara varios resultados.','Deja las opciones para después de entender las prácticas básicas. Comprar una opción puede suponer perder toda la prima y gastos; venderla añade obligaciones de compra o entrega. Completar estos ejemplos no acredita que una operación real sea adecuada para ti.']}
];

export const GLOSSARY = [
    ['Acción','Una pequeña participación en una empresa. Su precio puede subir o bajar; puedes perder parte o todo lo invertido.'],
    ['ETF','Un fondo que cotiza en bolsa. Puede contener acciones, bonos u otros activos. No todos los ETF son iguales ni tienen el mismo riesgo.'],
    ['Índice','Una referencia que resume cómo evoluciona un conjunto de valores, por ejemplo el IBEX 35. En el panel se expresa en puntos.'],
    ['Cotización y ticker','La cotización es el precio observado. El ticker es el código con el que se identifica una cotización en un mercado. Los códigos DEMO de las prácticas son ficticios.'],
    ['Capital inicial y cartera','El capital es el dinero disponible al empezar. La cartera es el conjunto de inversiones que incluyes. Puedes dejar parte del capital sin invertir.'],
    ['Precio final de prueba','Un supuesto que introduces para calcular qué ocurriría si vendieras a ese precio. No es una estimación automática del mercado.'],
    ['Cantidad de acciones y contratos','En una acción, 10 unidades son 10 acciones. En opciones, 1 contrato puede representar 100 acciones; revisa el multiplicador del contrato concreto.'],
    ['Comisión y orden','Una orden es una instrucción de compra o venta al intermediario. La comisión es su coste. Una compra y una venta se calculan como dos operaciones en el simulador.'],
    ['Dividendo','Un reparto de dinero de una empresa o fondo. Aquí introduces el total bruto por acción durante el periodo. No es un porcentaje ni un beneficio garantizado.'],
    ['Divisa y cambio','La divisa es la moneda. «1,10 USD por 1 EUR» significa que un euro compra 1,10 dólares. Si inviertes en dólares, su cambio frente al euro también modifica el resultado.'],
    ['Bruto y neto','Bruto indica una cantidad antes de determinados descuentos. Neto es lo que queda después. Lee la etiqueta: un resultado por posición antes del IRPF todavía no es el beneficio neto final.'],
    ['IRPF y retención','El IRPF es el impuesto personal sobre la renta. Una retención es un anticipo de impuesto. La estimación final depende de la declaración completa; no se descuentan dos veces los anticipos.'],
    ['Call y put','Una call comprada da derecho a comprar; una put comprada, a vender, según las condiciones del contrato. Quien vende la opción asume la obligación contraria si le asignan.'],
    ['Prima','El precio de la opción. En estos ejemplos se expresa por acción: prima × acciones por contrato × contratos = importe de la prima. Al comprarla se paga; al venderla se cobra y se asumen obligaciones.'],
    ['Subyacente y strike','El subyacente es el activo al que se refiere una opción. El strike es el precio acordado para comprarlo o venderlo si se ejerce. No es la prima.'],
    ['Vencimiento y cierre anticipado','Vencimiento es la fecha en que termina la opción. También puedes simular cerrarla antes con una prima de salida introducida manualmente. Su valor antes de vencer no depende sólo del precio del subyacente.'],
    ['Valor intrínseco','Al vencimiento, una call tiene valor intrínseco si el subyacente supera el strike; una put, si está por debajo. Puede no haber valor intrínseco y perderse la prima pagada.'],
    ['Cobertura y reserva de efectivo','Una call cubierta se respalda con acciones que puedes entregar. Para las puts vendidas el simulador reserva el strike completo. Reservar efectivo no es pagar una comisión ni eliminar el riesgo.'],
    ['Ejercer y ser asignado','Ejercer es usar el derecho de una opción. Ser asignado afecta a quien la vendió y debe cumplir la compra o entrega. En opciones sobre acciones puede haber intercambio físico de títulos y gastos adicionales.'],
    ['Liquidación y año fiscal','Aquí se supone que vendes o liquidas todas las posiciones en la fecha final y dentro del mismo año. En una operación real, una subida de precio sin vender no equivale a una ganancia realizada.'],
    ['Ejemplo y recomendación','Las prácticas sirven para entender cálculos. Sus empresas, ETF, precios, primas y cambios son ficticios; no proponen una cartera real ni prometen un resultado.']
];
