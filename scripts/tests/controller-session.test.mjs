import assert from 'node:assert/strict';
import test from 'node:test';
import { createBaseControllerSession, emptyControllerInput } from '../../src/input/baseControllerSession.js';

function pad(held = [], axes = [0, 0, 0, 0]) {
  return {
    id: 'Session regression controller', index: 0, mapping: 'standard', connected: true, axes,
    buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: held.includes(i), value: held.includes(i) ? 1 : 0 })),
  };
}

function fixture(overrides = {}) {
  const calls = [];
  let context = { enabled: true, playing: true, paused: false, world: { levelKey: 'level0', labyrinthMode: false }, ...overrides };
  const handlers = { getContext: () => context };
  for (const name of ['Pause', 'Exit', 'Power', 'Breaker', 'Cycle', 'Sidebar', 'Map', 'Navigate', 'Confirm', 'Back', 'Settings', 'Connection']) {
    handlers[`on${name}`] = (...args) => { calls.push([name, ...args]); };
  }
  const session = createBaseControllerSession(handlers);
  let now = 0;
  const tick = (held = [], axes = [0, 0, 0, 0], elapsed = 16) => session.tick([pad(held, axes)], now += elapsed);
  const set = change => { context = { ...context, ...change }; };
  const actions = name => calls.filter(call => call[0] === name).map(call => call.slice(1));
  return { session, calls, tick, set, actions, get context() { return context; }, get now() { return now; } };
}

test('all three carried powers have distinct face buttons and each press spends one slot only', () => {
  for (const levelKey of ['level0', 'level1', 'level2', 'level3']) {
    const f = fixture({ world: { levelKey, labyrinthMode: false } });
    f.tick();
    for (const [button, slot] of [[2, 0], [3, 1], [0, 2]]) {
      f.tick([button]);
      f.tick([button], undefined, 500);
      f.tick([button], undefined, 500);
      assert.equal(f.actions('Power').at(-1)[0], slot);
      f.tick();
    }
    assert.deepEqual(f.actions('Power'), [[0], [1], [2]]);
    assert.deepEqual(f.actions('Confirm'), []);
    assert.deepEqual(f.actions('Back'), []);
  }
});

test('Cross selects menu entries and cannot consume power slot three while outside a maze', () => {
  const f = fixture({ playing: false });
  f.tick();
  f.tick([0]);f.tick([0], undefined, 1000);
  assert.deepEqual(f.actions('Confirm'), [[]]);
  assert.deepEqual(f.actions('Power'), []);
  assert.deepEqual(f.actions('Navigate'), []);
  f.tick();f.tick([1]);
  assert.deepEqual(f.actions('Back'), [[]]);
  assert.deepEqual(f.actions('Sidebar'), []);
});

test('starting a level with Cross held cannot consume the third power or move until controls release', () => {
  const f = fixture({ playing: false });
  f.tick();f.tick([0]);
  assert.equal(f.actions('Confirm').length, 1);
  f.set({ playing: true, world: { levelKey: 'level1', labyrinthMode: false } });
  assert.deepEqual(f.tick([0], [1, 0, 0, 0]), emptyControllerInput());
  assert.deepEqual(f.tick([0]), emptyControllerInput());
  assert.deepEqual(f.actions('Power'), []);
  f.tick();f.tick([0]);
  assert.deepEqual(f.actions('Power'), [[2]]);
});

test('Circle scrolls the in-maze sidebar continuously while held, without activating menu Back', () => {
  const f = fixture();f.tick();
  const pressed = f.tick([1]);
  assert.deepEqual(pressed, emptyControllerInput());
  assert.deepEqual(f.actions('Sidebar'), [[180]]);
  f.tick([1], undefined, 50);
  f.tick([1], undefined, 50);
  assert.deepEqual(f.actions('Sidebar'), [[180], [21], [21]]);
  f.tick();
  assert.equal(f.actions('Sidebar').length, 3);
  assert.deepEqual(f.actions('Back'), []);
  f.set({ paused: true });f.tick();f.tick([1]);
  assert.deepEqual(f.actions('Back'), [[]]);
  assert.equal(f.actions('Sidebar').length, 3);
});

test('L2 exits the active maze before simultaneous powers, fire, pause, or sidebar actions', () => {
  const f = fixture();f.tick();
  const output = f.tick([0, 1, 2, 3, 6, 7, 9], [1, 0, 1, 0]);
  assert.deepEqual(output, emptyControllerInput());
  assert.deepEqual(f.calls.filter(call => call[0] !== 'Connection'), [['Exit']]);
  f.tick([0, 1, 2, 3, 6, 7, 9]);
  assert.equal(f.actions('Exit').length, 1);
  assert.deepEqual(f.actions('Power'), []);
  f.set({ playing: false });f.tick([0, 6]);
  assert.deepEqual(f.actions('Confirm'), []);
  f.tick();f.tick([0]);
  assert.equal(f.actions('Confirm').length, 1);
});

test('R2 continuously fires regular weapons, but only a fresh press activates a Labyrinth breaker', () => {
  const regular = fixture();regular.tick();
  assert.equal(regular.tick([7]).attack, true);
  assert.equal(regular.tick([7], undefined, 500).attack, true);
  assert.equal(regular.tick().attack, false);
  assert.deepEqual(regular.actions('Breaker'), []);

  const labyrinth = fixture({ world: { levelKey: 'labyrinth', labyrinthMode: true } });labyrinth.tick();
  assert.equal(labyrinth.tick([7]).attack, false);
  assert.equal(labyrinth.tick([7], undefined, 1000).attack, false);
  assert.deepEqual(labyrinth.actions('Breaker'), [[]]);
  labyrinth.tick();labyrinth.tick([7]);
  assert.deepEqual(labyrinth.actions('Breaker'), [[], []]);
  labyrinth.tick();labyrinth.tick([0, 2, 3]);
  assert.deepEqual(labyrinth.actions('Power'), []);
});

