import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createGrappleState, advanceGrappleState, cancelGrappleState, GrapplingHook } from '../src/grappling.js';

const source = () => ({ x: 0, y: 2, z: 0, alive: true });
const target = () => ({ x: 28, y: 2, z: 0, alive: true });

test('hook flies visibly, strikes, tightens and reels both ships before boarding', () => {
  const a = source(), b = target();
  let state = createGrappleState(a, b).state;
  const initial = JSON.stringify(state), first = advanceGrappleState(state, a, b, 1 / 60);
  assert.equal(JSON.stringify(state), initial, 'pure progression keeps the caller state unchanged');
  assert.equal(first.state.phase, 'flying'); assert.ok(first.state.hook.x > 0 && first.state.hook.x < 28);
  assert.ok(first.state.hook.y > 2, 'hook follows a readable ballistic arc');
  assert.deepEqual(first.pull.source, { x: 0, z: 0 });
  const events = [];
  for (let frame = 0; frame < 600; frame++) {
    const step = advanceGrappleState(state, a, b, 1 / 60); state = step.state;
    a.x += step.pull.source.x; a.z += step.pull.source.z; b.x += step.pull.target.x; b.z += step.pull.target.z;
    assert.ok(Math.hypot(step.pull.source.x, step.pull.source.z) <= 7 / 60);
    if (step.event) events.push(step.event);
    if (state.phase === 'boarding') break;
  }
  assert.deepEqual(events, ['hit', 'ready']); assert.equal(state.phase, 'boarding');
  assert.ok(a.x > 0 && b.x < 28, 'both hulls move instead of teleporting the target');
  assert.ok(Math.hypot(b.x - a.x, b.z - a.z) <= 12.54);
  assert.equal(advanceGrappleState(state, a, b, 1 / 60).event, null, 'ready fires once');
});

test('range rejection, a lost target, excessive stretch and cancellation release safely', () => {
  assert.equal(createGrappleState(source(), { ...target(), x: 33 }).reason, 'out-of-range');
  assert.equal(createGrappleState(source(), { ...target(), alive: false }).reason, 'invalid-target');
  const initial = createGrappleState(source(), target()).state;
  assert.equal(advanceGrappleState(initial, source(), { ...target(), alive: false }, .01).reason, 'target-lost');
  assert.equal(advanceGrappleState(initial, source(), { ...target(), x: 43 }, .01).reason, 'rope-broken');
  const cancelled = cancelGrappleState(initial, 'manual'); assert.equal(cancelled.phase, 'released');
  assert.equal(initial.phase, 'flying'); assert.equal(advanceGrappleState(cancelled, source(), target(), .1).event, null);
});

test('a stalled reel expires instead of trapping ships indefinitely', () => {
  let state = createGrappleState(source(), target(), { reelSpeed: 0, timeout: 2 }).state;
  let final;
  for (let frame = 0; frame < 150; frame++) { final = advanceGrappleState(state, source(), target(), 1 / 60); state = final.state; if (final.event === 'released') break; }
  assert.equal(state.phase, 'released'); assert.equal(final.reason, 'timeout');
});

test('the scene hook can be cancelled, relaunched and disposed without leaving meshes', () => {
  const scene = new THREE.Scene();
  const make = (x, team) => ({ x, z: 0, team, hp: 100, dead: false, speed: 0, vx: 0, vz: 0, scale: 1, object: new THREE.Group() });
  const a = make(0, 'blue'), b = make(24, 'red'); b.object.position.x = 24;
  const hook = new GrapplingHook(scene);
  assert.ok(hook.launch(a, b).ok); assert.equal(hook.launch(a, b).reason, 'busy');
  let ready = false;
  for (let frame = 0; frame < 300; frame++) if (hook.update(1 / 60)?.event === 'ready') { ready = true; break; }
  assert.ok(ready); assert.ok(hook.group.visible); assert.ok(hook.hook.children.length >= 10);
  assert.ok([...hook.rope.geometry.attributes.position.array].every(Number.isFinite));
  hook.cancel(); assert.equal(hook.active, false); assert.equal(hook.group.visible, false);
  assert.ok(hook.launch(a, b).ok); hook.dispose(); hook.dispose(); assert.equal(scene.children.length, 0);
  assert.equal(hook.launch(a, b).reason, 'disposed');
});
