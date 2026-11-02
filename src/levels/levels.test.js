import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from './index.js';
import { createInventory, compose, decompose, canCompose, canDecompose, canDeliver, spend } from '../core/gems.js';
import { levelTotems } from '../core/levelLogic.js';
import { padsOf, mirror, landsAcross } from '../core/swing.js';

// Objetivos del nivel: los tótems exactos + cada grupo de suma como un único objetivo (el reparto es libre).
function goalsOf(level) {
  const goals = levelTotems(level).filter((t) => !t.sum).map((t) => t.goal);
  for (const s of level.sums ?? []) goals.push({ [s.type]: s.total });
  return goals;
}

// BFS sobre (inventario, objetivos cumplidos): ¿hay forma de ganar con las gemas disponibles?
function solvable(level, sceneIds = level.scenes.map((s) => s.id)) {
  const inv0 = createInventory(level.start);
  for (const s of level.scenes) if (sceneIds.includes(s.id)) for (const g of s.gems) inv0[g.type]++;
  const goals = goalsOf(level);
  const full = (1 << goals.length) - 1;
  const key = (inv, mask) => `${inv.U},${inv.D},${inv.C},${mask}`;
  const seen = new Set([key(inv0, 0)]);
  const queue = [[inv0, 0]];
  while (queue.length) {
    const [inv, mask] = queue.shift();
    if (mask === full) return true;
    const next = [];
    for (const t of ['U', 'D']) if (canCompose(inv, t)) next.push([compose(inv, t), mask]);
    for (const t of ['D', 'C']) if (canDecompose(inv, t)) next.push([decompose(inv, t), mask]);
    goals.forEach((g, i) => { if (!(mask & (1 << i)) && canDeliver(inv, g)) next.push([spend(inv, g), mask | (1 << i)]); });
    for (const [n, m] of next) { const k = key(n, m); if (!seen.has(k)) { seen.add(k); queue.push([n, m]); } }
  }
  return false;
}

for (const level of LEVELS) {
  test(`nivel ${level.id} (${level.name}) tiene solución`, () => assert.equal(solvable(level), true));
}

test('nivel 1: una sola D en el mapa (hay que descomponer)', () => {
  assert.deepEqual(LEVELS[0].scenes[0].gems.map((g) => g.type), ['D']);
});

test('nivel 2: 3 escenarios, un tótem por tipo U, D y C, y hace falta componer', () => {
  const l = LEVELS[1];
  assert.equal(l.scenes.length, 3);
  const totems = levelTotems(l);
  assert.deepEqual(totems.map((t) => Object.keys(t.goal)[0]).sort(), ['C', 'D', 'U']);
  assert.deepEqual(new Set(totems.map((t) => t.scene)).size, 3, 'un tótem por escena');
  const ds = l.scenes.flatMap((s) => s.gems).filter((g) => g.type === 'D').length;
  assert.ok(ds >= 10, 'para formar la C hacen falta 10 D repartidas por los escenarios');
  // ninguna escena sola alcanza
  for (const s of l.scenes) assert.equal(solvable(l, [s.id]), false, `solo ${s.id}`);
});

test('nivel 3: suma de 8 U repartida entre dos orillas, con cruce posible', () => {
  const l = LEVELS[2], s = l.scenes[0];
  assert.deepEqual(l.sums, [{ id: 'suma', type: 'U', total: 8, minEach: 1 }]);
  assert.deepEqual(s.totems.map((t) => Math.sign(t.pos[1] - s.river.z)).sort(), [-1, 1]);
  assert.ok(s.totems.every((t) => t.sum === 'suma'));
  const a = { x: s.river.anchors[0].x, z: s.river.z };
  for (const pad of padsOf(a, s.river)) assert.ok(landsAcross(pad, mirror(pad, a), s.river));
});

test('nivel 4: 3 escenas de río, cada una con tótem en cada orilla y su aro de balanceo', () => {
  const l = LEVELS[3];
  assert.equal(l.scenes.length, 3);
  for (const s of l.scenes) {
    assert.ok(s.river?.anchors?.length >= 1, `${s.id} sin aro`);
    assert.deepEqual(s.totems.map((t) => Math.sign(t.pos[1] - s.river.z)).sort(), [-1, 1], `${s.id}: un tótem por orilla`);
  }
  assert.equal(levelTotems(l).length, 6);
  // no alcanza con las gemas de las dos primeras escenas: hay que llegar a la tercera
  assert.equal(solvable(l, ['r1', 'r2']), false);
});

test('cada exit apunta a una escena existente y su destino tiene el camino de vuelta', () => {
  for (const l of LEVELS) for (const s of l.scenes) for (const e of s.exits) {
    const dest = l.scenes.find((x) => x.id === e.to);
    assert.ok(dest, `${l.id}/${s.id} → ${e.to}`);
    assert.ok(dest.exits.some((b) => b.to === s.id), `${e.to} no vuelve a ${s.id}`);
    assert.ok(Math.hypot(...e.spawn) <= dest.bounds, `spawn de ${s.id}→${e.to} fuera de límites`);
    if (dest.river) assert.ok(Math.abs(e.spawn[1] - dest.river.z) > dest.river.halfWidth + 1, 'spawn en el agua');
    // el spawn no debe caer dentro del radio de la salida de vuelta (evita rebotes)
    for (const b of dest.exits) assert.ok(Math.hypot(e.spawn[0] - b.pos[0], e.spawn[1] - b.pos[1]) > 3.6, `spawn pegado a la salida ${b.to}`);
  }
});

test('todo cabe dentro de los límites de su escena (tótems, gemas, salidas, spawn)', () => {
  for (const l of LEVELS) for (const s of l.scenes) {
    for (const [x, z] of [s.playerStart, ...s.totems.map((t) => t.pos), ...s.gems.map((g) => g.pos), ...s.exits.map((e) => e.pos)]) {
      assert.ok(Math.hypot(x, z) <= s.bounds, `${l.id}/${s.id}: (${x},${z}) fuera de ${s.bounds}`);
    }
  }
});

test('en escenas con río, ningún tótem/gema/salida cae dentro del agua', () => {
  for (const l of LEVELS) for (const s of l.scenes) if (s.river) {
    for (const [, z] of [...s.totems.map((t) => t.pos), ...s.gems.map((g) => g.pos), ...s.exits.map((e) => e.pos), s.playerStart]) {
      assert.ok(Math.abs(z - s.river.z) > s.river.halfWidth + 1, `${l.id}/${s.id}: z=${z} en el río`);
    }
  }
});
