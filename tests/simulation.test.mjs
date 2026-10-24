import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate, defaults, PROFILES, savingsBase, taxScale, validate} from '../simulation-engine.mjs';
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-7, `${actual} != ${expected}`);
const stock=changes=>({ticker:'ABC',name:'Ejemplo',kind:'stock',side:'buy',currency:'EUR',qty:10,entry:100,target:120,
    premium:0,closePremium:0,multiplier:100,strike:100,expiry:'2026-12-31',exitMode:'expiry',optionMarket:'us',
    dividend:0,fxEntry:1,fxExit:1,feeUsdEntry:1,feeUsdExit:1,withholdForeign:0,withholdSpain:0,buyTax:0,sellTax:0,slippage:0,extraEntry:0,extraExit:0,exerciseFee:0,...changes});
const option=changes=>stock({kind:'call',qty:1,premium:5,entry:100,target:120,...changes});
const portfolio=(positions,changes={})=>({...defaults(),date:'2026-10-24',endDate:'2026-12-31',positions,...changes});
const zeroFees=Object.fromEntries(Object.keys(PROFILES.smart).map(k=>[k,k==='name'?'Sin comisiones':0]));
test('cartera de acciones: comisiones de compra y venta, IRPF y efectivo sin invertir',()=>{
    const r=calculate(portfolio([stock()]));assert.deepEqual(r.errors,[]);
    near(r.commissions,4.4);near(r.debit,1002.2);near(r.freeCash,8997.8);near(r.gain,195.6);near(r.irpf,37.164);near(r.finalCapital,10158.436);
});
test('tramos progresivos y cambio del tramo superior',()=>{near(taxScale(6000),1140);near(taxScale(50000),10380);near(taxScale(300000),71880);near(taxScale(310000),74880);near(taxScale(-1),0);});
test('el capital aportado no tributa y no hay ganancia con precios constantes sin gastos',()=>{const r=calculate(portfolio([stock({target:100})],{fees:zeroFees}));near(r.net,0);near(r.irpf,0);near(r.finalCapital,10000);});
test('otras rentas consumen los primeros tramos; sólo se grava el incremento',()=>{const r=calculate(portfolio([stock()],{fees:zeroFees,otherIncome:6000}));near(r.irpf,42);});
test('las pérdidas de una posición compensan ganancias de otra',()=>{const r=calculate(portfolio([stock(),stock({ticker:'DEF',target:80})],{fees:zeroFees}));near(r.irpf,0);near(r.gain,0);});
test('compensación cruzada de pérdidas con dividendos limitada al 25%',()=>{
    const r=calculate(portfolio([stock({target:80,dividend:10})],{fees:zeroFees}));near(r.compensation,25);near(r.baseAfter,75);near(r.lossCarry,175);near(r.irpf,14.25);near(r.net,-114.25);
    assert.deepEqual(savingsBase(100,-200),{base:75,loss:0,incomeLoss:175,cross:25});
});
test('no convierte el ahorro fiscal de otras rentas en efectivo nuevo',()=>{const r=calculate(portfolio([stock({target:80})],{fees:zeroFees,otherGains:500}));near(r.taxChange,-38);near(r.irpf,0);near(r.net,-200);});
test('dividendos, doble imposición confirmada y retención española sin doble descuento',()=>{
    const r=calculate(portfolio([stock({target:100,dividend:10,withholdForeign:15,withholdSpain:19})],{fees:zeroFees,foreignCredit:15}));
    near(r.foreign,15);near(r.spanish,16.15);near(r.irpf,19);near(r.credit,15);near(r.taxDue,-12.15);near(r.net,81);
});
test('deducción extranjera nunca excede lo retenido ni el IRPF adicional',()=>{const r=calculate(portfolio([stock({target:100,dividend:10,withholdForeign:30})],{fees:zeroFees,foreignCredit:999}));near(r.credit,19);near(r.net,70);});
test('call comprada: prima por 100 acciones y comisión por contrato, sin multiplicarla por 100',()=>{const r=calculate(portfolio([option()]));near(r.premiums,500);near(r.commissions,.65);near(r.gain,1499.35);near(r.rows[0].exerciseCash,10000);});
test('call fuera de dinero: pierde prima más gastos, no cobra comisión de cierre al expirar',()=>{const r=calculate(portfolio([option({target:90})]));near(r.gain,-500.65);near(r.irpf,0);near(r.rows[0].commission1,0);});
test('put comprada: caída del subyacente genera valor intrínseco',()=>{const r=calculate(portfolio([option({kind:'put',target:80})]));near(r.gain,1499.35);near(r.rows[0].deliveryShares,100);});
test('cierre anticipado usa prima de salida y dos comisiones, no el valor intrínseco',()=>{const r=calculate(portfolio([option({exitMode:'close',closePremium:7,target:1000})]));near(r.gain,198.7);near(r.commissions,1.3);near(calculate(portfolio([option({exitMode:'close',closePremium:7,target:1000})]),-50).gain,198.7);});
test('put vendida reserva todo el strike, no sólo la prima, y verifica presupuesto',()=>{const r=calculate(portfolio([option({kind:'put',side:'sell',target:110})]));near(r.reserve,10000);near(r.debit,-499.35);near(r.freeCash,499.35);near(r.gain,499.35);assert.equal(r.errors.length,0);
    const short=calculate(portfolio([option({kind:'put',side:'sell',target:80})],{capital:1000}));assert.match(short.errors.join(' '),/Falta capital/);near(short.gain,-1500.65);
});
test('call vendida descubierta se rechaza; cobertura no se reutiliza en otra call',()=>{
    assert.match(calculate(portfolio([option({side:'sell'})])).errors.join(' '),/Venta descubierta/);
    const covered=[stock({qty:100,entry:100,target:120}),option({side:'sell'})];
    const r=calculate(portfolio(covered,{capital:20000,fees:zeroFees}));assert.deepEqual(r.errors,[]);near(r.gain,500);
    assert.match(calculate(portfolio([...covered,option({side:'sell'})],{capital:20000})).errors.join(' '),/hay 0 disponibles/);
});
test('mismo subyacente exige objetivos y cambios coherentes',()=>{const r=calculate(portfolio([stock(),option({target:121})]));assert.match(r.errors.join(' '),/mismos precios/);});
test('efecto de divisas aunque el activo no cambie; euros por cada fecha',()=>{
    const r=calculate(portfolio([stock({currency:'USD',target:100,fxEntry:1.25,fxExit:1})],{fees:zeroFees,fxPct:.5}));near(r.gain,191);near(r.fxCosts,9);near(r.debit,804);near(r.irpf,36.29);
});
test('comisiones de opciones EE.UU. se convierten de USD y no de la divisa del activo',()=>{const r=calculate(portfolio([option({feeUsdEntry:1.3})]));near(r.rows[0].commission0,.5);});
test('opciones fuera de EE.UU. cobran vencimiento y comisión por contrato',()=>{const r=calculate(portfolio([option({optionMarket:'other',qty:2})]));near(r.commissions,6);});
test('ITF sólo en acciones, costes extra y deslizamiento a ambos lados',()=>{const r=calculate(portfolio([stock({buyTax:.2,sellTax:.1,slippage:.1,extraEntry:3,extraExit:4})]));near(r.transactionTax,3.2);near(r.slippage,2.2);near(r.costs,16.8);near(r.gain,183.2);});
test('coste de ejercicio sólo para opciones a vencimiento con valor intrínseco',()=>{near(calculate(portfolio([option({exerciseFee:10})])).commissions,10.65);near(calculate(portfolio([option({exerciseFee:10,target:90})])).commissions,.65);});
test('retirada y gastos generales no reducen base fiscal',()=>{const r=calculate(portfolio([stock()],{fees:zeroFees,withdrawal:7,extraCosts:3}));near(r.irpf,38);near(r.net,152);});
test('All-inclusive: porcentaje más títulos más orden; opciones fijo USD y por contrato',()=>{const r=calculate(portfolio([stock(),option({ticker:'DEF',exitMode:'close',closePremium:7})],{profile:'inclusive',fees:PROFILES.inclusive}));near(r.commissions,39.64);});
test('no permite cantidades fraccionarias, importes negativos, NaN, divisas EUR con cambio y años fiscales mezclados',()=>{
    for(const p of [stock({qty:.5}),stock({premium:-1}),stock({fxEntry:NaN}),stock({fxEntry:2}),option({feeUsdEntry:Infinity})])assert.ok(validate(portfolio([p])).length);
    assert.match(validate(portfolio([],{endDate:'2027-01-01'})).join(' '),/año natural/);
    assert.match(validate(portfolio([option({expiry:'2026-12-30'})])).join(' '),/misma fecha final/);
});
test('escenario de mercado mueve acciones y valor intrínseco, conserva prima de cierre manual',()=>{const s=portfolio([option({target:100})],{fees:zeroFees});near(calculate(s,20).gain,1500);near(calculate(s,-20).gain,-500);});
