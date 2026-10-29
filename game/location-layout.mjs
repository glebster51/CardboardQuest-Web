import { extractTerrainContours, smoothClosedContour } from '../terrain-shapes.mjs?v=ab782efa5048549c';
import { EXIT_FOG_ENTRY_OFFSET, EXIT_FOG_EXIT_EXTENSION } from '../exit-fog.mjs?v=ab782efa5048549c';
import { distanceToPolygon, hazardAtPoint, pointInPolygon } from './world-hazards.mjs?v=ab782efa5048549c';

// Corridor centre-lines, room ellipses, and widths in unscaled tabletop units.
// Every branch starts at the safe story point (0,0); its last point is an exit.
const plan = (routes, rooms, width = 2.35) => ({ routes, rooms, width });
export const LOCATION_LAYOUTS = {
  home: plan([[[0, 0], [0, 5], [5, 5], [5, 12]]], [[-1.5, -1, 6.5, 5.8]], 2.2),
  forest: plan([[[0, 0], [0, -11]], [[0, 0], [-7, 3], [-11, 8]], [[0, 0], [7, 4], [11, 10]]], [[0, 0, 4.8, 4.2]], 2.5),
  'stump-hollow': plan([[[0, 0], [0, -10]], [[0, 0], [7, 0], [7, 10]]], [[-1, -2, 4.8, 5]]),
  'squirrel-cache': plan([[[0, 0], [-5, 0], [-5, -11]]], [[-1, 1.5, 5.6, 4.5]], 2.1),
  brook: plan([[[0, 0], [0, -12]], [[0, 0], [6, -1], [11, 3]], [[0, 0], [3, 6], [0, 13]]], [[0, 0, 4.5, 4.5]]),
  'cave-cache': plan([[[0, 0], [-5, 0], [-5, -11]]], [[0, 0, 6.2, 5.3]], 2.2),
  // Both gates stay on the near (south) bank: enter from the south, then
  // follow the shoreline sideways to the west. Nothing routes around the river.
  'broken-bridge': plan([[[0, 11], [0, 18.5]], [[0, 11], [-7, 11], [-12, 8.5], [-14.5, 8.5]]], [[0, 11, 8.4, 7.2]], 2.5),
  'moss-shrine': plan([[[0, 0], [-7, 0], [-7, -10]], [[0, 0], [4, 3], [4, 12]]], [[0, -1, 5.8, 5.5]]),
  camp: plan([[[0, 0], [0, -13]], [[0, 0], [5, 8], [5, 14]]], [[0, 0, 9.1, 8.2]], 2.6),
  'ash-road': plan([[[0, 0], [0, -6], [-4, -14]], [[0, 0], [4, 3], [9, 8]], [[0, 0], [-4, 5], [-8, 12]]], [[0, 0, 4.8, 6.5]], 2.1),
  'goblin-watch': plan([[[0, 0], [-10, 0]], [[0, 0], [3, 5], [3, 12]]], [[0, -1, 5.6, 4.8]], 2.2),
  'herb-glen': plan([[[0, 0], [-11, -2]], [[0, 0], [0, 7], [7, 7], [7, 14]]], [[0, 0, 5.8, 4.3]]),
  'black-creek': plan([[[0, 0], [0, -13]], [[0, 0], [7, -3], [12, -3]],
    [[0, 0], [2, 7], [0, 14]], [[0, 0], [-7, -4], [-12, -4]]], [[0, 0, 4.1, 5.7]], 2.4),
  'old-mill': plan([[[0, 0], [6, 0], [6, -6], [-5, -6], [-9, -11]]], [[-1, -1, 6.3, 5.2]], 2.2),
  quarry: plan([[[0, 0], [-8, 0], [-8, -13]], [[0, 0], [1, 8], [10, 8], [10, 14]]], [[0, 1, 7.4, 6.7]], 2.4),
  cartographer: plan([[[0, 0], [-11, -2]], [[0, 0], [0, 7], [8, 7], [8, 14]]], [[-1, -1, 6.2, 4.9]], 2.3),
  'peat-marsh': plan([[[0, 0], [0, -13]], [[0, 0], [-7, 1], [-12, 5]], [[0, 0], [3, 6], [11, 10]]], [[0, 0, 4.8, 4.8]], 2.25),
  'sunken-cart': plan([[[0, 0], [5, -2], [5, -11]]], [[0, 0, 4.7, 4.2]], 2.2),
  'bone-gate': plan([[[0, 0], [0, -14]], [[0, 0], [4, 7], [4, 15]]], [[0, -1, 6.2, 6.8]], 2.05),
  'hollow-tree': plan([[[0, 0], [-11, 0]], [[0, 0], [0, 7], [8, 7], [8, 14]]], [[0, 0, 6.2, 5.1]], 2.3),
  'scree-pass': plan([[[0, 0], [3, -5], [-6, -8], [-6, -14]], [[0, 0], [-4, 5], [4, 10], [4, 16]]], [[0, 0, 3.6, 4.8]], 1.95),
  'bell-gate': plan([[[0, 0], [-11, 0]], [[0, 0], [0, 7], [7, 7], [7, 14]]], [[0, -2, 5.9, 6]], 2.2),
  'bell-vault': plan([[[0, 0], [0, -14]], [[0, 0], [9, 0], [9, 11]]], [[0, -1, 7.2, 6.7]], 2.35),
  grandpa: plan([[[0, 0], [-5, 0], [-5, -5], [-12, -5]]], [[0, 0, 6.7, 5.7]], 2.3),
};

function segmentDistance(x, z, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
}

