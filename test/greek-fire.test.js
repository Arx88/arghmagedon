import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { addGreekFirePatch, stepGreekFirePatches, greekFireContact, greekFireBurn, GreekFireTrail } from '../src/greek-fire.js';
import { applyAmmoEffect } from '../src/campaign-rules.js';

const patch = (x = 0, team = 'blue') => ({ x, z: 0, life: 8, radius: 2.6, team, level: 0, source: { team } });
const ship = (team = 'red') => ({ x: 0, z: 0, hp: 100, team, scale: 1, hitWidth: 2.2, burning: 0, burnTick: .4 });

test('oil stays finite, merges stationary deposits and expires after lingering', () => {
  let patches = [];
  for (let i = 0; i < 100; i++) patches = addGreekFirePatch(patches, patch(i * 2), 8);
  assert.equal(patches.length, 8);
  const last = patches.at(-1); const before = JSON.stringify(patches);
  const merged = addGreekFirePatch(patches, { ...last, life: 9 }, 8);
  assert.equal(merged.length, 8); assert.equal(merged.at(-1).life, 9); assert.equal(JSON.stringify(patches), before);
  assert.equal(stepGreekFirePatches(merged, 9).length, 0);
});

test('contact ignites an opponent for timed damage without stacking overlapping patches', () => {
  const target = ship(), one = greekFireContact(target, [patch()]), several = greekFireContact(target, [patch(), patch(.1), patch(-.1)]);
  assert.equal(one.damage, 7); assert.equal(one.duration, 5.5); assert.equal(several.damage, one.damage);
  const burn = greekFireBurn(target, several); assert.equal(burn.burning, 5.5); assert.equal(burn.burnTick, .4);
  const repeated = greekFireBurn({ ...target, ...burn }, several); assert.equal(repeated.burning, 5.5);
  assert.equal(repeated.burnDamage, 7, 'contact refreshes duration instead of adding per-patch DPS');
  assert.equal(target.burning, 0, 'pure rules keep target unchanged until integration applies them');
  assert.equal(greekFireBurn({ ...target, burnDamage: 30, burning: 0 }, one).burnDamage, 7, 'an extinguished older fire cannot increase a new burn');
  assert.equal(greekFireContact({ ...target, x: 100 }, [patch()]), null);
});

test('friendly, dead and expired contacts cannot ignite; upgrades choose strongest contact', () => {
  assert.equal(greekFireContact(ship('blue'), [patch()]), null);
  assert.equal(greekFireContact({ ...ship(), dead: 4 }, [patch()]), null);
  assert.equal(greekFireContact({ ...ship(), hp: 0 }, [patch()]), null);
  assert.equal(greekFireContact(ship(), [{ ...patch(), life: 0 }]), null);
  const strongest = greekFireContact(ship(), [patch(), { ...patch(), level: 3 }]);
  assert.equal(strongest.damage, 9.25); assert.equal(strongest.duration, 7);
});

test('incendiary cannonballs preserve an active oil burn and reset extinguished damage', () => {
  const oilSource = { team: 'blue', name: 'oil' }, cannonSource = { team: 'red', name: 'cannon' };
  const target = { ...ship(), burning: 4, burnDamage: 7, burnSource: oilSource };
  applyAmmoEffect(target, 2, 3, cannonSource);
  assert.equal(target.burning, 5); assert.equal(target.burnDamage, 7); assert.equal(target.burnSource, oilSource);
  const stronger = greekFireBurn({ ...target, burnDamage: 11 }, greekFireContact(ship(), [patch()]));
  assert.equal(stronger.burnDamage, 11); assert.equal(stronger.burnSource, oilSource);
  target.burning = 0;
  applyAmmoEffect(target, 2, 0, cannonSource);
  assert.equal(target.burnDamage, 2); assert.equal(target.burnSource, cannonSource);
});

test('trail and burning hull flames follow actual wave elevation and dispose their pool', () => {
  const scene = new THREE.Scene(), trail = new GreekFireTrail(scene, { wave: () => 4, capacity: 4 });
  const source = { ...ship('blue'), heading: 0 }, target = { ...ship(), z: 6.5, burning: 3, object: new THREE.Group() };
  target.object.position.y = 4;
  trail.igniteTrail(source); const contacts = trail.update(.01, { source, targets: [target], time: 1 });
  assert.equal(contacts.length, 1); assert.equal(contacts[0].newIgnition, false);
  const matrix = new THREE.Matrix4(); trail.flames.getMatrixAt(0, matrix); assert.ok(matrix.elements[13] > 4);
  assert.ok([...trail.flames.instanceMatrix.array].every(Number.isFinite));
  assert.ok(trail.fireLights.some(light=>light.intensity>0));
  assert.ok(trail.fireLights.every(light=>light.parent===scene&&light.visible), 'ignition keeps the scene light membership stable');
  trail.update(9, { targets: [], time: 10 }); assert.equal(trail.patches.length, 0); assert.equal(trail.group.visible, false);
  assert.ok(trail.fireLights.every(light=>light.intensity===0&&light.parent===scene&&light.visible), 'expired fuel extinguishes lighting without changing the shader light count');
  trail.dispose(); assert.equal(scene.children.length, 0);
});
