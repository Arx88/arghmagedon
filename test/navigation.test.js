import test from 'node:test';
import assert from 'node:assert/strict';
import { navigate, autopilot, hullIntersection, purchaseUpgrade, upgradeCost } from '../src/navigation.js';

const boat = () => ({ x: 0, z: 0, heading: 0, yawRate: 0, speed: 0, vx: 0, vz: 0, maxSpeed: 9 });
test('helm and acceleration remain consistent across frame rates', () => {
  const simulate = hz => { const b = boat(); for (let i = 0; i < hz * 6; i++) navigate(b, { throttle: 1, turn: .4 }, 1 / hz); return b; };
  const slow = simulate(30), fast = simulate(144);
  assert.ok(Math.hypot(slow.x - fast.x, slow.z - fast.z) < .7);
  assert.ok(Math.abs(slow.heading - fast.heading) < .025);
  assert.ok(Math.abs(slow.speed - fast.speed) < .001);
});
test('letting go eases the rudder while retaining forward momentum', () => {
  const b = boat(); for (let i = 0; i < 180; i++) navigate(b, { throttle: 1, turn: 1 }, 1 / 60);
  const before = b.speed; for (let i = 0; i < 60; i++) navigate(b, { throttle: 0, turn: 0 }, 1 / 60);
  assert.ok(b.speed > before * .8 && b.speed < before); assert.ok(Math.abs(b.yawRate) < .01);
});
test('braking stops a ship promptly without an instantaneous velocity jump', () => {
  const b = { ...boat(), speed: 8, vz: -8 }; navigate(b, { throttle: -1, turn: 0 }, 1 / 60);
  assert.ok(b.speed > 7); for (let i = 0; i < 120; i++) navigate(b, { throttle: -1, turn: 0 }, 1 / 60);
  assert.ok(b.speed < 0);
});
test('a reduced speed cap smoothly removes excess momentum instead of retaining boost speed',()=>{
  const b={...boat(),speed:15,vz:-15};navigate(b,{throttle:0,turn:0},1/60);
  assert(b.speed<15&&b.speed>14);assert(Math.abs(b.vz)>14);
  for(let frame=0;frame<60;frame++)navigate(b,{throttle:0,turn:0},1/60);
  assert(b.speed<9);assert(Math.hypot(b.vx,b.vz)<9.5);
});
test('autopilot steers around land without moving the destination', () => {
  const b = { ...boat(), speed: 5, z: 20 }, destination = { x: 3, z: -30 }, original = { ...destination };
  const input = autopilot(b, destination, [{ x: 0, z: 0, r: 10 }]);
  assert.deepEqual(destination, original); assert.ok(Number.isFinite(input.turn)); assert.ok(Math.abs(input.turn) <= 1);
});
test('swept hull collision catches a projectile crossing the entire boat', () => {
  const s = { x: 0, z: 0, heading: 0, scale: 1 };
  assert.notEqual(hullIntersection({ x: -12, y: 2, z: 0 }, { x: 12, y: 2, z: 0 }, s), null);
  assert.equal(hullIntersection({ x: -12, y: 2, z: 9 }, { x: 12, y: 2, z: 9 }, s), null);
  assert.equal(hullIntersection({ x: -12, y: 8, z: 0 }, { x: 12, y: 8, z: 0 }, s), null);
  assert.equal(hullIntersection({ x: -12, y: 2, z: 0 }, { x: 12, y: 2, z: 0 }, { ...s, z: 20 }), null);
});
test('rotating the hull rotates the collision volume', () => {
  const p = { x: 4, y: 2, z: 0 };
  assert.equal(hullIntersection(p, p, { x: 0, z: 0, heading: 0, scale: 1 }), null);
  assert.equal(hullIntersection(p, p, { x: 0, z: 0, heading: Math.PI / 2, scale: 1 }), 0);
});
test('upgrades require banked money, a living ship and the port; three levels maximum', () => {
  const s = { upgrades: { hull: 0, cannons: 0, crew: 0 }, level: 1, maxHp: 100, hp: 50, maxCrew: 12, crew: 10, damage: 28, reload: 2.15, dead: 0 };
  assert.equal(purchaseUpgrade(s, 'hull', 500, false).ok, false);
  assert.equal(purchaseUpgrade(s, 'hull', 119, true).ok, false);
  let bank = 1000;
  for (let i = 0; i < 3; i++) { const cost = upgradeCost('hull', i), result = purchaseUpgrade(s, 'hull', bank, true); assert.equal(result.bank, bank - cost); bank = result.bank; }
  assert.equal(s.maxHp, 205); assert.equal(s.hp, 205); assert.equal(purchaseUpgrade(s, 'hull', bank, true).ok, false);
  assert.equal(purchaseUpgrade(s, 'unknown', bank, true).ok, false);
  s.dead = 1; assert.equal(purchaseUpgrade(s, 'crew', bank, true).ok, false);
});
test('crew upgrades create capacity without free pirates and cannons improve at a controlled rate',()=>{
  const ship={upgrades:{hull:0,cannons:0,crew:0},level:1,maxHp:160,hp:120,maxCrew:12,crew:8,damage:24,reload:2.8,dead:0};
  assert.equal(purchaseUpgrade(ship,'crew',100,true).ok,true);assert.equal(ship.maxCrew,16);assert.equal(ship.crew,8);
  const before=ship.damage/ship.reload;
  let bank=1000,previous=before;
  for(let level=0;level<3;level++){
    const result=purchaseUpgrade(ship,'cannons',bank,true);assert.equal(result.ok,true);bank=result.bank;
    const current=ship.damage/ship.reload,factor=current/previous;
    assert(factor>=1.2&&factor<=1.25,`level ${level+1} raises DPS by ${(factor-1)*100}%`);previous=current;
  }
  assert.equal(ship.damage,36);
  assert.equal(upgradeCost('unknown',0),Infinity);
});
