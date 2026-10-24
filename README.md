# Consulta de Valores · versión web 100v15

Publicación: https://consulta-de-valores.netlify.app/

La versión web reúne el catálogo ampliado de ETF estadounidenses y europeos y acciones españolas, Yahoo Finance y las series diarias del Banco de España. Conserva las divisas y migra la selección de ETF de la aplicación móvil anterior. Cada dispositivo mantiene sus propias preferencias en el navegador; no hay sincronización de selecciones entre dispositivos.

## Simulación bursátil

La pestaña nueva permite construir una cartera con acciones/ETF y compras o ventas de opciones call/put. El capital inicial es editable (10.000 EUR por defecto). Incluye un ejemplo didáctico con precios y primas ficticios, consulta de precios iniciales en Yahoo y búsqueda local o en línea. Las primas de opciones, los precios finales y los cambios futuros son manuales; no hay cadena de opciones en tiempo real.

El cálculo separa desembolso inicial, primas, efectivo libre, garantías completas de puts vendidas, comisiones, impuestos de transacción por valor, cambio, deslizamiento, dividendos, retenciones e IRPF adicional estimado. Las calls vendidas exigen acciones de cobertura y no pueden compartirlas entre contratos. No se permite financiación ni margen. Los contratos usan multiplicador editable (habitualmente 100), fecha, strike y vencimiento o prima de cierre anticipado. A vencimiento se calcula el resultado económico equivalente de liquidar también los títulos; no es un motor de asignación física o fiscal de lotes.

Los perfiles Smart y All-inclusive siguen el anexo 6 de Freedom24 de 19/08/2026, enlazado en la interfaz, y se comparan para cada cartera. Todas las tarifas se pueden modificar. Los costes de cambio, bolsa, ejercicio y otros gastos no verificados empiezan en cero y requieren confirmación. La retirada opcional admite el coste de transferencia EUR. No se dan por negociables todos los instrumentos del catálogo para cualquier cliente o intermediario.

La fiscalidad usa por defecto la escala del ahorro de España en régimen común: 19/21/23/27/30 %. Los tipos y otras rentas del año son editables. Se compensan las operaciones simuladas del mismo año y las pérdidas con rendimientos hasta el límite cruzado del 25 %. No se presume devolución por pérdidas ni deducción extranjera: esta última se introduce confirmada y se limita al impuesto adicional y a la retención extranjera. No aplica FIFO de tenencias previas, recompra de valores homogéneos, pérdidas de ejercicios anteriores, mínimos personales ni normativa foral completa. La interfaz enlaza las fuentes AEAT y explica los supuestos.

`simulation-engine.mjs` contiene el motor puro y sus validaciones; `simulator.mjs` la interfaz y la persistencia; `simulation.css` los estilos adaptados a PC/móvil. Las simulaciones se guardan localmente, con hasta 20 escenarios por dispositivo y transferencia mediante JSON; los informes se pueden descargar en CSV o imprimir a PDF. Los JSON generales de Configuración siguen conservando sólo las preferencias y selección del panel de valores. Ninguna simulación envía cantidades o capital a un intermediario ni opera una cuenta.

## Actualización del programa

`node build.mjs` genera `public/` y calcula un identificador a partir del código y los datos publicados. El HTML, el worker y `version.json` llevan el mismo identificador. La aplicación comprueba `version.json` al abrir, volver del segundo plano o recuperar la conexión. Si hay una versión nueva se recarga una sola vez, conservando localStorage e IndexedDB. El worker utiliza red primero para el programa y guarda la copia para usos sin conexión. Las respuestas de cotizaciones y de versión no se almacenan en la caché del worker.

La primera vez que se pasa de la antigua versión 11 es necesario cerrar y volver a abrir la aplicación, o recargarla, para recibir el actualizador. A partir de entonces las publicaciones posteriores se detectan automáticamente con conexión. Una copia HTML o Python en una carpeta del PC no recibe publicaciones de Netlify: para disponer del mismo programa en ambos dispositivos hay que abrir esta dirección o su acceso directo instalado.

## Desarrollo y datos

- `node build.mjs`: genera el sitio sin dependencias externas.
- `node --test tests/*.test.mjs`: comprueba cálculos financieros, opciones, garantías, divisas y fiscalidad, además de actualización, funcionamiento sin red y migración.
- Netlify publica solo `public/`; las funciones y las copias de datos de apoyo quedan fuera de ese directorio.
- `netlify/functions/market.mjs` atiende consultas de los activos seleccionados, históricos, búsqueda y renta fija. El antiguo backend se mantiene para los clientes que aún están abiertos con la versión anterior.
- El catálogo descargado de Yahoo se incluye con cada publicación. «Recargar catálogo» vuelve a descargar esa copia; «Buscar en Yahoo» consulta nuevas incorporaciones y tickers individuales. No es un censo independiente de todos los fondos existentes.
- Las series del Banco de España se identifican por código, indican fuente y fecha y usan una copia fechada si la fuente no responde. Son referencias diarias de rentabilidad, no precios de bonos individuales.
- `.netlify/`, el resultado de compilación y las dependencias se excluyen de Git.
