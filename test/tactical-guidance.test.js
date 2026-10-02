import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { tacticalGuidance } from '../src/tactical-guidance.js';
import { NavigationMarker } from '../src/navigation-marker.js';

test('guidance prioritizes live danger over spending and does not disclose hidden targets', () => {
  const state = { player: { team: 'blue', hp: 160, maxHp: 160, gold: 100 }, docked: true, bank: 200 };
  assert.equal(tacticalGuidance(state).id, 'deposit');
  state.target = { object: { visible: false }, dead: 0 };
  assert.equal(tacticalGuidance(state).id, 'deposit');
  state.target.object.visible = true;
  assert.equal(tacticalGuidance(state).id, 'combat');
  state.player.hp = 20;
  assert.equal(tacticalGuidance(state).id, 'repair');
  state.player.burning = 5;
  assert.equal(tacticalGuidance(state).id, 'fire');
  state.home = { invasion: { team: 'red' } };
  assert.equal(tacticalGuidance(state).id, 'defend');
  state.player.dead = 1;
  assert.equal(tacticalGuidance(state).id, 'return');
});

test('navigation marker follows the adjusted coast-safe endpoint and disappears on manual helm', () => {
  const scene = new THREE.Scene(), marker = new NavigationMarker(scene, () => .4);
  const player = { target: { x: 20, z: 10 }, routeGoal: { x: 20, z: 10 }, route: [{ x: 8, z: 0 }, { x: 22, z: 14 }] };
  marker.update(player, 1, false);
  assert.equal(marker.object.visible, true);
  assert.equal(marker.object.position.x, 22);
  assert.equal(marker.object.position.z, 14);
  assert.equal(marker.object.position.y, .51);
  marker.update(player, 1, true);
  assert.equal(marker.object.visible, false);
  player.target = null;
  marker.update(player, 2, false);
  assert.equal(marker.object.visible, false);
});
