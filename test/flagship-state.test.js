import test from 'node:test';
import assert from 'node:assert/strict';
import { flagshipState, flagshipChange } from '../src/flagship-state.js';

const ship = (values = {}) => ({ name:'La Indomable',hp:160,maxHp:160,crew:8,maxCrew:12,rig:100,maxRig:100,vx:0,vz:0,...values });

test('flagship gauges retain real upgraded capacity and clamp destroyed or damaged values', () => {
  const upgraded = flagshipState(ship({hp:239,maxHp:265,crew:19,maxCrew:24,rig:87,vx:3,vz:4}), {rank:6,xp:341});
  assert.equal(upgraded.hp,239); assert.equal(upgraded.maxHp,265);
  assert.equal(upgraded.crew,19); assert.equal(upgraded.maxCrew,24);
  assert.equal(upgraded.speed,5); assert.equal(upgraded.rig,.87);
  assert.equal(upgraded.xpGoal,480); assert.equal(upgraded.experience,341/480);
  const sunk = flagshipState(ship({hp:-25,crew:-1,rig:-12,dead:2}));
  assert.equal(sunk.hp,0); assert.equal(sunk.crew,0); assert.equal(sunk.rig,0); assert.equal(sunk.condition,'sunk');
});

test('burning, port repairs and critical hull use distinct readable states', () => {
  assert.equal(flagshipState(ship({hp:25})).condition,'critical');
  assert.equal(flagshipState(ship({hp:25}),{docked:true}).condition,'repairing');
  assert.equal(flagshipState(ship({hp:25,burning:4}),{docked:true}).condition,'burning');
  assert.equal(flagshipState(ship({rig:12})).condition,'rigging');
  assert.equal(flagshipState(ship(),{boosting:true}).condition,'boosting');
});

test('damage feedback never mistakes hull upgrades or respawns for an incoming hit', () => {
  const full = flagshipState(ship()), damaged = flagshipState(ship({hp:114}));
  assert.deepEqual(flagshipChange(full,damaged),{kind:'damage',value:46});
  assert.deepEqual(flagshipChange(damaged,flagshipState(ship({hp:115}))),{kind:'repair',value:1});
  assert.equal(flagshipChange(full,flagshipState(ship({hp:130,maxHp:195}))),null);
  assert.equal(flagshipChange(flagshipState(ship({hp:0,dead:1})),full),null);
  assert.deepEqual(flagshipChange(full,flagshipState(ship(),{rank:2,xp:0})),{kind:'rank',value:2});
});
