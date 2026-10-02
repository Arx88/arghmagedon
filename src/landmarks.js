import * as THREE from 'three';
import { box, rod, pirate } from './world.js';
import { batchPaint } from './batch.js';

function group(parent,x=0,y=0,z=0,scale=1){const g=new THREE.Group();g.position.set(x,y,z);g.scale.setScalar(scale);parent.add(g);return g;}
function glow(parent,w,h,d,color,x,y,z){const m=box(parent,w,h,d,color,x,y,z);m.material=new THREE.MeshBasicMaterial({color});return m;}
function plaque(parent,text,x,y,z,width=2.6){
  const c=document.createElement('canvas');c.width=256;c.height=64;const ctx=c.getContext('2d');ctx.fillStyle='#31443a';ctx.fillRect(0,0,256,64);ctx.strokeStyle='#cdb47a';ctx.lineWidth=5;ctx.strokeRect(4,4,248,56);ctx.fillStyle='#f1d598';ctx.font='bold 25px Georgia';ctx.textAlign='center';ctx.fillText(text,128,42);
  const texture=new THREE.CanvasTexture(c);texture.magFilter=THREE.NearestFilter;texture.colorSpace=THREE.SRGBColorSpace;
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(width,width/4),new THREE.MeshStandardMaterial({map:texture,roughness:1}));sign.position.set(x,y,z);parent.add(sign);
}
function roof(g,width,depth,base,color,snow=false){
  for(let row=0;row<9;row++)for(const side of [-1,1]){
    const x=side*(width/2-row*width/18),y=base+row*.18;
    for(let z=-depth/2;z<depth/2;z+=.42){const tile=box(g,width/8,.15,.47,snow?0xd6e5df:color,x,y,z+.2);tile.rotation.z=side*.22;if(!snow&&(row+Math.floor(z*3))%4===0){tile.material=tile.material.clone();tile.material.color.multiplyScalar(.9);}}
  }
  box(g,.2,.15,depth+.25,snow?0xf2f3dd:0xb88950,0,base+1.55,0);
}
function house(parent,x,y,z,{scale=1,color=0xc8b082,roofColor=0x397e83,snow=false,sign='',tall=false}={}){
  const g=group(parent,x,y,z,scale),h=tall?4.1:2.7;
  for(const a of [-1.35,1.35])for(const b of [-1.05,1.05])rod(g,[a,-2,b],[a,.15,b],.12,0x67543b);
  box(g,3.2,.22,2.7,0x9c7a4b,0,0,0);box(g,2.85,h,2.25,color,0,h/2,0);
  for(const a of [-1.38,1.38])box(g,.12,h+.1,2.28,0x715539,a,h/2,0);
  for(const yy of [.12,h*.52,h])box(g,2.92,.12,2.3,0x796248,0,yy,0);
  box(g,.72,1.6,.07,0x564a35,0,.9,1.16);box(g,.09,.09,.1,0xe6bb68,.22,1,1.23);
  for(const a of [-.92,.92])for(const yy of tall?[1.35,3.1]:[1.65]){
    box(g,.66,.84,.08,0x634e34,a,yy,1.17);glow(g,.43,.58,.09,0xe8c881,a,yy,1.22);
    box(g,.06,.64,.1,0x765e3b,a,yy,1.29);box(g,.48,.06,.1,0x765e3b,a,yy,1.3);
    for(const side of [-1,1]){const shutter=box(g,.21,.74,.06,roofColor,a+side*.4,yy,1.3);shutter.rotation.y=side*.32;}
    box(g,.82,.14,.35,0x98653d,a,yy-.55,1.3);for(let k=0;k<4;k++)box(g,.14,.2,.16,k%2?0x729242:0xc69b5b,a-.28+k*.18,yy-.4,1.37);
  }
  roof(g,3.55,2.85,h+.12,roofColor,snow);
  box(g,.52,1.45,.5,0x8e8d79,-.7,h+1.2,-.5);box(g,.67,.18,.65,0xb4b299,-.7,h+1.95,-.5);
  for(let i=0;i<4;i++)box(g,1.12,.18,.35,0xae8752,0,-.65+i*.18,2.45-i*.32);
  if(sign)plaque(g,sign,0,h-.12,1.4,2.4);
  return g;
}
function walkway(g,from,to,width=1.4){
  const dx=to[0]-from[0],dz=to[2]-from[2],len=Math.hypot(dx,dz),n=Math.ceil(len/.38);
  for(let i=0;i<=n;i++){const t=i/n,x=from[0]+dx*t,z=from[2]+dz*t,y=from[1]+(to[1]-from[1])*t;const plank=box(g,width,.12,.4,i%3?0x9c7b50:0xb49764,x,y,z);plank.rotation.y=Math.atan2(dx,dz);}
  for(const side of [-1,1]){const nx=dz/len*width*.46*side,nz=-dx/len*width*.46*side;
    for(let i=0;i<=4;i++){const t=i/4;rod(g,[from[0]+dx*t+nx,-.5,from[2]+dz*t+nz],[from[0]+dx*t+nx,from[1]+.65,from[2]+dz*t+nz],.07,0x6b573b);}
    rod(g,[from[0]+nx,from[1]+.6,from[2]+nz],[to[0]+nx,to[1]+.6,to[2]+nz],.025,0xc3a36c);
  }
}
function lighthouse(parent,x,y,z,scale,rotors){
  const g=group(parent,x,y,z,scale);
  for(let yy=0;yy<8;yy+=.32){const radius=1.75-yy*.085;for(let xx=-radius;xx<=radius;xx+=.3)for(let zz=-radius;zz<=radius;zz+=.3){const r=Math.hypot(xx,zz);if(r>radius||r<radius-.48)continue;box(g,.32,.33,.32,Math.floor(yy/1.5)%2?0x9a5944:0xd4ceaf,xx,yy+.16,zz);}}
  box(g,.7,1.7,.12,0x4a4d3d,0,.85,1.75);for(const yy of [3,5.6])box(g,.38,.7,.09,0x375450,0,yy,1.8-yy*.085);
  const balcony=new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.5,.23,12),new THREE.MeshStandardMaterial({color:0xa8a487,flatShading:true}));balcony.position.y=8;g.add(balcony);
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2;rod(g,[Math.cos(a)*1.4,8.1,Math.sin(a)*1.4],[Math.cos(a)*1.4,8.75,Math.sin(a)*1.4],.04,0x665a3e);}
  for(const xx of [-.7,.7])for(const zz of [-.7,.7])rod(g,[xx,8,zz],[xx,9.6,zz],.075,0x4d635c);
  glow(g,1.25,1.1,1.25,0xffd588,0,8.8,0);roof(g,2.25,2.25,9.6,0x457771);
  const beam=group(g,0,8.8,0);const cone=new THREE.Mesh(new THREE.ConeGeometry(4.8,32,24,1,true),new THREE.MeshBasicMaterial({color:0xffe3a2,transparent:true,opacity:.012,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));cone.rotation.z=Math.PI/2;cone.position.x=16;beam.add(cone);beam.userData.cone=cone;rotors.push(beam);
  return g;
}
function volcano(parent,x,z,scale,fires,glowing){
  const g=group(parent,x,1.3,z,scale),cell=.4;
  for(let xx=-4.6;xx<=4.6;xx+=cell)for(let zz=-4;zz<=4;zz+=cell){
    const a=Math.atan2(zz,xx),r=Math.hypot(xx,zz*1.12),edge=4.5+Math.sin(a*5)*.25;if(r>edge)continue;
    let top=1+(edge-r)*1.55+Math.sin(xx*5+zz*2)*.14;if(r<1.3)top=5.05;
    top=Math.round(top/cell)*cell;box(g,cell*1.03,top,cell*1.03,Math.floor(xx*13+zz*9)%3?0x50584d:0x6b6a54,xx,top/2,zz);
    if(r>1.2&&r<1.7)box(g,.41,.2,.41,0x8b6b4a,xx,top+.1,zz);
  }
  const lava=glow(g,2.4,.08,2.3,0xff9d48,0,5.35,0);glowing.push(lava);
  for(let i=0;i<20;i++){
    const z=1.15+i*.17,x=.3+Math.sin(i*.31)*.33,h=6.1-i*.265;
    // Overlapping faces form a continuous lava channel down the stepped cone.
    glow(g,.76,.43,.25,0xbb421f,x,h,z);
    glow(g,.30,.44,.25,i%4===0?0xffc36b:0xf98837,x+.06,h+.018,z);
    box(g,.17,.30,.27,0x574b37,x+.44,h-.08,z);
    if(i>8&&i%3===0)glow(g,.18,.18,.28,0xdc592b,x-.42,h-.15,z+.05);
  }
  fires.push({parent:g,local:new THREE.Vector3(0,6,0),volcano:true});return g;
}
function arch(g,x,z,color=0xadb49f){
  for(const side of [-1,1])for(let i=0;i<10;i++)box(g,.65,.42,.7,i%3?color:0x929f8d,x+side*(1.65-Math.max(0,i-6)*.22),1.8+i*.4,z);
  for(let i=0;i<5;i++)box(g,.5,.42,.7,color,x-1+i*.5,5.8+Math.sin(i/4*Math.PI)*.4,z);
}
function iceFang(g,x,z,mirror=1){for(let i=0;i<19;i++){const w=1.7-i*.072;box(g,w,.4,w*.8,i%3?0xc7e1db:0x8dbdbd,x+mirror*(i/19)**2*2,1.5+i*.37,z);}}
function wreck(g,x,z){const hull=group(g,x,.8,z);hull.rotation.set(.12,0,-.22);for(let i=0;i<12;i++){const a=i/11*Math.PI,w=Math.sin(a)*1.5;for(const side of [-1,1])box(hull,.2,1+Math.sin(i)*.3,.48,0x6f6044,side*w,.45,i*.42-2.5);}rod(hull,[0,0,-1],[1.7,5,-1],.12,0x766442);for(let i=0;i<4;i++)rod(hull,[-1.2,0,i-1.8],[1.2,0,i-1.8],.07,0x8f7852);}

