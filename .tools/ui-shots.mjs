import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
for (const [tag, w, h] of [['h', 844, 390], ['v', 390, 844]]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true });
  p.on('console', (m) => ['error', 'warning'].includes(m.type()) && errors.push(m.text()));
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto('http://localhost:5173/?nivel=2', { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.__game?.mode === 'play');
  // inventario de ejemplo: 1 C, 2 D, 3 U
  await p.evaluate(() => window.__game.store.set({ U: 3, D: 12, C: 0 }));
  await p.waitForTimeout(1200);
  await p.click('[data-act="blueprint"]'); await p.waitForTimeout(400);
  await p.click('#blueprint [data-act="compose"][data-type="D"]');
  await p.waitForTimeout(400);
  await p.screenshot({ path: `../docs/v3-blueprint-${tag}.png` });
  const rect = await p.evaluate(() => { const r = document.querySelector('.bpwin').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), innerWidth, innerHeight]; });
  console.log(tag, 'ventana', rect, rect[1] < rect[3] ? 'cabe' : 'NO cabe');
  const canvasStill = await p.evaluate(() => !!document.querySelector('#scene') && document.querySelector('#blueprint-overlay').hidden === false);
  console.log(tag, 'overlay abierto, canvas presente:', canvasStill);
  await p.close();
}
console.log('errores:', errors);
await b.close();