test('bumpers cycle once per press in each base mode; Dpad Up toggles only the map during gameplay', () => {
  for (const labyrinthMode of [false, true]) {
    const f = fixture({ world: { levelKey: labyrinthMode ? 'labyrinth' : 'level2', labyrinthMode } });f.tick();
    f.tick([4, 12]);f.tick([4, 12], undefined, 1000);
    f.tick();f.tick([5]);f.tick([5], undefined, 1000);
    assert.deepEqual(f.actions('Cycle'), [[-1], [1]]);
    assert.deepEqual(f.actions('Map'), [[]]);
    assert.deepEqual(f.actions('Navigate'), []);
  }
});

test('Options pauses before powers and held Options cannot instantly resume; the paused menu gets face buttons', () => {
  const f = fixture();f.tick();
  assert.deepEqual(f.tick([9, 0, 7]), emptyControllerInput());
  assert.deepEqual(f.actions('Pause'), [[true]]);
  assert.deepEqual(f.actions('Power'), []);
  f.set({ paused: true });
  f.tick([9, 0, 7], undefined, 1000);
  assert.deepEqual(f.actions('Pause'), [[true]]);
  assert.deepEqual(f.actions('Confirm'), []);
  f.tick();f.tick([0, 2, 3, 7]);
  assert.deepEqual(f.actions('Confirm'), [[]]);
  assert.deepEqual(f.actions('Power'), []);
  f.tick();f.tick([9]);
  assert.deepEqual(f.actions('Pause'), [[true], [false]]);
});

test('Dpad repeats navigate shop menus without leaking movement, aiming, fire, or powers', () => {
  const f = fixture({ playing: false });f.tick();
  const output = f.tick([13], [1, 0, .5, .5]);
  assert.deepEqual(output, emptyControllerInput());
  assert.deepEqual(f.actions('Navigate'), [['down']]);
  f.tick([13], undefined, 349);
  assert.equal(f.actions('Navigate').length, 1);
  f.tick([13], undefined, 1);
  f.tick([13], undefined, 130);
  assert.deepEqual(f.actions('Navigate'), [['down'], ['down'], ['down']]);
  f.tick();f.tick([9]);
  assert.deepEqual(f.actions('Settings'), [[]]);
  assert.deepEqual(f.actions('Pause'), []);
});

test('Cube, farm, tower defense, and unknown level contexts receive no controller handlers', () => {
  for (const mode of ['cube', 'flock', 'td']) {
    const f = fixture({ enabled: false, playing: false });
    f.tick();
    assert.deepEqual(f.tick([0, 1, 2, 3, 4, 5, 6, 7, 9, 12], [1, 1, 1, 1]), emptyControllerInput(), mode);
    assert.deepEqual(f.calls, [], mode);
  }
  const unknown = fixture({ world: { levelKey: 'futureBonusMaze', labyrinthMode: false } });
  unknown.tick();unknown.tick([0, 1, 6, 9], [1, 1, 1, 1]);
  assert.deepEqual(unknown.calls, []);
});

test('disconnect clears continuous input and pauses an active run once, while reconnect requires neutral', () => {
  const f = fixture();f.tick();
  const live = f.tick([7], [1, 0, 0, -1]);
  assert.equal(live.attack, true);assert.equal(live.move.x, 1);assert.equal(live.look.y, -1);
  assert.equal(f.session.isConnected(), true);
  assert.deepEqual(f.session.tick([], f.now + 16), emptyControllerInput());
  assert.equal(f.session.isConnected(), false);
  assert.deepEqual(f.actions('Pause'), [[true]]);
  f.session.tick([], f.now + 32);
  assert.deepEqual(f.actions('Pause'), [[true]]);
  assert.deepEqual(f.tick([0, 7], [1, 0, 0, 0], 50), emptyControllerInput());
  assert.deepEqual(f.actions('Power'), []);
  f.tick();assert.equal(f.tick([7]).attack, true);
  assert.deepEqual(f.actions('Connection').map(call => call[0]), [true, false, true]);
});

test('switching away from base games clears connected state; returning and changing worlds neutral-gates held buttons', () => {
  const f = fixture();f.tick();f.tick([7]);
  f.set({ enabled: false });
  assert.deepEqual(f.tick([0, 7]), emptyControllerInput());
  assert.equal(f.session.isConnected(), false);
  assert.deepEqual(f.actions('Pause'), []);
  f.set({ enabled: true });
  assert.deepEqual(f.tick([0, 7]), emptyControllerInput());
  assert.deepEqual(f.actions('Power'), []);
  f.tick();f.tick([2]);
  assert.deepEqual(f.actions('Power'), [[0]]);
  f.set({ world: { levelKey: 'level3', labyrinthMode: false } });
  f.tick([2]);assert.deepEqual(f.actions('Power'), [[0]]);
  f.tick();f.tick([2]);assert.deepEqual(f.actions('Power'), [[0], [0]]);
});

test('victory and defeat route controller selection to run-complete menus and suppress gameplay', () => {
  for (const ending of ['gameOver', 'victory']) {
    const f = fixture({ world: { levelKey: 'level0', labyrinthMode: false, [ending]: true } });f.tick();
    assert.deepEqual(f.tick([0, 2, 3, 7], [1, 0, 1, 0]), emptyControllerInput());
    assert.deepEqual(f.actions('Confirm'), [[]]);
    assert.deepEqual(f.actions('Power'), []);
    assert.deepEqual(f.actions('Breaker'), []);
  }
});
