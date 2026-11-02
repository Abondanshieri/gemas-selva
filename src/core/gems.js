// Lógica pura de gemas (sin DOM ni Three.js) para poder probarla aislada.
export const TYPES = ['U', 'D', 'C'];
export const RATIO = 10; // 10 U = 1 D, 10 D = 1 C
export const VALUE = { U: 1, D: 10, C: 100 };
const UP = { U: 'D', D: 'C' };
const DOWN = { D: 'U', C: 'D' };

export const createInventory = (partial = {}) => ({ U: 0, D: 0, C: 0, ...partial });

export const totalValue = (inv) => TYPES.reduce((s, t) => s + inv[t] * VALUE[t], 0);

export const canCompose = (inv, type) => type in UP && inv[type] >= RATIO;
export const canDecompose = (inv, type) => type in DOWN && inv[type] >= 1;

export function compose(inv, type) {
  if (!canCompose(inv, type)) throw new Error(`No se puede componer ${type}`);
  return { ...inv, [type]: inv[type] - RATIO, [UP[type]]: inv[UP[type]] + 1 };
}

export function decompose(inv, type) {
  if (!canDecompose(inv, type)) throw new Error(`No se puede descomponer ${type}`);
  return { ...inv, [type]: inv[type] - 1, [DOWN[type]]: inv[DOWN[type]] + RATIO };
}

// El tótem pide cantidades exactas por tipo: hay que mezclar para conseguirlas.
export const canDeliver = (inv, goal) => Object.entries(goal).every(([t, n]) => inv[t] >= n);

export function spend(inv, goal) {
  if (!canDeliver(inv, goal)) throw new Error('Inventario insuficiente');
  const out = { ...inv };
  for (const [t, n] of Object.entries(goal)) out[t] -= n;
  return out;
}
