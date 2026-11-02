import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInventory, compose, decompose, totalValue, canCompose, canDecompose, canDeliver } from './gems.js';

test('totalValue: U=1, D=10, C=100', () => {
  assert.equal(totalValue({ U: 3, D: 2, C: 1 }), 123);
});

test('compose: 10 U -> 1 D', () => {
  const r = compose({ U: 12, D: 0, C: 0 }, 'U');
  assert.deepEqual(r, { U: 2, D: 1, C: 0 });
});

test('compose: 10 D -> 1 C', () => {
  assert.deepEqual(compose({ U: 0, D: 10, C: 0 }, 'D'), { U: 0, D: 0, C: 1 });
});

test('compose falla sin suficientes gemas', () => {
  assert.equal(canCompose({ U: 9, D: 0, C: 0 }, 'U'), false);
  assert.throws(() => compose({ U: 9, D: 0, C: 0 }, 'U'));
});

test('C no se puede componer (no hay tipo superior)', () => {
  assert.equal(canCompose({ U: 0, D: 0, C: 99 }, 'C'), false);
});

test('decompose: 1 D -> 10 U', () => {
  assert.deepEqual(decompose({ U: 0, D: 1, C: 0 }, 'D'), { U: 10, D: 0, C: 0 });
});

test('decompose: 1 C -> 10 D', () => {
  assert.deepEqual(decompose({ U: 0, D: 0, C: 1 }, 'C'), { U: 0, D: 10, C: 0 });
});

test('U no se puede descomponer', () => {
  assert.equal(canDecompose({ U: 5, D: 0, C: 0 }, 'U'), false);
  assert.throws(() => decompose({ U: 5, D: 0, C: 0 }, 'U'));
});

test('las operaciones no mutan el inventario original', () => {
  const inv = { U: 10, D: 0, C: 0 };
  compose(inv, 'U');
  assert.deepEqual(inv, { U: 10, D: 0, C: 0 });
});

test('conservan el valor total', () => {
  const inv = { U: 23, D: 4, C: 1 };
  assert.equal(totalValue(compose(inv, 'U')), totalValue(inv));
  assert.equal(totalValue(decompose(inv, 'C')), totalValue(inv));
});

test('canDeliver: exige cantidad exacta de ese tipo (no equivale por valor)', () => {
  assert.equal(canDeliver({ U: 5, D: 0, C: 0 }, { U: 5 }), true);
  assert.equal(canDeliver({ U: 0, D: 1, C: 0 }, { U: 5 }), false);
  assert.equal(canDeliver({ U: 5, D: 1, C: 0 }, { U: 5, D: 1 }), true);
});

test('createInventory rellena con ceros', () => {
  assert.deepEqual(createInventory({ D: 1 }), { U: 0, D: 1, C: 0 });
});

import { spend } from './gems.js';

test('spend: descuenta lo entregado y conserva el sobrante', () => {
  assert.deepEqual(spend({ U: 10, D: 0, C: 0 }, { U: 5 }), { U: 5, D: 0, C: 0 });
  assert.throws(() => spend({ U: 4, D: 0, C: 0 }, { U: 5 }));
});
