import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSprintTracker, BASE_SPEED, SPRINT_SPEED, SPRINT_DELAY, SPRINT_DOT_MIN } from './sprint.js';

test('createSprintTracker: inicia en reposo con velocidad base', () => {
  const tracker = createSprintTracker();
  assert.equal(tracker.walkTime, 0);
  assert.equal(tracker.sprint, 0);
  assert.equal(tracker.isSprinting, false);
  const state = tracker.update(0.016, 0, 0, 0);
  assert.equal(state.speed, BASE_SPEED);
  assert.equal(state.sprintFactor, 1);
});

test('caminar menos del tiempo de retardo mantiene velocidad base', () => {
  const tracker = createSprintTracker({ delay: 1.0 });
  for (let t = 0; t < 0.9; t += 0.1) {
    const s = tracker.update(0.1, 0, 1, 1);
    assert.equal(s.sprint, 0);
    assert.equal(s.speed, BASE_SPEED);
    assert.equal(s.sprintFactor, 1);
  }
  assert.ok(tracker.walkTime >= 0.89);
  assert.equal(tracker.isSprinting, false);
});

test('caminar continuo en la misma dirección acelera a velocidad de sprint', () => {
  const tracker = createSprintTracker({ delay: 1.0 });
  // Caminar 1 segundo para alcanzar el umbral
  for (let t = 0; t <= 1.0; t += 0.05) {
    tracker.update(0.05, 0, 1, 1);
  }
  assert.ok(tracker.walkTime >= 1.0);

  // Avanzar otro segundo para permitir la aceleración suave
  let lastState = null;
  for (let t = 0; t < 1.0; t += 0.05) {
    lastState = tracker.update(0.05, 0, 1, 1);
  }

  assert.ok(tracker.isSprinting);
  assert.ok(lastState.sprint > 0.95);
  assert.ok(lastState.speed > BASE_SPEED * 1.28);
  assert.ok(lastState.sprintFactor > 1.28 && lastState.sprintFactor <= 1.3 + 1e-9);
  assert.ok(lastState.speed <= SPRINT_SPEED);
});

test('detenerse (mag < 0.05) reinicia el tiempo y decae la velocidad', () => {
  const tracker = createSprintTracker({ delay: 0.5 });
  // Llegar a sprint
  for (let t = 0; t < 2.0; t += 0.05) {
    tracker.update(0.05, 0, 1, 1);
  }
  assert.ok(tracker.isSprinting);

  // Detenerse
  const stoppedState = tracker.update(0.05, 0, 0, 0);
  assert.equal(tracker.walkTime, 0);
  assert.ok(stoppedState.sprint < 1.0);

  // Dejar que decaiga completamente
  for (let t = 0; t < 1.0; t += 0.05) {
    tracker.update(0.05, 0, 0, 0);
  }
  assert.equal(tracker.sprint, 0);
  assert.equal(tracker.isSprinting, false);
});

test('giro brusco (dot < 0.6) reinicia el tiempo de carrera y decae sprint', () => {
  const tracker = createSprintTracker({ delay: 0.5 });
  // Correr hacia +Z (0, 1)
  for (let t = 0; t < 2.0; t += 0.05) {
    tracker.update(0.05, 0, 1, 1);
  }
  assert.ok(tracker.isSprinting);

  // Girar 90 grados hacia +X (1, 0) -> producto punto es 0 (< 0.6)
  const turnState = tracker.update(0.05, 1, 0, 1);
  assert.ok(tracker.walkTime <= 0.05 + 1e-6); // reiniciado al dt del nuevo rumbo
  assert.ok(turnState.sprint < 1.0);

  // Avanzar un poco en la nueva dirección (menos del delay)
  const nextState = tracker.update(0.1, 1, 0, 1);
  assert.ok(nextState.sprint < turnState.sprint); // continuó decayendo
  assert.ok(tracker.walkTime < 0.5);
});

test('curvas suaves (dot >= 0.6) mantienen la carrera', () => {
  const tracker = createSprintTracker({ delay: 0.5 });
  // Acelerar hacia +Z
  for (let t = 0; t < 1.5; t += 0.05) {
    tracker.update(0.05, 0, 1, 1);
  }
  assert.ok(tracker.isSprinting);

  // Curvar levemente (~15 grados: sin(15°) ~ 0.258, cos(15°) ~ 0.965)
  for (let i = 0; i < 10; i++) {
    const s = tracker.update(0.05, 0.258, 0.965, 1);
    assert.ok(s.sprint > 0.9);
    assert.ok(tracker.walkTime > 1.5);
  }
});

test('reset() limpia inmediatamente todo el estado', () => {
  const tracker = createSprintTracker({ delay: 0.5 });
  for (let t = 0; t < 2.0; t += 0.05) {
    tracker.update(0.05, 0, 1, 1);
  }
  assert.ok(tracker.isSprinting);
  tracker.reset();
  assert.equal(tracker.walkTime, 0);
  assert.equal(tracker.sprint, 0);
  assert.equal(tracker.isSprinting, false);
});

test('el sprint da exactamente +30 % sobre la velocidad base', () => {
  assert.ok(Math.abs(SPRINT_SPEED / BASE_SPEED - 1.3) < 1e-9);
});
