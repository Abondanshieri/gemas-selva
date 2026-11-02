import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true });
const errors = [];
p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) { errors.push(m.type() + ': ' + m.text()); console.log('[console]', m.type(), m.text()); } });
p.on('pageerror', (e) => { errors.push('pageerror: ' + e); console.log('[pageerror]', String(e)); });
const shot = (n) => p.screenshot({ path: `../docs/${n}.png` });
const G = (fn, ...a) => p.evaluate(fn, ...a);
const inv = () => G(() => window.__game.store.get());
const wait = (ms) => p.waitForTimeout(ms);
let ok = true;
const check = (name, cond, extra = '') => { if (!cond) ok = false; console.log(cond ? 'OK  ' : 'FAIL', name, extra); };

const tp = async (x, z, ms = 220) => { await G(([x, z]) => window.__game.teleport(x, z), [x, z]); await wait(ms); };
const until = async (fn, ms = 9000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await wait(100); } return false; };
const bubbleText = () => G(() => { const e = document.querySelector('.bubble.show'); return e ? e.textContent.trim() : null; });
const clickBubble = async () => { await p.click('.bubble.show', { force: true }); await wait(350); };
const bp = async (steps) => {
  await p.click('[data-act="blueprint"]'); await wait(250);
  for (const [a, t] of steps) await p.click(`#blueprint [data-act="${a}"][data-type="${t}"]`);
  await p.click('#blueprint [data-act="close"]'); await wait(250);
};
const collectAll = async () => { const l = await G(() => window.__game.gems.map((g) => [g.x, g.z])); for (const [x, z] of l) await tp(x, z, 120); };
const scene = () => G(() => window.__game.info.scene);
const goExit = async (x, z, label) => { await tp(x, z, 100); await until(async () => (await bubbleText())?.includes(label));
  if (!(await bubbleText())?.includes(label)) console.log('DIAG', JSON.stringify(await G(() => ({ pos: [window.__game.pos.x, window.__game.pos.z], action: window.__game.action, swinging: window.__game.swinging, mode: window.__game.mode, scene: window.__game.info.scene, info: window.__game.info })))); check(`salida "${label}" ofrece burbuja`, (await bubbleText())?.includes(label), String(await bubbleText())); await clickBubble(); await wait(900); };
const deliverAt = async (x, z, expect) => { await tp(x, z, 100); await until(async () => (await bubbleText())?.startsWith(expect)); const t = await bubbleText(); check(`burbuja en tótem: ${expect}`, t?.startsWith(expect), String(t)); await clickBubble(); };
const cross = async () => {
  const z = await G(() => window.__game.pos.z); const s = Math.sign(z);
  await tp(0, 7.5 * s, 100);
  await until(async () => (await bubbleText()) === 'Látigo');
  check('aro: burbuja Látigo', (await bubbleText()) === 'Látigo');
  await clickBubble();
  for (let i = 0; i < 120; i++) { await wait(150); if (!(await G(() => window.__game.swinging)) && i > 3) break; }
  check('cruzó el río', Math.sign(await G(() => window.__game.pos.z)) === -s);
};

// ---------- Menú ----------
await p.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__game); await wait(300);
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: 'networkidle' }); await p.waitForFunction(() => window.__game); await wait(300);
check('menú: solo nivel 1 desbloqueado', (await G(() => document.querySelectorAll('.lvl:not(.locked)').length)) === 1);
await p.click('.lvl[data-id="1"]'); await wait(900);

// ---------- Nivel 1 ----------
await shot('v3-n1-inicio');
await collectAll();
await bp([['decompose', 'D']]);
check('N1 Σ conservada (10 U)', (await inv()).U === 10);
await deliverAt(-9 + 2, -17 + 2, 'Entregar');
check('N1 ya no existe el botón de la esquina', await G(() => !document.querySelector('.act')));
await shot('v3-n1-burbuja');
check('N1 victoria', await G(() => window.__game.won), JSON.stringify(await inv()));
await p.click('[data-act="next"]'); await wait(900);

