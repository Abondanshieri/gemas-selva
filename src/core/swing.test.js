import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mirror, padsOf, findPad, ease, swingPoint, landsAcross } from './swing.js';

const river = { z: 0, halfWidth: 3.5 };
const anchor = { x: 2, z: 0 };

test('mirror: punto simétrico respecto del ancla', () => {
  assert.deepEqual(mirror({ x: 3, z: 7.5 }, anchor), { x: 1, z: -7.5 });
});

test('padsOf: una zona por orilla, fuera del agua', () => {
  const [n, s] = padsOf(anchor, river);
  assert.equal(n.z, -7.5); assert.equal(s.z, 7.5);
});

test('findPad detecta cercanía a la zona y nada lejos', () => {
  assert.ok(findPad({ x: 2.5, z: 7 }, [anchor], river));
  assert.equal(findPad({ x: 12, z: 7 }, [anchor], river), null);
});

test('ease: 0→0, 1→1, simétrica', () => {
  assert.equal(ease(0), 0); assert.equal(ease(1), 1);
  assert.ok(Math.abs(ease(0.5) - 0.5) < 1e-9);
});

test('swingPoint: extremos y altura máxima en el centro', () => {
  const p0 = { x: 0, z: 7 }, p1 = { x: 0, z: -7 };
  assert.equal(swingPoint(p0, p1, 0).lift, 0);
  assert.ok(Math.abs(swingPoint(p0, p1, 1).lift) < 1e-9);
  const mid = swingPoint(p0, p1, 0.5);
  assert.ok(Math.abs(mid.z) < 1e-9); assert.ok(mid.lift > 2.5);
});

test('landsAcross: aterrizar en la misma orilla o en el agua no cuenta', () => {
  assert.equal(landsAcross({ x: 0, z: 7 }, { x: 0, z: -7 }, river), true);
  assert.equal(landsAcross({ x: 0, z: 7 }, { x: 0, z: 2 }, river), false);
  assert.equal(landsAcross({ x: 0, z: 7 }, { x: 0, z: 5 }, river), false);
});
