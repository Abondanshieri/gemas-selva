import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng as makeRng, ObstacleGrid } from './util.js';
import { computePaths, distToSegments } from '../core/paths.js';
import { createTerrain } from '../core/terrain.js';

// Cada capa tiene su ambiente. Se mezclan de forma continua al subir o bajar por las rampas,
// así que "casi todo es igual" pero cambia la luz, la niebla, el color del suelo y la espesura.
export const THEMES = {
  pradera:  { sky: 0xcfeab8, g1: 0x6da84a, g2: 0xa2cf5c, path: 0xe9dba6, fog: [32, 82], trees: 0.08, bush: 0.35, fern: 0.15, flower: 1, tint: 1.1 },
  bosque:   { sky: 0xa8d8b9, g1: 0x2f7d46, g2: 0x4fa05a, path: 0xc9b27a, fog: [22, 62], trees: 0.26, bush: 0.9, fern: 0.7, flower: 0.12, tint: 1 },
  profundo: { sky: 0x6f9f92, g1: 0x1c5a3e, g2: 0x2d7a58, path: 0xb3a06c, fog: [11, 44], trees: 0.45, bush: 1, fern: 1, flower: 0, tint: 0.72 },
};
const ROCK = new THREE.Color(0x7f7c6c);
const FLOWER = [0xffd84a, 0xff7aa8, 0xffffff, 0xb58cff];   // amarilla, rosa, blanca, violeta

export const ANCHOR_Y = 10.6;   // altura del aro sobre el suelo de su capa
const CHUNK = 20;               // lado de cada chunk de vegetación

const _a = new THREE.Color(), _b = new THREE.Color();
// Ambiente en la coordenada de capa c (0..n-1, continua): color de cielo/niebla, cercanía y lejanía de la niebla.
export function lookAtLayer(themes, c, out = { sky: new THREE.Color(), near: 0, far: 0 }) {
  const i = Math.min(themes.length - 1, Math.floor(c)), j = Math.min(themes.length - 1, i + 1), f = c - i;
  out.sky.set(themes[i].sky).lerp(_a.set(themes[j].sky), f);
  out.near = themes[i].fog[0] + (themes[j].fog[0] - themes[i].fog[0]) * f;
  out.far = themes[i].fog[1] + (themes[j].fog[1] - themes[i].fog[1]) * f;
  return out;
}

const paint = (geo, hex) => {
  const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
};
const part = (geo, hex, y, sx = 1, sy = 1, sz = 1) => {
  geo = geo.index ? geo.toNonIndexed() : geo;
  geo.deleteAttribute('uv');
  geo.scale(sx, sy, sz).translate(0, y, 0);
  return paint(geo, hex);
};

// Geometrías base: una sola vez, compartidas por todas las instancias y mundos.
let GEOS = null;
function geometries() {
  if (GEOS) return GEOS;
  GEOS = {
    tree: mergeGeometries([
      part(new THREE.CylinderGeometry(0.16, 0.3, 3, 6), 0x6b4a2b, 1.5),
      part(new THREE.IcosahedronGeometry(1.9, 0), 0x2e8b4f, 3.9, 1, 0.8, 1),
      part(new THREE.IcosahedronGeometry(1.3, 0), 0x3fae5f, 5.1, 1, 0.8, 1),
      part(new THREE.IcosahedronGeometry(0.9, 0), 0x56c274, 6.0, 1, 0.8, 1),
    ]),
    bush: mergeGeometries([
      part(new THREE.IcosahedronGeometry(0.7, 0), 0x2a9d58, 0.4, 1.2, 0.8, 1.2),
      part(new THREE.IcosahedronGeometry(0.45, 0), 0x45bd72, 0.75, 1, 0.9, 1),
    ]),
    rock: mergeGeometries([part(new THREE.DodecahedronGeometry(0.8, 0), 0x7d8a82, 0.35, 1.2, 0.7, 1)]),
    // Árbol alto y esbelto de selva: sube por encima del dosel y da sensación de bosque cerrado.
    tall: mergeGeometries([
      part(new THREE.CylinderGeometry(0.14, 0.26, 5.4, 6), 0x5e4326, 2.7),
      part(new THREE.ConeGeometry(1.6, 3.4, 7), 0x1f6b47, 5.2),
      part(new THREE.ConeGeometry(1.2, 2.8, 7), 0x2a8456, 7.0),
      part(new THREE.ConeGeometry(0.75, 2.2, 6), 0x3fa66a, 8.7),
    ]),
    fern: mergeGeometries(Array.from({ length: 6 }, (_, i) => {
      const g = new THREE.ConeGeometry(0.13, 1.2, 4).translate(0, 0.6, 0).rotateZ(1.15).rotateY((i / 6) * Math.PI * 2).toNonIndexed();
      g.deleteAttribute('uv');
      return paint(g, 0x4cc06f);
    })),
    flower: mergeGeometries([
      part(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 4), 0x9fd77a, 0.25),
      part(new THREE.IcosahedronGeometry(0.14, 0), 0xffffff, 0.56),
    ]),
  };
  return GEOS;
}
const VEG_MAT = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });

// Textura procedural de agua (rayas): una sola, compartida por ríos y cascadas.
let WATER_TEX = null;
function waterTexture() {
  if (WATER_TEX) return WATER_TEX;
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#2b9ab5'; g.fillRect(0, 0, 128, 64);
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 3; g.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const y = (i * 7.3 + 5) % 64, x = (i * 41) % 128;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + 26, y); g.stroke();
    g.beginPath(); g.moveTo(x - 128, y); g.lineTo(x - 102, y); g.stroke();
  }
  WATER_TEX = new THREE.CanvasTexture(c);
  WATER_TEX.wrapS = WATER_TEX.wrapT = THREE.RepeatWrapping;
  WATER_TEX.colorSpace = THREE.SRGBColorSpace;
  return WATER_TEX;
}

const lam = (hex) => new THREE.MeshLambertMaterial({ color: hex, flatShading: true });

export function buildWorld(scene, def) {
  const rnd = makeRng(def.seed);
  const rivers = def.rivers ?? [];
  const T = createTerrain(def);
  const height = T.height;
  const themes = def.zones.map((z) => THEMES[z.theme]);
  const grid = new ObstacleGrid(4);
  const disposables = [];
  const group = new THREE.Group();
  scene.add(group);
  const animated = [];
  const paths = computePaths(def);

  const SIZE = Math.ceil((def.radius + 12) * 2 / 4) * 4;   // lado del terreno (el círculo cabe con su borde)
  const half = SIZE / 2;

  // --- Terreno: un solo mesh, colores por vértice (suelo por capa, roca en los acantilados, sendero) ---
  const seg = SIZE;                                     // ~1 m por celda: los acantilados (2,6 m) se leen bien
  const tg = new THREE.PlaneGeometry(SIZE, SIZE, seg, seg).rotateX(-Math.PI / 2);
  const pos = tg.attributes.position, col = new Float32Array(pos.count * 3);
  const c1 = new THREE.Color(), c2 = new THREE.Color(), c3 = new THREE.Color(0x6b5a3a), c4 = new THREE.Color(0x9c8a5a), cp = new THREE.Color(), tmp = new THREE.Color();
  const mix = (key, c, f) => { // mezcla continua entre el tema de la capa de arriba y el de abajo
    const i = Math.min(themes.length - 1, Math.floor(c)), j = Math.min(themes.length - 1, i + 1);
    return f.set(themes[i][key]).lerp(_b.set(themes[j][key]), c - i);
  };
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = height(x, z), zc = T.zoneCoord(z);
    pos.setY(i, y);
    mix('g1', zc, c1); mix('g2', zc, c2); mix('path', zc, cp);
    const n = 0.5 + 0.5 * Math.sin(x * 0.7) * Math.cos(z * 0.6);
    tmp.copy(c1).lerp(c2, n * 0.8).lerp(c3, Math.max(0, (rnd() - 0.93) * 6));
    for (const r of rivers) if (Math.abs(x - r.x) < r.halfWidth + 1.4) tmp.lerp(c4, 0.8);   // arena en la orilla
    const slope = T.slopeAt(x, z), rocky = Math.min(1, Math.max(0, (slope - 0.3) / 0.45));
    if (rocky > 0) tmp.lerp(ROCK, rocky * 0.95);                                              // acantilado = roca
    const dp = distToSegments(x, z, paths);
    if (dp < 2.1) tmp.lerp(cp, Math.min(1, (2.1 - dp) / 0.9) * 0.95);                        // sendero (también sobre las rampas)
    const d = Math.hypot(x, z);
    if (d > def.radius - 3) tmp.multiplyScalar(Math.max(0.45, 1 - (d - def.radius + 3) * 0.05)); // el borde se oscurece
    col.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  tg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  tg.computeVertexNormals();
  const tmat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  group.add(new THREE.Mesh(tg, tmat));
  disposables.push(tg, tmat);

  // --- Río único de norte a sur: cruza todas las capas, cae en cascada en cada acantilado; aros de balanceo ---
  const woodMat = lam(0x6b4a2b), vineMat = lam(0x3f8a4a);
  disposables.push(woodMat, vineMat);
  const anchorY = (r, a) => T.terrace(r.x, a.z) + ANCHOR_Y;
  const zTop = -(def.radius + 12), zBot = def.radius + 12;
  for (const river of rivers) {
    const tex = waterTexture(), w2 = (river.halfWidth + 1.1) * 2;
    // Un tramo de agua por capa, cada uno a su altura.
    def.zones.forEach((zn, i) => {
      const z0 = i ? def.zones[i - 1].z1 : zTop, z1 = i === def.zones.length - 1 ? zBot : zn.z1;
      const wmat = new THREE.MeshBasicMaterial({ map: tex.clone(), transparent: true, opacity: 0.9 });
      wmat.map.needsUpdate = true;
      wmat.map.repeat.set(1, (z1 - z0) / 8);
      const water = new THREE.Mesh(new THREE.PlaneGeometry(w2, z1 - z0).rotateX(-Math.PI / 2), wmat);
      water.position.set(river.x, T.waterY(river, (z0 + z1) / 2), (z0 + z1) / 2);
      group.add(water);
      disposables.push(water.geometry, wmat, wmat.map);
      animated.push((t) => { wmat.map.offset.y = t * 0.18; });   // el agua corre hacia el sur
      // Cascada en el acantilado de abajo de esta capa.
      if (river.waterfall && i < def.zones.length - 1) {
        const yu = T.waterY(river, z1 - 4), yl = T.waterY(river, z1 + 4), drop = yu - yl;
        const fmat = new THREE.MeshBasicMaterial({ map: tex.clone(), transparent: true, opacity: 0.88, side: THREE.DoubleSide });
        fmat.map.needsUpdate = true;
        fmat.map.repeat.set(1, 2);
        const fall = new THREE.Mesh(new THREE.PlaneGeometry(w2 - 0.6, drop + 0.6), fmat);
        fall.position.set(river.x, (yu + yl) / 2, z1 + 0.5);
        group.add(fall);
        disposables.push(fall.geometry, fmat, fmat.map);
        animated.push((t) => { fmat.map.offset.y = -t * 0.9; });
      }
    });

    // Estructura de anclaje por cada aro: dos postes (uno en cada orilla), viga y brazo con el aro.
    for (const a of river.anchors) {
      const ay = anchorY(river, a), pz = a.z + 4.6, xOff = river.halfWidth + 2.7;
      for (const sx of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, ANCHOR_Y + 1.5, 7), woodMat);
        post.position.set(river.x + sx * xOff, height(river.x + sx * xOff, pz) + (ANCHOR_Y + 1.5) / 2 - 0.3, pz);
        group.add(post);
        grid.add(river.x + sx * xOff, pz, 0.6);
        disposables.push(post.geometry);
      }
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, xOff * 2, 6).rotateZ(Math.PI / 2), woodMat);
      beam.position.set(river.x, ay + 0.9, pz);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 4.6, 6).rotateX(Math.PI / 2), woodMat);
      arm.position.set(river.x, ay + 0.9, a.z + 2.3);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.1, 6, 14), new THREE.MeshLambertMaterial({ color: 0x3ddc84, emissive: 0x3ddc84, emissiveIntensity: 0.9 }));
      ring.position.set(river.x, ay, a.z);
      const vine = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 5), vineMat);
      vine.position.set(river.x, ay + 0.55, a.z);
      group.add(beam, arm, ring, vine);
      disposables.push(beam.geometry, arm.geometry, ring.geometry, ring.material, vine.geometry);
      animated.push((t) => { ring.rotation.y = t * 1.5; ring.scale.setScalar(1 + Math.sin(t * 3) * 0.06); });
    }
  }

  // --- Vegetación por chunks (frustum culling real: cada chunk se descarta entero) ---
  const geos = geometries();
  const pois = [def.playerStart, ...def.totems.map((t) => t.pos), ...def.gems.map((g) => g.pos)];
  const nearPoi = (x, z, r) => pois.some(([px, pz]) => (x - px) ** 2 + (z - pz) ** 2 < r * r);
  const inRiver = (x, pad = 1.2) => rivers.some((r) => Math.abs(x - r.x) < r.halfWidth + pad);
  const nearAnchor = (x, z) => rivers.some((r) => r.anchors.some((a) => Math.abs(z - a.z) < 6 && Math.abs(x - r.x) < r.halfWidth + 9));
  const nearRamp = (x, z, padX = 7, padZ = 15) => (def.ramps ?? []).some((r) => Math.abs(x - r.x) < padX && Math.abs(z - def.zones[r.boundary].z1) < padZ);
  const chunks = new Map();
  const zoneTheme = (z) => themes[def.zones.indexOf(T.zoneAt(z))];
  const put = (kind, x, z, s) => {
    const k = `${Math.floor((x + half) / CHUNK)},${Math.floor((z + half) / CHUNK)}`;
    const tint = zoneTheme(z).tint;
    (chunks.get(k) ?? chunks.set(k, { tree: [], tall: [], bush: [], fern: [], flower: [], rock: [] }).get(k))[kind].push({ x, z, s, h: Math.floor(rnd() * 4), r: rnd() * Math.PI * 2, t: Math.min(1.15, (0.75 + rnd() * 0.25) * tint), g: 0.85 + rnd() * 0.3 });
  };
  const inside = def.radius - 3;
  const area = (SIZE / 110) ** 2;

  // Bosquetes: el bosque se agrupa en manchas y deja claros entre ellas.
  const grove = (x, z) => 0.5 + 0.5 * Math.sin(x * 0.085 + 1.3) * Math.sin(z * 0.075 - 0.4);
  for (let i = 0, n = Math.round(2000 * area); i < n; i++) {
    const x = (rnd() * 2 - 1) * (half - 3), z = (rnd() * 2 - 1) * (half - 3), d = Math.hypot(x, z);
    if (inRiver(x, 2)) continue;
    if (d < inside + 5) {
      // Interior: despejado, con más o menos espesura según la capa; nunca sobre senderos, rampas ni puntos de interés.
      if (rnd() > zoneTheme(z).trees * (0.3 + 1.6 * grove(x, z)) || nearPoi(x, z, 6) || nearAnchor(x, z) || nearRamp(x, z) || distToSegments(x, z, paths) < 3.4) continue;
      if (T.slopeAt(x, z) > 0.45) continue;
    }
    const s = 0.8 + rnd() * 0.9;
    put(rnd() < 0.35 ? 'tall' : 'tree', x, z, s);
    if (d < inside + 5) grid.add(x, z, 0.45 * s);
  }
  for (let i = 0, n = Math.round(700 * area); i < n; i++) {
    const x = (rnd() * 2 - 1) * (half - 3), z = (rnd() * 2 - 1) * (half - 3);
    if (nearPoi(x, z, 2.5) || inRiver(x, 1.5) || distToSegments(x, z, paths) < 1.8 || T.slopeAt(x, z) > 0.5) continue;
    if (Math.hypot(x, z) < inside && rnd() > zoneTheme(z).bush) continue;   // la pradera es más abierta
    put('bush', x, z, 0.7 + rnd() * 0.9);
  }
  // Sotobosque: helechos (bosque y profundo) y flores (pradera).
  for (const [kind, key, tries] of [['fern', 'fern', 900], ['flower', 'flower', 800]]) {
    for (let i = 0, n = Math.round(tries * area); i < n; i++) {
      const x = (rnd() * 2 - 1) * (half - 3), z = (rnd() * 2 - 1) * (half - 3);
      if (Math.hypot(x, z) > inside + 4 || rnd() > zoneTheme(z)[key] || nearPoi(x, z, 1.6) || inRiver(x, 1.2) || distToSegments(x, z, paths) < 1.3 || T.slopeAt(x, z) > 0.5) continue;
      put(kind, x, z, 0.8 + rnd() * 0.8);
    }
  }
  for (let i = 0, n = Math.round(70 * area); i < n; i++) {
    const x = (rnd() * 2 - 1) * (def.radius + 2), z = (rnd() * 2 - 1) * (def.radius + 2);
    if (nearPoi(x, z, 7) || inRiver(x, 0.5) || nearAnchor(x, z) || nearRamp(x, z) || distToSegments(x, z, paths) < 2.6 || T.slopeAt(x, z) > 0.45) continue;
    const s = 0.7 + rnd() * 1.1;
    put('rock', x, z, s);
    if (Math.hypot(x, z) < inside + 5) grid.add(x, z, 0.75 * s);
  }
  // Peñascos al pie de cada acantilado (lado bajo): refuerzan visualmente el cambio de capa.
  for (const zn of def.zones.slice(0, -1)) {
    for (let i = 0; i < 16; i++) {
      const z = zn.z1 + 2.6 + rnd() * 1.2, x = (rnd() * 2 - 1) * (Math.sqrt(Math.max(0, def.radius ** 2 - z * z)) - 3);
      if (nearRamp(x, z, 8, 20) || inRiver(x, 3) || nearPoi(x, z, 5) || distToSegments(x, z, paths) < 2.8) continue;
      const s = 0.9 + rnd() * 1.2;
      put('rock', x, z, s);
      grid.add(x, z, 0.75 * s);
    }
  }

  const dummy = new THREE.Object3D(), color = new THREE.Color();
  let meshCount = 0;
  for (const data of chunks.values()) {
    for (const kind of ['tree', 'tall', 'bush', 'fern', 'flower', 'rock']) {
      const list = data[kind];
      if (!list.length) continue;
      const im = new THREE.InstancedMesh(geos[kind], VEG_MAT, list.length);
      list.forEach((o, i) => {
        dummy.position.set(o.x, height(o.x, o.z) - 0.05, o.z);
        dummy.rotation.set(0, o.r, 0);
        dummy.scale.setScalar(o.s);
        dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
        if (kind === 'flower') im.setColorAt(i, color.setHex(FLOWER[o.h]));
        else im.setColorAt(i, color.setRGB(o.t, o.t * o.g, o.t));
      });
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();   // permite descartar el chunk entero fuera de cámara
      im.matrixAutoUpdate = false;  // estático
      group.add(im);
      meshCount++;
    }
  }

  return {
    group, grid, height, terrain: T, rivers, meshCount, themes, paths, anchorY,
    update(t) { for (const fn of animated) fn(t); },
    dispose() {
      scene.remove(group);
      disposables.forEach((d) => d.dispose());
      group.traverse((o) => o.isInstancedMesh && o.dispose());
    },
  };
}
