// Entrada unificada: joystick flotante (izquierda), arrastre de cámara (derecha) y teclado.
export function createInput(layer, { onInteract, onBlueprint }) {
  const state = { x: 0, y: 0, lookX: 0, lookY: 0 };
  const keys = new Set();
  const stick = layer.querySelector('.stick'), knob = layer.querySelector('.knob');
  const R = 52;
  let stickId = null, lookId = null, origin = null, last = null;

  layer.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    const leftSide = e.clientX < innerWidth * 0.45 && e.pointerType !== 'mouse';
    layer.setPointerCapture?.(e.pointerId);
    if (leftSide && stickId === null) {
      stickId = e.pointerId; origin = { x: e.clientX, y: e.clientY };
      stick.style.transform = `translate(${origin.x - R}px, ${origin.y - R}px)`;
      stick.classList.add('on'); knob.style.transform = 'translate(0,0)';
    } else if (lookId === null) {
      lookId = e.pointerId; last = { x: e.clientX, y: e.clientY };
    }
  });
  layer.addEventListener('pointermove', (e) => {
    if (e.pointerId === stickId) {
      let dx = e.clientX - origin.x, dy = e.clientY - origin.y;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx = dx / d * R; dy = dy / d * R; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      state.x = dx / R; state.y = -dy / R;
    } else if (e.pointerId === lookId) {
      state.lookX += e.clientX - last.x; state.lookY += e.clientY - last.y;
      last = { x: e.clientX, y: e.clientY };
    }
  });
  const end = (e) => {
    if (e.pointerId === stickId) { stickId = null; state.x = state.y = 0; stick.classList.remove('on'); }
    if (e.pointerId === lookId) lookId = null;
  };
  layer.addEventListener('pointerup', end);
  layer.addEventListener('pointercancel', end);

  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === 'e' || k === 'enter') onInteract();
    else if (k === 'b' || k === 'tab') { e.preventDefault(); onBlueprint(); }
    else keys.add(k);
  });
  addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => keys.clear());

  return {
    // Devuelve el vector de movimiento combinado (joystick + teclado) y consume el delta de cámara.
    read() {
      let kx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
      let ky = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
      let x = state.x + kx, y = state.y + ky;
      const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
      const out = { x, y, lookX: state.lookX, lookY: state.lookY };
      state.lookX = state.lookY = 0;
      return out;
    },
    reset() { state.x = state.y = state.lookX = state.lookY = 0; keys.clear(); stickId = lookId = null; stick.classList.remove('on'); },
  };
}
