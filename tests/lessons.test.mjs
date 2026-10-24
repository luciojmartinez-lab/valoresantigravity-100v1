import test from 'node:test';
import assert from 'node:assert/strict';
import {LESSONS,createLesson} from '../simulation-lessons.mjs';
import {calculate,validate} from '../simulation-engine.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('las diez prácticas son financiables, coherentes y válidas sin datos de mercado',()=>{
    assert.equal(LESSONS.length,10);assert.equal(new Set(LESSONS.map(x=>x.id)).size,10);
    for(const date of ['2026-10-24','2027-01-01','2027-12-31'])for(const lesson of LESSONS){
        const s=createLesson(lesson.id,date);assert.deepEqual(validate(s),[],lesson.id);const r=calculate(s);assert.deepEqual(r.errors,[],lesson.id);assert.ok(Number.isFinite(r.net));assert.ok(r.freeCash>=0);
        assert.ok(s.positions.every(p=>p.ticker.startsWith('DEMO.')));assert.equal(s.endDate.slice(0,4),date.slice(0,4));
    }
});
test('primera práctica: 50 acciones a 10 y venta a 11, con gastos y fiscalidad explícitos',()=>{
    const s=createLesson('first','2026-10-24'),r=calculate(s);near(r.debit,503);near(r.freeCash,497);near(r.costs,6);near(r.irpf,8.36);near(r.net,35.64);near(r.finalCapital,1035.64);
    s.positions[0].target=10;near(calculate(s).net,-6);s.positions[0].target=9;near(calculate(s).net,-56);
});
test('la bajada pierde dinero, el dividendo no es beneficio neto y el dólar importa',()=>{
    near(calculate(createLesson('loss')).net,-56);
    const dividend=calculate(createLesson('dividend'));near(dividend.dividends,10);assert.ok(dividend.net>0&&dividend.net<10);
    const currency=createLesson('currency');assert.ok(calculate(currency).net<0);currency.positions[0].fxExit=1;assert.ok(calculate(currency).net>0);
});
test('las prácticas de opciones muestran prima, protección, cobertura y pérdida pese a cobrar prima',()=>{
    const call=createLesson('call');near(calculate(call).rows[0].premiumTotal,40/1.1);call.positions[0].target=4;assert.ok(calculate(call).net<0);
    const put=createLesson('put'),protectedResult=calculate(put);const unprotected=calculate({...put,positions:[put.positions[0]]});assert.ok(protectedResult.net>unprotected.net);
    const covered=createLesson('covered');covered.positions.forEach(p=>{p.target=14;});assert.deepEqual(calculate(covered).errors,[]);
    const short=createLesson('short-put');const r=calculate(short);assert.ok(r.premiums<0&&r.net<0);near(r.reserve,1000/1.1);
});
test('cargar otra práctica no reutiliza objetos ni precios modificados del ejercicio anterior',()=>{
    const first=createLesson('first');first.positions[0].target=999;first.fees.stockFixed=999;const again=createLesson('first');assert.equal(again.positions[0].target,11);assert.equal(again.fees.stockFixed,2);assert.throws(()=>createLesson('missing'));
});
