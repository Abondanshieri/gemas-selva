import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mirror, padsOf, findPad, ease, swingPoint, landsAcross } from './swing.js';

const river = { x: 0, halfWidth: 3.5 };
const anchor = { x: 0, z: 2 };

test('mirror: punto simétrico respecto del ancla', () => {
  assert.deepEqual(mirror({ x: 7.5, z: 3 }, anchor), { x: -7.5, z: 1 });
});

test('padsOf: una zona por orilla, fuera del agua', () => {
  const [o, e] = padsOf(anchor, river);
  assert.equal(o.x, -7.5); assert.equal(e.x, 7.5); assert.equal(o.z, 2);
});

test('findPad detecta cercanía a la zona y nada lejos', () => {
  assert.ok(findPad({ x: 7, z: 2.5 }, [anchor], river));
  assert.equal(findPad({ x: 7, z: 12 }, [anchor], river), null);
});

test('ease: 0→0, 1→1, simétrica', () => {
  assert.equal(ease(0), 0); assert.equal(ease(1), 1);
  assert.ok(Math.abs(ease(0.5) - 0.5) < 1e-9);
});

test('swingPoint: extremos y altura máxima en el centro', () => {
  const p0 = { x: 7, z: 0 }, p1 = { x: -7, z: 0 };
  assert.equal(swingPoint(p0, p1, 0).lift, 0);
  assert.ok(Math.abs(swingPoint(p0, p1, 1).lift) < 1e-9);
  const mid = swingPoint(p0, p1, 0.5);
  assert.ok(Math.abs(mid.x) < 1e-9); assert.ok(mid.lift > 2.5);
});

test('landsAcross: aterrizar en la misma orilla o en el agua no cuenta', () => {
  assert.equal(landsAcross({ x: 7, z: 0 }, { x: -7, z: 0 }, river), true);
  assert.equal(landsAcross({ x: 7, z: 0 }, { x: 2, z: 0 }, river), false);
  assert.equal(landsAcross({ x: 7, z: 0 }, { x: 5, z: 0 }, river), false);
});
