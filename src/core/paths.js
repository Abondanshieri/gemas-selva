// Senderos: guían al jugador entre los puntos de interés. En escenas con río, cada orilla
// tiene su propia red que converge en el aro de lanzamiento del látigo (nunca cruza el agua).
import { padsOf } from './swing.js';

export function computePaths(def) {
  const pois = [def.playerStart, ...def.totems.map((t) => t.pos), ...def.exits.map((e) => e.pos), ...def.gems.map((g) => g.pos)];
  const segs = [];
  const river = def.river;
  if (!river) {
    for (const p of pois.slice(1)) segs.push([def.playerStart[0], def.playerStart[1], p[0], p[1]]);
    return segs;
  }
  const pads = river.anchors.flatMap((a) => padsOf({ x: a.x, z: river.z }, river));
  for (const p of pois) {
    const side = Math.sign(p[1] - river.z);
    const hub = pads.filter((q) => Math.sign(q.z - river.z) === side)
      .sort((a, b) => (a.x - p[0]) ** 2 + (a.z - p[1]) ** 2 - ((b.x - p[0]) ** 2 + (b.z - p[1]) ** 2))[0];
    if (hub && (hub.x - p[0]) ** 2 + (hub.z - p[1]) ** 2 > 2.25) segs.push([hub.x, hub.z, p[0], p[1]]);
  }
  return segs;
}

export function distToSegments(x, z, segs) {
  let best = Infinity;
  for (const [x1, z1, x2, z2] of segs) {
    const dx = x2 - x1, dz = z2 - z1, l2 = dx * dx + dz * dz;
    const t = l2 ? Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / l2)) : 0;
    const d = Math.hypot(x - (x1 + t * dx), z - (z1 + t * dz));
    if (d < best) best = d;
  }
  return best;
}
