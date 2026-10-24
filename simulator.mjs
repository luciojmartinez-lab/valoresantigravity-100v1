import {calculate, defaults, PROFILES, validate} from './simulation-engine.mjs';
const $ = id => document.getElementById(id);
const html = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const eur = v => Number.isFinite(v) ? v.toLocaleString('es-ES', {style:'currency',currency:'EUR'}) : '—';
const num = v => Number.isFinite(v) ? v.toLocaleString('es-ES', {maximumFractionDigits: 4}) : '—';
const KEY = 'valores_simulation_v1', SAVED = 'valores_simulation_saved_v1';
let state = defaults(), saved = [], matches = [], shock = 0, quoteRequest = 0;
let searchRequest = 0;
const status = message => {$('sim-status').textContent = message;};
function persist() {
    try {localStorage.setItem(KEY, JSON.stringify(state));} catch (_) {status('El navegador no permite guardar. Exporta tu simulación a JSON.');}
}
function field(key, label, value, options = {}) {
    const {row, min = 0, step = 'any', type = 'number', help = ''} = options;
    const id = `sim-${row === undefined ? 'cfg' : row}-${key}`;
    const attrs = row === undefined ? `data-setting="${key}"` : `data-row="${row}" data-field="${key}"`;
    return `<label class="sim-field" for="${id}">${label}<input id="${id}" ${attrs} type="${type}" value="${html(value)}" ${type === 'number' ? `min="${min}" step="${step}"` : ''}>${help ? `<small>${help}</small>` : ''}</label>`;
}
function select(key, label, value, choices, row) {
    const id = `sim-${row === undefined ? 'cfg' : row}-${key}`;
    return `<label class="sim-field" for="${id}">${label}<select id="${id}" ${row === undefined ? `data-setting="${key}"` : `data-row="${row}" data-field="${key}"`}>${choices.map(([v,l]) => `<option value="${v}" ${value === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
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
    root.innerHTML = `<div class="sim-wrap"><div class="sim-heading"><div class="sim-intro"><div class="sim-eyebrow">Tu capital, con todos los costes a la vista</div><h1>Simulación bursátil</h1><p class="sim-muted">Reparte tu inversión entre acciones, ETF y opciones. Compara cuánto necesitas al empezar y cuánto te quedaría después de gastos e impuestos.</p></div><span class="sim-tag">Cálculo local · sin operaciones reales</span></div>
    <section class="sim-panel sim-no-print" aria-label="Datos de la simulación"><div class="sim-topline"><h2>1. Define tu escenario</h2><div class="sim-actions"><button class="sim-button secondary" data-action="example">Cargar ejemplo de 10.000 €</button><button class="sim-button secondary" data-action="new">Nueva simulación</button><button class="sim-button" data-action="results">Ver resultado ↓</button></div></div><div class="sim-grid">
    ${field('name','Nombre',state.name,{type:'text'})}${field('capital','Capital inicial (€)',state.capital)}${field('date','Fecha inicial',state.date,{type:'date'})}${field('endDate','Fecha final / liquidación',state.endDate,{type:'date'})}</div>
    <details class="sim-config"><summary>Comisiones, cambio de divisa e impuestos</summary><div class="sim-grid">
    ${select('profile','Perfil de comisiones',state.profile,[['smart','Freedom24 · Smart'],['inclusive','Freedom24 · All-inclusive'],['custom','Otro intermediario / personalizadas']])}
    ${field('fxPct','Coste de cambio por conversión (%)',state.fxPct,{help:'0 = pendiente de confirmar. Se aplica al abrir y al cerrar las líneas en divisa.'})}
    ${field('withdrawal','Retirada final (€)',state.withdrawal,{help:'0 si dejas el dinero en el bróker; transferencia Freedom24 EUR: 7 € más posibles intermediarios.'})}
    ${field('extraCosts','Otros gastos generales (€)',state.extraCosts,{help:'Custodia, datos, ingreso de fondos… Sin deducción fiscal en esta estimación.'})}
    ${Object.keys(PROFILES.smart).filter(k => k !== 'name').map(k => field(`fees.${k}`,({stockFixed:'Acciones: fijo / orden',stockUnit:'Acciones: por título',stockPct:'Acciones: sobre importe (%)',optionFixed:'Opciones EE.UU.: fijo / orden (USD)',optionUnit:'Opciones EE.UU.: por contrato (USD)',otherOptionUnit:'Otras opciones: por contrato',expiryUnit:'Vencimiento EE.UU.: por contrato (USD)',otherExpiryUnit:'Vencimiento otras: por contrato'})[k],state.fees[k])).join('')}
    </div><p class="sim-muted">Tarifas por cada operación de entrada y salida. Acciones: USD en mercado estadounidense y EUR en europeo; este perfil sólo calcula acciones cotizadas en USD o EUR. Otras divisas requieren tarifa personalizada en la moneda del activo.</p>
    <div class="sim-grid">${select('taxMode','Fiscalidad',state.taxMode,[['common','España · régimen común'],['flat','Tipo efectivo manual']])}${field('flatTax','Tipo manual (%)',state.flatTax)}${field('otherGains','Otras ganancias/pérdidas del año (€)',state.otherGains,{min:-1e12})}${field('otherIncome','Otros intereses/dividendos netos (€)',state.otherIncome,{min:-1e12})}${field('foreignCredit','Deducción extranjera confirmada (€)',state.foreignCredit,{help:'Por defecto 0. No toda retención extranjera es deducible.'})}${state.rates.map((v,i)=>field(`rates.${i}`,`Tramo ${i+1} del ahorro (%)`,v)).join('')}</div><p class="sim-muted">Residente en España. Se parte del régimen común; confirma la normativa si resides en País Vasco o Navarra. No se aplica IRPF al capital aportado. Todas las operaciones de esta simulación se liquidan en un mismo año.</p></details></section>
    <section class="sim-panel sim-no-print"><div class="sim-topline"><h2>2. Construye tu cartera</h2><div class="sim-actions"><button class="sim-button" data-action="add-stock">+ Acción / ETF</button><button class="sim-button secondary" data-action="add-call">+ Call</button><button class="sim-button secondary" data-action="add-put">+ Put</button></div></div>
    <div class="sim-searchbar"><input type="search" id="sim-search" aria-label="Buscar activo para la simulación" placeholder="Buscar en el catálogo: Santander, VWCE, SPY…"><button class="sim-button secondary" data-action="search">Buscar en Yahoo</button></div><div id="sim-search-results"></div><p class="sim-muted">Elige un activo para añadirlo como acción/ETF, o crea una línea y escribe su ticker. Las opciones usan el ticker del subyacente.</p>
    <div class="sim-actions"><button class="sim-button secondary" data-action="quotes">Consultar precios actuales</button><span class="sim-muted" style="font-size:12px">Actualiza precios de entrada y cambios iniciales; conserva tus objetivos y primas.</span></div><div id="sim-status" role="status" aria-live="polite"></div><div id="sim-positions"></div></section>
    <section aria-label="Resultado de la simulación"><div class="sim-topline"><h2>3. Resultado estimado</h2><span id="sim-liquidation-date" class="sim-muted" style="font-size:12px">Liquidación completa al ${html(state.endDate)}</span></div><div id="sim-result" aria-live="polite"></div></section>
    <section class="sim-panel sim-no-print"><h2>Guarda y compara</h2><p class="sim-muted">La simulación actual se guarda al editar en este dispositivo. Para llevarla al móvil, exporta el JSON y ábrelo allí con «Importar». No hay sincronización automática entre dispositivos.</p><div class="sim-storage"><label class="sim-field" for="sim-saved">Escenarios guardados<select id="sim-saved"><option value="">Elige un escenario…</option>${saved.map((s,i)=>`<option value="${i}">${html(s.name)}</option>`).join('')}</select></label><button class="sim-button" data-action="save">Guardar escenario</button><button class="sim-button secondary" data-action="load">Abrir</button><button class="sim-button danger" data-action="delete-saved">Eliminar guardado</button></div><div class="sim-actions" style="margin-top:14px"><button class="sim-button secondary" data-action="export">Exportar JSON</button><label class="sim-button secondary">Importar JSON<input id="sim-import" type="file" accept=".json,application/json" class="hidden"></label><button class="sim-button secondary" data-action="csv">Descargar informe CSV</button><button class="sim-button secondary" data-action="print">Imprimir resultado / PDF</button></div></section>${SOURCES}</div>`;
    renderPositions(); renderResults();
}
function rowTemplate(p, i) {
    const option = p.kind !== 'stock';
    const f = (key,label,options={}) => field(key,label,p[key],{row:i,...options});
    return `<article class="sim-position"><div class="sim-position-header"><div><h3>${html(p.name || p.ticker || `Posición ${i+1}`)}</h3><div class="sim-position-label">${option ? `${p.side==='buy'?'Compra':'Venta'} ${p.kind} · prima por acción` : 'Compra de acciones / ETF'} · ${html(p.currency)}</div></div><button class="sim-button danger" data-action="remove" data-index="${i}" aria-label="Eliminar posición ${i+1}">Eliminar</button></div><div class="sim-grid">
    ${f('ticker','Ticker del subyacente',{type:'text'})}${select('kind','Instrumento',p.kind,[['stock','Acción / ETF'],['call','Opción call'],['put','Opción put']],i)}${option?select('side','Operación',p.side,[['buy','Comprar opción'],['sell',p.kind==='call'?'Vender call cubierta':'Vender put con efectivo']],i):''}
    ${f('qty',option?'Contratos':'Número de acciones',{step:1,min:1})}${f('currency','Divisa (EUR, USD…) ',{type:'text'})}${f('entry','Subyacente: precio inicial')}${f('target','Subyacente: precio final')}
    ${option ? `${f('strike','Strike / ejercicio')}${f('premium','Prima inicial por acción')}${f('multiplier','Acciones por contrato',{step:1,min:1})}${f('expiry','Fecha de vencimiento',{type:'date'})}${select('exitMode','Liquidación',p.exitMode,[['expiry','A vencimiento (valor intrínseco)'],['close','Cierre con prima de salida']],i)}${p.exitMode==='close'?f('closePremium','Prima de salida por acción'):''}${select('optionMarket','Mercado de opciones',p.optionMarket,[['us','Opciones sobre acciones EE.UU.'],['other','Otras opciones cotizadas']],i)}` : `${f('dividend','Dividendo bruto total por acción',{help:'Importe acumulado durante el periodo, no porcentaje anual.'})}${f('buyTax','Impuesto de compra (%)',{help:'Ej. 0,2 si la acción está sujeta al ITF español.'})}`}
    ${f('fxEntry',`Cambio inicial: ${html(p.currency)} por 1 EUR`,{min:.00000001})}${f('fxExit',`Cambio final: ${html(p.currency)} por 1 EUR`,{min:.00000001})}</div>
    <details class="sim-config"><summary>Gastos adicionales, retenciones y procedencia del precio</summary><div class="sim-grid">${f('slippage','Deslizamiento por operación (%)',{help:'Sobre importe negociado; 0 si tus precios ya son de ejecución.'})}${f('extraEntry','Gastos extra de entrada (€)')}${f('extraExit','Gastos extra de salida (€)')}${option?`${f('exerciseFee','Ejercicio y liquidación de títulos (€)',{help:'Sólo a vencimiento con valor intrínseco. Confirma comisión por entrega/venta de acciones.'})}${f('feeUsdEntry','USD por EUR inicial (comisión EE.UU.)',{min:.00000001})}${f('feeUsdExit','USD por EUR final (comisión EE.UU.)',{min:.00000001})}`:`${f('sellTax','Impuesto de venta (%)')}${f('withholdForeign','Retención extranjera dividendos (%)')}${f('withholdSpain','Retención española sobre neto recibido (%)')}`}</div><p class="sim-muted">${html(p.quoteNote || 'Precio de entrada manual. Confirma el precio ejecutable, la divisa y sus gastos.')} ${option?'Prima manual: consulta el contrato exacto en tu bróker (strike, fecha, bid/ask y multiplicador). No se descarga una cadena de opciones en tiempo real.':''}</p></details><div class="sim-position-note" id="sim-note-${i}"></div></article>`;
}
function renderPositions() {
    $('sim-positions').innerHTML = state.positions.length ? state.positions.map(rowTemplate).join('') : '<div class="sim-empty"><h3>Tu cartera empieza aquí</h3><p class="sim-muted">Añade un valor o carga el ejemplo para explorar el resultado.</p></div>';
}
function ledger(items) {return `<dl class="sim-ledger">${items.map(([label,value])=>`<dt>${label}</dt><dd>${eur(value)}</dd>`).join('')}</dl>`;}
function renderResults() {
    $('sim-liquidation-date').textContent = `Liquidación completa al ${state.endDate}`;
    const r = calculate(state);
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
function example() {
    state=defaults();state.name='Ejemplo didáctico · 10.000 €';state.fxPct=.15;state.withdrawal=7;
    const stock={...position('stock',{ticker:'SAN.MC',name:'Banco Santander · ejemplo ficticio'}),qty:300,entry:8,target:8.8,dividend:.2,buyTax:.2,withholdSpain:19};
    const etf={...position('stock',{ticker:'VWCE.DE',name:'ETF global · ejemplo ficticio'}),qty:20,entry:140,target:150};
    const call={...position('call',{ticker:'XYZ',name:'XYZ · subyacente ficticio'}),currency:'USD',entry:40,target:46,strike:42,premium:2.2,fxEntry:1.1,fxExit:1.1,feeUsdEntry:1.1,feeUsdExit:1.1,optionMarket:'us'};
    const put={...call,kind:'put',strike:38,premium:1.5};
    stock.quoteNote=etf.quoteNote=call.quoteNote=put.quoteNote='Ejemplo didáctico: precios, primas, cambio y dividendos ficticios. No son cotizaciones ni una recomendación.';
    state.positions=[stock,etf,call,put]; shock=0;quoteRequest++;persist();render();status('Ejemplo cargado con cifras ficticias: acciones, ETF, compra call y compra put. Cambia las cantidades y objetivos.');
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
    if(a==='add-stock')add('stock');if(a==='add-call')add('call');if(a==='add-put')add('put');
    if(a==='choose'){const item=matches[index];if(item)add('stock',item);}
    if(a==='remove'){state.positions.splice(index,1);quoteRequest++;persist();renderPositions();renderResults();}
    if(a==='quotes')await loadQuotes(); if(a==='search')await searchOnline();
    if(a==='results')$('sim-result').scrollIntoView({behavior:'smooth',block:'start'});
    if(a==='example')example();
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
    render();const root=$('screen-simulator');root.addEventListener('change',handleChange);root.addEventListener('click',event=>{action(event).catch(e=>status(e.message));});
    root.addEventListener('input',event=>{if(event.target.id==='sim-search')searchLocal();if(event.target.id==='sim-shock'){shock=Number(event.target.value);sensitivity();}});
    root.addEventListener('keydown',event=>{if(event.target.id==='sim-search'&&event.key==='Enter')searchOnline();});
    root.addEventListener('change',async event=>{
        if(event.target.id!=='sim-import')return; const file=event.target.files[0];if(!file)return;
        try{if(file.size>1000000)throw new Error('El archivo supera 1 MB.');const data=JSON.parse(await file.text());if(data.schema!==1)throw new Error('Formato de simulación no compatible.');const errors=validate(data);if(errors.length)throw new Error(errors.slice(0,3).join(' '));state=data;quoteRequest++;persist();render();status('Simulación importada en este dispositivo.');}catch(e){status(`No se ha importado: ${e.message}`);}event.target.value='';
    });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
