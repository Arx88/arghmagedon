import * as THREE from 'three';
import { coastRadius,coastGLSL } from './coastline.js';
import { buildTerrainSurface } from './terrain-surface.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {box,rod,chest,pirate,fort,random,palette} from './world.js';
import {createShip as baseShip} from './ship-designs.js';
import { seaVertexFunction } from './sea-state.js';

// Small, opaque texels: no blurred procedural gradients on solid objects.
function pixelTexture(kind='wood'){
  const c=document.createElement('canvas');c.width=c.height=64;
  const ctx=c.getContext('2d');ctx.fillStyle='#ded9cc';ctx.fillRect(0,0,64,64);
  let s=8543;const rnd=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};
  if(kind==='cloth'){ctx.fillStyle='#f8f5e9';ctx.fillRect(0,0,64,64);}
  for(let i=0;i<(kind==='cloth'?90:350);i++){const v=(kind==='cloth'?230:192)+Math.floor(rnd()*(kind==='cloth'?20:48));ctx.fillStyle=`rgb(${v},${v},${v-5})`;const x=Math.floor(rnd()*64),y=Math.floor(rnd()*64);ctx.fillRect(x,y,kind==='wood'?3+Math.floor(rnd()*8):2,kind==='wood'?1:2);}
  if(kind==='cloth'){ctx.fillStyle='#d2d2bc';for(let x=10;x<64;x+=14)ctx.fillRect(x,0,1,64);}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.magFilter=t.minFilter=THREE.NearestFilter;t.generateMipmaps=false;t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;
}
const woodTexture=pixelTexture(),clothTexture=pixelTexture('cloth');
function mergeStatic(parent,exclude=new Set()){
 const batches=new Map();
 for(const child of [...parent.children]){
  if(!child.isMesh||child.isInstancedMesh||exclude.has(child))continue;
  const m=child.material,key=[m.color?.getHex(),m.map?.uuid,m.side,m.vertexColors,Object.keys(child.geometry.attributes).sort().join(),!!child.geometry.index].join(':');
  if(!batches.has(key))batches.set(key,{material:m,parts:[],objects:[]});
  child.updateMatrix();const batch=batches.get(key);batch.parts.push(child.geometry.clone().applyMatrix4(child.matrix));batch.objects.push(child);
 }
 for(const batch of batches.values()){
  if(batch.parts.length<2){batch.parts.forEach(g=>g.dispose());continue;}
  const geometry=mergeGeometries(batch.parts);batch.parts.forEach(g=>g.dispose());if(!geometry)continue;
  const combined=new THREE.Mesh(geometry,batch.material);combined.castShadow=combined.receiveShadow=true;parent.add(combined);batch.objects.forEach(o=>parent.remove(o));
 }
}
export function createShip(team,size,variant){
  const g=baseShip(team,size,variant);
  g.traverse(o=>{if(!o.isMesh)return;const m=o.material.clone();m.userData.shipOwn=true;if(m.color){if(m.color.r>.4&&m.color.g>.4&&m.color.b>.3){m.map=clothTexture;m.color.multiplyScalar(1.1);}else if(m.color.r>m.color.g*1.12){m.map=woodTexture;}}m.roughness=1;o.material=m;});
  const b=g.userData.body,color=team==='blue'?0x286a87:0x993f30;
  // Stepped planking, colored gunwale, brass studs and visibly squared rail ends.
  // The profile-specific hull builder already includes fitted gunwales and studs.
  mergeStatic(b,new Set(g.userData.flags));
  g.userData.sails.forEach((rig,index)=>{
    const cloth=rig.userData.cloth;
    const uniforms={time:{value:0},power:{value:0}};
    rig.userData.wind=uniforms;
    cloth.material.onBeforeCompile=shader=>{
      shader.uniforms.sailTime=uniforms.time;shader.uniforms.sailPower=uniforms.power;
      shader.vertexShader='uniform float sailTime;uniform float sailPower;attribute float sailFlex;attribute vec3 sailNormal;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        float billow=sailFlex*(sailPower*.32+sin(position.x*2.2-sailTime*2.4+${index.toFixed(1)})*(.075+sailPower*.08));
        transformed+=sailNormal*billow;
        transformed.x+=sin(sailTime*2.8+position.y*2.)*.025*sailFlex;`);
    };
    cloth.material.customProgramCacheKey=()=>`billowing-sail-${index}`;
    mergeStatic(rig,new Set([cloth]));
  });
  g.userData.upgradeDecoration=new THREE.Group();b.add(g.userData.upgradeDecoration);
  return g;
}

export function updateUpgradeModel(ship){
 const data=ship.object.userData,group=data.upgradeDecoration;
 while(group.children.length){const child=group.children.pop();child.parent=null;child.geometry?.dispose();}
 for(let layer=0;layer<ship.upgrades.hull;layer++)for(const side of [-1,1])for(let i=0;i<6;i++){
  box(group,.14,.22,.9,layer===2?0xcda85d:0x738a7e,side*2.31,.52+layer*.27,-2.8+i*1.05);
  box(group,.17,.07,.09,0xe7c37f,side*2.4,.52+layer*.27,-2.8+i*1.05);
 }
 data.cannons.forEach(c=>{c.scale.set(1+ship.upgrades.cannons*.14,1+ship.upgrades.cannons*.1,1+ship.upgrades.cannons*.1);});
 while(data.crew.length<ship.maxCrew){const i=data.crew.length-12;data.crew.push(pirate(data.body,(i%2?1:-1)*.75,1.76,-3.2+Math.floor(i/2)*1.05,ship.team==='blue'?palette.blue:palette.red));}
 for(let i=0;i<ship.upgrades.cannons;i++)box(group,.32,.22,.5,0xe4b65d,0,2.45+i*.24,4);
 mergeStatic(group);
}

class Voxels{
  constructor(){this.items=[];}
  add(x,y,z,w,h,d,color){this.items.push({x,y,z,w,h,d,color});}
  build(parent){const material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,flatShading:true});const result=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),material,this.items.length);const matrix=new THREE.Matrix4(),q=new THREE.Quaternion();for(let i=0;i<this.items.length;i++){const v=this.items[i];matrix.compose(new THREE.Vector3(v.x,v.y,v.z),q,new THREE.Vector3(v.w,v.h,v.d));result.setMatrixAt(i,matrix);result.setColorAt(i,new THREE.Color(v.color));}result.castShadow=true;result.receiveShadow=true;result.computeBoundingSphere();parent.add(result);return result;}
}
const sands=[0xe9cf96,0xe4c98c,0xdabd80,0xf0dca5,0xe8ce95];
const greens=[0x4c813e,0x629743,0x7eaa4b,0x8fb357,0x3e7543,0x729d45];
const rocks=[0x778b87,0x8a9890,0xa1a899,0x687d78,0xadb09f,0x83998d];
function hash(x,z){return (Math.sin(x*127.1+z*311.7)*43758.5453)%1;}
function terrainNoise(x,z){
 const ix=Math.floor(x),iz=Math.floor(z),sx=x-ix,sz=z-iz,u=sx*sx*(3-2*sx),v=sz*sz*(3-2*sz);
 return THREE.MathUtils.lerp(THREE.MathUtils.lerp(Math.abs(hash(ix,iz)),Math.abs(hash(ix+1,iz)),u),THREE.MathUtils.lerp(Math.abs(hash(ix,iz+1)),Math.abs(hash(ix+1,iz+1)),u),v);
}
function contour(a){return 1+Math.sin(a*3+.5)*.11+Math.cos(a*7)*.045+Math.sin(a*11)*.025;}

function palm(v,x,y,z,scale=1,leaves=v){
 const firstLeaf=leaves.items.length;
 const h=5.7*scale,step=.27*scale;
 for(let i=0;i<h/step;i++){const t=i/(h/step),xx=x+t*t*.65*scale;v.add(xx,y+i*step,z,.24*scale,step*1.02,.24*scale,i%3===0?0x97764a:0x806b41);}
 for(let branch=0;branch<7;branch++){const a=branch/7*Math.PI*2+random()*.15;
  for(let j=0;j<13;j++){const t=j/12,r=t*3.4*scale,yy=y+h+Math.sin(t*Math.PI)*.68*scale-t*t*1.65*scale;
   const width=(.1+Math.sin(t*Math.PI)*.42)*scale;
   const xx=x+.65*scale+Math.cos(a)*r,zz=z+Math.sin(a)*r;
   const leafColor=[0x679b3e,0x7aaa46,0x51863b,0x89b953,0x477d3d,0x6ba33e,0x94bd59][branch];
   leaves.add(xx,yy,zz,.28*scale,.12*scale,.28*scale,leafColor);
   for(const side of [-1,1])for(let k=1;k<=Math.ceil(width/(.17*scale));k++){
    leaves.add(xx+Math.sin(a)*k*.17*scale*side-Math.cos(a)*k*.055*scale,yy-k*.045*scale,zz-Math.cos(a)*k*.17*scale*side-Math.sin(a)*k*.055*scale,.24*scale,.13*scale,.24*scale,leafColor);
   }
  }
 }
 for(let i=firstLeaf;i<leaves.items.length;i++){
  const leaf=leaves.items[i];leaf.flex=Math.min(1,Math.hypot(leaf.x-x-.65*scale,leaf.z-z)/(3.4*scale));leaf.phase=x*.23+z*.31;
 }
 for(let i=0;i<3;i++)v.add(x+.65*scale+(random()-.5)*.35,y+h-.18,z+(random()-.5)*.35,.27,.27,.27,0x725932);
}

export function createIsland({x,z,r=9,type='treasure',biome='tropical',name}){
 const g=new THREE.Group();g.position.set(x,0,z);const v=new Voxels(),leaves=new Voxels();const step=.4,cells=[];
 // Each coastline cell has an individual elevation and material, with a beach cut into the cliff.
 for(let xx=-r*1.2;xx<r*1.2;xx+=step)for(let zz=-r*.9;zz<r*.9;zz+=step){
  const a=Math.atan2(zz/.72,xx),rr=Math.hypot(xx,zz/.72)/r,edge=coastRadius(a,x,z);if(rr>edge)continue;
  const n=Math.abs(hash(xx,zz));const patch=terrainNoise(xx*.37,zz*.37);const beach=(xx>r*.02&&zz> -r*.22)||rr>.92;
  let top=.18+Math.floor(patch*3)*.025;
  if(!beach&&rr<.91){const ridge=Math.sin(a*4)*.3+Math.cos(xx*.7)*.2;top=Math.max(.8,Math.round((1.1+(1-rr)*1.25+ridge)*4)/4);}
  const sandy=beach||rr>.93,paint=sandy?sands[Math.floor(patch*5)]:rocks[Math.floor(patch*6)],cell={x:xx,z:zz,h:top,topColor:paint,sideColor:paint};cells.push(cell);
  if(!sandy&&rr<.78){cell.h+=.16;cell.topColor=greens[Math.floor(patch*6)];}
  if(sandy&&n>.92)v.add(xx,top+.04,zz,.13,.08,.13,n>.97?0xabb27a:0xc0ac77);
 }
 // Broken cliff columns: squared strata and tiny chips, not low-poly boulders.
 for(let i=0;i<95;i++){const a=random()*6.28,rr=.69+random()*.25;if(Math.cos(a)>.15&&Math.sin(a)>-.3)continue;
  const xx=Math.cos(a)*r*rr,zz=Math.sin(a)*r*.72*rr,w=.45+random()*1.15,h=.8+random()*2.5;
  v.add(xx,h*.5+.25,zz,w,h,w*.8,rocks[i%6]);v.add(xx-w*.18,h+.3,zz,w*.65,.2,w*.65,greens[i%6]);
  v.add(xx+.3,h*.35,zz+.5,w*.48,h*.6,w*.6,rocks[(i+2)%6]);
 }
 if(type==='fort'){for(const [xx,zz,scale]of [[-8,-3,1.25],[-5,-7,1.45],[.5,-8,1.3],[6,-6,1.2],[9,-1,1.1],[-10,2,1.0]])palm(v,xx,1.8,zz,scale,leaves);}
 else if(type==='port'){palm(v,5,1.8,-5,.95,leaves);}
 else for(let i=0;i<(biome==='snow'||biome==='volcano'?0:biome==='ruins'?1:3);i++){const a=i/3*6.28+.4,rr=.42+random()*.17;palm(v,Math.cos(a)*r*rr,1.8,Math.sin(a)*r*.66*rr,.9+random()*.2,leaves);}
 for(let i=0;i<180;i++){const a=random()*6.28,rr=random()*.75,xx=Math.cos(a)*r*rr,zz=Math.sin(a)*r*.65*rr;if(xx>r*.02&&zz> -r*.22)continue;const size=.18+random()*.5;v.add(xx,1.8+random()*.8,zz,size,size*.8,size,greens[i%6]);}
 const ground=v.build(g);buildTerrainSurface(g,cells,step,biome);if(biome==='snow'||biome==='volcano'){const c=new THREE.Color(),tint=new THREE.Color(biome==='snow'?0xd9e8de:0x625b4b);for(let n=0;n<ground.count;n++){ground.getColorAt(n,c);ground.setColorAt(n,c.lerp(tint,biome==='snow'?.8:.72));}ground.instanceColor.needsUpdate=true;}const canopy=leaves.build(g);canopy.receiveShadow=false;
 const canopyWind={value:0};
 canopy.geometry.setAttribute('leafFlex',new THREE.InstancedBufferAttribute(new Float32Array(leaves.items.map(leaf=>leaf.flex??0)),1));
 canopy.geometry.setAttribute('leafPhase',new THREE.InstancedBufferAttribute(new Float32Array(leaves.items.map(leaf=>leaf.phase??0)),1));
 canopy.material.onBeforeCompile=shader=>{
  shader.uniforms.canopyTime=canopyWind;
  shader.vertexShader='uniform float canopyTime;attribute float leafFlex;attribute float leafPhase;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    float gust=sin(canopyTime*1.25+leafPhase)*.12+sin(canopyTime*2.1+leafPhase)*.035;
    transformed.x+=gust*leafFlex*leafFlex/instanceMatrix[0][0];
    transformed.y+=sin(canopyTime*1.6+leafPhase+leafFlex*2.)*.07*leafFlex/instanceMatrix[1][1];`);
 };
 canopy.material.customProgramCacheKey=()=> 'coastal-palm-sway-v1';
 // Foliage moves inside a small conservative bound; trunks and terrain stay fixed.
 if(canopy.boundingSphere)canopy.boundingSphere.radius+=.3;
 if(type==='fort'){const tower=new THREE.Group();tower.name='fortaleza-base';g.add(tower);tower.position.set(-1,.1,-1);tower.scale.setScalar(1.1);fort(tower);for(let i=0;i<60;i++){const side=i%2,xx=random()*3.9-1.95,yy=2.8+Math.floor(random()*13)*.35;box(tower,side?.06:.22+random()*.3,.13,side?.25+random()*.35:.06,i%3?0xabb19e:0xc6c4a8,side?2.07:xx,yy,side?xx-1:1.08);}}
 const dockZ=r*.65;for(let i=0;i<14;i++)box(g,2.6,.18,.37,i%3?0x9c7950:0xbd9760,r*.35,1,dockZ+i*.4);
 for(const side of [-1,1])for(let i=0;i<3;i++){box(g,.2,2.1,.22,palette.wood,r*.35+side*1.2,.65,dockZ+i*2.4);box(g,.3,.12,.31,palette.gold,r*.35+side*1.2,1.28,dockZ+i*2.4);}
 const treasure=new THREE.Group();g.add(treasure);chest(treasure,r*.25,.6,2,1.5);chest(treasure,r*.25+1.7,.6,1.4,1);pirate(g,r*.25-1,.6,3,0x323d32);pirate(g,r*.25+2,.6,3.2,0x323d32);
 mergeStatic(g);return {group:g,treasure,canopyWind,x,z,r,type,biome,name,gold:type==='fort'?180:100,available:true};
}

export function createOcean(scene,islands){
 const uniforms={time:{value:0},storm:{value:0},lightTint:{value:new THREE.Color(1,1,1)},reflection:{value:null},reflectionMatrix:{value:new THREE.Matrix4()},islands:{value:islands.map(i=>new THREE.Vector4(i.x,i.z,i.r,i.r*.72))}};
 const m=new THREE.ShaderMaterial({uniforms,toneMapped:false,
 vertexShader:`varying vec3 world;varying vec4 reflected;uniform mat4 reflectionMatrix;uniform float time;uniform float storm;${seaVertexFunction(islands.length)}void main(){vec4 w=modelMatrix*vec4(position,1.);w.y+=seaHeight(w.xz,time,storm);world=w.xyz;reflected=reflectionMatrix*w;gl_Position=projectionMatrix*viewMatrix*w;}`,
 fragmentShader:`varying vec3 world;varying vec4 reflected;uniform float time;uniform float storm;uniform sampler2D reflection;uniform vec3 lightTint;uniform vec4 islands[${islands.length}];
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}float fbm(vec2 p){return noise(p)*.55+noise(p*2.02)*.27+noise(p*4.1)*.13+noise(p*8.3)*.05;}
 void main(){vec2 p=floor(world.xz*12.)/12.;float broad=fbm(p*.09+vec2(time*.005,0));float n=fbm(p*.45+vec2(time*.015,-time*.025));float ripple=noise(vec2(p.x*1.8,p.y*5.3)+vec2(time*.15,time*.3));float d=100.;
 for(int i=0;i<${islands.length};i++){vec4 a=islands[i];if(a.z<=0.)continue;vec2 q=(p-a.xy)/a.zw;float ang=atan(q.y,q.x);${coastGLSL}d=min(d,(length(q)-shape)*min(a.z,a.w));}
 vec3 deep=vec3(.024,.31,.37),mid=vec3(.025,.47,.51),light=vec3(.055,.59,.59);float bands=floor(smoothstep(.2,.8,broad)*7.)/7.;vec3 col=mix(deep,mid,bands);col=mix(col,light,smoothstep(.49,.73,n)*.45);
 float shallow=exp(-max(d,0.)*.22);col=mix(col,vec3(.24,.75,.66),shallow*.72);float flecks=floor(ripple*6.)/6.;col+=vec3(.09,.15,.135)*(flecks-.4)*.45;float caustic=pow(1.-abs(sin(p.x*1.8+sin(p.y*1.3+time*.4))*sin(p.y*1.6-time*.3)),14.);col+=vec3(.12,.17,.11)*caustic*shallow*smoothstep(-.1,.6,d)*.42;
 vec2 uv=reflected.xy/reflected.w*.5+.5;uv.x+=sin(p.y*3.+time*1.8)*.0018+noise(p*2.)*.001;uv.y+=sin(p.x*.8+time)*.001;vec4 ref=texture2D(reflection,uv);vec3 rc=pow(max(ref.rgb,vec3(0)),vec3(.4545));col=mix(col,rc*vec3(.36,.66,.63),ref.a*.59);
 float wave=sin(d*3.2-time*1.5+noise(p*.75)*2.);float broken=step(.28,noise(p*2.4));float foam=smoothstep(.68,.91,wave)*exp(-max(d,0.)*.48)*smoothstep(-.2,.4,d)*broken;col=mix(col,vec3(.87,.97,.9),foam*.9);
 float spark=step(.86,ripple)*step(.56,noise(p*.4+time*.03));col+=vec3(.34,.43,.36)*spark*.5;float crest=sin(p.x*.14+p.y*.11+time*1.25+noise(p*.12)*2.);float caps=(smoothstep(.88,.97,crest)*step(.64,noise(p*1.3))*smoothstep(.38,.65,noise(p*.22+time*.06))+smoothstep(1.4,3.6,world.y)*step(.36,noise(p*2.)))*storm;col=mix(col,vec3(.81,.91,.9),min(.8,caps*.65));col*=lightTint;col=floor(col*96.+.5)/96.;gl_FragColor=vec4(col,1.);}`});
 const water=new THREE.Mesh(new THREE.PlaneGeometry(360,360,144,144),m);water.rotation.x=-Math.PI/2;water.position.y=-.18;scene.add(water);return {...uniforms,water};
}

export function createReflections(renderer,scene,camera,ocean){
 const target=new THREE.WebGLRenderTarget(768,512,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});
 const mirrored=new THREE.OrthographicCamera(),clear=new THREE.Color();ocean.reflection.value=target.texture;
 return ()=>{mirrored.copy(camera);mirrored.position.y=-camera.position.y-.36;mirrored.up.set(0,-1,0);const direction=new THREE.Vector3();camera.getWorldDirection(direction);direction.y=-direction.y;mirrored.lookAt(mirrored.position.clone().add(direction));mirrored.updateMatrixWorld();ocean.reflectionMatrix.value.multiplyMatrices(mirrored.projectionMatrix,mirrored.matrixWorldInverse);
  const fog=scene.userData.fog;if(fog)fog.visible=false;const background=scene.background;renderer.getClearColor(clear);const alpha=renderer.getClearAlpha();scene.background=null;ocean.water.visible=false;renderer.setClearColor(0x000000,0);renderer.setRenderTarget(target);renderer.render(scene,mirrored);renderer.setRenderTarget(null);renderer.setClearColor(clear,alpha);scene.background=background;ocean.water.visible=true;if(fog)fog.visible=true;
 };
}

