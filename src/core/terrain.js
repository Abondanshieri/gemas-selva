// Terreno por CAPAS (puro, sin Three.js). Un mundo circular dividido en bandas de norte a sur
// (pradera alta · bosque · bosque profundo) a distinta altura. Entre capas hay acantilados
// (pendiente imposible de trepar) y rampas (corredores suaves por donde se sube y se baja).
//
// world = {
//   radius,
//   zones:  [{ id, name, theme, elevation, z1 }]   // ordenadas de norte (z<0) a sur; z1 = límite sur de la capa
//   ramps:  [{ boundary, x }]                      // boundary = índice del límite entre zones[i] y zones[i+1]
//   rivers: [{ z, halfWidth, anchors, waterfall }]
// }

export const RAMP_W = 12;        // ancho (en z) del tramo inclinado de una rampa
export const CLIFF_W = 2.6;      // ancho del acantilado (pendiente > MAX_SLOPE)
export const RAMP_HALF = 3.5;    // semiancho (en x) del corredor de la rampa
export const MAX_SLOPE = 0.8;    // pendiente máxima que el jugador puede caminar

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Ondulación suave del suelo (la misma que antes, algo atenuada).
export const noise = (x, z) => 0.4 * Math.sin(x * 0.13) * Math.cos(z * 0.11) + 0.2 * Math.sin(x * 0.31 + z * 0.27);

export const zoneByZ = (zones, z) => zones.find((zn, i) => i === zones.length - 1 || z < zn.z1);

export function createTerrain(world) {
  const { zones, ramps = [], rivers = [], radius } = world;

  // 1 dentro del corredor de la rampa, 0 fuera (con un hombro de 3 m).
  const rampMask = (i, x) => ramps.reduce((m, r) => (r.boundary === i
    ? Math.max(m, 1 - smooth(RAMP_HALF, RAMP_HALF + 3, Math.abs(x - r.x))) : m), 0);

  // Altura de las terrazas: escalones suaves; el ancho del escalón crece dentro del corredor de la rampa.
  const terrace = (x, z) => {
    let e = zones[0].elevation;
    for (let i = 0; i < zones.length - 1; i++) {
      const w = CLIFF_W + (RAMP_W - CLIFF_W) * rampMask(i, x), zb = zones[i].z1;
      e += (zones[i + 1].elevation - zones[i].elevation) * smooth(zb - w / 2, zb + w / 2, z);
    }
    return e;
  };
  const carve = (z) => rivers.reduce((s, r) => s - 2.4 * (1 - smooth(r.halfWidth, r.halfWidth + 2.6, Math.abs(z - r.z))), 0);
  const rim = (x, z) => 8 * smooth(radius - 2, radius + 10, Math.hypot(x, z)); // borde: el círculo es un cuenco
  const height = (x, z) => noise(x, z) + terrace(x, z) + carve(z) + rim(x, z);

  // Coordenada continua de capa (0 = primera, n-1 = última): sirve para mezclar ambientes sin saltos.
  const zoneCoord = (z) => { let c = 0; for (let i = 0; i < zones.length - 1; i++) c += smooth(zones[i].z1 - 7, zones[i].z1 + 7, z); return c; };

  const slopeAt = (x, z, e = 0.6) => Math.max(
    Math.abs(height(x + e, z) - height(x - e, z)),
    Math.abs(height(x, z + e) - height(x, z - e)),
  ) / (2 * e);

  return {
    height, terrace, zoneCoord, slopeAt, rampMask,
    zoneAt: (z) => zoneByZ(zones, z),
    waterY: (river) => terrace(0, river.z) - 0.55,
  };
}

// Un paso del jugador respetando acantilados: si es demasiado empinado intenta deslizar por un eje.
export function walk(h, x, z, dx, dz) {
  const h0 = h(x, z);
  const ok = (nx, nz) => {
    const d = Math.hypot(nx - x, nz - z);
    return d < 1e-6 || Math.abs(h(nx, nz) - h0) / d <= MAX_SLOPE;
  };
  if (ok(x + dx, z + dz)) return [x + dx, z + dz];
  if (ok(x + dx, z)) return [x + dx, z];
  if (ok(x, z + dz)) return [x, z + dz];
  return [x, z];
}