// ---------- Nivel 2: 3 escenarios, tótems U D C ----------
check('N2 escena verde', (await scene()) === 'verde');
await shot('v3-n2-verde');
await collectAll();
await goExit(17.5, 2, 'Claro ámbar');
check('N2 escena ámbar', (await scene()) === 'ambar');
await shot('v3-n2-ambar');
await collectAll();
await goExit(17.5, 2, 'Claro niebla');
check('N2 escena niebla', (await scene()) === 'rosa');
await shot('v3-n2-niebla');
await collectAll();
check('N2 llevo 14 D y 2 U', (await inv()).D === 14 && (await inv()).U === 2, JSON.stringify(await inv()));
await bp([['compose', 'D']]);
check('N2 compuse C', (await inv()).C === 1, JSON.stringify(await inv()));
await deliverAt(0, -14, 'Entregar · 1 C');
await shot('v3-n2-totemC');
check('N2 tótem C entregado', await G(() => window.__game.ls.delivered.has('tC')));
await goExit(-17.5, 2, 'Claro ámbar');
await deliverAt(0, -14, 'Entregar · 3 D');
check('N2 tótem D entregado', await G(() => window.__game.ls.delivered.has('tD')));
await goExit(-17.5, 2, 'Claro verde');
await bp([['decompose', 'D']]);
await deliverAt(0, -14, 'Entregar · 4 U');
check('N2 victoria (3 tótems)', await G(() => window.__game.won), JSON.stringify(await inv()));
await p.click('[data-act="next"]'); await wait(900);

// ---------- Nivel 3: suma con reparto libre ----------
check('N3 dos tótems de suma', await G(() => window.__game.totems.every((t) => t.isSum)));
await shot('v3-n3-inicio');
await tp(14, 15, 300);
await bp([['decompose', 'D']]);
await tp(-13, 20, 300);
check('N3 burbuja Depositar U', (await bubbleText()) === 'Depositar U', String(await bubbleText()));
await clickBubble();
check('N3 abre ventana de depósito', await G(() => document.querySelector('.dep').classList.contains('show')));
await shot('v3-n3-deposito');
for (let i = 0; i < 12; i++) { if (await p.isEnabled('[data-dep="1"]')) await p.click('[data-dep="1"]'); }
check('N3 el botón + se deshabilita en el tope', !(await p.isEnabled('[data-dep="1"]')));
check('N3 tope de depósito = 7 (deja 1 para la otra orilla)', (await G(() => document.querySelector('[data-dep-n]').textContent)) === '7');
await p.click('[data-dep="-1"]'); await p.click('[data-dep="-1"]');
check('N3 reparto 5 + 3 propuesto', (await G(() => document.querySelector('[data-dep-split]').textContent)).includes('Sur 5'));
await p.click('[data-dep="ok"]'); await wait(300);
check('N3 depositó 5 (quedan 5 U)', (await inv()).U === 5 && (await G(() => window.__game.ls.deposits.tS)) === 5, JSON.stringify(await inv()));
await shot('v3-n3-tras-deposito');
await cross();
await shot('v3-n3-norte');
await tp(11, -17, 300);
await clickBubble();
check('N3 máximo en norte = 3 (completa la suma)', (await G(() => document.querySelector('[data-dep-n]').textContent)) === '3');
await p.click('[data-dep="ok"]'); await wait(400);
check('N3 victoria 5+3', await G(() => window.__game.won), JSON.stringify(await inv()));
await shot('v3-n3-victoria');
await p.click('[data-act="next"]'); await wait(900);

// ---------- Nivel 4: 3 ríos, 6 tótems ----------
check('N4 seis tótems en total', (await G(() => window.__game.ls.totems.length)) === 6);
await tp(14, 14, 200); await tp(-9, 12, 200); await cross(); await tp(-12, -15, 200); await cross();
await goExit(20, 12, 'Río medio');
check('N4 escena r2', (await scene()) === 'r2');
await shot('v3-n4-r2');
await tp(12, 15, 200); await cross(); await tp(-10, -14, 200); await tp(9, -16, 200); await cross();
await goExit(22, 9, 'Río bajo');
check('N4 escena r3', (await scene()) === 'r3');
await tp(14, 14, 200); await cross(); await tp(10, -14, 200);
check('N4 junté D4 U3 C1', JSON.stringify(await inv()) === JSON.stringify({ U: 3, D: 4, C: 1 }), JSON.stringify(await inv()));
await bp([['decompose', 'C'], ['decompose', 'D']]);
await deliverAt(-10, -17, 'Entregar');
await cross();
await deliverAt(-12, 17, 'Entregar');
await goExit(-22, 9, 'Río medio');
await deliverAt(12, 17, 'Entregar');
await cross();
await deliverAt(-12, -17, 'Entregar');
await cross();
await goExit(-22, 9, 'Río alto');
await deliverAt(-13, 17, 'Entregar');
await cross();
await shot('v3-n4-ultimo');
await deliverAt(12, -17, 'Entregar');
check('N4 victoria (6 tótems, 3 ríos)', await G(() => window.__game.won), JSON.stringify(await inv()));
await shot('v3-n4-victoria');
console.log('info', JSON.stringify(await G(() => window.__game.info)));
console.log('errores consola:', errors);
console.log(ok && !errors.length ? '\nTODO OK' : '\nHAY FALLOS');
await b.close();
