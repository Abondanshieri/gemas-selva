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

test('suma: con minEach 1 no se puede pasar del total ni dejar a la otra orilla sin su mínimo', () => {
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

test('suma con 0: minEach por defecto es 0 y permite 8+0 y 0+8', () => {
  const levelZero = {
    sums: [{ id: 'suma', type: 'U', total: 8 }], // minEach por defecto es 0
    scenes: level.scenes,
  };
  // minEach por defecto verificado
  const sDef = createLevelState(levelZero);
  assert.equal(sDef.sums.get('suma').minEach, 0);
  assert.equal(sDef.maxDeposit(sDef.totems[0], inv({ U: 8 })), 8);

  // 8 + 0 depositando solo en el primero
  const s1 = createLevelState(levelZero);
  const i1 = s1.deposit(s1.totems[0], 8, inv({ U: 8 }));
  assert.equal(s1.groupComplete('suma'), true);
  assert.equal(s1.isDone(s1.totems[0]), true);
  assert.equal(s1.isDone(s1.totems[1]), true);
  assert.equal(i1.U, 0);

  // 0 + 8 depositando solo en el segundo
  const s2 = createLevelState(levelZero);
  const i2 = s2.deposit(s2.totems[1], 8, inv({ U: 8 }));
  assert.equal(s2.groupComplete('suma'), true);
  assert.equal(s2.isDone(s2.totems[0]), true);
  assert.equal(s2.isDone(s2.totems[1]), true);
  assert.equal(i2.U, 0);

  // Depósito explícito de 0 es válido y no produce error
  const s3 = createLevelState(levelZero);
  const i3 = s3.deposit(s3.totems[0], 0, inv({ U: 5 }));
  assert.equal(i3.U, 5);
  assert.equal(s3.deposits[s3.totems[0].id], 0);

  // Depósito negativo es inválido
  assert.throws(() => s3.deposit(s3.totems[0], -1, inv({ U: 5 })), /Depósito inválido/);

  // Si el nivel fija minEach: 1, 8 en un solo tótem no se permite
  const t = createLevelState(level);
  assert.throws(() => t.deposit(t.totems[0], 8, inv({ U: 8 })), /Depósito inválido/);
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

test('summary con filtro: solo muestra los tótems que pasan el filtro y su alcance', () => {
  const s = createLevelState(level);
  const m = s.summary('rio', (t) => t.short === 'Sur');
  assert.deepEqual(m.groups[0].parts, [{ short: 'Sur', n: 0 }]);
  assert.equal(m.exact.length, 0);
  assert.deepEqual(m.scope, { done: 0, total: 1 });
  assert.equal(m.progress.total, 3, 'el progreso global no se filtra');
  assert.deepEqual(s.summary('rio', () => false).scope, { done: 0, total: 0 });
});

test('summary: resume exactos, grupos y partes', () => {
  const s = createLevelState(level);
  s.deposit(s.totems[0], 5, inv({ U: 9 }));
  const m = s.summary('rio');
  assert.equal(m.groups[0].got, 5);
  assert.deepEqual(m.groups[0].parts, [{ short: 'Sur', n: 5 }, { short: 'Norte', n: 0 }]);
  assert.equal(m.exact.length, 1);
});

const zones2 = [{ id: 'a', z1: -4, elevation: 4 }, { id: 'b', z1: 40, elevation: 0 }];

test('senderos: sin río salen del inicio y, para subir de capa, pasan por la rampa', () => {
  const def = { playerStart: [0, 12], zones: zones2, ramps: [{ boundary: 0, x: 12 }], rivers: [], totems: [{ pos: [-10, 18] }], gems: [{ pos: [6, -20] }] };
  const segs = computePaths(def);
  assert.ok(segs.some(([x1, , x2]) => x1 === 12 && x2 === 12), 'hay un tramo sobre la rampa');
  assert.ok(!segs.some(([x1, z1, x2, z2]) => !(x1 === 12 && x2 === 12) && z1 > 0 && z2 < -10), 'ningún sendero atraviesa el acantilado');
  assert.ok(segs.some(([x1, z1]) => x1 === 0 && z1 === 12), 'salen del inicio');
});

test('senderos: con río norte-sur, cada orilla tiene su red y el aro une ambas sin dejar sendero sobre el agua', () => {
  const river = { x: 0, halfWidth: 3.5, anchors: [{ z: 0 }] };
  const def = { playerStart: [10, -4], zones: [{ id: 'a', z1: 99, elevation: 0 }], ramps: [], rivers: [river], totems: [{ pos: [11, 9] }], gems: [{ pos: [-9, -12] }] };
  const segs = computePaths(def);
  assert.ok(segs.length >= 2);
  for (const [x1, , x2] of segs) assert.ok(Math.sign(x1) === Math.sign(x2), 'un sendero cruza el río');
  assert.ok(segs.some(([x1, z1]) => Math.abs(x1) === 7.5 && z1 === 0), 'los senderos llegan a un aro');
});

test('distToSegments', () => {
  const segs = [[0, 0, 10, 0]];
  assert.equal(distToSegments(5, 3, segs), 3);
  assert.equal(distToSegments(-4, 3, segs), 5);
});
