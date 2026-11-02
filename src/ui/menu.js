const KEY = 'gemas-selva:desbloqueado';

// Progreso en localStorage (puede fallar en modo privado: nunca debe romper el juego).
export const loadProgress = () => {
  try { return Math.max(1, Number(localStorage.getItem(KEY)) || 1); } catch { return 1; }
};
export const saveProgress = (n) => {
  try { localStorage.setItem(KEY, String(Math.max(loadProgress(), n))); } catch { /* sin persistencia */ }
};

export function createMenu(root, levels, onPick) {
  function render() {
    const unlocked = loadProgress();
    root.innerHTML = `
      <div class="menu-wrap">
        <h1>Gemas de la Selva</h1>
        <p class="menu-sub">Mezcla gemas para activar los tótems</p>
        <div class="levels">
          ${levels.map((l) => {
            const locked = l.id > unlocked;
            return `<button class="lvl${locked ? ' locked' : ''}" data-id="${l.id}" ${locked ? 'disabled' : ''} aria-label="Nivel ${l.id}: ${l.name}${locked ? ' (bloqueado)' : ''}">
              <span class="num">${locked ? '🔒' : l.id}</span>
              <span class="nm">${l.name}</span>
              <span class="tp">${l.topic}</span>
            </button>`;
          }).join('')}
        </div>
      </div>`;
  }
  root.addEventListener('click', (e) => {
    const b = e.target.closest('.lvl');
    if (b && !b.disabled) onPick(Number(b.dataset.id));
  });
  render();
  return {
    show() { render(); root.hidden = false; },
    hide() { root.hidden = true; },
  };
}
