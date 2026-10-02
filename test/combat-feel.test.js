import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCombatFeel, feel, stepFeel, addTrauma, freeze, timeScale, cameraTrauma,
  registerHit, comboMultiplier, comboTier, rollCritical, bearingAngle, ramImpulse, lowHullLevel,
} from '../src/combat-feel.js';

test('a streak grows inside the window and pays out capped extra damage', () => {
  const state = createCombatFeel();
  registerHit(state, 0, { damage: 10 });
  assert.equal(state.combo, 1);
  assert.equal(comboMultiplier(1), 1);
  for (let n = 0; n < 20; n++) registerHit(state, n * .1, { damage: 10 });
  assert.equal(state.combo, 21);
  assert.equal(comboMultiplier(21), 1 + feel.comboDamageCap);
  assert.equal(comboMultiplier(4), 1 + 3 * feel.comboDamageStep);
});

test('a streak lapses once the window passes', () => {
  const state = createCombatFeel();
  registerHit(state, 0, {});
  registerHit(state, 1, {});
  assert.equal(state.combo, 2);
  stepFeel(state, 1, 1 + feel.comboWindow);
  assert.equal(state.combo, 0);
  assert.equal(state.bestCombo, 2);
});

test('a slower streak still counts and pays less than a faster one', () => {
  const state = createCombatFeel();
  for (let n = 0; n < 4; n++) registerHit(state, 100 + n, { damage: 5 });
  const first = comboMultiplier(state.combo);
  for (let n = 0; n < 4; n++) registerHit(state, n, { damage: 5 });
  assert.ok(comboMultiplier(state.combo) > first);
});

test('streak tiers escalate in tone and keep the same order', () => {
  assert.equal(comboTier(2), null);
  assert.equal(comboTier(3).title, 'ANDANADA');
  assert.equal(comboTier(5).title, 'RACHA ARDIENTE');
  assert.equal(comboTier(8).title, 'TORMENTA DE HIERRO');
  assert.equal(comboTier(20).title, 'LEYENDA DEL MALASPINA');
});

test('criticals are possible with iron shot and impossible with the bomb', () => {
  assert.equal(rollCritical(() => 0, 0), true);
  assert.equal(rollCritical(() => .5, 0), false);
  assert.equal(rollCritical(() => 0, 3), false);
  assert.equal(rollCritical(() => .15, 2), true);
  assert.equal(rollCritical(() => .3, 2), false);
});

test('hit-stop dilates time and always unwinds on real seconds', () => {
  const state = createCombatFeel();
  assert.equal(timeScale(state), 1);
  freeze(state, .3);
  // Floor is .25: a kill lands at 4x slow. The game must never approach a stop,
  // because a dropped-frames read is worse than no hit-stop at all.
  assert.ok(timeScale(state) >= .25, `hit-stop floor broken: ${timeScale(state)}`);
  assert.ok(timeScale(state) < .3, 'hit-stop should actually dilate the frame it lands on');
  const opening = timeScale(state);
  stepFeel(state, .15);
  const middle = timeScale(state);
  stepFeel(state, .15);
  assert.ok(middle > opening);
  assert.equal(timeScale(state), 1);
});

test('hit-stop lengthens rather than restarts when a shorter freeze lands', () => {
  const state = createCombatFeel();
  freeze(state, .3);
  stepFeel(state, .1);
  freeze(state, .1);
  assert.ok(state.hitStop <= .3 && state.hitStop > .1);
  assert.ok(timeScale(state) > 1 - .94);
});

test('camera trauma is squared so chip damage barely moves and decays away', () => {
  const state = createCombatFeel();
  addTrauma(state, .2);
  const chip = Math.abs(cameraTrauma(state, 1).x);
  addTrauma(state, .8);
  const heavy = Math.abs(cameraTrauma(state, 1).x);
  assert.ok(heavy > chip * 5);
  assert.ok(Math.abs(cameraTrauma(state, 0).x) <= Math.abs(cameraTrauma(state, 1).x));
  for (let n = 0; n < 40; n++) stepFeel(state, .1);
  assert.equal(state.trauma, 0);
  assert.deepEqual(cameraTrauma(state, 1), { x: 0, y: 0, roll: 0 });
});

test('trauma never exceeds one however many hits land', () => {
  const state = createCombatFeel();
  for (let n = 0; n < 50; n++) addTrauma(state, .5);
  assert.equal(state.trauma, 1);
});

