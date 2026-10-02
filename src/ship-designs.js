import * as THREE from 'three';
import {box,rod,mesh,pirate,chest,palette} from './world.js';

const designs={
 corsair:{frames:[[-8,.03],[-6.4,.82],[-4,1.6],[-1.5,1.85],[1,1.9],[3.7,1.6],[5.8,1.12]],masts:[[-2.7,11.8,6.6],[2.4,10.2,5.8]],guns:4,wood:0xa27343,lateen:true,sailRatio:.59},
 brig:{frames:[[-7,.04],[-5.7,1.1],[-4,1.9],[-2,2.25],[0,2.35],[2.6,2.2],[4.4,1.8],[5.5,1.35]],masts:[[-2.6,10,5.4],[2.1,11.5,6]],guns:4,wood:0x805333},
 galleon:{frames:[[-9,.05],[-7.3,1.4],[-5,2.6],[-2.5,2.95],[0,3.05],[3,2.9],[5.5,2.6],[7.4,2.2]],masts:[[-4.8,11.5,6],[0,14,7.6],[4.5,11,5]],guns:6,wood:0x653d2c},
 cutter:{frames:[[-6.5,.03],[-5,1],[-3,1.65],[0,1.85],[2.5,1.6],[4.5,.95]],masts:[[0,9.5,7]],guns:2,wood:0xa07d4c,lateen:true},
 scout:{frames:[[-7.4,.03],[-5.8,.65],[-3.5,1.2],[0,1.45],[2.8,1.3],[4.4,.7]],masts:[[-1,10.8,6.4]],guns:0,wood:0x99794b,sailRatio:.53},
 guard:{frames:[[-5.8,.06],[-4.2,1.1],[-2.3,2.25],[0,2.3],[2.5,1.95],[4.1,1.6]],masts:[[.8,11,6.8]],guns:2,wood:0x795235,sailRatio:.49},
};

// The barycentric flex envelope vanishes on every edge: a gust never detaches a corner.
export function triangularSailGeometry(anchors, subdivisions=18, billow=.62){
 const [a,b,c]=anchors.map(p=>new THREE.Vector3(...p));
 const normal=new THREE.Vector3().crossVectors(b.clone().sub(a),c.clone().sub(a)).normalize();
 if(normal.x<0||(Math.abs(normal.x)<.5&&normal.z<0))normal.negate();
 const positions=[],uvs=[],flex=[],normals=[],indices=[],rows=[];
 for(let row=0;row<=subdivisions;row++){
  rows[row]=[];
  for(let column=0;column<=subdivisions-row;column++){
   const beta=column/subdivisions,gamma=row/subdivisions,alpha=1-beta-gamma;
   const pinned=Math.max(0,27*alpha*beta*gamma),p=a.clone().multiplyScalar(alpha).addScaledVector(b,beta).addScaledVector(c,gamma).addScaledVector(normal,billow*pinned);
   rows[row][column]=positions.length/3;positions.push(p.x,p.y,p.z);uvs.push(beta,gamma);flex.push(pinned);normals.push(normal.x,normal.y,normal.z);
  }
 }
 for(let row=0;row<subdivisions;row++)for(let column=0;column<subdivisions-row;column++){
  const first=rows[row][column],second=rows[row][column+1],third=rows[row+1][column];indices.push(first,second,third);
  if(column<subdivisions-row-1)indices.push(second,rows[row+1][column+1],third);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setAttribute('sailFlex',new THREE.Float32BufferAttribute(flex,1));geometry.setAttribute('sailNormal',new THREE.Float32BufferAttribute(normals,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.userData.anchors=anchors.map(p=>[...p]);return geometry;
}

function cloth(body,width,height,y,z,lateen){
 const rig=new THREE.Group();rig.position.set(0,y,z);rig.userData.sailKind=lateen?'lateen':'square';body.add(rig);
 const geometry=lateen?triangularSailGeometry([[-width*.5,height*.5,0],[width*.5,-height*.5,0],[-width*.5,-height*.5,0]],18,.58):new THREE.PlaneGeometry(width,height,16,14);
 if(!lateen){const p=geometry.attributes.position,uv=geometry.attributes.uv,flex=[],normal=[];for(let i=0;i<p.count;i++){const u=uv.getX(i),v=uv.getY(i),pinned=Math.sin(u*Math.PI)*Math.sin(v*Math.PI);p.setXYZ(i,p.getX(i)*(.8+.2*v),p.getY(i),pinned*.95);flex.push(pinned);normal.push(0,0,1);}geometry.setAttribute('sailFlex',new THREE.Float32BufferAttribute(flex,1));geometry.setAttribute('sailNormal',new THREE.Float32BufferAttribute(normal,3));geometry.computeVertexNormals();}
 const sail=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0xf4e8c5,side:THREE.DoubleSide,roughness:1}));sail.castShadow=true;rig.add(sail);rig.userData.cloth=sail;
 if(lateen)rod(rig,[-width/2,height/2,0],[width/2,-height/2,0],.075,0x806545);
 else{rod(rig,[-width/2,height/2,0],[width/2,height/2,0],.08,0x81603c);rod(rig,[-width*.4,-height/2,0],[width*.4,-height/2,0],.05,0xa0885d);for(let n=1;n<6;n++){const x=(n/6-.5)*width;rod(rig,[x*.8,-height/2,0],[x,height/2,0],.013,0xbba87a);}}
 return rig;
}

