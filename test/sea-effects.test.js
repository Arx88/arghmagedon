import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {SeaEffects} from '../src/sea-effects.js';

test('a newly fired muzzle survives a long frame instead of ageing before it existed',()=>{
  const effects=new SeaEffects(new THREE.Scene(),32);
  effects.advanceClock(.24);
  effects.muzzle(new THREE.Vector3(0,2,0),new THREE.Vector3(1,0,0),0);
  effects.advanceClock(.01);effects.update(.25);
  assert.ok(effects.jetStates[0].life>.18);
  // The flash keeps its own peak rather than a fixed brightness: each weapon
  // fires a different one, and a muzzle that just went off is still at full
  // strength no matter how long the frame that drew it turned out to be.
  const lit = effects.flashes.filter(f => f.life > 0);
  assert.ok(lit.length > 0, 'the muzzle must light one of the pooled flashes');
  assert.ok(lit.every(f => f.light.intensity >= f.peak * .9));
  assert.ok(effects.particles.some(p=>p.type==='fire'&&p.life>.1));
  // Long enough to outlast the longest flame in the roster, not just this gun's.
  effects.advanceClock(.31);effects.update(.31);
  assert.equal(effects.jetStates[0].life,0);
});

test('effects emitted at different simulation times retain their own age',()=>{
  const effects=new SeaEffects(new THREE.Scene(),8);
  effects.emit('mist',new THREE.Vector3(0,1,0),new THREE.Vector3(1,0,0),1,1);
  effects.advanceClock(.2);
  effects.emit('mist',new THREE.Vector3(0,1,0),new THREE.Vector3(1,0,0),1,1);
  effects.advanceClock(.05);effects.update(.25);
  assert.ok(Math.abs(effects.particles[0].life-.75)<1e-8);
  assert.ok(Math.abs(effects.particles[1].life-.95)<1e-8);
  assert.ok(effects.particles[0].x>effects.particles[1].x);
});

test('firing a gun throws a directed flame and powder smoke that blows back over the crew',()=>{
  const effects=new SeaEffects(new THREE.Scene(),256);
  const bore=new THREE.Vector3(1,0,0);
  effects.muzzle(new THREE.Vector3(0,2,0),bore,0);
  const jet=effects.jetStates.find(j=>j.life>0);
  assert.ok(jet,'a muzzle must throw a flame');
  assert.ok(jet.direction.dot(bore)>.99,'the flame must travel down the bore');
  effects.advanceClock(.01);effects.update(.1);
  assert.ok(effects.jetStates.some(j=>j.life>0),'the flame outlives the first frame');
  const smoke=effects.particles.filter(p=>p.type==='smoke'&&p.life>0);
  assert.ok(smoke.some(p=>p.vx<0),'powder smoke must trail backwards, not out of the barrel');
  assert.ok(effects.particles.some(p=>p.type==='ember'&&p.life>0),'sparks carry the shot past the flame');
});

test('the flame dies with its gun rather than hanging in the air',()=>{
  const effects=new SeaEffects(new THREE.Scene(),64);
  effects.muzzle(new THREE.Vector3(0,2,0),new THREE.Vector3(0,0,1),2);
  effects.advanceClock(.35);effects.update(.35);
  assert.equal(effects.jetStates[0].life,0);
});

test('a muzzle flash stays gun-sized, never bigger than the ship that fired it',()=>{
  // Ships are roughly 10 world units long. A flame tongue longer than that turns a
  // broadside into a solid wall, which is what it did once already.
  const effects=new SeaEffects(new THREE.Scene(),64);
  const dummy=new THREE.Object3D();
  for (const kind of [0,1,2,3]) {
    effects.muzzle(new THREE.Vector3(0,2,0),new THREE.Vector3(0,0,1),kind);
    let longest=0;
    for (let step=0;step<6;step++){
      effects.advanceClock(.05);effects.update(.05);
      const m=new THREE.Matrix4();effects.jets.getMatrixAt(0,m);
      dummy.matrix.copy(m);dummy.matrix.decompose(dummy.position,dummy.quaternion,dummy.scale);
      longest=Math.max(longest,dummy.scale.y);
    }
    assert.ok(longest<5,`the flame for weapon ${kind} reached ${longest.toFixed(1)} units long`);
  }
});

test('a full broadside stays well inside the particle pool',()=>{
  const effects=new SeaEffects(new THREE.Scene(),1800);
  for (let gun=0;gun<16;gun++) effects.muzzle(new THREE.Vector3(gun%8-4,1.4,(gun/8|0)-1),new THREE.Vector3(0,0,1),0);
  const puffs=effects.particles.filter(p=>p.life>0).length;
  assert.ok(puffs<16*20,`a broadside threw ${puffs} particles`);
  assert.ok(puffs<effects.capacity*.25,`a broadside used a quarter of the pool`);
});

