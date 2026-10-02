import * as THREE from 'three';
import { seaVertexFunction } from './sea-state.js';

export const greekFireRules = Object.freeze({ capacity: 64, linger: 8, radius: 2.6, damage: 7, burnDuration: 5.5, emissionInterval: .12 });

/** Nearby oil deposits merge; every activation has a strictly bounded pool. */
export function addGreekFirePatch(patches, patch, capacity = greekFireRules.capacity) {
  const next = patches.filter(p => p.life > 0).map(p => ({ ...p }));
  const merged = next.find(p => p.team === patch.team && Math.hypot(p.x - patch.x, p.z - patch.z) < .7);
  if (merged) {
    merged.life = Math.max(merged.life, patch.life); merged.level = Math.max(merged.level ?? 0, patch.level ?? 0);
  } else next.push({ ...patch });
  return next.slice(-Math.max(1, capacity));
}

export function stepGreekFirePatches(patches, dt) {
  const elapsed = Math.max(0, Number.isFinite(dt) ? dt : 0);
  return patches.map(p => ({ ...p, life: Math.max(0, p.life - elapsed) })).filter(p => p.life > 0);
}

/** Overlapping patches apply the strongest burn, never one damage tick per patch. */
export function greekFireContact(target, patches) {
  if (!target || target.dead || target.destroyed || target.hp != null && target.hp <= 0) return null;
  let contact = null;
  const hullAllowance = (target.hitWidth ?? 2.2) * (target.scale ?? 1) * .5;
  for (const patch of patches) {
    if (patch.life <= 0 || patch.team === target.team || Math.hypot(target.x - patch.x, target.z - patch.z) > (patch.radius ?? greekFireRules.radius) + hullAllowance) continue;
    const level = Math.max(0, Math.min(3, patch.level ?? 0));
    const candidate = { damage: greekFireRules.damage + level * .75, duration: greekFireRules.burnDuration + level * .5, source: patch.source };
    if (!contact || candidate.damage > contact.damage) contact = candidate;
  }
  return contact;
}

export function greekFireBurn(target, contact) {
  if (!contact) return null;
  return {
    burning: Math.max(target.burning ?? 0, contact.duration),
    burnDamage: Math.max(target.burning > 0 ? target.burnDamage ?? 0 : 0, contact.damage),
    burnTick: target.burnTick ?? 0,
    burnSource: target.burning > 0 && (target.burnDamage ?? 0) > contact.damage ? target.burnSource : contact.source,
  };
}

const flameVertex = `
  attribute float fireLife;
  attribute float firePhase;
  uniform float time;
  varying vec2 fireUV;
  varying float seed;
  varying float strength;
  void main(){
    fireUV=uv; seed=firePhase; strength=fireLife;
    vec3 base=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
    vec3 right=vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]);
    vec3 up=vec3(viewMatrix[0][1],viewMatrix[1][1],viewMatrix[2][1]);
    float w=length(instanceMatrix[0].xyz),h=length(instanceMatrix[1].xyz);
    float lean=sin(time*4.+seed+uv.y*2.)*uv.y*uv.y*.17*h;
    vec3 world=base+right*((uv.x-.5)*w+lean)+up*(uv.y*h);
    gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);
  }
`;
const flameFragment = `
  uniform float time;
  #ifdef USE_FLAME_ATLAS
  uniform sampler2D flameAtlas;
  uniform vec4 flameFrames[4];
  vec4 atlasFrame(float frame,vec2 uv){
    vec4 bounds=flameFrames[int(frame)];
    return texture2D(flameAtlas,bounds.xy+uv*bounds.zw);
  }
  #endif
  varying vec2 fireUV;
  varying float seed;
  varying float strength;
  void main(){
    if(strength<.01)discard;
    #ifdef USE_FLAME_ATLAS
    float clock=time*8.+seed;
    float frame=mod(floor(clock),4.);
    vec4 a=atlasFrame(frame,fireUV),b=atlasFrame(mod(frame+1.,4.),fireUV);
    float blend=smoothstep(.25,.9,fract(clock));
    float alpha=mix(a.a,b.a,blend)*strength;
    if(alpha<.025)discard;
    vec3 color=(a.rgb*a.a*(1.-blend)+b.rgb*b.a*blend)/max(.001,mix(a.a,b.a,blend));
    gl_FragColor=vec4(color,alpha);
    #include <colorspace_fragment>
    #else
    vec2 q=vec2(fireUV.x*2.-1.,fireUV.y);
    float wobble=sin(q.y*14.-time*9.+seed)*.11+sin(q.y*29.-time*14.+seed*2.)*.045;
    q.x+=wobble*q.y;
    float width=pow(max(0.,1.-q.y),.7)*.79;
    width+=sin(q.y*17.-time*11.+seed)*.07*q.y;
    float edge=abs(q.x)/max(.025,width);
    float alpha=(1.-smoothstep(.77,1.08,edge))*smoothstep(0.,.07,q.y)*(1.-smoothstep(.91,1.,q.y))*strength;
    if(alpha<.015)discard;
    float heat=clamp((1.-q.y)*.94+(1.-edge)*.44,0.,1.);
    vec3 flame=mix(vec3(1.,.12,.012),vec3(1.,.62,.035),smoothstep(.15,.67,heat));
    flame=mix(flame,vec3(1.,.96,.52),smoothstep(.7,1.,heat));
    gl_FragColor=vec4(flame,alpha*.94);
    #include <colorspace_fragment>
    #endif
  }
`;

