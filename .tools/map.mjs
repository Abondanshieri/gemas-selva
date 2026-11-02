import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const lvl = process.argv[2] ?? '4';
const errors = [];
for (const [tag, w, h] of [['h', 844, 390], ['v', 390, 844]]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: true });
  p.on('console', (m) => ['error', 'warning'].includes(m.type()) && errors.push(m.text()));
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(`http://localhost:5173/?nivel=${lvl}`, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.__game?.mode === 'play');
  await p.waitForTimeout(1200);
  if (tag === 'h') {
    console.log('encabezado bosque:', await p.evaluate(() => document.querySelector('[data-goalpill]').innerText.replace(/\s+/g, ' ')));
    await p.screenshot({ path: `../docs/c-mapa-header-${lvl}.png` });
    await p.evaluate(() => { window.__game.teleport(-14, -30); });
    await p.waitForTimeout(700);
    console.log('encabezado pradera:', await p.evaluate(() => document.querySelector('[data-goalpill]').innerText.replace(/\s+/g, ' ')));
    await p.evaluate(() => { window.__game.teleport(0, 12); });
    await p.waitForTimeout(500);
  }
  await p.click('[data-act="map"]'); await p.waitForTimeout(500);
  console.log(tag, 'modo:', await p.evaluate(() => window.__game.mode), '| overlay visible:', await p.evaluate(() => !document.querySelector('.wmap').hidden));
  await p.screenshot({ path: `../docs/c-mapa-${tag}-${lvl}.png` });
  await p.keyboard.press('m'); await p.waitForTimeout(400);
  console.log(tag, 'tras cerrar con M:', await p.evaluate(() => window.__game.mode));
  await p.close();
}
console.log('errores:', errors);
await b.close();
