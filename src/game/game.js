import * as THREE from 'three';
import { buildWorld, ANCHOR_Y } from './world.js';
import { createPlayer, createGem, createTotem, createExit, createPad, createRope } from './props.js';
import { createInput } from './input.js';
import { angleLerp } from './util.js';
import { createStore } from '../core/store.js';
import { createInventory, TYPES } from '../core/gems.js';
import { createLevelState } from '../core/levelState.js';
import { formatGoal } from '../core/levelLogic.js';
import { mirror, findPad, padsOf, landsAcross, swingPoint } from '../core/swing.js';
import { sceneOf } from '../levels/index.js';
import { createHud } from '../ui/hud.js';
import { createMinimap } from '../ui/minimap.js';
import { mountBlueprint } from '../ui/blueprint.js';

const SPEED = 5.6, PLAYER_R = 0.4, CAM_DIST = 8.2;
const LASH_T = 0.3, SWING_T = 1.7;
const MAX_PR = Math.min(devicePixelRatio || 1, 1.75);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mainType = (td, ls) => (td.sum ? ls.sumType(td) : TYPES.find((t) => td.goal[t] > 0));

export function createGame({ canvas, hudRoot, overlay, bpRoot, onWin, onNext, onMenu }) {
  // ---------- Renderer (una sola vez) ----------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: MAX_PR < 1.5, powerPreference: 'high-performance' });
  let pr = MAX_PR;
  const camera = new THREE.PerspectiveCamera(55, 1, 0.3, 70);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa8d8b9);
  scene.fog = new THREE.Fog(0xa8d8b9, 22, 62);
  scene.add(new THREE.HemisphereLight(0xeaffe0, 0x2a4a30, 1.5));
  const sun = new THREE.DirectionalLight(0xfff0c0, 1.6);
  sun.position.set(30, 50, 20);
  scene.add(sun);

  const player = createPlayer();
  scene.add(player.root);
  const rope = createRope();
  scene.add(rope.object);

  // ---------- Estado ----------
  const store = createStore(createInventory());
  let level = null, def = null, world = null, ls = null;
  let gems = [], totems = [], exits = [], pads = [], padPts = [];
  const collected = new Set();
  let mode = 'menu';            // 'menu' | 'play' | 'blueprint'
  let busy = false, won = false, swing = null, hintTimer = 0;
  let action = { kind: null, ref: null, anchor: null };
  const pos = new THREE.Vector3();
  let yaw = 0, heading = 0, pitch = 0.58, side = 1;
  let raf = 0, last = performance.now(), t = 0, frames = 0, acc = 0, mapT = 0;
  const camPos = new THREE.Vector3();
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), proj = new THREE.Vector3();

  const resize = () => {
    renderer.setPixelRatio(pr);
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    if (!raf && world) renderer.render(scene, camera); // con el blueprint abierto el lienzo debe seguir pintado
  };

  // ---------- UI ----------
  const hud = createHud(hudRoot, {
    onBlueprint: () => openBlueprint(),
    onInteract: () => interact(),
    onRestart: () => level && loadLevel(level),
    onNext: () => onNext?.(level),
    onMenu: () => { hud.closeDeposit(true); pause(); onMenu?.(); },
  });
  const drawMinimap = createMinimap(hud.minimapCanvas);
  const input = createInput(hud.touchLayer, {
    onInteract: () => interact(),
    onBlueprint: () => (mode === 'blueprint' ? closeBlueprint() : openBlueprint()),
  });
  const bp = mountBlueprint(bpRoot, { store, goal: {}, onClose: () => closeBlueprint() });

  function pause() {
    cancelAnimationFrame(raf); raf = 0;
    input.reset();
    if (mode === 'play') mode = 'menu';
  }
  function resume() {
    mode = 'play'; last = performance.now();
    if (!raf) raf = requestAnimationFrame(loop);
  }
  function openBlueprint() {
    if (mode !== 'play' || busy || won) return;
    mode = 'blueprint';
    hud.setBubble(null);
    cancelAnimationFrame(raf); raf = 0; // el último cuadro queda visible tras la ventana: no se gasta GPU
    input.reset();
    overlay.hidden = false;
  }
  function closeBlueprint() {
    if (mode !== 'blueprint') return;
    overlay.hidden = true;
    resume();
  }

  // ---------- Refrescos de estado ----------
  function refreshTotems() {
    const inv = store.get();
    for (const x of totems) {
      const td = x.def;
      const n = ls.deposits[td.id] ?? 0, got = td.sum ? ls.groupTotal(td.sum) : 0;
      x.setState({ done: ls.isDone(td), n, got });
      x.setReady(!ls.isDone(td) && (td.sum ? ls.maxDeposit(td, inv) >= 1 : ls.canDeliver(td, inv)));
    }
  }
  function refreshGoals() {
    hud.setSummary(ls.summary(def.id));
    bp.setGoal(ls.remaining());
    refreshTotems();
  }
  store.subscribe((inv) => {
    hud.setInventory(inv);
    if (!ls) return;
    for (const x of totems) {
      const td = x.def;
      x.setReady(!ls.isDone(td) && (td.sum ? ls.maxDeposit(td, inv) >= 1 : ls.canDeliver(td, inv)));
    }
  });

  // ---------- Niveles y escenas ----------
  function disposeScene() {
    for (const g of gems) scene.remove(g.object);
    for (const x of totems) { scene.remove(x.object); x.dispose(); }
    for (const x of exits) { scene.remove(x.object); x.dispose(); }
    for (const x of pads) { scene.remove(x.object); x.dispose(); }
    gems = []; totems = []; exits = []; pads = []; padPts = [];
    world?.dispose();
  }

  function loadScene(id, spawn) {
    disposeScene();
    def = sceneOf(level, id);
    world = buildWorld(scene, def);
    const h = world.height;
    scene.background.set(world.theme.sky);
    scene.fog.color.set(world.theme.sky);

    def.gems.forEach((g, i) => {
      const gid = `${level.id}/${def.id}/${i}`;
      if (collected.has(gid)) return;
      const gem = createGem(g.type, g.pos[0], g.pos[1], h, gid);
      scene.add(gem.object); gems.push(gem);
    });
    for (const td of def.totems) {
      const x = createTotem(td, h, td.sum ? { type: ls.sumType(td), total: ls.sums.get(td.sum).total } : null);
      world.grid.add(x.x, x.z, 1.4);
      scene.add(x.object); totems.push(x);
    }
    for (const e of def.exits) {
      const x = createExit(e, h);
      world.grid.add(x.x, x.z, 1.0);
      scene.add(x.object); exits.push(x);
    }
    if (world.river) {
      for (const a of world.river.anchors) {
        for (const p of padsOf({ x: a.x, z: world.river.z }, world.river)) {
          const pad = createPad(p.x, p.z, h);
          scene.add(pad.object); pads.push(pad); padPts.push({ x: p.x, z: p.z });
        }
      }
    }

    const [sx, sz] = spawn ?? def.playerStart;
    pos.set(sx, h(sx, sz), sz);
    side = world.river ? Math.sign(sz - world.river.z) || 1 : 1;
    // Mirar hacia lo importante: el río si lo hay; si no, el primer tótem/gema/salida.
    const look = world.river ? [world.river.anchors[0].x, world.river.z] : (def.totems[0]?.pos ?? def.gems[0]?.pos ?? def.exits[0]?.pos ?? [0, -10]);
    yaw = Math.atan2(sx - look[0], sz - look[1]);
    heading = yaw + Math.PI;
    camPos.set(pos.x + Math.sin(yaw) * 4, pos.y + 6, pos.z + Math.cos(yaw) * 4);
    action = { kind: null, ref: null, anchor: null }; hud.setBubble(null);
    refreshGoals();
  }

  function loadLevel(lv) {
    level = lv; won = false; busy = false; swing = null;
    hud.closeDeposit(); rope.hide(); player.pose(false);
    disposeScene();            // antes de tocar el estado: los tótems viejos no deben consultar el nivel nuevo
    collected.clear();
    ls = createLevelState(lv);
    overlay.hidden = true; hud.hideWin();
    store.set(createInventory(lv.start));
    bp.clearNet();
    loadScene(lv.firstScene);
    hud.setHint(lv.hint);
    clearTimeout(hintTimer); hintTimer = setTimeout(() => hud.setHint(''), 9000);
    resize();
    resume();
  }

  async function travel(exit) {
    busy = true; input.reset(); hud.setBubble(null);
    hud.fade(true); await sleep(280);
    loadScene(exit.def.to, exit.def.spawn);
    await sleep(80);
    hud.fade(false);
    hud.toast(`📍 ${def.name}`);
    busy = false;
  }

  // ---------- Acciones ----------
  function checkWin() {
    if (!ls.complete()) return false;
    won = true; hud.setBubble(null); action = { kind: null, ref: null, anchor: null };
    const extra = Object.entries(store.get()).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k}`).join(' · ');
    onWin?.(level);
    hud.showWin(`¡Nivel ${level.id} superado!`, extra ? `Te sobraron ${extra}.` : 'Entrega exacta.', level.id < 4);
    return true;
  }

  function deliver(x) {
    const td = x.def;
    if (!ls.canDeliver(td, store.get())) {
      hud.toast(`Este tótem pide ${formatGoal(td.goal)}. Usa Mezclar.`);
      return;
    }
    store.set(ls.deliver(td, store.get()));
    refreshGoals();
    if (!checkWin()) {
      const { done, total } = ls.progress();
      hud.toast(`¡Tótem activado! ${done}/${total}`);
    }
  }

  function openDeposit(x) {
    const td = x.def, type = ls.sumType(td), s = ls.sums.get(td.sum);
    const max = ls.maxDeposit(td, store.get());
    if (max < 1) {
      const have = store.get()[type];
      hud.toast(have < 1 ? `No llevas gemas ${type} para depositar.` : `Deja al menos ${s.minEach} ${type} para el otro tótem.`);
      return;
    }
    const group = ls.totems.filter((o) => o.sum === td.sum);
    busy = true; input.reset(); hud.setBubble(null);
    hud.openDeposit({
      title: `Depositar en ${td.label ?? 'el tótem'}`,
      sub: `Entre los tótems hay que sumar ${s.total} ${type}. Tú eliges el reparto.`,
      type, min: 1, max,
      initial: Math.max(1, Math.min(max, Math.ceil(s.total / 2) - (ls.deposits[td.id] ?? 0))),
      split: (n) => `${group.map((o) => `${o.short} ${(ls.deposits[o.id] ?? 0) + (o.id === td.id ? n : 0)}`).join(' + ')} = ${ls.groupTotal(td.sum) + n} / ${s.total}`,
      onConfirm: (n) => {
        store.set(ls.deposit(td, n, store.get()));
        refreshGoals();
        busy = false;
        if (!checkWin()) hud.toast(ls.groupComplete(td.sum) ? '¡Suma completa!' : `+${n} ${type} · suma ${ls.groupTotal(td.sum)}/${s.total}`);
      },
      onCancel: () => { busy = false; },
    });
  }

  function startSwing(hit) {
    const river = world.river;
    const anchor = { x: hit.anchor.x, z: river.z };
    const p0 = { x: pos.x, z: pos.z }, p1 = mirror(p0, anchor);
    if (!landsAcross(p0, p1, river)) { hud.toast('Colócate sobre el aro verde de la orilla.'); return; }
    swing = {
      u: 0, p0, p1,
      y0: pos.y, y1: world.height(p1.x, p1.z),
      anchor: new THREE.Vector3(anchor.x, ANCHOR_Y, anchor.z),
    };
    heading = Math.atan2(p1.x - p0.x, p1.z - p0.z);
    player.pose(true);
    input.reset(); hud.setBubble(null);
  }

  function interact() {
    if (mode !== 'play' || busy || won || swing) return;
    if (action.kind === 'pad') startSwing(action.ref);
    else if (action.kind === 'totem') (action.ref.isSum ? openDeposit : deliver)(action.ref);
    else if (action.kind === 'exit') travel(action.ref);
  }

  // ---------- Bucle ----------
  const f = new THREE.Vector3(), r = new THREE.Vector3(), dir = new THREE.Vector3(), want = new THREE.Vector3();

  function updateSwing(dt) {
    const s = swing;
    s.u += dt;
    const hand = tmpA.set(pos.x, pos.y + 1.6, pos.z);
    if (s.u < LASH_T) { // el látigo vuela hacia el aro
      hand.set(s.p0.x, s.y0 + 1.6, s.p0.z);
      rope.set(hand, tmpB.copy(hand).lerp(s.anchor, s.u / LASH_T));
      return;
    }
    const k = Math.min(1, (s.u - LASH_T) / SWING_T);
    const p = swingPoint(s.p0, s.p1, k);
    pos.set(p.x, s.y0 + (s.y1 - s.y0) * k + p.lift, p.z);
    rope.set(tmpA.set(pos.x, pos.y + 1.6, pos.z), s.anchor);
    if (k >= 1) { // aterriza
      pos.set(s.p1.x, s.y1, s.p1.z);
      swing = null; rope.hide(); player.pose(false);
      side = Math.sign(pos.z - world.river.z) || 1;
      hud.toast('¡Al otro lado!', 1400);
    }
  }

  const bubbleHtml = {
    totem: (x) => (x.isSum ? `Depositar ${ls.sumType(x.def)}` : `Entregar · ${formatGoal(x.def.goal)}`),
    pad: () => 'Látigo',
    exit: (e) => `→ ${e.def.label}`,
  };

  function updateAction() {
    let next = { kind: null, ref: null, anchor: null };
    if (!won && !swing && !busy) {
      if (world.river) {
        const anchors = world.river.anchors.map((a) => ({ x: a.x, z: world.river.z }));
        const hit = findPad(pos, anchors, world.river);
        if (hit) next = { kind: 'pad', ref: hit, anchor: tmpA.set(hit.pad.x, world.height(hit.pad.x, hit.pad.z) + 2.6, hit.pad.z).clone() };
      }
      if (!next.kind) {
        for (const x of totems) {
          if (!ls.isDone(x.def) && (x.x - pos.x) ** 2 + (x.z - pos.z) ** 2 < 3.6 * 3.6) {
            next = { kind: 'totem', ref: x, anchor: x.object.position.clone().setY(x.object.position.y + 2.7) }; break;
          }
        }
      }
      if (!next.kind) {
        for (const e of exits) {
          if ((e.x - pos.x) ** 2 + (e.z - pos.z) ** 2 < e.radius * e.radius) {
            next = { kind: 'exit', ref: e, anchor: e.object.position.clone().setY(e.object.position.y + 3.2) }; break;
          }
        }
      }
    }
    if (next.kind !== action.kind || next.ref !== action.ref) {
      action = next;
      hud.setBubble(next.kind ? { kind: next.kind, html: bubbleHtml[next.kind](next.ref) } : null);
    }
    // La burbuja sigue al objeto en pantalla (proyección mundo → píxeles).
    if (action.kind) {
      proj.copy(action.anchor).project(camera);
      if (proj.z > 1) hud.setBubble(null), (action = { kind: null, ref: null, anchor: null });
      else {
        const x = Math.min(innerWidth - 90, Math.max(90, (proj.x * 0.5 + 0.5) * innerWidth));
        const y = Math.min(innerHeight - 20, Math.max(112, (-proj.y * 0.5 + 0.5) * innerHeight));
        hud.placeBubble(x, y);
      }
    }
  }

  function updateMinimap(now) {
    if (now - mapT < 66) return;
    mapT = now;
    drawMinimap({
      pos, yaw, bounds: def.bounds, river: world.river, paths: world.paths, pads: padPts,
      ground: `#${world.theme.g2.toString(16).padStart(6, '0')}`,
      gems: gems.map((g) => ({ x: g.x, z: g.z, type: g.type })),
      exits: exits.map((e) => ({ x: e.x, z: e.z })),
      totems: totems.map((x) => ({ x: x.x, z: x.z, type: mainType(x.def, ls), done: ls.isDone(x.def) })),
    });
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now; t += dt;

    // Resolución adaptativa: si el móvil va justo baja el pixel ratio; si sobra lo sube.
    acc += dt; frames++;
    if (frames === 90) {
      const avg = acc / frames;
      if (avg > 0.026 && pr > 1) { pr = Math.max(1, pr - 0.25); resize(); }
      else if (avg < 0.015 && pr < MAX_PR) { pr = Math.min(MAX_PR, pr + 0.25); resize(); }
      frames = 0; acc = 0;
    }

    const inp = input.read();
    yaw -= inp.lookX * 0.005;
    pitch = Math.min(1.1, Math.max(0.18, pitch + inp.lookY * 0.004));

    let mag = 0;
    if (swing) {
      updateSwing(dt);
      player.shadow.position.y = (world.height(pos.x, pos.z) - pos.y) + 0.03;
    } else {
      // Movimiento relativo a la cámara
      f.set(-Math.sin(yaw), 0, -Math.cos(yaw));
      r.set(Math.cos(yaw), 0, -Math.sin(yaw));
      dir.set(0, 0, 0).addScaledVector(r, inp.x).addScaledVector(f, inp.y);
      mag = Math.min(1, dir.length());
      if (!won && !busy && mag > 0.05) {
        dir.normalize();
        pos.addScaledVector(dir, SPEED * mag * dt);
        heading = angleLerp(heading, Math.atan2(dir.x, dir.z), Math.min(1, dt * 14));
      } else mag = 0;
      const d = Math.hypot(pos.x, pos.z);
      if (d > def.bounds) { pos.x *= def.bounds / d; pos.z *= def.bounds / d; }
      world.grid.resolve(pos, PLAYER_R);
      if (world.river) { // el agua es una barrera: solo se cruza con el látigo
        const lim = world.river.halfWidth + 0.4, dz = pos.z - world.river.z;
        if (Math.abs(dz) < lim) pos.z = world.river.z + side * lim; else side = Math.sign(dz);
      }
      pos.y = world.height(pos.x, pos.z);
      player.shadow.position.y = 0.03;
      player.animate(t, mag);
    }
    player.root.position.copy(pos);
    player.body.rotation.y = heading;

    // Cámara en tercera persona con suavizado
    want.set(
      pos.x + Math.sin(yaw) * Math.cos(pitch) * CAM_DIST,
      pos.y + 1.5 + Math.sin(pitch) * CAM_DIST,
      pos.z + Math.cos(yaw) * Math.cos(pitch) * CAM_DIST,
    );
    camPos.lerp(want, 1 - Math.exp(-dt * 10));
    camera.position.copy(camPos);
    camera.lookAt(pos.x, pos.y + 1.4, pos.z);

    // Gemas: recogida por cercanía
    for (let i = gems.length - 1; i >= 0; i--) {
      const g = gems[i];
      g.update(t);
      if (!swing && (g.x - pos.x) ** 2 + (g.z - pos.z) ** 2 < 1.5 * 1.5) {
        collected.add(g.id);
        scene.remove(g.object); gems.splice(i, 1);
        store.set({ ...store.get(), [g.type]: store.get()[g.type] + 1 });
        hud.toast(`+1 ${g.type}`, 1500);
      }
    }
    for (const x of totems) x.update(t);
    for (const x of exits) x.update(t);
    for (const x of pads) x.update(t);
    world.update(t);

    renderer.render(scene, camera);   // primero se dibuja; luego se proyecta la burbuja con la cámara ya actualizada
    camera.updateMatrixWorld();
    updateAction();
    updateMinimap(now);
  }

  addEventListener('resize', resize);
  resize();

  return {
    loadLevel, pause, resume, store, renderer, scene, camera,
    get mode() { return mode; },
    get info() { return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, pr, chunks: world?.meshCount, scene: def?.id }; },
    // --- ayudas de depuración / pruebas ---
    get pos() { return pos; }, get ls() { return ls; },
    get gems() { return gems; }, get totems() { return totems; }, get exits() { return exits; },
    get swinging() { return !!swing; }, get won() { return won; }, get action() { return action.kind; },
    teleport(x, z) { pos.set(x, world.height(x, z), z); side = world.river ? Math.sign(z - world.river.z) || 1 : 1; },
  };
}