function sampleContour(points, count = 184) {
  const lengths = [0];
  for (let i = 0; i < points.length; i++) lengths.push(lengths[i] + Math.hypot(points[i].x - points[(i + 1) % points.length].x,
    points[i].z - points[(i + 1) % points.length].z));
  const total = lengths.at(-1), result = [];
  for (let i = 0, segment = 0; i < count; i++) {
    const target = i / count * total;
    while (lengths[segment + 1] < target) segment++;
    const a = points[segment], b = points[(segment + 1) % points.length];
    const t = (target - lengths[segment]) / (lengths[segment + 1] - lengths[segment] || 1);
    result.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
  }
  return result;
}

function pointBackAlongRoute(route, distance) {
  for (let index = route.length - 1; index > 0; index--) {
    const a = route[index], b = route[index - 1], length = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (distance <= length) return { x: a[0] + (b[0] - a[0]) * distance / length, z: a[1] + (b[1] - a[1]) * distance / length };
    distance -= length;
  }
  return { x: route[0][0], z: route[0][1] };
}

function arrivalOnRoute(route, scale, hazards = []) {
  const isSafe = point => !hazardAtPoint(point.x * scale, point.z * scale, hazards, 1.2);
  // Prefer the first two visible leaf bands; if a pool or pit occupies that
  // exact spot, slide toward the exit within those bands before going farther in.
  for (let offset = EXIT_FOG_ENTRY_OFFSET; offset >= EXIT_FOG_ENTRY_OFFSET - 2; offset -= .25) {
    const candidate = pointBackAlongRoute(route, offset / scale);
    if (isSafe(candidate)) return candidate;
  }
  for (let offset = EXIT_FOG_ENTRY_OFFSET - 2.25; offset >= 2.5; offset -= .25) {
    const candidate = pointBackAlongRoute(route, offset / scale);
    if (isSafe(candidate)) return candidate;
  }
  return { x: route[0][0], z: route[0][1] };
}

export function createAuthoredLayout(id, art, scale = 1.5, exitTargets = []) {
  const layout = LOCATION_LAYOUTS[id];
  if (!layout) throw new Error(`Missing authored layout: ${id}`);
  const layoutRoutes = layout.routes.map((route, index) => {
    const extended = route.map(([x, z]) => [x, z]);
    const end = extended.at(-1), previous = extended.at(-2), length = Math.hypot(end[0] - previous[0], end[1] - previous[1]);
    const target = exitTargets[index];
    extended[extended.length - 1] = target ? [target.x / scale, target.z / scale]
      : [end[0] + (end[0] - previous[0]) / length * EXIT_FOG_EXIT_EXTENSION / scale,
        end[1] + (end[1] - previous[1]) / length * EXIT_FOG_EXIT_EXTENSION / scale];
    return extended;
  });
  const routes = layoutRoutes.map(route => route.map(([x, z]) => [x * scale, z * scale]));
  const rooms = layout.rooms.map(([x, z, rx, rz]) => [x * scale, z * scale, rx * scale, rz * scale]);
  const boundPoints = [...routes.flat().map(([x, z]) => ({ x, z })), ...rooms.flatMap(([x, z, rx, rz]) =>
    [{ x: x - rx, z: z - rz }, { x: x + rx, z: z + rz }]), ...art.hazards.flatMap(hazard => hazard.points)];
  const margin = 4.5 * scale, minX = Math.min(...boundPoints.map(p => p.x)) - margin, minZ = Math.min(...boundPoints.map(p => p.z)) - margin;
  const cellSize = .26 * scale, columns = Math.ceil((Math.max(...boundPoints.map(p => p.x)) + margin - minX) / cellSize) + 1;
  const rows = Math.ceil((Math.max(...boundPoints.map(p => p.z)) + margin - minZ) / cellSize) + 1;
  const values = new Float32Array(columns * rows), width = layout.width * scale;
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const x = minX + col * cellSize, z = minZ + row * cellSize;
    let field = -Infinity;
    for (const route of routes) for (let i = 1; i < route.length; i++) field = Math.max(field, width - segmentDistance(x, z, route[i - 1], route[i]));
    for (const [cx, cz, rx, rz] of rooms) {
      const angle = Math.atan2(z - cz, x - cx), organic = 1 + .045 * Math.sin(angle * 5 + art.phase);
      field = Math.max(field, (organic - Math.hypot((x - cx) / rx, (z - cz) / rz)) * Math.min(rx, rz));
    }
    for (const hazard of art.hazards) {
      if (hazard.kind === 'depth-water') continue;
      const distance = distanceToPolygon(x, z, hazard.points), inside = pointInPolygon(x, z, hazard.points);
      field = Math.max(field, 2.05 * scale + (inside ? distance : -distance));
    }
    values[row * columns + col] = field;
  }
  const contours = extractTerrainContours({ minX, minZ, columns, rows, values, cellSize }, 0);
  const area = points => Math.abs(points.reduce((sum, p, i) => sum + p.x * points[(i + 1) % points.length].z
    - points[(i + 1) % points.length].x * p.z, 0));
  const outer = contours.sort((a, b) => area(b) - area(a))[0];
  if (!outer) throw new Error(`No connected floor contour: ${id}`);
  const exits = layoutRoutes.map(route => {
    const end = route.at(-1), previous = route.at(-2), length = Math.hypot(end[0] - previous[0], end[1] - previous[1]);
    const arrival = arrivalOnRoute(route, scale, art.hazards);
    return { x: end[0] * scale, z: end[1] * scale,
      dirX: (end[0] - previous[0]) / length, dirZ: (end[1] - previous[1]) / length,
      halfWidth: width + .15, halfDepth: 1.3, arrival: { x: arrival.x * scale, z: arrival.z * scale } };
  });
  return { points: smoothClosedContour(sampleContour(outer), 4), exits,
    ...(id === 'broken-bridge' ? { entry: { x: 0, z: 11 * scale } } : {}) };
}
