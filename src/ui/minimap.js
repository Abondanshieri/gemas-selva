// Minimapa 2D que rota con la cámara (arriba = hacia donde miras). Barato: un canvas de 104 px.
const COLOR = { U: '#3ddc84', D: '#ffb938', C: '#ff5d8f' };
const R = 52;            // radio del minimapa en px lógicos
const VIEW = 30;         // metros que caben en el radio
const K = R / VIEW;

export function createMinimap(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.scale(canvas.width / (R * 2), canvas.height / (R * 2));

  // Transforma mundo → minimapa respetando la rotación de la cámara.
  const proj = (x, z, px, pz, yaw) => {
    const dx = x - px, dz = z - pz;
    const rx = Math.cos(yaw), rz = -Math.sin(yaw), fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    return [R + (dx * rx + dz * rz) * K, R - (dx * fx + dz * fz) * K];
  };
  // Si cae fuera del círculo, se pega al borde (así siempre sabes hacia dónde queda).
  const clamp = (x, y) => {
    const dx = x - R, dy = y - R, d = Math.hypot(dx, dy), lim = R - 7;
    return d > lim ? [R + (dx / d) * lim, R + (dy / d) * lim, true] : [x, y, false];
  };

  return function draw(m) {
    const { pos, yaw } = m;
    ctx.clearRect(0, 0, R * 2, R * 2);
    ctx.save();
    ctx.beginPath(); ctx.arc(R, R, R, 0, Math.PI * 2); ctx.clip();
    const E = 120;
    const quad = (z0, z1) => [[-E, z0], [E, z0], [E, z1], [-E, z1]].map(([x, z]) => proj(x, z, pos.x, pos.z, yaw));
    // capas: una banda por capa (la actual, más viva), de norte (arriba) a sur
    m.zones.forEach((zn, i) => {
      const z0 = i ? m.zones[i - 1].z1 : -E, z1 = i === m.zones.length - 1 ? E : zn.z1;
      ctx.fillStyle = zn.color; ctx.globalAlpha = i === m.layer ? 0.7 : 0.4;
      ctx.beginPath(); quad(z0, z1).forEach(([a, b], k) => (k ? ctx.lineTo(a, b) : ctx.moveTo(a, b))); ctx.closePath(); ctx.fill();
      if (i) { // acantilado: línea oscura en el límite
        const [[a1, b1], [a2, b2]] = quad(z0, z0);
        ctx.strokeStyle = '#0e2218'; ctx.lineWidth = 2; ctx.globalAlpha = 0.85;
        ctx.beginPath(); ctx.moveTo(a1, b1); ctx.lineTo(a2, b2); ctx.stroke();
      }
    });
    ctx.globalAlpha = 1;

    // límites jugables
    const c = proj(0, 0, pos.x, pos.z, yaw);
    ctx.strokeStyle = '#ffffff40'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.arc(c[0], c[1], m.bounds * K, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);

    // ríos
    ctx.fillStyle = '#2b9ab5';
    for (const rv of m.rivers) {
      ctx.beginPath();
      [[rv.x - rv.halfWidth, -E], [rv.x + rv.halfWidth, -E], [rv.x + rv.halfWidth, E], [rv.x - rv.halfWidth, E]]
        .map(([x, z]) => proj(x, z, pos.x, pos.z, yaw)).forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)));
      ctx.closePath(); ctx.fill();
    }
    // senderos
    ctx.strokeStyle = '#e8d9a8aa'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    for (const [x1, z1, x2, z2] of m.paths) {
      const a = proj(x1, z1, pos.x, pos.z, yaw), b = proj(x2, z2, pos.x, pos.z, yaw);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    // rampas: flecha hacia la capa de arriba (norte del mundo)
    ctx.fillStyle = '#fff4c2'; ctx.strokeStyle = '#0e2218'; ctx.lineWidth = 1.2;
    for (const rp of m.ramps) {
      const [x, y, off] = clamp(...proj(rp.x, rp.z, pos.x, pos.z, yaw));
      const [tx, ty] = proj(rp.x, rp.z - 4, pos.x, pos.z, yaw);
      const a = Math.atan2(ty - y, tx - x), L = 6;
      ctx.globalAlpha = off ? 0.65 : 1;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * L, y + Math.sin(a) * L);
      ctx.lineTo(x + Math.cos(a + 2.5) * L, y + Math.sin(a + 2.5) * L);
      ctx.lineTo(x + Math.cos(a - 2.5) * L, y + Math.sin(a - 2.5) * L);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // aros de balanceo
    ctx.strokeStyle = '#3ddc84'; ctx.lineWidth = 2;
    for (const p of m.pads) { const [x, y, off] = clamp(...proj(p.x, p.z, pos.x, pos.z, yaw)); ctx.globalAlpha = off ? 0.6 : 1; ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.stroke(); }
    ctx.globalAlpha = 1;
    // gemas
    for (const g of m.gems) {
      const [x, y, off] = clamp(...proj(g.x, g.z, pos.x, pos.z, yaw));
      ctx.fillStyle = COLOR[g.type]; ctx.globalAlpha = off ? 0.55 : 1;
      ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x + 3.4, y); ctx.lineTo(x, y + 4); ctx.lineTo(x - 3.4, y); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // tótems (cuadrado de su color; listo = verde con borde)
    for (const t of m.totems) {
      const [x, y, off] = clamp(...proj(t.x, t.z, pos.x, pos.z, yaw));
      ctx.globalAlpha = off ? 0.7 : 1;
      ctx.fillStyle = t.done ? '#7dffb0' : COLOR[t.type];
      ctx.strokeStyle = '#0e2218'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.rect(x - 5, y - 5, 10, 10); ctx.fill(); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // jugador (siempre al centro, apuntando hacia arriba; el "frente" de la cámara)
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#0e2218'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(R, R - 7); ctx.lineTo(R + 5, R + 5); ctx.lineTo(R, R + 2); ctx.lineTo(R - 5, R + 5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  };
}
