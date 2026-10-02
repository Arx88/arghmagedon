import { balance } from './campaign-rules.js';

// Corsairs trade hull for speed and firepower, and share the existing escort cap.
export const supportProfiles = Object.freeze({
  scout: Object.freeze({ role:'scout', variant:'scout', name:'Ojo de Gaviota', cost:balance.scoutCost, hp:65, speed:balance.scoutSpeed, damage:0, reload:4.8, crew:4, scale:.65 }),
  guard: Object.freeze({ role:'guard', variant:'guard', name:'Mosquito', cost:balance.guardCost, hp:95, speed:5.4, damage:8, reload:4.8, crew:4, scale:.65 }),
  corsair: Object.freeze({ role:'guard', variant:'corsair', name:'Viento Cortante', cost:240, hp:80, speed:8, damage:13, reload:3.8, crew:6, scale:.72 }),
});

export function supportPurchaseAllowed(kind, ships, team='blue') {
  const profile=supportProfiles[kind];
  if(!profile)return false;
  const count=ships.filter(s=>s.team===team&&s.support===profile.role&&!s.dead&&!s.destroyed).length;
  return count<(profile.role==='scout'?balance.scoutLimit:balance.guardLimit);
}

export function equipSupport(ship,kind) {
  const profile=supportProfiles[kind];
  if(!profile)throw new RangeError(`Unknown support ship: ${kind}`);
  Object.assign(ship,{unitKind:kind,support:profile.role,maxSpeed:profile.speed,hp:profile.hp,maxHp:profile.hp,damage:profile.damage,reload:profile.reload,cooldownTotal:profile.reload,crew:profile.crew,maxCrew:profile.crew});
  // The broadside clocks must match the new hull from its very first salvo.
  for(const gun of Object.values(ship.guns??{}))Object.assign(gun,{left:0,total:profile.reload});
  return ship;
}
