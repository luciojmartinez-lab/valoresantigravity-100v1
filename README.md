# Consulta de Valores · versión web 100v14

Publicación: https://valoresantigravity-100v1.netlify.app/

La versión web reúne el catálogo ampliado de ETF estadounidenses y europeos y acciones españolas, Yahoo Finance y las series diarias del Banco de España. Conserva las divisas y migra la selección de ETF de la aplicación móvil anterior. Cada dispositivo mantiene sus propias preferencias en el navegador; no hay sincronización de selecciones entre dispositivos.

## Actualización del programa

`node build.mjs` genera `public/` y calcula un identificador a partir del código y los datos publicados. El HTML, el worker y `version.json` llevan el mismo identificador. La aplicación comprueba `version.json` al abrir, volver del segundo plano o recuperar la conexión. Si hay una versión nueva se recarga una sola vez, conservando localStorage e IndexedDB. El worker utiliza red primero para el programa y guarda la copia para usos sin conexión. Las respuestas de cotizaciones y de versión no se almacenan en la caché del worker.

La primera vez que se pasa de la antigua versión 11 es necesario cerrar y volver a abrir la aplicación, o recargarla, para recibir el actualizador. A partir de entonces las publicaciones posteriores se detectan automáticamente con conexión. Una copia HTML o Python en una carpeta del PC no recibe publicaciones de Netlify: para disponer del mismo programa en ambos dispositivos hay que abrir esta dirección o su acceso directo instalado.

## Desarrollo y datos

- `node build.mjs`: genera el sitio sin dependencias externas.
- `node --test tests/*.test.mjs`: comprueba actualización, funcionamiento sin red y migración.
- Netlify publica solo `public/`; las funciones y las copias de datos de apoyo quedan fuera de ese directorio.
- `netlify/functions/market.mjs` atiende consultas de los activos seleccionados, históricos, búsqueda y renta fija. El antiguo backend se mantiene para los clientes que aún están abiertos con la versión anterior.
- El catálogo descargado de Yahoo se incluye con cada publicación. «Recargar catálogo» vuelve a descargar esa copia; «Buscar en Yahoo» consulta nuevas incorporaciones y tickers individuales. No es un censo independiente de todos los fondos existentes.
- Las series del Banco de España se identifican por código, indican fuente y fecha y usan una copia fechada si la fuente no responde. Son referencias diarias de rentabilidad, no precios de bonos individuales.
- `.netlify/`, el resultado de compilación y las dependencias se excluyen de Git.
