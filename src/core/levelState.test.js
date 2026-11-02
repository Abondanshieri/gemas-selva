import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLevelState } from './levelState.js';
import { computePaths, distToSegments } from './paths.js';
import { createInventory } from './gems.js';

const level = {
  sums: [{ id: 'suma', type: 'U', total: 8, minEach: 1 }],
  scenes: [{
    id: 'rio',
    totems: [
      { id: 'a', short: 'Sur', sum: 'suma' },
      { id: 'b', short: 'Norte', sum: 'suma' },
      { id: 'c', short: 'X', goal: { D: 1 } },
    ],
  }],
};
const inv = (o) => createInventory(o);

test('suma: cualquier reparto que llegue a 8 vale (4+4, 5+3, 6+2)', () => {
  for (const [x, y] of [[4, 4], [5, 3], [6, 2], [7, 1]]) {
    const s = createLevelState(level);
    let i = inv({ U: 20 });
    i = s.deposit(s.totems[0], x, i);
    i = s.deposit(s.totems[1], y, i);
    assert.equal(s.groupComplete('suma'), true, `${x}+${y}`);
    assert.equal(i.U, 20 - 8);
  }
});

test('suma: no se puede pasar del total ni dejar a la otra orilla sin su mínimo', () => {
  const s = createLevelState(level);
  assert.equal(s.maxDeposit(s.totems[0], inv({ U: 20 })), 7); // 8 − 1 reservado para el otro tótem
  s.deposit(s.totems[0], 7, inv({ U: 20 }));
  assert.equal(s.maxDeposit(s.totems[0], inv({ U: 20 })), 0);
  assert.equal(s.maxDeposit(s.totems[1], inv({ U: 20 })), 1);
  assert.throws(() => s.deposit(s.totems[1], 2, inv({ U: 20 })));
});

test('suma: el máximo también está limitado por lo que llevas', () => {
  const s = createLevelState(level);
  assert.equal(s.maxDeposit(s.totems[0], inv({ U: 3 })), 3);
  assert.equal(s.maxDeposit(s.totems[0], inv({ U: 0 })), 0);
});

test('suma: con 8 en un solo tótem NO se completa', () => {
  const s = createLevelState({ ...level, sums: [{ ...level.sums[0], minEach: 0 }] });
  s.deposit(s.totems[0], 8, inv({ U: 8 }));
  assert.equal(s.groupComplete('suma'), true); // con minEach 0 sí; con 1 no se puede ni intentar (abajo)
  const t = createLevelState(level);
  assert.throws(() => t.deposit(t.totems[0], 8, inv({ U: 8 })));
});

test('tótem exacto: entrega y conserva sobrante', () => {
  const s = createLevelState(level);
  assert.equal(s.canDeliver(s.totems[2], inv({ D: 0 })), false);
  const out = s.deliver(s.totems[2], inv({ D: 3 }));
  assert.equal(out.D, 2);
  assert.equal(s.isDone(s.totems[2]), true);
  assert.equal(s.canDeliver(s.totems[2], inv({ D: 3 })), false); // ya entregado
});

test('remaining y complete combinan exactos y sumas', () => {
  const s = createLevelState(level);
  assert.deepEqual(s.remaining(), { U: 8, D: 1, C: 0 });
  assert.equal(s.complete(), false);
  let i = inv({ U: 8, D: 1 });
  i = s.deposit(s.totems[0], 5, i);
  assert.deepEqual(s.remaining(), { U: 3, D: 1, C: 0 });
  i = s.deposit(s.totems[1], 3, i);
  i = s.deliver(s.totems[2], i);
  assert.equal(s.complete(), true);
  assert.deepEqual(s.remaining(), { U: 0, D: 0, C: 0 });
  assert.deepEqual(s.progress(), { done: 3, total: 3 });
});

test('summary: resume exactos, grupos y partes', () => {
  const s = createLevelState(level);
  s.deposit(s.totems[0], 5, inv({ U: 9 }));
  const m = s.summary('rio');
  assert.equal(m.groups[0].got, 5);
  assert.deepEqual(m.groups[0].parts, [{ short: 'Sur', n: 5 }, { short: 'Norte', n: 0 }]);
  assert.equal(m.exact.length, 1);
});

const river = { z: 0, halfWidth: 3.5, anchors: [{ x: 0 }] };
test('senderos: en escenas con río ninguno cruza el agua y todos terminan en un aro', () => {
  const def = { playerStart: [-3, 14], totems: [{ pos: [-15, 18] }, { pos: [13, -19] }], exits: [], gems: [{ pos: [14, 15] }, { pos: [-12, -15] }], river };
  const segs = computePaths(def);
  assert.ok(segs.length >= 5);
  for (const [, z1, , z2] of segs) assert.ok(Math.sign(z1) === Math.sign(z2) || z1 === 0 || z2 === 0, 'cruza el río');
  assert.ok(segs.every(([x1, z1]) => Math.abs(z1) === 7.5 && x1 === 0));
});

test('senderos: sin río salen del punto de inicio', () => {
  const def = { playerStart: [0, 5], totems: [{ pos: [0, -10] }], exits: [], gems: [{ pos: [4, 0] }] };
  assert.deepEqual(computePaths(def), [[0, 5, 0, -10], [0, 5, 4, 0]]);
});

test('distToSegments', () => {
  const segs = [[0, 0, 10, 0]];
  assert.equal(distToSegments(5, 3, segs), 3);
  assert.equal(distToSegments(-4, 3, segs), 5);
});
