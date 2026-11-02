import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTerrain, walk, zoneByZ, MAX_SLOPE } from './terrain.js';

const world = {
  radius: 48,
  zones: [
    { id: 'pradera', elevation: 4.5, z1: -16 },
    { id: 'bosque', elevation: 0, z1: 16 },
    { id: 'profundo', elevation: -4.5, z1: 48 },
  ],
  ramps: [{ boundary: 0, x: 18 }, { boundary: 1, x: -18 }],
  rivers: [{ z: 0, halfWidth: 3.5 }],
};
const T = createTerrain(world);

test('zoneByZ: asigna cada z a su capa', () => {
  assert.equal(zoneByZ(world.zones, -30).id, 'pradera');
  assert.equal(zoneByZ(world.zones, 0).id, 'bosque');
  assert.equal(zoneByZ(world.zones, 30).id, 'profundo');
  assert.equal(zoneByZ(world.zones, 999).id, 'profundo');
});

test('las capas están a su altura (pradera arriba, profundo abajo)', () => {
  assert.ok(Math.abs(T.terrace(0, -40) - 4.5) < 1e-6);
  assert.ok(Math.abs(T.terrace(0, 5) - 0) < 1e-6);
  assert.ok(Math.abs(T.terrace(0, 40) + 4.5) < 1e-6);
});

test('rampa: la pendiente a lo largo del corredor se puede caminar', () => {
  for (const [x, zb] of [[18, -16], [-18, 16]]) {
    let worst = 0;
    for (let z = zb - 12; z < zb + 12; z += 0.25) worst = Math.max(worst, Math.abs(T.height(x, z + 0.25) - T.height(x, z)) / 0.25);
    assert.ok(worst <= MAX_SLOPE - 0.1, `rampa x=${x}: pendiente ${worst.toFixed(2)}`);
  }
});

test('acantilado: fuera de la rampa la pendiente es imposible de trepar', () => {
  let worst = 0;
  for (let z = -22; z < -10; z += 0.2) worst = Math.max(worst, Math.abs(T.height(-10, z + 0.2) - T.height(-10, z)) / 0.2);
  assert.ok(worst > 1.2, `pendiente del acantilado ${worst.toFixed(2)}`);
});

// Simula caminar a velocidad real (5.6 m/s a 60 fps) con walk().
function stroll(x, z, dx, dz, steps) {
  const len = Math.hypot(dx, dz), sx = (dx / len) * 0.093, sz = (dz / len) * 0.093;
  for (let i = 0; i < steps; i++) [x, z] = walk(T.height, x, z, sx, sz);
  return [x, z];
}

test('se puede SUBIR por la rampa hasta la pradera', () => {
  const [, z] = stroll(18, -4, 0, -1, 400);   // desde el bosque, hacia el norte, por la rampa
  assert.ok(z < -22, `quedó en z=${z.toFixed(1)}`);
  assert.ok(T.height(18, z) > 3.5);
});

test('NO se puede trepar el acantilado fuera de la rampa', () => {
  const [, z] = stroll(-8, -4, 0, -1, 400);
  assert.ok(z > -17.5, `atravesó el acantilado: z=${z.toFixed(1)}`);
});

test('se puede BAJAR por la rampa al bosque profundo', () => {
  const [, z] = stroll(-18, 8, 0, 1, 400);
  assert.ok(z > 22 && T.height(-18, z) < -3.5, `z=${z.toFixed(1)}`);
});

test('contra el acantilado se desliza en vez de atascarse', () => {
  const [x] = stroll(-8, -14, 1, -1, 60);     // diagonal contra el muro: avanza en x
  assert.ok(x > -6.5);
});

test('el río es un cauce más bajo que sus orillas', () => {
  assert.ok(T.height(0, 0) < T.height(0, 8) - 1.5);
  assert.ok(T.waterY(world.rivers[0]) > T.height(0, 0));   // el agua cubre el fondo
  assert.ok(T.waterY(world.rivers[0]) < T.height(0, 8));   // y queda por debajo de la orilla
});

test('el borde del círculo sube como un cuenco', () => {
  assert.ok(T.height(0, 10) < T.height(0, 56) - 5 || T.height(10, 0) < T.height(58, 0) - 5);
});

test('zoneCoord es continua: 0 en la primera capa, n-1 en la última', () => {
  assert.equal(T.zoneCoord(-40), 0);
  assert.equal(T.zoneCoord(40), 2);
  assert.ok(T.zoneCoord(-16) > 0.4 && T.zoneCoord(-16) < 0.6);
});
