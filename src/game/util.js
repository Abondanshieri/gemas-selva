// RNG determinista (mulberry32) para que cada nivel genere siempre la misma selva.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Altura del terreno: suave, para que el personaje la siga sin raycasts.
export const heightAt = (x, z) =>
  0.55 * Math.sin(x * 0.13) * Math.cos(z * 0.11) + 0.25 * Math.sin(x * 0.31 + z * 0.27);

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Terreno con lecho de río opcional (la misma función se usa para la malla, los objetos y el jugador).
export const makeHeight = (river) => (!river ? heightAt : (x, z) =>
  heightAt(x, z) - 2.4 * (1 - smooth(river.halfWidth, river.halfWidth + 2.6, Math.abs(z - river.z))));

export const angleLerp = (a, b, t) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

// Rejilla espacial de círculos: colisión barata, solo mira celdas vecinas.
export class ObstacleGrid {
  constructor(cell = 4) { this.cell = cell; this.map = new Map(); }
  _key(cx, cz) { return cx * 73856093 ^ cz * 19349663; }
  add(x, z, r) {
    const cx = Math.floor(x / this.cell), cz = Math.floor(z / this.cell);
    const k = this._key(cx, cz);
    (this.map.get(k) ?? this.map.set(k, []).get(k)).push({ x, z, r });
  }
  resolve(pos, radius) {
    const cx = Math.floor(pos.x / this.cell), cz = Math.floor(pos.z / this.cell);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const list = this.map.get(this._key(cx + i, cz + j));
      if (!list) continue;
      for (const o of list) {
        const dx = pos.x - o.x, dz = pos.z - o.z, min = o.r + radius;
        const d2 = dx * dx + dz * dz;
        if (d2 < min * min && d2 > 1e-6) {
          const d = Math.sqrt(d2), push = (min - d) / d;
          pos.x += dx * push; pos.z += dz * push;
        }
      }
    }
  }
}
