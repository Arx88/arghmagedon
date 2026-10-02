import test from 'node:test';
import assert from 'node:assert/strict';
import { arrangeWorldLabels } from '../src/hud-layout.js';

test('selected targets win crowded labels, with no HUD or edge collisions',()=>{
  const candidates=[{id:'island',x:230,y:250,width:180,height:30,priority:1,distance:20},{id:'target',x:235,y:252,width:180,height:45,priority:3,distance:25},{id:'hud',x:600,y:270,width:160,height:30,priority:2,distance:10},{id:'edge',x:8,y:160,width:190,height:45,priority:2,distance:12}];
  const result=arrangeWorldLabels(candidates,[{left:500,right:750,top:200,bottom:320}],{width:800,height:600});
  assert.deepEqual(result.map(p=>p.id),['target']);
});

test('labels keep a clear battle area and respect the two-name budget',()=>{
  const candidates=Array.from({length:5},(_,i)=>({id:i,x:110+i*190,y:250,width:130,height:30,priority:1,distance:i}));
  const result=arrangeWorldLabels(candidates,[],{width:1100,height:720});
  assert.equal(result.length,2);
  assert.deepEqual(result.map(p=>p.id),[0,1]);
});
