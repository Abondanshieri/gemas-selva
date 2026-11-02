// Entrada unificada: joystick dinámico flotante (mitad inferior izquierda), arrastre de cámara y teclado.
export function createInput(layer, { onInteract, onBlueprint }) {
  const state = { x: 0, y: 0, lookX: 0, lookY: 0 };
  const keys = new Set();
  const stick = layer.querySelector('.stick'), knob = layer.querySelector('.knob');
  const R = 38; // Recorrido máximo del pomo dentro del anillo
  let stickId = null, lookId = null, origin = null, last = null;

  layer.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;

    // Joystick flotante dinámico: aparece donde presiona el jugador en la mitad izquierda, mitad inferior
    const inJoystickZone = e.clientX <= (innerWidth * 0.5) && e.clientY >= (innerHeight * 0.5);

    if (inJoystickZone && stickId === null) {
      stickId = e.pointerId;
      origin = { x: e.clientX, y: e.clientY };

      const rect = stick.getBoundingClientRect();
      const halfW = (rect.width || 126) / 2;
      const halfH = (rect.height || 126) / 2;
      stick.style.left = `${origin.x - halfW}px`;
      stick.style.top = `${origin.y - halfH}px`;
      stick.style.bottom = 'auto';
      stick.style.right = 'auto';
      stick.classList.add('on');
      knob.style.transition = 'none';
      knob.style.transform = 'translate(0, 0)';
      state.x = 0;
      state.y = 0;
      layer.setPointerCapture?.(e.pointerId);
    } else if (lookId === null) {
      lookId = e.pointerId;
      layer.setPointerCapture?.(e.pointerId);
      last = { x: e.clientX, y: e.clientY };
    }
  });

  layer.addEventListener('pointermove', (e) => {
    if (e.pointerId === stickId && origin) {
      let dx = e.clientX - origin.x, dy = e.clientY - origin.y;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
      knob.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
      state.x = dx / R;
      state.y = -dy / R;
    } else if (e.pointerId === lookId && last) {
      state.lookX += e.clientX - last.x;
      state.lookY += e.clientY - last.y;
      last = { x: e.clientX, y: e.clientY };
    }
  });

  const end = (e) => {
    if (e.pointerId === stickId) {
      stickId = null;
      origin = null;
      state.x = 0;
      state.y = 0;
      stick.classList.remove('on');
      knob.style.transition = 'transform 0.18s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
      knob.style.transform = 'translate(0, 0)';
    }
    if (e.pointerId === lookId) {
      lookId = null;
      last = null;
    }
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
    reset() {
      state.x = state.y = state.lookX = state.lookY = 0;
      keys.clear();
      stickId = lookId = null;
      origin = last = null;
      stick.classList.remove('on');
      knob.style.transition = 'transform 0.18s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
      knob.style.transform = 'translate(0, 0)';
    },
  };
}
