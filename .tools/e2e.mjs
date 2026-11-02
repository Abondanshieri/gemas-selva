// E2E del mundo por capas: camina de verdad por las rampas (teclado), se balancea con el látigo
// y recorre los 4 niveles. Requiere el servidor de desarrollo en :5173.
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true });
const errors = [];
p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) { errors.push(m.type() + ': ' + m.text()); console.log('[console]', m.type(), m.text()); } });
p.on('pageerror', (e) => { errors.push('pageerror: ' + e); console.log('[pageerror]', String(e)); });
p.on('framenavigated', (f) => f === p.mainFrame() && console.log('[navegó]', f.url()));
p.on('crash', () => console.log('[CRASH de la pestaña]'));
p.on('close', () => console.log('[pestaña cerrada]'));
p.on('requestfailed', (r) => console.log('[requestfailed]', r.url().slice(-60)));
const shot = (n) => p.screenshot({ path: `../docs/${n}.png` });
const G = (fn, ...a) => p.evaluate(fn, ...a);
const inv = () => G(() => window.__game.store.get());
const wait = (ms) => p.waitForTimeout(ms);
let ok = true;
const check = (name, cond, extra = '') => { if (!cond) ok = false; console.log(cond ? 'OK  ' : 'FAIL', name, extra); };

const tp = async (x, z, ms = 220, yaw, pitch) => { await G(([x, z, y, pt]) => { window.__game.teleport(x, z); if (y !== undefined) window.__game.aim(y, pt); }, [x, z, yaw, pitch]); await wait(ms); };
const until = async (fn, ms = 9000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await wait(100); } return false; };
const bubbleText = () => G(() => { const e = document.querySelector('.bubble.show'); return e ? e.textContent.trim() : null; });
const clickBubble = async () => { await p.click('.bubble.show', { force: true }); await wait(350); };
const bp = async (steps) => {
  await p.click('[data-act="blueprint"]'); await wait(250);
  for (const [a, t] of steps) await p.click(`#blueprint [data-act="${a}"][data-type="${t}"]`);
  await p.click('#blueprint [data-act="close"]'); await wait(250);
};
const collectAll = async (filter = () => true) => { const l = await G(() => window.__game.gems.map((g) => [g.x, g.z])); for (const [x, z] of l.filter(([a, c]) => filter(a, c))) await tp(x, z, 300); };
const layer = () => G(() => window.__game.layer);
const where = () => G(() => ({ x: +window.__game.pos.x.toFixed(1), y: +window.__game.pos.y.toFixed(2), z: +window.__game.pos.z.toFixed(1), layer: window.__game.layer }));
const deliverAt = async (x, z, expect) => { await tp(x, z, 100); await until(async () => (await bubbleText())?.startsWith(expect)); const t = await bubbleText(); check(`burbuja en tótem: ${expect}`, t?.startsWith(expect), String(t)); await clickBubble(); };

// Camina de verdad (tecla W) hacia el norte (yaw 0) o hacia el sur (yaw π).
const walk = async (x, z, north, ms, goal) => {
  await tp(x, z, 150, north ? 0 : Math.PI, 0.8);
  await p.keyboard.down('w');
  if (goal === undefined) await wait(ms);
  else { // camina hasta estar de verdad en la capa destino (a su altura), con un tope de tiempo
    const arrived = () => G((g) => { const w = window.__game, e = w.world.terrain.zoneAt(w.pos.z).elevation; return w.layer === g && Math.abs(w.pos.y - e) < 0.5; }, goal);
    await until(arrived, ms * 4);
  }
  await p.keyboard.up('w'); await wait(250);
};
// Cruza un río con el látigo desde el aro de la orilla `side` (-1 norte, 1 sur).
const cross = async (riverZ, side) => {
  await tp(0, riverZ + 7.5 * side, 100);
  await until(async () => (await bubbleText()) === 'Látigo');
  check(`aro del río z=${riverZ}: burbuja Látigo`, (await bubbleText()) === 'Látigo');
  await clickBubble();
  for (let i = 0; i < 120; i++) { await wait(150); if (!(await G(() => window.__game.swinging)) && i > 3) break; }
  const z = await G(() => window.__game.pos.z);
  check(`cruzó el río z=${riverZ}`, Math.sign(z - riverZ) === -side, `z=${z.toFixed(1)}`);
};

const ONLY = process.env.ONLY ? Number(process.env.ONLY) : 0;
const run = (n) => !ONLY || ONLY === n;

// ---------- Menú ----------
await p.goto(ONLY ? `http://localhost:5173/?nivel=${ONLY}` : 'http://localhost:5173/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__game); await wait(300);
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: 'networkidle' }); await p.waitForFunction(() => window.__game); await wait(300);
if (!ONLY) {
  check('menú: solo nivel 1 desbloqueado', (await G(() => document.querySelectorAll('.lvl:not(.locked)').length)) === 1);
  await p.click('.lvl[data-id="1"]');
}
await wait(900);

