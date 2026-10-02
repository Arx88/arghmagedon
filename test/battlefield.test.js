import test from 'node:test';
import assert from 'node:assert/strict';
import {islandDefinitions,worldBounds,getHomeBase,teamSpawn,isTeamDocked,battleWinner} from '../src/battlefield.js';

const territories=()=>islandDefinitions.map(i=>({...i,owner:i.homeTeam??'neutral'}));
test('the eleven island battlefield has two equally defended bases and mirrored resource opportunities',()=>{
  const islands=territories();assert.equal(islands.length,11);
  const blue=getHomeBase(islands,'blue'),red=getHomeBase(islands,'red');
  assert.equal(blue.x,-red.x);assert.equal(blue.z+red.z,-26);assert.equal(blue.r,red.r);
  for(const base of [blue,red]){assert.equal(base.initialDefenders,8);assert.equal(base.initialTower,true);assert.equal(base.gold,0);}
  for(const pair of new Set(islands.map(i=>i.pair).filter(Boolean))){const [a,b]=islands.filter(i=>i.pair===pair);assert.equal(a.x,-b.x);assert.equal(a.z+b.z,-26);assert.equal(a.r,b.r);assert.equal(a.gold,b.gold);assert.equal(a.initialDefenders,b.initialDefenders);assert.equal(a.autoLootEligible,b.autoLootEligible);}
  for(const island of islands){assert(island.x-island.r>=worldBounds.minX);assert(island.x+island.r<=worldBounds.maxX);assert(island.z-island.r*.72>=worldBounds.minZ);assert(island.z+island.r*.72<=worldBounds.maxZ);}
});
test('team spawns are mirrored, clear of land and within their own shop zone',()=>{
  const islands=territories(),blue=teamSpawn(islands,'blue'),red=teamSpawn(islands,'red');
  assert.equal(blue.x,-red.x);assert.equal(blue.z+red.z,-26);
  for(const team of ['blue','red']){const spawn=teamSpawn(islands,team),base=getHomeBase(islands,team);assert(isTeamDocked({...spawn,team},islands));assert(Math.hypot(spawn.x-base.x,(spawn.z-base.z)/.72)>base.r*1.2+4);}
});
test('victory and docking depend on captured home ownership, never port or fort architecture',()=>{
  const islands=territories(),blue=getHomeBase(islands,'blue'),red=getHomeBase(islands,'red');
  blue.type='treasure';red.type='port';assert.equal(battleWinner(islands),null);
  red.owner='blue';assert.equal(battleWinner(islands),'blue');assert.equal(red.homeTeam,'red');
  assert.equal(isTeamDocked({x:red.x+30,z:red.z,team:'red'},islands),false);
  blue.owner='red';assert.equal(battleWinner(islands),'draw');
  red.owner='red';assert.equal(battleWinner(islands),'red');
});
