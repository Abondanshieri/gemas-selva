import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from './index.js';
import { createInventory, compose, decompose, canCompose, canDecompose, canDeliver, spend } from '../core/gems.js';
import { levelTotems } from '../core/levelLogic.js';
import { padsOf, mirror, landsAcross } from '../core/swing.js';
import { createTerrain, zoneByZ, MAX_SLOPE } from '../core/terrain.js';
import { buildNav, shortest, computePaths, regionOf, RAMP_END } from '../core/paths.js';

const worldOf = (l) => l.scenes[0];
const layerOf = (w, z) => zoneByZ(w.zones, z).id;

// Objetivos del nivel: los tótems exactos + cada grupo de suma como un único objetivo (el reparto es libre).
function goalsOf(level) {
  const goals = levelTotems(level).filter((t) => !t.sum).map((t) => t.goal);
  for (const s of level.sums ?? []) goals.push({ [s.type]: s.total });
  return goals;
}

// BFS sobre (inventario, objetivos cumplidos): ¿hay forma de ganar con las gemas de las capas indicadas?
function solvable(level, layers = null) {
  const w = worldOf(level), inv0 = createInventory(level.start);
  for (const g of w.gems) if (!layers || layers.includes(layerOf(w, g.pos[1]))) inv0[g.type]++;
  const goals = goalsOf(level);
  const full = (1 << goals.length) - 1;
  const key = (inv, mask) => `${inv.U},${inv.D},${inv.C},${mask}`;
  const seen = new Set([key(inv0, 0)]);
  const queue = [[inv0, 0]];
  while (queue.length) {
    const [inv, mask] = queue.shift();
    if (mask === full) return true;
    const next = [];
    for (const t of ['U', 'D']) if (canCompose(inv, t)) next.push([compose(inv, t), mask]);
    for (const t of ['D', 'C']) if (canDecompose(inv, t)) next.push([decompose(inv, t), mask]);
    goals.forEach((g, i) => { if (!(mask & (1 << i)) && canDeliver(inv, g)) next.push([spend(inv, g), mask | (1 << i)]); });
    for (const [n, m] of next) { const k = key(n, m); if (!seen.has(k)) { seen.add(k); queue.push([n, m]); } }
  }
  return false;
}

// Alcanzabilidad REAL: recorre el terreno a pie con la misma regla de pendiente que el juego
// (acantilados bloquean, rampas no), el agua bloquea y los aros del látigo unen las dos orillas.
function walkable(w, { ramps = true } = {}) {
  const T = createTerrain({ ...w, ramps: ramps ? w.ramps : [] });
  const step = 0.5, n = Math.ceil((w.radius + 4) * 2 / step), o = -(w.radius + 4);
  const at = (i, j) => [o + i * step, o + j * step];
  const idx = (x, z) => [Math.round((x - o) / step), Math.round((z - o) / step)];
  const H = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) H[j * n + i] = T.height(...at(i, j));
  const inWater = (x) => (w.rivers ?? []).some((r) => Math.abs(x - r.x) < r.halfWidth + 2.7);   // el cauce y su talud son un muro
  const pads = (w.rivers ?? []).flatMap((r) => r.anchors.map((a) => padsOf({ x: r.x, z: a.z }, r)));
  const seen = new Uint8Array(n * n), q = [];
  const push = (i, j) => { if (i >= 0 && j >= 0 && i < n && j < n && !seen[j * n + i]) { seen[j * n + i] = 1; q.push(i, j); } };
  push(...idx(...w.playerStart));
  for (let h = 0; h < q.length; h += 2) {
    const i = q[h], j = q[h + 1], [x, z] = at(i, j);
    for (const [a, b] of pads) { // aro de una orilla → aro de la otra
      for (const [p, r] of [[a, b], [b, a]]) if ((x - p.x) ** 2 + (z - p.z) ** 2 < 2.6 ** 2) push(...idx(r.x, r.z));
    }
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= n || nj >= n) continue;
      const [nx, nz] = at(ni, nj), d = Math.hypot(di, dj) * step;
      if (Math.hypot(nx, nz) > w.bounds || inWater(nx)) continue;
      if ((H[nj * n + ni] - H[j * n + i]) / d > MAX_SLOPE) continue;   // solo se limita SUBIR; bajar = caminar o caer
      push(ni, nj);
    }
  }
  return { T, reaches: (x, z) => { const [i, j] = idx(x, z); return !!seen[j * n + i]; } };
}

