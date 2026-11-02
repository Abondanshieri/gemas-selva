import { mountBlueprint } from './blueprint.js';
import { createStore } from '../core/store.js';
import { createInventory } from '../core/gems.js';

// ?layout=h|v fuerza la disposición; si no, sigue la orientación del dispositivo.
const forced = new URLSearchParams(location.search).get('layout');
const start = { C: 1, D: 2, U: 3 };
mountBlueprint(document.getElementById('blueprint'), {
  forcedLayout: forced === 'h' || forced === 'v' ? forced : null,
  store: createStore(createInventory(start)),
  goal: { U: 5, D: 1 },
  resetTo: start,
});
