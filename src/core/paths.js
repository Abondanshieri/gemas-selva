// Senderos: guían al jugador por las rampas y los aros de balanceo. Se calculan sobre un grafo de
// navegación: nodos = inicio, tótems, gemas, extremos de rampa y aros; aristas = caminar dentro de
// una misma "región" (capa + orilla), subir/bajar una rampa y balancearse entre los dos aros.
import { padsOf } from './swing.js';
import { zoneByZ } from './terrain.js';

export const RAMP_END = 7;   // los extremos de rampa quedan a 7 m del límite de capa (fuera de la pendiente)

const zoneIdx = (def, z) => def.zones.indexOf(zoneByZ(def.zones, z));
// Región = capa + orilla (0 si el nivel no tiene río). El río corre de norte a sur y parte TODAS las capas
// en Oeste (-1) y Este (+1). Solo se camina libremente dentro de una región.
export const regionOf = (def, x, z) => {
  const r = (def.rivers ?? [])[0];
  return `${zoneIdx(def, z)}:${r ? Math.sign(x - r.x) : 0}`;
};

export function buildNav(def) {
  const nodes = [], edges = [];
  const add = (x, z, tag) => nodes.push({ x, z, tag, region: regionOf(def, x, z) }) - 1;
  const start = add(def.playerStart[0], def.playerStart[1], 'start');
  const pois = [start];
  for (const t of def.totems) pois.push(add(t.pos[0], t.pos[1], 'totem'));
  for (const g of def.gems) pois.push(add(g.pos[0], g.pos[1], 'gem'));
  for (const r of def.ramps ?? []) {
    const zb = def.zones[r.boundary].z1;
    const a = add(r.x, zb - RAMP_END, 'ramp'), b = add(r.x, zb + RAMP_END, 'ramp');
    edges.push({ a, b, kind: 'ramp' });
  }
  for (const rv of def.rivers ?? []) {
    for (const an of rv.anchors) {
      const [o, e] = padsOf({ x: rv.x, z: an.z }, rv);
      edges.push({ a: add(o.x, o.z, 'pad'), b: add(e.x, e.z, 'pad'), kind: 'swing' });
    }
  }
  // Dentro de una región todos los nodos se conectan en línea recta.
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    if (nodes[i].region === nodes[j].region) edges.push({ a: i, b: j, kind: 'walk' });
  }
  const adj = nodes.map(() => []);
  for (const e of edges) {
    const w = Math.hypot(nodes[e.a].x - nodes[e.b].x, nodes[e.a].z - nodes[e.b].z);
    adj[e.a].push({ to: e.b, w, kind: e.kind }); adj[e.b].push({ to: e.a, w, kind: e.kind });
  }
  return { nodes, adj, start, pois };
}

// Dijkstra desde el inicio: distancia y padre de cada nodo (Infinity = inalcanzable).
export function shortest(nav) {
  const dist = nav.nodes.map(() => Infinity), prev = nav.nodes.map(() => -1), prevKind = nav.nodes.map(() => '');
  const done = new Set();
  dist[nav.start] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < dist.length; i++) if (!done.has(i) && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0) break;
    done.add(u);
    for (const { to, w, kind } of nav.adj[u]) if (dist[u] + w < dist[to]) { dist[to] = dist[u] + w; prev[to] = u; prevKind[to] = kind; }
  }
  return { dist, prev, prevKind };
}

export function computePaths(def) {
  const nav = buildNav(def), { prev, prevKind } = shortest(nav), segs = [], seen = new Set();
  for (const p of nav.pois) {
    for (let v = p; prev[v] >= 0; v = prev[v]) {
      if (prevKind[v] === 'swing') continue;          // el balanceo no deja sendero
      const a = nav.nodes[prev[v]], b = nav.nodes[v], k = `${prev[v]}-${v}`;
      if (seen.has(k)) continue;
      seen.add(k);
      if (Math.hypot(a.x - b.x, a.z - b.z) > 1.5) segs.push([a.x, a.z, b.x, b.z]);
    }
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
