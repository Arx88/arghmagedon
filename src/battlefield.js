export const worldBounds=Object.freeze({minX:-172,maxX:172,minZ:-166,maxZ:140});
const island=(id,name,x,z,r,options={})=>Object.freeze({id,name,x,z,r,type:'treasure',biome:'tropical',gold:100,initialDefenders:0,autoLootEligible:false,...options});

// Mechanics are mirrored about (0,-13); each shore can keep its own architecture and biome.
export const islandDefinitions=Object.freeze([
  island('blue-home','Puerto Ron Ron',-124,98,24,{type:'port',homeTeam:'blue',gold:0,initialDefenders:8,initialTower:true,lane:'home'}),
  island('red-home','Fuerte del Diente Roto',124,-124,24,{type:'fort',homeTeam:'red',gold:0,initialDefenders:8,initialTower:true,lane:'home'}),
  island('blue-cove','Cayo del Contrabando',-82,64,19,{autoLootEligible:true,pair:'cove',side:'blue',lane:'south'}),
  island('red-cove','Isla de las Malas Decisiones',82,-90,19,{autoLootEligible:true,pair:'cove',side:'red',lane:'north'}),
  island('west-ruins','El Último Amarre',-118,-8,20,{biome:'ruins',autoLootEligible:true,pair:'ruins',side:'blue',lane:'north'}),
  island('east-ruins','El Ojo del Naufragio',118,-18,20,{biome:'ruins',autoLootEligible:true,pair:'ruins',side:'red',lane:'south'}),
  island('south-volcano','Las Calderas del Diablo',24,90,20,{biome:'volcano',gold:140,initialDefenders:3,pair:'frontier',side:'blue',lane:'south'}),
  island('north-snow','Los Colmillos del Norte',-24,-116,20,{biome:'snow',gold:140,initialDefenders:3,pair:'frontier',side:'red',lane:'north'}),
  island('west-fort','Bastión del Mal Aliento',-49,-31,22,{type:'fort',gold:180,initialDefenders:5,pair:'fort',side:'blue',lane:'center'}),
  island('east-fort','Fortín de Patas de Palo',49,5,22,{type:'fort',gold:180,initialDefenders:5,pair:'fort',side:'red',lane:'center'}),
  island('central-caldera','La Boca del Abismo',0,-13,20,{biome:'volcano',gold:220,initialDefenders:4,lane:'center'}),
]);

export const opposingTeam=team=>team==='blue'?'red':team==='red'?'blue':null;
export const getHomeBase=(islands,team)=>islands.find(i=>i.homeTeam===team)??null;
export function isTeamDocked(ship,islands,team=ship.team,padding=12){
  const base=getHomeBase(islands,team);
  return !!base&&base.owner===team&&!ship.dead&&!ship.destroyed&&Math.hypot(ship.x-base.x,ship.z-base.z)<base.r+padding;
}
export function teamSpawn(islands,team,slot=0){
  const base=getHomeBase(islands,team);if(!base)return null;
  const side=team==='red'?-1:1;
  return {x:base.x+side*(25+slot*7),z:base.z-side*(16+slot*3),heading:team==='blue'?-.84:2.30};
}
export function battleWinner(islands){
  const blue=getHomeBase(islands,'blue'),red=getHomeBase(islands,'red');
  if(!blue||!red)return null;
  const blueLost=blue.owner==='red',redLost=red.owner==='blue';
  return blueLost&&redLost?'draw':blueLost?'red':redLost?'blue':null;
}
