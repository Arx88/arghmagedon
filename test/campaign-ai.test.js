import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {registerHooks} from 'node:module';
import {islandDefinitions,worldBounds,getHomeBase,teamSpawn,battleWinner} from '../src/battlefield.js';

// Canvas textures and Exploration's offscreen map buffer need a DOM; no renderer is used here.
globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},save(){},restore(){},translate(){},scale(){},setLineDash(){},strokeRect(){},createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)})})})};
registerHooks({load:(url,context,next)=>url.endsWith('.css')?{format:'module',source:'export {};',shortCircuit:true}:next(url,context)});
const {Campaign}=await import('../src/campaign.js');
const {createShip}=await import('../src/pixel-art.js');
class NoUICampaign extends Campaign{createUI(){}updateVision(){}updateHUD(){}}
const boat=(team)=>({name:team+' captain',team,...teamSpawn(islandDefinitions,team),object:new THREE.Group(),crew:8,maxCrew:12,roles:{repairers:0,looters:0},upgrades:{hull:0,cannons:0,crew:0},level:1,hp:160,maxHp:160,damage:24,reload:2.8,gold:0,dead:0,vx:0,vz:0,speed:0});
function fixture(){
  const scene=new THREE.Scene(),islands=islandDefinitions.map(i=>({...i,group:new THREE.Group(),treasure:new THREE.Group(),available:true}));
  const player=boat('blue'),enemy=boat('red'),wallet={blue:200,red:200},captured=[],upgraded=[],shots=[];
  const campaign=new NoUICampaign({scene,islands,port:getHomeBase(islands,'blue'),player,ships:[player,enemy],bounds:worldBounds,ocean:{islands:{value:islands.map(i=>new THREE.Vector4(i.x,i.z,i.r,0))}},bestiary:{entries:[]},director:{log(){},announce(){},reportIsland(){}},toast(){},fire:(s,t)=>shots.push([s,t]),towerShot(){},getBank:()=>wallet.blue,inPort:()=>true,getTeamBank:team=>team==='blue'?campaign.aiBanks.blue:wallet.red,chargeTeam:(team,amount)=>{const available=team==='blue'?campaign.aiBanks.blue:wallet.red;if(available<amount)return false;if(team==='blue')campaign.aiBanks.blue-=amount;else wallet.red-=amount;return true;},creditTeam:(team,amount)=>{if(team==='blue')campaign.aiBanks.blue+=amount;else wallet.red+=amount;},onAIUpgrade:(ship,kind)=>upgraded.push(kind),onBaseCaptured:(team,island)=>captured.push([team,island]),beginLoot(){throw Error('Base capture must not start a treasure loot.');}});
  return {campaign,islands,player,enemy,wallet,captured,upgraded,shots};
}
test('both home bases begin known, owned, guarded and with the same tower defenses',()=>{
  const {campaign,islands}=fixture();const bases=islands.filter(i=>i.homeTeam);
  assert.equal(campaign.towers.length,2);
  for(const base of bases){assert.equal(base.owner,base.homeTeam);assert.equal(base.defenders,8);assert.equal(base.garrisonLevel,2);assert.equal(base.tower.hp,180);assert.equal(base.discovered,true);assert.equal(base.available,false);}
});

test('the territory panel prioritizes the home defenses while docked even if a discovered cove is closer',()=>{
  const {campaign,islands}=fixture(),cove=islands.find(i=>i.id==='blue-cove');cove.discovered=true;
  assert.equal(campaign.nearestIsland(),cove);assert.equal(campaign.selectIsland(),getHomeBase(islands,'blue'));
  campaign.inPort=()=>false;assert.equal(campaign.selectIsland(),cove);
});

