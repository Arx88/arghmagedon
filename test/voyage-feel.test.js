import test from 'node:test';
import assert from 'node:assert/strict';
import {createVoyageState,stepVoyage,drinkRum,weaponProfiles,boostTuning} from '../src/voyage-feel.js';
import {navigate} from '../src/navigation.js';
test('a held boost expires, cannot flicker on automatically and recovers after release',()=>{const v=createVoyageState();for(let i=0;i<300;i++)stepVoyage(v,{boost:true,canSail:true},1/60);assert.equal(v.boosting,false);assert.equal(v.exhausted,true);for(let i=0;i<600;i++)stepVoyage(v,{boost:true,canSail:true},1/60);assert.equal(v.stamina,100);assert.equal(v.boosting,false);stepVoyage(v,{boost:false,canSail:true},1/60);assert.equal(stepVoyage(v,{boost:true,canSail:true},1/60).speed,boostTuning.speed);});
test('boost endurance is consistent at 30 and 144 FPS',()=>{const run=fps=>{const v=createVoyageState();for(let i=0;i<fps*3;i++)stepVoyage(v,{boost:true,canSail:true},1/fps);return v.stamina;};assert(Math.abs(run(30)-run(144))<.001);});
test('boost feedback eases out after release while the cruise limit is restored immediately',()=>{const v=createVoyageState();stepVoyage(v,{boost:true,canSail:true},.5);const intensity=v.boostIntensity;const normal=stepVoyage(v,{boost:false,canSail:true},1/60);assert.equal(normal.speed,1);assert.equal(v.boosting,false);assert(v.boostIntensity>0&&v.boostIntensity<intensity);stepVoyage(v,{boost:false,canSail:true},1);assert(v.boostIntensity<.01);});
test('empty stamina cannot be retriggered by tapping before it has recovered',()=>{const v=createVoyageState();stepVoyage(v,{boost:true,canSail:true},4);for(let i=0;i<90;i++)stepVoyage(v,{boost:false,canSail:true},1/60);assert(v.stamina<boostTuning.rearm);const result=stepVoyage(v,{boost:true,canSail:true},1/60);assert.equal(v.boosting,false);assert.equal(result.speed,1);});

const sailingBoat=()=>({x:0,z:0,heading:0,yawRate:0,speed:9,vx:0,vz:-9,maxSpeed:9});
function sail(boat,voyage,{boost,throttle=1},duration,hz=60){
  for(let frame=0;frame<Math.round(duration*hz);frame++){
    const modifiers=stepVoyage(voyage,{boost,canSail:true},1/hz);
    boat.maxSpeed=9*modifiers.speed;
    navigate(boat,{throttle:voyage.boosting?1:throttle,turn:0,acceleration:modifiers.acceleration},1/hz);
  }
}
test('a burst is clearly faster within one second and Shift release decelerates with W held',()=>{
  const boat=sailingBoat(),voyage=createVoyageState();sail(boat,voyage,{boost:true},1);
  const boosted=Math.hypot(boat.vx,boat.vz);assert(boosted>9*1.45);
  sail(boat,voyage,{boost:false},1);assert.equal(voyage.boosting,false);
  assert(Math.hypot(boat.vx,boat.vz)<9*1.06);assert(boat.speed<9*1.02);
});
test('Shift release also removes extra speed when coasting without W',()=>{
  const boat=sailingBoat(),voyage=createVoyageState();sail(boat,voyage,{boost:true},2);
  const before=boat.speed;sail(boat,voyage,{boost:false,throttle:0},1);
  assert(boat.speed<before*.62);assert(boat.speed>7);
  assert(Math.hypot(boat.vx,boat.vz)<9*1.05);
});
test('boost and release have consistent physical speed across 30, 60 and 144 Hz',()=>{
  const run=hz=>{const boat=sailingBoat(),voyage=createVoyageState();sail(boat,voyage,{boost:true},2,hz);sail(boat,voyage,{boost:false},1,hz);return {boat,voyage};};
  const slow=run(30),normal=run(60),fast=run(144);
  for(const result of [slow,normal]){assert(Math.abs(result.boat.speed-fast.boat.speed)<.001);assert(Math.abs(result.boat.vz-fast.boat.vz)<.03);assert(Math.abs(result.boat.z-fast.boat.z)<.2);assert(Math.abs(result.voyage.stamina-fast.voyage.stamina)<.001);}
});
test('rum consumes a ration, has a cooldown, and never stacks repeated drinks',()=>{const v=createVoyageState();assert(drinkRum(v));assert.equal(v.rumCharges,2);assert(!drinkRum(v));stepVoyage(v,{boost:false,canSail:true},23);assert.equal(v.rumTime,0);assert(drinkRum(v));assert.equal(v.rumCharges,1);});
test('weapon choices have materially different range, flight arc, speed and cadence',()=>{assert.equal(weaponProfiles.length,4);assert(weaponProfiles[1].range<weaponProfiles[0].range);assert(weaponProfiles[3].arc>weaponProfiles[0].arc*3);assert(weaponProfiles[3].reload>weaponProfiles[0].reload);assert(weaponProfiles[3].splash>0);});