export function createClouds(scene){ scene.userData.clouds=[];
 const canvas=document.createElement('canvas');canvas.width=192;canvas.height=100;
 const ctx=canvas.getContext('2d'),data=ctx.createImageData(192,100);
 const lobes=[[29,67,29],[54,52,33],[80,62,36],[101,36,29],[130,49,33],[160,64,28],[108,73,29]];
 for(let y=0;y<100;y++)for(let x=0;x<192;x++){
  let depth=-1,shade=0;const edge=Math.sin(x*.4)*1.2+Math.cos(y*.5)*1.3+Math.sin(x*.16+y*.2)*2;
  for(const [cx,cy,r]of lobes){const dx=x-cx,dy=y-cy,d=Math.hypot(dx,dy),inside=r+edge-d;if(inside>depth){depth=inside;shade=.55-(dy/r)*.27+(dx/r)*.11+Math.sqrt(Math.max(0,1-d*d/(r*r)))*.2;}}
  if(depth<0)continue;const tone=Math.floor(THREE.MathUtils.clamp(shade,0,1)*7)/7;
  const index=(y*192+x)*4;data.data[index]=181+tone*70;data.data[index+1]=211+tone*35;data.data[index+2]=207+tone*25;data.data[index+3]=depth<1?210:250;
 }
 ctx.putImageData(data,0,0);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;
 // Decorative cloud banks stay beyond the navigable coast, never above a port or island.
 for(const [x,z,s]of [[-204,173,1.4],[-135,186,1.25],[207,-147,.9],[-201,-160,.8]]){const cloud=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false,toneMapped:false}));cloud.position.set(x,8,z);cloud.scale.set(31*s,16*s,1);scene.add(cloud);scene.userData.clouds.push(cloud);}
}








