import { TYPES } from '../core/gems.js';

const miniGem = (t) => `<i class="gem gem-${t} mini"></i>`;
const chips = (g) => TYPES.filter((t) => g[t] > 0).map((t) => `<span class="gc">${miniGem(t)}${g[t]} ${t}</span>`).join('');

export function createHud(root, { onBlueprint, onInteract, onRestart, onNext, onMenu }) {
  root.innerHTML = `
    <div class="touch"><div class="stick"><div class="knob"></div></div></div>
    <div class="pill inv">${TYPES.map((t) => `<span class="it">${miniGem(t)}<b data-inv="${t}">0</b></span>`).join('')}</div>
    <div class="minimap" aria-hidden="true"><canvas width="208" height="208"></canvas></div>
    <div class="pill goalpill" data-goalpill></div>
    <p class="hint" data-hint></p>
    <div class="topright">
      <button class="hbtn menu" data-act="menu" aria-label="Menú de niveles">☰</button>
      <button class="hbtn mix" data-act="blueprint" aria-label="Abrir mezclador de gemas">◆ Mezclar</button>
    </div>
    <button class="bubble" data-act="interact"></button>
    <div class="toast" role="status"></div>
    <div class="dep" role="dialog" aria-label="Depositar gemas">
      <h3 data-dep-title></h3><p data-dep-sub></p>
      <div class="row">
        <button class="hbtn rb" data-dep="-1" aria-label="Menos">−</button>
        <div class="num"><i class="gem" data-dep-gem></i><span data-dep-n>0</span></div>
        <button class="hbtn rb" data-dep="1" aria-label="Más">+</button>
      </div>
      <div class="acts"><button class="hbtn alt" data-dep="cancel">Cancelar</button><button class="hbtn ok" data-dep="ok">Depositar</button></div>
      <div class="split" data-dep-split></div>
    </div>
    <div class="rot">↻ Mejor en horizontal: gira el dispositivo</div>
    <div class="fade"></div>
    <div class="win"><div class="win-card"><h2 data-win-title></h2><p data-win-text></p>
      <div class="win-actions"><button class="hbtn alt" data-act="restart">Repetir</button><button class="hbtn" data-act="next">Siguiente</button></div></div></div>`;
  const $ = (s) => root.querySelector(s);
  const toastEl = $('.toast'), bubbleEl = $('.bubble'), fadeEl = $('.fade'), winEl = $('.win'), depEl = $('.dep');
  let toastTimer = 0, bubbleKey = '', dep = null;

  // La burbuja de acción se mueve con la cámara: responde al tocar (pointerdown) para no perder el
  // toque si se desplaza entre pulsar y soltar. El teclado (Enter/Espacio) sigue funcionando vía click.
  bubbleEl.addEventListener('pointerdown', (e) => { e.preventDefault(); onInteract(); });
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'interact' && e.detail !== 0) return; // ya se atendió en pointerdown
    ({ blueprint: onBlueprint, interact: onInteract, restart: onRestart, next: onNext, menu: onMenu })[b.dataset.act]?.();
  });

  // --- Ventanita de depósito ---
  const depRender = () => {
    $('[data-dep-n]').textContent = dep.n;
    root.querySelector('[data-dep="-1"]').disabled = dep.n <= dep.min;
    root.querySelector('[data-dep="1"]').disabled = dep.n >= dep.max;
    root.querySelector('[data-dep="ok"]').disabled = dep.max < dep.min;
    $('[data-dep-split]').textContent = dep.split(dep.n);
  };
  depEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-dep]');
    if (!b || !dep) return;
    const v = b.dataset.dep;
    if (v === 'cancel') return hud.closeDeposit(true);
    if (v === 'ok') { const d = dep; hud.closeDeposit(); return d.onConfirm(d.n); }
    dep.n = Math.min(dep.max, Math.max(dep.min, dep.n + Number(v))); depRender();
  });

  const hud = {
    touchLayer: $('.touch'),
    minimapCanvas: $('.minimap canvas'),
    setInventory(inv) { for (const t of TYPES) $(`[data-inv="${t}"]`).textContent = inv[t]; },
    // summary: { exact:[{short,goal,done}], groups:[{type,total,got,parts:[{short,n}],done}], progress:{done,total} }
    setSummary(sm) {
      const multi = sm.progress.total > 1;
      const exact = sm.exact.map((t) => `<span class="tt${t.done ? ' done' : ''}">${multi ? `<small>${t.short}</small>` : ''}${chips(t.goal)}${t.done ? '<b>✓</b>' : ''}</span>`).join('');
      const groups = sm.groups.map((g) => `<span class="tt grp${g.done ? ' done' : ''}"><small>Σ</small><span class="gc sum">${miniGem(g.type)}${g.got}/${g.total} ${g.type}</span>${g.parts.map((p) => `<small>${p.short} ${p.n}</small>`).join('')}${g.done ? '<b>✓</b>' : ''}</span>`).join('');
      const prog = multi ? `<span class="prog"><small>Tótems</small><b>${sm.progress.done}/${sm.progress.total}</b></span>` : '<small>Tótem</small>';
      $('[data-goalpill]').innerHTML = prog + groups + exact;
    },
    setHint(text) { $('[data-hint]').textContent = text ?? ''; },
    // Burbuja anclada al objeto: se fija una vez el contenido y luego solo se mueve.
    setBubble(spec) {
      const key = spec ? `${spec.kind}|${spec.html}` : '';
      if (key === bubbleKey) return;
      bubbleKey = key;
      if (!spec) { bubbleEl.classList.remove('show'); return; }
      bubbleEl.className = `bubble show t-${spec.kind}`;
      bubbleEl.innerHTML = spec.html;
    },
    placeBubble(x, y) { bubbleEl.style.left = `${x.toFixed(1)}px`; bubbleEl.style.top = `${y.toFixed(1)}px`; },
    toast(msg, ms = 2600) {
      toastEl.textContent = msg; toastEl.classList.add('on');
      clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('on'), ms);
    },
    fade(on) { fadeEl.classList.toggle('on', on); },
    // spec: { title, sub, type, min, max, initial, split(n)→texto, onConfirm(n), onCancel() }
    openDeposit(spec) {
      dep = { ...spec, n: Math.min(spec.max, Math.max(spec.min, spec.initial)) };
      $('[data-dep-title]').textContent = spec.title;
      $('[data-dep-sub]').textContent = spec.sub;
      $('[data-dep-gem]').className = `gem gem-${spec.type}`;
      depEl.classList.add('show'); depRender();
    },
    closeDeposit(cancelled = false) { depEl.classList.remove('show'); const d = dep; dep = null; if (cancelled) d?.onCancel?.(); },
    get depositOpen() { return !!dep; },
    showWin(title, text, hasNext) {
      $('[data-win-title]').textContent = title; $('[data-win-text]').textContent = text;
      root.querySelector('[data-act="next"]').style.display = hasNext ? '' : 'none';
      winEl.classList.add('show');
    },
    hideWin() { winEl.classList.remove('show'); },
  };
  return hud;
}
