import { TYPES } from '../core/gems.js';

const miniGem = (t) => `<i class="gem gem-${t} mini"></i>`;
const chips = (g) => TYPES.filter((t) => g[t] > 0).map((t) => `<span class="gc">${miniGem(t)}<b class="gn">${g[t]}</b></span>`).join('');
const totemIconSvg = `<svg class="totem-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M7 2h10a2 2 0 0 1 2 2v4a3 3 0 0 1-2 2.8V16a3 3 0 0 1-2 2.8V21a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-2.2A3 3 0 0 1 7 16v-5.2A3 3 0 0 1 5 8V4a2 2 0 0 1 2-2zm2 4a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm6 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm-3 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/></svg>`;

function getActionIcon(kind, size = 20) {
  if (kind === 'totem') {
    return `<svg class="act-svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor" aria-hidden="true"><path d="M7 2h10a2 2 0 0 1 2 2v4a3 3 0 0 1-2 2.8V16a3 3 0 0 1-2 2.8V21a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-2.2A3 3 0 0 1 7 16v-5.2A3 3 0 0 1 5 8V4a2 2 0 0 1 2-2zm2 4a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm6 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm-3 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/></svg>`;
  }
  if (kind === 'pad') {
    return `<svg class="act-svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M5 20c3-1 6-4 7-8s-1-7 2-8 5 1 5 4-2 6-4 7-5 0-6 5"/></svg>`;
  }
  if (kind === 'exit') {
    return `<svg class="act-svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/><path d="M10 12h4m-2-2 2 2-2 2"/></svg>`;
  }
  return `<svg class="act-svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M18 11V6a2 2 0 0 0-4 0v4M14 10V4a2 2 0 0 0-4 0v7M10 10.5V6a2 2 0 0 0-4 0v8c0 4 3 7 7 7s7-3 7-7v-3a2 2 0 0 0-4 0"/></svg>`;
}

function getActionLabel(kind, html) {
  if (kind === 'totem') return html.includes('Depositar') ? 'Depositar' : 'Entregar';
  if (kind === 'pad') return 'Látigo';
  if (kind === 'exit') return 'Viajar';
  return 'Acción';
}

