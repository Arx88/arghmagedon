import * as THREE from 'three';

function fingerprint(geometry){
  let hash=2166136261;
  for(const name of Object.keys(geometry.attributes).sort()){
    const a=geometry.attributes[name];for(const value of a.array){hash=Math.imul(hash^Math.round(value*100000),16777619);}
  }
  if(geometry.index)for(const n of geometry.index.array)hash=Math.imul(hash^n,16777619);
  return `${geometry.attributes.position.count}:${hash>>>0}`;
}

// Keep the detailed heads, tools and moving joints. Identical painted parts share
// a draw call instead of submitting every sailor's hands, boots and hat separately.
export class CrewRenderer {
  constructor(scene){this.scene=scene;this.parts=new Map();this.known=new WeakSet();this.clock=1;this.zero=new THREE.Matrix4().makeScale(0,0,0);}
  register(){
    this.scene.traverse(root=>{
      if(!root.userData.limbs||this.known.has(root))return;this.known.add(root);
      root.traverse(part=>{
        if(!part.isMesh||part.isInstancedMesh||part.material.transparent)return;
        const m=part.material,key=[fingerprint(part.geometry),m.type,m.map?.uuid??'',m.side,m.vertexColors,m.color.getHex()].join(':');
        let batch=this.parts.get(key);
        if(!batch){const mesh=new THREE.InstancedMesh(part.geometry,m,256);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=part.castShadow;mesh.receiveShadow=part.receiveShadow;mesh.count=0;this.scene.add(mesh);batch={mesh,parts:[]};this.parts.set(key,batch);}
        batch.parts.push(part);part.layers.set(2);
      });
    });
  }
  update(dt){
    this.clock+=dt;if(this.clock>=.5){this.clock=0;this.register();}
    this.scene.updateMatrixWorld();
    for(const batch of this.parts.values()){
      let count=0;
      for(const part of batch.parts){
        let node=part,visible=true;while(node&&node!==this.scene){if(!node.visible)visible=false;node=node.parent;}
        if(node!==this.scene||!visible)continue;
        if(count>=batch.mesh.instanceMatrix.count)break;
        batch.mesh.setMatrixAt(count++,part.matrixWorld);
      }
      batch.mesh.count=count;batch.mesh.instanceMatrix.needsUpdate=true;
    }
  }
}
