import * as THREE from 'three';
import { box, rod, pirate, palette } from './world.js';
import { batchPaint } from './batch.js';
import { addLandmarks } from './landmarks.js';
import {applyFleetSails} from './fleet-appearance.js';

const glowCanvas = document.createElement('canvas'); glowCanvas.width = glowCanvas.height = 32;
const glowContext = glowCanvas.getContext('2d');
for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
  const d = Math.hypot(x - 15.5, y - 15.5) / 16;
  glowContext.fillStyle = `rgba(255,226,157,${Math.max(0, Math.floor((1 - d) ** 3 * 10) / 10)})`;
  if (d < 1) glowContext.fillRect(x, y, 1, 1);
}
const glowTexture = new THREE.CanvasTexture(glowCanvas); glowTexture.magFilter = THREE.NearestFilter;

function sailTexture(team, variant, shape='square') {
  const c = document.createElement('canvas'); c.width = c.height = 128; const ctx = c.getContext('2d');
  const base = team === 'red' && !['scout','merchant'].includes(variant) && shape!=='jib' ? '#a64f3b' : '#f1e7c6', ink = team === 'red' ? '#e8d9ab' : '#335f6a';
  ctx.fillStyle = base; ctx.fillRect(0, 0, 128, 128);
  for (let x = 0; x < 128; x += 16) { ctx.fillStyle = x % 32 ? '#ffffff0b' : '#2e4b3710'; ctx.fillRect(x, 0, 16, 128); ctx.fillStyle = '#233f391c'; ctx.fillRect(x + 15, 0, 1, 128); }
  ctx.fillStyle = team === 'red' ? '#e4cc99' : '#386b80'; ctx.fillRect(0, 105, 128, 13); ctx.fillStyle = '#cba56d'; ctx.fillRect(0, 103, 128, 2);
  // A small pixel crest, drawn on the cloth rather than floating in the interface.
  ctx.save();ctx.translate(shape==='lateen'?14:39,shape==='lateen'?77:34);ctx.scale(shape==='lateen'?2:3,shape==='lateen'?2:3);ctx.fillStyle = shape==='jib'||variant==='merchant'?'#00000000':ink;
  const skull = ['000111111100000','001111111110000','011111111111000','011001110011000','011001110011000','001111011110000','000111111100000','000101010100000','000111111100000'];
  skull.forEach((row, y) => [...row].forEach((bit, x) => { if (bit === '1') ctx.fillRect(x, y, 1, 1); }));
  for (let i = 0; i < 11; i++) { ctx.fillRect(1 + i, 13 + Math.floor(i * .4), 2, 1); ctx.fillRect(11 - i, 13 + Math.floor(i * .4), 2, 1); } ctx.restore();
  if (variant === 'scout') { ctx.fillStyle = '#c59664'; ctx.fillRect(9, 72, 25, 21); ctx.strokeStyle = '#886244'; ctx.setLineDash([2, 3]); ctx.strokeRect(10, 73, 23, 19); }
  if(variant==='merchant'&&shape!=='jib'){
    ctx.fillStyle='#b18a47';ctx.fillRect(27,77,31,18);ctx.fillStyle='#dec59a';ctx.fillRect(25,75,35,3);ctx.fillRect(33,75,3,22);ctx.fillRect(49,75,3,22);ctx.fillRect(40,82,5,5);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; return t;
}
function barrel(g, x, y, z, size = 1) {
  const b = new THREE.Group(); g.add(b); b.position.set(x, y, z); b.scale.setScalar(size);
  const wood = new THREE.Mesh(new THREE.CylinderGeometry(.34, .3, .8, 8), new THREE.MeshStandardMaterial({ color: 0x927049, flatShading: true })); wood.position.y = .4; wood.castShadow = true; b.add(wood);
  for (const h of [.16, .64]) { const band = new THREE.Mesh(new THREE.CylinderGeometry(.355, .355, .075, 8), new THREE.MeshStandardMaterial({ color: 0x4a5f55 })); band.position.y = h; b.add(band); }
  return b;
}
function lantern(g, x, y, z, records, blue = false) {
  rod(g, [x, y, z], [x, y + 1.6, z], .065, 0x55462d);
  box(g, .4, .12, .4, 0x654b2f, x, y + 1.75, z); box(g, .36, .12, .36, 0x654b2f, x, y + 1.32, z);
  const glow = box(g, .22, .4, .22, 0xffb558, x, y + 1.52, z); glow.material = new THREE.MeshBasicMaterial({ color: blue ? 0x80e9d5 : 0xffc96c });
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: blue ? 0x65e9df : 0xffc578, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .15, toneMapped: false }));
  halo.position.set(x, y + 1.52, z); halo.scale.set(4, 4, 1); g.add(halo);
  const beam=new THREE.Mesh(new THREE.ConeGeometry(1.8,y+1.52,24,1,true),new THREE.ShaderMaterial({uniforms:{strength:{value:0},tint:{value:new THREE.Color(blue?0x63c5d3:0xffb35c)}},vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;uniform float strength;uniform vec3 tint;void main(){float fade=pow(vUv.y,1.2)*smoothstep(0.,.15,vUv.y);gl_FragColor=vec4(tint,fade*strength);}',transparent:true,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));beam.position.set(x,(y+1.52)/2,z);g.add(beam);beam.visible=false;
  records.push({ parent: g, local: new THREE.Vector3(x, y + 1.58, z), glow, halo, beam, blue });
}

function pavedPath(parent,from,to,width=1.7){
 const distance=Math.hypot(to[0]-from[0],to[2]-from[2]),count=Math.ceil(distance/.48),angle=Math.atan2(to[0]-from[0],to[2]-from[2]);
 for(let n=0;n<=count;n++)for(let lane=0;lane<Math.ceil(width/.45);lane++){
  const t=n/count,offset=(lane-(Math.ceil(width/.45)-1)/2)*.45;
  const slab=box(parent,.43,.1,.43,[0xc0b48a,0xb5ac89,0xd2c299][(n+lane)%3],THREE.MathUtils.lerp(from[0],to[0],t)+Math.cos(angle)*offset,THREE.MathUtils.lerp(from[1],to[1],t),THREE.MathUtils.lerp(from[2],to[2],t)-Math.sin(angle)*offset);slab.rotation.y=angle;
 }
}

function portDistrict(island,fires,inhabitants,animations){
 const g=island.group,monument=new THREE.Group();monument.name='monumento-del-primer-fiado';monument.position.set(-6.1,1.85,5.7);g.add(monument);
 for(let tier=0;tier<3;tier++)box(monument,3.8-tier*.48,.35,3.8-tier*.48,[0xa7a38a,0xc1b797,0xd9c59c][tier],0,tier*.35,0);
 for(const side of [-1,1])for(let n=0;n<7;n++)box(monument,.36,.28,.12,0x948a6d,side*(1.68-n*.04),.35+(n%2)*.34,1.72);
 const statue=pirate(monument,0,1,0,0xb19152);statue.scale.setScalar(3.25);statue.rotation.y=.25;
 statue.traverse(object=>{if(object.isMesh)object.material=new THREE.MeshStandardMaterial({color:0x9c8854,roughness:.62,metalness:.35,flatShading:true});});
 statue.userData.limbs[0].rotation.x=-1.1;statue.userData.limbs[1].rotation.z=-.24;
 const mug=new THREE.Group();statue.userData.limbs[0].add(mug);mug.position.set(0,-.27,.08);box(mug,.18,.2,.19,0xc5a55f,0,0,0);box(mug,.07,.025,.12,0xb48d47,-.12,.04,0);box(mug,.07,.025,.12,0xb48d47,-.12,-.04,0);box(mug,.025,.09,.12,0xb48d47,-.15,0,0);
 for(const side of [-1,1]){pavedPath(g,[-6.1+side*2.7,1.88,3],[-6.1+side*2.7,1.88,8],1);lantern(g,-6.1+side*2.7,1.75,7.3,fires);}
 pavedPath(g,[-3.4,1.9,5.5],[6.7,.65,7.2],1.8);pavedPath(g,[6.7,.65,7.2],[island.r*.35,.95,island.r*.65],2);
 const bollards=[];
 for(let n=0;n<7;n++){const z=7.8+n*.9,x=island.r*.35+2.2;box(g,.42,.55,.42,0x928163,x,.63,z);box(g,.52,.1,.5,0xb9a474,x,.9,z);bollards.push([x,.98,z]);}
 for(let n=0;n<bollards.length-1;n++)rod(g,bollards[n],bollards[n+1],.028,0x756243);
 // An unfinished hull gives the shipyard an actual purpose and a recognisable silhouette.
 const ribs=new THREE.Group();ribs.position.set(11.55,1.9,4.4);g.add(ribs);
 for(let n=0;n<7;n++){const z=(n-3)*.4,width=.55+Math.sin(n/6*Math.PI)*.7;rod(ribs,[-width,.1,z],[-width*.65,-.5,z],.055,0xa38551);rod(ribs,[-width*.65,-.5,z],[width*.65,-.5,z],.055,0xb89961);rod(ribs,[width*.65,-.5,z],[width,.1,z],.055,0xa38551);}
 rod(ribs,[0,-.48,-1.5],[0,-.48,1.5],.065,0x6f573a);
 for(const side of [-1,1])for(let n=0;n<4;n++)box(ribs,.09,.08,2.8,0x957349,side*(.55+n*.18),-.3+n*.12,0);
 const crane=new THREE.Group();crane.name='grua-del-muelle';crane.position.set(island.r*.35+4.3,.7,island.r*.65+.6);g.add(crane);
 box(crane,1.4,.35,1.4,0x81765a,0,0,0);rod(crane,[0,.1,0],[0,4.8,0],.15,0x7e613c);rod(crane,[-.6,.2,0],[0,3.4,0],.08,0xab8850);
 const arm=new THREE.Group();arm.position.y=4.1;crane.add(arm);rod(arm,[-1.1,0,0],[3.4,.7,0],.13,0x9f7a47);rod(arm,[0,.6,0],[3.4,.7,0],.036,0xc2a471);rod(arm,[0,.6,0],[-1.1,0,0],.036,0xc2a471);
 const cargo=new THREE.Group();cargo.position.set(3.4,-.7,0);arm.add(cargo);rod(cargo,[0,1.4,0],[0,0,0],.025,0xad966c);box(cargo,.65,.6,.65,0x8a6740,0,-.3,0);for(const x of [-.24,.24])box(cargo,.08,.64,.68,0xc4a575,x,-.3,0);
 batchPaint(crane,true,new Set([arm]));batchPaint(arm,true,new Set([cargo]));batchPaint(cargo,true);animations.push({object:arm,kind:'crane',phase:1});animations.push({object:cargo,kind:'cargo',phase:2});
 const shipwright=pirate(g,11.4,1.3,6.5,0x638175);shipwright.userData.repairGear.visible=true;inhabitants.push({object:shipwright,x:11.4,y:1.3,z:6.5,phase:6,stationary:true});
 const publican=pirate(g,-3.5,1.9,3.5,0x9e7145);inhabitants.push({object:publican,x:-3.5,y:1.9,z:3.5,phase:2,stationary:true});
 return {monument,crane};
}

export function dressShips(ships) {
  ships.forEach((ship, index) => {
    const g = ship.object.userData.body,variant=ship.aiRole==='merchant'?'merchant':ship.variant==='scout'?'scout':'flagship',textures={square:sailTexture(ship.team,variant),lateen:sailTexture(ship.team,variant,'lateen'),jib:sailTexture(ship.team,variant,'jib')};
    ship.object.userData.sails.forEach((rig, i) => { rig.userData.cloth.material.map = textures[rig.userData.sailKind??'square']; rig.userData.cloth.material.color.set(0xffffff); if (i === 1) rig.userData.cloth.material.color.set(ship.team === 'red' ? 0xf0d4a5 : 0xfff4d1); });
    applyFleetSails(ship);
    barrel(g, -.6, 1.76, 3.2, .65); barrel(g, .7, 1.76, 3.8, .65);
    // The aft cabin gives each silhouette a more substantial stern.
    if(ship.variant==='brig'){box(g,2.2,.6,1.05,0x385e64,0,2.85,4.35);box(g,2.4,.13,1.25,0xc49c57,0,3.2,4.35);for(const x of [-.7,0,.7]){const window=box(g,.32,.3,.04,0xffd282,x,2.8,4.89);window.material=new THREE.MeshBasicMaterial({color:0xebc675});}}
    if(ship.aiRole==='merchant'){
      const hold=new THREE.Group();hold.name='bodega-del-mercante';g.add(hold);
      for(let n=0;n<6;n++){
        const x=(n%2-.5)*1.1,z=.7+Math.floor(n/2)*.83;
        box(hold,.91,.64,.7,0x8b683e,x,2.13,z);
        for(const side of [-1,1])box(hold,.07,.68,.73,0xc5aa70,x+side*.29,2.13,z);
      }
      for(const side of [-1,1])rod(hold,[side*1.22,1.8,.25],[side*1.22,3.25,.25],.04,0x9f824e);
      for(let n=0;n<10;n++){
        const awning=box(hold,.26,.05,2.7,n%2?0xd5c19a:0x7e7354,(n-4.5)*.26,3.25,.85);
        awning.rotation.z=n<5?.12:-.12;
      }
      ship.object.userData.cannons.forEach(cannon=>{cannon.visible=false;});
      batchPaint(hold,true);
    }
    ship.object.userData.crew.forEach((p, i) => { p.userData.deckOrigin = p.position.clone(); p.userData.phase = i * .8; });
    const lamps=[];lantern(g,-1.4,2.15,3.6,lamps);lantern(g,1.4,2.15,3.6,lamps);if(ship.variant==='galleon')lantern(g,0,4.2,5.7,lamps);
    ship.object.userData.lamps=lamps;
    batchPaint(g, true, new Set([...ship.object.userData.flags, ...ship.object.userData.sails.map(r => r.userData.cloth),...lamps.flatMap(l=>[l.halo,l.beam,l.glow])]));
  });
}
export function animateShipLanterns(ship,time,night){for(const l of ship.object.userData.lamps??[]){l.halo.material.opacity=night?.65+Math.sin(time*5)*.05:.07;l.beam.visible=night;l.beam.material.uniforms.strength.value=night?.17:0;}}

export function enrichIslands(islands, scene) {
  const fires = [], inhabitants = [], flags = [], glowing = [], animations=[];
  islands.forEach(island => {
    const index = island.type === 'fort' ? 0 : island.type === 'port' ? 3 : ({ ruins: 1, volcano: 2, snow: 4 }[island.biome] ?? 5);
    const g = island.group;
    island.name ??= ['Bastión del Mal Aliento', 'Ruinas de la Marea Hueca', 'Diente de Ceniza', 'Puerto Ron Ron', 'Cayo Escarcha', 'Cayo del Náufrago'][index];
    const dock = island.r * .65;
    lantern(g, island.r * .35 - 1.25, 1, dock + 4.8, fires);
    lantern(g, island.r * .35 + 1.25, 1, dock, fires);
    if (index === 0 || index === 3) {
      for (let i = 0; i < 6; i++) barrel(g, island.r * .22 + i % 3 * .75, .5, 3.8 + Math.floor(i / 3) * .8, .85);
      for (let i = 0; i < 5; i++) {
        const x = 2 + i * .6, z = 4.2 + i % 2;
        box(g, .6, .6, .6, 0x93794b, x, .75, z); box(g, .08, .64, .66, 0xc4a969, x - .2, .76, z);
      }
      for (let i = 0; i < (index === 0 ? 8 : 5); i++) {
        const p = pirate(g, 2 + i % 4, .5, 1.8 + Math.floor(i / 4) * 1.1, i % 3 === 0 ? 0x9a4e38 : 0x3f6563);
        inhabitants.push({ object: p, x: p.position.x, z: p.position.z, phase: i + index * 3 });
      }
      lantern(g, 1.1, .5, 1.8, fires); lantern(g, 6, .5, 2, fires);
      // Painted awning and hanging pennants around the landing.
      const tent = new THREE.Group(); tent.position.set(6, .4, 2.7); g.add(tent);
      for (const x of [-1, 1]) for (const z of [-.8, .8]) rod(tent, [x, 0, z], [x, 2, z], .06, 0x6c593c);
      for (let stripe = 0; stripe < 8; stripe++) { const canopy = box(tent, .3, .09, 2, stripe % 2 ? 0xd7c99e : index === 0 ? 0x935c45 : 0x417480, -1.05 + stripe * .3, 2.05, 0); canopy.rotation.z = stripe < 4 ? .16 : -.16; }
      for (let i = 0; i < 7; i++) { const flag = box(g, .38, .5, .03, i % 2 ? 0xb87447 : 0x487c7a, 1 + i * .7, 3 + Math.sin(i / 6 * Math.PI) * -.4, 5); flags.push(flag); }
      rod(g, [1, 3.2, 5], [5.2, 3.2, 5], .025, 0x806d46);
    }
    if(index===1){lantern(g,-2,1.8,1,fires,true);lantern(g,2,1.8,1,fires,true);}
    if (index === 2) {
      for (const child of g.children) if (child.isInstancedMesh && child.instanceColor) { const c = new THREE.Color(); for (let i = 0; i < child.count; i++) { child.getColorAt(i, c); c.lerp(new THREE.Color(0x544f42), .68); child.setColorAt(i, c); } child.instanceColor.needsUpdate = true; }
    }
    if (index === 4) {
      for (const child of g.children) if (child.isInstancedMesh && child.instanceColor) { const c = new THREE.Color(); for (let i = 0; i < child.count; i++) { child.getColorAt(i, c); child.setColorAt(i, c.lerp(new THREE.Color(0xe1eee4), .8)); } child.instanceColor.needsUpdate = true; }
      for (const [x, z] of [[-2, -1], [2, -3], [-3, 2]]) {
        rod(g, [x, 1.5, z], [x, 5, z], .15, 0x786b51);
        for (let i = 0; i < 7; i++) {
          const reach = 1.5 - i * .19, y = 2.3 + i * .48;
          for (let a = -reach; a <= reach; a += .26) for (let b = -reach; b <= reach; b += .26) {
            if (Math.abs(a) + Math.abs(b) > reach * 1.2) continue;
            box(g, .29, .24, .29, i % 2 ? 0x496f60 : 0x628272, x + a, y, z + b);
            if (Math.sin(a * 23 + b * 12) > -.5) box(g, .29, .12, .29, 0xdce7dc, x + a, y + .17, z + b);
          }
        }
      }
    }
  });
  const landmarks = addLandmarks(islands,fires,glowing,{inhabitants,animations,
    lamp:(parent,x,y,z,blue=false)=>lantern(parent,x,y,z,fires,blue)});
  for(const island of islands)if(island.type==='port')island.portDistrict=portDistrict(island,fires,inhabitants,animations);
  const dynamic = new Set([...flags, ...glowing, ...animations.map(a=>a.object), ...fires.flatMap(f => [f.glow,f.beam]).filter(Boolean)]);
  islands.forEach(i => batchPaint(i.group, true, dynamic));
  let emitClock = 0;
  const point = new THREE.Vector3();
  const lights=Array.from({length:4},()=>{const l=new THREE.PointLight(0xffbd70,0,14,2);scene.add(l);return l;});
  return { fires, update(time, dt, fx, night, player) {
    landmarks.update(time,night); emitClock += dt;
    const nearby=fires.filter(f=>f.beam).map(f=>{f.beam.visible=night;f.beam.material.uniforms.strength.value=night?.2+Math.sin(time*9+f.local.x)*.025:0;f.parent.updateMatrixWorld();const world=f.local.clone();f.parent.localToWorld(world);return {f,world,d:player?Math.hypot(world.x-player.x,world.z-player.z):0};}).sort((a,b)=>a.d-b.d);
    lights.forEach((l,i)=>{const source=nearby[i];l.intensity=night&&source?22+Math.sin(time*8+i)*2:0;if(source){l.position.copy(source.world);l.color.set(source.f.blue?0x78ddd5:0xffb65e);}});
    for (const p of inhabitants) { const walking = !p.stationary&&Math.sin(time * .3 + p.phase) > -.25; p.object.position.x = p.x + (p.stationary?0:Math.sin(time * .25 + p.phase) * 1.3); p.object.position.z = p.z + (p.stationary?0:Math.cos(time * .18 + p.phase) * .6); p.object.position.y = (p.y??.52) + (walking ? Math.abs(Math.sin(time * 6 + p.phase)) * .07 : 0); p.object.rotation.y = p.stationary?.18:Math.sin(time * .25 + p.phase) > 0 ? -Math.PI / 2 : Math.PI / 2; animatePirate(p.object, time + p.phase, walking ? .5 : .08); }
    for(const animation of animations){if(animation.kind==='crane')animation.object.rotation.y=Math.sin(time*.23+animation.phase)*.24;else if(animation.kind==='cargo'){animation.object.rotation.z=Math.sin(time*.8+animation.phase)*.065;animation.object.position.y=-.7+Math.sin(time*.24)*.35;}}
    flags.forEach((flag, i) => { flag.rotation.y = Math.sin(time * 3 + i) * .2; flag.rotation.x = Math.sin(time * 2 + i) * .12; });
    glowing.forEach((g, i) => g.scale.setScalar(1 + Math.sin(time * 2 + i) * .04));
    if (emitClock > .085) { emitClock = 0; for (const f of fires) { f.parent.updateMatrixWorld(); point.copy(f.local); f.parent.localToWorld(point);
      if(player&&Math.hypot(point.x-player.x,point.z-player.z)>88)continue;
      if (f.volcano) { if(time-(f.lastSmoke??0)>.42){f.lastSmoke=time;fx.emit('ash', point, { x: .4, y: .9, z: .1 }, .45 + Math.random()*.25, 3);} fx.emit('fire', point, { x: (Math.random() - .5) * 1.5, y: 1.3, z: (Math.random() - .5) * 1.5 }, .2, 1); }
      else { fx.emit(f.blue ? 'mist' : 'fire', point, { x: (Math.random() - .5) * .1, y: .4 + Math.random() * .5, z: .05 }, .11 + Math.random() * .12, .3 + Math.random() * .35); f.glow.scale.y = .9 + Math.sin(time * 11) * .15; f.halo.material.opacity += ((night ? .7 : .15) - f.halo.material.opacity) * .1; }
    } }
  } };
}

export function animatePirate(p, time, effort = .5) {
  if (!p.userData.limbs) return;
  const limbs=p.userData.limbs,repairing=p.userData.repairGear?.visible,looting=p.userData.lootGear?.visible,carrying=p.children.some(child=>child.visible&&child.userData?.carriedTreasure);
  limbs.forEach((limb, i) => { limb.rotation.x = Math.sin(time * 7 + (i % 2) * Math.PI) * effort * (i < 2 ? .6 : .4); });
  if(repairing){limbs[0].rotation.x=-.72+Math.sin(time*5.2)*.22;limbs[1].rotation.x=-.48+Math.sin(time*5.2+1.1)*.32;limbs[0].rotation.z=.15;limbs[1].rotation.z=-.12;}
  else if(looting||carrying){limbs[0].rotation.x=-.64+Math.sin(time*4)*.07;limbs[1].rotation.x=-.64-Math.sin(time*4)*.07;limbs[0].rotation.z=-.1;limbs[1].rotation.z=.1;}
  else{limbs[0].rotation.z=0;limbs[1].rotation.z=0;}
  if(p.userData.head){p.userData.head.rotation.y=Math.sin(time*.63)*.18;p.userData.head.rotation.z=Math.sin(time*.9)*.035;}
}


