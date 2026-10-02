import { planRoute } from './route-planner.js';
export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
export const damp = (a, b, response, dt) => b + (a - b) * Math.exp(-response * dt);
export const angleDelta = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

/** Rates use seconds; the same helm response is retained at 30, 60 and 144 Hz. */
export function navigate(state, input, dt) {
  const maxSpeed = Math.max(.1,state.maxSpeed ?? 9);
  const desired = input.throttle > 0 ? maxSpeed : input.throttle < 0 ? -2 : state.speed;
  if(input.throttle){
    const response=input.throttle>0&&state.speed>maxSpeed?4.2:(input.throttle>0?.8:1.6)*(input.acceleration??1);
    state.speed=damp(state.speed,desired,response,dt);
  }else{
    state.speed*=Math.exp(-dt*.17);
    // A released boost loses its extra speed promptly, including when W is released too.
    if(state.speed>maxSpeed)state.speed=damp(state.speed,maxSpeed,4.2,dt);
  }
  if (input.stop) state.speed = damp(state.speed, 0, 3.5, dt);
  const authority = .5 + Math.min(Math.abs(state.speed) / maxSpeed, 1) * .7;
  state.yawRate = damp(state.yawRate ?? 0, input.turn * authority*(input.handling??1), 7, dt);
  state.heading += state.yawRate * dt;
  const velocityResponse=Math.hypot(state.vx??0,state.vz??0)>maxSpeed?4.5:3.1;
  state.vx = damp(state.vx ?? 0, -Math.sin(state.heading) * state.speed, velocityResponse, dt);
  state.vz = damp(state.vz ?? 0, -Math.cos(state.heading) * state.speed, velocityResponse, dt);
  state.x += state.vx * dt;
  state.z += state.vz * dt;
}

export function autopilot(state, target, obstacles) {
  if(!state.route?.length||!state.routeGoal||Math.hypot(target.x-state.routeGoal.x,target.z-state.routeGoal.z)>5){const route=planRoute(state,target,obstacles);state.routeGoal={...target};state.route=route;}
  while(state.route.length>1&&Math.hypot(state.x-state.route[0].x,state.z-state.route[0].z)<7)state.route.shift();
  const goal=state.route[0];
  target=goal;
  let dx = target.x - state.x, dz = target.z - state.z;
  const distance = Math.hypot(dx, dz);
  if (distance < 5) return { throttle: 0, turn: 0, stop: true, arrived: true };
  // Local steering around a coastline; destination itself stays stable.
  const lookAhead = Math.min(distance*.65, 7 + Math.abs(state.speed) * 1.4);
  const px = state.x - Math.sin(state.heading) * lookAhead;
  const pz = state.z - Math.cos(state.heading) * lookAhead;
  for (const island of obstacles) {
    const ox = px - island.x, oz = (pz - island.z) / .72;
    const range = island.r + 6;
    const d = Math.hypot(ox, oz);
    if (d < range) {
      const strength = (range - d) / range * 55;
      dx += ox / Math.max(d, .1) * strength;
      dz += oz / Math.max(d, .1) * strength;
    }
  }
  const delta = angleDelta(state.heading, Math.atan2(-dx, -dz));
  return { turn: clamp(delta * 2, -1, 1), throttle: distance > 5 && Math.abs(delta) < 1.4 ? 1 : 0, stop: distance < 5 || Math.abs(delta) > 1.7 };
}

/** Swept ellipse test in the hull's local frame avoids fast bullets tunnelling. */
export function hullIntersection(from, to, ship) {
  const c = Math.cos(ship.heading), s = Math.sin(ship.heading), scale = ship.scale ?? 1;
  const local = p => {
    const x = p.x - ship.x, z = p.z - ship.z;
    return { x: (c * x - s * z) / ((ship.hitWidth ?? 2.5) * scale), z: (s * x + c * z) / ((ship.hitLength ?? 5.8) * scale) };
  };
  const a = local(from), b = local(to), dx = b.x - a.x, dz = b.z - a.z;
  const aa = dx * dx + dz * dz, bb = 2 * (a.x * dx + a.z * dz), cc = a.x * a.x + a.z * a.z - 1;
  let t;
  if (cc <= 0) t = 0;
  else {
    const discriminant = bb * bb - 4 * aa * cc;
    if (aa < 1e-10 || discriminant < 0) return null;
    t = (-bb - Math.sqrt(discriminant)) / (2 * aa);
    if (t < 0 || t > 1) return null;
  }
  const y = from.y + (to.y - from.y) * t - (ship.object?.position.y ?? 0);
  return y > -.4 && y < 3.1 * scale ? t : null;
}

export const upgradeDefinitions = {
  hull: { base: 120, name: 'Casco reforzado' },
  cannons: { base: 150, name: 'Cañones rápidos', damage: 4, reloadMultiplier: .935 },
  crew: { base: 100, name: 'Más tripulación' },
};
export function upgradeCost(kind, level) { return upgradeDefinitions[kind]?Math.round(upgradeDefinitions[kind].base * (1 + level * .65)):Infinity; }
export function purchaseUpgrade(state, kind, bank, docked) {
  if (!upgradeDefinitions[kind]) return { ok: false, bank };
  const level = state.upgrades[kind], cost = upgradeCost(kind, level);
  if (!docked || state.dead || level >= 3 || bank < cost) return { ok: false, bank };
  state.upgrades[kind]++;
  state.level++;
  if (kind === 'hull') { state.maxHp += 35; state.hp = state.maxHp; }
  if (kind === 'cannons') { state.damage += upgradeDefinitions.cannons.damage; state.reload = Math.max(.9, state.reload * upgradeDefinitions.cannons.reloadMultiplier); }
  if (kind === 'crew') { state.maxCrew += 4; }
  return { ok: true, bank: bank - cost };
}

