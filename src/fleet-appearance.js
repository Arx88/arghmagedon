import * as THREE from 'three';

// The purchased fleet uses the same three identifiers as the fleet reference.
// Team ownership still comes from its pennants, label and minimap marker.
export const fleetSailProfiles=Object.freeze({
 scoutI:Object.freeze({id:'scoutI',motif:'spyglass',color:0xf1e3bb,path:'/assets/fleet-sails/scout-i-spyglass-v1.png'}),
 scoutII:Object.freeze({id:'scoutII',motif:'compass',color:0x142d55,path:'/assets/fleet-sails/scout-ii-compass-v1.png'}),
 guard:Object.freeze({id:'guard',motif:'tower',color:0xb53627,path:'/assets/fleet-sails/guard-tower-v1.png'}),
});
export function fleetSailIdentity(ship,level=ship.scoutLevel??1){
 if(ship.variant==='corsair')return null; // Its two lateen sails carry the raider's own cutlasses.
 if(ship.support==='guard'||ship.variant==='guard')return fleetSailProfiles.guard;
 if(ship.support==='scout'||ship.variant==='scout')return level>=2?fleetSailProfiles.scoutII:fleetSailProfiles.scoutI;
 return null;
}
const textures=new Map();
function fleetTexture(path){
 if(!textures.has(path)){
  // Headless rule tests have no image decoder; production uses the real loader.
  const texture=typeof window==='undefined'?new THREE.Texture():new THREE.TextureLoader().load(path);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps=true;texture.anisotropy=4;textures.set(path,texture);
 }
 return textures.get(path);
}
export function applyFleetSails(ship,level=ship.scoutLevel??1,getTexture=fleetTexture){
 const profile=fleetSailIdentity(ship,level);if(!profile)return false;
 const data=ship.object.userData;
 for(const rig of data.sails??[]){
  if(rig.userData.sailKind==='jib')continue;
  const material=rig.userData.cloth.material;
  material.map=getTexture(profile.path);material.color.set(0xffffff);material.needsUpdate=true;
  rig.userData.motif=profile.motif;
 }
 ship.scoutLevel=ship.support==='scout'||ship.variant==='scout'?level:undefined;
 data.fleetIdentity=profile.id;data.fleetMotif=profile.motif;
 return true;
}