// ---------- Nivel 1: dos capas ----------
if (run(1)) {
await shot('v4-n1-inicio');
check('N1 empieza en el bosque (capa 1)', (await layer()) === 1);
// El acantilado no se trepa: hacia el norte, lejos de la rampa, el jugador se detiene al pie.
await walk(-10, 12, true, 4500);
let w = await where();
check('N1 el acantilado bloquea (sigue en el bosque, z > -4)', w.layer === 1 && w.z > -4.5, JSON.stringify(w));
await shot('v4-n1-acantilado');
// Por la rampa sí se sube.
await walk(12, 10, true, 4200, 0);
w = await where();
check('N1 sube por la rampa a la pradera', w.layer === 0 && w.y > 3.5, JSON.stringify(w));
await shot('v4-n1-pradera');
await collectAll();
check('N1 recogió la D en la pradera', (await inv()).D === 1);
await walk(12, -12, false, 4200, 1);
w = await where();
check('N1 baja por la rampa al bosque', w.layer === 1 && w.y < 1, JSON.stringify(w));
await bp([['decompose', 'D']]);
check('N1 Σ conservada (10 U)', (await inv()).U === 10);
await deliverAt(-12 + 2, 18 + 2, 'Entregar');
await shot('v4-n1-burbuja');
check('N1 victoria', await G(() => window.__game.won), JSON.stringify(await inv()));
await p.click('[data-act="next"]'); await wait(900);

}
// ---------- Nivel 2: tres capas, tótems C (arriba), D (medio), U (abajo) ----------
if (run(2)) {
const L2 = { up0: [18, -8], down0: [18, -26], up1: [-18, 8], down1: [-18, 28] };
check('N2 empieza en el bosque', (await layer()) === 1);
await shot('v4-n2-inicio');
await collectAll((x, z) => z > -16 && z < 16);           // gemas del bosque
check('N2 bosque: 5 D', (await inv()).D === 5, JSON.stringify(await inv()));
await deliverAt(2, 2, 'Entregar · 3 D');
check('N2 tótem D entregado', await G(() => window.__game.ls.delivered.has('tD')));
await walk(...L2.up0, true, 4300, 0);
check('N2 sube a la pradera por la rampa', (await layer()) === 0, JSON.stringify(await where()));
await shot('v4-n2-pradera');
await collectAll((x, z) => z < -16);
await walk(...L2.down0, false, 4300, 1);
check('N2 baja al bosque', (await layer()) === 1, JSON.stringify(await where()));
await walk(...L2.up1, false, 4300, 2);
check('N2 baja al bosque profundo', (await layer()) === 2, JSON.stringify(await where()));
await shot('v4-n2-profundo');
await collectAll((x, z) => z > 16);
check('N2 llevo 11 D y 2 U', (await inv()).D === 11 && (await inv()).U === 2, JSON.stringify(await inv()));
await bp([['compose', 'D']]);
check('N2 compuse C', (await inv()).C === 1, JSON.stringify(await inv()));
await bp([['decompose', 'D']]);
await deliverAt(2, 34, 'Entregar · 4 U');
check('N2 tótem U entregado (profundo)', await G(() => window.__game.ls.delivered.has('tU')));
await walk(...L2.down1, true, 4300, 1);
check('N2 sube al bosque', (await layer()) === 1, JSON.stringify(await where()));
await walk(...L2.up0, true, 4300, 0);
check('N2 sube a la pradera', (await layer()) === 0, JSON.stringify(await where()));
await deliverAt(2, -28, 'Entregar · 1 C');
await shot('v4-n2-totemC');
check('N2 victoria (3 tótems, 3 capas)', await G(() => window.__game.won), JSON.stringify(await inv()));
await p.click('[data-act="next"]'); await wait(900);

}
// ---------- Nivel 3: río en el bosque, suma con reparto libre, D abajo ----------
if (run(3)) {
check('N3 dos tótems de suma', await G(() => window.__game.totems.every((t) => t.isSum)));
await shot('v4-n3-inicio');
await walk(18, -8, true, 4300, 0);                          // pradera: 2 U
check('N3 sube a la pradera', (await layer()) === 0);
await collectAll((x, z) => z < -16);
await walk(18, -26, false, 4300, 1);                        // de vuelta a la orilla norte
await collectAll((x, z) => z > -16 && z < 0);
check('N3 llevo 3 U', (await inv()).U === 3, JSON.stringify(await inv()));
await cross(0, -1);                                      // norte → sur
await shot('v4-n3-sur');
await walk(-18, 8, false, 4300, 2);                         // rampa al bosque profundo
check('N3 baja al bosque profundo', (await layer()) === 2, JSON.stringify(await where()));
await collectAll((x, z) => z > 16);
check('N3 con la D: U3 D1', JSON.stringify(await inv()) === JSON.stringify({ U: 3, D: 1, C: 0 }), JSON.stringify(await inv()));
await bp([['decompose', 'D']]);
check('N3 descompuse: 13 U', (await inv()).U === 13, JSON.stringify(await inv()));
await walk(-18, 28, true, 4300, 1);
check('N3 sube a la orilla sur', (await layer()) === 1, JSON.stringify(await where()));
await tp(10 + 2, 11 + 1, 300);
check('N3 burbuja Depositar U', (await bubbleText()) === 'Depositar U', String(await bubbleText()));
await clickBubble();
check('N3 abre ventana de depósito', await G(() => document.querySelector('.dep').classList.contains('show')));
await shot('v4-n3-deposito');
for (let i = 0; i < 14; i++) { if (await p.isEnabled('[data-dep="1"]')) await p.click('[data-dep="1"]'); }
check('N3 el botón + se deshabilita en el tope', !(await p.isEnabled('[data-dep="1"]')));
check('N3 tope de depósito = 7 (deja 1 para la otra orilla)', (await G(() => document.querySelector('[data-dep-n]').textContent)) === '7');
await p.click('[data-dep="-1"]'); await p.click('[data-dep="-1"]');
check('N3 reparto 5 + 3 propuesto', (await G(() => document.querySelector('[data-dep-split]').textContent)).includes('Sur 5'));
await p.click('[data-dep="ok"]'); await wait(300);
check('N3 depositó 5 (quedan 8 U)', (await inv()).U === 8 && (await G(() => window.__game.ls.deposits.tS)) === 5, JSON.stringify(await inv()));
await cross(0, 1);                                       // sur → norte
await tp(-12 + 2, -10 + 1, 300);
await clickBubble();
check('N3 máximo en norte = 3 (completa la suma)', (await G(() => document.querySelector('[data-dep-n]').textContent)) === '3');
await p.click('[data-dep="ok"]'); await wait(400);
check('N3 victoria 5+3', await G(() => window.__game.won), JSON.stringify(await inv()));
await shot('v4-n3-victoria');
await p.click('[data-act="next"]'); await wait(900);

}
// ---------- Nivel 4: tres capas, tres ríos, seis tótems ----------
if (run(4)) {
check('N4 seis tótems en total', (await G(() => window.__game.ls.totems.length)) === 6);
await shot('v4-n4-inicio');
await collectAll((x, z) => z > -16 && z < 0);            // bosque norte: 2 U
await deliverAt(-12 + 2, -11 + 2, 'Entregar');           // bN: U2
await walk(20, -8, true, 4300, 0);
check('N4 sube a la pradera (orilla sur)', (await layer()) === 0, JSON.stringify(await where()));
await collectAll((x, z) => z < -16 && z > -36);          // 2 D
await cross(-38, 1);                                     // río de la pradera: sur → norte
await collectAll((x, z) => z < -40);                     // U
await deliverAt(8 - 2, -47 + 2, 'Entregar');             // pN: D2
await shot('v4-n4-pradera-norte');
await cross(-38, -1);                                    // de vuelta al sur
await walk(20, -26, false, 4300, 1);                        // baja al bosque (orilla norte)
check('N4 baja al bosque', (await layer()) === 1, JSON.stringify(await where()));
await cross(0, -1);                                      // río del bosque: norte → sur
await collectAll((x, z) => z > 6 && z < 16);             // D
await walk(-20, 8, false, 4300, 2);
check('N4 baja al bosque profundo (orilla norte)', (await layer()) === 2, JSON.stringify(await where()));
await collectAll((x, z) => z > 16 && z < 36);            // C
check('N4 junté U1 D1 C1', JSON.stringify(await inv()) === JSON.stringify({ U: 1, D: 1, C: 1 }), JSON.stringify(await inv()));
await deliverAt(12 - 2, 26 + 2, 'Entregar');             // dN: U1 + D1
await cross(38, -1);                                     // río profundo: norte → sur
await collectAll((x, z) => z > 40);                      // D
await bp([['decompose', 'C']]);
await deliverAt(-10 + 2, 47 - 2, 'Entregar');            // dS: D3
await shot('v4-n4-profundo-sur');
await bp([['decompose', 'D']]);
await cross(38, 1);                                      // de vuelta al norte del profundo
await walk(-20, 28, true, 4300, 1);
check('N4 sube al bosque (orilla sur)', (await layer()) === 1, JSON.stringify(await where()));
await deliverAt(12 - 2, 12 + 2, 'Entregar');             // bS: D1 + U2
await cross(0, 1);                                       // sur → norte
await walk(20, -8, true, 4300, 0);
check('N4 sube a la pradera otra vez', (await layer()) === 0, JSON.stringify(await where()));
await shot('v4-n4-ultimo');
await deliverAt(-14 + 2, -25 + 2, 'Entregar');           // pS: U3
check('N4 victoria (6 tótems, 3 capas, 3 ríos)', await G(() => window.__game.won), JSON.stringify(await inv()));
await shot('v4-n4-victoria');
}
console.log('info', JSON.stringify(await G(() => window.__game.info)));
console.log('errores consola:', errors);
console.log(ok && !errors.length ? '\nTODO OK' : '\nHAY FALLOS');
await b.close();
