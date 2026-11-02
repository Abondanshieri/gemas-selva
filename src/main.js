import { createGame } from './game/game.js';
import { createMenu, saveProgress } from './ui/menu.js';
import { LEVELS } from './levels/index.js';

const menuEl = document.getElementById('menu');

const game = createGame({
  canvas: document.getElementById('scene'),
  hudRoot: document.getElementById('hud'),
  overlay: document.getElementById('blueprint-overlay'),
  bpRoot: document.getElementById('blueprint'),
  onWin: (level) => saveProgress(level.id + 1),
  onNext: (level) => startLevel(level.id + 1),
  onMenu: () => menu.show(),
});

function startLevel(id) {
  const level = LEVELS.find((l) => l.id === id);
  if (!level) return menu.show();
  menu.hide();
  game.loadLevel(level);
}

const menu = createMenu(menuEl, LEVELS, startLevel);
menu.show();

// Acceso directo para probar: /?nivel=3
const q = Number(new URLSearchParams(location.search).get('nivel'));
if (q) startLevel(q);

if (import.meta.env.DEV) window.__game = game; // solo para pruebas en desarrollo
