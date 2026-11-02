// Matemática del látigo + balanceo (pura, sin Three.js).
// El jugador se para en una "zona de lanzamiento" de una orilla, lanza el látigo al ancla
// que cuelga sobre el río y aterriza en el punto simétrico respecto del ancla (otra orilla).

export const mirror = (p, anchor) => ({ x: 2 * anchor.x - p.x, z: 2 * anchor.z - p.z });

export const padsOf = (anchor, river) => {
  const off = river.halfWidth + 4;
  return [
    { x: anchor.x, z: river.z - off, side: 'N' },
    { x: anchor.x, z: river.z + off, side: 'S' },
  ];
};

export const findPad = (p, anchors, river, radius = 2.6) => {
  for (const a of anchors) {
    for (const pad of padsOf(a, river)) {
      if ((p.x - pad.x) ** 2 + (p.z - pad.z) ** 2 <= radius * radius) return { anchor: a, pad };
    }
  }
  return null;
};

// s ∈ [0,1] avance eased (arranca y termina suave, como un péndulo).
export const ease = (u) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, u)));

export const swingPoint = (p0, p1, u, arc = 2.6) => {
  const s = ease(u);
  return { x: p0.x + (p1.x - p0.x) * s, z: p0.z + (p1.z - p0.z) * s, lift: arc * Math.sin(Math.PI * s) };
};

// Cruzar solo tiene sentido si el aterrizaje cae en la orilla opuesta, fuera del agua.
export const landsAcross = (p0, p1, river) =>
  Math.sign(p0.z - river.z) !== Math.sign(p1.z - river.z) && Math.abs(p1.z - river.z) > river.halfWidth + 0.5;
