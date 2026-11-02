// Definición de niveles. Cada nivel es UN mundo circular dividido en CAPAS apiladas de norte a sur
// (pradera alta · bosque · bosque profundo). Las capas conviven en el mismo mapa a distinta altura:
// entre ellas hay acantilados y RAMPAS por donde se sube y se baja, sin pantallas de carga.
//
// Coordenadas en metros (x derecha, z hacia el sur / hacia la cámara inicial).
// world: radius, zones[{id,name,theme,elevation,z1}], ramps[{boundary,x}], rivers[{x,halfWidth,anchors:[{z}],waterfall}]
//   · z1 = límite sur de la capa; boundary = índice del límite que cruza la rampa.
//   · El río es perpendicular a las capas: las parte TODAS por la mitad en orilla Oeste y orilla Este;
//     se cruza con el látigo desde los aros. Las rampas alternan de orilla (arriba al Este, abajo al Oeste).
// Tótem exacto: { goal }. Tótem de suma: { sum: id } y el nivel declara sums: [{ id, type, total, minEach }].

const PRADERA = { id: 'pradera', name: 'Pradera', theme: 'pradera', elevation: 4.5 };
const BOSQUE = { id: 'bosque', name: 'Bosque', theme: 'bosque', elevation: 0 };
const PROFUNDO = { id: 'profundo', name: 'Bosque profundo', theme: 'profundo', elevation: -4.5 };
// Un único río que corre de norte a sur (x fijo) y cruza TODAS las capas; cae en cascada en cada acantilado.
// anchors = alturas z de los aros de balanceo (el aro cuelga sobre el río).
const river = (anchorsZ, o = {}) => ({ x: 0, halfWidth: 3.5, anchors: anchorsZ.map((z) => ({ z })), waterfall: true, ...o });

const ring = (n, r, cx = 0, cz = 0, type = 'D', phase = 0.4) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + phase;
    return { type, pos: [+(cx + Math.cos(a) * r).toFixed(1), +(cz + Math.sin(a) * r).toFixed(1)] };
  });

// ---------- Nivel 1: dos capas. El tótem pide 5 U, en el mapa solo hay una D (arriba, en la pradera) ----------
const level1 = {
  id: 1,
  name: 'La pradera alta',
  topic: 'Descomponer',
  hint: 'El tótem pide 5 U, pero solo ves una D… ¿y si la descompones? Sube a la pradera por la rampa. Camina sin parar y ganas +30 % de velocidad. Ojo: bajar de un acantilado es caerse.',
  start: {},
  firstScene: 'mundo',
  scenes: [{
    id: 'mundo', name: 'Mundo', seed: 7, radius: 34, bounds: 31, playerStart: [0, 12],
    zones: [{ ...PRADERA, z1: -4 }, { ...BOSQUE, z1: 40 }],
    ramps: [{ boundary: 0, x: 12 }],
    rivers: [],
    gems: [{ type: 'D', pos: [6, -20] }],
    totems: [{ id: 't1', short: 'U', pos: [-12, 18], goal: { U: 5 } }],
  }],
};

// ---------- Nivel 2: tres capas, un tótem por tipo (C arriba, D en medio, U abajo) ----------
const level2 = {
  id: 2,
  name: 'Tres capas',
  topic: 'Componer y descomponer',
  hint: 'Pradera, bosque y bosque profundo: un tótem por capa (C, D y U). Las gemas se reparten entre ellas.',
  start: {},
  firstScene: 'mundo',
  scenes: [{
    id: 'mundo', name: 'Mundo', seed: 21, radius: 48, bounds: 45, playerStart: [-10, 12],
    zones: [{ ...PRADERA, z1: -16 }, { ...BOSQUE, z1: 16 }, { ...PROFUNDO, z1: 60 }],
    ramps: [{ boundary: 0, x: 18 }, { boundary: 1, x: -18 }],
    rivers: [],
    gems: [
      ...ring(5, 9, 0, -30, 'D', 0.4),                       // pradera
      ...ring(5, 9, 0, 0, 'D', 1.1),                         // bosque
      ...ring(4, 9, 0, 32, 'D', 2.2),                        // bosque profundo
      { type: 'U', pos: [-14, 28] }, { type: 'U', pos: [14, 36] },
    ],
    totems: [
      { id: 'tC', short: 'C', label: 'Tótem C · pradera', pos: [0, -30], goal: { C: 1 } },
      { id: 'tD', short: 'D', label: 'Tótem D · bosque', pos: [0, 0], goal: { D: 3 } },
      { id: 'tU', short: 'U', label: 'Tótem U · profundo', pos: [0, 32], goal: { U: 4 } },
    ],
  }],
};