function createFlames(capacity, time, atlas = null) {
  const geometry = new THREE.PlaneGeometry(1, 1);
  const phases = new Float32Array(capacity), lives = new Float32Array(capacity);
  for (let i = 0; i < capacity; i++) phases[i] = i * 2.399;
  geometry.setAttribute('firePhase', new THREE.InstancedBufferAttribute(phases, 1));
  geometry.setAttribute('fireLife', new THREE.InstancedBufferAttribute(lives, 1).setUsage(THREE.DynamicDrawUsage));
  const material = new THREE.ShaderMaterial({ defines: atlas ? { USE_FLAME_ATLAS: 1 } : {}, uniforms: { time, flameAtlas: {value:atlas}, flameFrames: {value:[
    new THREE.Vector4(.130,.543,.319,.414),new THREE.Vector4(.584,.540,.321,.385),
    new THREE.Vector4(.110,.060,.341,.407),new THREE.Vector4(.584,.058,.340,.388),
  ]} }, vertexShader: flameVertex, fragmentShader: flameFragment,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const flames = new THREE.InstancedMesh(geometry, material, capacity);
  flames.instanceMatrix.setUsage(THREE.DynamicDrawUsage); flames.frustumCulled = false; flames.renderOrder = 5;
  return { flames, lives };
}

export class GreekFireTrail {
  constructor(scene, { ocean, wave = () => 0, fx, flameAtlas = null, capacity = greekFireRules.capacity } = {}) {
    this.capacity = capacity; this.wave = wave; this.fx = fx; this.patches = []; this.emitClock = 0; this.particleClock = 0; this.cursor = 0;
    this.time = { value: 0 };
    const islands = ocean?.islands ?? { value: [new THREE.Vector4(0, 0, 0, 0)] };
    const uniforms = { time: this.time, islands, storm: ocean?.storm ?? { value: 0 } };
    const oilGeometry = new THREE.CircleGeometry(1, 28);
    oilGeometry.setAttribute('fireLife', new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1).setUsage(THREE.DynamicDrawUsage));
    const oilMaterial = new THREE.ShaderMaterial({ uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
      vertexShader: `attribute float fireLife; varying vec2 oilUV; varying float strength; uniform float time; uniform float storm; ${seaVertexFunction(islands.value.length)}
        void main(){oilUV=uv;strength=fireLife;vec4 p=modelMatrix*instanceMatrix*vec4(position,1.);p.y=seaHeight(p.xz,time,storm)+.17;gl_Position=projectionMatrix*viewMatrix*p;}`,
      fragmentShader: `varying vec2 oilUV;varying float strength;uniform float time;void main(){if(strength<.01)discard;vec2 q=(oilUV-.5)*2.;float r=length(q);float angle=atan(q.y,q.x);float ripple=sin(angle*7.+time*2.)*.045+sin(angle*13.-time*3.)*.024;float rim=smoothstep(.61,.86,r+ripple)*(1.-smoothstep(.9,1.,r));float edge=1.-smoothstep(.85,1.,r+ripple);float veins=pow(max(0.,sin(q.x*19.+sin(q.y*13.+time*3.)*2.)),12.)*(1.-smoothstep(.3,.95,r));vec3 c=mix(vec3(.019,.012,.007),vec3(.65,.075,.004),rim*.6+veins*.4);c+=vec3(.12,.032,.001)*rim;gl_FragColor=vec4(c,(edge*.42+rim*.12)*strength);
        #include <colorspace_fragment>
      }`,
    });
    this.oil = new THREE.InstancedMesh(oilGeometry, oilMaterial, capacity);
    this.oil.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.oil.frustumCulled = false; this.oil.renderOrder = 4;
    const glowMaterial=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,blending:THREE.AdditiveBlending,
      vertexShader:oilMaterial.vertexShader.replace('+.17','+.12'),
      fragmentShader:`varying vec2 oilUV;varying float strength;uniform float time;void main(){float r=length((oilUV-.5)*2.);float pulse=.85+sin(time*6.+oilUV.y*15.)*.15;float glints=.45+.55*step(.3,sin(oilUV.y*100.+time*2.));gl_FragColor=vec4(vec3(1.,.24,.025),pow(max(0.,1.-r),2.)*strength*.045*pulse*glints);#include <colorspace_fragment>}`.replace(';#include',';\n#include')});
    this.glow=new THREE.InstancedMesh(oilGeometry,glowMaterial,capacity);this.glow.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.glow.frustumCulled=false;this.glow.renderOrder=3;
    const { flames, lives } = createFlames(capacity * 5 + 72, this.time, flameAtlas);
    this.flames = flames; this.flameLives = lives; this.group = new THREE.Group(); this.group.name = 'greek-fire-oil-trail';
    this.group.add(this.glow,this.oil, this.flames); scene.add(this.group);
    // Keep the light count constant: igniting a trail must not recompile every ship material.
    this.fireLights=Array.from({length:2},()=>{const light=new THREE.PointLight(0xff7e20,0,17,2);scene.add(light);return light;});
    this.transform = new THREE.Object3D(); this.oilTransform = new THREE.Object3D(); this.oilTransform.rotation.x = -Math.PI / 2;
    this.blankMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < capacity; i++) this.oil.setMatrixAt(i, this.blankMatrix);
    for (let i = 0; i < flames.count; i++) flames.setMatrixAt(i, this.blankMatrix);
  }

  igniteTrail(source, level = 0) {
    if (source.dead || source.destroyed) return;
    const aft = 6.5 * (source.scale ?? 1);
    this.patches = addGreekFirePatch(this.patches, {
      x: source.x + Math.sin(source.heading) * aft,
      z: source.z + Math.cos(source.heading) * aft,
      life: greekFireRules.linger, radius: greekFireRules.radius + level * .12, level, source, team: source.team,
    }, this.capacity);
  }

  update(dt, { source, emitting = false, level = 0, targets = [], time = 0, render = true } = {}) {
    this.time.value = time; this.patches = stepGreekFirePatches(this.patches, dt); this.emitClock += dt; this.particleClock += dt;
    if (emitting && source && !source.dead && this.emitClock >= greekFireRules.emissionInterval) { this.emitClock = 0; this.igniteTrail(source, level); }
    const contacts = [];
    for (const target of targets) {
      const profile = greekFireContact(target, this.patches);
      if (profile) contacts.push({ target, profile, newIgnition: !(target.burning > 0), burn: greekFireBurn(target, profile) });
    }
    if(render)this.draw(targets, time, source);
    if (this.particleClock >= .1 && this.fx) {
      this.particleClock = 0;
      for (let i = 0; i < Math.min(5, this.patches.length); i++) {
        const patch = this.patches[this.cursor++ % this.patches.length];
        const x = patch.x + Math.sin(time * 7 + i) * .9, z = patch.z + Math.cos(time * 5 + i) * .9;
        const y = this.wave(x, z, time) + .45;
        this.fx.emit('fire', { x, y: y + 1.3, z }, { x: .3, y: 1.9, z: .15 }, .065, .8);
        if (i % 2 === 0) this.fx.emit('soot', { x, y: y + 1.8, z }, { x: .7, y: 1.1, z: .2 }, .5, 2.2);
      }
      for(const target of targets.filter(t=>t.burning>0&&!t.dead&&!t.destroyed).slice(0,4)){
        const scale=target.scale??1,y=(target.object?.position.y??this.wave(target.x,target.z,time))+2*scale;
        this.fx.emit('soot',{x:target.x+Math.sin(time*2)*scale,y,z:target.z},{x:.6,y:1.8,z:.2},.6*scale,2.5);
        this.fx.emit('fire',{x:target.x,y:y+.8,z:target.z},{x:.3,y:3,z:.1},.075*scale,.9);
      }
    }
    return contacts;
  }

  setFlame(index, x, y, z, width, height, strength) {
    this.transform.position.set(x, y, z); this.transform.rotation.set(0, 0, 0); this.transform.scale.set(width, height, 1); this.transform.updateMatrix();
    this.flames.setMatrixAt(index, this.transform.matrix); this.flameLives[index] = strength;
  }

  draw(targets, time, source) {
    const oilLives = this.oil.geometry.attributes.fireLife.array;
    let flameIndex = 0;
    for (let i = 0; i < this.capacity; i++) {
      const patch = this.patches[i];
      if (!patch) { this.oil.setMatrixAt(i, this.blankMatrix); this.glow.setMatrixAt(i,this.blankMatrix); oilLives[i] = 0; continue; }
      const fade = Math.min(1, patch.life / 1.8);
      this.oilTransform.position.set(patch.x, 0, patch.z); this.oilTransform.scale.set(patch.radius, patch.radius * .9, 1); this.oilTransform.updateMatrix();
      this.oil.setMatrixAt(i, this.oilTransform.matrix); oilLives[i] = fade;
      this.oilTransform.scale.set(patch.radius*1.8,patch.radius*1.8,1);this.oilTransform.updateMatrix();this.glow.setMatrixAt(i,this.oilTransform.matrix);
      for (let j = 0; j < 5; j++) {
        const phase = i * 2.399 + j * 2.1;
        const x = patch.x + Math.cos(phase) * patch.radius * (j ? .6 : .1), z = patch.z + Math.sin(phase) * patch.radius * (j ? .6 : .1);
        const y = this.wave(x, z, time) + .19;
        this.setFlame(flameIndex++, x, y, z, 1.8 + Math.sin(phase) * .3, (2.3 + Math.sin(time * 5 + phase) * .35) * fade, fade);
      }
    }
    for (const target of targets.filter(t => t.burning > 0 && !t.dead && !t.destroyed).slice(0, 9)) {
      const scale = target.scale ?? 1, y = (target.object?.position.y ?? this.wave(target.x, target.z, time)) + 1.95 * scale;
      const rail=(target.hitWidth??2.35)*.91;
      for (let j = 0; j < 8; j++) {
        const angle = target.heading ?? 0, side = j % 2 ? 1 : -1, along = -3 + Math.floor(j/2)*2;
        const x = target.x + (Math.cos(angle) * side * rail - Math.sin(angle) * along) * scale;
        const z = target.z + (-Math.sin(angle) * side * rail - Math.cos(angle) * along) * scale;
        const fade = Math.min(1, target.burning / .6);
        this.setFlame(flameIndex++, x, y, z, 1.8 * scale, (3.2 + Math.sin(time * 5 + j) * .4) * scale, fade);
      }
    }
    for (let i = flameIndex; i < this.flames.count; i++) { this.flames.setMatrixAt(i, this.blankMatrix); this.flameLives[i] = 0; }
    this.group.visible = this.patches.length > 0 || flameIndex > 0;
    const lit=targets.filter(t=>t.burning>0&&!t.dead&&!t.destroyed).concat(this.patches)
      .sort((a,b)=>source?Math.hypot(a.x-source.x,a.z-source.z)-Math.hypot(b.x-source.x,b.z-source.z):0);
    this.fireLights.forEach((light,i)=>{const target=lit[i];if(!target){light.intensity=0;return;}light.position.set(target.x,(target.object?.position.y??this.wave(target.x,target.z,time))+2.4,target.z);light.intensity=(target.burning?18:12)*(1+Math.sin(time*12+i)*.1)*Math.min(1,(target.burning??target.life)/.8);});
    this.glow.instanceMatrix.needsUpdate=this.oil.instanceMatrix.needsUpdate = this.flames.instanceMatrix.needsUpdate = true;
    this.oil.geometry.attributes.fireLife.needsUpdate = this.flames.geometry.attributes.fireLife.needsUpdate = true;
  }

  dispose() {
    this.group.removeFromParent();
    for(const light of this.fireLights){light.removeFromParent();light.dispose();}
    this.glow.material.dispose();this.glow.dispose();
    for (const mesh of [this.oil, this.flames]) { mesh.geometry.dispose(); mesh.material.dispose(); mesh.dispose(); }
    this.patches.length = 0;
  }
}
