// Cálculo local. Todos los importes de resultado están en EUR.
export const PROFILES = {
    smart: {name: 'Freedom24 · Smart', stockFixed: 2, stockUnit: .02, stockPct: 0, optionFixed: 0, optionUnit: .65, otherOptionUnit: 1.5, expiryUnit: 0, otherExpiryUnit: 1.5},
    inclusive: {name: 'Freedom24 · All-inclusive', stockFixed: 1.2, stockUnit: .012, stockPct: .5, optionFixed: 10, optionUnit: 3, otherOptionUnit: 1.5, expiryUnit: 0, otherExpiryUnit: 1.5}
};
export const BRACKETS = [[6000, 19], [50000, 21], [200000, 23], [300000, 27], [Infinity, 30]];
export const defaults = () => ({schema: 1, name: 'Mi simulación', capital: 10000, date: new Date().toISOString().slice(0, 10),
    endDate: `${new Date().getFullYear()}-12-31`, profile: 'smart', fees: {...PROFILES.smart}, fxPct: 0,
    withdrawal: 0, extraCosts: 0, otherGains: 0, otherIncome: 0, foreignCredit: 0, taxMode: 'common', flatTax: 19,
    rates: BRACKETS.map(x => x[1]), positions: []});
const finite = v => typeof v === 'number' && Number.isFinite(v);
const validDate = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
const sum = (items, key) => items.reduce((a, x) => a + x[key], 0);
export function taxScale(base, rates = BRACKETS.map(x => x[1])) {
    let lower = 0, total = 0;
    BRACKETS.forEach(([upper], i) => {total += Math.max(0, Math.min(base, upper) - lower) * rates[i] / 100; lower = upper;});
    return total;
}
export function savingsBase(gains, income) {
    const cross = gains < 0 && income > 0 ? Math.min(-gains, income * .25) : income < 0 && gains > 0 ? Math.min(-income, gains * .25) : 0;
    return {base: Math.max(0, gains) + Math.max(0, income) - cross,
        loss: Math.max(0, -gains - (income > 0 ? cross : 0)), incomeLoss: Math.max(0, -income - (gains > 0 ? cross : 0)), cross};
}
export function validate(s) {
    const errors = [];
    const check = (v, min, max, name) => {if (!finite(v) || v < min || v > max) errors.push(`${name}: introduce un número entre ${min} y ${max}.`);};
    check(s.capital, 1, 1e12, 'Capital');
    for (const key of ['fxPct', 'flatTax']) check(s[key], 0, 100, key === 'fxPct' ? 'Coste de cambio' : 'Tipo fiscal');
    for (const key of ['withdrawal', 'extraCosts', 'foreignCredit']) check(s[key], 0, 1e12, 'Gastos o deducción');
    for (const key of ['otherGains', 'otherIncome']) check(s[key], -1e12, 1e12, 'Otras rentas del ahorro');
    if (!Array.isArray(s.rates) || s.rates.length !== 5) errors.push('Revisa los cinco tipos fiscales.');
    else s.rates.forEach(v => check(v, 0, 100, 'Tramo fiscal'));
    if (!['common', 'flat'].includes(s.taxMode)) errors.push('Selecciona un régimen fiscal.');
    if (!validDate(s.date) || !validDate(s.endDate) || s.date > s.endDate) errors.push('Usa fechas válidas; la fecha final debe ser igual o posterior a la inicial.');
    if (s.date?.slice(0, 4) !== s.endDate?.slice(0, 4)) errors.push('Esta simulación fiscal abarca un único año natural. Divide las operaciones entre años.');
    for (const key of Object.keys(PROFILES.smart).filter(k => k !== 'name')) check(s.fees?.[key], 0, 1e9, 'Tarifas');
    if (!Array.isArray(s.positions) || s.positions.length > 100) return [...errors, 'Máximo 100 posiciones.'];
    s.positions.forEach((p, i) => {
        const label = `Posición ${i + 1}`;
        if (!p || typeof p !== 'object') {errors.push(`${label}: datos no válidos.`); return;}
        if (!['stock', 'call', 'put'].includes(p.kind) || !['buy', 'sell'].includes(p.side) || (p.kind === 'stock' && p.side !== 'buy')) errors.push(`${label}: operación no compatible.`);
        if (!/^[A-Z0-9^=.:_+\-]{1,45}$/.test(p.ticker || '')) errors.push(`${label}: falta un ticker válido.`);
        if (!/^[A-Z]{3}$/.test(p.currency || '')) errors.push(`${label}: divisa no válida.`);
        if (s.profile !== 'custom' && p.kind === 'stock' && !['EUR', 'USD'].includes(p.currency)) errors.push(`${label}: configura las comisiones personalizadas para acciones en ${p.currency}.`);
        for (const key of ['entry', 'target', 'premium', 'closePremium', 'dividend', 'exerciseFee', 'extraEntry', 'extraExit']) check(p[key], 0, 1e10, `${label} · ${key}`);
        if (!(p.entry > 0)) errors.push(`${label}: introduce o consulta un precio inicial del subyacente mayor que cero.`);
        for (const key of ['withholdForeign', 'withholdSpain', 'buyTax', 'sellTax', 'slippage']) check(p[key], 0, 100, `${label} · porcentaje`);
        for (const key of ['fxEntry', 'fxExit']) check(p[key], .00000001, 1e10, `${label} · cambio`);
        if (p.currency === 'EUR' && (p.fxEntry !== 1 || p.fxExit !== 1)) errors.push(`${label}: el cambio EUR debe ser 1.`);
        check(p.qty, 1, 1e9, `${label} · cantidad`);
        if (!Number.isInteger(p.qty)) errors.push(`${label}: usa acciones o contratos enteros.`);
        if (p.kind !== 'stock') {
            for (const key of ['feeUsdEntry', 'feeUsdExit']) check(p[key], .00000001, 1e10, `${label} · cambio USD para comisión`);
            check(p.strike, .000001, 1e10, `${label} · strike`); check(p.multiplier, 1, 1e6, `${label} · multiplicador`);
            if (!Number.isInteger(p.multiplier)) errors.push(`${label}: el multiplicador debe ser entero.`);
            if (!['expiry', 'close'].includes(p.exitMode) || !['us', 'other'].includes(p.optionMarket)) errors.push(`${label}: revisa mercado y liquidación de la opción.`);
            if (!validDate(p.expiry) || p.expiry < s.date || (p.exitMode === 'expiry' && p.expiry !== s.endDate) || (p.exitMode === 'close' && p.expiry < s.endDate)) errors.push(`${label}: para vencimiento, usa la misma fecha final; para cierre, vence ese día o después.`);
        }
    });
    return errors;
}
export function calculate(s, shock = 0) {
    const errors = validate(s);
    if (errors.length) return {errors};
    const warnings = [], fees = s.fees;
    const rows = s.positions.map(p => {
        const option = p.kind !== 'stock', short = p.side === 'sell', direction = short ? -1 : 1;
        const units = p.qty * (option ? p.multiplier : 1), future = Math.max(0, p.target * (1 + shock / 100));
        const f0 = p.fxEntry, f1 = p.fxExit, fx = p.currency === 'EUR' ? 0 : s.fxPct / 100;
        const us = p.optionMarket === 'us';
        // Tarifas de opciones estadounidenses en USD, aunque el subyacente se introduzca en otra divisa.
        const optionFx0 = us ? p.feeUsdEntry : f0, optionFx1 = us ? p.feeUsdExit : f1;
        if (option && us && (!(optionFx0 > 0) || !(optionFx1 > 0))) errors.push(`${p.ticker}: falta el cambio USD/EUR para la comisión de opciones de EE.UU.`);
        const intrinsic = Math.max(0, p.kind === 'call' ? future - p.strike : p.strike - future);
        const entryNative = (option ? p.premium : p.entry) * units;
        const exitNative = (option ? (p.exitMode === 'close' ? p.closePremium : intrinsic) : future) * units;
        const entryValue = entryNative / f0, exitValue = exitNative / f1;
        const commission0 = option ? ((us ? fees.optionFixed + fees.optionUnit * p.qty : fees.otherOptionUnit * p.qty) / optionFx0) : (fees.stockFixed + fees.stockUnit * p.qty + entryNative * fees.stockPct / 100) / f0;
        const commission1 = option ? (p.exitMode === 'close' ? (us ? fees.optionFixed + fees.optionUnit * p.qty : fees.otherOptionUnit * p.qty) / optionFx1 : (us ? fees.expiryUnit : fees.otherExpiryUnit) * p.qty / optionFx1 + (intrinsic > 0 ? p.exerciseFee : 0)) : (fees.stockFixed + fees.stockUnit * p.qty + exitNative * fees.stockPct / 100) / f1;
        const fxCost = (entryValue + exitValue) * fx;
        const slipCost = (entryValue + (option && p.exitMode === 'expiry' ? 0 : exitValue)) * p.slippage / 100;
        const transactionTax = option ? 0 : entryValue * p.buyTax / 100 + exitValue * p.sellTax / 100;
        const costs = commission0 + commission1 + fxCost + slipCost + transactionTax + p.extraEntry + p.extraExit;
        const gain = direction * (exitValue - entryValue) - costs;
        const dividends = option ? 0 : p.dividend * p.qty / f1;
        const foreign = dividends * p.withholdForeign / 100;
        const spanish = (dividends - foreign) * p.withholdSpain / 100;
        const reserve = option && short && p.kind === 'put' ? p.strike * units / f0 : 0;
        const upfrontCosts = commission0 + entryValue * (fx + p.slippage / 100) + (option ? 0 : entryValue * p.buyTax / 100) + p.extraEntry;
        const debit = direction * entryValue + upfrontCosts;
        return {...p, units, future, intrinsic, entryValue, exitValue, commission0, commission1, fxCost, slipCost, transactionTax,
            costs, gain, dividends, foreign, spanish, reserve, debit, premiumTotal: option ? entryValue * direction : 0,
            exerciseCash: option && p.kind === 'call' && !short ? p.strike * units / f1 : 0,
            deliveryShares: option && p.kind === 'put' && !short ? units : 0};
    });
    // Las acciones de una misma línea sólo pueden cubrir una venta call simultánea.
    const coverage = new Map();
    rows.filter(p => p.kind === 'stock').forEach(p => {
        const key = `${p.ticker}|${p.currency}|${p.target}|${p.fxExit}`;
        coverage.set(key, (coverage.get(key) || 0) + p.qty);
    });
    rows.filter(p => p.kind === 'call' && p.side === 'sell').forEach(p => {
        const key = `${p.ticker}|${p.currency}|${p.target}|${p.fxExit}`;
        const available = coverage.get(key) || 0;
        if (available < p.units) errors.push(`${p.ticker}: la call vendida necesita ${p.units} acciones compradas con la misma divisa, precio final y cambio final; hay ${available} disponibles. Venta descubierta no financiada.`);
        coverage.set(key, Math.max(0, available - p.units));
    });
    const families = new Map();
    rows.forEach(p => {
        const key = `${p.ticker}|${p.currency}`;
        const scenario = `${p.entry}|${p.target}|${p.fxEntry}|${p.fxExit}`;
        if (families.has(key) && families.get(key) !== scenario) errors.push(`${p.ticker}: usa los mismos precios del subyacente y cambios en todas sus posiciones.`);
        families.set(key, scenario);
    });
    const gain = sum(rows, 'gain'), dividends = sum(rows, 'dividends'), foreign = sum(rows, 'foreign'), spanish = sum(rows, 'spanish');
    const baseBefore = savingsBase(s.otherGains, s.otherIncome), baseAfter = savingsBase(s.otherGains + gain, s.otherIncome + dividends);
    const tax = b => s.taxMode === 'flat' ? b * s.flatTax / 100 : taxScale(b, s.rates);
    const taxChange = tax(baseAfter.base) - tax(baseBefore.base);
    // Se provisiona sólo el impuesto adicional; un ahorro fiscal ajeno no es efectivo nuevo de la cartera.
    const irpf = Math.max(0, taxChange), credit = Math.min(s.foreignCredit, foreign, irpf);
    const taxDue = irpf - credit - spanish;
    const nonDeductible = s.withdrawal + s.extraCosts;
    const gross = gain + dividends;
    const net = gross - foreign - irpf + credit - nonDeductible;
    const debit = sum(rows, 'debit'), reserve = sum(rows, 'reserve'), freeCash = s.capital - debit - reserve;
    if (freeCash < -.005) errors.push(`Falta capital: ${(-freeCash).toFixed(2)} EUR para abrir las posiciones y reservar el efectivo de las puts vendidas.`);
    if (rows.some(p => p.kind !== 'stock' && p.exitMode === 'expiry')) warnings.push('Vencimiento: resultado económico equivalente a liquidar también las acciones recibidas o entregadas. Una opción sobre acciones suele implicar entrega física; revisa el efectivo o títulos de ejercicio y sus gastos.');
    if (rows.some(p => p.kind !== 'stock' && p.side === 'sell')) warnings.push('Las opciones americanas vendidas pueden asignarse antes del vencimiento. La reserva de puts es el strike completo; no se simula margen, crédito ni reconocimiento de spreads.');
    if (rows.some(p => p.currency !== 'EUR')) warnings.push('Se supone conversión de EUR al abrir y de vuelta al cerrar cada línea. Si reutilizas saldo en divisa, ajusta su coste para evitar duplicarlo. La tributación de saldos de divisa mantenidos aparte no se calcula.');
    if (s.fxPct === 0 && rows.some(p => p.currency !== 'EUR')) warnings.push('El coste de cambio está en 0 %. No hay un coste de conversión confirmado: revisa el diferencial o comisión aplicable antes de usar el resultado.');
    if (rows.some(p => p.kind !== 'stock' && p.exitMode === 'expiry' && p.intrinsic > 0 && p.exerciseFee === 0)) warnings.push('El gasto de ejercicio y liquidación de títulos está en 0 EUR en alguna opción con valor intrínseco. Confírmalo con el bróker; el vencimiento gratuito de una opción no confirma que todas las operaciones sobre sus acciones sean gratuitas.');
    if (rows.some(p => p.kind === 'put' && p.side === 'sell' && p.currency !== 'EUR')) warnings.push('La reserva de las puts en divisa se valora al cambio inicial. Una apreciación de esa divisa puede exigir más euros durante la vida del contrato.');
    if (rows.some(p => p.kind !== 'stock' && p.exitMode === 'close') && shock !== 0) warnings.push('Los escenarios con cierre anticipado mantienen fija la prima de salida introducida: no recalculan volatilidad ni valor temporal.');
    return {errors, warnings, rows, gain, dividends, foreign, spanish, taxChange, irpf, credit, taxDue, gross, net,
        finalCapital: s.capital + net, debit, reserve, freeCash, required: debit + reserve, nonDeductible,
        commissions: sum(rows, 'commission0') + sum(rows, 'commission1'), fxCosts: sum(rows, 'fxCost'), slippage: sum(rows, 'slipCost'),
        transactionTax: sum(rows, 'transactionTax'), costs: sum(rows, 'costs') + nonDeductible,
        premiums: sum(rows, 'premiumTotal'), lossCarry: baseAfter.loss, incomeLossCarry: baseAfter.incomeLoss,
        baseBefore: baseBefore.base, baseAfter: baseAfter.base, compensation: baseAfter.cross};
}
