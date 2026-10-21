const MAX_COORDINATE = 1000;

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
    if (!path || typeof path !== 'object' || Object.keys(path).some(key => !['id', 'points'].includes(key))
      || typeof path.id !== 'string' || !/^[a-zA-Z0-9:_-]{1,96}$/.test(path.id) || ids.has(path.id)
      || !Array.isArray(path.points) || path.points.length < 2 || path.points.length > 32
      || path.points.some(point => !Array.isArray(point) || point.length !== 2
        || !point.every(Number.isFinite) || point.some(number => Math.abs(number) > MAX_COORDINATE)))
      throw new Error('Invalid fog path points');
    ids.add(path.id);
  }
  return value;
}