test('purchase feedback only fires after a successful paid action',()=>{
  const {campaign,player,wallet}=fixture(),orders=[];campaign.renderPanel=()=>{};campaign.onPurchase=order=>orders.push(order);campaign.charge=cost=>{if(wallet.blue<cost)return false;wallet.blue-=cost;return true;};
  campaign.purchase('repairer');assert.equal(player.crew,9);assert.equal(wallet.blue,155);assert.deepEqual(orders,['repairer']);
  wallet.blue=0;campaign.purchase('looter');assert.equal(player.crew,9);assert.deepEqual(orders,['repairer']);
  campaign.buyShipUpgrade=()=>true;campaign.purchase('ship:hull');assert.deepEqual(orders,['repairer','ship:hull']);
  campaign.buyShipUpgrade=()=>false;campaign.purchase('ship:cannons');assert.equal(orders.length,2);
});
test('new crew contracts charge gold, reserve capacity and can only disembark in port without refund',()=>{
  const {campaign,player,wallet}=fixture(),orders=[];campaign.renderPanel=()=>{};campaign.onPurchase=order=>orders.push(order);campaign.charge=cost=>{if(wallet.blue<cost)return false;wallet.blue-=cost;return true;};
  campaign.purchase('boarder');assert.equal(player.roles.boarders,1);assert.equal(player.crew,9);assert.equal(wallet.blue,145);
  campaign.purchase('gunner');assert.equal(player.roles.gunners,1);assert.equal(player.crew,10);assert.equal(wallet.blue,80);
  campaign.inPort=()=>false;campaign.purchase('dismiss:boarder');assert.equal(player.crew,10);assert.equal(wallet.blue,80);
  campaign.inPort=()=>true;campaign.purchase('dismiss:boarder');assert.equal(player.crew,9);assert.equal(player.roles.boarders,0);assert.equal(wallet.blue,80);
  campaign.purchase('dismiss:boarder');assert.equal(player.crew,9);
  player.crew=player.maxCrew;campaign.purchase('gunner');assert.equal(player.roles.gunners,1);assert.equal(wallet.blue,80);
  player.crew=11;wallet.blue=0;campaign.purchase('gunner');assert.equal(player.roles.gunners,1);assert.equal(player.crew,11);
  assert.deepEqual(orders,['boarder','gunner','crew-dismiss']);
});

test('a scout reserves available treasure against competing scouts and releases on completion or interruption',()=>{
  const {campaign,islands,player}=fixture(),island=islands.find(i=>i.autoLootEligible);campaign.scoutLevel=3;
  const scout=()=>({...boat('blue'),support:'scout',x:island.x+island.r*.35,z:island.z+island.r*.72+8,routeIsland:island,visited:new Set(),lootClock:0});
  const first=scout(),other=scout();campaign.supportOrders(first,1);assert.equal(island.lootSource,first);
  campaign.supportOrders(other,14);assert.equal(other.gold,0);assert.equal(island.lootSource,first);
  campaign.supportOrders(first,13);assert.equal(first.gold,island.gold);assert.equal(island.available,false);assert.equal(island.lootSource,null);
  island.available=true;island.lootSource=player;const blocked=scout();campaign.supportOrders(blocked,14);assert.equal(blocked.gold,0);assert.equal(island.lootSource,player);
  island.lootSource=null;const interrupted=scout();campaign.supportOrders(interrupted,1);interrupted.x+=20;campaign.supportOrders(interrupted,1);assert.equal(island.lootSource,null);assert.equal(interrupted.lootClock,0);
});

test('a sunk scout frees its reservation even when the game skips further support orders',()=>{
  const {campaign,islands}=fixture(),island=islands.find(i=>i.autoLootEligible),scout={...boat('blue'),support:'scout',routeIsland:island,lootIsland:island,lootClock:5,dead:1};
  island.lootSource=scout;campaign.ships.push(scout);campaign.update(1/60,1);assert.equal(island.lootSource,null);assert.equal(scout.lootIsland,null);assert.equal(scout.lootClock,0);
});

test('buying either support hull initializes its crew roles before the next live campaign frame',()=>{
  for(const role of ['scout','guard']){
    const {campaign,wallet}=fixture();campaign.renderPanel=()=>{};campaign.charge=amount=>{if(wallet.blue<amount)return false;wallet.blue-=amount;return true;};
    campaign.makeShip=(name,team,x,z,heading,scale,variant)=>{
      const ship={...boat(team),name,x,z,heading,scale,variant,object:createShip(team,scale,variant),home:{x,z}};
      delete ship.roles;campaign.scene.add(ship.object);campaign.ships.push(ship);return ship;
    };
    campaign.purchase(role);const ship=campaign.ships.at(-1);
    assert.equal(ship.support,role);assert.deepEqual(ship.roles,{repairers:0,looters:0});assert.equal(ship.crew,4);
    assert.equal(wallet.blue,role==='scout'?40:60);assert.doesNotThrow(()=>campaign.update(1/60,1));
  }
});

