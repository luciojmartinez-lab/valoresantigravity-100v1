import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
const files = ['index.html', 'app.js', 'catalogo.css', 'catalogo.json', 'updates.js', 'manifest.json', 'service-worker.js', 'simulation.css', 'simulation-engine.mjs', 'simulator.mjs'];
const hash = createHash('sha256');
for (const file of files) hash.update(file).update(await readFile(file));
const build = hash.digest('hex').slice(0, 16);
await mkdir('public', { recursive: true });
for (const file of files) {
    if (file === 'index.html' || file === 'service-worker.js') {
        await writeFile(`public/${file}`, (await readFile(file, 'utf8')).replaceAll('__APP_BUILD__', build));
    } else await cp(file, `public/${file}`);
}
await cp('icons', 'public/icons', { recursive: true });
await writeFile('public/version.json', JSON.stringify({version: '100v15', build}));
console.log(`Consulta de Valores 100v15 · build ${build}`);
