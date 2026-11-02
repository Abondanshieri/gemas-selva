// Lógica pura de niveles (utilidades compartidas).
import { TYPES, createInventory } from './gems.js';

export const sumGoals = (goals) => {
  const out = createInventory();
  for (const g of goals) for (const [t, n] of Object.entries(g)) out[t] += n;
  return out;
};

export const levelTotems = (level) => level.scenes.flatMap((s) => s.totems.map((t) => ({ ...t, scene: s.id })));

export const formatGoal = (goal) =>
  TYPES.filter((t) => goal[t] > 0).map((t) => `${goal[t]} ${t}`).join(' + ') || '—';