test('a paid scout upgrade changes existing sail identity and subsequent purchases inherit it',()=>{
  const {campaign,wallet}=fixture();wallet.blue=1000;campaign.renderPanel=()=>{};
  campaign.charge=cost=>{if(wallet.blue<cost)return false;wallet.blue-=cost;return true;};
  campaign.makeShip=(name,team,x,z,heading,scale,variant)=>{
    const ship={...boat(team),name,x,z,heading,scale,variant,object:createShip(team,scale,variant),home:{x,z}};
    campaign.scene.add(ship.object);campaign.ships.push(ship);return ship;
  };
  campaign.purchase('scout');const original=campaign.living('scout')[0];
  assert.equal(original.object.userData.fleetMotif,'spyglass');
  const originalMap=original.object.userData.sails[0].userData.cloth.material.map;
  campaign.purchase('scout-up');
  assert.equal(campaign.living('scout')[0],original);assert.equal(original.scoutLevel,2);
  assert.equal(original.object.userData.fleetMotif,'compass');
  assert.notEqual(original.object.userData.sails[0].userData.cloth.material.map,originalMap);
  campaign.purchase('scout');campaign.purchase('guard');
  const scouts=campaign.living('scout');assert.equal(scouts.length,2);
  assert.equal(scouts[1].scoutLevel,2);assert.equal(scouts[1].object.userData.fleetMotif,'compass');
  assert.equal(campaign.living('guard')[0].object.userData.fleetMotif,'tower');assert.equal(wallet.blue,360);
  wallet.blue=0;campaign.purchase('scout-up');assert.equal(campaign.scoutLevel,2);
  assert.equal(original.object.userData.fleetMotif,'compass');
});

test('ordinary fleet AI shares the loot reservation and releases it on reroute, sinking and completion',()=>{
  const {campaign,islands,player}=fixture(),island=islands.find(i=>i.id==='blue-cove'),ship={...boat('blue'),aiRole:'merchant',raidIsland:island,x:island.x+island.r+2,z:island.z};island.owner='blue';campaign.ships.push(ship);
  island.lootSource=player;campaign.enemyOrders(ship,10);assert.equal(ship.gold,0);assert.equal(island.lootSource,player);
  island.lootSource=null;ship.raidIsland=island;campaign.enemyOrders(ship,1);assert.equal(island.lootSource,ship);
  ship.raidIsland=null;campaign.update(1/60,1);assert.equal(island.lootSource,null);
  ship.raidIsland=island;campaign.enemyOrders(ship,1);ship.dead=1;campaign.update(1/60,2);assert.equal(island.lootSource,null);
  ship.dead=0;ship.raidIsland=island;campaign.enemyOrders(ship,10);assert.equal(ship.gold,island.gold);assert.equal(island.available,false);assert.equal(island.lootSource,null);
});
test('AI deposits and spends its own team gold to recruit and improve instead of merely counting score',()=>{
  const {campaign,enemy,wallet,upgraded}=fixture();enemy.gold=100;
  campaign.enemyOrders(enemy,1/60);
  assert.equal(enemy.gold,0);assert.equal(wallet.blue,200);assert.equal(wallet.red,75);
  assert.equal(enemy.crew,11);assert.equal(enemy.roles.repairers,1);assert.equal(enemy.damage,28);assert.deepEqual(upgraded,['cannons']);
});

