/**
 * Battle feel. Pure state and rules: no rendering, no audio, no DOM.
 *
 * Combat is read through four channels that the rest of the game feeds:
 *  - streaks   : consecutive hits inside a window, paying out extra damage
 *  - criticals : a chance multiplier that turns a hit into a moment
 *  - hit-stop  : a brief time dilation so impacts land before they fade
 *  - trauma    : a decaying camera impulse, squared so small hits stay subtle
 */

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const feel = Object.freeze({
  comboWindow: 3.4,
  comboDamageStep: .07,
  comboDamageCap: .56,
  // Bomb shot arcs are already an area weapon; it never crits so it stays a
  // crowd tool rather than a single-target spike.
  critChance: Object.freeze({ 0: .18, 1: .1, 2: .22, 3: 0 }),
  critMultiplier: 1.8,
  // Hit-stop dilates hard enough to land the impact, never to seize the game.
  // 0.25 is the floor: below roughly that it stops reading as weight and starts
  // reading as dropped frames, which is worse than no hit-stop at all.
  hitStop: Object.freeze({ kill: .3, crit: .05, hurt: .1, ram: .13, tower: .06 }),
  traumaDecay: 2.2,
  // Trauma is a pressure gauge, not a score. A full salvo lands 12-16 cannonballs,
  // so per-shot values stay small enough that sustained fire builds a steady
  // tremor instead of pinning the meter on the first broadside.
  traumaShot: .05,
  traumaCrit: .12,
  traumaHurt: .3,
  traumaKill: .45,
  traumaRam: .8,
  // Cruise speed is 9 knots, so only a boosted ship clears the ram threshold.
  ramSpeed: 11,
  ramDamage: 44,
  ramScaleDamage: 40,
  ramSinkChance: .26,
  ramSelfDamage: 9,
  ramSpeedLoss: .45,
  ramCooldown: 2.6,
  lowHull: .3,
  heartbeatGap: 1.15,
  threatRange: 46,
});

export const comboTiers = Object.freeze([
  Object.freeze({ at: 12, title: 'LEYENDA DEL MALASPINA', tone: 'legend' }),
  Object.freeze({ at: 8, title: 'TORMENTA DE HIERRO', tone: 'storm' }),
  Object.freeze({ at: 5, title: 'RACHA ARDIENTE', tone: 'blaze' }),
  Object.freeze({ at: 3, title: 'ANDANADA', tone: 'salvo' }),
]);

export function createCombatFeel() {
  return {
    combo: 0, comboUntil: 0, bestCombo: 0, kills: 0, shots: 0, landed: 0, damageDealt: 0, damageTaken: 0,
    trauma: 0, hitStop: 0, hitStopMax: 0,
    ramCooldown: 0, bannerTime: 0, lowHullSince: 9,
  };
}

/** Real seconds, never simulation seconds: hit-stop must not stretch itself. */
export function stepFeel(state, dt, now = 0) {
  state.trauma = Math.max(0, state.trauma - feel.traumaDecay * dt);
  state.hitStop = Math.max(0, state.hitStop - dt);
  state.ramCooldown = Math.max(0, state.ramCooldown - dt);
  state.bannerTime = Math.max(0, state.bannerTime - dt);
  if (state.combo > 0 && now >= state.comboUntil) state.combo = 0;
  return state;
}

export function addTrauma(state, amount) {
  state.trauma = clamp(state.trauma + amount, 0, 1);
  return state.trauma;
}

export function freeze(state, seconds) {
  state.hitStop = Math.max(state.hitStop, seconds);
  state.hitStopMax = Math.max(state.hitStopMax, state.hitStop);
  return state.hitStop;
}

export function timeScale(state) {
  if (state.hitStop <= 0) return 1;
  const span = state.hitStopMax || 1;
  // Deepest dilation on the frame the freeze lands, easing back to real time.
  // The .25 floor is deliberate: a kill snaps to 4x slow, not 16x. Past that the
  // player stops reading it as impact and starts reading it as a stutter.
  return .25 + .75 * (1 - clamp(state.hitStop / span, 0, 1));
}

/** Squared falloff keeps chip damage from rattling the camera as hard as a kill. */
export function cameraTrauma(state, time) {
  const amount = state.trauma * state.trauma;
  if (amount < .0008) return { x: 0, y: 0, roll: 0 };
  // Even a saturated meter only nudges the camera: ~0.34u of drift and ~2.4 deg
  // of roll. Anything larger fights the helmsman instead of selling the hit.
  const power = amount * .34;
  return { x: Math.sin(time * 61.3) * power, y: Math.cos(time * 47.7) * power * .7, roll: Math.sin(time * 38.1) * power * .12 };
}

export function comboMultiplier(combo) {
  return 1 + Math.min(feel.comboDamageCap, Math.max(0, combo - 1) * feel.comboDamageStep);
}

export function comboTier(combo) {
  return comboTiers.find(tier => combo >= tier.at) ?? null;
}

export function registerHit(state, now, { damage = 0, crit = false, killed = false } = {}) {
  state.combo = now < state.comboUntil ? state.combo + 1 : 1;
  state.comboUntil = now + feel.comboWindow;
  state.bestCombo = Math.max(state.bestCombo, state.combo);
  state.landed++;
  state.damageDealt += damage;
  if (killed) state.kills++;
  return { combo: state.combo, multiplier: comboMultiplier(state.combo), crit, killed, tier: comboTier(state.combo) };
}

export function rollCritical(random = Math.random, kind = 0) {
  const chance = feel.critChance[kind] ?? feel.critChance[0];
  return random() < chance;
}

/**
 * Screen-space bearing of a world point relative to the ship: 0 points at the
 * bow and positive angles turn to starboard.
 */
export function bearingAngle(fromX, fromZ, ship) {
  const dx = fromX - ship.x, dz = fromZ - ship.z;
  const cos = Math.cos(ship.heading), sin = Math.sin(ship.heading);
  return Math.atan2(dx * cos - dz * sin, -(dx * sin + dz * cos));
}

/**
 * A boosted hull that meets another hull broadside is a weapon. Returns null
 * unless the impact is fast enough, off cooldown and aimed at the target.
 */
export function ramImpulse(state, attacker, target, speed, random = Math.random) {
  if (!attacker || !target || attacker.dead || target.dead || attacker.team === target.team) return null;
  if (state.ramCooldown > 0 || speed < feel.ramSpeed) return null;
  const power = clamp((speed - feel.ramSpeed) / Math.max(1, attacker.maxSpeed - feel.ramSpeed), 0, 1);
  if (power <= 0) return null;
  state.ramCooldown = feel.ramCooldown;
  const damage = feel.ramDamage + power * feel.ramScaleDamage;
  return { damage, selfDamage: feel.ramSelfDamage, speedLoss: feel.ramSpeedLoss, power, sunk: random() < feel.ramSinkChance + power * .2 };
}

/** 0 = safe, 1 = about to sink. Drives the low-hull heartbeat and vignette. */
export function lowHullLevel(hp, maxHp) {
  const fraction = hp / Math.max(1, maxHp);
  return fraction >= feel.lowHull ? 0 : clamp((feel.lowHull - fraction) / feel.lowHull, 0, 1);
}