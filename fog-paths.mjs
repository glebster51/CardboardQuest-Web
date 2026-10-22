const MAX_COORDINATE = 1000;
export const FOG_PATH_RADIUS_MIN = .1;
export const FOG_PATH_RADIUS_MAX = 8;

/** Per-point multiplier of the global fog width; old scenes keep their original width. */
export function fogPathRadiusAt(path, index) { return path.radii?.[index] ?? 1; }

export function setFogPathRadius(value, pathIndex, pointIndex, radius, sharedCenter = false) {
  if (!Number.isFinite(radius)) throw new Error('Invalid fog path radius');
  const next = structuredClone(value);
  radius = Math.round(Math.max(FOG_PATH_RADIUS_MIN, Math.min(FOG_PATH_RADIUS_MAX, radius)) * 1000) / 1000;
  const targets = sharedCenter ? next.paths : [next.paths[pathIndex]];
  for (const path of targets) {
    const index = sharedCenter ? path.points.length - 1 : pointIndex;
    path.radii = path.points.map((_, i) => fogPathRadiusAt(path, i));
    path.radii[index] = radius;
    if (path.radii.every(value => value === 1)) delete path.radii;
  }
  validateFogPaths(next);
  return next;
}

/** A route starts at every authored player entry and ends at one shared map center. */
export function createDefaultFogPaths(location) {
  const center = [0, 0];
  const entries = [
    ...(location.entry ? [{ id: 'entry', point: location.entry }] : []),
    ...Object.entries(location.arrivals ?? {}).map(([from, point]) => ({ id: `arrival:${from}`, point })),
  ];
  const paths = entries.map(({ id, point }) => {
    const start = [point.x, point.z];
    const middle = [.25, .5, .75].map(t => [start[0] + (center[0] - start[0]) * t,
      start[1] + (center[1] - start[1]) * t]);
    return { id, points: [start, ...middle, center] };
  });
  return { paths };
}

export function validateFogPaths(value) {
  if (!value || typeof value !== 'object' || Object.keys(value).some(key => key !== 'paths')
    || !Array.isArray(value.paths) || value.paths.length > 64) throw new Error('Invalid fog paths');
  const ids = new Set();
  for (const path of value.paths) {
    if (!path || typeof path !== 'object' || Object.keys(path).some(key => !['id', 'points', 'radii'].includes(key))
      || typeof path.id !== 'string' || !/^[a-zA-Z0-9:_-]{1,96}$/.test(path.id) || ids.has(path.id)
      || !Array.isArray(path.points) || path.points.length < 2 || path.points.length > 32
      || path.points.some(point => !Array.isArray(point) || point.length !== 2
        || !point.every(Number.isFinite) || point.some(number => Math.abs(number) > MAX_COORDINATE)))
      throw new Error('Invalid fog path points');
    if (path.radii !== undefined && (!Array.isArray(path.radii) || path.radii.length !== path.points.length
      || path.radii.some(radius => !Number.isFinite(radius) || radius < FOG_PATH_RADIUS_MIN || radius > FOG_PATH_RADIUS_MAX)))
      throw new Error('Invalid fog path radii');
    ids.add(path.id);
  }
  return value;
}