test('the four guns do not share one muzzle',()=>{
  // A broadside of identical muzzles is what makes every weapon read as the same
  // weapon, so each one is pinned on the parts the eye actually separates them by.
  const sig=kind=>{
    const fx=new SeaEffects(new THREE.Scene(),256);
    fx.muzzle(new THREE.Vector3(0,2,0),new THREE.Vector3(0,0,1),kind);
    const jet=fx.jetStates[0];
    const live=fx.particles.filter(p=>p.life>0);
    const counts={};
    for(const p of live) counts[p.type]=(counts[p.type]??0)+1;
    const puff=['smoke','soot','ash'].reduce((a,t)=>(counts[t]??0)>(counts[a]??0)?t:a,'none');
    return {
      flame:jet.length, width:jet.width, life:jet.life,
      flameTint:jet.tint.getHex(),
      flash:fx.flashes.find(f=>f.life>0).peak,
      puff, load:live.length,
    };
  };
  const all=[0,1,2,3].map(sig);
  for(const key of ['flame','width','life','flameTint','flash','load']){
    const seen=new Set(all.map(s=>s[key]));
    assert.equal(seen.size,4,`every weapon shares the same ${key}: ${[...seen].join(', ')}`);
  }
  // And the order is the one the roster implies, smallest gun to largest.
  assert.ok(all[0].flame<all[2].flame&&all[2].flame<all[3].flame,'flame grows with calibre');
  assert.ok(all[0].load>all[1].load,'chain shot is the gun that barely throws anything');
});

test('the flame meshes carry a tint before anything has been fired',()=>{
  // three keys the compiled program on whether `instanceColor` exists, and the jet
  // vertex shader reads it unconditionally. Allocating it lazily on the first muzzle
  // meant the game's very first frames compiled a flame shader with no such
  // attribute, which fails, so the flames never drew in play at all — while the FX
  // harness, which fires before its first render, kept looking perfectly fine.
  const effects=new SeaEffects(new THREE.Scene(),64);
  assert.ok(effects.jets.instanceColor,'the flame mesh must have a tint buffer from the start');
  assert.ok(effects.jetCores.instanceColor,'so must the hot core');
});

test('a gun lights a bloom at its own muzzle, clear of the hull',()=>{
  // The cone is seen edge-on from the chase camera and hides behind the sails, so
  // the bloom at the gunport is what actually announces the shot. It has to be
  // pushed down the bore and lifted, or it sits in the one gap the camera cannot see.
  const effects=new SeaEffects(new THREE.Scene(),256);
  const origin=new THREE.Vector3(0,2,0),bore=new THREE.Vector3(1,0,0);
  effects.muzzle(origin,bore,0);
  const flare=effects.flareStates.find(f=>f.life>0);
  assert.ok(flare,'a muzzle must light a bloom');
  assert.ok(flare.position.x>origin.x,'the bloom must stand clear of the gunport along the bore');
  assert.ok(flare.position.y>origin.y,'and must be lifted above the rail');
  // Sized against the ship: a bloom wider than the hull is a disc, not a flash.
  for (const kind of [0,1,2,3]) {
    const fx=new SeaEffects(new THREE.Scene(),64);
    fx.muzzle(new THREE.Vector3(0,2,0),new THREE.Vector3(0,0,1),kind);
    assert.ok(fx.flareStates[0].size<5,`weapon ${kind} lit a ${fx.flareStates[0].size}-unit disc`);
  }
});

test('a broadside sends smoke up past the rigging, where the camera can see it',()=>{
  const effects=new SeaEffects(new THREE.Scene(),256);
  effects.muzzle(new THREE.Vector3(0,2,0),new THREE.Vector3(1,0,0),0);
  effects.advanceClock(1);effects.update(1);
  const risen=effects.particles.filter(p=>p.life>0&&p.y>4);
  assert.ok(risen.length>0,'smoke has to climb above the sail line to be visible at all');
});

test('a hit flashes light and a splash does not',()=>{
  const effects=new SeaEffects(new THREE.Scene(),256);
  effects.impact(new THREE.Vector3(0,2,0),false);
  assert.equal(effects.flashes.every(f=>f.life<=0),true,'a water splash throws no light');
  effects.impact(new THREE.Vector3(0,2,0),true);
  assert.ok(effects.flashes.some(f=>f.light.intensity>0),'a hull hit must light the scene');
  assert.ok(effects.particles.some(p=>p.type==='ember'&&p.life>0),'a hit throws sparks');
});

test('embers arc down like projectiles instead of hanging like smoke',()=>{
  const effects=new SeaEffects(new THREE.Scene(),32);
  effects.emit('ember',new THREE.Vector3(0,4,0),new THREE.Vector3(6,2,0),.1,1);
  effects.advanceClock(.5);effects.update(.5);
  const ember=effects.particles.find(p=>p.type==='ember');
  assert.ok(ember.vy<2,'embers must fall');
  assert.ok(Math.abs(ember.vx)>1,'embers keep their forward speed longer than smoke');
});