for (const level of LEVELS) {
  test(`nivel ${level.id} (${level.name}) tiene solución`, () => assert.equal(solvable(level), true));
}

test('cantidad de capas: el nivel 1 usa 2, los demás 3 (un círculo dividido)', () => {
  assert.deepEqual(LEVELS.map((l) => worldOf(l).zones.length), [2, 3, 3, 3]);
  for (const l of LEVELS) {
    const w = worldOf(l);
    assert.equal(l.scenes.length, 1, 'un solo mundo continuo, sin escenas separadas');
    assert.equal(w.ramps.length, w.zones.length - 1, 'cada límite entre capas tiene su rampa');
    assert.deepEqual(w.ramps.map((r) => r.boundary).sort(), w.zones.slice(1).map((_, i) => i));
    assert.ok(w.zones.every((z, i) => i === 0 || z.elevation < w.zones[i - 1].elevation), 'cada capa queda más abajo que la anterior');
  }
});

test('nivel 1: una sola D en el mapa, arriba en la pradera; el tótem está abajo (hay que descomponer)', () => {
  const w = worldOf(LEVELS[0]);
  assert.deepEqual(w.gems.map((g) => g.type), ['D']);
  assert.equal(layerOf(w, w.gems[0].pos[1]), 'pradera');
  assert.equal(layerOf(w, w.totems[0].pos[1]), 'bosque');
  assert.equal(layerOf(w, w.playerStart[1]), 'bosque');
});

test('nivel 2: un tótem por capa (C arriba, D en medio, U abajo) y hace falta componer', () => {
  const l = LEVELS[1], w = worldOf(l);
  const byLayer = Object.fromEntries(w.totems.map((t) => [layerOf(w, t.pos[1]), Object.keys(t.goal)[0]]));
  assert.deepEqual(byLayer, { pradera: 'C', bosque: 'D', profundo: 'U' });
  assert.ok(w.gems.filter((g) => g.type === 'D').length >= 10, 'para formar la C hacen falta 10 D repartidas por las capas');
  for (const z of w.zones) assert.equal(solvable(l, [z.id]), false, `solo la capa ${z.id} no alcanza`);
});

test('nivel 3: un río norte-sur parte TODAS las capas; suma de 8 U entre orillas oeste y este', () => {
  const l = LEVELS[2], w = worldOf(l), r = w.rivers[0];
  assert.equal(w.rivers.length, 1, 'un único río');
  assert.equal(l.sums[0].type, 'U'); assert.equal(l.sums[0].total, 8);
  assert.deepEqual(w.totems.map((t) => Math.sign(t.pos[0] - r.x)).sort(), [-1, 1], 'un tótem por orilla');
  assert.ok(w.totems.every((t) => t.sum === 'suma'));
  const a = { x: r.x, z: r.anchors[0].z };
  for (const pad of padsOf(a, r)) assert.ok(landsAcross(pad, mirror(pad, a), r));
  assert.equal(new Set(w.gems.map((g) => layerOf(w, g.pos[1]))).size, 3, 'hay gemas en las tres capas');
  assert.equal(solvable(l, ['pradera', 'bosque']), false, 'la D del bosque profundo es imprescindible');
});

