import test from 'node:test';
import assert from 'node:assert/strict';
import { planRoute } from '../src/route-planner.js';
import { autopilot,navigate,hullIntersection } from '../src/navigation.js';

test('a voyage passes the coast and actually reaches the arrival threshold',()=>{
  const islands=[{x:0,z:0,r:15}],goal={x:0,z:-40};
  const ship={x:0,z:35,heading:0,speed:0,vx:0,vz:0,yawRate:0,maxSpeed:9};
  let arrived=false;
  for(let n=0;n<60*50;n++){const controls=autopilot(ship,goal,islands);if(controls.arrived){arrived=true;break;}navigate(ship,controls,1/60);assert.ok(Math.hypot(ship.x,ship.z/.72)>15);}
  assert.ok(arrived);assert.ok(Math.hypot(ship.x-goal.x,ship.z-goal.z)<5);
});
test('routes leave a berth inside the navigation clearance and keep their destination immutable',()=>{
  const end={x:40,z:-25},saved={...end};const route=planRoute({x:0,z:14},end,[{x:0,z:0,r:15}]);
  assert.ok(route.length>0);assert.deepEqual(end,saved);assert.ok(route.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.z)));
});
test('a cannonball hits a hull riding a storm swell at its actual elevation',()=>{
  const ship={x:0,z:0,heading:0,scale:1,object:{position:{y:5}}};
  assert.notEqual(hullIntersection({x:-10,y:7,z:0},{x:10,y:7,z:0},ship),null);
  assert.equal(hullIntersection({x:-10,y:1,z:0},{x:10,y:1,z:0},ship),null);
});
