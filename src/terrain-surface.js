import * as THREE from 'three';

// Only exposed voxel faces are submitted. Interior faces cannot be seen.
export function buildTerrainSurface(parent,cells,step,biome){
  const positions=[],normals=[],colors=[],lookup=new Map(cells.map(c=>[`${c.x.toFixed(3)}:${c.z.toFixed(3)}`,c]));
  const half=step*.5,tint=biome==='snow'?new THREE.Color(0xd9e8de):biome==='volcano'?new THREE.Color(0x625b4b):null;
  const face=(points,normal,color)=>{const paint=new THREE.Color(color);if(tint)paint.lerp(tint,biome==='snow'?.8:.72);for(const n of [0,1,2,0,2,3]){positions.push(...points[n]);normals.push(...normal);colors.push(paint.r,paint.g,paint.b);}};
  for(const c of cells){
    const x=c.x,z=c.z,h=c.h;
    face([[x-half,h,z-half],[x-half,h,z+half],[x+half,h,z+half],[x+half,h,z-half]],[0,1,0],c.topColor);
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const neighbor=lookup.get(`${(x+dx*step).toFixed(3)}:${(z+dz*step).toFixed(3)}`),bottom=neighbor?.h??-.3;if(bottom>=h-.001)continue;
      const edgeX=x+dx*half,edgeZ=z+dz*half;
      const a=dx?[edgeX,bottom,z-half]:[x-half,bottom,edgeZ],b=dx?[edgeX,h,z-half]:[x-half,h,edgeZ],d=dx?[edgeX,h,z+half]:[x+half,h,edgeZ],e=dx?[edgeX,bottom,z+half]:[x+half,bottom,edgeZ];
      face(dx+dz>0?[a,b,d,e]:[e,d,b,a],[dx,0,dz],c.sideColor);
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeBoundingSphere();
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,flatShading:true,side:THREE.DoubleSide}));mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
