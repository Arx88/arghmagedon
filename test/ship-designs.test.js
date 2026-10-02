import test from 'node:test';
import assert from 'node:assert/strict';
import { triangularSailGeometry, createShip } from '../src/ship-designs.js';

test('triangular sail keeps its three anchors and every edge pinned',()=>{
 const anchors=[[0,9,-3],[0,3,-10],[0,2.8,-3.4]],g=triangularSailGeometry(anchors,12,.7),p=g.attributes.position,uv=g.attributes.uv,flex=g.attributes.sailFlex;
 for(const anchor of anchors)assert.ok(Array.from({length:p.count},(_,i)=>Math.hypot(p.getX(i)-anchor[0],p.getY(i)-anchor[1],p.getZ(i)-anchor[2])).some(d=>d<1e-6));
 let interior=0;
 for(let i=0;i<p.count;i++){const b=uv.getX(i),c=uv.getY(i),a=1-b-c;if(Math.min(a,b,c)<1e-6){assert.ok(Math.abs(flex.getX(i))<1e-6);assert.ok(Math.abs(p.getX(i))<1e-6);}else{assert.ok(flex.getX(i)>0&&flex.getX(i)<=1.000001);interior++;}}
 assert.ok(interior>0);assert.equal(g.index.count,12*12*3);g.dispose();
});

test('each hull has its own fixed foresail attached to the actual front mast and bowsprit',()=>{
 const heights=[];
 for(const variant of ['brig','galleon','scout','guard','cutter']){
  const ship=createShip('blue',1,variant),jib=ship.userData.sails.find(s=>s.userData.sailKind==='jib');assert.ok(jib);assert.equal(jib.userData.fixedRig,true);assert.equal(jib.rotation.y,0);assert.equal(jib.userData.anchors.length,3);heights.push(jib.userData.anchors[0][1]);
  const p=jib.userData.cloth.geometry.attributes.position;for(let i=0;i<p.count;i++)assert.ok(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)));
 }
 assert.equal(new Set(heights).size,5);
});
