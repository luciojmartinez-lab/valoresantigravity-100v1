import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const updater = await readFile(new URL('../updates.js', import.meta.url), 'utf8');
const worker = await readFile(new URL('../service-worker.js', import.meta.url), 'utf8');
const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));

function updaterContext({latest = 'old', offline = false, hidden = false} = {}) {
    let now = 100000;
    const events = {}, storage = new Map();
    const state = {reloads: 0, requests: 0, latest, offline};
    const context = {
        document: {hidden, querySelector: () => ({content: 'old'}), getElementById: () => ({}), addEventListener: (name, fn) => {events[name] = fn;}},
        window: {addEventListener: (name, fn) => {events[name] = fn;}},
        navigator: {}, location: {reload() {state.reloads++;}},
        sessionStorage: {getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value)},
        Date: {now: () => now}, AbortSignal,
        fetch: async () => {state.requests++; if (state.offline) throw new Error('offline'); return {ok: true, json: async () => ({build: state.latest})};}
    };
    vm.runInNewContext(updater, context);
    return {state, events, context, advance: () => {now += 20000;}};
}

test('nueva versión al abrir: una recarga y sin borrar ajustes', async () => {
    const {state, events, advance} = updaterContext({latest: 'new'});
    await settle();
    assert.equal(state.reloads, 1);
    advance(); events.focus(); await settle();
    assert.equal(state.reloads, 1);
});

test('misma versión no recarga; al volver detecta una publicación posterior', async () => {
    const {state, events, advance} = updaterContext();
    await settle(); assert.equal(state.reloads, 0);
    state.latest = 'new'; advance(); events.visibilitychange(); events.focus();
    await settle(); assert.equal(state.reloads, 1); assert.equal(state.requests, 2);
});

test('sin conexión conserva el programa y reintenta al recuperarla', async () => {
    const {state, events} = updaterContext({latest: 'new', offline: true});
    await settle(); assert.equal(state.reloads, 0);
    state.offline = false; events.online(); await settle(); assert.equal(state.reloads, 1);
});

test('no actualiza mientras la aplicación está oculta', async () => {
    const {state, context, events} = updaterContext({latest: 'new', hidden: true});
    await settle(); assert.equal(state.requests, 0);
    context.document.hidden = false; events.visibilitychange(); await settle();
    assert.equal(state.reloads, 1);
});

test('worker conserva cachés ajenas y nunca sustituye JSON por HTML sin red', async () => {
    const events = {}, removed = [];
    vm.runInNewContext(worker, {
        self: {location: {origin: 'https://test.example'}, addEventListener: (name, fn) => {events[name] = fn;}, clients: {claim: async () => {}}, skipWaiting: async () => {}},
        caches: {keys: async () => ['valores-pwa-100v9', 'valores-app-viejo', 'otra-aplicacion'], delete: async key => {removed.push(key);}},
        URL, Response, Request, fetch: async () => {throw new Error('offline');}
    });
    let activation; events.activate({waitUntil: promise => {activation = promise;}}); await activation;
    assert.deepEqual(removed.sort(), ['valores-app-viejo', 'valores-pwa-100v9']);
    let response; events.fetch({request: new Request('https://test.example/api/quotes?symbols=SPY'), respondWith: promise => {response = promise;}});
    const result = await response; assert.equal(result.status, 503);
    assert.match(result.headers.get('Content-Type'), /json/); assert.ok((await result.json()).error);
});

test('migración conserva los ETF de la versión móvil, moneda y acciones españolas', () => {
    const saved = {'val_100v13_currency': 'EUR', 'val_100v13_selected_etfs': JSON.stringify(['voo', 'ivv', 'agg', 'schd'])};
    const context = vm.createContext({console, document: {addEventListener() {}}, localStorage: {getItem: key => saved[key]}, Map, Set});
    vm.runInContext(app, context);
    vm.runInContext(`loadState(); if (currentCurrency !== 'EUR' || !selected.has('VOO') || !selected.has('IVV') || !selected.has('AGG') || !selected.has('SCHD') || !selected.has('SAN.MC')) throw new Error('Migración incorrecta');`, context);
});