// ---------- Nivel 3: un río de norte a sur parte todas las capas; los dos tótems suman 8 U (8+0, 7+1, 4+4…) ----------
const level3 = {
  id: 3,
  name: 'El río partido',
  topic: 'Suma entre orillas',
  hint: 'Un río cruza todo el mundo y lo parte en Oeste y Este. Entre los dos tótems hay que reunir 8 U (8+0, 7+1, 4+4…). La D que te falta está abajo, en el bosque profundo del lado oeste.',
  start: {},
  firstScene: 'mundo',
  sums: [{ id: 'suma', type: 'U', total: 8, minEach: 0 }],
  scenes: [{
    id: 'mundo', name: 'Mundo', seed: 33, radius: 48, bounds: 45, playerStart: [12, -9],
    zones: [{ ...PRADERA, z1: -16 }, { ...BOSQUE, z1: 16 }, { ...PROFUNDO, z1: 60 }],
    ramps: [{ boundary: 0, x: 18 }, { boundary: 1, x: -18 }],   // arriba se sube por el Este; abajo se baja por el Oeste
    rivers: [river([0])],                                        // el aro está en el bosque: ahí se cruza
    gems: [
      { type: 'U', pos: [12, -30] }, { type: 'U', pos: [26, -28] },   // pradera (este)
      { type: 'U', pos: [26, -2] },                                    // bosque, orilla este
      { type: 'D', pos: [-14, 32] },                                   // bosque profundo (oeste): se llega cruzando el río
    ],
    totems: [
      { id: 'tW', short: 'Oeste', label: 'Orilla oeste', pos: [-12, 6], sum: 'suma' },
      { id: 'tE', short: 'Este', label: 'Orilla este', pos: [12, 8], sum: 'suma' },
    ],
  }],
};

// ---------- Nivel 4: tres capas partidas por UN solo río; seis orillas, seis tótems, tres aros ----------
const level4 = {
  id: 4,
  name: 'El gran río',
  topic: 'Capas y río',
  hint: 'Cada capa pide 4 U entre sus dos tótems; tú eliges cómo repartirlas. Recoge gemas en todas las capas y descompón una D en el mezclador. Cruza el río con los aros.',
  start: {},
  firstScene: 'mundo',
  sums: ['pradera', 'bosque', 'profundo'].map((id) => ({ id, type: 'U', total: 4, minEach: 0 })),
  scenes: [{
    id: 'mundo', name: 'Mundo', seed: 45, radius: 50, bounds: 47, playerStart: [12, -9],
    zones: [{ ...PRADERA, z1: -16 }, { ...BOSQUE, z1: 16 }, { ...PROFUNDO, z1: 60 }],
    ramps: [{ boundary: 0, x: 20 }, { boundary: 1, x: -20 }],
    rivers: [river([-32, 0, 32])],
    gems: [
      { type: 'D', pos: [16, -28] },      // pradera (este)
      { type: 'U', pos: [30, -8] },       // bosque (este)
      { type: 'D', pos: [-14, 36] },      // bosque profundo (oeste)
      { type: 'U', pos: [32, 28] },       // bosque profundo (este)
    ],
    totems: [   // cada capa pide 4 U entre sus dos tótems (el reparto Oeste/Este es libre)
      { id: 'pO', short: 'O', label: 'Pradera · oeste', pos: [-14, -38], sum: 'pradera' },
      { id: 'pE', short: 'E', label: 'Pradera · este', pos: [14, -40], sum: 'pradera' },
      { id: 'bO', short: 'O', label: 'Bosque · oeste', pos: [-26, 6], sum: 'bosque' },
      { id: 'bE', short: 'E', label: 'Bosque · este', pos: [26, 5], sum: 'bosque' },
      { id: 'dO', short: 'O', label: 'Profundo · oeste', pos: [-32, 30], sum: 'profundo' },
      { id: 'dE', short: 'E', label: 'Profundo · este', pos: [22, 38], sum: 'profundo' },
    ],
  }],
};

export const LEVELS = [level1, level2, level3, level4];
export const sceneOf = (level, id) => level.scenes.find((s) => s.id === id);