function stonePath(parent, from, to, width=1.6, color=0xb3ad8c){
  const length=Math.hypot(to[0]-from[0],to[2]-from[2]),rows=Math.max(1,Math.ceil(length/.46));
  const angle=Math.atan2(to[0]-from[0],to[2]-from[2]),lanes=Math.ceil(width/.43);
  for(let row=0;row<=rows;row++)for(let lane=0;lane<lanes;lane++){
    const t=row/rows,offset=(lane-(lanes-1)/2)*.43;
    const slab=box(parent,.41,.1,.44,row%3===0?0xc8bd99:color,
      from[0]+(to[0]-from[0])*t+Math.cos(angle)*offset,
      from[1]+(to[1]-from[1])*t,
      from[2]+(to[2]-from[2])*t-Math.sin(angle)*offset);
    slab.rotation.y=angle;
  }
}

function dock(parent,x,z,length=5,width=2.1){
  const pier=group(parent,x,0,z);pier.name='muelle-artesanal';
  for(let i=0;i<length/.35;i++)box(pier,width,.16,.33,i%4===0?0xbe9960:0x96704a,0,.96,i*.35);
  for(const side of [-1,1])for(let i=0;i<length;i+=1.8){
    box(pier,.18,2,.18,0x72553b,side*(width/2-.14),.4,i);
    box(pier,.28,.12,.28,0xbc9b66,side*(width/2-.14),1.35,i);
  }
  return pier;
}

function timberStack(parent,x,y,z,scale=1){
  const pile=group(parent,x,y,z,scale);pile.name='madera-del-astillero';
  for(let layer=0;layer<3;layer++)for(let n=0;n<4-layer;n++){
    const timber=box(pile,2.4,.22,.25,(n+layer)%2?0xa18351:0x886d43,0,layer*.24,n*.27-layer*.1);
    timber.rotation.y=layer%2?.16:-.09;
  }
  return pile;
}

function garden(parent,x,y,z,snow=false){
  const bed=group(parent,x,y,z);box(bed,2.4,.18,1.4,snow?0xd3dfd4:0x665637,0,0,0);
  for(const side of [-1,1])box(bed,2.6,.2,.11,0x8c7753,0,.07,side*.75);
  for(let n=0;n<12;n++){const xx=(n%6-2.5)*.36,zz=(Math.floor(n/6)-.5)*.6;box(bed,.22,.27,.2,snow?0x658473:n%3?0x7f983e:0xc5a34d,xx,.18,zz);}
}

