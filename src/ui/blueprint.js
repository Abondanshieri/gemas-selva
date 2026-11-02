import { TYPES, RATIO, createInventory, compose, decompose, canCompose, canDecompose, totalValue } from '../core/gems.js';
import { createStore } from '../core/store.js';

const NAMES = { U: 'Unidad', D: 'Decena', C: 'Centena' };
const ORDER = ['C', 'D', 'U']; // como un número: centenas, decenas, unidades
const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13m-5-6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/**
 * Mezclador de gemas (ventana compacta).
 *  - Dentro del juego: con onClose → ✕ y tocar fuera cierran; se ve el juego detrás.
 *  - Autónomo (blueprint.html): sin onClose → botón de reinicio.
 * Las columnas van en orden C · D · U (valor posicional). Componer = flecha hacia la izquierda.
 */
export function mountBlueprint(root, { forcedLayout = null, store = createStore(createInventory()), goal: initialGoal = {}, onClose = null, resetTo = {} } = {}) {
  const inGame = typeof onClose === 'function';
  let goal = initialGoal;
  let prev = store.get();
  let lastNet = null, actionPending = false;

  const mq = window.matchMedia('(orientation: portrait)');
  const applyLayout = () => {
    const l = forcedLayout ?? (mq.matches ? 'v' : 'h');
    root.classList.toggle('layout-v', l === 'v');
    root.classList.toggle('layout-h', l === 'h');
  };
  applyLayout();
  if (!forcedLayout) mq.addEventListener('change', applyLayout);

  const card = (t) => `
    <section class="card card-${t}" data-type="${t}" aria-label="${NAMES[t]}">
      <div class="gem gem-${t}" aria-hidden="true"></div>
      <div class="meta"><span class="count" data-count="${t}">0</span><span class="name"><b>${t}</b> ${NAMES[t]}</span></div>
    </section>`;
  // Entre dos columnas contiguas (alta ← → baja): ← compone (10 bajas → 1 alta), → descompone (1 alta → 10 bajas).
  const link = (high, low) => `
    <div class="link">
      <button class="btn compose" data-act="compose" data-type="${low}" aria-label="Componer ${RATIO} ${low} en 1 ${high}">
        ${ARROW}<span>${RATIO}→1</span>
      </button>
      <button class="btn decompose" data-act="decompose" data-type="${high}" aria-label="Descomponer 1 ${high} en ${RATIO} ${low}">
        ${ARROW}<span>1→${RATIO}</span>
      </button>
    </div>`;
  const chipsHtml = (g) => Object.entries(g).filter(([, n]) => n > 0).map(([t, n]) =>
    `<span class="chip"><i class="gem gem-${t} mini"></i>${n} ${t}</span>`).join('') || '<span class="goal-label">—</span>';

  root.innerHTML = `
    <section class="bpwin" role="dialog" aria-label="Mezclador de gemas">
      <header class="bp-head">
        <h1>Mezclador</h1>
        <div class="goal"><span class="goal-label">Piden</span><span class="chips" data-chips>${chipsHtml(goal)}</span></div>
        ${inGame
          ? '<button class="btn ghost" data-act="close" aria-label="Cerrar">✕</button>'
          : '<button class="btn ghost" data-act="reset" aria-label="Reiniciar">↺</button>'}
      </header>
      <main class="board">
        ${card('C')}${link('C', 'D')}${card('D')}${link('D', 'U')}${card('U')}
      </main>
      <footer class="bp-foot">
        <div class="sigma" aria-live="polite"><span class="sg">Σ</span><b data-sigma>0</b><small data-eq></small></div>
        <div class="net" data-net aria-live="polite"></div>
      </footer>
    </section>`;

  const $ = (s) => root.querySelector(s);
  const countEls = Object.fromEntries(TYPES.map((t) => [t, $(`[data-count="${t}"]`)]));

  const netHtml = (net) => {
    if (!net) return '<em>Toca una flecha para mezclar</em>';
    const parts = ORDER.filter((t) => net[t] !== 0).map((t) => `<span class="dl ${net[t] > 0 ? 'pos' : 'neg'}">${net[t] > 0 ? '+' : '−'}${Math.abs(net[t])} ${t}</span>`);
    return `${parts.join('')}<em>Σ se conserva</em>`;
  };

  function render() {
    const inv = store.get();
    for (const t of TYPES) {
      countEls[t].textContent = inv[t];
      if (inv[t] !== prev[t]) {
        const c = countEls[t].closest('.card');
        c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump');
      }
    }
    // Cambio neto de la última mezcla (suma de deltas por tipo).
    if (actionPending) {
      lastNet = Object.fromEntries(TYPES.map((t) => [t, inv[t] - prev[t]]));
      actionPending = false;
    }
    prev = inv;
    $('[data-sigma]').textContent = totalValue(inv);
    $('[data-eq]').textContent = ORDER.map((t) => `${inv[t]}${t}`).join(' + ');
    $('[data-net]').innerHTML = netHtml(lastNet);
    root.querySelectorAll('[data-act="compose"]').forEach((b) => (b.disabled = !canCompose(inv, b.dataset.type)));
    root.querySelectorAll('[data-act="decompose"]').forEach((b) => (b.disabled = !canDecompose(inv, b.dataset.type)));
  }

  root.addEventListener('click', (e) => {
    if (inGame && e.target === root) return onClose(); // tocar fuera de la ventana
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const { act, type } = b.dataset;
    if (act === 'compose' || act === 'decompose') {
      actionPending = true;
      store.set(act === 'compose' ? compose(store.get(), type) : decompose(store.get(), type));
    } else if (act === 'close') onClose();
    else if (act === 'reset') { lastNet = null; store.set(createInventory(resetTo)); }
  });
  if (inGame) addEventListener('keydown', (e) => { if (e.key === 'Escape' && !root.closest('[hidden]')) onClose(); });

  store.subscribe(render);
  render();
  return {
    render,
    setGoal(g) { goal = g; $('[data-chips]').innerHTML = chipsHtml(g); },
    clearNet() { lastNet = null; prev = store.get(); render(); },
  };
}
