import * as THREE from 'three';
import { box, rod } from './world.js';
import { batchPaint } from './batch.js';

const factions={blue:{cloth:0x235f76,edge:0xd9ba75,ink:0xf5e6bc},red:{cloth:0x8e392d,edge:0xd9ba75,ink:0xf5e6bc},neutral:{cloth:0x5b6250,edge:0xc5ae78,ink:0xe9d8a9}};
const rgb=hex=>[(hex>>16)&255,(hex>>8)&255,hex&255];

// Pixel crests are painted directly onto the moving cloth; no floating glyphs.
export function territoryTexture(team='neutral'){
 const palette=factions[team]??factions.neutral,width=96,height=56,data=new Uint8Array(width*height*4);
 const paint=(x,y,color)=>{if(x<0||y<0||x>=width||y>=height)return;const offset=((height-1-y)*width+x)*4;data.set([...rgb(color),255],offset);};
 const rect=(x,y,w,h,color)=>{for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)paint(xx,yy,color);};
 const line=(x1,y1,x2,y2,thickness,color)=>{const count=Math.ceil(Math.hypot(x2-x1,y2-y1));for(let i=0;i<=count;i++)rect(Math.round(x1+(x2-x1)*i/count),Math.round(y1+(y2-y1)*i/count),thickness,thickness,color);};
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const base=new THREE.Color(palette.cloth);base.multiplyScalar(1+(Math.sin(x*.9+y*.5)*.025)+(x%16===0?-.065:0));paint(x,y,base.getHex());}
 rect(0,2,width,2,palette.edge);rect(0,height-4,width,2,palette.edge);rect(2,2,2,height-4,palette.edge);
 for(let x=7;x<width-4;x+=6){rect(x,5,2,1,palette.ink);rect(x,height-7,2,1,palette.ink);}
 const ink=palette.ink;
 if(team==='blue'){
  rect(46,17,4,24,ink);rect(38,25,20,3,ink);rect(43,11,10,3,ink);rect(41,14,3,6,ink);rect(52,14,3,6,ink);rect(43,19,10,3,ink);
  line(31,33,38,43,3,ink);line(61,33,54,43,3,ink);line(38,43,47,47,3,ink);line(54,43,47,47,3,ink);rect(30,30,6,6,ink);rect(59,30,6,6,ink);
 }else if(team==='red'){
  line(34,15,61,40,4,ink);line(61,15,34,40,4,ink);line(30,37,41,47,3,palette.edge);line(55,47,66,37,3,palette.edge);line(30,46,35,41,3,ink);line(62,46,57,41,3,ink);
 }else{
  rect(34,20,30,18,ink);rect(37,17,24,3,ink);rect(39,20,3,18,palette.cloth);rect(57,20,3,18,palette.cloth);rect(46,26,6,6,palette.edge);
 }
 const texture=new THREE.DataTexture(data,width,height,THREE.RGBAFormat);texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.needsUpdate=true;return texture;
}

function signal(parent,{x,y,z,width,height,poleHeight,team,pennant=false}){
 const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);
 rod(g,[0,0,0],[0,poleHeight,0],pennant?.055:.105,0x6c5536);
 box(g,pennant?.13:.23,.13,pennant?.13:.23,0xe4c484,0,poleHeight+.04,0);
 const geometry=new THREE.PlaneGeometry(width,height,pennant?10:18,6),positions=geometry.attributes.position;
 if(pennant){for(let i=0;i<positions.count;i++){const u=geometry.attributes.uv.getX(i);positions.setY(i,positions.getY(i)*(1-u*.58));}}
 const texture=territoryTexture(team),material=new THREE.MeshStandardMaterial({map:texture,color:0xffffff,roughness:1,side:THREE.DoubleSide});
 const cloth=new THREE.Mesh(geometry,material);cloth.castShadow=true;cloth.position.set(width*.5,poleHeight-height*.55,0);g.add(cloth);
 const rest=Float32Array.from(positions.array);batchPaint(g,true,new Set([cloth]));return {g,cloth,texture,material,rest,poleHeight,height,team};
}

export class TerritoryArt{
 constructor(islands){
  this.records=[];this.time=0;
  for(const island of islands){
   const owner=island.owner??'neutral',home=!!island.homeTeam||island.type==='port',fort=island.type==='fort';
   const group=new THREE.Group();group.name='identidad-territorial';island.group.add(group);
   const base=fort?[-1,9.6,-1]:[island.r*.38,1.2,-island.r*.15];
   const main=signal(group,{x:base[0],y:base[1],z:base[2],width:home?5.1:fort?4.7:3.4,height:home?2.8:fort?2.5:1.9,poleHeight:fort?4.2:home?8.8:6.8,team:owner});
   const pennants=[];
   if(home||fort)for(const side of [-1,1])pennants.push(signal(group,{x:island.r*.35+side*2.8,y:1,z:island.r*.49,width:1.8,height:1.4,poleHeight:3.8,team:owner,pennant:true}));
   island.territoryArt=group;this.records.push({island,group,main,pennants,owner,shownOwner:owner,transition:null});
  }
 }
 update(time,dt){
  this.time=time;
  for(const record of this.records){
   const owner=record.island.owner??'neutral';
   if(owner!==record.owner){record.owner=owner;record.transition={elapsed:0,next:owner,swapped:false};}
   let hoist=1;
   if(record.transition){
    const transition=record.transition;transition.elapsed+=dt;
    hoist=transition.elapsed<.45?1-transition.elapsed/.45:Math.min(1,(transition.elapsed-.45)/.8);
    if(!transition.swapped&&transition.elapsed>=.45){
     for(const item of [record.main,...record.pennants]){item.texture.dispose();item.texture=territoryTexture(transition.next);item.material.map=item.texture;item.material.needsUpdate=true;item.team=transition.next;}
     record.shownOwner=transition.next;transition.swapped=true;
    }
    if(transition.elapsed>=1.25)record.transition=null;
   }
   for(const [index,item]of [record.main,...record.pennants].entries()){
    item.cloth.position.y=item.poleHeight-item.height*.55-(1-hoist)*(item.poleHeight-item.height);
    const positions=item.cloth.geometry.attributes.position,uv=item.cloth.geometry.attributes.uv;
    for(let i=0;i<positions.count;i++){const u=uv.getX(i);positions.setZ(i,item.rest[i*3+2]+Math.sin(time*2.8+u*7+index)*u*.24);positions.setY(i,item.rest[i*3+1]+Math.sin(time*2+u*4+index)*u*.055);}
    positions.needsUpdate=true;item.cloth.geometry.computeVertexNormals();
   }
  }
 }
 dispose(){
  const geometries=new Set(),materials=new Set(),textures=new Set();
  for(const record of this.records){record.group.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.material)materials.add(object.material);if(object.material?.map)textures.add(object.material.map);});record.group.removeFromParent();delete record.island.territoryArt;}
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());this.records.length=0;
 }
}
