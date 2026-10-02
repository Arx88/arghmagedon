import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ShotEffects, TRAIL_FADE } from '../src/shot-effects.js';

const camera = () => { const c = new THREE.PerspectiveCamera(50, 1, .1, 100); c.position.set(0, 12, 18); c.updateMatrixWorld(); return c; };

test('a trail starts collapsed and stretches as the shot flies', () => {
  const fx = new ShotEffects(new THREE.Scene(), { trails: 4, samples: 8, glows: 4 });
  const cam = camera();
  const slot = fx.begin(new THREE.Vector3(0, 2, 0), 0);
  fx.update(.016, cam);
  const spread = () => {
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < 8; i++) min = Math.min(min, slot.points[i].x), max = Math.max(max, slot.points[i].x);
    return max - min;
  };
  assert.equal(spread(), 0, 'a fresh trail has no length yet');
  for (let i = 1; i <= 8; i++) fx.advance(slot, new THREE.Vector3(-i * 2, 2, 0));
  fx.update(.016, cam);
  // It has to stretch, but only as far as its world-unit budget allows.
  assert.ok(spread() > 1, `trail did not stretch, spread ${spread()}`);
  assert.ok(spread() <= fx.length + 1e-6, `trail overran its budget: ${spread()}`);
});

test('a released trail dissolves and then frees its slot', () => {
  const fx = new ShotEffects(new THREE.Scene(), { trails: 4, samples: 8, glows: 4 });
  const cam = camera();
  const slot = fx.begin(new THREE.Vector3(0, 2, 0), 0);
  for (let i = 1; i <= 8; i++) fx.advance(slot, new THREE.Vector3(-i * 2, 2, 0));
  fx.release(slot);
  assert.equal(slot.fade, 1, 'releasing must not skip the dissolve');
  fx.update(TRAIL_FADE, cam);
  assert.equal(slot.fade, 0);
  assert.equal(slot.active, false, 'a spent slot must return to the pool');
});

test('a released trail stops growing so the ribbon cannot chase a dead shot', () => {
  const fx = new ShotEffects(new THREE.Scene(), { trails: 4, samples: 8, glows: 4 });
  const cam = camera();
  const slot = fx.begin(new THREE.Vector3(0, 2, 0), 0);
  fx.advance(slot, new THREE.Vector3(-4, 2, 0));
  fx.release(slot);
  fx.advance(slot, new THREE.Vector3(-40, 2, 0));
  assert.ok(slot.points[0].x > -5, `released trails must ignore further positions, head at ${slot.points[0].x}`);
});

test('a stationary shot keeps its head instead of collapsing the ribbon', () => {
  const fx = new ShotEffects(new THREE.Scene(), { trails: 4, samples: 8, glows: 4, minStep: .5 });
  const slot = fx.begin(new THREE.Vector3(0, 2, 0), 0);
  for (let i = 1; i <= 8; i++) fx.advance(slot, new THREE.Vector3(-i * 2, 2, 0));
  fx.advance(slot, new THREE.Vector3(-16, 2, 0));
  const points = slot.points.length;
  assert.equal(points, 8, 'sample count must stay fixed');
  assert.ok(Math.abs(slot.points[0].x - (-16)) < 1e-6, 'a shot below minStep still updates its head');
});

test('more shots on screen than pooled slots recycle rather than throw', () => {
  const fx = new ShotEffects(new THREE.Scene(), { trails: 3, samples: 6, glows: 2 });
  const cam = camera();
  const slots = [0, 1, 2, 3, 4].map(() => fx.begin(new THREE.Vector3(0, 2, 0), 0));
  fx.update(.016, cam);
  assert.equal(fx.slots.filter(s => s.active).length, 3);
  assert.ok(slots.every(s => s.active), 'recycled slots stay usable');
});

test('the ribbon mesh is a single draw call regardless of shot count', () => {
  const fx = new ShotEffects(new THREE.Scene(), { trails: 12, samples: 6, glows: 6 });
  assert.equal(fx.mesh.geometry.index.count / 3, 12 * 5 * 2);
  assert.equal(fx.mesh.isMesh, true);
  assert.equal(fx.glows.isInstancedMesh, true);
});
test('a trail stays short and faint enough to read against open water', () => {
  // The regression: a ribbon long, wide and bright enough turns into a white bar
  // painted across the sea, and every weapon ends up looking like the same bar.
  const fx = new ShotEffects(new THREE.Scene());
  const cam = camera();
  const slot = fx.begin(new THREE.Vector3(0, 2, 0), 0);
  for (let i = 1; i <= 60; i++) fx.advance(slot, new THREE.Vector3(-i * 2, 2, 0));
  fx.update(.016, cam);
  const points = slot.points;
  const length = points[0].distanceTo(points[points.length - 1]);
  assert.ok(length < 3, `trail stretched ${length.toFixed(1)} units behind one cannonball`);
  assert.ok(Math.max(...fx.alphas) < .4, `trail peak alpha ${Math.max(...fx.alphas)} whites out the water`);
});