test('allied AI deposits and buys from its own treasury without touching the captain savings',()=>{
  const {campaign,wallet}=fixture(),ally=boat('blue');ally.aiRole='defender';ally.gold=100;campaign.ships.push(ally);
  campaign.enemyOrders(ally,1/60);
  assert.equal(ally.gold,0);assert.equal(ally.crew,11);assert.equal(ally.upgrades.cannons,1);
  assert.equal(campaign.aiBanks.blue,75);assert.equal(wallet.blue,200);assert.equal(campaign.getBank(),200);
  campaign.aiBanks.blue=0;assert.equal(campaign.spendFor('blue',15),false);assert.equal(wallet.blue,200);
  campaign.depositFor('blue',100,ally);assert.equal(campaign.aiBanks.blue,100);assert.equal(wallet.blue,200);
});
test('both teams route their skirmisher towards the opposing home base even though bases have no treasure',()=>{
  for(const team of ['blue','red']){const {campaign,islands,player,enemy}=fixture();campaign.time=200;const actor=team==='blue'?player:enemy;actor.aiRole='skirmisher';campaign.enemyOrders(actor,1/60);assert.equal(actor.raidIsland,getHomeBase(islands,team==='blue'?'red':'blue'));}
});

test('a defender keeps its home duty after 150 seconds and only collects a cleared local cay',()=>{
  const {campaign,islands,enemy,player}=fixture();campaign.time=900;
  enemy.aiRole='defender';player.x=-124;player.z=98;
  const home=getHomeBase(islands,'red'),cay=islands.find(i=>i.id==='red-cove');
  campaign.enemyOrders(enemy,.1);assert.equal(enemy.raidIsland,cay);
  cay.available=false;enemy.raidIsland=null;campaign.enemyOrders(enemy,.1);
  assert.ok(!enemy.raidIsland);assert.equal(enemy.orderText,'Guardia del puerto');
  assert.ok(Math.hypot(enemy.routeGoal.x-home.x,enemy.routeGoal.z-home.z)<home.r+12);
});

test('a defender sees a threat across its home patrol area and chases its actual water position',()=>{
  const {campaign,islands,enemy,player}=fixture(),home=getHomeBase(islands,'red');
  enemy.aiRole='defender';campaign.time=900;enemy.x=home.x-25;enemy.z=home.z;
  player.x=home.x+49;player.z=home.z;
  campaign.enemyOrders(enemy,.1);
  assert.equal(enemy.orderText,'Defendiendo la base');assert.deepEqual(enemy.routeGoal,{x:player.x,z:player.z});
  home.invasion={source:player,team:'blue'};campaign.enemyOrders(enemy,.1);
  assert.equal(enemy.orderText,'Interceptando el desembarco');assert.deepEqual(enemy.routeGoal,{x:player.x,z:player.z});
  assert.ok(Math.hypot(enemy.routeGoal.x-home.x,enemy.routeGoal.z-home.z)>home.r+22);
});

test('AI loots an undefended cay with the same ten-second rule without an extra capture countdown',()=>{
  const {campaign,islands,enemy}=fixture(),cay=islands.find(i=>i.id==='red-cove');
  enemy.aiRole='merchant';enemy.raidIsland=cay;enemy.x=cay.x+cay.r*.35;enemy.z=cay.z+cay.r*.72+8;enemy.lootClock=0;
  campaign.enemyOrders(enemy,.1);assert.equal(cay.owner,'red');assert.equal(cay.invasion,undefined);
  campaign.enemyOrders(enemy,9);assert.equal(enemy.gold,0);assert.equal(cay.lootSource,enemy);
  campaign.enemyOrders(enemy,1);assert.equal(enemy.gold,100);assert.equal(cay.available,false);
});
test('base conquest requires breaking its tower, can be contested, and signals victory without changing home identity',()=>{
  const {campaign,islands,player,enemy,captured}=fixture(),base=getHomeBase(islands,'red');
  const changes=[];campaign.onIslandCaptured=(island,team)=>changes.push([island,team]);
  player.x=base.x+30;player.z=base.z;player.crew=12;
  assert.equal(campaign.startInvasion(base,player),false);
  base.tower.dead=1;assert.equal(campaign.startInvasion(base,player),true);base.invasion.duration=28;
  campaign.update(1,1);assert.equal(base.owner,'red');assert.equal(base.invasion.progress,0);
  enemy.x=-150;enemy.z=130;
  for(let n=2;n<=30&&!captured.length;n++)campaign.update(1,n);
  assert.equal(base.owner,'blue');assert.equal(base.homeTeam,'red');assert.equal(battleWinner(islands),'blue');assert.equal(captured[0][0],'blue');assert.equal(base.invasion,null);
  assert.deepEqual(changes,[[base,'blue']]);
});
