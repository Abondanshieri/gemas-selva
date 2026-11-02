import * as THREE from 'three';
import { TYPES } from '../core/gems.js';

const lam = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });

export const GEM_COLOR = { U: 0x3ddc84, D: 0xffb938, C: 0xff5d8f };
const CSS_COLOR = { U: '#3ddc84', D: '#ffb938', C: '#ff5d8f' };

// ---------- Personaje (explorador low-poly) ----------
export function createPlayer() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.55, 3, 8), lam(0x1f8a8a));
  body.position.y = 0.95;
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 1), lam(0xe0ac84));
  head.position.y = 1.6;
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 10), lam(0xc9a24b));
  hat.position.y = 1.78;
  const hatTop = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.2, 10), lam(0xc9a24b));
  hatTop.position.y = 1.88;
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.22), lam(0x7a4b2a));
  pack.position.set(0, 1.0, -0.38);
  const legMat = lam(0x3b3f4a);
  const legs = [-0.15, 0.15].map((x) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.62, 0);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.22), legMat);
    leg.position.y = -0.31;
    pivot.add(leg);
    return pivot;
  });
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 14).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
  shadow.position.y = 0.03;
  g.add(body, head, hat, hatTop, pack, ...legs);
  const root = new THREE.Group();
  root.add(g, shadow);
  return {
    root, body: g, shadow,
    animate(t, speed) {
      const s = Math.sin(t * 11) * 0.7 * speed;
      legs[0].rotation.x = s; legs[1].rotation.x = -s;
      g.position.y = Math.abs(Math.sin(t * 11)) * 0.06 * speed;
    },
    pose(swinging) { // piernas recogidas durante el balanceo
      if (swinging) { legs[0].rotation.x = legs[1].rotation.x = -0.7; g.rotation.x = 0.15; }
      else g.rotation.x = 0;
    },
  };
}

// ---------- Gemas 3D (geometrías y materiales compartidos) ----------
const gemGeo = {
  U: new THREE.OctahedronGeometry(0.34, 0),
  D: new THREE.CylinderGeometry(0.4, 0.4, 0.55, 6),
  C: new THREE.IcosahedronGeometry(0.55, 0),
};
const beamGeo = new THREE.CylinderGeometry(0.22, 0.22, 7, 8, 1, true);
const gemMats = {}, beamMats = {};
for (const t of TYPES) {
  gemMats[t] = lam(GEM_COLOR[t], { emissive: GEM_COLOR[t], emissiveIntensity: 0.55 });
  beamMats[t] = new THREE.MeshBasicMaterial({ color: GEM_COLOR[t], transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
}

export function createGem(type, x, z, height, id) {
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(gemGeo[type], gemMats[type]);
  mesh.position.y = 1.0;
  const beam = new THREE.Mesh(beamGeo, beamMats[type]);
  beam.position.y = 3.5;
  g.add(mesh, beam);
  g.position.set(x, height(x, z), z);
  const phase = (x * 7 + z * 3) % 6.28;
  return {
    id, type, x, z, object: g, alive: true,
    update(t) { mesh.rotation.y = t * 1.6; mesh.position.y = 1.0 + Math.sin(t * 2.2 + phase) * 0.14; },
  };
}

// ---------- Baliza de luz (se ve desde lejos a través de la vegetación) ----------
const beaconGeo = new THREE.CylinderGeometry(0.5, 0.5, 16, 10, 1, true);
export function createBeacon(color, opacity = 0.2) {
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(beaconGeo, m);
  mesh.position.y = 8;
  return { mesh, material: m };
}

// ---------- Cartel del tótem (canvas → sprite) ----------
function goalSprite({ title, goal, done, sum }) {
  const c = document.createElement('canvas'); c.width = 384; c.height = 176;
  const g = c.getContext('2d');
  g.fillStyle = done ? '#1d6b3fee' : '#0e2218ee';
  g.beginPath(); g.roundRect(4, 4, 376, 168, 34); g.fill();
  g.lineWidth = 4; g.strokeStyle = done ? '#7dffb0' : '#ffffff40'; g.stroke();
  g.textAlign = 'center'; g.fillStyle = '#f1ead2';
  g.font = '600 24px "DM Sans", system-ui, sans-serif';
  g.fillText(title + (done ? ' · listo' : ''), 192, 40);
  if (sum) {
    g.fillStyle = CSS_COLOR[sum.type];
    g.font = '800 54px "Plus Jakarta Sans", system-ui, sans-serif';
    g.fillText(`${sum.n} ${sum.type}`, 192, 108);
    g.fillStyle = '#f1ead2'; g.font = '600 24px "DM Sans", system-ui, sans-serif';
    g.fillText(`suma ${sum.got} / ${sum.total}`, 192, 150);
  } else {
    const parts = TYPES.filter((t) => goal[t] > 0);
    const w = 112, x0 = 192 - (parts.length * w) / 2 + w / 2;
    g.font = '800 46px "Plus Jakarta Sans", system-ui, sans-serif';
    parts.forEach((t, i) => { g.fillStyle = CSS_COLOR[t]; g.fillText(`${goal[t]} ${t}`, x0 + i * w, 118); });
    if (done) { g.fillStyle = '#7dffb0'; g.font = '800 54px system-ui'; g.fillText('✓', 340, 118); }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(4.2, 1.93, 1);
  return sp;
}

// ---------- Tótem ----------
// def: { id, pos, label, goal } (exacto) o { id, pos, label, sum } (de suma; sumInfo = { type, total }).
export function createTotem(def, height, sumInfo = null) {
  const [x, z] = def.pos;
  const g = new THREE.Group();
  const stone = lam(0x8f8a78), dark = lam(0x5e5a4c);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.8, 0.4, 8), dark);
  base.position.y = 0.2;
  const parts = [
    [1.1, 1.1, 1.1, 0.95, 0.35, stone],
    [0.95, 0.95, 0.95, 1.95, -0.2, dark],
    [0.8, 0.8, 0.8, 2.85, 0.25, stone],
  ].map(([w, h, d, y, rot, m]) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.y = y; b.rotation.y = rot; return b;
  });
  const mainType = sumInfo ? sumInfo.type : TYPES.find((t) => def.goal[t] > 0);
  const ringMat = new THREE.MeshLambertMaterial({ color: 0x444444, emissive: GEM_COLOR[mainType], emissiveIntensity: 0.1, flatShading: true });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.09, 6, 20), ringMat);
  ring.position.y = 3.6; ring.rotation.x = Math.PI / 2;
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  for (const sx of [-0.2, 0.2]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.05), eyeMat);
    eye.position.set(sx, 2.95, 0.42);
    g.add(eye);
  }
  const beacon = createBeacon(GEM_COLOR[mainType], 0.22);
  const title = def.label ?? 'Tótem';
  let spec = { title, goal: def.goal, done: false, sum: sumInfo ? { type: sumInfo.type, n: 0, got: 0, total: sumInfo.total } : null };
  let sprite = goalSprite(spec);
  sprite.position.y = 6.0;
  g.add(base, ...parts, ring, sprite, beacon.mesh);
  g.position.set(x, height(x, z), z);

  const api = {
    id: def.id, def, x, z, object: g, done: false, ready: false, isSum: !!sumInfo,
    _paint() {
      const on = this.ready || this.done;
      ringMat.emissiveIntensity = on ? 1.4 : 0.1;
      ringMat.color.set(this.done ? 0x3ddc84 : this.ready ? GEM_COLOR[mainType] : 0x444444);
      ringMat.emissive.set(this.done ? 0x3ddc84 : GEM_COLOR[mainType]);
      beacon.material.color.set(this.done ? 0x7dffb0 : GEM_COLOR[mainType]);
      beacon.material.opacity = this.done ? 0.1 : this.ready ? 0.4 : 0.22;
    },
    _redraw() {
      g.remove(sprite); sprite.material.map.dispose(); sprite.material.dispose();
      sprite = goalSprite(spec); sprite.position.y = 6.0; g.add(sprite);
    },
    setReady(ready) { this.ready = ready; this._paint(); },
    // Estado visual: done (exacto o grupo completo); n/got para los tótems de suma.
    setState({ done, n = 0, got = 0 }) {
      this.done = done;
      spec = { ...spec, done, sum: spec.sum ? { ...spec.sum, n, got } : null };
      this._redraw(); this._paint();
    },
    update(t) { ring.rotation.z = t * 1.2; ring.position.y = 3.6 + Math.sin(t * 2) * 0.08; },
    dispose() { sprite.material.map.dispose(); sprite.material.dispose(); beacon.material.dispose(); },
  };
  api._paint();
  return api;
}