function net(parent,x,y,z){
  const rack=group(parent,x,y,z);rack.name='redes-secando';
  for(const side of [-1,1])rod(rack,[side*1.4,0,0],[side*1.4,2.1,0],.07,0x8a714a);
  rod(rack,[-1.4,2.1,0],[1.4,2.1,0],.05,0xb39762);
  for(let column=0;column<10;column++)rod(rack,[-1.25+column*.28,1.95,0],[-1.25+column*.28,.25,Math.sin(column*.8)*.08],.012,0xc5b589,4);
  for(let row=0;row<7;row++)rod(rack,[-1.25,.32+row*.25,0],[1.25,.32+row*.25,0],.012,0xbbaa7c,4);
  for(let n=0;n<5;n++)box(rack,.24,.08,.07,0xd3bf86,-1.12+n*.56,1.96,0);
}

function worker(parent,x,y,z,color,inhabitants,role='fisher'){
  if(!inhabitants)return;
  const p=pirate(parent,x,y,z,color);p.name=`habitante-${role}`;
  if(role==='carpenter')p.userData.repairGear.visible=true;
  if(role==='miner')p.userData.lootGear.visible=true;
  inhabitants.push({object:p,x,y,z,phase:inhabitants.length*.71,stationary:true});
}

function woodenWatchtower(parent,x,y,z,height=8){
  const tower=group(parent,x,y,z);tower.name='atalaya-de-patas-de-palo';
  for(const side of [-1,1])for(const other of [-1,1]){
    rod(tower,[side*1.7,-1.3,other*1.55],[side*1.3,height,other*1.2],.16,0x72583b);
    rod(tower,[side*1.7,.5,other*1.55],[-side*1.5,height*.53,other*1.36],.08,0x9c7c4d);
    rod(tower,[side*1.5,height*.53,other*1.36],[-side*1.3,height-.5,other*1.2],.08,0xa88757);
  }
  for(let level=0;level<3;level++){
    const yy=1.2+level*(height-1.2)/3;box(tower,3.9,.22,3.5,0x9c7a4a,0,yy,0);
    for(const side of [-1,1]){
      box(tower,3.9,.55,.17,0x80643e,0,yy+.35,side*1.67);
      box(tower,.17,.55,3.5,0x856b45,side*1.9,yy+.35,0);
    }
  }
  box(tower,4.1,.22,3.8,0xb59158,0,height-.1,0);
  roof(tower,4.6,4.3,height+1.2,0x8b593a);
  for(const side of [-1,1])rod(tower,[side*1.2,height,1.4],[side*1.2,height+1.1,1.4],.06,0xb6965c);
  for(let step=0;step<14;step++)box(tower,.95,.17,.36,0xa78654,-1.9,step*.41,-1.7+step*.29);
  return tower;
}

function templeEye(parent,x,y,z,glowing){
  const shrine=group(parent,x,y,z);shrine.name='monumento-ojo-del-naufragio';
  for(let step=0;step<4;step++)box(shrine,6.4-step*.65,.31,4.8-step*.5,0x94a594,0,step*.3,0);
  const eye=group(shrine,0,5.7,0);
  for(let n=0;n<28;n++){
    const angle=n/28*Math.PI*2;
    const stone=box(eye,.56,.52,1.08,n%4===0?0xd0c6a3:0x9baa95,Math.cos(angle)*3.35,Math.sin(angle)*2.8,0);
    stone.rotation.z=angle;
  }
  for(const side of [-1,1]){
    box(shrine,1.1,4.3,1.5,0x8c9b8a,side*3,2.8,0);
    box(shrine,.8,.3,1.7,0xb6bba1,side*3,5.02,0);
  }
  const pupil=new THREE.Mesh(new THREE.IcosahedronGeometry(.7,1),new THREE.MeshBasicMaterial({color:0x82e4d0}));
  pupil.position.set(0,5.7,.03);shrine.add(pupil);glowing.push(pupil);
  return shrine;
}

// A working hideout, with one recognisable suspended cask rather than a second port.
function contrabandCask(parent){
  const cask=group(parent);cask.name='tonel-suspendido-sin-recibo';
  const profile=[[-1.95,1.19],[-1.62,1.43],[-.9,1.56],[0,1.62],[.9,1.56],[1.62,1.43],[1.95,1.19]];
  const lathe=new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(0,-1.95),...profile.map(([length,radius])=>new THREE.Vector2(radius,length)),new THREE.Vector2(0,1.95),
  ],16),new THREE.MeshStandardMaterial({color:0xa57a42,roughness:1,flatShading:true}));
  lathe.rotation.z=-Math.PI/2;cask.add(lathe);
  for(let stave=0;stave<16;stave++){
    const angle=(stave+.5)/16*Math.PI*2;
    for(let n=0;n<profile.length-1;n++){
      const [x,r]=profile[n],[nextX,nextR]=profile[n+1];
      rod(cask,[x,Math.cos(angle)*r,Math.sin(angle)*r],[nextX,Math.cos(angle)*nextR,Math.sin(angle)*nextR],.027,stave%3?0x705330:0xcfab69,4);
    }
  }
  for(const [x,radius]of [[-1.6,1.45],[0,1.64],[1.6,1.45]]){
    const band=new THREE.Mesh(new THREE.TorusGeometry(radius,.085,4,16),new THREE.MeshStandardMaterial({color:0x405456,roughness:.75,metalness:.28,flatShading:true}));
    band.rotation.y=Math.PI/2;band.position.x=x;cask.add(band);
    for(let n=0;n<8;n++){const angle=n/8*Math.PI*2;box(cask,.17,.12,.12,0xd0ad64,x,Math.cos(angle)*(radius+.05),Math.sin(angle)*(radius+.05));}
  }
  for(const side of [-1,1]){
    const head=new THREE.Mesh(new THREE.CylinderGeometry(1.19,1.19,.12,16),new THREE.MeshStandardMaterial({color:0x89643a,flatShading:true,roughness:1}));
    head.rotation.z=Math.PI/2;head.position.x=side*1.96;cask.add(head);
    for(let n=0;n<5;n++)box(cask,.14,.035,Math.sqrt(1.17**2-((n-2)*.43)**2)*2,0x5e492f,side*2.025,(n-2)*.43,0);
  }
  return cask;
}