export function createHud(root, { onBlueprint, onInteract, onRestart, onNext, onMenu, onMap }) {
  root.innerHTML = `
    <div class="touch">
      <div class="stick">
        <div class="stick-ring" aria-hidden="true"></div>
        <div class="stick-marks" aria-hidden="true">
          <span class="mark m-n"></span>
          <span class="mark m-e"></span>
          <span class="mark m-s"></span>
          <span class="mark m-w"></span>
        </div>
        <div class="knob">
          <div class="knob-gem" aria-hidden="true"></div>
        </div>
      </div>
    </div>
    <div class="pill inv" aria-label="Inventario de gemas">
      ${TYPES.map((t) => `
        <span class="it it-${t}">
          <span class="gem-slot">${miniGem(t)}</span>
          <b data-inv="${t}">0</b>
        </span>
      `).join('')}
    </div>
    <div class="minimap" aria-hidden="true">
      <div class="minimap-bezel"></div>
      <canvas width="208" height="208"></canvas>
      <div class="minimap-north"></div>
      <div class="minimap-shine"></div>
    </div>
    <div class="layer" aria-live="polite"><span class="lv" data-layer-dots></span><b data-layer-name></b></div>
    <div class="boost" data-boost aria-live="polite"></div>
    <div class="pill goalpill" data-goalpill></div>
    <p class="hint" data-hint></p>
    <div class="topright">
      <button class="hbtn menu" data-act="menu" aria-label="Menú de niveles">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round">
          <line x1="4" y1="7" x2="20" y2="7"></line>
          <line x1="4" y1="12" x2="20" y2="12"></line>
          <line x1="4" y1="17" x2="20" y2="17"></line>
        </svg>
      </button>
      <button class="hbtn menu map" data-act="map" aria-label="Abrir mapa del nivel">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"></path><path d="M9 4v14M15 6v14"></path>
        </svg>
      </button>
      <button class="hbtn mix" data-act="blueprint" aria-label="Abrir mezclador de gemas">
        <span class="mix-icon">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2L3 9l9 13 9-13-9-7z"></path>
            <path d="M3 9h18"></path>
            <path d="M12 2v20"></path>
          </svg>
        </span>
        <span class="mix-text">Mezclar</span>
      </button>
    </div>
    <button class="bubble" data-act="interact" aria-label="Interactuar"></button>
    <button class="action-btn" data-act="interact" aria-label="Acción">
      <span class="action-icon"></span>
      <span class="action-label"></span>
    </button>
    <div class="toast" role="status"></div>
    <div class="dep" role="dialog" aria-label="Depositar gemas">
      <div class="dep-header">
        <h3 data-dep-title></h3>
        <p data-dep-sub></p>
      </div>
      <div class="row">
        <button class="hbtn rb" data-dep="-1" aria-label="Menos">−</button>
        <div class="num"><i class="gem" data-dep-gem></i><span data-dep-n>0</span></div>
        <button class="hbtn rb" data-dep="1" aria-label="Más">+</button>
      </div>
      <div class="acts">
        <button class="hbtn alt" data-dep="cancel">Cancelar</button>
        <button class="hbtn ok" data-dep="ok">Depositar</button>
      </div>
      <div class="split" data-dep-split></div>
    </div>
    <div class="rot">↻ Mejor en horizontal: gira el dispositivo</div>
    <div class="fade"></div>
    <div class="win">
      <div class="win-card">
        <div class="win-trophy" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#f5c542" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
            <path d="M4 22h16"></path>
            <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>
            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path>
            <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
          </svg>
        </div>
        <h2 data-win-title></h2>
        <p data-win-text></p>
        <div class="win-actions">
          <button class="hbtn alt" data-act="restart">Repetir</button>
          <button class="hbtn ok" data-act="next">Siguiente</button>
        </div>
      </div>
    </div>`;

  const $ = (s) => root.querySelector(s);
  const toastEl = $('.toast'), bubbleEl = $('.bubble'), actionBtnEl = $('.action-btn'), fadeEl = $('.fade'), winEl = $('.win'), depEl = $('.dep');
  let toastTimer = 0, bubbleKey = '', dep = null;

  const handleAct = (act, e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    ({ blueprint: onBlueprint, interact: onInteract, restart: onRestart, next: onNext, menu: onMenu, map: onMap })[act]?.();
  };

  // Soporte multitáctil inmediato: responder en pointerdown permite tocar Mezclar o Interactuar mientras se camina con el joystick
  root.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    handleAct(b.dataset.act, e);
  }, { passive: false });

  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (e.detail !== 0) return; // Ya ejecutado en pointerdown
    handleAct(b.dataset.act, e);
  });

  // --- Ventanita de depósito ---
  const depRender = () => {
    $('[data-dep-n]').textContent = dep.n;
    root.querySelector('[data-dep="-1"]').disabled = dep.n <= dep.min;
    root.querySelector('[data-dep="1"]').disabled = dep.n >= dep.max;
    root.querySelector('[data-dep="ok"]').disabled = dep.max < dep.min;
    $('[data-dep-split]').textContent = dep.split(dep.n);
  };

  const handleDep = (b, e) => {
    if (!b || !dep) return;
    e?.preventDefault?.();
    e?.stopPropagation?.();
    const v = b.dataset.dep;
    if (v === 'cancel') return hud.closeDeposit(true);
    if (v === 'ok') { const d = dep; hud.closeDeposit(); return d.onConfirm(d.n); }
    dep.n = Math.min(dep.max, Math.max(dep.min, dep.n + Number(v))); depRender();
  };

  depEl.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('[data-dep]');
    if (!b) return;
    handleDep(b, e);
  }, { passive: false });

  depEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-dep]');
    if (!b) return;
    if (e.detail !== 0) return;
    handleDep(b, e);
  });

  const hud = {
    touchLayer: $('.touch'),
    minimapCanvas: $('.minimap canvas'),
    setInventory(inv) {
      for (const t of TYPES) {
        const el = $(`[data-inv="${t}"]`);
        if (el) el.textContent = inv[t];
      }
    },
    // summary: { exact:[{short,goal,done}], groups:[{type,total,got,parts:[{short,n}],done}], progress:{done,total} }
    setSummary(sm) {
      const multi = (sm.scope ?? sm.progress).total > 1;
      const exact = sm.exact.map((t) => `
        <span class="tt${t.done ? ' done' : ''}">
          ${multi && t.short ? `<small class="t-short">${t.short}</small>` : ''}
          ${chips(t.goal)}
          ${t.done ? '<b class="chk">✓</b>' : ''}
        </span>
      `).join('');
      const groups = sm.groups.map((g) => `
        <span class="tt grp${g.done ? ' done' : ''}">
          <small class="t-sigma">Σ</small>
          <span class="gc sum">${miniGem(g.type)}<b>${g.got}/${g.total}</b></span>
          ${g.done ? '<b class="chk">✓</b>' : ''}
        </span>
      `).join('');
      // El encabezado muestra SOLO lo que pide la capa actual (sm.scope); el panorama global está en el mapa.
      const sc = sm.scope ?? sm.progress;
      const prog = sc.total > 0
        ? `<span class="prog">${totemIconSvg}<b>${sc.done}/${sc.total}</b></span>`
        : `<span class="prog single">${totemIconSvg}</span><small class="t-none">Sin tótems en esta capa</small>`;
      $('[data-goalpill]').innerHTML = prog + groups + exact;
    },
    // Capa actual (pradera / bosque / profundo): nombre + indicador de altura con un punto por capa.
    setLayer(name, index, total) {
      $('[data-layer-name]').textContent = name;
      $('[data-layer-dots]').innerHTML = Array.from({ length: total }, (_, i) => `<i${i === index ? ' class="on"' : ''}></i>`).join('');
    },
    // Ritmo de carrera: porcentaje de velocidad extra (0 = oculto).
    setBoost(pct) {
      const el = $('[data-boost]');
      el.classList.toggle('on', pct > 0);
      el.classList.toggle('max', pct >= 30);
      if (pct > 0) el.textContent = `⚡ +${pct} %`;
    },
    setHint(text) { $('[data-hint]').textContent = text ?? ''; },
    // Burbuja anclada al objeto y botón contextual de acción en esquina inferior derecha
    setBubble(spec) {
      const key = spec ? `${spec.kind}|${spec.html}` : '';
      if (key === bubbleKey) return;
      bubbleKey = key;
      if (!spec) {
        bubbleEl.classList.remove('show');
        actionBtnEl.classList.remove('show');
        return;
      }
      bubbleEl.className = `bubble show t-${spec.kind}`;
      bubbleEl.innerHTML = `<span class="b-icon">${getActionIcon(spec.kind, 18)}</span><span class="b-txt">${spec.html}</span>`;

      actionBtnEl.className = `action-btn show t-${spec.kind}`;
      actionBtnEl.querySelector('.action-icon').innerHTML = getActionIcon(spec.kind, 28);
      actionBtnEl.querySelector('.action-label').textContent = getActionLabel(spec.kind, spec.html);
    },
    placeBubble(x, y) {
      bubbleEl.style.left = `${x.toFixed(1)}px`;
      bubbleEl.style.top = `${y.toFixed(1)}px`;
    },
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
