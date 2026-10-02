import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CrewRenderer } from '../src/crew-renderer.js';
test('shared crew rendering retains articulated transforms and excludes hidden or detached sailors',()=>{
  const scene=new THREE.Scene(),ship=new THREE.Group();scene.add(ship);ship.position.x=10;
  const geometry=new THREE.BoxGeometry(.4,.5,.3),material=new THREE.MeshStandardMaterial();
  const sailors=[];
  for(let n=0;n<2;n++){const root=new THREE.Group(),arm=new THREE.Group();root.userData.limbs=[arm];root.position.z=n;root.add(arm);arm.add(new THREE.Mesh(geometry,material));ship.add(root);sailors.push({root,arm});}
  const renderer=new CrewRenderer(scene);renderer.update(0);assert.equal(renderer.parts.size,1);
  const batch=[...renderer.parts.values()][0];assert.equal(batch.mesh.count,2);
  sailors[0].arm.rotation.x=.5;renderer.update(.1);const matrix=new THREE.Matrix4();batch.mesh.getMatrixAt(0,matrix);assert.ok(Math.abs(matrix.elements[6]-Math.sin(.5))<1e-6);assert.equal(matrix.elements[12],10);
  sailors[0].root.visible=false;renderer.update(.1);assert.equal(batch.mesh.count,1);
  sailors[1].root.removeFromParent();renderer.update(.1);assert.equal(batch.mesh.count,0);
});
