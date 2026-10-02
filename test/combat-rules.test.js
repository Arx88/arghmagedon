import test from 'node:test';
import assert from 'node:assert/strict';
import { broadsideFactor, crossingTBonus, sideKey, splitDamage, rigSpeedFactor, rigRules, boardingLoot, boardingLootShare } from '../src/campaign-rules.js';

test('a broadside pays full value abeam and a weak, wide salvo off the bow', () => {
  assert.equal(broadsideFactor(Math.PI / 2), 1);
  assert.equal(broadsideFactor(-Math.PI / 2), 1);
  assert.ok(Math.abs(broadsideFactor(0) - .55) < 1e-9);
  assert.ok(Math.abs(broadsideFactor(Math.PI) - .55) < 1e-9);
  // Between bow and beam the factor only ever grows toward the beam.
  for (const bearing of [0, .4, .8, 1.2, Math.PI / 2]) assert.ok(broadsideFactor(bearing) <= broadsideFactor(Math.PI / 2));
  assert.ok(broadsideFactor(.8) > broadsideFactor(0) && broadsideFactor(.8) < 1);
});

test('crossing the T pays, and only when their hull points at your guns', () => {
  assert.equal(crossingTBonus(Math.PI / 2, 0), 1.15);
  assert.equal(crossingTBonus(Math.PI / 2, Math.PI), 1.15);
  assert.equal(crossingTBonus(Math.PI / 2, Math.PI / 2), 1);
  assert.equal(crossingTBonus(0, 0), 1);
});

test('which guns bear is decided by the sign of the bearing', () => {
  assert.equal(sideKey(.7), 'starboard');
  assert.equal(sideKey(-.7), 'port');
});

test('chain shot spends most of its force on the rigging, other shot never does', () => {
  assert.deepEqual(splitDamage(1, 100), { hull: 30, rig: 70 });
  assert.deepEqual(splitDamage(0, 100), { hull: 100, rig: 0 });
  assert.deepEqual(splitDamage(2, 50), { hull: 50, rig: 0 });
  assert.equal(rigRules.chainRigShare, .7);
});

test('torn rigging slows the ship but never stops it, and full rigging costs nothing', () => {
  assert.equal(rigSpeedFactor(100, 100), 1);
  assert.equal(rigSpeedFactor(0, 100), rigRules.speedFloor);
  const half = rigSpeedFactor(50, 100);
  assert.ok(half > rigRules.speedFloor && half < 1);
  assert.equal(rigSpeedFactor(-10, 100), rigRules.speedFloor);
  assert.equal(rigSpeedFactor(200, 100), 1);
});

test('a captured hull hands over most of the gold it carries, never invented coin', () => {
  assert.equal(boardingLoot(200), Math.round(200 * boardingLootShare));
  assert.equal(boardingLoot(0), 0);
  assert.equal(boardingLoot(-50), 0);
  assert.ok(boardingLoot(200) < 200);
});
