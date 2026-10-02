export const balance = Object.freeze({ scoutCost: 160, guardCost: 140, scoutLimit: 2, guardLimit: 3, scoutSpeed: 2.25, scoutVision: 21, lootSeconds: 10, lootRespawn: 120, roleCost: 45, invasionMin: 28, invasionMax: 45 });
export const garrisons = [0, 5, 8, 12, 16];
export const garrisonCost = level => 90 + level * 65;
export const towerCost = level => 110 + level * 70;
export const weaponCost = level => 110 + level * 85;
export const scoutUpgradeCost = level => level === 1 ? 180 : 260;
export const lootDuration = looters => Math.max(6, balance.lootSeconds / (1 + Math.max(0,looters) * .09));
export const crewSpecialties = Object.freeze([
  Object.freeze({id:'repairer',key:'repairers',name:'Reparadores',cost:45}),
  Object.freeze({id:'looter',key:'looters',name:'Saqueadores',cost:45}),
  Object.freeze({id:'boarder',key:'boarders',name:'Abordadores',cost:55}),
  Object.freeze({id:'gunner',key:'gunners',name:'Artilleros',cost:65}),
]);
const roleCount = (ship,key) => Math.max(0,Math.floor(ship.roles?.[key]??0));
export const specialistCount = ship => crewSpecialties.reduce((total,role)=>total+roleCount(ship,role.key),0);
export const marinerCount = ship => Math.max(0,ship.crew-specialistCount(ship));

export function hireRole(ship, role) {
  if (!crewSpecialties.some(item=>item.key===role)) return false;
  if (ship.crew >= ship.maxCrew) return false;
  ship.roles??={};ship.roles[role]=roleCount(ship,role)+1;ship.crew++;return true;
}
export function dismissRole(ship,role) {
  if(!crewSpecialties.some(item=>item.key===role)||!roleCount(ship,role)||ship.crew<=1)return false;
  ship.roles[role]--;ship.crew--;return true;
}
export function reconcileRoles(ship) {
  ship.roles??={repairers:0,looters:0};
  for(const role of crewSpecialties)if(Object.hasOwn(ship.roles,role.key))ship.roles[role.key]=roleCount(ship,role.key);
  // General sailors absorb casualties first; specialist counts never exceed survivors.
  while (specialistCount(ship) > Math.max(0,ship.crew)) {
    const lost=['looters','gunners','boarders','repairers'].find(role=>roleCount(ship,role)>0);
    ship.roles[lost]--;
  }
}
export const gunnerReloadMultiplier = ship => Math.max(.82,1/(1+.035*roleCount(ship,'gunners')));
export function cannonReload(ship,ammunitionMultiplier=1,rum=false) {
  return ship.reload*ammunitionMultiplier*Math.pow(12/Math.max(1,ship.crew),.12)*gunnerReloadMultiplier(ship)*(rum?.78:1);
}
export function boardingExchange(attacker,defender) {
  const attackBonus=1+Math.min(.5,roleCount(attacker,'boarders')*.1),defendBonus=1+Math.min(.5,roleCount(defender,'boarders')*.1);
  return {outgoing:attacker.crew*3.5*attackBonus,retaliation:defender.crew*1.3*defendBonus*(1-Math.min(.25,roleCount(attacker,'boarders')*.05))};
}
export function invasionDuration(attackers, defenders, roll = .5) {
  // Troop advantage changes the window to intervene, never an instant result.
  return Math.min(balance.invasionMax, Math.max(balance.invasionMin, 42 + (defenders - attackers) * 1.4 + (Math.min(1, Math.max(0, roll)) - .5) * 8));
}
export function stepInvasion(state, dt, contested) {
  if (state.attackers <= 0) return 'repelled';
  if (contested) { state.progress = Math.max(0, state.progress - dt * .35); return 'contested'; }
  state.progress += dt;
  return state.progress >= state.duration ? 'captured' : 'invading';
}
export function canScoutLoot(island, level, team='blue', source=null) {
  return level >= 3 && island.autoLootEligible === true && !island.homeTeam && island.type !== 'port' && (island.owner==='neutral'||island.owner===team) && island.defenders === 0 && island.available && !island.invasion && (!island.lootSource||island.lootSource===source);
}
export function purchaseBlockReason({docked=true,money=Infinity,cost=0,maxed=false,full=false,restriction=''}) {
  if(maxed)return 'Nivel máximo';
  if(full)return 'Sin plazas libres';
  if(restriction)return restriction;
  if(!docked)return 'Vuelve a tu puerto';
  if(money<cost)return `Faltan ${Math.ceil(cost-money)} oro`;
  return '';
}
// --- Gunnery geometry: which broadside bears and how hard it lands. ---------
// A gun only shoots where its side points, so the angle between the heading and
// the destination decides everything: full effect abeam, a weak, wide salvo off
// the bow or stern. Crossing the T — your guns bearing while their hull points at
// you — pays a premium on top.
export const sideKey = bearing => (bearing > 0 ? 'starboard' : 'port');
export function broadsideFactor(bearing) {
  return .55 + .45 * Math.abs(Math.sin(bearing));
}
export function crossingTBonus(attackerBearing, defenderBearing) {
  return Math.abs(Math.sin(attackerBearing)) >= .85 && Math.abs(Math.sin(defenderBearing)) <= .35 ? 1.15 : 1;
}
// --- Rigging: chain shot tears sails instead of only denting hulls. ---------
export const rigRules = Object.freeze({ chainRigShare: .7, burnRigPerSecond: 1.6, speedFloor: .45, repairPerSecond: .35 });
export function splitDamage(kind, amount) {
  const rig = kind === 1 ? amount * rigRules.chainRigShare : 0;
  return { hull: amount - rig, rig };
}
export function rigSpeedFactor(rig, maxRig) {
  const ratio = Math.max(0, Math.min(1, rig / Math.max(1, maxRig)));
  return rigRules.speedFloor + (1 - rigRules.speedFloor) * ratio;
}
// --- Boarding: a captured hull hands over most of the gold it carries. -------
export const boardingLootShare = .6;
export function boardingLoot(cargo) {
  return Math.round(Math.max(0, cargo) * boardingLootShare);
}
export function applyAmmoEffect(target, kind, level, source) {
  if (kind === 1) { target.slow = Math.max(target.slow ?? 0, 5 + level); target.slowFactor = .7 - level * .04; }
  if (kind === 2) {
    const active=target.burning>0,amount=2+level*.5;
    target.burning=Math.max(target.burning??0,5);
    if(!active||amount>=(target.burnDamage??0)){target.burnDamage=amount;target.burnSource=source;}
  }
}
