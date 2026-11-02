// Mapa global del nivel: vista de pájaro (norte arriba) con TODAS las capas, el río, las rampas, los tótems
// con su meta y la posición del jugador; a un lado, lo que pide cada capa. El encabezado del juego solo
// muestra la capa actual: aquí se ve el panorama completo.
import './worldmap.css';

const COLOR = { U: '#3ddc84', D: '#ffb938', C: '#ff5d8f' };
const miniGem = (t) => `<i class="gem gem-${t} mini"></i>`;
const goalChips = (g) => ['C', 'D', 'U'].filter((t) => g[t] > 0).map((t) => `<span class="wm-chip">${miniGem(t)}${g[t]}</span>`).join('');
const S = 440;   // tamaño lógico del lienzo

export function createWorldMap(root, { onClose } = {}) {
  const el = document.createElement('div');
  el.className = 'wmap'; el.hidden = true;
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Mapa del nivel');
  el.innerHTML = `
    <div class="wm-win">
      <header class="wm-head"><b>Mapa</b><span class="wm-prog" data-wm-prog></span><button class="wm-x" data-wm-close aria-label="Cerrar mapa">✕</button></header>
      <div class="wm-body"><canvas width="${S}" height="${S}"></canvas><div class="wm-list" data-wm-list></div></div>
    </div>`;
  root.appendChild(el);
  const canvas = el.querySelector('canvas'), ctx = canvas.getContext('2d');
  el.addEventListener('click', (e) => { if (e.target === el || e.target.closest('[data-wm-close]')) onClose?.(); });

  // d: { radius, zones:[{name,z1,color}], ramps:[{x,z}], rivers:[{x,halfWidth}], pads:[{x,z}], player:{x,z,heading},
  //      layer, gems:[{x,z,type}], totems:[{x,z,short,label,type,goal,sum,done,n,layer}], progress:{done,total}, cards:[...] }
  function draw(d) {
    const k = (S / 2 - 8) / d.radius, X = (x) => S / 2 + x * k, Z = (z) => S / 2 + z * k;
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath(); ctx.arc(S / 2, S / 2, d.radius * k, 0, Math.PI * 2); ctx.clip();
    d.zones.forEach((zn, i) => {
      const z0 = i ? d.zones[i - 1].z1 : -d.radius, z1 = i === d.zones.length - 1 ? d.radius : zn.z1;
      ctx.fillStyle = zn.color; ctx.globalAlpha = i === d.layer ? 0.95 : 0.6;
      ctx.fillRect(0, Z(z0), S, Z(z1) - Z(z0));
      ctx.globalAlpha = 1;
      if (i) { ctx.fillStyle = '#0e2218'; ctx.globalAlpha = 0.8; ctx.fillRect(0, Z(z0) - 2, S, 4); ctx.globalAlpha = 1; }
      ctx.fillStyle = '#ffffffc0'; ctx.font = '800 11px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(zn.name.toUpperCase(), X(-d.radius * 0.46), (Z(z0) + Z(z1)) / 2 + 4);   // a la izquierda del río, a media altura
    });
    ctx.fillStyle = '#2b9ab5';
    for (const r of d.rivers) ctx.fillRect(X(r.x - r.halfWidth), 0, r.halfWidth * 2 * k, S);
    // rampas: flecha hacia la capa de arriba
    for (const rp of d.ramps) { // tramo de sendero con un chevron ▲ (distinto de la flecha del jugador)
      const x = X(rp.x), y = Z(rp.z);
      ctx.fillStyle = '#e8d9a8'; ctx.strokeStyle = '#0e2218'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(x - 7, y - 15, 14, 30, 5); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#0e2218'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(x - 4, y - 1); ctx.lineTo(x, y - 6); ctx.lineTo(x + 4, y - 1); ctx.moveTo(x - 4, y + 7); ctx.lineTo(x, y + 2); ctx.lineTo(x + 4, y + 7); ctx.stroke();
    }
    // aros del látigo
    ctx.strokeStyle = '#3ddc84'; ctx.lineWidth = 2.5;
    for (const p of d.pads) { ctx.beginPath(); ctx.arc(X(p.x), Z(p.z), 6, 0, Math.PI * 2); ctx.stroke(); }
    // gemas
    for (const g of d.gems) {
      const x = X(g.x), y = Z(g.z);
      ctx.fillStyle = COLOR[g.type]; ctx.strokeStyle = '#0e2218'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x + 5, y); ctx.lineTo(x, y + 6); ctx.lineTo(x - 5, y); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // tótems con su meta
    ctx.textAlign = 'center';
    for (const t of d.totems) {
      const x = X(t.x), y = Z(t.z);
      ctx.fillStyle = t.done ? '#7dffb0' : COLOR[t.type]; ctx.strokeStyle = '#0e2218'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(x - 8, y - 8, 16, 16, 4); ctx.fill(); ctx.stroke();
      const label = t.done ? '✓' : t.sum ? `Σ${t.sum.total}` : Object.entries(t.goal).filter(([, n]) => n > 0).map(([ty, n]) => `${n}${ty}`).join('+');
      ctx.font = '800 12px system-ui, sans-serif';
      ctx.lineWidth = 3.5; ctx.strokeStyle = '#0e2218'; ctx.strokeText(label, x, y - 13);
      ctx.fillStyle = '#fff'; ctx.fillText(label, x, y - 13);
    }
    // jugador
    ctx.save();
    ctx.translate(X(d.player.x), Z(d.player.z));
    ctx.fillStyle = '#3ddc8455'; ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();   // halo: "estás aquí"
    ctx.rotate(Math.atan2(Math.cos(d.player.heading), Math.sin(d.player.heading)));
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#0e2218'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-7, 7); ctx.lineTo(-3, 0); ctx.lineTo(-7, -7); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.restore();
    ctx.strokeStyle = '#ffffff55'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(S / 2, S / 2, d.radius * k, 0, Math.PI * 2); ctx.stroke();
  }

  function list(d) {
    const rows = (c) => {
      const exact = c.rows.filter((r) => !r.sum).map((r) => `<div class="wm-row${r.done ? ' done' : ''}"><small>${r.short}</small>${goalChips(r.goal)}${r.done ? '<b>✓</b>' : ''}</div>`);
      // Los tótems de una misma suma se funden en una sola fila: Σ got/total · Oeste 0 · Este 0
      const groups = new Map();
      for (const r of c.rows.filter((x) => x.sum)) {
        const key = `${r.sum.type}/${r.sum.total}`;
        (groups.get(key) ?? groups.set(key, { sum: r.sum, done: r.done, parts: [] }).get(key)).parts.push(`${r.short} ${r.n}`);
      }
      const sums = [...groups.values()].map((g) => `<div class="wm-row${g.done ? ' done' : ''}"><small>Σ</small><span class="wm-chip">${miniGem(g.sum.type)}${g.sum.got}/${g.sum.total}</span><small>entre sus 2 tótems</small>${g.done ? '<b>✓</b>' : ''}</div>`);
      return [...sums, ...exact].join('') || '<div class="wm-row none">Sin tótems</div>';
    };
    return d.cards.map((c, i) => `
      <section class="wm-card${i === d.layer ? ' here' : ''}">
        <h4>${c.name}${i === d.layer ? '<em>estás aquí</em>' : ''}</h4>
        ${rows(c)}
        ${Object.keys(c.gems ?? {}).length ? `<div class="wm-gems"><small>Gemas</small>${goalChips(c.gems)}</div>` : ''}
      </section>`).join('');
  }

  return {
    get isOpen() { return !el.hidden; },
    open(d) {
      el.querySelector('[data-wm-prog]').textContent = `Tótems ${d.progress.done}/${d.progress.total}`;
      el.querySelector('[data-wm-list]').innerHTML = list(d);
      el.hidden = false;
      draw(d);
    },
    close() { el.hidden = true; },
  };
}
