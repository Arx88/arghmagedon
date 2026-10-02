import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildTerrainSurface } from '../src/terrain-surface.js';

test('terrain emits exposed walls while retaining voxel height and paint', () => {
  const parent = new THREE.Group();
  const cells = [0, 1].map(x => ({x, z: 0, h: 2, topColor: 0xffffff, sideColor: 0x000000}));
  const mesh = buildTerrainSurface(parent, cells, 1, 'tropical');
  assert.equal(mesh.geometry.attributes.position.count, 48); // Two tops and six exterior walls.
  assert.ok(Math.abs(mesh.geometry.boundingSphere.center.y - .85) < 1e-6);
  const normals = mesh.geometry.attributes.normal;
  for (let n = 0; n < normals.count; n++) {
    if (normals.getY(n) === 1) assert.equal(mesh.geometry.attributes.position.getY(n), 2);
  }
  cells[1].h = 1;
  const stepped = buildTerrainSurface(new THREE.Group(), cells, 1, 'snow');
  assert.equal(stepped.geometry.attributes.position.count, 54); // Adds the exposed step wall.
  assert.ok(stepped.geometry.attributes.color.getX(0) < 1);
});