function smugglerShelter(parent,x,y,z,scale=1,sailcloth=false){
  const shelter=group(parent,x,y,z,scale);shelter.name=sailcloth?'refugio-de-la-vela-remendada':'cobertizo-del-fiado';
  for(let n=0;n<9;n++)box(shelter,.43,.15,2.8,n%3?0x977344:0xba955d,(n-4)*.43,0,0);
  for(const side of [-1,1])for(const back of [-1,1]){
    const height=back<0?2.8:1.95;rod(shelter,[side*1.65,-.9,back*1.23],[side*1.65,height,back*1.23],.095,0x66533b);
  }
  for(let n=0;n<10;n++)box(shelter,.33,2.68,.13,n%3?0x7c633e:0xa38753,(n-4.5)*.34,1.38,-1.22);
  for(let n=0;n<5;n++)box(shelter,.12,2.15,.42,n%2?0x82714c:0xa38a5d,-1.68,1.13,(n-2)*.44);
  // A single sloped roof and open front read as a makeshift camp, not a tiled town house.
  for(let n=0;n<11;n++){
    const roof=box(shelter,.38,.12,3.22,sailcloth?(n%3?0xc2a96e:0xd8c391):(n%3?0x846c42:0xa98a52),(n-5)*.35,2.39,0);
    roof.rotation.x=.28;
  }
  rod(shelter,[-1.75,1.98,1.4],[1.75,1.98,1.4],.075,0x6b5736);
  for(const x of [.35,1.03]){box(shelter,.59,.69,.61,0x83623b,x,.43,.3);for(const side of [-1,1])box(shelter,.06,.72,.64,0xb5a170,x+side*.19,.43,.3);}
  box(shelter,1.5,.17,.55,0xa98b58,-.52,.71,-.1);
  box(shelter,.14,.68,.15,0x6b5236,-1.13,.36,-.1);box(shelter,.14,.68,.15,0x6b5236,.12,.36,-.1);
  return shelter;
}

function contrabandHideout(island,detail,inhabitants,animations,lit){
  const cave=group(detail,-5.65,1.65,-3.7);cave.name='cueva-del-contrabando';
  box(cave,4.35,3.7,.17,0x273b32,0,1.88,-1.16);
  for(let row=0;row<8;row++)for(const side of [-1,1]){
    const x=side*(2.72-Math.max(0,row-4)*.16),height=.49;
    for(let depth=0;depth<3;depth++)box(cave,1.16,height,1.1,[0x697c6d,0x899381,0x738373][(row+depth)%3],x,row*.49+.24,-.78+depth*.94);
  }
  for(let n=0;n<7;n++){
    const x=(n-3)*.91,top=4.36-Math.abs(n-3)*.14;
    box(cave,.97,1.15,3.02,n%2?0x778776:0x929883,x,top-.5,.18);
    box(cave,.93,.19,2.82,n%3?0x637e43:0x809246,x,top+.15,.18);
  }
  for(const side of [-1,1])rod(cave,[side*1.82,0,1.29],[side*1.82,3.35,1.29],.12,0x927448);
  box(cave,3.95,.25,.3,0xa48751,0,3.34,1.29);
  box(cave,2.8,.15,2.7,0x9d8351,0,.08,.4);
  for(const [x,z]of [[-1,-.52],[.7,-.7]]){
    box(cave,.87,.82,.86,0x826442,x,.56,z);for(const side of [-1,1])box(cave,.08,.85,.88,0xbda874,x+side*.29,.56,z);
  }
  glow(cave,.48,.51,.14,0xffc674,.17,1.67,-1.03);
  plaque(cave,'SIN RECIBO',0,3.32,1.47,2.8);

  const hoist=group(detail,2.75,1.55,-3.5);hoist.name='horca-del-tonel';
  for(let n=0;n<13;n++)box(hoist,5.9,.16,.35,n%3?0x9e7c46:0xbf9a5b,0,1.35,(n-6)*.35);
  for(const side of [-1,1])for(const end of [-1,1]){
    rod(hoist,[side*2.4,-1.4,end*1.75],[side*2.4,6.45,end*1.75],.17,0x725837);
    rod(hoist,[side*2.4,.5,end*1.75],[-side*2.4,3.1,end*1.75],.075,0xad884b);
    rod(hoist,[side*2.4,4.1,end*1.75],[side*1.1,6.45,end*1.75],.09,0x9d7a42);
    box(hoist,.56,.19,.52,0xc7a16b,side*2.4,1.25,end*1.75);
  }
  for(const end of [-1,1])box(hoist,5.43,.37,.37,0xba9556,0,6.45,end*1.75);
  rod(hoist,[0,6.45,-2],[0,6.45,2],.19,0x97753d);
  const pulley=new THREE.Mesh(new THREE.TorusGeometry(.34,.09,5,12),new THREE.MeshStandardMaterial({color:0x434f47,roughness:.78,flatShading:true}));
  pulley.position.set(0,6.01,.42);hoist.add(pulley);
  const pivot=group(hoist,0,6.0,.4),cargo=group(pivot,0,-.7,0);
  const cask=contrabandCask(cargo);cask.position.y=-1.36;
  for(const side of [-1,1]){
    rod(cargo,[0,.4,0],[side*1.65,-.47,.85],.045,0xd3b87b);
    rod(cargo,[side*1.65,-.47,.85],[side*1.65,-2.52,.95],.045,0xd3b87b);
    rod(cargo,[side*1.65,-2.52,.95],[side*1.65,-2.65,-.91],.045,0xd3b87b);
    rod(cargo,[side*1.65,-2.65,-.91],[side*1.65,-.47,-.85],.045,0xd3b87b);
    rod(cargo,[side*1.65,-.47,-.85],[0,.4,0],.045,0xd3b87b);
  }
  batchPaint(cargo,true);animations.push({object:cargo,kind:'cargo',phase:3.2});
  walkway(detail,[-5.65,1.82,-1.6],[-2.3,2.9,-1.6],1.25);
  walkway(detail,[-2.3,2.9,-1.6],[2.75,2.9,-1.6],1.25);
  walkway(detail,[2.75,2.9,-1.6],[6.2,.95,6.3],1.45);
  walkway(detail,[6.2,.95,6.3],[island.r*.35,1,island.r*.65],1.75);

  smugglerShelter(detail,-7.3,1.76,3.5,.78,true);
  smugglerShelter(detail,9.5,.54,-2.45,.76,false);
  const winch=group(detail,8.1,.4,9.65);winch.name='cabrestante-del-muelle-clandestino';
  box(winch,2.25,.25,1.54,0x987948,0,.12,0);
  for(const side of [-1,1])box(winch,.28,1.18,.42,0x7d623e,side*.8,.7,0);
  const drum=new THREE.Mesh(new THREE.CylinderGeometry(.39,.39,1.46,10),new THREE.MeshStandardMaterial({color:0xaba27a,flatShading:true,roughness:1}));
  drum.rotation.z=Math.PI/2;drum.position.y=1.05;winch.add(drum);
  for(let n=0;n<8;n++){const ring=new THREE.Mesh(new THREE.TorusGeometry(.42,.035,4,10),new THREE.MeshStandardMaterial({color:0xcdb582,roughness:1}));ring.rotation.y=Math.PI/2;ring.position.set((n-3.5)*.14,1.05,0);winch.add(ring);}
  rod(winch,[1,1.05,0],[1,1.6,0],.07,0x776039);rod(winch,[1,1.6,0],[1.37,1.6,0],.075,0xb59660);
  const pier=dock(detail,11.05,7.8,5.4,1.9);pier.name='muelle-clandestino';
  walkway(detail,[6.2,.95,7.5],[11.05,.95,7.8],1.15);
  net(detail,10.8,.45,4.35);
  for(let n=0;n<6;n++){
    const x=7.7+(n%2)*1.08,z=2.7+Math.floor(n/2)*.94;
    box(detail,.87,.77,.81,0x926b3d,x,.68,z);
    for(const side of [-1,1])box(detail,.075,.82,.85,0xc9ab6d,x+side*.29,.68,z);
    rod(detail,[x-.33,.38,z+.44],[x+.33,1,z+.44],.034,0x554c36,4);
    rod(detail,[x+.33,.38,z+.44],[x-.33,1,z+.44],.034,0x554c36,4);
  }
  worker(detail,3.45,2.94,-1.55,0xaa8b49,inhabitants,'miner');
  worker(detail,8.7,.52,8.7,0x537b6d,inhabitants,'carpenter');
  worker(detail,-6.7,1.82,4.75,0xa36f48,inhabitants,'fisher');
  lit(-5.65,1.76,-.56);lit(2.1,2.87,-.9);lit(9.7,.52,7.8);
}