test('nivel 4: UN río cruza las tres capas, con un aro por capa y un tótem en cada orilla de cada capa', () => {
  const l = LEVELS[3], w = worldOf(l), r = w.rivers[0];
  assert.equal(w.rivers.length, 1, 'un único río (cascada) para la división');
  assert.equal(r.anchors.length, 3);
  assert.deepEqual(r.anchors.map((a) => layerOf(w, a.z)), ['pradera', 'bosque', 'profundo'], 'un aro por capa');
  assert.equal(levelTotems(l).length, 6);
  for (const zn of w.zones) {
    const sides = w.totems.filter((t) => layerOf(w, t.pos[1]) === zn.id).map((t) => Math.sign(t.pos[0] - r.x)).sort();
    assert.deepEqual(sides, [-1, 1], `${zn.id}: un tótem por orilla`);
  }
  assert.equal(solvable(l, ['pradera', 'bosque']), false, 'hay que llegar hasta el bosque profundo');
});

test('nivel 4: cada capa pide una cantidad total de un solo tipo entre sus dos tótems', () => {
  const l = LEVELS[3], w = worldOf(l);
  assert.equal(l.sums.length, 3, 'una suma por capa');
  for (const sm of l.sums) {
    assert.equal(sm.type, 'U'); assert.ok(sm.total >= 1);
    const ts = w.totems.filter((t) => t.sum === sm.id);
    assert.equal(ts.length, 2, `${sm.id}: dos tótems (oeste y este)`);
    assert.equal(new Set(ts.map((t) => layerOf(w, t.pos[1]))).size, 1, `${sm.id}: ambos en la misma capa`);
  }
  assert.ok(w.totems.every((t) => t.sum && !t.goal), 'ningún tótem fija su propia cantidad');
});

test('el río es perpendicular a las capas: las cruza todas y queda lejos de las rampas y de los límites', () => {
  for (const l of LEVELS) {
    const w = worldOf(l);
    for (const r of w.rivers) {
      for (const rp of w.ramps) assert.ok(Math.abs(r.x - rp.x) >= r.halfWidth + 9, `${l.id}: la rampa x=${rp.x} está pegada al río`);
      for (const a of r.anchors) for (const zn of w.zones.slice(0, -1)) assert.ok(Math.abs(a.z - zn.z1) >= 12, `${l.id}: aro z=${a.z} pegado al acantilado z=${zn.z1}`);
    }
  }
});

test('todo está dentro del círculo, en suelo llano, fuera del agua y sin amontonarse', () => {
  for (const l of LEVELS) {
    const w = worldOf(l), T = createTerrain(w);
    const pois = [['inicio', w.playerStart], ...w.totems.map((t) => [t.id, t.pos]), ...w.gems.map((g, i) => [`gema${i}`, g.pos])];
    const pads = w.rivers.flatMap((r) => r.anchors.flatMap((a) => padsOf({ x: r.x, z: a.z }, r)));
    for (const [name, [x, z]] of pois) {
      assert.ok(Math.hypot(x, z) <= w.bounds - 1, `${l.id}/${name} (${x},${z}) fuera del círculo`);
      assert.ok(T.slopeAt(x, z) < 0.35, `${l.id}/${name} (${x},${z}) en pendiente ${T.slopeAt(x, z).toFixed(2)}`);
      for (const r of w.rivers) assert.ok(Math.abs(x - r.x) > r.halfWidth + 3, `${l.id}/${name} dentro del río`);
      if (name !== 'inicio') for (const p of pads) assert.ok(Math.hypot(x - p.x, z - p.z) > 3.6, `${l.id}/${name} dentro del aro`);
    }
    for (let i = 0; i < pois.length; i++) for (let j = i + 1; j < pois.length; j++) {
      const [a, [ax, az]] = pois[i], [b, [bx, bz]] = pois[j];
      if (a === 'inicio' || b === 'inicio') continue;
      assert.ok(Math.hypot(ax - bx, az - bz) > 2.4, `${l.id}: ${a} y ${b} están amontonados`);
    }
  }
});

test('se llega a pie a TODO (inicio, tótems, gemas, aros) subiendo por rampas y cruzando con el látigo', () => {
  for (const l of LEVELS) {
    const w = worldOf(l), { reaches } = walkable(w);
    for (const [x, z] of [w.playerStart, ...w.totems.map((t) => t.pos), ...w.gems.map((g) => g.pos)]) {
      assert.ok(reaches(x, z), `${l.id}: no se llega a (${x},${z}) [${layerOf(w, z)}]`);
    }
  }
});

