import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeHeight, rng as makeRng, ObstacleGrid } from './util.js';
import { computePaths, distToSegments } from '../core/paths.js';

// Cada escena tiene su "clima": cielo/niebla y colores del suelo, para distinguirlas de un vistazo.
export const THEMES = {
  selva:     { sky: 0xa8d8b9, g1: 0x2f7d46, g2: 0x4fa05a, path: 0xc9b27a },
  atardecer: { sky: 0xf0c48e, g1: 0x4d7a2e, g2: 0x6f9a38, path: 0xe6c88a },
  niebla:    { sky: 0xb7cfdf, g1: 0x2c6e68, g2: 0x4b9a8c, path: 0xcfc6a0 },
};

const SIZE = 110;        // lado del terreno
const CHUNK = 20;        // lado de cada chunk de vegetación
export const ANCHOR_Y = 10.6;

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

// Geometrías base: una sola vez, compartidas por todas las instancias y escenas.
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
  };
  return GEOS;
}
const VEG_MAT = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });

// Textura procedural de agua (rayas): una sola, compartida por río y cascada.
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
  const river = def.river ?? null;
  const height = makeHeight(river);
  const grid = new ObstacleGrid(4);
  const disposables = [];
  const group = new THREE.Group();
  scene.add(group);
  const animated = [];

  // --- Terreno: un solo mesh, colores por vértice ---
  const seg = 80;
  const tg = new THREE.PlaneGeometry(SIZE, SIZE, seg, seg).rotateX(-Math.PI / 2);
  const pos = tg.attributes.position, col = new Float32Array(pos.count * 3);
  const theme = THEMES[def.theme] ?? THEMES.selva;
  const paths = computePaths(def);
  const c1 = new THREE.Color(theme.g1), c2 = new THREE.Color(theme.g2), c3 = new THREE.Color(0x6b5a3a), c4 = new THREE.Color(0x9c8a5a), cp = new THREE.Color(theme.path), tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = height(x, z);
    pos.setY(i, y);
    const n = 0.5 + 0.5 * Math.sin(x * 0.7) * Math.cos(z * 0.6);
    tmp.copy(c1).lerp(c2, n * 0.8).lerp(c3, Math.max(0, (rnd() - 0.93) * 6));
    if (river && Math.abs(z - river.z) < river.halfWidth + 1.4) tmp.lerp(c4, 0.8); // arena en la orilla
    const dp = distToSegments(x, z, paths);
    if (dp < 2.1) tmp.lerp(cp, Math.min(1, (2.1 - dp) / 0.9) * 0.95);                // sendero
    col.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  tg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  tg.computeVertexNormals();
  const tmat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  group.add(new THREE.Mesh(tg, tmat));
  disposables.push(tg, tmat);

  // --- Río y cascada ---
  if (river) {
    const tex = waterTexture();
    const wmat = new THREE.MeshBasicMaterial({ map: tex.clone(), transparent: true, opacity: 0.9 });
    wmat.map.needsUpdate = true;
    wmat.map.repeat.set(SIZE / 8, 1);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, (river.halfWidth + 1.1) * 2).rotateX(-Math.PI / 2), wmat);
    water.position.set(0, -0.55, river.z);
    group.add(water);
    disposables.push(water.geometry, wmat, wmat.map);
    animated.push((t) => { wmat.map.offset.x = -t * 0.18; });

    if (river.waterfall) {
      const cliffMat = lam(0x6f7a72), fallMat = new THREE.MeshBasicMaterial({ map: tex.clone(), transparent: true, opacity: 0.85 });
      fallMat.map.needsUpdate = true;
      fallMat.map.repeat.set(1, 2);
      const x = -SIZE / 2 + 6;
      const cliff = new THREE.Mesh(new THREE.BoxGeometry(5, 9, (river.halfWidth + 5) * 2 + 8), cliffMat);
      cliff.position.set(x - 2.6, 3.5, river.z);
      const fall = new THREE.Mesh(new THREE.PlaneGeometry((river.halfWidth + 1) * 2, 9.5), fallMat);
      fall.rotation.y = Math.PI / 2;
      fall.position.set(x - 0.05, 3.9, river.z);
      group.add(cliff, fall);
      disposables.push(cliff.geometry, cliffMat, fall.geometry, fallMat, fallMat.map);
      animated.push((t) => { fallMat.map.offset.y = -t * 0.9; });
    }

    // Estructura de anclaje por cada ancla: dos postes, viga y brazo con aro.
    const woodMat = lam(0x6b4a2b), vineMat = lam(0x3f8a4a);
    for (const a of river.anchors) {
      const px = a.x + 4.6, zOff = river.halfWidth + 2.7;
      for (const sz of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, ANCHOR_Y + 1.5, 7), woodMat);
        post.position.set(px, height(px, river.z + sz * zOff) + (ANCHOR_Y + 1.5) / 2 - 0.3, river.z + sz * zOff);
        group.add(post);
        grid.add(px, river.z + sz * zOff, 0.6);
        disposables.push(post.geometry);
      }
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, zOff * 2, 6).rotateX(Math.PI / 2), woodMat);
      beam.position.set(px, ANCHOR_Y + 0.9, river.z);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 4.6, 6).rotateZ(Math.PI / 2), woodMat);
      arm.position.set(a.x + 2.3, ANCHOR_Y + 0.9, river.z);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.1, 6, 14), new THREE.MeshLambertMaterial({ color: 0x3ddc84, emissive: 0x3ddc84, emissiveIntensity: 0.9 }));
      ring.position.set(a.x, ANCHOR_Y, river.z);
      const vine = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 5), vineMat);
      vine.position.set(a.x, ANCHOR_Y + 0.55, river.z);
      group.add(beam, arm, ring, vine);
      disposables.push(beam.geometry, arm.geometry, ring.geometry, ring.material, vine.geometry);
      animated.push((t) => { ring.rotation.y = t * 1.5; ring.scale.setScalar(1 + Math.sin(t * 3) * 0.06); });
    }
    disposables.push(woodMat, vineMat);
  }

  // --- Vegetación por chunks (frustum culling real: cada chunk se descarta entero) ---
  const geos = geometries();
  const pois = [def.playerStart, ...def.totems.map((t) => t.pos), ...def.gems.map((g) => g.pos), ...def.exits.map((e) => e.pos)];
  const nearPoi = (x, z, r) => pois.some(([px, pz]) => (x - px) ** 2 + (z - pz) ** 2 < r * r);
  const inRiver = (z, pad = 1.2) => river && Math.abs(z - river.z) < river.halfWidth + pad;
  const nearAnchor = (x, z) => river && river.anchors.some((a) => Math.abs(x - a.x) < 6 && Math.abs(z - river.z) < river.halfWidth + 9);
  const half = SIZE / 2 - 3;
  const chunks = new Map();
  const put = (kind, x, z, s) => {
    const k = `${Math.floor((x + SIZE / 2) / CHUNK)},${Math.floor((z + SIZE / 2) / CHUNK)}`;
    (chunks.get(k) ?? chunks.set(k, { tree: [], bush: [], rock: [] }).get(k))[kind].push({ x, z, s, r: rnd() * Math.PI * 2, t: 0.75 + rnd() * 0.25, g: 0.85 + rnd() * 0.3 });
  };
  const inPlay = (x, z) => Math.hypot(x, z) < def.bounds + 4;

  for (let i = 0; i < 900; i++) {
    const x = (rnd() * 2 - 1) * half, z = (rnd() * 2 - 1) * half, d = Math.hypot(x, z);
    if (inRiver(z, 2) || x < -SIZE / 2 + 12 && inRiver(z, 9)) continue;
    if (d < def.bounds + 2 && (rnd() > 0.1 || nearPoi(x, z, 6) || nearAnchor(x, z) || distToSegments(x, z, paths) < 3.4)) continue; // interior despejado
    const s = 0.8 + rnd() * 0.9;
    put('tree', x, z, s);
    if (inPlay(x, z)) grid.add(x, z, 0.45 * s);
  }
  for (let i = 0; i < 420; i++) {
    const x = (rnd() * 2 - 1) * half, z = (rnd() * 2 - 1) * half;
    if (nearPoi(x, z, 2.5) || inRiver(z, 1.5) || distToSegments(x, z, paths) < 1.8) continue;
    put('bush', x, z, 0.7 + rnd() * 0.9);
  }
  for (let i = 0; i < 70; i++) {
    const x = (rnd() * 2 - 1) * (def.bounds + 2), z = (rnd() * 2 - 1) * (def.bounds + 2);
    if (nearPoi(x, z, 7) || inRiver(z, 0.5) || nearAnchor(x, z) || distToSegments(x, z, paths) < 2.6) continue;
    const s = 0.7 + rnd() * 1.1;
    put('rock', x, z, s);
    grid.add(x, z, 0.75 * s);
  }

  const dummy = new THREE.Object3D(), color = new THREE.Color();
  let meshCount = 0;
  for (const data of chunks.values()) {
    for (const kind of ['tree', 'bush', 'rock']) {
      const list = data[kind];
      if (!list.length) continue;
      const im = new THREE.InstancedMesh(geos[kind], VEG_MAT, list.length);
      list.forEach((o, i) => {
        dummy.position.set(o.x, height(o.x, o.z) - 0.05, o.z);
        dummy.rotation.set(0, o.r, 0);
        dummy.scale.setScalar(o.s);
        dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
        im.setColorAt(i, color.setRGB(o.t, o.t * o.g, o.t));
      });
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();   // permite descartar el chunk entero fuera de cámara
      im.matrixAutoUpdate = false;  // estático
      group.add(im);
      meshCount++;
    }
  }

  return {
    group, grid, height, river, meshCount, theme, paths,
    update(t) { for (const fn of animated) fn(t); },
    dispose() {
      scene.remove(group);
      disposables.forEach((d) => d.dispose());
      group.traverse((o) => o.isInstancedMesh && o.dispose());
    },
  };
}