function volcanoDistrict(island,fires,glowing,inhabitants,lamp,central){
  const g=island.group;
  if(central){
    volcano(g,-2.3,-4.4,1.72,fires,glowing).name='caldera-del-abismo';
    const jaw=group(g,3.3,.62,5.3);jaw.name='puerta-de-las-fauces';
    // One continuous stone skull, with an actual opening under its hanging teeth.
    const skullRows=[
      '000001111111111100000',
      '000111111111111111000',
      '001111111111111111100',
      '011111111111111111110',
      '111100001111100001111',
      '111000000111000000111',
      '111000000111000000111',
      '111100001101100001111',
      '011111111000111111110',
      '001111111000111111100',
      '001111111111111111100',
      '000111010101010111000',
      '000111000000000111000',
      '000111000000000111000',
      '000111000000000111000',
    ];
    skullRows.forEach((row,y)=>[...row].forEach((cell,x)=>{
      if(cell!=='1')return;
      const color=(x+y)%7===0?0xc8bba0:(x+y)%3===0?0xa79d86:0xb7ab92;
      const block=box(jaw,.47,.45,.72,color,(x-10)*.45,(skullRows.length-1-y)*.44,0);
      if(y<4)block.position.z=-.12;
    }));
    for(const side of [-1,1]){
      box(jaw,1.6,.37,2.2,0x817967,side*2.05,-.2,0);
      box(jaw,1.82,1.33,.08,0x363f36,side*2.45,3.85,-.39);
      glow(jaw,.48,.51,.1,0xd88339,side*2.45,3.78,-.31);
    }
    box(jaw,.65,.66,.06,0x394036,0,2.63,-.39);
    stonePath(g,[3.3,.65,7.4],[island.r*.35,.94,island.r*.65],2.1,0x80735f);
    wreck(g,10.1,4.6);timberStack(g,7,.6,8,.65);
    if(lamp){lamp(g,-.7,.55,7.8);lamp(g,6.8,.55,7.9);}
  }else{
    volcano(g,-4.4,-3.8,1.2,fires,glowing).name='caldera-mayor';
    volcano(g,3.4,-4.6,.85,fires,glowing).name='caldera-menor';
    const mine=group(g,-8.8,1.8,3.1);mine.name='mina-del-diablo';
    box(mine,3.4,2.4,.65,0x514e41,0,1,0);box(mine,1.85,2.2,.7,0x202f2b,0,.9,.4);
    for(const side of [-1,1])box(mine,.38,2.5,.6,0x806d43,side*1.06,1,.68);
    box(mine,2.65,.38,.55,0x9a8150,0,2.18,.73);
    house(g,7.1,1.65,1.1,{scale:.88,roofColor:0x70644b,color:0x968d72,sign:'CASI SEGURO'});
    house(g,10.4,.6,5.1,{scale:.55,roofColor:0xa86b42,color:0xb4a17b});
    walkway(g,[-7.6,1.5,5.2],[7.1,.78,5.2],1.8);
    for(const side of [-1,1])rod(g,[-8.4+side*.5,1.77,3.8],[-5.2+side*.5,1.58,7.6],.035,0x70766c);
    const cart=group(g,-6.8,1.58,5.8);box(cart,.9,.4,1.1,0x685b40,0,.25,0);box(cart,.74,.25,.94,0x5c6250,0,.59,0);
    for(const side of [-1,1])for(const z of [-.34,.34]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,.08,8),new THREE.MeshStandardMaterial({color:0x384139}));wheel.rotation.z=Math.PI/2;wheel.position.set(side*.5,.03,z);cart.add(wheel);}
    garden(g,9.4,.48,8.1);worker(g,-5.3,1.5,5.8,0x8b6f42,inhabitants,'miner');worker(g,7.6,.58,4.8,0xa37543,inhabitants,'carpenter');
    if(lamp){lamp(g,-7.4,1.6,4.1);lamp(g,6.4,.6,5.1);lamp(g,10.8,.5,8.4);}
  }
}

export const islandArtIdentity=Object.freeze({
  'blue-home':'El puerto del primer fiado',
  'red-home':'La ciudadela del diente roto',
  'blue-cove':'El escondite del tonel sin recibo',
  'red-cove':'El pueblo de la última ronda',
  'west-ruins':'El ancla de los desaparecidos',
  'east-ruins':'El ojo que mira el naufragio',
  'south-volcano':'Las dos calderas y la mina',
  'north-snow':'Los colmillos y el refugio',
  'west-fort':'La muralla del mal aliento',
  'east-fort':'Las patas de madera',
  'central-caldera':'Las fauces del abismo',
});

