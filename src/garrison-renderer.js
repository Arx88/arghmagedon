import * as THREE from 'three';

// Articulated boots, coats, hats and cutlasses share one draw call per island.
const parts = [
  [-.12,.12,0,.20,.24,.26,0x302b26], [.12,.12,0,.20,.24,.26,0x302b26],
  [-.12,.34,0,.16,.28,.20,0x46535a], [.12,.34,0,.16,.28,.20,0x46535a],
  [0,.64,0,.42,.38,.29,'team'], [0,.66,-.16,.22,.28,.05,0xe6ccb0],
  [0,.49,-.17,.42,.06,.05,0x725637], [0,.89,0,.30,.28,.28,0xd4aa7c],
  [0,.96,-.15,.24,.10,.03,0x553c29], [0,1.04,0,.49,.06,.38,0x283c40],
  [0,1.10,0,.32,.10,.29,0x283c40], [-.29,.69,0,.15,.34,.18,'team'],
  [.29,.69,0,.15,.34,.18,'team'], [.38,.95,-.11,.05,.61,.08,0xc4d9d8],
];
const paint = new THREE.Color();
export function createGarrison() {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshStandardMaterial({color:0xffffff,roughness:.9}), 16*parts.length);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled=false;mesh.castShadow=true;mesh.count=0;
  return mesh;
}
export function animateGarrison(island,time,dummy,teamColor) {
  const mesh=island.soldiers,count=Math.min(16,island.defenders);
  mesh.count=count*parts.length;
  for(let n=0;n<count;n++) {
    const walk=Math.sin(time*3+n),fighting=!!island.invasion;
    const x=island.r*.15+(n%4)*.95,z=2+Math.floor(n/4)*.9,base=.37+Math.abs(walk)*.035;
    for(let p=0;p<parts.length;p++) {
      const [dx,dy,dz,w,h,d,color]=parts[p];
      dummy.position.set(x+dx,base+dy,z+dz);
      dummy.rotation.set(p<4?walk*(p%2?1:-1)*.10:0,0,p===13?Math.sin(time*(fighting?8:2)+n)*.32:0);
      dummy.scale.set(w,h,d);dummy.updateMatrix();mesh.setMatrixAt(n*parts.length+p,dummy.matrix);
      mesh.setColorAt(n*parts.length+p,paint.set(color==='team'?teamColor(island.owner):color));
    }
  }
  mesh.instanceMatrix.needsUpdate=true;
  if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
}
