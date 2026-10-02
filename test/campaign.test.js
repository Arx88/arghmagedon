import test from 'node:test';
import assert from 'node:assert/strict';
import { hireRole, dismissRole, specialistCount,marinerCount,cannonReload,boardingExchange,reconcileRoles, invasionDuration, stepInvasion, canScoutLoot, lootDuration, applyAmmoEffect, garrisons,purchaseBlockReason } from '../src/campaign-rules.js';

test('hiring a specialist adds a pirate, respects capacity and reconciles later casualties',()=>{
  const ship={crew:8,maxCrew:12,roles:{repairers:0,looters:0}};
  assert.equal(hireRole(ship,'repairers'),true);assert.equal(ship.crew,9);assert.equal(ship.roles.repairers,1);
  for(let n=0;n<3;n++)assert.equal(hireRole(ship,'looters'),true);
  assert.equal(ship.crew,12);assert.equal(hireRole(ship,'repairers'),false);assert.equal(hireRole(ship,'captain'),false);
  ship.crew=1;reconcileRoles(ship);assert.equal(ship.roles.repairers+ship.roles.looters,1);
});
test('numerical superiority never captures an island instantly; defenders can interrupt',()=>{
  const duration=invasionDuration(10,8,.2);assert.ok(duration>=28&&duration<=45);
  const invasion={attackers:10,progress:0,duration};
  assert.equal(stepInvasion(invasion,1,false),'invading');
  for(let i=0;i<40;i++)stepInvasion(invasion,1,true);
  assert.equal(invasion.progress,0);
  assert.equal(stepInvasion(invasion,duration,false),'captured');
  invasion.attackers=0;assert.equal(stepInvasion(invasion,1,false),'repelled');
  assert.ok(invasionDuration(10,8,.1)!==invasionDuration(10,8,.9));
});
test('all four specialties occupy real places and disembarking never creates a free recruit',()=>{
  const ship={crew:8,maxCrew:12,roles:{repairers:0,looters:0}};
  for(const role of ['repairers','looters','boarders','gunners'])assert.equal(hireRole(ship,role),true);
  assert.equal(ship.crew,12);assert.equal(specialistCount(ship),4);assert.equal(marinerCount(ship),8);
  assert.equal(hireRole(ship,'gunners'),false);
  assert.equal(dismissRole(ship,'boarders'),true);assert.equal(ship.crew,11);assert.equal(marinerCount(ship),8);
  assert.equal(dismissRole(ship,'boarders'),false);assert.equal(dismissRole(ship,'captain'),false);
  ship.crew=2;reconcileRoles(ship);assert.equal(specialistCount(ship),2);
  ship.crew=0;reconcileRoles(ship);assert.equal(specialistCount(ship),0);
  const last={crew:1,maxCrew:12,roles:{gunners:1}};assert.equal(dismissRole(last,'gunners'),false);
});
test('gunners shorten actual reload with a bounded bonus and preserve ammunition and rum modifiers',()=>{
  const ship={crew:12,reload:2.8,roles:{gunners:0}},base=cannonReload(ship);
  ship.roles.gunners=1;assert.ok(cannonReload(ship)<base);assert.equal(cannonReload(ship),base/1.035);
  assert.equal(cannonReload(ship,1.4,true),cannonReload(ship)*1.4*.78);
  ship.roles.gunners=99;assert.equal(cannonReload(ship),base*.82);
});
test('boarding specialists change naval damage and retaliation while keeping the four-second encounter',()=>{
  const attacker={crew:10,roles:{boarders:0}},defender={crew:8,roles:{boarders:0}},base=boardingExchange(attacker,defender);
  assert.deepEqual(base,{outgoing:35,retaliation:10.4});
  attacker.roles.boarders=2;const trained=boardingExchange(attacker,defender);
  assert.equal(trained.outgoing,42);assert.equal(trained.retaliation,base.retaliation*.9);
  defender.roles.boarders=2;assert.ok(boardingExchange(attacker,defender).retaliation>trained.retaliation);
  attacker.roles.boarders=99;assert.equal(boardingExchange(attacker,defender).outgoing,52.5);
});
test('only tier III scouts loot eligible, available, undefended, nonhostile islands regardless of visual size',()=>{
  const island={r:26,type:'treasure',autoLootEligible:true,owner:'neutral',defenders:0,available:true,invasion:null};
  assert.equal(canScoutLoot(island,1),false);assert.equal(canScoutLoot(island,2),false);assert.equal(canScoutLoot(island,3),true);
  for(const change of [{autoLootEligible:false},{type:'port'},{homeTeam:'blue'},{owner:'red'},{defenders:1},{available:false},{invasion:{}}])assert.equal(canScoutLoot({...island,...change},3),false);
  assert.equal(canScoutLoot({...island,owner:'red'},3,'red'),true);
  const scout={},player={};island.lootSource=scout;
  assert.equal(canScoutLoot(island,3),false);assert.equal(canScoutLoot(island,3,'blue',player),false);assert.equal(canScoutLoot(island,3,'blue',scout),true);
});
test('repeated shells renew effects instead of stacking damage or immobilizing the target',()=>{
  const ship={},source={name:'Captain'};
  for(let i=0;i<4;i++){applyAmmoEffect(ship,1,2,source);applyAmmoEffect(ship,2,2,source);}
  assert.equal(ship.slow,7);assert.ok(ship.slowFactor>.5);assert.equal(ship.burning,5);assert.equal(ship.burnDamage,3);assert.equal(ship.burnSource,source);
});
test('looting retains a minimum time and garrisons follow the four specified tiers',()=>{
  assert.equal(lootDuration(0),10);assert.equal(lootDuration(99),6);assert(lootDuration(2)<10);assert.equal(lootDuration(-1),10);assert.deepEqual(garrisons,[0,5,8,12,16]);
});
test('purchase restrictions explain maximum levels, capacity, territory, docking and missing money',()=>{
  assert.equal(purchaseBlockReason({maxed:true,docked:false,money:0,cost:150}),'Nivel máximo');
  assert.equal(purchaseBlockReason({full:true}),'Sin plazas libres');
  assert.equal(purchaseBlockReason({restriction:'Conquista esta isla',money:0,cost:100}),'Conquista esta isla');
  assert.equal(purchaseBlockReason({docked:false}),'Vuelve a tu puerto');
  assert.equal(purchaseBlockReason({money:45,cost:100}),'Faltan 55 oro');
  assert.equal(purchaseBlockReason({money:100,cost:100}),'');
});