export function addLandmarks(islands,fires,glowing,{inhabitants,animations=[],lamp}={}){
  const rotors=[];
  for(const island of islands){
    const g=island.group,id=island.id??Object.keys(islandArtIdentity).find(key=>key==='blue-home'&&island.type==='port');
    island.artIdentity=islandArtIdentity[id]??island.name;
    const detail=group(g);detail.name='distrito-'+(id??island.biome);
    island.landmarkDistrict=detail;
    const lit=(x,y,z,blue=false)=>lamp?.(detail,x,y,z,blue);

    if(id==='blue-home'||island.type==='port'){
      house(detail,-3.1,2,-1.6,{scale:1.15,roofColor:0x4c8791,color:0xddd0a0,sign:'RON RON',tall:true});
      house(detail,.55,1.5,-2,{scale:.87,roofColor:0x955445,color:0xbbc4a4});
      house(detail,3.7,1.2,.2,{scale:.8,roofColor:0x688a5f,color:0xe0c78e,sign:'ASTILLERO'});
      walkway(detail,[-4,1.3,2.9],[4.8,1.3,2.9],1.7);
      walkway(detail,[2.8,1.3,3],[2.8,1.05,6.3],1.7);
      lighthouse(detail,-7.6,1.9,-1.8,.8,rotors).name='faro-de-ron-ron';
      for(const [x,z,scale,roofColor,sign] of [[-8,-6,1,0x668756,'CARTAS'],[-1,-7,1.1,0x9e5944,'EL ANCLA'],[6,-6,.95,0x416a84,'BAZAR'],[10,-.8,.85,0x987248,'RON AL PESO']]){
        house(detail,x,1.8,z,{scale,roofColor,color:0xd1c494,sign,tall:x===-1});
      }
      walkway(detail,[-8,1.4,1],[8,1.4,1],1.6);
      walkway(detail,[6,1.4,1],[6,1.4,-5],1.3);
      for(let n=0;n<7;n++){
        const z=3+n*.4;
        box(detail,.15,1.4,.18,0x80613d,10,1.2,z);
        box(detail,.15,1.4,.18,0x80613d,13,1.2,z);
        rod(detail,[10,1.8,z],[13,1.8,z],.07,0xa58c5b);
      }
      plaque(detail,'DIQUE SECO',11.5,2.4,3,2.8);
      timberStack(detail,11.5,1.4,5);
      garden(detail,-10,1.8,-3.4);
      lit(5.1,1.4,1);lit(-3.2,1.9,-5.2);lit(9.5,1.2,2.7);

    }else if(id==='blue-cove'){
      contrabandHideout(island,detail,inhabitants,animations,lit);

    }else if(id==='red-cove'){
      house(detail,-2.2,1.9,-2.8,{scale:1.6,color:0xd6bb85,roofColor:0xa75c42,sign:'LA ÚLTIMA RONDA',tall:true}).name='taberna-de-las-malas-decisiones';
      house(detail,5.6,.48,-.6,{scale:.88,roofColor:0xb88a49,color:0xd3b484});
      house(detail,-8.1,1.8,2.5,{scale:.77,roofColor:0x6e8959,color:0xb5bf91});
      house(detail,9.2,.48,4.7,{scale:.64,roofColor:0x8e5442,color:0xd0be91});
      const famousBarrel=group(detail,6.8,1.85,-5.8);famousBarrel.name='el-tonel-de-la-ultima-ronda';
      box(famousBarrel,4.9,.45,4.4,0x9b9376,0,0,0);
      const barrelProfile=[[0,0],[1.65,0],[1.9,.8],[2.03,2.15],[1.9,3.5],[1.65,4.3],[0,4.3]].map(([x,y])=>new THREE.Vector2(x,y));
      const vat=new THREE.Mesh(new THREE.LatheGeometry(barrelProfile,16),new THREE.MeshStandardMaterial({color:0x9a7341,flatShading:true,roughness:1}));
      vat.position.y=.2;famousBarrel.add(vat);
      for(let n=0;n<16;n++){
        const angle=n/16*Math.PI*2;
        for(const [from,to] of [[.2,1],[1,2.35],[2.35,3.7],[3.7,4.5]]){
          const radius=y=>y<1?1.65+(y-.2)*.31:y<2.35?1.9+(y-1)*.096:y<3.7?2.03-(y-2.35)*.096:1.9-(y-3.7)*.31;
          rod(famousBarrel,[Math.cos(angle)*radius(from),from,Math.sin(angle)*radius(from)],[Math.cos(angle)*radius(to),to,Math.sin(angle)*radius(to)],.025,n%3?0xb39760:0x745d39,4);
        }
      }
      for(const [y,radius] of [[.7,1.85],[1.6,2],[3.1,2],[4.15,1.81]]){
        const hoop=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,.17,16,1,true),new THREE.MeshStandardMaterial({color:0x53645c,roughness:.75,metalness:.35}));
        hoop.position.y=y;famousBarrel.add(hoop);
      }
      box(famousBarrel,.55,.27,.62,0xc1a265,0,1.35,1.91);
      rod(famousBarrel,[0,1.32,1.65],[0,1.32,2.4],.12,0xbb9656);
      rod(famousBarrel,[0,1.32,2.4],[0,.98,2.4],.12,0xa58350);
      box(famousBarrel,.53,.3,.16,0xd8b16c,0,1.67,2.18);
      for(const side of [-1,1])rod(famousBarrel,[side*2.35,.2,0],[side*2.35,4.75,0],.065,0x826b42);
      roof(famousBarrel,5.1,4.2,4.75,0x5d807b);
      plaque(famousBarrel,'UNA RONDA MÁS',0,3.06,2.12,2.9);
      stonePath(detail,[-8.1,1.9,5.1],[-1.9,1.8,3.2],1.8);
      stonePath(detail,[-1.9,1.8,3.2],[5.6,.55,4.1],2);
      walkway(detail,[5.6,.9,4.1],[island.r*.35,1,island.r*.65],1.8);
      const still=group(detail,4.6,.4,6.8);still.name='destileria-de-ron';
      const boiler=new THREE.Mesh(new THREE.CylinderGeometry(.9,.7,1.5,10),new THREE.MeshStandardMaterial({color:0xab794b,roughness:.62,metalness:.3}));
      boiler.position.y=.75;still.add(boiler);
      box(still,2,.16,2,0x6b6850,0,-.04,0);
      rod(still,[0,1.4,0],[0,2.7,0],.16,0xb39459);
      rod(still,[0,2.7,0],[1.6,2.7,0],.12,0xc09b63);
      rod(still,[1.6,2.7,0],[1.6,.7,0],.1,0xaf8851);
      for(let n=0;n<5;n++)box(still,.55,.9,.55,0x927345,2.7,.45,n*.66-1.3);
      for(let n=0;n<4;n++){
        const table=group(detail,-3+n*2.1,.72,6.1+(n%2)*1.4);
        box(table,1.25,.16,.85,0xb18c55,0,1,0);
        for(const side of [-1,1])box(table,.18,.9,.58,0x86643e,side*.48,.5,0);
        box(table,.2,.25,.2,0xa28c60,0,1.17,0);
      }
      garden(detail,-7.8,1.8,-1);
      worker(detail,.4,.64,6.5,0xc08648,inhabitants,'publican');
      worker(detail,5.8,.44,7.5,0x7c6b49,inhabitants,'distiller');
      lit(-3.2,1.8,2.4);lit(4.5,.5,3.2);lit(8.7,.4,7.7);

    }else if(id==='west-ruins'){
      const anchor=group(detail,-4,2.1,-3.3);anchor.name='ancla-de-los-desaparecidos';
      for(let n=0;n<3;n++)box(anchor,4.4-n*.5,.42,3.7-n*.4,0xaeb59c,0,n*.4,0);
      rod(anchor,[0,1,0],[0,8.1,0],.35,0x92a38e);
      rod(anchor,[-2.2,6.1,0],[2.2,6.1,0],.24,0xb4bda0);
      for(const side of [-1,1])for(let n=0;n<10;n++)box(anchor,.43,.45,.54,n%3?0x9aae98:0xc3c5a7,side*n*.32,1.7+(n/9)**2*2.4,0);
      const ring=new THREE.Mesh(new THREE.TorusGeometry(.78,.19,6,16),new THREE.MeshStandardMaterial({color:0xb5bba0,flatShading:true}));
      ring.position.y=8.45;anchor.add(ring);
      const colonnade=group(detail,4.9,1.8,-3.3);colonnade.name='biblioteca-sumergida';
      for(let n=0;n<4;n++){
        const h=n===2?1.8:4.6;
        box(colonnade,1.15,.35,1.2,0xb3c1a9,n*1.6-2.4,0,0);
        for(let k=0;k<h/.4;k++)box(colonnade,.65,.4,.7,k%3?0x93aa99:0xc0c6ab,n*1.6-2.4,k*.4+.2,0);
        if(n!==2)box(colonnade,1.3,.3,1.3,0xb7c0a5,n*1.6-2.4,h+.3,0);
      }
      box(colonnade,3,.42,1.2,0xb0baa0,-1.5,5.05,0);
      arch(detail,-7.9,2.8,0xa3b5a0);
      stonePath(detail,[-3,1.9,2.1],[4.2,.55,4.8],2);
      dock(detail,8.6,7.5,5.2);
      wreck(detail,10.9,2.5);
      net(detail,6.3,.35,6.6);
      house(detail,-10.3,1.8,-2,{scale:.68,roofColor:0x5d8980,color:0x9aaf9c});
      lit(-7.5,1.8,5.3,true);lit(4.2,.5,5.1,true);
      worker(detail,6.4,.4,8.1,0x70877c,inhabitants,'archaeologist');

    }else if(id==='east-ruins'){
      templeEye(detail,-3.3,1.9,-3.1,glowing);
      const amphitheater=group(detail,-2.1,1.9,3.5);amphitheater.name='gradas-del-naufragio';
      for(let row=0;row<4;row++)for(let n=0;n<11;n++){
        const angle=Math.PI*.05+n/10*Math.PI*.92;
        box(amphitheater,.67,.33,.7,row%2?0xaab5a0:0x91a996,Math.cos(angle)*(3.4+row*.6),row*.34,Math.sin(angle)*(3.4+row*.6));
      }
      for(const [x,z,h] of [[-10,-1,3.1],[7,-4,5.2],[10,1,2.4]]){
        box(detail,1.1,h,1.1,0x8ca390,x,1.8+h*.5,z);
        box(detail,1.4,.3,1.4,0xc2c5a9,x,1.9+h,z);
      }
      stonePath(detail,[1.9,1.4,4.1],[6.1,.55,7.3],1.8);
      dock(detail,10.5,6.1,6.6,2.5);
      wreck(detail,8.9,1.2);
      house(detail,-9.5,1.8,4.2,{scale:.67,roofColor:0x507c75,color:0xa1b39c});
      lit(-5.9,1.8,1.4,true);lit(.1,1.8,1.4,true);lit(6.1,.5,7.1,true);
      worker(detail,5.5,.55,6,0x66877b,inhabitants,'archaeologist');

    }else if(id==='south-volcano'||id==='central-caldera'||island.biome==='volcano'){
      volcanoDistrict({...island,group:detail},fires,glowing,inhabitants,
        (parent,x,y,z)=>lamp?.(parent,x,y,z),id==='central-caldera');

    }else if(id==='north-snow'||island.biome==='snow'){
      iceFang(detail,-5.2,-4.9,1);iceFang(detail,1.4,-5.8,-1);
      lighthouse(detail,6.4,1.9,-4.6,.7,rotors).name='faro-del-ultimo-calor';
      house(detail,-3.6,1.9,1.4,{scale:1.12,roofColor:0x506f71,color:0x899f96,snow:true,sign:'REFUGIO'});
      house(detail,4.4,.55,1.3,{scale:.79,roofColor:0x668487,color:0xb0bca6,snow:true,sign:'CALDO Y RON'});
      house(detail,8.9,.35,5.6,{scale:.58,snow:true,color:0xa1b4a8});
      stonePath(detail,[-3.6,1.8,4.6],[4.4,.61,4.1],1.9,0xb0c4b8);
      walkway(detail,[4.4,.88,4.1],[island.r*.35,1,island.r*.65],1.7);
      for(const [x,z] of [[-10,-3],[-9,3],[-3,-8],[8,-1]]){
        for(let row=0;row<6;row++){
          const w=2.8-row*.39;
          box(detail,w,.38,w*.7,0x527768,x,2.6+row*.55,z);
          box(detail,w*.98,.13,w*.68,0xe4eee2,x,2.84+row*.55,z);
        }
        rod(detail,[x,1.8,z],[x,5.3,z],.1,0x726d56);
      }
      net(detail,10.5,.35,7.3);
      const boat=wreck(detail,11.4,3.2); // Fishing skiff pulled out of the ice.
      garden(detail,-6,1.8,4.6,true);
      worker(detail,5.2,.55,5.4,0x557d80,inhabitants,'fisher');
      lit(-2.8,1.8,4.7);lit(4.6,.5,4.8);lit(9.4,.4,8.3);

    }else if(id==='west-fort'){
      const gate=group(detail,-4.8,1.9,4.1);gate.name='puerta-del-mal-aliento';
      for(const side of [-1,1]){
        for(let row=0;row<9;row++)box(gate,1.7,.46,1.5,row%3?0x919c86:0xb2b59a,side*2.2,row*.44,0);
        for(let n=0;n<3;n++)box(gate,.46,.65,.55,0xc0c1a0,side*2.2+(n-1)*.57,4.18,.5);
      }
      box(gate,4.4,.45,1.1,0xc3bda0,0,3.5,0);
      for(let n=0;n<6;n++)box(gate,.29,.58,.32,0xafa98a,(n-2.5)*.5,3.03,.32);
      plaque(gate,'MAL ALIENTO',0,4.13,.59,3.5);
      house(detail,6.1,1.7,-3.5,{scale:1.15,roofColor:0xa75c47,color:0xc8bd91,sign:'CAPITANÍA',tall:true});
      house(detail,-9.9,1.8,-4.8,{scale:.83,roofColor:0x6e8558,color:0xbbbc93});
      for(let n=0;n<14;n++){
        const x=-10+n*.83;
        box(detail,.86,1.5,.75,0x97a088,x,2.43,-7.2);
        if(n%2===0)box(detail,.45,.55,.79,0xbdc1a0,x,3.46,-7.2);
      }
      stonePath(detail,[-4.8,1.8,5.5],[6.1,.62,5.5],2.2);
      walkway(detail,[6.1,.95,5.5],[island.r*.35,1,island.r*.65],2.1);
      wreck(detail,-11.3,5.7);
      timberStack(detail,9.3,.43,7.9);
      worker(detail,5.3,.5,7.2,0x657646,inhabitants,'sentry');
      lit(-7.5,1.8,5.6);lit(-2,1.8,5.6);lit(8.8,.4,7.6);

    }else if(id==='east-fort'){
      g.getObjectByName('fortaleza-base')?.removeFromParent();
      woodenWatchtower(detail,-1.1,1.8,-3.3,8.6);
      for(const [x,z,angle] of [[-7.2,1,-.13],[6.9,-1,.18]]){
        const hut=house(detail,x,3.3,z,{scale:1,roofColor:0x936c43,color:0xa39570,sign:x<0?'OBSERVATORIO':'GUARDIA'});
        hut.rotation.y=angle;
        for(const side of [-1,1])rod(detail,[x+side*1.2,.1,z],[x+side*1.2,3.35,z],.14,0x6f5639);
      }
      walkway(detail,[-7.2,3.3,3.7],[.3,3.3,2.5],1.4);
      walkway(detail,[.3,3.3,2.5],[6.9,3.3,1.7],1.4);
      for(let n=0;n<26;n++){
        const angle=-Math.PI*.07+n/25*Math.PI*.99;
        const x=Math.cos(angle)*10.8,z=-2.8+Math.sin(angle)*8;
        const post=box(detail,.44,2.7,.47,n%3?0x896c42:0xa88b53,x,2.5,z);
        post.rotation.y=angle;
        const cap=new THREE.Mesh(new THREE.ConeGeometry(.33,.62,4),new THREE.MeshStandardMaterial({color:0xb49a66}));
        cap.position.set(x,4.15,z);cap.rotation.y=Math.PI/4;detail.add(cap);
      }
      timberStack(detail,8.4,.5,7.9,1.2);
      timberStack(detail,10,.5,5.8,.8);
      stonePath(detail,[1.9,1.8,5.2],[island.r*.35,.95,island.r*.65],1.9);
      worker(detail,6.9,.6,8.6,0xb08b4f,inhabitants,'carpenter');
      lit(-6.1,3.3,3.4);lit(6.1,3.3,2.4);lit(8.7,.4,9.4);

    }else if(id==='red-home'){
      const bastion=group(detail,5.8,1.8,-3.8);bastion.name='ciudadela-del-diente-roto';
      house(bastion,0,0,0,{scale:1.4,roofColor:0x8e4236,color:0xafab92,sign:'CORSARIOS',tall:true});
      for(const side of [-1,1]){
        const tower=group(detail,side*10.4,1.8,-4.7);
        for(let n=0;n<11;n++)box(tower,3.25,.43,3.25,n%3?0x8d9586:0xb1b29a,0,n*.42,0);
        roof(tower,3.7,3.7,5.1,0x8b4938);
        for(const other of [-1,1])rod(tower,[other*.85,3.2,1.4],[other*.85,3.2,3.1],.22,0x35463f);
      }
      for(let n=0;n<21;n++){
        const x=-10+n;
        box(detail,1.03,2.1,.83,0x939a86,x,2.85,-7.8);
        if(n%2===0)box(detail,.5,.58,.92,0xbec0a2,x,4.2,-7.8);
      }
      house(detail,-7.4,1.8,.8,{scale:1.07,roofColor:0x9d4d3e,color:0xc4b590,sign:'RECIBOS'});
      house(detail,11.4,.6,3.5,{scale:.82,roofColor:0x7e6752,color:0xaea58c});
      stonePath(detail,[-7.4,1.8,4.2],[6.9,.58,5.1],2.1);
      walkway(detail,[6.9,.95,5.1],[island.r*.35,1,island.r*.65],2.3);
      dock(detail,12.3,8.6,7,2.6);
      timberStack(detail,12.2,.5,5.6,.9);
      worker(detail,-5.6,1.8,4.3,0xa4533d,inhabitants,'officer');
      worker(detail,10.3,.5,7.8,0x9b7150,inhabitants,'carpenter');
      lit(-7.4,1.8,4.1);lit(6.9,.5,5.2);lit(12.2,.4,10.4);
    }
  }
  return {update(time,night){
    rotors.forEach((rotor,index)=>{
      rotor.rotation.y=time*.27+index;
      rotor.userData.cone.material.opacity=night?.11:.009;
    });
  }};
}
