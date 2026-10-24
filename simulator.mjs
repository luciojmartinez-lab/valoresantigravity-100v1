import {calculate, defaults, PROFILES, validate} from './simulation-engine.mjs';
import {LESSONS, TUTORIAL, GLOSSARY, createLesson} from './simulation-lessons.mjs';
const $ = id => document.getElementById(id);
const html = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const eur = v => Number.isFinite(v) ? Number(v.toFixed(8)).toLocaleString('es-ES', {style:'currency',currency:'EUR'}) : '—';
const num = v => Number.isFinite(v) ? v.toLocaleString('es-ES', {maximumFractionDigits: 4}) : '—';
const KEY = 'valores_simulation_v1', SAVED = 'valores_simulation_saved_v1';
const LEARNING = 'valores_learning_v1', PRACTICE_BACKUP = 'valores_practice_backup_v1';
let state = defaults(), saved = [], matches = [], shock = 0, quoteRequest = 0;
let learning = {simple:true,open:false,tab:'tutorial',step:0}, practiceBackup = null;
let searchRequest = 0;
const status = message => {$('sim-status').textContent = message;};
function persist() {
    try {localStorage.setItem(KEY, JSON.stringify(state));} catch (_) {status('El navegador no permite guardar. Exporta tu simulación a JSON.');}
}
function field(key, label, value, options = {}) {
    const {row, min = 0, step = 'any', type = 'number', help = '', advanced = false} = options;
    const id = `sim-${row === undefined ? 'cfg' : row}-${key}`;
    const attrs = row === undefined ? `data-setting="${key}"` : `data-row="${row}" data-field="${key}"`;
    return `<label class="sim-field${advanced?' sim-advanced':''}" for="${id}">${label}<input id="${id}" ${attrs} type="${type}" value="${html(value)}" ${type === 'number' ? `min="${min}" step="${step}"` : ''}>${help ? `<small>${help}</small>` : ''}</label>`;
}
function select(key, label, value, choices, row, advanced = false) {
    const id = `sim-${row === undefined ? 'cfg' : row}-${key}`;
    return `<label class="sim-field${advanced?' sim-advanced':''}" for="${id}">${label}<select id="${id}" ${row === undefined ? `data-setting="${key}"` : `data-row="${row}" data-field="${key}"`}>${choices.map(([v,l]) => `<option value="${v}" ${value === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
}
const SOURCES = `<details class="sim-panel sim-sources"><summary>Cómo se calcula · fuentes y límites</summary>
<p>Son escenarios hipotéticos, no previsiones. Los precios de entrada consultados en Yahoo pueden estar retrasados. Los precios futuros, dividendos, primas y cambios son supuestos tuyos. Los ejemplos usan cifras ficticias. La disponibilidad de un activo en el catálogo no confirma que tu intermediario permita negociarlo; algunos ETF estadounidenses están restringidos para minoristas europeos.</p>
<ul><li><a href="https://freedom24.com/download/documents/1203/Appendix_6_Fee_Schedule_19082026" target="_blank" rel="noopener">Freedom24 · anexo 6, vigente desde 19/08/2026</a>. Smart: acciones/ETF EE.UU. y Europa 2 + 0,02 por acción y orden, en USD o EUR según mercado; opciones sobre acciones de EE.UU. 0,65 USD por contrato y operación, vencimiento sin comisión. Otros contratos: 1,50 por operación y vencimiento. All-inclusive: 0,5 % + 0,012 por acción + 1,20 por orden; opciones EE.UU. 3 USD por contrato + 10 USD por orden. Retirada por transferencia de cuenta EUR: 7 EUR, sin intermediarios. Son perfiles para órdenes ordinarias; promociones y compras recurrentes tienen otras condiciones.</li>
<li><a href="https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-ayuda-presentacion/irpf-2025/8-cumplimentacion-irpf/8_4-cuota-integra/8_4_4-gravamen-base-liquidable-ahorro.html" target="_blank" rel="noopener">AEAT · escala del ahorro</a>. Régimen común: 19 / 21 / 23 / 27 / 30 %, tramos 6.000 / 50.000 / 200.000 / 300.000 EUR. Referencia vigente comprobada el 24/10/2026; editable para cambios posteriores. País Vasco y Navarra requieren su normativa: el tipo manual es una aproximación, no su declaración.</li>
<li><a href="https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025/c12-integracion-compensacion-rentas/reglas-integracion-compensacion-rentas/integracion-compensacion-rentas-base-imponible-ahorro.html" target="_blank" rel="noopener">AEAT · compensación de rentas</a>. Se agregan ganancias y pérdidas realizadas del año, con compensación cruzada del 25 % entre transmisiones y rendimientos. «Otras rentas» recoge saldos del año antes de esta cartera. No se aplican automáticamente pérdidas de años anteriores, recompra de valores homogéneos, FIFO de carteras previas, mínimos personales, patrimonio ni declaraciones informativas. Las pérdidas pendientes que se muestran son del año simulado y no se convierten en una devolución.</li>
<li><a href="https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025/c11-ganancias-perdidas-patrimoniales/determinacion-importe-ganancias-perdidas-patrimon-especificas/operaciones-realizadas-mercados-futuros-opciones.html" target="_blank" rel="noopener">AEAT · futuros y opciones</a>. Se presupone que todas las posiciones se cierran en la fecha final del mismo año. En opciones a vencimiento se usa valor intrínseco y liquidación económica equivalente de los títulos. El ejercicio físico, sus lotes fiscales y la asignación anticipada requieren revisar el extracto real. Las primas de cierre anticipado se introducen manualmente: no se estima su valor con la variación del subyacente.</li>
<li><a href="https://www.optionseducation.org/optionsoverview/options-basics" target="_blank" rel="noopener">OCC · opciones y primas</a>. Prima por acción × multiplicador × contratos; el multiplicador habitual es 100 y puede variar. Compra call: derecho a comprar; compra put: derecho a vender. La venta call exige cobertura con acciones y la venta put reserva el strike completo. No se modela apalancamiento, compensación de garantías entre opciones ni financiación.</li>
<li>El IRPF adicional se estima comparando la base con y sin la cartera. No es una retención automática del bróker. La retención extranjera reduce el efectivo; introduce sólo la deducción por doble imposición que hayas confirmado, limitada aquí a lo retenido y al IRPF adicional. Las retenciones españolas son anticipos y no se descuentan dos veces. Un ahorro sobre otras rentas no se suma al beneficio neto.</li>
<li><a href="https://sede.agenciatributaria.gob.es/Sede/impuestos-tasas/impuesto-sobre-transacciones-financieras.html" target="_blank" rel="noopener">AEAT · impuesto sobre transacciones financieras</a>. Configura el impuesto de compra por valor; el 0,2 % español sólo corresponde a acciones sujetas, no a todos los valores. Otros mercados pueden tener sus propios gravámenes.</li>
<li>Las comisiones ordinarias, gastos de ejecución, cambio de las operaciones e impuestos de transacción se incluyen en el coste de adquisición/transmisión de esta estimación. La retirada y los gastos generales se restan al efectivo sin deducción fiscal. Confirma costes de cambio, bolsas, regulación, ejercicio y transferencias con el intermediario; los campos sin tarifa verificable empiezan en cero.</li></ul></details>`;

function render() {
    const root = $('screen-simulator');
    root.classList.toggle('sim-simple',learning.simple);
    root.innerHTML = `<div class="sim-wrap"><div class="sim-heading"><div class="sim-intro"><div class="sim-eyebrow">Tu capital, con todos los costes a la vista</div><h1>Simulación bursátil</h1><p class="sim-muted">Reparte tu inversión entre acciones, ETF y opciones. Compara cuánto necesitas al empezar y cuánto te quedaría después de gastos e impuestos.</p></div><span class="sim-tag">Cálculo local · sin operaciones reales</span></div>
    <section class="sim-start sim-no-print" aria-label="Ayuda para principiantes"><div><strong>¿Por dónde empiezo?</strong><p>Prueba una sola compra con 1.000 € ficticios. Te acompañamos paso a paso.</p></div><div class="sim-actions"><button class="sim-button" data-action="start-tutorial">Empezar tutorial</button><button class="sim-button secondary" data-action="learn-examples">Elegir ejemplo</button><button class="sim-button secondary" data-action="learn-glossary">Diccionario de bolsa</button></div></section>
    <details id="sim-school" class="sim-panel sim-no-print" ${learning.open?'open':''}><summary>Ayuda y ejemplos para principiantes</summary><div class="sim-learning-tabs" aria-label="Secciones de ayuda">${[['tutorial','Tutorial paso a paso'],['examples','10 ejemplos para practicar'],['glossary','Diccionario']].map(([tab,label])=>`<button class="sim-button ${learning.tab===tab?'':'secondary'}" data-action="learn-${tab}" aria-pressed="${learning.tab===tab}">${label}</button>`).join('')}</div><div id="sim-learning-content"></div></details>
    <div class="sim-viewbar sim-no-print"><span>${learning.simple?'Vista sencilla: empieza por cantidad y precios. Los demás ajustes conservan sus valores.':'Vista completa: puedes editar todos los campos.'}</span><button class="sim-button secondary" data-action="toggle-simple" aria-pressed="${learning.simple}">${learning.simple?'Mostrar todos los campos':'Usar vista sencilla'}</button>${practiceBackup?'<button class="sim-button secondary" data-action="restore-practice">Recuperar mi simulación anterior</button>':''}</div>
    <div id="sim-practice-guide" class="sim-no-print"></div>
    <section class="sim-panel sim-no-print" aria-label="Datos de la simulación"><div class="sim-topline"><h2>1. Define tu escenario</h2><div class="sim-actions"><button class="sim-button secondary" data-action="learn-examples">Elegir ejemplo</button><button class="sim-button secondary" data-action="new">Nueva simulación</button><button class="sim-button" data-action="results">Ver resultado ↓</button></div></div><div class="sim-grid">
    ${field('name','Nombre',state.name,{type:'text'})}${field('capital','Capital inicial (€)',state.capital)}${field('date','Fecha inicial',state.date,{type:'date'})}${field('endDate','Fecha final / liquidación',state.endDate,{type:'date'})}</div>
    <details class="sim-config"><summary>Comisiones, cambio de divisa e impuestos</summary><div class="sim-grid">
    ${select('profile','Perfil de comisiones',state.profile,[['smart','Freedom24 · Smart'],['inclusive','Freedom24 · All-inclusive'],['custom','Otro intermediario / personalizadas']])}
    ${field('fxPct','Coste de cambio por conversión (%)',state.fxPct,{help:'0 = pendiente de confirmar. Se aplica al abrir y al cerrar las líneas en divisa.'})}
    ${field('withdrawal','Retirada final (€)',state.withdrawal,{help:'0 si dejas el dinero en el bróker; transferencia Freedom24 EUR: 7 € más posibles intermediarios.'})}
    ${field('extraCosts','Otros gastos generales (€)',state.extraCosts,{help:'Custodia, datos, ingreso de fondos… Sin deducción fiscal en esta estimación.'})}
    ${Object.keys(PROFILES.smart).filter(k => k !== 'name').map(k => field(`fees.${k}`,({stockFixed:'Acciones: fijo / orden',stockUnit:'Acciones: por título',stockPct:'Acciones: sobre importe (%)',optionFixed:'Opciones EE.UU.: fijo / orden (USD)',optionUnit:'Opciones EE.UU.: por contrato (USD)',otherOptionUnit:'Otras opciones: por contrato',expiryUnit:'Vencimiento EE.UU.: por contrato (USD)',otherExpiryUnit:'Vencimiento otras: por contrato'})[k],state.fees[k])).join('')}
    </div><p class="sim-muted">Tarifas por cada operación de entrada y salida. Acciones: USD en mercado estadounidense y EUR en europeo; este perfil sólo calcula acciones cotizadas en USD o EUR. Otras divisas requieren tarifa personalizada en la moneda del activo.</p>
    <div class="sim-grid">${select('taxMode','Fiscalidad',state.taxMode,[['common','España · régimen común'],['flat','Tipo efectivo manual']])}${field('flatTax','Tipo manual (%)',state.flatTax)}${field('otherGains','Otras ganancias/pérdidas del año (€)',state.otherGains,{min:-1e12})}${field('otherIncome','Otros intereses/dividendos netos (€)',state.otherIncome,{min:-1e12})}${field('foreignCredit','Deducción extranjera confirmada (€)',state.foreignCredit,{help:'Por defecto 0. No toda retención extranjera es deducible.'})}${state.rates.map((v,i)=>field(`rates.${i}`,`Tramo ${i+1} del ahorro (%)`,v)).join('')}</div><p class="sim-muted">Residente en España. Se parte del régimen común; confirma la normativa si resides en País Vasco o Navarra. No se aplica IRPF al capital aportado. Todas las operaciones de esta simulación se liquidan en un mismo año.</p></details></section>
    <section class="sim-panel sim-no-print"><div class="sim-topline"><h2>2. Construye tu cartera</h2><div class="sim-actions"><button class="sim-button" data-action="add-stock">+ Acción / ETF</button><button class="sim-button secondary sim-advanced" data-action="add-call">+ Call</button><button class="sim-button secondary sim-advanced" data-action="add-put">+ Put</button></div></div>
    <div class="sim-searchbar"><input type="search" id="sim-search" aria-label="Buscar activo para la simulación" placeholder="Buscar en el catálogo: Santander, VWCE, SPY…"><button class="sim-button secondary" data-action="search">Buscar en Yahoo</button></div><div id="sim-search-results"></div><p class="sim-muted">Elige un activo para añadirlo como acción/ETF, o crea una línea y escribe su ticker. Las opciones usan el ticker del subyacente.</p>
    <div class="sim-actions">${state.practiceExample?'<span class="sim-muted" style="font-size:12px">Práctica con precios ficticios: puedes cambiar los números sin consultar el mercado. Para valores reales, empieza una nueva simulación.</span>':'<button class="sim-button secondary" data-action="quotes">Consultar precios actuales</button><span class="sim-muted" style="font-size:12px">Actualiza precios de entrada y cambios iniciales; conserva tus objetivos y primas.</span>'}</div><div id="sim-status" role="status" aria-live="polite"></div><div id="sim-positions"></div></section>
    <section aria-label="Resultado de la simulación"><div class="sim-topline"><h2>3. Resultado estimado</h2><span id="sim-liquidation-date" class="sim-muted" style="font-size:12px">Liquidación completa al ${html(state.endDate)}</span></div><div id="sim-result" aria-live="polite"></div></section>
    <section class="sim-panel sim-no-print"><h2>Guarda y compara</h2><p class="sim-muted">La simulación actual se guarda al editar en este dispositivo. Para llevarla al móvil, exporta el JSON y ábrelo allí con «Importar». No hay sincronización automática entre dispositivos.</p><div class="sim-storage"><label class="sim-field" for="sim-saved">Escenarios guardados<select id="sim-saved"><option value="">Elige un escenario…</option>${saved.map((s,i)=>`<option value="${i}">${html(s.name)}</option>`).join('')}</select></label><button class="sim-button" data-action="save">Guardar escenario</button><button class="sim-button secondary" data-action="load">Abrir</button><button class="sim-button danger" data-action="delete-saved">Eliminar guardado</button></div><div class="sim-actions" style="margin-top:14px"><button class="sim-button secondary" data-action="export">Exportar JSON</button><label class="sim-button secondary">Importar JSON<input id="sim-import" type="file" accept=".json,application/json" class="hidden"></label><button class="sim-button secondary" data-action="csv">Descargar informe CSV</button><button class="sim-button secondary" data-action="print">Imprimir resultado / PDF</button></div></section>${SOURCES}</div>`;
    renderLearning(); renderPositions(); renderResults();
}
function saveLearning() {
    try {localStorage.setItem(LEARNING,JSON.stringify(learning));}catch(_){}
}
function learningLive(r=calculate(state)) {
    if(!r.rows||r.errors.length)return '<p>Completa los datos de la simulación y revisa los avisos para ver su resultado aquí.</p>';
    const metrics=learning.step>=3?[['Capital final',r.finalCapital],['Beneficio / pérdida neta',r.net],['Costes de la cartera',r.costs],['IRPF adicional estimado',r.irpf-r.credit]]:[['Capital disponible',state.capital],['Desembolso inicial neto',r.debit],['Ganancia / pérdida neta',r.net],['Capital final',r.finalCapital]];
    return `<div class="sim-lesson-metrics">${metrics.map(([label,value])=>`<span>${label}<b>${eur(value)}</b></span>`).join('')}</div><p class="sim-muted">Son los datos actuales de «${html(state.name)}». El capital final incluye el efectivo sin invertir.</p>`;
}
function renderLearning() {
    const node=$('sim-learning-content');if(!node)return;
    if(learning.tab==='examples'){
        node.innerHTML=`<h2>Elige lo que quieres aprender</h2><p>Empieza por las cuatro prácticas básicas. Cada botón prepara una cartera completa para que sólo tengas que cambiar un dato y observar el resultado.</p><p class="sim-muted">Todos los ejemplos usan empresas, ETF, precios y primas ficticios. Al cargar el primero se conserva tu simulación anterior; puedes recuperarla con el botón situado junto a la vista sencilla.</p><div class="sim-lesson-grid">${LESSONS.map(l=>`<article class="sim-lesson-card"><span class="sim-level level-${l.level}">${l.tag}</span><h3>${l.title}</h3><p>${l.summary}</p><p class="sim-muted">Capital ficticio: ${eur(l.capital)}</p><button class="sim-button ${l.level===1?'':'secondary'}" data-action="load-lesson" data-lesson="${l.id}" aria-label="Cargar práctica: ${l.title}">Cargar esta práctica</button></article>`).join('')}</div>`;
    }else if(learning.tab==='glossary'){
        node.innerHTML=`<h2>Diccionario de bolsa, en palabras sencillas</h2><p>Pulsa un término para leer su explicación. Puedes volver al tutorial o a los ejemplos desde los botones de arriba.</p><div class="sim-glossary">${GLOSSARY.map(([term,meaning])=>`<details><summary>${term}</summary><p>${meaning}</p></details>`).join('')}</div><p class="sim-muted">Para ampliar: <a href="https://www.cnmv.es/portal/inversor/glosario?id=0&idlang=1&lang=es" target="_blank" rel="noopener">Glosario de la CNMV</a> · <a href="https://www.cnmv.es/DocPortal/Publicaciones/Guias/GUIA_OPCYFUT.PDF" target="_blank" rel="noopener">Guía CNMV de opciones y futuros</a> · <a href="https://www.optionseducation.org/optionsoverview/options-basics" target="_blank" rel="noopener">Opciones: OCC/OIC</a>. La fiscalidad y las fuentes del cálculo se detallan al final del simulador.</p>`;
    }else{
        const step=TUTORIAL[learning.step];
        node.innerHTML=`<div class="sim-tutorial-top"><span>Paso ${learning.step+1} de ${TUTORIAL.length}</span><progress value="${learning.step+1}" max="${TUTORIAL.length}" aria-label="Progreso del tutorial"></progress></div><h2 tabindex="-1" id="sim-tutorial-title">${step.title}</h2>${step.paragraphs.map(p=>`<p>${p}</p>`).join('')}
        ${learning.step===0?'<button class="sim-button" data-action="start-practice">Cargar mi primera práctica</button>':''}
        ${learning.step===1?state.practiceExample==='first'?'<button class="sim-button secondary" data-action="focus-first">Ver dónde se escriben cantidad y precios</button>':'<button class="sim-button secondary" data-action="start-practice">Preparar la primera práctica</button>':''}
        ${learning.step===2?state.practiceExample==='first'?`<div class="sim-actions">${[9,10,11,12].map(v=>`<button class="sim-button secondary" data-action="tutorial-price" data-value="${v}">Probar venta a ${v} €</button>`).join('')}</div>`:'<button class="sim-button secondary" data-action="start-practice">Preparar la primera práctica para este paso</button>':''}
        ${[1,2,3,4].includes(learning.step)?'<div class="sim-tutorial-live" id="sim-tutorial-live">'+learningLive()+'</div>':''}
        ${learning.step===3?'<button class="sim-button secondary" data-action="results">Ir al resultado completo</button>':''}
        ${learning.step===4?`<div class="sim-quiz"><h3>Una comprobación rápida</h3><p>Si compras y vendes al mismo precio, ¿recuperas siempre todo lo que gastaste?</p><div class="sim-actions"><button class="sim-button secondary" data-action="quiz" data-answer="yes">Sí, siempre</button><button class="sim-button secondary" data-action="quiz" data-answer="no">No, faltan los gastos</button></div><p role="status" id="sim-quiz-answer">${learning.answer?learning.answer==='no'?'Exacto. Puedes perder las comisiones y otros gastos aunque el precio no cambie.':'Fíjate en las comisiones: comprar y vender al mismo precio puede dejar una pérdida.':''}</p></div>`:''}
        ${learning.step===5?'<div class="sim-actions"><button class="sim-button" data-action="learn-examples">Elegir otra práctica</button><button class="sim-button secondary" data-action="learn-glossary">Consultar el diccionario</button></div>':''}
        <div class="sim-tutorial-nav"><button class="sim-button secondary" data-action="tutorial-prev" ${learning.step===0?'disabled':''}>← Anterior</button><button class="sim-button" data-action="${learning.step===TUTORIAL.length-1?'tutorial-done':'tutorial-next'}">${learning.step===TUTORIAL.length-1?'Terminar tutorial':'Siguiente →'}</button></div>`;
    }
}
function renderPractice(r) {
    const node=$('sim-practice-guide'), lesson=LESSONS.find(l=>l.id===state.practiceExample);
    if(!node)return;
    if(!lesson){node.innerHTML='';return;}
    const valid=r.rows&&!r.errors.length;
    const prices=lesson.id==='call'?[4,5,6,8]:['put','covered','short-put'].includes(lesson.id)?[0,8,10,12,14]:[];
    node.innerHTML=`<section class="sim-panel sim-practice"><div class="sim-topline"><h2>Estás practicando: ${lesson.title}</h2><span class="sim-level level-${lesson.level}">${lesson.tag}</span></div><p><strong>Qué aprenderás:</strong> ${lesson.learn}</p><p>${lesson.story}</p><div class="sim-exercise"><strong>Ahora prueba tú</strong><p>${lesson.try}</p>${prices.length?`<p>Probar otra situación (precio final del subyacente en USD):</p><div class="sim-actions">${prices.map(value=>`<button class="sim-button secondary" data-action="practice-price" data-value="${value}">${value} USD</button>`).join('')}</div>`:''}</div>
    <div class="sim-practice-current" role="status">${valid?`Con tus datos actuales, ${r.net>=0?'ganarías':'perderías'} <strong>${eur(Math.abs(r.net))}</strong> netos. Tu capital final sería <strong>${eur(r.finalCapital)}</strong>.`:'Revisa los avisos del resultado para completar esta práctica.'}</div>
    ${lesson.id==='first'&&valid?`<details><summary>¿De dónde sale ese resultado?</summary>${ledger([['Cambio de valor de las acciones, en EUR',r.rows.reduce((a,p)=>a+p.exitValue-p.entryValue,0)],['Costes de toda la operación',-r.costs],['Dividendos brutos',r.dividends],['Retención extranjera',-r.foreign],['IRPF adicional tras deducción',-r.irpf+r.credit],['Beneficio / pérdida neta',r.net]])}</details>`:''}
    <p class="sim-muted">Precios y cambios ficticios. Se mantienen las comisiones y los impuestos del escenario, incluso en vista sencilla. ${state.positions.some(p=>p.kind!=='stock')?'En opciones se supone un gasto adicional de 2 € por ejercicio y liquidación de títulos cuando corresponde: es una hipótesis del ejercicio, no una tarifa confirmada.':''}</p><div class="sim-actions"><button class="sim-button secondary" data-action="results">Ver resultado ↓</button><button class="sim-button secondary" data-action="learn-examples">Cambiar de práctica</button><button class="sim-button secondary" data-action="learn-tutorial">Abrir tutorial</button></div></section>`;
}
function openLearning(tab) {
    learning.tab=tab;learning.open=true;saveLearning();render();$('sim-school').scrollIntoView({block:'start'});
}
function loadLesson(id, tutorial=false) {
    if(!practiceBackup){
        practiceBackup=structuredClone(state);
        try{localStorage.setItem(PRACTICE_BACKUP,JSON.stringify(practiceBackup));}catch(_){status('La copia anterior sólo puede conservarse durante esta sesión. Exporta tu simulación si quieres guardarla.');}
    }
    state=createLesson(id);shock=0;quoteRequest++;searchRequest++;
    learning.simple=true;learning.open=tutorial;
    if(tutorial){learning.tab='tutorial';learning.step=1;}
    saveLearning();persist();render();
    status('Práctica cargada con datos ficticios. Tu simulación anterior se conserva para recuperarla.');
    $(tutorial?'sim-school':'sim-practice-guide').scrollIntoView({block:'start'});
}
function rowTemplate(p, i) {
    const option = p.kind !== 'stock';
    const f = (key,label,options={}) => field(key,label,p[key],{row:i,...options});
    return `<article class="sim-position"><div class="sim-position-header"><div><h3>${html(p.name || p.ticker || `Posición ${i+1}`)}</h3><div class="sim-position-label">${option ? `${p.side==='buy'?'Compra':'Venta'} ${p.kind} · prima por acción` : 'Compra de acciones / ETF'} · ${html(p.currency)}</div></div><button class="sim-button danger" data-action="remove" data-index="${i}" aria-label="Eliminar posición ${i+1}">Eliminar</button></div><div class="sim-grid">
    ${f('ticker','Ticker del subyacente',{type:'text',advanced:!!p.ticker})}${select('kind','Instrumento',p.kind,[['stock','Acción / ETF'],['call','Opción call'],['put','Opción put']],i,true)}${option?select('side','Operación',p.side,[['buy','Comprar opción'],['sell',p.kind==='call'?'Vender call cubierta':'Vender put con efectivo']],i,true):''}
    ${f('qty',option?'Número de contratos':'Número de acciones',{step:1,min:1,help:option?'Cada contrato representa el número de acciones indicado debajo.':'Cuántas acciones o participaciones compras.'})}${f('currency','Divisa (EUR, USD…) ',{type:'text',advanced:true})}${f('entry',option?'Precio inicial del subyacente':'Precio de compra por acción',{help:`Importe por una unidad, en ${html(p.currency)}.`})}${f('target',option?'Precio final del subyacente':'Precio de venta que quieres probar',{help:'Es un supuesto tuyo, no una predicción.'})}
    ${option ? `${f('strike','Strike: precio acordado',{help:'Precio al que da derecho a comprar o vender la opción.'})}${f('premium','Prima inicial por acción',{help:'Se multiplica por las acciones de cada contrato y por los contratos.'})}${f('multiplier','Acciones por contrato',{step:1,min:1})}${f('expiry','Fecha de vencimiento',{type:'date',advanced:true})}${select('exitMode','Liquidación',p.exitMode,[['expiry','A vencimiento (valor intrínseco)'],['close','Cierre con prima de salida']],i,true)}${p.exitMode==='close'?f('closePremium','Prima de salida por acción'):''}${select('optionMarket','Mercado de opciones',p.optionMarket,[['us','Opciones sobre acciones EE.UU.'],['other','Otras opciones cotizadas']],i,true)}` : `${f('dividend','Dividendo bruto total por acción',{help:'Importe acumulado durante el periodo, no porcentaje anual.',advanced:p.dividend===0})}${f('buyTax','Impuesto de compra (%)',{help:'Ej. 0,2 si la acción está sujeta al ITF español.',advanced:true})}`}
    ${f('fxEntry',`Cambio inicial: ${html(p.currency)} por 1 EUR`,{min:.00000001,advanced:p.currency==='EUR'})}${f('fxExit',`Cambio final: ${html(p.currency)} por 1 EUR`,{min:.00000001,advanced:p.currency==='EUR'})}</div>
    <details class="sim-config"><summary>Gastos adicionales, retenciones y procedencia del precio</summary><div class="sim-grid">${f('slippage','Deslizamiento por operación (%)',{help:'Sobre importe negociado; 0 si tus precios ya son de ejecución.'})}${f('extraEntry','Gastos extra de entrada (€)')}${f('extraExit','Gastos extra de salida (€)')}${option?`${f('exerciseFee','Ejercicio y liquidación de títulos (€)',{help:'Sólo a vencimiento con valor intrínseco. Confirma comisión por entrega/venta de acciones.'})}${f('feeUsdEntry','USD por EUR inicial (comisión EE.UU.)',{min:.00000001})}${f('feeUsdExit','USD por EUR final (comisión EE.UU.)',{min:.00000001})}`:`${f('sellTax','Impuesto de venta (%)')}${f('withholdForeign','Retención extranjera dividendos (%)')}${f('withholdSpain','Retención española sobre neto recibido (%)')}`}</div><p class="sim-muted">${html(p.quoteNote || 'Precio de entrada manual. Confirma el precio ejecutable, la divisa y sus gastos.')} ${option?'Prima manual: consulta el contrato exacto en tu bróker (strike, fecha, bid/ask y multiplicador). No se descarga una cadena de opciones en tiempo real.':''}</p></details><div class="sim-position-note" id="sim-note-${i}"></div></article>`;
}
function renderPositions() {
    $('sim-positions').innerHTML = state.positions.length ? state.positions.map(rowTemplate).join('') : '<div class="sim-empty"><h3>Tu cartera empieza aquí</h3><p class="sim-muted">Añade un valor o carga el ejemplo para explorar el resultado.</p></div>';
}
function ledger(items) {return `<dl class="sim-ledger">${items.map(([label,value])=>`<dt>${label}</dt><dd>${eur(value)}</dd>`).join('')}</dl>`;}
function renderResults() {
    $('sim-liquidation-date').textContent = `Liquidación completa al ${state.endDate}`;
    const r = calculate(state);
    renderPractice(r);
    if($('sim-tutorial-live'))$('sim-tutorial-live').innerHTML=learningLive(r);
    const errors = r.errors || [];
    let markup = errors.length ? `<div class="sim-errors"><strong>Revisa el escenario antes de considerarlo financiable</strong><ul>${errors.slice(0,20).map(x=>`<li>${html(x)}</li>`).join('')}</ul></div>` : '';
    if (!r.rows) { $('sim-result').innerHTML = markup; state.positions.forEach((_,i)=>{if($(`sim-note-${i}`)) $(`sim-note-${i}`).textContent='Completa los campos para calcular esta posición.';}); return; }
    r.rows.forEach((p,i)=>{
        const el = $(`sim-note-${i}`); if(!el) return;
        el.innerHTML = p.kind === 'stock' ? `Compra: <b>${eur(p.debit)}</b> · Costes de entrada y salida: <b>${eur(p.costs)}</b> · Resultado antes del IRPF: <b>${eur(p.gain+p.dividends)}</b>.` : `Prima ${p.side==='buy'?'pagada':'cobrada'}: <b>${eur(Math.abs(p.premiumTotal))}</b> (${num(p.premium)} × ${p.multiplier} × ${p.qty} en ${html(p.currency)}). Costes: <b>${eur(p.costs)}</b>. Resultado: <b>${eur(p.gain)}</b>. ${p.reserve ? `Efectivo reservado para la put: <b>${eur(p.reserve)}</b>.` : ''} ${p.exerciseCash ? `Para ejercer la call comprada: <b>${eur(p.exerciseCash)}</b> adicionales en la fecha final (no se reservan al abrir).` : ''} ${p.deliveryShares ? `Para ejercer la put comprada debes entregar <b>${p.deliveryShares} acciones</b> o cerrar la opción antes.` : ''} ${p.side==='buy'?'La prima comprada puede perderse íntegramente.':''}`;
    });
    const valid = !errors.length;
    markup += `<div class="sim-summary"><div class="sim-metric primary"><span>${valid?'Capital final estimado':'Capital final hipotético · no financiable'}</span><strong>${eur(r.finalCapital)}</strong><small>Incluye el efectivo sin invertir.</small></div><div class="sim-metric"><span>Beneficio / pérdida neta</span><strong class="${r.net>=0?'sim-good':'sim-bad'}">${eur(r.net)}</strong><small>${num(r.net/state.capital*100)} % sobre tu capital inicial.</small></div><div class="sim-metric"><span>Costes de la cartera</span><strong>${eur(r.costs)}</strong><small>Comisiones, cambio, ejecución y gastos generales.</small></div><div class="sim-metric"><span>IRPF adicional estimado</span><strong>${eur(r.irpf-r.credit)}</strong><small>Retención extranjera aparte: ${eur(r.foreign)}.</small></div></div>
    <div class="sim-results-grid"><div class="sim-panel"><h3>Al abrir la inversión</h3>${ledger([['Capital disponible',state.capital],['Desembolso neto de entrada¹',r.debit],['Reserva para puts vendidas',r.reserve],['Efectivo libre tras reservar',r.freeCash]])}<p class="sim-muted">¹ Incluye las primas cobradas o pagadas y los costes iniciales. Las acciones de cobertura de calls se pagan en sus propias líneas. El efectivo libre no genera intereses en este modelo.</p><h3>Al liquidar todo</h3>${ledger([['Ganancia/pérdida de transmisiones, neta de costes',r.gain],['Dividendos brutos',r.dividends],['Retenciones extranjeras',-r.foreign],['IRPF adicional antes de deducción',-r.irpf],['Deducción extranjera aplicada',r.credit],['Retirada y gastos generales',-r.nonDeductible],['Beneficio/pérdida neta',r.net]])}</div>
    <div class="sim-panel"><h3>Desglose de gastos e impuestos</h3>${ledger([['Comisiones de entrada y salida',r.commissions],['Coste de cambio de las operaciones',r.fxCosts],['Deslizamiento de ejecución',r.slippage],['Impuestos de compra y venta',r.transactionTax],['Otros gastos de las posiciones',r.rows.reduce((a,p)=>a+p.extraEntry+p.extraExit,0)],['Gastos generales y retirada',r.nonDeductible],['Retención española ya anticipada',r.spanish],['IRPF pendiente (+) / anticipo a recuperar (−)',r.taxDue],['Base del ahorro antes de esta cartera',r.baseBefore],['Base del ahorro incluyendo la cartera',r.baseAfter],['Pérdidas del año aún sin compensar',r.lossCarry+r.incomeLossCarry]])}<p class="sim-muted">Las retenciones españolas se descuentan del IRPF pendiente, no otra vez del beneficio. La recuperación de anticipos depende de la declaración completa. ${r.taxChange<0?`El escenario reduciría en ${eur(-r.taxChange)} el impuesto de tus otras rentas; ese ahorro no se añade al capital final.`:''}</p></div></div>
    <div class="sim-panel"><h3>Resultado por posición · antes del IRPF</h3><div class="sim-table-wrap"><table class="sim-table"><thead><tr><th>Activo / operación</th><th>Títulos / contratos</th><th>Entrada neta €</th><th>Costes totales €</th><th>Resultado €</th></tr></thead><tbody>${r.rows.map(p=>`<tr><td>${html(p.ticker)} · ${p.kind==='stock'?'Compra':`${p.side==='buy'?'Compra':'Venta'} ${p.kind}`}</td><td>${p.qty}</td><td>${num(p.debit)}</td><td>${num(p.costs)}</td><td class="${p.gain+p.dividends>=0?'sim-good':'sim-bad'}">${num(p.gain+p.dividends)}</td></tr>`).join('')}</tbody></table></div></div>
    <div class="sim-panel"><h3>Si el mercado termina más arriba o más abajo</h3><p class="sim-muted">Aplica la misma variación a todos tus precios finales; mantiene cambios, dividendos y gastos. Las primas de cierre manuales permanecen fijas. Es una prueba de sensibilidad, no una probabilidad ni una pérdida máxima.</p><div class="sim-scenario-tools"><label for="sim-shock">Variación</label><input id="sim-shock" type="range" min="-80" max="80" step="5" value="${shock}"><output id="sim-shock-label">${shock>0?'+':''}${shock} %</output></div><div id="sim-sensitivity"></div></div>`;
    if (r.warnings.length) markup += `<div class="sim-notes"><strong>Supuestos que afectan al resultado</strong><ul>${r.warnings.map(w=>`<li>${html(w)}</li>`).join('')}</ul></div>`;
    if(state.positions.length && state.positions.every(p=>['EUR','USD'].includes(p.currency))) {
        const compare=Object.entries(PROFILES).map(([key,fees])=>({key,r:calculate({...state,profile:key,fees})}));
        if(compare.every(p=>p.r.rows))markup+=`<div class="sim-panel"><h3>Compara las comisiones ordinarias de Freedom24</h3><p>Smart: <strong>${eur(compare[0].r.commissions)}</strong> · All-inclusive: <strong>${eur(compare[1].r.commissions)}</strong>. ${Math.abs(compare[0].r.commissions-compare[1].r.commissions)<.005?'Mismo coste para este escenario.':`El menor coste de negociación en esta cartera es <strong>${compare[0].r.commissions<compare[1].r.commissions?'Smart':'All-inclusive'}</strong>.`}</p><p class="sim-muted">Mismas posiciones y cambios; sólo comisiones de negociación, vencimiento y ejercicio. No compara promociones, servicios ni disponibilidad de instrumentos.</p></div>`;
    }
    $('sim-result').innerHTML = markup;
    const breakdown=$('sim-result').querySelector('.sim-results-grid');
    if(breakdown){
        const detail=document.createElement('details'),summary=document.createElement('summary');
        detail.className='sim-panel sim-result-details';detail.open=!learning.simple;
        summary.textContent='Ver el detalle de gastos, efectivo e impuestos';
        breakdown.before(detail);detail.append(summary,breakdown);
    }
    sensitivity();
}
function sensitivity() {
    const scenarios = [-50,-25,0,25,50].map(x=>({x,r:calculate(state,x)}));
    const current = calculate(state,shock);
    if(!current.rows) return;
    $('sim-shock-label').textContent = `${shock>0?'+':''}${shock} %`;
    const values = scenarios.map(x=>x.r.net), lo = Math.min(0,...values), hi = Math.max(1,...values), range = hi-lo || 1;
    const x = i => 65+i*115, y = v => 140-(v-lo)/range*110;
    $('sim-sensitivity').innerHTML = `<p><strong>Con ${shock>0?'+':''}${shock} %: ${eur(current.net)} netos · capital final ${eur(current.finalCapital)}</strong></p><svg class="sim-chart" viewBox="0 0 590 185" role="img" aria-label="Beneficio neto de cinco escenarios, detallados en la tabla"><line x1="65" x2="525" y1="${y(0)}" y2="${y(0)}" stroke="#a5bbc9" stroke-dasharray="4"/><polyline points="${values.map((v,i)=>`${x(i)},${y(v)}`).join(' ')}" fill="none" stroke="#0c748a" stroke-width="3"/>${values.map((v,i)=>`<circle cx="${x(i)}" cy="${y(v)}" r="4" fill="#0c748a"/><text x="${x(i)}" y="${y(v)-10}" text-anchor="middle" fill="#254e67" font-size="11">${html(eur(v))}</text><text x="${x(i)}" y="168" text-anchor="middle" fill="#586e80" font-size="12">${scenarios[i].x>0?'+':''}${scenarios[i].x}%</text>`).join('')}</svg><div class="sim-table-wrap"><table class="sim-table"><thead><tr><th>Variación</th><th>Neto tras impuestos</th><th>Capital final</th></tr></thead><tbody>${scenarios.map(({x,r})=>`<tr><td>${x>0?'+':''}${x} %</td><td>${eur(r.net)}</td><td>${eur(r.finalCapital)}</td></tr>`).join('')}</tbody></table></div>`;
}
function position(kind='stock', item={}) {
    const bridge = window.ValoresMarket;
    const quote = bridge?.quote(item.ticker);
    const rawCurrency = quote?.currency || item.currency || 'EUR';
    const currency = ['GBp','GBX'].includes(rawCurrency) ? 'GBP' : /^[A-Z]{3}$/.test(rawCurrency) ? rawCurrency : 'EUR';
    const rate = currency === 'EUR' ? 1 : bridge?.rate(currency) || 1;
    return {ticker:item.ticker||'',name:item.name||'',kind,side:'buy',qty:1,currency,entry:0,target:0,premium:0,closePremium:0,
        multiplier:100,strike:1,expiry:state.endDate,exitMode:'expiry',optionMarket:currency==='USD'?'us':'other',dividend:0,
        fxEntry:rate,fxExit:rate,feeUsdEntry:bridge?.rate('USD')||1,feeUsdExit:bridge?.rate('USD')||1,withholdForeign:0,withholdSpain:0,buyTax:0,sellTax:0,slippage:0,extraEntry:0,extraExit:0,exerciseFee:0,
        quoteNote:'Precio manual. Los cambios distintos de EUR son supuestos hasta consultar precios.',...quote&&{entry:quote.price*(['GBp','GBX'].includes(rawCurrency)?.01:1),target:quote.price*(['GBp','GBX'].includes(rawCurrency)?.01:1),quoteNote:`Último dato guardado Yahoo: ${new Date(quote.timestamp*1000).toLocaleString('es-ES')}. Comprueba su vigencia.`}};
}
function add(kind,item) {
    if(state.positions.length>=100) {status('Máximo 100 posiciones.');return;}
    state.positions.push(position(kind,item)); persist(); renderPositions(); renderResults();
    const index = state.positions.length-1;
    $(`sim-${index}-ticker`).focus();
}
function searchLocal() {
    searchRequest++;
    const q=$('sim-search').value.trim().toLowerCase();
    matches = q ? (window.ValoresMarket?.catalogue()||[]).filter(p=>p.category!=='bond'&&`${p.ticker} ${p.name}`.toLowerCase().includes(q)).slice(0,12) : [];
    showMatches();
}
function showMatches() {$('sim-search-results').innerHTML=matches.map((p,i)=>`<button class="sim-search-item" data-action="choose" data-index="${i}"><strong>${html(p.ticker)}</strong> · ${html(p.name)} · ${html(p.currency)}</button>`).join('');}
async function searchOnline() {
    const q=$('sim-search').value.trim(); if(!q) {status('Escribe un nombre o ticker.');return;}
    const request=++searchRequest; status('Buscando en Yahoo…');
    try {const data=await window.ValoresMarket.api('/api/search?q='+encodeURIComponent(q)); if(request!==searchRequest)return; matches=(data.quotes||[]).filter(p=>['EQUITY','ETF'].includes(p.quoteType)).slice(0,12).map(p=>({ticker:p.symbol,name:p.longname||p.shortname||p.symbol,currency:p.currency||(['NMS','NYQ','NGM','NCM','ASE','PCX','BTS'].includes(p.exchange)?'USD':'')}));showMatches();status(matches.length?'Elige el valor para añadirlo. Confirma su divisa consultando precios.':'No se han encontrado valores compatibles. Puedes escribir el ticker en una línea.');}
    catch(e) {if(request===searchRequest)status(e.message);}
}
async function loadQuotes() {
    if(state.practiceExample){status('Esta práctica usa datos ficticios. Para consultar valores reales, empieza una nueva simulación.');return;}
    const tickers=[...new Set(state.positions.map(p=>p.ticker).filter(x=>/^[A-Z0-9^=.:_+\-]{1,45}$/.test(x)))];
    if(!tickers.length){status('Añade primero un ticker.');return;}
    const request=++quoteRequest; status('Consultando precios y cambios en Yahoo…');
    const snapshot=JSON.stringify(state.positions);
    try {
        const currencies=[...new Set(state.positions.map(p=>p.currency).filter(c=>/^[A-Z]{3}$/.test(c)&&c!=='EUR'))];
        const symbols=[...new Set([...tickers,'EURUSD=X',...currencies.map(c=>`EUR${c}=X`)])];
        const batches=[];
        for(let i=0;i<symbols.length;i+=100)batches.push(window.ValoresMarket.api('/api/quotes?symbols='+encodeURIComponent(symbols.slice(i,i+100).join(','))));
        const data={items:(await Promise.all(batches)).flatMap(batch=>batch.items)};
        if(request!==quoteRequest||snapshot!==JSON.stringify(state.positions)){status('La cartera cambió durante la consulta. Vuelve a consultar para aplicar precios.');return;}
        const quotes=new Map(data.items.map(q=>[q.ticker,q])), missing=[];
        for(const p of state.positions){
            const q=quotes.get(p.ticker);
            if(q?.price>=0){
                const raw=q.currency, scale=['GBp','GBX'].includes(raw)?.01:1, currency=scale===.01?'GBP':raw;
                if(!/^[A-Z]{3}$/.test(currency)){missing.push(`${p.ticker}: divisa desconocida`);continue;}
                p.entry=q.price*scale; p.currency=currency;
                p.quoteNote=`Yahoo Finance · ${new Date(q.timestamp*1000).toLocaleString('es-ES')} · consulta ${new Date().toLocaleString('es-ES')}. Sólo precio inicial; objetivo y primas manuales.`;
                const fx=currency==='EUR'?1:quotes.get(`EUR${currency}=X`)?.price;
                if(fx>0) p.fxEntry=fx; else missing.push(`${currency}: cambio inicial no disponible`);
                if(currency==='EUR') p.fxExit=1;
            } else missing.push(p.ticker);
            const usd=quotes.get('EURUSD=X')?.price;
            if(usd>0)p.feeUsdEntry=usd;
        }
        persist();renderPositions();renderResults();
        status(missing.length?`Consulta parcial: revisa ${missing.join(', ')}. Se conservan sus entradas anteriores.`:'Precios iniciales y cambios iniciales actualizados. Los precios finales, primas y cambios finales siguen siendo tus supuestos.');
    }catch(e){status(e.message);}
}
function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type}));const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function csv() {
    const r=calculate(state);if(r.errors.length){status('Corrige los avisos antes de exportar un informe de resultados.');return;}
    const rows=[['Simulación',state.name],['Fecha inicial',state.date],['Liquidación',state.endDate],['Capital inicial EUR',state.capital],['Capital final EUR',r.finalCapital],['Beneficio neto EUR',r.net],['Costes EUR',r.costs],['IRPF adicional EUR',r.irpf],['Retención extranjera EUR',r.foreign],['Deducción extranjera EUR',r.credit],['IRPF pendiente EUR',r.taxDue],[],['Ticker','Instrumento','Compra/venta','Cantidad','Divisa','Precio inicial','Precio final','Strike','Prima inicial','Multiplicador','Vencimiento','Modo salida','Prima salida','Cambio inicial','Cambio final','Costes EUR','Ganancia EUR','Dividendos EUR'],...r.rows.map(p=>[p.ticker,p.kind,p.side,p.qty,p.currency,p.entry,p.target,p.strike,p.premium,p.multiplier,p.expiry,p.exitMode,p.closePremium,p.fxEntry,p.fxExit,p.costs,p.gain,p.dividends])];
    const cell=v=>`"${(typeof v==='number'?v.toLocaleString('es-ES',{useGrouping:false,maximumFractionDigits:6}):String(v??'').replace(/^[=+@\-]/, "'$&")).replaceAll('"','""')}"`;
    download('\uFEFF'+rows.map(row=>row.map(cell).join(';')).join('\r\n'),'Simulacion_bursatil.csv','text/csv;charset=utf-8');status('Informe descargado. El JSON conserva todos los parámetros para repetir el cálculo.');
}
function handleChange(event) {
    const target=event.target;
    if(target.id==='sim-import')return;
    if(target.dataset.setting){
        const key=target.dataset.setting; const value=target.type==='number'?Number(target.value):target.value;
        if(key.startsWith('fees.')){state.fees[key.slice(5)]=value;state.profile='custom';$('sim-cfg-profile').value='custom';}
        else if(key.startsWith('rates.')) state.rates[Number(key.slice(6))]=value;
        else state[key]=value;
        if(key==='profile'&&PROFILES[value]){state.fees={...PROFILES[value]};persist();render();return;}
        if(key==='endDate') {renderResults();persist();return;}
    } else if(target.dataset.field){
        const p=state.positions[Number(target.dataset.row)], key=target.dataset.field;
        p[key]=target.type==='number'?Number(target.value):target.value;
        if(['ticker','currency'].includes(key)){p[key]=p[key].trim().toUpperCase();target.value=p[key]; if(key==='ticker'){p.name=p[key];p.quoteNote='Ticker modificado: confirma o consulta de nuevo su precio.';}else if(p.currency==='EUR'){p.fxEntry=p.fxExit=1;}}
        if(key==='kind'&&p.kind==='stock')p.side='buy';
        if(['kind','side','exitMode','currency','ticker'].includes(key)){renderPositions();}
        if(['entry','fxEntry'].includes(key))p.quoteNote='Entrada modificada manualmente.';
    } else return;
    persist();renderResults();
}
async function action(event) {
    const button=event.target.closest('[data-action]');if(!button)return;
    const a=button.dataset.action,index=Number(button.dataset.index);
    if(a==='start-tutorial'){learning.step=0;learning.answer=null;openLearning('tutorial');return;}
    if(a.startsWith('learn-')){openLearning(a.slice(6));return;}
    if(a==='toggle-simple'){learning.simple=!learning.simple;saveLearning();render();return;}
    if(a==='load-lesson'){loadLesson(button.dataset.lesson);return;}
    if(a==='start-practice'){loadLesson('first',true);return;}
    if(a==='tutorial-next'||a==='tutorial-prev'){
        learning.step=Math.max(0,Math.min(TUTORIAL.length-1,learning.step+(a==='tutorial-next'?1:-1)));saveLearning();renderLearning();$('sim-tutorial-title').focus();return;
    }
    if(a==='tutorial-done'){learning.open=false;saveLearning();$('sim-school').open=false;status('Puedes volver a la ayuda en cualquier momento. Prueba ahora otro ejemplo.');$('sim-practice-guide').scrollIntoView({block:'start'});return;}
    if(a==='focus-first'){
        const input=$('sim-0-qty');if(input){input.scrollIntoView({block:'center'});input.focus();}else status('Carga la primera práctica desde el paso 1 para ver sus campos.');return;
    }
    if(a==='tutorial-price'||a==='practice-price'){
        if(a==='tutorial-price'&&state.practiceExample!=='first'){status('Carga la primera práctica para este ejercicio.');return;}
        if(a==='practice-price'&&!['call','put','covered','short-put'].includes(state.practiceExample))return;
        state.positions.forEach(p=>{p.target=Number(button.dataset.value);});persist();renderPositions();renderResults();return;
    }
    if(a==='quiz'){learning.answer=button.dataset.answer;saveLearning();renderLearning();return;}
    if(a==='restore-practice'&&practiceBackup){state=structuredClone(practiceBackup);practiceBackup=null;quoteRequest++;try{localStorage.removeItem(PRACTICE_BACKUP);}catch(_){}persist();render();status('Has recuperado la simulación que tenías antes de cargar las prácticas.');return;}
    if(a==='add-stock')add('stock');if(a==='add-call')add('call');if(a==='add-put')add('put');
    if(a==='choose'){const item=matches[index];if(item)add('stock',item);}
    if(a==='remove'){state.positions.splice(index,1);quoteRequest++;persist();renderPositions();renderResults();}
    if(a==='quotes')await loadQuotes(); if(a==='search')await searchOnline();
    if(a==='results')$('sim-result').scrollIntoView({behavior:'smooth',block:'start'});
    if(a==='new'){state=defaults();quoteRequest++;shock=0;persist();render();}
    if(a==='save'){
        if(validate(state).length){status('Completa los datos antes de guardar un escenario. Tus cambios actuales siguen guardados como borrador.');return;}
        const existing=saved.findIndex(s=>s.name===state.name);
        if(existing>=0)saved[existing]=structuredClone(state);else saved.push(structuredClone(state));
        if(saved.length>20)saved.shift();
        try{localStorage.setItem(SAVED,JSON.stringify(saved));render();status('Escenario guardado en este dispositivo. Usa nombres distintos para comparar alternativas.');}catch(_){status('No se pudo guardar: exporta el JSON.');}
    }
    if(a==='load'||a==='delete-saved'){
        const v=$('sim-saved').value;if(v===''){status('Selecciona un escenario guardado.');return;}
        if(a==='load'){state=structuredClone(saved[Number(v)]);quoteRequest++;persist();render();status('Escenario recuperado.');}
        else {saved.splice(Number(v),1);try{localStorage.setItem(SAVED,JSON.stringify(saved));render();status('Escenario eliminado de la lista; la simulación actual se conserva.');}catch(_){status('No se ha podido guardar la lista.');}}
    }
    if(a==='export')download(JSON.stringify(state,null,2),'Simulacion_bursatil.json','application/json');
    if(a==='csv')csv();if(a==='print')window.print();
}
function init(){
    try {const stored=JSON.parse(localStorage.getItem(KEY)||'null');if(stored?.schema===1&&Array.isArray(stored.positions)&&stored.positions.length<=100)state={...defaults(),...stored};saved=JSON.parse(localStorage.getItem(SAVED)||'[]');if(!Array.isArray(saved))saved=[];saved=saved.filter(s=>s?.schema===1&&!validate(s).length).slice(0,20);}catch(_){state=defaults();saved=[];}
    try{const l=JSON.parse(localStorage.getItem(LEARNING)||'null');if(l)learning={simple:l.simple!==false,open:l.open===true,tab:['tutorial','examples','glossary'].includes(l.tab)?l.tab:'tutorial',step:Number.isInteger(l.step)?Math.min(Math.max(l.step,0),TUTORIAL.length-1):0,answer:['yes','no'].includes(l.answer)?l.answer:null};const b=JSON.parse(localStorage.getItem(PRACTICE_BACKUP)||'null');if(b?.schema===1&&Array.isArray(b.positions)&&b.positions.length<=100)practiceBackup=b;}catch(_){}
    render();const root=$('screen-simulator');root.addEventListener('change',handleChange);root.addEventListener('click',event=>{action(event).catch(e=>status(e.message));});
    root.addEventListener('toggle',event=>{if(event.target.id==='sim-school'){learning.open=event.target.open;saveLearning();}},true);
    root.addEventListener('input',event=>{if(event.target.id==='sim-search')searchLocal();if(event.target.id==='sim-shock'){shock=Number(event.target.value);sensitivity();}});
    root.addEventListener('keydown',event=>{if(event.target.id==='sim-search'&&event.key==='Enter')searchOnline();});
    root.addEventListener('change',async event=>{
        if(event.target.id!=='sim-import')return; const file=event.target.files[0];if(!file)return;
        try{if(file.size>1000000)throw new Error('El archivo supera 1 MB.');const data=JSON.parse(await file.text());if(data.schema!==1)throw new Error('Formato de simulación no compatible.');const errors=validate(data);if(errors.length)throw new Error(errors.slice(0,3).join(' '));state=data;quoteRequest++;persist();render();status('Simulación importada en este dispositivo.');}catch(e){status(`No se ha importado: ${e.message}`);}event.target.value='';
    });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
