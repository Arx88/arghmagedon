import test from 'node:test';
import assert from 'node:assert/strict';
import { createQAPilot, mountQABench, qaFixtures, qaSimulationDelta } from '../src/qa-bench.js';
import { getHomeBase, islandDefinitions, teamSpawn } from '../src/battlefield.js';

function fixture(options={}){
  const islands=islandDefinitions.map(i=>({...i,owner:i.homeTeam??'neutral',defenders:i.initialDefenders,available:!i.homeTeam,tower:i.initialTower?{hp:180,dead:0}:null}));
  const player={team:'blue',...teamSpawn(islands,'blue'),hp:160,maxHp:160,crew:8,maxCrew:12,gold:0,dead:0,roles:{repairers:0,looters:0},upgrades:{hull:0,cannons:0,crew:0}};
  const state={player,islands,ships:[player],bank:200,time:0,locked:false,gameOver:false,winner:null};
  const commands=[];
  const ctx={getState:()=>state,campaign:{purchase:id=>commands.push(['purchase',id]),cancelInvasion:island=>commands.push(['cancel',island.id]),startInvasion:island=>commands.push(['invade',island.id])},setCourse:(point,island)=>commands.push(['course',point,island?.id]),stopCourse:()=>commands.push(['stop']),loot:()=>commands.push(['loot']),cancelLoot:()=>commands.push(['cancel-loot']),fire:target=>{commands.push(['fire',target]);return true;},setSpeed:value=>commands.push(['speed',value])};
  const pilot=createQAPilot(ctx,options);
  const update=dt=>{state.time+=dt;return pilot.update(dt);};
  return {islands,player,state,ctx,commands,pilot,update};
}

test('the explicit QA clock preserves 4× time in throttled tabs with bounded fixed-step work',()=>{
  assert.equal(qaSimulationDelta(1,4),4);
  assert.equal(qaSimulationDelta(1,1),1);
  assert.equal(qaSimulationDelta(10,4),4);
  assert.equal(Math.ceil(qaSimulationDelta(1,4)/(1/60)),240);
  assert.equal(qaSimulationDelta(-1,4),0);
  assert.equal(qaSimulationDelta(NaN,4),0);
  const fast=Array.from({length:60},()=>qaSimulationDelta(1/60,4)).reduce((a,b)=>a+b,0);
  assert.ok(Math.abs(fast-qaSimulationDelta(1,4))<1e-12);
});

test('QA controls never mount in an ordinary game or without the exact opt-in query',()=>{
  let touched=false;const document={createElement(){touched=true;throw Error('must not create QA DOM');}};
  for(const search of ['', '?qa', '?qa=0', '?profile=1'])assert.equal(mountQABench({search,document}),null);
  assert.equal(touched,false);
  assert.equal(new Set(qaFixtures.map(([id])=>id)).size,qaFixtures.length);
});

test('starting and navigating the pilot only issues commands and never writes ship, economy or ownership',()=>{
  const {pilot,state,commands,update}=fixture();
  const snapshot=JSON.stringify(state);
  const recursivelyFreeze=object=>{if(!object||typeof object!=='object'||Object.isFrozen(object))return;Object.freeze(object);for(const value of Object.values(object))recursivelyFreeze(value);};
  recursivelyFreeze(state);
  pilot.start();pilot.update(.1);
  assert.equal(pilot.state.status,'running');assert.equal(pilot.state.phase,'sail');
  assert.deepEqual(commands.find(c=>c[0]==='course')[2],'blue-cove');
  assert.equal(JSON.stringify(state),snapshot);
});

test('a rejected real purchase fails with evidence instead of pretending an upgrade succeeded',()=>{
  const {pilot,state,player,update,islands}=fixture();
  pilot.start();pilot.state.phase='provision';
  const home=getHomeBase(islands,'blue');Object.assign(player,{x:home.x+25,z:home.z-16});
  update(1);
  assert.equal(pilot.state.status,'failed');assert.match(pilot.state.failure.reason,/rechazó ship:hull/);
  assert.equal(pilot.state.failure.evidence.bank,200);assert.equal(state.bank,200);assert.equal(player.upgrades.hull,0);
});

test('cargo must actually disappear into the home bank before the deposit milestone passes',()=>{
  const {pilot,player,state,update,islands}=fixture();
  pilot.start();const cove=islands.find(i=>i.id==='blue-cove');
  Object.assign(player,{x:cove.x+cove.r*.35,z:cove.z+cove.r*.72+9});
  update(.1);assert.equal(pilot.state.phase,'loot');
  player.gold=100;update(.1);assert.equal(pilot.state.phase,'deposit');
  const home=getHomeBase(islands,'blue');Object.assign(player,{x:home.x+25,z:home.z-16});
  update(21);
  assert.equal(pilot.state.status,'failed');assert.match(pilot.state.message,/depósito automático/);
  assert.equal(pilot.state.steps.deposit,false);assert.equal(state.bank,200);
});

test('looting the wrong overlapping island reports the integration failure',()=>{
  const {pilot,player,state,update,islands}=fixture();
  pilot.start();const cove=islands.find(i=>i.id==='blue-cove');
  Object.assign(player,{x:cove.x+cove.r*.35,z:cove.z+cove.r*.72+9});update(.1);
  state.lootIsland=islands.find(i=>i.id==='west-ruins');update(.1);
  assert.equal(pilot.state.status,'failed');assert.match(pilot.state.message,/en vez de la cala/);
});

