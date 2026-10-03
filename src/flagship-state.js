const clamp = (n, low, high) => Math.min(high, Math.max(low, Number.isFinite(n) ? n : low));

/** Presentation data comes from the ship, including repaired rigging and vacant crew places. */
export function flagshipState(player, { rank = 1, xp = 0, docked = false, boosting = false } = {}) {
  const maxHp = Math.max(1, player.maxHp || 1), hp = clamp(player.hp, 0, maxHp);
  const maxCrew = Math.max(0, player.maxCrew || 0), crew = clamp(player.crew, 0, maxCrew);
  const hull = hp / maxHp, rig = clamp((player.rig ?? 100) / Math.max(1, player.maxRig ?? 100), 0, 1);
  let condition = 'ready', label = 'Listo para zarpar';
  if (player.dead || player.destroyed || hp <= 0) { condition = 'sunk'; label = 'Preparando el regreso'; }
  else if (player.burning > 0) { condition = 'burning'; label = 'Fuego a bordo · V'; }
  else if (docked && hp < maxHp - .5) { condition = 'repairing'; label = 'Reparando en puerto'; }
  else if (hull <= .3) { condition = 'critical'; label = 'Casco crítico · vuelve a puerto'; }
  else if (rig < .35) { condition = 'rigging'; label = 'Velas dañadas'; }
  else if (boosting) { condition = 'boosting'; label = '¡A toda vela!'; }
  else if (hull < .65) { condition = 'damaged'; label = 'El casco necesita reparaciones'; }
  else if (Math.hypot(player.vx ?? 0, player.vz ?? 0) > .6) { condition = 'sailing'; label = 'Velas al viento'; }
  return {
    name: player.name || 'La Indomable', hp, maxHp, hull, crew, maxCrew, rig,
    speed: clamp(Math.hypot(player.vx ?? 0, player.vz ?? 0), 0, 99.9),
    rank, xp, xpGoal: rank * 80, experience: clamp(xp / Math.max(1, rank * 80), 0, 1),
    condition, label,
  };
}

export function flagshipChange(previous, next) {
  if (!previous) return null;
  if (next.rank > previous.rank) return { kind: 'rank', value: next.rank };
  // Buying hull capacity or respawning must not be presented as an incoming hit.
  if (next.maxHp !== previous.maxHp || previous.condition === 'sunk' || next.condition === 'sunk') return null;
  const difference = next.hp - previous.hp;
  if (difference < -.5) return { kind: 'damage', value: Math.ceil(-difference) };
  if (difference > .15) return { kind: 'repair', value: Math.ceil(difference) };
  return null;
}
