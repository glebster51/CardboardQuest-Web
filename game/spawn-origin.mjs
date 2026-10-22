const validPoint = point => Number.isFinite(point?.x) && Number.isFinite(point?.z);

/** Use the authored spawn point, or keep the unit where it already is if saved state lacks one. */
export function resolveSpawnOrigin(source, body) {
  if (validPoint(source)) return { x: source.x, z: source.z, usedFallback: false };
  if (validPoint(body)) return { x: body.x, z: body.z, usedFallback: true };
  return { x: 0, z: 0, usedFallback: true };
}
