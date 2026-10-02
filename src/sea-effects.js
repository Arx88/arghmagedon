import * as THREE from 'three';
import { seaVertexFunction } from './sea-state.js';

const colors = { foam: new THREE.Color(0xe8fff0), mist: new THREE.Color(0xa4dcd0), fire: new THREE.Color(0xffcf6a), smoke: new THREE.Color(0xc2c8b6), soot: new THREE.Color(0x52615c), ash: new THREE.Color(0x6d8179), wood: new THREE.Color(0xbc8449), ember: new THREE.Color(0xffd98a) };
/** Particles drawn as soft puffs; everything else keeps its hard silhouette. */
const SOFT_TYPES = new Set(['smoke', 'soot', 'ash', 'mist', 'fire']);
/**
 * One signature per gun, because a broadside of identical muzzles is exactly what
 * makes every weapon feel like the same weapon. Iron leads with powder smoke and a
 * short dull flash; chain is tight, clean and barely smokes; the firepot is almost
 * entirely flame; the explosive is the loudest of the four and the only one whose
 * smoke is soot rather than powder. Counts are held under 20 per gun because a
 * full broadside is 16 of them firing in the same frame.
 */
const MUZZLE = [
  { fire: 3, smoke: 6, back: 3, ember: 2, jet: [1.9, .62], jetTint: 0xffac35, life: .3, flare: 1.6, flash: 44, flashTint: 0xffbc72, smokeType: 'smoke' },
  { fire: 2, smoke: 2, back: 1, ember: 4, jet: [1.2, .4], jetTint: 0xc9e8e1, life: .22, flare: 1.05, flash: 26, flashTint: 0xa8e8dc, smokeType: 'ash' },
  { fire: 8, smoke: 3, back: 2, ember: 3, jet: [2.4, .85], jetTint: 0xff6b1b, life: .34, flare: 2.1, flash: 56, flashTint: 0xff9440, smokeType: 'smoke' },
  { fire: 7, smoke: 3, back: 4, ember: 5, jet: [2.9, 1.1], jetTint: 0xfff0a0, life: .42, flare: 2.7, flash: 78, flashTint: 0xffd070, smokeType: 'soot' },
];
/** Fixed-size particle pool: all foam, smoke, splinters and flashes in one draw call. */
export class SeaEffects {
  constructor(scene, capacity = 1800) {
    this.capacity = capacity; this.cursor = 0; this.alive = 0;this.clock=0;this.renderClock=0;
    this.particles = Array.from({ length: capacity }, () => ({ life: 0, total: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 0, type: 'foam', angle: 0 }));
    this.alpha = new Float32Array(capacity);
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    geometry.setAttribute('particleAlpha', new THREE.InstancedBufferAttribute(this.alpha, 1));
    // One box geometry serves every particle, and a box drawn at full alpha is a
    // slab: the powder smoke read as a stack of grey blocks. Soft particles fall
    // off with distance from the eye ray, which turns the box into a round puff
    // from any angle without a second mesh. Fading the faces that turn away from
    // the camera is not enough — head on, the front face is a full-strength
    // square, which is the same blocky silhouette by another route.
    this.softness = new Float32Array(capacity);
    geometry.setAttribute('particleSoft', new THREE.InstancedBufferAttribute(this.softness, 1));
    const material = new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
      vertexShader: `attribute float particleAlpha;attribute float particleSoft;varying vec3 tint;varying float alpha;varying float soft;varying vec3 localView;varying vec3 viewDir;varying float unit;
      void main(){
        tint=instanceColor;alpha=particleAlpha;soft=particleSoft;
        mat4 im=modelViewMatrix*instanceMatrix;
        vec4 mv=im*vec4(position,1.);
        // The falloff below is written in half-extent units, where the box runs
        // from 0 at its centre to 1 at the middle of a face. The instance matrix
        // carries the particle's size, so the measured distance has to be divided
        // back out, or a 0.3-unit puff never leaves the opaque middle of the ramp.
        unit=1./max(length(vec3(im[0].x,im[0].y,im[0].z)),1e-4);
        localView=mat3(im)*position;
        viewDir=normalize(-mv.xyz);
        gl_Position=projectionMatrix*mv;
      }`,
      fragmentShader: `varying vec3 tint;varying float alpha;varying float soft;varying vec3 localView;varying vec3 viewDir;varying float unit;void main(){
      float d=length(localView-viewDir*dot(localView,viewDir))*unit;
      float a2=alpha*mix(1.,1.-smoothstep(.45,.92,d),soft);
      if(a2<.015)discard;gl_FragColor=vec4(tint,a2);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
    });
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 3;
    this.dummy = new THREE.Object3D();
    this.dummy.scale.setScalar(0); this.dummy.updateMatrix();
    for (let i = 0; i < capacity; i++) { this.mesh.setMatrixAt(i, this.dummy.matrix); this.mesh.setColorAt(i, colors.foam); }
    scene.add(this.mesh);
    this.ripples=Array.from({length:16},()=>{const material=new THREE.MeshBasicMaterial({color:0xc8f1e4,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide});const ring=new THREE.Mesh(new THREE.RingGeometry(.86,1,40),material);ring.rotation.x=-Math.PI/2;ring.visible=false;scene.add(ring);return {ring,life:0};});
    this.flashes=Array.from({length:2},()=>{const light=new THREE.PointLight(0xffbc72,0,14,2);scene.add(light);return {light,life:0,total:.17,peak:32};});
    // Two bounded draw calls give each muzzle a directed flame and a hot core.
    // Both are additive and feathered along their own length: a solid cone paints a
    // hard orange triangle, and a hard triangle stuck out of a gunport reads as a
    // paper dart rather than as gas leaving the barrel. Flames also taper *away*
    // from the muzzle, so the cone is flipped to point back down the bore.
    const jetGeometry=new THREE.ConeGeometry(1,1,10);
    // `instanceColor` is only declared in the vertex prefix, so it has to be
    // handed to the fragment stage as a varying. Reading it from the fragment
    // shader instead is a compile error, and the material then draws nothing at
    // all — which is exactly how the flame and the blast ring disappeared.
    const jetVertex='varying vec3 local;varying vec3 tint;varying float facing;void main(){local=position;tint=instanceColor;mat4 im=modelViewMatrix*instanceMatrix;vec4 mv=im*vec4(position,1.);facing=abs(dot(normalize(mat3(im)*normal),normalize(-mv.xyz)));gl_Position=projectionMatrix*mv;}';
    const jetMaterial=(power)=>new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,
      vertexShader:jetVertex,
      // `s` is 0 at the cone's open outer end and 1 at its apex, which sits in the
      // gunport. Bright along the whole length out of the muzzle, easing to nothing
      // at the open end and again right at the apex so neither end draws an edge.
      // `facing` is the other half: a cone is brightest where its wall points at the
      // eye and vanishes at the silhouette, so without it the tongue draws its own
      // outline and reads as a flat wedge cut from paper rather than as gas.
      fragmentShader:`varying vec3 local;varying vec3 tint;varying float facing;void main(){float s=clamp(local.y+.5,0.,1.);float a=pow(s,${power})*smoothstep(0.,.62,facing)*(1.-smoothstep(.9,1.,s));if(a<.01)discard;gl_FragColor=vec4(tint,a);}`,
    });
    this.jets=new THREE.InstancedMesh(jetGeometry,jetMaterial(1.6),16);
    this.jetCores=new THREE.InstancedMesh(jetGeometry,jetMaterial(2.4),16);
    this.jets.frustumCulled=this.jetCores.frustumCulled=false;this.jets.renderOrder=this.jetCores.renderOrder=4;
    this.jetStates=Array.from({length:16},()=>({life:0,total:1,position:new THREE.Vector3(),direction:new THREE.Vector3(),rotation:new THREE.Quaternion(),length:0,width:0,tint:new THREE.Color()}));
    this.jetBack=new THREE.Vector3();
    this.jetCursor=0;const hidden=new THREE.Matrix4().makeScale(0,0,0);
    // The colour has to be written here, not lazily on the first shot. `instanceColor`
    // only exists once setColorAt has run, and three keys the compiled program on
    // whether it is present — so a jet mesh that renders a frame before its first
    // muzzle compiles against a shader with no `instanceColor` attribute, fails, and
    // the flame never appears in the game at all. It still looks right in the FX
    // harness, which fires before its first draw, which is exactly why it survived.
    for(let n=0;n<16;n++){this.jets.setMatrixAt(n,hidden);this.jetCores.setMatrixAt(n,hidden);this.jets.setColorAt(n,colors.fire);this.jetCores.setColorAt(n,colors.fire);}
    scene.add(this.jets,this.jetCores);
    this.jetTint=new THREE.Color();
    // The bloom at the gunport. The cone above is the *shape* of a shot, but the
    // chase camera sits astern while the guns fire abeam, so the cone is seen
    // edge-on and half of it hides behind the hull and the square sails — from the
    // player's actual viewpoint it contributes almost nothing. This is the part
    // that does read, so it is sized against the ship rather than against the gun
    // and pushed clear of the hull edge.
    //
    // The quad is laid out in view space in the vertex shader instead of being
    // rotated toward the eye in JS, which keeps `update` free of a camera argument
    // and cannot be forgotten by a caller. Like the jets, the fade rides
    // `instanceColor`, because additive blending has no per-instance alpha.
    const flashVertex='varying vec2 quad;varying vec3 tint;void main(){quad=position.xy;tint=instanceColor;mat4 im=modelViewMatrix*instanceMatrix;float s=length(im[0].xyz);vec4 mv=im*vec4(0.,0.,0.,1.);mv.xy+=position.xy*s;gl_Position=projectionMatrix*mv;}';
    this.flares=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,
      vertexShader:flashVertex,
      // A hot centre inside a softer halo. A single falloff cannot do both: a
      // tight one is a dot that vanishes at range, a wide one is a flat blob that
      // reads as a decal rather than as heat.
      fragmentShader:'varying vec2 quad;varying vec3 tint;void main(){float r=length(quad)*2.;if(r>1.)discard;float core=pow(1.-r,3.4);float halo=pow(1.-r,1.15)*.55;gl_FragColor=vec4(tint*(1.+core*1.7),core+halo);}',
    }),16);
    this.flares.frustumCulled=false;this.flares.renderOrder=5;
    this.flareStates=Array.from({length:16},()=>({life:0,total:1,position:new THREE.Vector3(),size:1,tint:new THREE.Color()}));
    this.flareCursor=0;
    for(let n=0;n<16;n++){this.flares.setMatrixAt(n,hidden);this.flares.setColorAt(n,colors.fire);}
    scene.add(this.flares);
  }
  emit(type, position, velocity, size, life) {
    const i = this.cursor++ % this.capacity, p = this.particles[i];
    Object.assign(p, { type, x: position.x, y: position.y, z: position.z, vx: velocity.x, vy: velocity.y, vz: velocity.z, size, life, total: life, updatedAt:this.clock, angle: Math.random() * Math.PI });
    this.mesh.setColorAt(i, colors[type] ?? colors.foam);
    this.softness[i] = SOFT_TYPES.has(type) ? 1 : 0;
  }
  muzzle(position, direction, kind=0) {
    const spec=MUZZLE[kind]??MUZZLE[0];
    const jet=this.jetStates[this.jetCursor++%this.jetStates.length];
    jet.position.copy(position);jet.direction.copy(direction).normalize();
    // The cone's apex is its +Y end, and a flame is widest where it leaves the
    // bore, so the cone is aimed back along the barrel: apex inboard, wide end out.
    jet.rotation.setFromUnitVectors(new THREE.Vector3(0,1,0),this.jetBack.copy(jet.direction).negate());
    jet.length=spec.jet[0];jet.width=spec.jet[1];jet.life=jet.total=spec.life;jet.updatedAt=this.clock;jet.tint.set(spec.jetTint);
    this.jets.setColorAt((this.jetCursor-1)%16,this.jetTint.set(spec.jetTint));
    // The bloom is pushed a little way down the bore and lifted clear of the rail.
    // Sitting it exactly on the gunport buries it between the hull and the sails,
    // which is precisely the gap the chase camera cannot see into.
    const flare=this.flareStates[this.flareCursor++%this.flareStates.length];
    flare.position.copy(position).addScaledVector(jet.direction,spec.flare*.3);flare.position.y+=spec.flare*.18;
    flare.size=spec.flare;flare.life=flare.total=spec.life*1.15;flare.updatedAt=this.clock;flare.tint.set(spec.jetTint);
    const flash=this.flashes.find(f=>f.life<=0)??this.flashes[0];flash.light.position.copy(position);flash.light.color.set(spec.flashTint);
    flash.life=flash.total=.17;flash.peak=spec.flash;flash.updatedAt=this.clock;flash.light.intensity=spec.flash;
    const puff=spec.smokeType;
    for (let i = 0; i < spec.fire; i++) this.emit('fire', position, { x: direction.x * (4 + Math.random() * 4), y: (Math.random() - .3) * 2, z: direction.z * (4 + Math.random() * 4) }, .22 + Math.random() * .22, .12 + Math.random() * .12);
    // Powder smoke is a footnote to the flash, not the subject. At half a unit
    // across and a metre long it was wide enough to stand in for the muzzle
    // itself: a broadside turned into a row of grey pillows and the gun that was
    // supposed to be firing disappeared behind its own smoke.
    for (let i = 0; i < spec.smoke; i++) this.emit(puff, position, { x: direction.x * (1 + Math.random() * 3), y: .4 + Math.random(), z: direction.z * (1 + Math.random() * 3) }, .12 + Math.random() * .14, .5 + Math.random() * .4);
    // Powder smoke blows back over the gun crew rather than out of the barrel, so
    // it trails the opposite way and lingers long after the flash is gone.
    for (let i = 0; i < spec.back; i++) this.emit(puff, position, { x: -direction.x * (1.5 + Math.random() * 2) + (Math.random() - .5) * 2, y: .2 + Math.random() * .8, z: -direction.z * (1.5 + Math.random() * 2) + (Math.random() - .5) * 2 }, .16 + Math.random() * .16, .9 + Math.random() * .6);
    for (let i = 0; i < spec.ember; i++) this.emit('ember', position, { x: direction.x * (6 + Math.random() * 7) + (Math.random() - .5) * 4, y: 1 + Math.random() * 3, z: direction.z * (6 + Math.random() * 7) + (Math.random() - .5) * 4 }, .06 + Math.random() * .05, .3 + Math.random() * .35);
    // Two puffs per gun climb hard enough to clear the rigging. Everything else a
    // muzzle throws stays down at deck level, where from astern it is behind the
    // hull; smoke that rises above the sail line is the one cue that stays visible
    // for the whole second after the shot and tells you which side went off.
    for (let i = 0; i < 2; i++) this.emit(puff, position, { x: (Math.random() - .5) * .8, y: 2.6 + Math.random() * 1.6, z: (Math.random() - .5) * .8 }, .16 + Math.random() * .1, 1.1 + Math.random() * .5);
  }
  impact(position, hit = false) {
    const ripple=this.ripples.find(r=>r.life<=0)??this.ripples[0];ripple.ring.position.set(position.x,Math.max(.08,position.y-.2),position.z);ripple.ring.material.color.set(hit?0xffd18c:0xdafff5);ripple.ring.visible=true;ripple.life=1.2;ripple.updatedAt=this.clock;
    for (let i = 0; i < (hit ? 23 : 18); i++) {
      const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * 4;
      this.emit(hit && i % 3 ? 'wood' : hit ? 'fire' : 'foam', position, { x: Math.cos(a) * r, y: 2 + Math.random() * 6, z: Math.sin(a) * r }, .1 + Math.random() * .22, .5 + Math.random() * .6);
    }
    if (hit) {
      // A hit throws light as well as splinters: without it the impact reads as a
      // particle pop, especially against a dark hull at dusk. It borrows the muzzle
      // flash pool rather than owning its own lights: each extra PointLight is paid
      // for by every lit material in the scene, and four of them measured 1.4 ms a
      // frame — more than all the new shot effects put together.
      const flash=this.flashes.find(f=>f.life<=0)??this.flashes[0];
      flash.light.position.set(position.x,position.y+.6,position.z);flash.light.color.set(0xffa860);
      flash.peak=26;flash.life=flash.total=.26;flash.light.intensity=26;flash.updatedAt=this.clock;
      for (let i = 0; i < 8; i++) this.emit('ember', position, { x: (Math.random() - .5) * 12, y: 1 + Math.random() * 5, z: (Math.random() - .5) * 12 }, .06 + Math.random() * .07, .35 + Math.random() * .4);
      for (let i = 0; i < 6; i++) this.emit('smoke', position, { x: Math.random() - .5, y: .8, z: Math.random() - .5 }, .7, 1.5);
    }
    else for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; this.emit('mist', { x: position.x, y: -.03, z: position.z }, { x: Math.cos(a) * 3, y: 0, z: Math.sin(a) * 3 }, .35, 1.2); }
  }
  advanceClock(dt){this.clock+=Math.max(0,dt);}
  update(dt) {
    // A shot spawned in the last physics substep must not lose the whole frame's age.
    if(this.clock===this.renderClock)this.advanceClock(dt);
    this.renderClock=this.clock;
    const age=effect=>{const elapsed=Math.max(0,this.clock-(effect.updatedAt??this.clock-dt));effect.updatedAt=this.clock;return elapsed;};
    for(let n=0;n<this.jetStates.length;n++){
      const jet=this.jetStates[n];jet.life=Math.max(0,jet.life-age(jet));
      const remaining=jet.life/jet.total,pulse=remaining>0?Math.max(.35,Math.sin(Math.min(1,(1-remaining)*4)*Math.PI*.5))*remaining:0;
      // The width keeps most of its size as the flame dies. Scaling it straight by
      // the pulse pinched the tongue down to a couple of pixels a frame after the
      // shot, so the flash read as a single-frame spark rather than a burst.
      const length=jet.length*(.4+.6*pulse),width=jet.width*(.55+.45*pulse);
      this.dummy.position.copy(jet.position).addScaledVector(jet.direction,length*.5);
      this.dummy.quaternion.copy(jet.rotation);this.dummy.scale.set(width,length*(remaining>0?1:0),width);this.dummy.updateMatrix();this.jets.setMatrixAt(n,this.dummy.matrix);
      this.dummy.position.copy(jet.position).addScaledVector(jet.direction,length*.28);this.dummy.scale.set(width*.46,length*.56*(remaining>0?1:0),width*.46);this.dummy.updateMatrix();this.jetCores.setMatrixAt(n,this.dummy.matrix);
    }
    this.jets.instanceMatrix.needsUpdate=this.jetCores.instanceMatrix.needsUpdate=true;
    if(this.jets.instanceColor)this.jets.instanceColor.needsUpdate=true;
    for(let n=0;n<this.flareStates.length;n++){
      const flare=this.flareStates[n];flare.life=Math.max(0,flare.life-age(flare));
      // Snaps wide on the frame it fires and collapses quickly. Held at full size
      // it stops reading as a burst and starts reading as a lamp bolted to the rail.
      const t=flare.total>0?flare.life/flare.total:0;
      const size=flare.life>0?flare.size*(1.15-.55*t):0;
      this.dummy.position.copy(flare.position);this.dummy.quaternion.identity();this.dummy.scale.setScalar(size);this.dummy.updateMatrix();
      this.flares.setMatrixAt(n,this.dummy.matrix);
      this.flares.setColorAt(n,this.jetTint.copy(flare.tint).multiplyScalar(t*t));
    }
    this.flares.instanceMatrix.needsUpdate=true;
    if(this.flares.instanceColor)this.flares.instanceColor.needsUpdate=true;
    for(const r of this.ripples){if(r.life<=0)continue;r.life-=age(r);const rippleAge=1.2-r.life;r.ring.scale.setScalar(.8+rippleAge*4);r.ring.material.opacity=Math.max(0,r.life*.32);r.ring.visible=r.life>0;}
    // Each flash remembers the peak and span it was fired with, because the muzzle
    // and the impact share the two lights and want different decays.
    for(const f of this.flashes){f.life=Math.max(0,f.life-age(f));f.light.intensity=f.peak*(f.life/f.total);}
    this.alive = 0;
    for (let i = 0; i < this.capacity; i++) {
      const p = this.particles[i];
      if (p.life <= 0) continue;
      const elapsed=age(p);p.life -= elapsed; const t = Math.max(0, p.life / p.total);
      p.x += p.vx * elapsed; p.y += p.vy * elapsed; p.z += p.vz * elapsed;
      if (p.type === 'wood' || p.type === 'ember' || (p.type === 'foam' && p.y > .01)) p.vy -= elapsed * 10;
      if (p.y < -.08) { p.y = -.08; p.vy = 0; }
      const smoke=p.type==='smoke'||p.type==='soot'||p.type==='ash';
      const drag = Math.exp(-elapsed * (smoke ? 1.3 : p.type==='ember' ? .25 : .6)); p.vx *= drag; p.vz *= drag;
      const grow = smoke ? 1 + (1 - t) * 1.8 : p.type === 'mist' ? 1 + (1 - t) * 2 : .5 + t * .5;
      const size = p.life > 0 ? p.size * grow : 0;
      this.dummy.position.set(p.x, p.y, p.z); this.dummy.rotation.set(0, p.angle, p.type === 'wood' ? p.life * 4 : 0);
      this.dummy.scale.set(size, p.type === 'mist' ? .025 : p.type === 'foam' && p.y < .1 ? .035 : size, size);
      this.dummy.updateMatrix(); this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.alpha[i] = t * (p.type === 'ash' ? .2 : p.type === 'soot' ? .28 : p.type === 'smoke' ? .42 : p.type === 'ember' ? .95 : .92); this.alive++;
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
    this.mesh.geometry.attributes.particleSoft.needsUpdate = true;
    this.mesh.geometry.attributes.particleAlpha.needsUpdate = true;
  }
}

export class Wake {
  constructor(scene,ocean) {
    this.samples = []; this.accumulator = 0; this.max = 110;
    this.positions = new Float32Array(this.max * 6); this.alpha = new Float32Array(this.max * 2); this.uv = new Float32Array(this.max * 4);
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('wakeAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage)); geometry.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2).setUsage(THREE.DynamicDrawUsage));
    const indices = []; for (let i = 0; i < this.max - 1; i++) indices.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2); geometry.setIndex(indices); geometry.setDrawRange(0, 0);
    const material = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { time: { value: 0 }, storm: { value: 0 },islands:ocean.islands },
      vertexShader: `uniform float time;uniform float storm;attribute float wakeAlpha;varying vec2 tex;varying float alpha;varying vec3 world;${seaVertexFunction(ocean.islands.value.length)}void main(){tex=uv;alpha=wakeAlpha;world=position;vec3 p=position;p.y+=seaHeight(p.xz,time,storm);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
      fragmentShader: `uniform float time;varying vec2 tex;varying float alpha;varying vec3 world;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}void main(){float edge=abs(tex.x-.5)*2.;vec2 grid=floor(world.xz*8.);float n=hash(grid);float veins=sin(tex.y*7.+sin(tex.x*21.+tex.y*4.)*2.+time*.4);float ribbon=smoothstep(.45,.92,edge)*(1.-smoothstep(.86,1.,edge));float middle=(1.-edge)*.36;float flecks=step(.37,n)*(.35+step(.4,veins)*.65);float a=alpha*(ribbon+middle)*flecks;if(a<.02)discard;gl_FragColor=vec4(mix(vec3(.4,.76,.66),vec3(.91,1.,.88),ribbon+.25),a);}`,
    });
    this.mesh = new THREE.Mesh(geometry, material); this.mesh.frustumCulled = false; this.mesh.renderOrder = 2; scene.add(this.mesh);
  }
  clear() { this.samples.length = 0; this.mesh.geometry.setDrawRange(0, 0); }
  update(ship, dt, time, storm = 0) {
    this.accumulator += dt;
    for (const p of this.samples) p.age += dt;
    while (this.samples.length && this.samples[this.samples.length - 1].age > 7) this.samples.pop();
    const speed = Math.hypot(ship.vx, ship.vz), scale = ship.scale;
    if (!ship.dead && speed > .35 && this.accumulator >= .065) {
      this.accumulator = 0;
      const h = ship.heading, reverse = ship.speed < 0 ? -1 : 1;
      this.samples.unshift({ x: ship.x + Math.sin(h) * 5.1 * scale * reverse, z: ship.z + Math.cos(h) * 5.1 * scale * reverse, h, age: 0, strength: Math.min(1, speed / 5),wash:Math.max(0,Math.min(1,(speed-8)/7)) });
      if (this.samples.length > this.max) this.samples.pop();
    }
    for (let i = 0; i < this.samples.length; i++) {
      const p = this.samples[i], w = (1.55 * scale + p.age * (.65+p.wash*.32)), a = Math.min(1,Math.pow(1 - p.age / 7, 1.5) * p.strength*(1+p.wash*.35));
      for (let side = 0; side < 2; side++) {
        const k = i * 6 + side * 3, sign = side ? 1 : -1;
        this.positions[k] = p.x + Math.cos(p.h) * w * sign; this.positions[k + 1] = -.025; this.positions[k + 2] = p.z - Math.sin(p.h) * w * sign;
        this.alpha[i * 2 + side] = a; this.uv[i * 4 + side * 2] = side; this.uv[i * 4 + side * 2 + 1] = p.age;
      }
    }
    this.mesh.geometry.setDrawRange(0, Math.max(0, this.samples.length - 1) * 6);
    for (const name of ['position', 'wakeAlpha', 'uv']) this.mesh.geometry.attributes[name].needsUpdate = true;
    this.mesh.material.uniforms.time.value = time; this.mesh.material.uniforms.storm.value = storm;
  }
}


