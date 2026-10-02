import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {existsSync} from 'node:fs';
import {fleetSailProfiles,fleetSailIdentity,applyFleetSails} from '../src/fleet-appearance.js';
import {createShip} from '../src/ship-designs.js';

test('fleet identifiers match the requested cream spyglass, blue compass and red tower',()=>{
 assert.equal(fleetSailIdentity({support:'scout'},1).motif,'spyglass');
 assert.equal(fleetSailIdentity({variant:'scout'},2).motif,'compass');
 assert.equal(fleetSailIdentity({variant:'scout'},3).id,'scoutII');
 assert.equal(fleetSailIdentity({support:'guard'},3).motif,'tower');
 assert.equal(fleetSailIdentity({variant:'brig'}),null);
 for(const profile of Object.values(fleetSailProfiles))assert.ok(existsSync(new URL('../public'+profile.path,import.meta.url)));
});
test('a scout upgrade changes existing main cloth without replacing the rig or its pinned jib',()=>{
 const ship={variant:'scout',support:'scout',object:createShip('blue',.65,'scout')};
 const data=ship.object.userData,main=data.sails[0],jib=data.sails.find(s=>s.userData.sailKind==='jib');
 const geometry=main.userData.cloth.geometry,material=main.userData.cloth.material,jibMaterial=jib.userData.cloth.material;
 const maps=new Map(),get=path=>{if(!maps.has(path))maps.set(path,new THREE.Texture());return maps.get(path);};
 applyFleetSails(ship,1,get);const cream=material.map;applyFleetSails(ship,2,get);
 assert.notEqual(material.map,cream);assert.equal(data.fleetMotif,'compass');assert.equal(ship.scoutLevel,2);
 assert.equal(main.userData.cloth.geometry,geometry);assert.equal(main.userData.cloth.material,material);
 assert.equal(jib.userData.cloth.material,jibMaterial);assert.equal(jib.userData.cloth.material.map,null);
 assert.equal(jib.userData.fixedRig,true);assert.equal(main.userData.sailKind,'square');
});
test('both purchased hulls have a counted lookout and a real telescope above the main sail',()=>{
 for(const variant of ['scout','guard']){
  const data=createShip('blue',.65,variant).userData;
  assert.equal(data.crew[0],data.lookout);assert.equal(data.lookout.userData.lookout,true);
  assert.ok(data.lookout.getObjectByName('telescopio-del-vigia'));
  assert.ok(data.lookout.position.y>data.sails[0].position.y);
  assert.equal(data.sails.filter(s=>s.userData.sailKind==='square').length,1);
 }
});