function foresail(body,d,bow){
 const [mastZ,mastHeight]=d.masts[0],head=[0,mastHeight*.89,mastZ-.08],tack=[0,3.1,bow-2.1],clew=[0,2.85,mastZ-.38];
 const rig=new THREE.Group();body.add(rig);rig.userData.fixedRig=true;rig.userData.sailKind='jib';rig.name='foque-anclado';
 const cloth=new THREE.Mesh(triangularSailGeometry([head,tack,clew]),new THREE.MeshStandardMaterial({color:0xf4e8c5,side:THREE.DoubleSide,roughness:1}));cloth.castShadow=true;rig.add(cloth);rig.userData.cloth=cloth;rig.userData.anchors=[head,tack,clew];
 rod(rig,head,tack,.022,0xbda87d);rod(rig,tack,clew,.018,0xbda87d);rod(rig,clew,head,.018,0xd4c299);
 for(const side of [-1,1])rod(rig,clew,[side*.68,1.88,mastZ+.7],.018,0xa78e61);
 box(body,.12,.09,.38,0xb38a4e,-.68,1.94,mastZ+.7);box(body,.12,.09,.38,0xb38a4e,.68,1.94,mastZ+.7);
 return rig;
}
export function createShip(team='blue',size=1,variant='brig'){
 const d=designs[variant]??designs.brig,g=new THREE.Group(),body=new THREE.Group();g.add(body);const color=team==='red'?0x943e32:0x2f7487;
 const frames=d.frames,bands=[[-.6,.3],[0,.62],[.65,.9],[1.2,1],[1.75,1]],vertices=[],indices=[],colors=[];
 bands.forEach(([y,k],level)=>frames.forEach(([z,w])=>{for(const side of [-1,1]){vertices.push(side*w*k,y+(z<-5?.18:0),z);const c=new THREE.Color(level%2?d.wood:0x473727);colors.push(c.r,c.g,c.b);}}));
 const stride=frames.length*2;
 for(let l=0;l<bands.length-1;l++)for(let j=0;j<frames.length-1;j++)for(let side=0;side<2;side++){const a=l*stride+j*2+side,b=a+2,c=a+stride,e=b+stride;indices.push(a,b,c,b,e,c);}
 for(let l=0;l<bands.length-1;l++){const a=l*stride+stride-2;indices.push(a,a+1,a+stride,a+1,a+stride+1,a+stride);}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.8}),body);
 const widthAt=z=>{let n=frames.findIndex(f=>f[0]>=z);if(n<0)n=frames.length-1;else if(n===0)n=1;const [a,w]=frames[n-1],[b,v]=frames[n];return THREE.MathUtils.lerp(w,v,THREE.MathUtils.clamp((z-a)/(b-a),0,1));};
 const deck=new THREE.Shape();frames.forEach(([z,w],i)=>i?deck.lineTo(w,z):deck.moveTo(w,z));[...frames].reverse().forEach(([z,w])=>deck.lineTo(-w,z));deck.closePath();const platform=mesh(new THREE.ShapeGeometry(deck),new THREE.MeshStandardMaterial({color:0xbc955d,side:THREE.DoubleSide,roughness:1}),body,0,1.78,0);platform.rotation.x=Math.PI/2;
 const bow=frames[0][0],stern=frames.at(-1)[0];
 for(let z=bow+.7;z<stern;z+=.34){const w=widthAt(z);box(body,w*1.94,.025,.025,0x836141,0,1.81,z);for(const side of [-1,1]){box(body,.08,.2,.36,color,side*w,.9,z);if(Math.round(z*3)%2===0){box(body,.1,.1,.09,0xd3b26d,side*(w+.02),1.3,z);rod(body,[side*w,1.82,z],[side*w,2.18,z],.045,0xc2a164);}}}
 for(const side of [-1,1])for(let j=0;j<frames.length-1;j++){const [z,w]=frames[j],[nz,nw]=frames[j+1];for(const y of [.62,1.37,2.16])rod(body,[side*w,y,z],[side*nw,y,nz],y===2.16?.08:.045,palette.gold);}
 const cannons=[];
 for(const side of [-1,1])for(let n=0;n<d.guns;n++){const z=(n-(d.guns-1)/2)*1.3,w=widthAt(z);box(body,.2,.35,.55,0x443b2b,side*(w-.12),1.61,z);const cannon=new THREE.Group();cannon.position.set(side*(w+.06),1.93,z);cannon.userData={side,baseX:side*(w+.06),recoil:0};body.add(cannon);const barrel=mesh(new THREE.CylinderGeometry(.15,.23,.9,10),0x313b3c,cannon);barrel.rotation.z=Math.PI/2;mesh(new THREE.TorusGeometry(.155,.04,5,10),0x8e8b67,cannon,side*.46,0,0).rotation.y=Math.PI/2;cannons.push(cannon);}
 const sails=[],flags=[],crew=[],cargo=new THREE.Group(),oars=[];body.add(cargo);
 for(const [z,h,w] of d.masts){rod(body,[0,1.8,z],[0,h,z],.1,0x886744);sails.push(cloth(body,w,h*(d.sailRatio??(d.lateen?.55:.39)),h*.61,z-.08,d.lateen));if(!d.lateen&&h>10&&!['scout','guard'].includes(variant))sails.push(cloth(body,w*.58,2.2,h-.9,z-.08,false));
   const flag=mesh(new THREE.PlaneGeometry(2,.6,10,2),new THREE.MeshStandardMaterial({color,side:THREE.DoubleSide}),body,.95,h-.15,z);flags.push(flag);
   for(const side of [-1,1])for(const dz of [-1.7,1.7])rod(body,[0,h-.8,z],[side*widthAt(z)*.9,1.85,z+dz],.014,0x9d8b5a);
 }
 rod(body,[0,1.8,bow+.8],[0,3.1,bow-2.1],.095,0x95734b);
 sails.push(foresail(body,d,bow));
 if(variant==='corsair'){
  // Low quarterdeck, swept spars and a brass prow keep the raider recognisable at tactical zoom.
  box(body,2.1,.65,1.75,0x174657,0,2.1,4.35);box(body,2.3,.13,1.9,0xd8b376,0,2.48,4.35);
  for(const side of [-1,1]){
   rod(body,[side*.26,2.1,bow+.65],[side*.22,3.05,bow-1.5],.09,0xf0cb76);
   for(let n=0;n<4;n++)box(body,.19,.25,.07,0xffda8f,side*(.26+n*.18),2.15,5.27);
   rod(body,[side*1.04,2.5,3.7],[side*1.04,2.86,5.1],.055,0xe6bd6c);
  }
  rod(body,[0,2.9,bow-1.3],[0,3.7,bow-1.8],.12,0xe8ba64);
 }else if(variant==='galleon'){
  for(let l=0;l<3;l++){box(body,4.4-l*.35,1,2.9-l*.24,l%2?0x603d2e:0x7b4f33,0,2.25+l,5.6);box(body,4.55-l*.33,.15,3.05-l*.22,0xc7a363,0,2.8+l,5.6);for(let n=0;n<7;n++){const x=(n-3)*.5;const window=box(body,.27,.43,.04,0xffc677,x,2.2+l,7.1-l*.1);window.material=new THREE.MeshBasicMaterial({color:0xe8b76b});box(body,.035,.48,.07,0x80612e,x,2.2+l,7.14-l*.1);}}
  for(const side of [-1,1])for(let z=4;z<7.2;z+=.35)rod(body,[side*2.05,4.85,z],[side*2.05,5.3,z],.04,0xdcbd74);
  for(let n=0;n<8;n++)box(body,.65,.16,.31,0xb89458,0,1.8+n*.3,3.25+n*.23);
  rod(body,[0,2.4,bow],[0,4.2,bow-1.4],.16,0xd9b968);box(body,.6,.38,.5,0xebce84,0,4.1,bow-1.55);
 }else if(variant==='guard'){
  box(body,2.5,.8,2.2,0x805a36,0,2.1,-1.9);box(body,2.7,.15,2.4,0xc09a56,0,2.59,-1.9);rod(body,[0,2.6,-1.7],[0,2.65,-4.4],.33,0x303d42);
  for(const side of [-1,1])for(let n=0;n<6;n++){const z=-2.7+n*.9;box(body,.17,.53,.77,0x86968d,side*2.25,.86,z);const oar=new THREE.Group();oar.position.set(side*2.05,1.3,z);body.add(oar);rod(oar,[0,0,0],[side*1.2,-.6,0],.035,0xb79a63);box(oar,.44,.08,.2,0xb69a6d,side*1.2,-.62,0);oars.push(oar);}
  // Broad plated bulwarks and a bronze ram distinguish the guard from sailing merchants.
  for(const side of [-1,1])for(let n=0;n<5;n++){const z=-2.4+n*1.1,w=widthAt(z);box(body,.18,.78,.86,0x6b5340,side*(w+.04),1.53,z);for(const dz of [-.3,.3])box(body,.22,.07,.08,0xcdb477,side*(w+.1),1.8,z+dz);}
  rod(body,[0,.45,bow+.7],[0,.62,bow-1.3],.19,0xb6a16b);box(body,.72,.35,.4,0xc3b17a,0,.62,bow-1.35);
 }else if(variant==='scout'){
  box(body,1.3,.4,1.5,0x477976,0,2,2.6);box(body,1.7,.12,1.75,0xd4b875,0,2.25,2.6);box(body,.7,.05,.5,0xddd0a2,0,2.34,2.6);rod(body,[.35,2.3,2.5],[.75,2.4,2.5],.07,0xb69a57);
  for(const side of [-1,1])rod(body,[side*.65,1.8,3.4],[side*.65,3,3.4],.05,0xac9164);
  rod(body,[.75,2.35,2.55],[.75,2.7,2.55],.035,0x8a6f44);rod(body,[.75,2.72,2.55],[.75,2.74,1.94],.095,0xc6a366);rod(body,[.75,2.72,2.1],[.75,2.73,1.91],.108,0x425f62);
 }else{box(body,2.4,.7,1.45,variant==='cutter'?0x9a7a4d:0x37616c,0,2.15,stern-1);box(body,2.6,.1,1.6,0xd5b373,0,2.55,stern-1);for(const x of [-.7,0,.7])box(body,.32,.33,.05,0xe9c87a,x,2.15,stern-.25);}
 // A visible helm and rudder finish the working deck rather than leaving an empty stern.
 const helmY=variant==='galleon'?4.25:2.45,helmZ=variant==='galleon'?4.05:stern-1.9;
 rod(body,[0,helmY-.65,helmZ],[0,helmY,helmZ],.09,0x695338);mesh(new THREE.TorusGeometry(.4,.04,5,16),0xa7834e,body,0,helmY,helmZ);
 for(let n=0;n<8;n++){const a=n/8*Math.PI*2;rod(body,[0,helmY,helmZ],[Math.cos(a)*.54,helmY+Math.sin(a)*.54,helmZ],.025,0xc2a466);}
 box(body,.18,1.5,.5,0x715334,0,-.03,stern+.22);box(body,.13,.26,.62,0xb89b61,0,.47,stern+.18);
 for(let n=0;n<12;n++){const z=bow+2.4+Math.floor(n/2)*.95;crew.push(pirate(body,(n%2?1:-1)*Math.min(1.2,widthAt(z)*.7),1.81,z,color));}
 let lookout=null;
 if(['scout','guard'].includes(variant)){
  const mastZ=d.masts[0][0],cofaY=d.masts[0][1]*.88,cofa=new THREE.Group();cofa.name='cofa-del-vigia';body.add(cofa);
  mesh(new THREE.CylinderGeometry(.66,.47,.27,8),0x9f7844,cofa,0,cofaY,mastZ);
  mesh(new THREE.TorusGeometry(.64,.045,4,12),0xcfad67,cofa,0,cofaY+.45,mastZ).rotation.x=Math.PI/2;
  for(let n=0;n<8;n++){const a=n/8*Math.PI*2;rod(cofa,[Math.cos(a)*.6,cofaY,mastZ+Math.sin(a)*.6],[Math.cos(a)*.6,cofaY+.45,mastZ+Math.sin(a)*.6],.028,0x987247);}
  lookout=crew[0];lookout.position.set(0,cofaY+.15,mastZ+.3);lookout.userData.lookout=true;
  // A held brass telescope stays at eye height while the lookout scans.
  lookout.userData.limbs[1].visible=false;
  const scope=new THREE.Group();scope.name='telescopio-del-vigia';lookout.add(scope);
  rod(scope,[.15,.9,.18],[.15,.9,.87],.065,0xd0a459);
  rod(scope,[.15,.9,.54],[.15,.9,1.05],.09,0xb47e38);
  rod(scope,[.15,.9,.99],[.15,.9,1.09],.105,0xf3d087);
  box(scope,.15,.14,.14,0xd8aa7b,.15,.78,.61);
  rod(scope,[.15,.9,1.08],[.15,.9,1.095],.075,0x284d59);
 }
 for(let n=0;n<6;n++)chest(cargo,(n%2-.5)*1.15,1.81,1.7+Math.floor(n/2)*.85,.65);cargo.visible=false;
 g.scale.setScalar(size);g.userData={body,sails,flags,crew,cargo,cannons,oars,lookout,variant,team,hitWidth:Math.max(...frames.map(f=>f[1])),hitLength:Math.max(-bow,stern)};return g;
}