test('each weapon gets its own colour and weight', () => {
  const fx = new ShotEffects(new THREE.Scene());
  const seen = new Set();
  for (const kind of [0, 1, 2, 3]) {
    const slot = fx.begin(new THREE.Vector3(0, 2, 0), kind);
    fx.update(.016, camera());
    const base = fx.slots.indexOf(slot) * fx.samples * 2;
    const rgb = [0, 1, 2].map(c => Math.round(fx.colors[(base + c) * 3] * 255)).join(',');
    assert.ok(!seen.has(rgb), `weapons share a trail colour: ${rgb}`);
    seen.add(rgb);
  }
  assert.equal(seen.size, 4);
});

test('each weapon draws its ribbon at its own weight', () => {
  // The regression: one shared alpha made a salvo four copies of the same streak.
  const fx = new ShotEffects(new THREE.Scene());
  const cam = camera();
  const peak = kind => {
    const slot = fx.begin(new THREE.Vector3(0, 2, 0), kind);
    for (let i = 1; i <= 20; i++) fx.advance(slot, new THREE.Vector3(-i * .5, 2, 0));
    fx.update(.016, cam);
    const base = fx.slots.indexOf(slot) * fx.samples * 2;
    return Math.max(...fx.alphas.slice(base, base + fx.samples * 2));
  };
  const peaks = [0, 1, 2, 3].map(peak);
  assert.ok(peaks[0] < .4, `iron peak alpha ${peaks[0]} still whites out the water`);
  assert.ok(peaks[2] > peaks[0], `the firepot must outshine plain iron, got ${peaks[2]} vs ${peaks[0]}`);
  assert.equal(new Set(peaks.map(p => p.toFixed(3))).size, 4, `ribbons share a weight: ${peaks}`);
});

test('a burning shell beats in the air while a round shot holds steady', () => {
  // A steady disc is the same disc whatever put it there. The bomb throbs like a
  // fuse and the iron does not, and that alone tells the two apart mid-flight.
  const fx = new ShotEffects(new THREE.Scene(), { glows: 4 });
  const cam = camera();
  const iron = fx.begin(new THREE.Vector3(0, 2, 0), 0);
  const bomb = fx.begin(new THREE.Vector3(6, 2, 0), 3);
  const ironIdx = fx.glowSlots.indexOf(iron.glow), bombIdx = fx.glowSlots.indexOf(bomb.glow);
  const m = new THREE.Matrix4(), swing = { iron: [], bomb: [] };
  for (let step = 0; step < 24; step++) {
    fx.update(.012, cam);
    fx.glows.getMatrixAt(ironIdx, m); swing.iron.push(m.elements[0]);
    fx.glows.getMatrixAt(bombIdx, m); swing.bomb.push(m.elements[0]);
  }
  const range = seen => Math.max(...seen) - Math.min(...seen);
  assert.ok(range(swing.iron) < 1e-5, `iron should hold a steady halo, it swung ${range(swing.iron)}`);
  assert.ok(range(swing.bomb) > .05, `the bomb should beat in flight, it swung ${range(swing.bomb)}`);
});

test('the four halos are not one halo at four brightnesses', () => {
  const fx = new ShotEffects(new THREE.Scene(), { glows: 4 });
  const cam = camera(), m = new THREE.Matrix4(), tint = new THREE.Color();
  const marks = [];
  for (const kind of [0, 1, 2, 3]) {
    const slot = fx.begin(new THREE.Vector3(0, 2, 0), kind);
    fx.update(.016, cam);
    const i = fx.glowSlots.indexOf(slot.glow);
    fx.glows.getMatrixAt(i, m); fx.glows.getColorAt(i, tint);
    marks.push(`${m.elements[0].toFixed(3)}:${[tint.r, tint.g, tint.b].map(c => Math.round(c * 255)).join(',')}`);
  }
  assert.equal(new Set(marks).size, 4, `halos are indistinguishable: ${marks}`);
});
