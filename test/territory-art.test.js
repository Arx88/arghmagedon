import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { TerritoryArt, territoryTexture } from '../src/territory-art.js';

test('territory crests are different shapes and remain opaque',()=>{
 const blue=territoryTexture('blue'),red=territoryTexture('red'),neutral=territoryTexture('neutral');
 assert.notDeepEqual(blue.image.data,red.image.data);assert.notDeepEqual(red.image.data,neutral.image.data);
 for(let i=3;i<blue.image.data.length;i+=4)assert.equal(blue.image.data[i],255);
 [blue,red,neutral].forEach(t=>t.dispose());
});

test('ownership changes lower the old banner before raising the new crest and keep the mast edge fixed',()=>{
 const island={group:new THREE.Group(),r:22,type:'port',homeTeam:'blue',owner:'blue'},art=new TerritoryArt([island]),record=art.records[0],initialY=record.main.cloth.position.y;
 island.owner='red';art.update(1,.22);assert.ok(record.main.cloth.position.y<initialY);assert.equal(record.shownOwner,'blue');
 art.update(1.3,.3);assert.equal(record.shownOwner,'red');assert.equal(island.homeTeam,'blue');
 art.update(2,1);assert.equal(record.transition,null);assert.ok(Math.abs(record.main.cloth.position.y-initialY)<1e-6);
 const geometry=record.main.cloth.geometry,p=geometry.attributes.position,uv=geometry.attributes.uv;
 for(let i=0;i<p.count;i++)if(uv.getX(i)===0)assert.equal(p.getZ(i),0);
 let disposed=0;geometry.addEventListener('dispose',()=>disposed++);art.dispose();assert.equal(disposed,1);assert.equal(island.group.children.length,0);assert.equal(art.records.length,0);
});
