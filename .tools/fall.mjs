// Prueba de caída y de ritmo +30 %: node fall.mjs
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true });
const errors = [];
p.on('console', (m) => ['error', 'warning'].includes(m.type()) && errors.push(m.text()));
p.on('pageerror', (e) => errors.push(String(e)));
await p.goto('http://localhost:5173/?nivel=1', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__game?.mode === 'play');
const st = () => p.evaluate(() => { const g = window.__game; return { y: +g.pos.y.toFixed(2), z: +g.pos.z.toFixed(1), layer: g.layer, falling: g.falling, staggered: g.staggered, sprint: +g.sprint.toFixed(2), boost: document.querySelector('[data-boost]')?.textContent }; });

// 1) Caída: desde la pradera hacia el sur, lejos de la rampa
await p.evaluate(() => { window.__game.teleport(-10, -9); window.__game.aim(Math.PI, 0.8); });
await p.waitForTimeout(500);
await p.keyboard.down('w');
let sawFall = false, sawStagger = false, shotAir = false, shotStagger = false, minMoveDuringStagger = null;
const log = [];
for (let i = 0; i < 60; i++) {
  await p.waitForTimeout(100);
  const s = await st();
  if (s.falling) sawFall = true;
  if (s.staggered) { sawStagger = true; if (minMoveDuringStagger === null) minMoveDuringStagger = s.z; }
  if (s.falling && !shotAir) { shotAir = true; await p.screenshot({ path: '../docs/c-caida-aire.png' }); }
  if (s.staggered && !shotStagger) { shotStagger = true; await p.screenshot({ path: '../docs/c-caida-aturdido.png' }); }
  if (i % 4 === 0) log.push(JSON.stringify(s));
  if (sawStagger && !s.staggered) break;
}
await p.keyboard.up('w');
console.log(log.join('\n'));
console.log('cayó:', sawFall, '| quedó aturdido:', sawStagger, '| capa final:', (await st()).layer);

// 2) Ritmo +30 %: caminar en línea recta hasta que el indicador llegue al máximo
await p.evaluate(() => { window.__game.teleport(0, 12); window.__game.aim(0, 0.8); });
await p.waitForTimeout(400);
await p.keyboard.down('d'); await p.keyboard.up('d');
await p.keyboard.down('w');
let max = 0, label = '';
for (let i = 0; i < 40; i++) { await p.waitForTimeout(150); const s = await st(); if (s.sprint > max) { max = s.sprint; label = s.boost; } if (s.sprint > 0.97) break; }
await p.screenshot({ path: '../docs/c-ritmo.png' });
await p.keyboard.up('w');
console.log('sprint máx:', max, '| indicador:', label);
console.log('errores:', errors);
await b.close();