// The regression that made firing unplayable: every cannon in a broadside added
// trauma, so 12-16 shots saturated the meter in a single frame and the camera
// rolled tens of degrees on every volley.
test('a full broadside reads as a tremor, not an earthquake', () => {
  const state = createCombatFeel();
  const perCannon = .03; // the iron-shot value `launch()` passes for player fire
  for (let n = 0; n < 16; n++) addTrauma(state, perCannon);
  assert.ok(state.trauma <= .5, `broadside pinned trauma at ${state.trauma}`);

  const shot = cameraTrauma(state, 1);
  assert.ok(Math.abs(shot.x) < .35, `broadside moved the camera ${Math.abs(shot.x)}u`);
  assert.ok(Math.abs(shot.roll) < .05, `broadside rolled the camera ${Math.abs(shot.roll)}rad`);

  // Sustained fire reaching the meter cap still has to stay steerable.
  addTrauma(state, 1);
  const capped = cameraTrauma(state, 1);
  assert.ok(Math.abs(capped.x) < .4, `max trauma moved the camera ${Math.abs(capped.x)}u`);
  assert.ok(Math.abs(capped.roll) < .05, `max trauma rolled the camera ${Math.abs(capped.roll)}rad`);
});

test('sustained fire clears within half a second', () => {
  const state = createCombatFeel();
  addTrauma(state, 1);
  for (let n = 0; n < 5; n++) stepFeel(state, .1);
  assert.equal(state.trauma, 0);
});

test('bearings point at the bow for dead ahead and to starboard on the beam', () => {
  const ship = { x: 0, z: 0, heading: 0 };
  assert.ok(Math.abs(bearingAngle(0, -10, ship)) < 1e-6);
  assert.ok(bearingAngle(10, 0, ship) > 0);
  assert.ok(bearingAngle(-10, 0, ship) < 0);
  // Facing +x: the bow is at -x, so -10,0 is dead ahead and 0,-10 is starboard.
  const turned = { x: 0, z: 0, heading: Math.PI / 2 };
  assert.ok(Math.abs(bearingAngle(-10, 0, turned)) < 1e-6);
  assert.ok(bearingAngle(0, -10, turned) > 0);
  assert.ok(bearingAngle(0, 10, turned) < 0);
});

test('only a boosted hull rams, and never twice inside the cooldown', () => {
  const state = createCombatFeel();
  const attacker = { team: 'blue', maxSpeed: 9, dead: 0 }, target = { team: 'red', dead: 0 };
  assert.equal(ramImpulse(state, attacker, target, 9), null);
  const hit = ramImpulse(state, attacker, target, 15.5, () => .99);
  assert.ok(hit.damage > feel.ramDamage);
  assert.ok(hit.damage < feel.ramDamage + feel.ramScaleDamage + 1);
  assert.equal(ramImpulse(state, attacker, target, 15.5), null);
  stepFeel(state, feel.ramCooldown + .1);
  assert.ok(ramImpulse(state, attacker, target, 15.5, () => .99));
});

test('a faster ramming run hits harder and sinks more often', () => {
  const slow = ramImpulse(createCombatFeel(), { team: 'blue', maxSpeed: 9 }, { team: 'red' }, 11.4, () => 0);
  const fast = ramImpulse(createCombatFeel(), { team: 'blue', maxSpeed: 9 }, { team: 'red' }, 20, () => 0);
  assert.ok(fast.damage > slow.damage);
  assert.ok(fast.sunk);
  assert.ok(fast.power > slow.power);
});

test('allies and the already dead are never rammed', () => {
  const state = createCombatFeel();
  const attacker = { team: 'blue', maxSpeed: 9 };
  assert.equal(ramImpulse(state, attacker, { team: 'blue' }, 20), null);
  assert.equal(ramImpulse(state, { team: 'blue', maxSpeed: 9, dead: 4 }, { team: 'red' }, 20), null);
});

test('low hull only raises the alarm below the panic threshold', () => {
  assert.equal(lowHullLevel(160, 160), 0);
  assert.equal(lowHullLevel(48, 160), 0);
  assert.ok(lowHullLevel(24, 160) > 0);
  assert.equal(lowHullLevel(0, 160), 1);
});

test('kills and damage totals are tracked for the expedition log', () => {
  const state = createCombatFeel();
  registerHit(state, 0, { damage: 12 });
  registerHit(state, .2, { damage: 18, crit: true });
  registerHit(state, .4, { damage: 30, killed: true });
  assert.equal(state.landed, 3);
  assert.equal(state.kills, 1);
  assert.equal(state.damageDealt, 60);
});