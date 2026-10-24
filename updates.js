/* Actualiza el programa instalado conservando localStorage e IndexedDB. */
(() => {
    'use strict';
    const build = document.querySelector('meta[name="app-build"]')?.content;
    if (!build || build === '__APP_BUILD__') return;
    let checking = false;
    let lastChecked = 0;
    let registration;
    let reloadPending = false;
    const hadController = Boolean(navigator.serviceWorker?.controller);
    const status = message => { const node = document.getElementById('program-update-status'); if (node) node.textContent = message; };

    function reloadOnce(target) {
        if (reloadPending || document.hidden) return;
        const key = `valores-reload-${target}`;
        try {
            if (sessionStorage.getItem(key)) return;
            sessionStorage.setItem(key, '1');
        } catch (_) { }
        reloadPending = true;
        const status = document.getElementById('market-status');
        if (status) status.textContent = 'Cargando la nueva versión del programa…';
        location.reload();
    }

    async function checkVersion(force = false) {
        if (document.hidden || checking || (!force && Date.now() - lastChecked < 10000)) return;
        checking = true;
        lastChecked = Date.now();
        try {
            const response = await fetch(`/version.json?t=${Date.now()}`, {cache: 'no-store', signal: AbortSignal.timeout(12000)});
            if (!response.ok) { status('No se ha podido comprobar la versión. Se mantiene la copia disponible.'); return; }
            const latest = await response.json();
            if (!latest.build) return;
            if (latest.build === build) { status(`Programa actualizado (${latest.version || '100v14'}).`); return; }
            status('Cargando una nueva versión del programa…');
            if (registration) {
                await registration.update().catch(() => {});
                registration.waiting?.postMessage({type: 'SKIP_WAITING'});
            }
            reloadOnce(latest.build);
        } catch (_) { status('Sin conexión: continúas con la versión disponible en este dispositivo.'); }
        finally { checking = false; }
    }

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (hadController) checkVersion(true);
        });
        window.addEventListener('load', async () => {
            try {
                registration = await navigator.serviceWorker.register('/service-worker.js', {updateViaCache: 'none'});
                await registration.update();
                registration.waiting?.postMessage({type: 'SKIP_WAITING'});
            } catch (_) { }
        });
    }
    document.addEventListener('visibilitychange', () => checkVersion());
    window.addEventListener('focus', () => checkVersion());
    window.addEventListener('pageshow', () => checkVersion());
    window.addEventListener('online', () => checkVersion(true));
    checkVersion(true);
})();