test('a result screen or a premature owner change cannot falsely certify a full match',()=>{
  const run=fixture();run.pilot.start();run.state.gameOver=true;run.state.winner='blue';run.update(0);
  assert.equal(run.pilot.state.status,'failed');assert.match(run.pilot.state.message,/no fue conquistada/);
  const early=fixture();early.pilot.start();getHomeBase(early.islands,'red').owner='blue';early.update(0);
  assert.equal(early.pilot.state.status,'failed');assert.match(early.pilot.state.message,/antes de completar/);
});

test('a verified conquest completes even when the result dialog has stopped the clock',()=>{
  const {pilot,islands,state,update}=fixture();pilot.start();
  Object.assign(pilot.state.steps,{sail:true,loot:true,deposit:true,provision:true,defend:true,tower:true});
  getHomeBase(islands,'red').owner='blue';state.gameOver=true;state.locked=true;state.winner='blue';update(0);
  assert.equal(pilot.state.status,'passed');assert.equal(pilot.state.steps.capture,true);
});

test('naval defense is verified by real shots and an actual enemy sinking before a landing',()=>{
  const {pilot,islands,state,player,update,commands}=fixture();pilot.start();pilot.state.phase='guard';
  const home=getHomeBase(islands,'blue');Object.assign(player,{x:home.x+25,z:home.z});
  const enemy={name:'Real raider',team:'red',x:home.x+38,z:home.z,dead:0,hp:160};state.ships.push(enemy);
  update(.1);assert.equal(pilot.state.steps.defend,false);assert.ok(commands.some(c=>c[0]==='fire'&&c[1]===enemy));
  enemy.dead=35;update(.1);assert.equal(pilot.state.steps.defend,true);assert.equal(pilot.state.phase,'recover');
  assert.equal(home.owner,'blue');assert.equal(home.invasion,undefined);
});

test('a nearby enemy killed without player participation does not certify naval defense',()=>{
  const {pilot,islands,state,player,ctx,update}=fixture();pilot.start();pilot.state.phase='guard';
  const home=getHomeBase(islands,'blue');Object.assign(player,{x:home.x+25,z:home.z});
  const enemy={team:'red',x:home.x+38,z:home.z,dead:0,hp:160};state.ships.push(enemy);ctx.fire=()=>false;
  update(.1);enemy.dead=35;update(.1);assert.equal(pilot.state.steps.defend,false);assert.equal(pilot.state.phase,'guard');
});

test('lost navigation produces a bounded failure with position evidence',()=>{
  const {pilot,update}=fixture({navigationTimeout:2});pilot.start();update(1);update(1);update(1);
  assert.equal(pilot.state.status,'failed');assert.match(pilot.state.message,/ruta.*no llegó/);
  assert.equal(pilot.state.failure.evidence.player.x,-99);
});

test('an endless contested capture is reported as a playable-loop failure',()=>{
  const {pilot,state,islands,player,update}=fixture();pilot.start();pilot.state.phase='capture';
  const rival=getHomeBase(islands,'red');Object.assign(player,{x:rival.x+40,z:rival.z});
  rival.tower.dead=1;rival.invasion={source:player,team:'blue',progress:1,duration:35,contested:true};
  update(.1);update(71);
  assert.equal(pilot.state.status,'failed');assert.match(pilot.state.message,/Conquista bloqueada/);
  assert.equal(pilot.state.failure.evidence.bases[1].invasion.contested,true);
  assert.equal(state.bank,200);assert.equal(rival.owner,'red');
});

test('the landing timeout excludes ordinary navigation into the legal landing radius',()=>{
  const {pilot,islands,player,ctx,update}=fixture();pilot.start();pilot.state.phase='capture';
  const rival=getHomeBase(islands,'red');rival.tower.dead=1;
  ctx.startInvasion=island=>{island.invasion={source:player,team:'blue',progress:0,duration:35,contested:false};return true;};
  update(25);assert.equal(pilot.state.status,'running');
  Object.assign(player,{x:rival.x,z:rival.z+40});update(.1);update(3);
  assert.equal(pilot.state.status,'running');assert.equal(rival.invasion.source,player);
});

test('the conquest timeout measures an actual landing, rather than transit from a distant home',()=>{
  const {pilot,islands,player,update}=fixture({captureTimeout:10});pilot.start();pilot.state.phase='capture';
  const rival=getHomeBase(islands,'red');rival.tower.dead=1;
  update(12);assert.equal(pilot.state.status,'running');
  Object.assign(player,{x:rival.x,z:rival.z+40});
  rival.invasion={source:player,team:'blue',progress:0,duration:35,contested:false};
  update(.1);assert.equal(pilot.state.status,'running');
});

test('stopping the pilot recalls real landings and restores ordinary clock speed',()=>{
  const {pilot,islands,player,commands}=fixture();pilot.start();
  const island=islands.find(i=>!i.homeTeam);island.invasion={source:player};pilot.stop();
  assert.equal(pilot.state.status,'stopped');assert.ok(commands.some(c=>c[0]==='cancel'&&c[1]===island.id));
  assert.deepEqual(commands.at(-1),['speed',1]);
});
