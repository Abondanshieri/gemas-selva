// Capturas rápidas del mundo por capas: node shots.mjs <nivel> x,z x,z ...
import { chromium } from 'playwright-core';
const [lvl = '1', ...pts] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true });
const errors = [];
p.on('console', (m) => ['error', 'warning'].includes(m.type()) && errors.push(m.text()));
p.on('pageerror', (e) => errors.push(String(e)));
await p.goto(`http://localhost:5173/?nivel=${lvl}`, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__game?.mode === 'play');
await p.waitForTimeout(1500);
await p.screenshot({ path: `../docs/c-n${lvl}-inicio.png` });
let i = 0;
for (const pt of pts) {
  const [x, z, yw, pt2] = pt.split(',').map(Number);
  await p.evaluate(([x, z, yw, pt2]) => { window.__game.teleport(x, z); if (!Number.isNaN(yw)) window.__game.aim(yw, pt2); }, [x, z, yw, pt2]);
  await p.waitForTimeout(1600);
  const info = await p.evaluate(() => ({ layer: window.__game.layer, y: +window.__game.pos.y.toFixed(2), info: window.__game.info }));
  console.log(pt, JSON.stringify(info));
  await p.screenshot({ path: `../docs/c-n${lvl}-${++i}.png` });
}
console.log('errores:', errors);
await b.close();
