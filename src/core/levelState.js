// Estado de un nivel: tótems "exactos" (piden cantidades fijas) y grupos de "suma"
// (varios tótems que juntos deben alcanzar un total; el jugador elige el reparto).
import { canDeliver, spend, createInventory } from './gems.js';
import { levelTotems, sumGoals } from './levelLogic.js';

export function createLevelState(level) {
  const totems = levelTotems(level);
  const sums = new Map((level.sums ?? []).map((s) => [s.id, { minEach: 0, ...s }]));
  const delivered = new Set();
  const deposits = Object.fromEntries(totems.filter((t) => t.sum).map((t) => [t.id, 0]));

  const inGroup = (id) => totems.filter((t) => t.sum === id);
  const groupTotal = (id) => inGroup(id).reduce((s, t) => s + deposits[t.id], 0);
  const groupComplete = (id) => {
    const s = sums.get(id);
    return groupTotal(id) === s.total && inGroup(id).every((t) => deposits[t.id] >= s.minEach);
  };
  const isDone = (t) => (t.sum ? groupComplete(t.sum) : delivered.has(t.id));

  // Máximo que se puede depositar en `t` sin dejar sin mínimo a los demás tótems del grupo (evita bloqueos).
  const maxDeposit = (t, inv) => {
    const s = sums.get(t.sum);
    const reserve = inGroup(t.sum).filter((o) => o.id !== t.id).reduce((r, o) => r + Math.max(0, s.minEach - deposits[o.id]), 0);
    return Math.max(0, Math.min(inv[s.type], s.total - groupTotal(t.sum) - reserve));
  };

  return {
    totems, delivered, deposits, sums,
    isSum: (t) => !!t.sum,
    isDone,
    groupTotal, groupComplete,
    sumType: (t) => sums.get(t.sum)?.type,
    canDeliver: (t, inv) => !t.sum && !delivered.has(t.id) && canDeliver(inv, t.goal),
    deliver(t, inv) {
      if (t.sum || delivered.has(t.id)) throw new Error('Tótem no entregable');
      const out = spend(inv, t.goal);
      delivered.add(t.id);
      return out;
    },
    maxDeposit,
    deposit(t, n, inv) {
      if (!t.sum) throw new Error('No es un tótem de suma');
      if (!Number.isInteger(n) || n < 0 || n > maxDeposit(t, inv)) throw new Error('Depósito inválido');
      const s = sums.get(t.sum);
      deposits[t.id] += n;
      return { ...inv, [s.type]: inv[s.type] - n };
    },
    // Lo que aún falta para ganar, sumando todos los tótems del nivel (se muestra en el blueprint).
    remaining() {
      const out = sumGoals(totems.filter((t) => !t.sum && !delivered.has(t.id)).map((t) => t.goal));
      for (const [id, s] of sums) out[s.type] += Math.max(0, s.total - groupTotal(id));
      return out;
    },
    complete: () => totems.every(isDone),
    progress: () => ({ done: totems.filter(isDone).length, total: totems.length }),
    // Resumen para el HUD de una escena.
    // pred (opcional): filtra los tótems que se muestran, p. ej. solo los de la capa actual.
    summary(sceneId, pred = () => true) {
      const here = totems.filter((t) => t.scene === sceneId && pred(t));
      const groups = [...new Set(here.filter((t) => t.sum).map((t) => t.sum))].map((id) => {
        const s = sums.get(id);
        return { id, type: s.type, total: s.total, got: groupTotal(id), done: groupComplete(id),
          parts: inGroup(id).filter(pred).map((t) => ({ short: t.short, n: deposits[t.id] })) };
      });
      return {
        exact: here.filter((t) => !t.sum).map((t) => ({ id: t.id, short: t.short, goal: t.goal, done: delivered.has(t.id) })),
        groups,
        progress: this.progress(),
        scope: { done: here.filter(isDone).length, total: here.length },   // solo lo que se ve (la capa actual)
      };
    },
  };
}

export { createInventory };
