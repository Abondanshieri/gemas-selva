// Minimapa 2D que rota con la cámara (arriba = hacia donde miras). Barato: un canvas de 104 px.
const COLOR = { U: '#3ddc84', D: '#ffb938', C: '#ff5d8f' };
const R = 52;            // radio del minimapa en px lógicos
const VIEW = 28;         // metros que caben en el radio
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
    ctx.fillStyle = m.ground ?? '#2f7d46'; ctx.globalAlpha = 0.55; ctx.fillRect(0, 0, R * 2, R * 2); ctx.globalAlpha = 1;

    // límites jugables
    const c = proj(0, 0, pos.x, pos.z, yaw);
    ctx.strokeStyle = '#ffffff40'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.arc(c[0], c[1], m.bounds * K, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);

    // río
    if (m.river) {
      const hw = m.river.halfWidth, z = m.river.z, E = 90;
      ctx.fillStyle = '#2b9ab5';
      ctx.beginPath();
      [[-E, z - hw], [E, z - hw], [E, z + hw], [-E, z + hw]].forEach(([x, zz], i) => {
        const [a, b] = proj(x, zz, pos.x, pos.z, yaw); i ? ctx.lineTo(a, b) : ctx.moveTo(a, b);
      });
      ctx.closePath(); ctx.fill();
    }
    // senderos
    ctx.strokeStyle = '#e8d9a8aa'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    for (const [x1, z1, x2, z2] of m.paths) {
      const a = proj(x1, z1, pos.x, pos.z, yaw), b = proj(x2, z2, pos.x, pos.z, yaw);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
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
    // salidas
    for (const e of m.exits) {
      const [x, y, off] = clamp(...proj(e.x, e.z, pos.x, pos.z, yaw));
      ctx.globalAlpha = off ? 0.65 : 1; ctx.fillStyle = '#7dffe0';
      ctx.beginPath(); ctx.moveTo(x - 5, y + 4); ctx.lineTo(x - 5, y - 2); ctx.arc(x, y - 2, 5, Math.PI, 0); ctx.lineTo(x + 5, y + 4); ctx.closePath(); ctx.fill();
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
