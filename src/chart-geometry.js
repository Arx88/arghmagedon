/** Uniform map scale: the entire rectangular sea fits inside a round compass. */
export function chartTransform(bounds, player, fullChart, size = 320) {
  const center = size / 2;
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  const scale = fullChart ? (size - 25) / Math.hypot(width, depth) : 1.55;
  const x = fullChart ? (bounds.minX + bounds.maxX) / 2 : player.x;
  const z = fullChart ? (bounds.minZ + bounds.maxZ) / 2 : player.z;
  return { scale, point: p => [center + (p.x - x) * scale, center + (p.z - z) * scale] };
}
