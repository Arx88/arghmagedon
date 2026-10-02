import test from 'node:test';
import assert from 'node:assert/strict';
import { Director } from '../src/director.js';

const doc = {
  getElementById: () => null,
  querySelector: () => null,
  createElement: () => ({ classList: { add() {}, remove() {} }, style: {}, setAttribute() {}, remove() {}, prepend() {} }),
};
const win = { addEventListener() {}, removeEventListener() {} };
const player = { x: 0, z: 0, team: 'blue', hp: 10, maxHp: 10, gold: 0, crew: 8, dead: 0 };

test('cabin chatter stands down during a firefight and catches up once it is quiet', () => {
  let t = 0;
  const director = new Director({ now: () => t, document: doc, window: win });
  director.setCombatHot(true);
  assert.equal(director.speak('sailor', 'Una observación menor.', { priority: 0 }), false);
  assert.equal(director.deferred.length, 1);
  assert.equal(director.queue.idle, true);
  director.setCombatHot(false);
  t += 5900;
  director.update(player, [], [], t / 1000, {});
  assert.equal(director.deferred.length, 1);
  t += 200;
  director.update(player, [], [], t / 1000, {});
  assert.equal(director.deferred.length, 0);
  assert.equal(director.currentSpeech?.message, 'Una observación menor.');
});

test('urgent news cuts through the guns while banter waits its turn', () => {
  let t = 0;
  const director = new Director({ now: () => t, document: doc, window: win });
  director.setCombatHot(true);
  assert.equal(director.speak('boatswain', '¡Invaden la isla!', { priority: 3, key: 'invasion:1' }), true);
  assert.equal(director.currentSpeech?.message, '¡Invaden la isla!');
  assert.equal(director.speak('sailor', 'Cotilleo de cubierta.', { priority: 1 }), false);
  assert.equal(director.deferred.length, 1);
});

test('update carries the combat flag and the calm window releases the queue', () => {
  let t = 0;
  const director = new Director({ now: () => t, document: doc, window: win });
  director.update(player, [], [], 1, { combatHot: true });
  assert.equal(director.combatHot, true);
  director.speak('sailor', 'Cotilleo de cubierta.', { priority: 1 });
  assert.equal(director.deferred.length, 1);
  director.update(player, [], [], 2, { combatHot: false });
  assert.equal(director.combatHot, false);
  t += 6100;
  director.update(player, [], [], 3, {});
  assert.equal(director.deferred.length, 0);
  assert.equal(director.currentSpeech?.message, 'Cotilleo de cubierta.');
});
