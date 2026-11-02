export const BASE_SPEED = 5.6;
export const BOOST = 0.3;                      // la carrera da +30 % de velocidad
export const SPRINT_SPEED = BASE_SPEED * (1 + BOOST);   // 7,28 m/s
export const SPRINT_DELAY = 1.1;     // segundos caminando en la misma dirección antes de correr
export const SPRINT_DOT_MIN = 0.6;   // producto punto mínimo para considerar la misma dirección
export const BASE_FOV = 55;
export const SPRINT_FOV = 58;

export function createSprintTracker({
  baseSpeed = BASE_SPEED,
  sprintSpeed = SPRINT_SPEED,
  delay = SPRINT_DELAY,
  dotThreshold = SPRINT_DOT_MIN,
  turnAlignRate = 2.5,
  accelRate = 4.5,
  decelRate = 7.0,
  stopDecelRate = 8.0,
} = {}) {
  let walkTime = 0;
  let sprint = 0; // 0 (caminando) a 1 (máxima velocidad de sprint)
  let rx = 0, rz = 0; // vector director de referencia

  return {
    get walkTime() { return walkTime; },
    get sprint() { return sprint; },
    get isSprinting() { return sprint > 0.5; },
    get dir() { return { x: rx, z: rz }; },
    reset() {
      walkTime = 0;
      sprint = 0;
      rx = 0;
      rz = 0;
    },
    update(dt, dirX, dirZ, mag = 1) {
      if (mag <= 0.05) {
        walkTime = 0;
        rx = 0;
        rz = 0;
        sprint = Math.max(0, sprint * Math.exp(-dt * stopDecelRate));
        if (sprint < 0.002) sprint = 0;
      } else {
        const lenSq = rx * rx + rz * rz;
        if (lenSq < 0.01) {
          rx = dirX;
          rz = dirZ;
          walkTime = dt;
        } else {
          const dot = rx * dirX + rz * dirZ;
          if (dot < dotThreshold) {
            // Giro brusco: reinicia el acumulador de tiempo a 0 y fija la nueva dirección
            walkTime = 0;
            rx = dirX;
            rz = dirZ;
          } else {
            walkTime += dt;
            // Se alinea suavemente con giros suaves para absorber curvas sin romper la carrera
            const factor = Math.min(1, dt * turnAlignRate);
            rx += (dirX - rx) * factor;
            rz += (dirZ - rz) * factor;
            const len = Math.hypot(rx, rz);
            if (len > 1e-5) { rx /= len; rz /= len; }
          }
        }

        const targetSprint = walkTime >= delay ? 1 : 0;
        const rate = targetSprint > sprint ? accelRate : decelRate;
        sprint += (targetSprint - sprint) * (1 - Math.exp(-dt * rate));
        if (sprint < 0.002) sprint = 0;
      }

      const speed = baseSpeed + (sprintSpeed - baseSpeed) * sprint;
      const sprintFactor = speed / baseSpeed;
      return { speed, sprintFactor, sprint };
    },
  };
}