test('sin rampas NO se puede subir: las capas de arriba quedan fuera de alcance (bajar sí, cayendo)', () => {
  for (const l of LEVELS) {
    const w = worldOf(l), { reaches } = walkable(w, { ramps: false });
    const here = w.zones.findIndex((z) => z.id === layerOf(w, w.playerStart[1]));
    const idx = (z) => w.zones.findIndex((zn) => zn.id === layerOf(w, z));
    const above = [...w.totems.map((t) => t.pos), ...w.gems.map((g) => g.pos)].filter(([, z]) => idx(z) < here);
    const below = [...w.totems.map((t) => t.pos), ...w.gems.map((g) => g.pos)].filter(([, z]) => idx(z) > here);
    for (const [x, z] of above) assert.equal(reaches(x, z), false, `${l.id}: (${x},${z}) está arriba y se alcanzó sin rampa`);
    if (!w.rivers.length) for (const [x, z] of below) assert.equal(reaches(x, z), true, `${l.id}: (${x},${z}) está abajo y debería poder alcanzarse cayendo`);
  }
});

test('sin látigo, el río corta el mundo en dos orillas', () => {
  const w = worldOf(LEVELS[2]);
  const noSwing = { ...w, rivers: w.rivers.map((r) => ({ ...r, anchors: [] })) };
  const { reaches } = walkable(noSwing);
  assert.equal(reaches(...w.totems.find((t) => t.id === 'tW').pos), false);
  assert.equal(reaches(...w.gems.find((g) => g.type === 'D').pos), false);
});

test('el grafo de navegación (senderos) también conecta todo', () => {
  for (const l of LEVELS) {
    const w = worldOf(l), nav = buildNav(w), { dist } = shortest(nav);
    nav.pois.forEach((p) => assert.ok(Number.isFinite(dist[p]), `${l.id}: ${nav.nodes[p].tag} (${nav.nodes[p].x},${nav.nodes[p].z}) sin camino`));
    assert.ok(computePaths(w).length > 0);
  }
});

test('los senderos cruzan de capa solo por las rampas', () => {
  for (const l of LEVELS) {
    const w = worldOf(l);
    for (const [x1, z1, x2, z2] of computePaths(w)) {
      if (regionOf(w, x1, z1).split(':')[0] === regionOf(w, x2, z2).split(':')[0]) continue;
      const ramp = w.ramps.find((r) => Math.abs(r.x - x1) < 0.01 && Math.abs(r.x - x2) < 0.01);
      assert.ok(ramp, `${l.id}: sendero (${x1},${z1})→(${x2},${z2}) cambia de capa fuera de una rampa`);
    }
  }
});

test('cada tótem pide UN solo tipo de gema (sin mezclas tipo 2D + 3U); los niveles 1, 3 y 4 usan un único tipo en todo el nivel', () => {
  for (const l of LEVELS) {
    for (const td of levelTotems(l).filter((x) => !x.sum)) assert.equal(Object.keys(td.goal).length, 1, `${l.id}/${td.id} pide varios tipos`);
  }
  for (const i of [0, 2, 3]) {
    const l = LEVELS[i];
    const types = new Set([...levelTotems(l).filter((x) => !x.sum).flatMap((x) => Object.keys(x.goal)), ...(l.sums ?? []).map((x) => x.type)]);
    assert.equal(types.size, 1, `nivel ${l.id}: más de un tipo a entregar (${[...types]})`);
  }
});

test('nivel 4: meta alcanzable y sin sobrar complicación (6 × 2 U = 12 U con una D descompuesta y 2 U)', () => {
  const l = LEVELS[3], w = worldOf(l);
  assert.equal(levelTotems(l).length, 6);
  assert.ok(w.gems.some((g) => g.type === 'D') && w.gems.filter((g) => g.type === 'U').length >= 2);
  assert.equal(solvable(l), true);
});
