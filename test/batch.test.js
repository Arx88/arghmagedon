import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { batchPaint } from '../src/batch.js';

function block(parent, color, x = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ color }));
  mesh.position.x = x; parent.add(mesh); return mesh;
}

test('paint batching preserves vertex colors and local transforms', () => {
  const group = new THREE.Group();
  block(group, 0xff0000, -2); block(group, 0x0000ff, 2);
  batchPaint(group);
  assert.equal(group.children.length, 1);
  const mesh = group.children[0], colors = mesh.geometry.attributes.color;
  assert.equal(mesh.material.vertexColors, true);
  assert.equal(colors.getX(0), 1);
  assert.equal(colors.getZ(colors.count - 1), 1);
  mesh.geometry.computeBoundingBox();
  assert.equal(mesh.geometry.boundingBox.min.x, -2.5);
  assert.equal(mesh.geometry.boundingBox.max.x, 2.5);
});

test('animated joints and excluded cloth remain independent after recursive batching', () => {
  const root = new THREE.Group(), joint = new THREE.Group(); root.add(joint);
  block(root, 0xffffff); block(root, 0x112233);
  block(joint, 0xffffff); block(joint, 0x112233);
  const cloth = block(root, 0xffffff, 4);
  batchPaint(root, true, new Set([cloth]));
  assert.equal(joint.parent, root);
  assert.equal(cloth.parent, root);
  assert.equal(joint.children.length, 1);
  assert.equal(root.children.length, 3);
  joint.rotation.x = .7;
  assert.equal(joint.rotation.x, .7);
});
