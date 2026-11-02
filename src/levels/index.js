// Definición de niveles. Coordenadas en metros (x derecha, z hacia la cámara inicial).
// Río: recorre el eje X en z = river.z; orilla "N" = z < 0, orilla "S" = z > 0.
// Tótem exacto: { goal }. Tótem de suma: { sum: id } y el nivel declara sums: [{ id, type, total, minEach }].

const RIVER = { z: 0, halfWidth: 3.5 };

const ring = (n, r, cx = 0, cz = -2, type = 'D', phase = 0.4) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + phase;
    return { type, pos: [+(cx + Math.cos(a) * r).toFixed(1), +(cz + Math.sin(a) * r).toFixed(1)] };
  });

// ---------- Nivel 1: solo U pedidas, en el mapa solo una D → descomponer ----------
const level1 = {
  id: 1,
  name: 'El primer claro',
  topic: 'Descomponer',
  hint: 'El tótem pide 5 U, pero solo ves una D… ¿y si la descompones?',
  start: {},
  firstScene: 'claro',
  scenes: [{
    id: 'claro', name: 'Claro', theme: 'selva', seed: 7, bounds: 28, playerStart: [0, 6],
    gems: [{ type: 'D', pos: [13, -5] }],
    totems: [{ id: 't1', short: 'U', pos: [-9, -17], goal: { U: 5 } }],
    exits: [],
  }],
};

// ---------- Nivel 2: 3 escenarios, un tótem por tipo (U, D, C) → componer y descomponer ----------
const level2 = {
  id: 2,
  name: 'Tres claros',
  topic: 'Componer y descomponer',
  hint: 'Tres claros, tres tótems: U, D y C. Las gemas se reparten entre ellos.',
  start: {},
  firstScene: 'verde',
  scenes: [
    {
      id: 'verde', name: 'Claro verde', theme: 'selva', seed: 21, bounds: 24, playerStart: [0, 13],
      gems: [...ring(4, 9), { type: 'U', pos: [-6, 6] }, { type: 'U', pos: [6, 7] }],
      totems: [{ id: 'tU', short: 'U', label: 'Tótem U', pos: [0, -17], goal: { U: 4 } }],
      exits: [{ pos: [19, 2], to: 'ambar', spawn: [-12, 3], label: 'Claro ámbar' }],
    },
    {
      id: 'ambar', name: 'Claro ámbar', theme: 'atardecer', seed: 22, bounds: 24, playerStart: [-12, 3],
      gems: ring(5, 9, 0, 0, 'D', 1.1),
      totems: [{ id: 'tD', short: 'D', label: 'Tótem D', pos: [0, -17], goal: { D: 3 } }],
      exits: [
        { pos: [-19, 2], to: 'verde', spawn: [12, 3], label: 'Claro verde' },
        { pos: [19, 2], to: 'rosa', spawn: [-12, 3], label: 'Claro niebla' },
      ],
    },
    {
      id: 'rosa', name: 'Claro niebla', theme: 'niebla', seed: 23, bounds: 24, playerStart: [-12, 3],
      gems: ring(5, 9, 0, 0, 'D', 2.2),
      totems: [{ id: 'tC', short: 'C', label: 'Tótem C', pos: [0, -17], goal: { C: 1 } }],
      exits: [{ pos: [-19, 2], to: 'ambar', spawn: [12, 3], label: 'Claro ámbar' }],
    },
  ],
};

// ---------- Nivel 3: río partido; los dos tótems suman 8 U (4+4, 5+3, 6+2…) ----------
const level3 = {
  id: 3,
  name: 'El río partido',
  topic: 'Suma entre orillas',
  hint: 'Entre los dos tótems hay que reunir 8 U. Tú eliges cuántas dejas en cada orilla.',
  start: {},
  firstScene: 'rio',
  sums: [{ id: 'suma', type: 'U', total: 8, minEach: 1 }],
  scenes: [{
    id: 'rio', name: 'Río', theme: 'selva', seed: 33, bounds: 30, playerStart: [-3, 14],
    river: { ...RIVER, anchors: [{ x: 0 }], waterfall: true },
    gems: [
      { type: 'D', pos: [14, 15] },
      { type: 'U', pos: [-12, -15] }, { type: 'U', pos: [13, -13] },
    ],
    totems: [
      { id: 'tS', short: 'Sur', label: 'Orilla sur', pos: [-15, 18], sum: 'suma' },
      { id: 'tN', short: 'Norte', label: 'Orilla norte', pos: [13, -19], sum: 'suma' },
    ],
    exits: [],
  }],
};

// ---------- Nivel 4: 3 escenas de río; cada orilla con su tótem y cada escena con su aro de balanceo ----------
const riverScene = (o) => ({ bounds: 30, river: { ...RIVER, anchors: [{ x: 0 }], waterfall: true }, ...o });

const level4 = {
  id: 4,
  name: 'Tres ríos',
  topic: 'Escenas conectadas',
  hint: 'Seis tótems, tres ríos. En cada escena cruza con el látigo. Las gemas están repartidas.',
  start: {},
  firstScene: 'r1',
  scenes: [
    riverScene({
      id: 'r1', name: 'Río alto', theme: 'selva', seed: 45, playerStart: [4, 15],
      gems: [{ type: 'D', pos: [14, 14] }, { type: 'D', pos: [-9, 12] }, { type: 'U', pos: [-12, -15] }],
      totems: [
        { id: 'r1S', short: 'Sur', label: 'Río alto · sur', pos: [-15, 19], goal: { U: 3 } },
        { id: 'r1N', short: 'Norte', label: 'Río alto · norte', pos: [14, -19], goal: { D: 2 } },
      ],
      exits: [{ pos: [22, 12], to: 'r2', spawn: [-20, 14], label: 'Río medio' }],
    }),
    riverScene({
      id: 'r2', name: 'Río medio', theme: 'atardecer', seed: 46, playerStart: [-20, 14],
      gems: [{ type: 'D', pos: [12, 15] }, { type: 'U', pos: [-10, -14] }, { type: 'U', pos: [9, -16] }],
      totems: [
        { id: 'r2S', short: 'Sur', label: 'Río medio · sur', pos: [14, 19], goal: { D: 1, U: 2 } },
        { id: 'r2N', short: 'Norte', label: 'Río medio · norte', pos: [-14, -19], goal: { U: 2 } },
      ],
      exits: [
        { pos: [-24, 8], to: 'r1', spawn: [18, 12], label: 'Río alto' },
        { pos: [24, 8], to: 'r3', spawn: [-20, 14], label: 'Río bajo' },
      ],
    }),
    riverScene({
      id: 'r3', name: 'Río bajo', theme: 'niebla', seed: 47, playerStart: [-20, 14],
      gems: [{ type: 'C', pos: [10, -14] }, { type: 'D', pos: [14, 14] }],
      totems: [
        { id: 'r3S', short: 'Sur', label: 'Río bajo · sur', pos: [-14, 19], goal: { D: 3 } },
        { id: 'r3N', short: 'Norte', label: 'Río bajo · norte', pos: [-12, -19], goal: { U: 1, D: 1 } },
      ],
      exits: [{ pos: [-24, 8], to: 'r2', spawn: [20, 12], label: 'Río medio' }],
    }),
  ],
};

export const LEVELS = [level1, level2, level3, level4];
export const sceneOf = (level, id) => level.scenes.find((s) => s.id === id);
