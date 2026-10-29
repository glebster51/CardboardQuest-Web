import { GROUND_GRID_COLOR_DEFAULT, GROUND_GRID_DEFAULTS } from '../ground-grid-settings.mjs?v=ab782efa5048549c';
import {terrainGroundContains} from '../game/terrain-ground-domain.mjs?v=ab782efa5048549c';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const pointInPolygon = (x, z, points) => {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if ((a.z > z) !== (b.z > z) && x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
};

function scanCrossings(fixed, vertical, points) {
  const values = [];
  if (!points?.length) return values;
  for (let index = 0; index < points.length; index++) {
    const a = points[index], b = points[(index + 1) % points.length];
    const aFixed = vertical ? a.x : a.z, bFixed = vertical ? b.x : b.z;
    if ((aFixed <= fixed && bFixed > fixed) || (bFixed <= fixed && aFixed > fixed)) {
      const t = (fixed - aFixed) / (bFixed - aFixed);
      values.push(vertical ? a.z + (b.z - a.z) * t : a.x + (b.x - a.x) * t);
    }
  }
  return values;
}

/** Returns playable pieces of each world-space grid line, excluding hazard polygons. */
export function groundGridSegments(points, hazards = [], spacing = 1, majorEvery = 5) {
  return groundGridDomainSegments({floor:[points],blockers:[]},hazards,spacing,majorEvery);
}

export function groundGridDomainSegments(domain,hazards=[],spacing=1,majorEvery=5) {
  const points=domain.floor.flat();
  if (points.length < 3 || !(spacing > 0)) return [];
  const bounds = points.reduce((box, point) => ({
    minX: Math.min(box.minX, point.x), maxX: Math.max(box.maxX, point.x),
    minZ: Math.min(box.minZ, point.z), maxZ: Math.max(box.maxZ, point.z),
  }), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity });
  const result = [], validHazards = hazards.filter(hazard => hazard.points?.length >= 3);
  const appendLines = (vertical, min, max) => {
    const start = Math.ceil(min / spacing), end = Math.floor(max / spacing);
    for (let index = start; index <= end; index++) {
      const fixed = index * spacing, breaks = [];
      for(const contour of [...domain.floor,...domain.blockers.flat()])breaks.push(...scanCrossings(fixed,vertical,contour));
      for (const hazard of validHazards) breaks.push(...scanCrossings(fixed, vertical, hazard.points));
      breaks.sort((a, b) => a - b);
      for (let cursor = 1; cursor < breaks.length; cursor++) {
        const a = breaks[cursor - 1], b = breaks[cursor];
        if (b - a < 1e-4) continue;
        const mid = (a + b) * .5, x = vertical ? fixed : mid, z = vertical ? mid : fixed;
        if (!terrainGroundContains(domain,x,z) || validHazards.some(hazard => pointInPolygon(x, z, hazard.points))) continue;
        result.push({ vertical, fixed, start: a, end: b, major: Math.abs(index % majorEvery) < 1e-8 });
      }
    }
  };
  appendLines(true, bounds.minX, bounds.maxX);
  appendLines(false, bounds.minZ, bounds.maxZ);
  return result;
}

function makeLineGeometry(THREE, segments, lineWidth, major) {
  const half = lineWidth * (major ? 0.72 : 0.34), positions = [];
  const addQuad = (x1, z1, x2, z2) => {
    const vertices = [[x1 - half, .032, z1], [x1 + half, .032, z1], [x2 + half, .032, z2],
      [x1 - half, .032, z1], [x2 + half, .032, z2], [x2 - half, .032, z2]];
    for (const vertex of vertices) positions.push(...vertex);
  };
  for (const line of segments) {
    if (line.major !== major) continue;
    if (line.vertical) addQuad(line.fixed, line.start, line.fixed, line.end);
    else {
      const x1 = line.start, x2 = line.end, z = line.fixed;
      const vertices = [[x1, .032, z - half], [x1, .032, z + half], [x2, .032, z + half],
        [x1, .032, z - half], [x2, .032, z + half], [x2, .032, z - half]];
      for (const vertex of vertices) positions.push(...vertex);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** A world-space metric grid made from clipped line strips, independent of shader derivatives. */
export function createGroundGrid(THREE, location, settings = GROUND_GRID_DEFAULTS,
  color = GROUND_GRID_COLOR_DEFAULT) {
  if (!location?.walkablePoints?.length || !location.sceneGroup) return null;
  const group = new THREE.Group();
  group.name = `ground-metric-grid-${location.id}`;
  const minorMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: settings.opacity * .72,
    depthWrite: false, depthTest: true, side: THREE.DoubleSide, toneMapped: false });
  const majorMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: settings.opacity,
    depthWrite: false, depthTest: true, side: THREE.DoubleSide, toneMapped: false });
  const minorMesh = new THREE.Mesh(new THREE.BufferGeometry(), minorMaterial);
  const majorMesh = new THREE.Mesh(new THREE.BufferGeometry(), majorMaterial);
  minorMesh.name = `${group.name}-minor`; majorMesh.name = `${group.name}-major`;
  for (const mesh of [minorMesh, majorMesh]) {
    mesh.renderOrder = .5; mesh.frustumCulled = false; mesh.userData.locationFogSurface = true;
    group.add(mesh); location.edgeShade?.applyTo(mesh);
  }
  const renderedMinorMaterial = minorMesh.material, renderedMajorMaterial = majorMesh.material;
  let currentSettings=settings;
  const rebuild = next => {
    currentSettings=next;
    const domain=location.terrainHeightMap?.groundDomain??{floor:[location.walkablePoints],blockers:[]};
    const segments = next.enabled ? groundGridDomainSegments(domain, location.hazards,
      clamp(next.spacing, .25, 8), clamp(next.majorEvery, 1, 20)) : [];
    const minor = makeLineGeometry(THREE, segments, clamp(next.lineWidth, .004, .12), false);
    const major = makeLineGeometry(THREE, segments, clamp(next.lineWidth, .004, .12), true);
    minorMesh.geometry.dispose(); majorMesh.geometry.dispose();
    minorMesh.geometry = minor; majorMesh.geometry = major;
    renderedMinorMaterial.opacity = clamp(next.opacity, 0, .7) * .72;
    renderedMajorMaterial.opacity = clamp(next.opacity, 0, .7);
    renderedMinorMaterial.needsUpdate = true; renderedMajorMaterial.needsUpdate = true;
    group.userData.gridSegmentCount = segments.length;
  };
  group.userData.updateGroundGrid = next => rebuild(next);
  group.userData.refreshTerrain = () => rebuild(currentSettings);
  group.userData.setGroundGridColor = next => { renderedMinorMaterial.color.set(next); renderedMajorMaterial.color.set(next); };
  group.userData.updateGroundGrid(settings);
  location.sceneGroup.add(group);
  location.groundGridMesh = group;
  return group;
}