// ---------- Salida a otra escena (arco de piedra con portal) ----------
export function createExit(def, height) {
  const [x, z] = def.pos;
  const g = new THREE.Group();
  const stone = lam(0x7d7a68);
  for (const sx of [-1.5, 1.5]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.7, 3.6, 0.7), stone);
    p.position.set(sx, 1.8, 0); g.add(p);
  }
  const top = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.7, 0.9), stone);
  top.position.y = 3.8; g.add(top);
  const veilMat = new THREE.MeshBasicMaterial({ color: 0x7dffe0, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 3.4), veilMat);
  veil.position.y = 1.75; g.add(veil);
  const beacon = createBeacon(0x7dffe0, 0.18);
  g.add(beacon.mesh);
  g.position.set(x, height(x, z), z);
  g.lookAt(g.position.x, g.position.y, g.position.z + 1);
  return { def, x, z, object: g, radius: 3.4, update(t) { veilMat.opacity = 0.22 + Math.sin(t * 2.5) * 0.08; }, dispose() { veilMat.dispose(); beacon.material.dispose(); } };
}

// ---------- Zona de lanzamiento del látigo (anillo en el suelo) ----------
export function createPad(x, z, height) {
  const m = new THREE.MeshBasicMaterial({ color: 0x3ddc84, transparent: true, opacity: 0.7, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.7, 2.1, 24).rotateX(-Math.PI / 2), m);
  ring.position.set(x, height(x, z) + 0.08, z);
  return { object: ring, update(t) { m.opacity = 0.45 + Math.sin(t * 3) * 0.25; }, dispose() { ring.geometry.dispose(); m.dispose(); } };
}

// ---------- Cuerda del látigo ----------
export function createRope() {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1, 5), lam(0xd9b36a));
  m.visible = false;
  const up = new THREE.Vector3(0, 1, 0), d = new THREE.Vector3();
  return {
    object: m,
    set(a, b) {
      d.subVectors(b, a);
      const len = d.length();
      m.position.copy(a).addScaledVector(d, 0.5);
      m.scale.set(1, Math.max(0.01, len), 1);
      m.quaternion.setFromUnitVectors(up, d.normalize());
      m.visible = true;
    },
    hide() { m.visible = false; },
  };
}
