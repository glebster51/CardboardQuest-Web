import { makePlayfieldCardboardMaterial, makeRoughCardboardMaterial } from '../cardboard-surface.mjs';

function terrainShape(THREE, outerPoints) {
  const shape = new THREE.Shape();
  const outer = outerPoints.map(point => new THREE.Vector2(point.x, -point.z));
  const ordered = THREE.ShapeUtils.isClockWise(outer) ? [...outer].reverse() : outer;
  shape.moveTo(ordered[0].x, ordered[0].y);
  for (let i = 1; i < ordered.length; i++) shape.lineTo(ordered[i].x, ordered[i].y);
  shape.closePath();
  return shape;
}

function shapesFromContours(THREE, contours) {
  const records = contours.map(points => {
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      area += a.x * b.z - b.x * a.z;
    }
    return { points, area: Math.abs(area), parent: null, depth: 0 };
  });
  const contains = (point, polygon) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i], b = polygon[j];
      if ((a.z > point.z) !== (b.z > point.z)
        && point.x < (b.x - a.x) * (point.z - a.z) / (b.z - a.z) + a.x) inside = !inside;
    }
    return inside;
  };
  for (const record of records) {
    record.parent = records.filter(candidate => candidate.area > record.area && contains(record.points[0], candidate.points))
      .sort((a, b) => a.area - b.area)[0] || null;
  }
  const depthOf = record => record.parent ? depthOf(record.parent) + 1 : 0;
  records.forEach(record => { record.depth = depthOf(record); });
  return records.filter(record => record.depth % 2 === 0).map(record => {
    const shape = terrainShape(THREE, record.points);
    for (const child of records) if (child.parent === record && child.depth === record.depth + 1) {
      const points = child.points.map(point => new THREE.Vector2(point.x, -point.z));
      const ordered = THREE.ShapeUtils.isClockWise(points) ? points : [...points].reverse();
      const hole = new THREE.Path();
      hole.moveTo(ordered[0].x, ordered[0].y);
      for (let i = 1; i < ordered.length; i++) hole.lineTo(ordered[i].x, ordered[i].y);
      hole.closePath(); shape.holes.push(hole);
    }
    return shape;
  });
}

function containsPoint(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.z > point.z) !== (b.z > point.z)
      && point.x < (b.x - a.x) * (point.z - a.z) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

export function filterTerrainContours(contours, walkablePoints) {
  const center = walkablePoints.reduce((sum, point) => ({ x: sum.x + point.x / walkablePoints.length,
    z: sum.z + point.z / walkablePoints.length }), { x: 0, z: 0 });
  return contours.filter(contour => contour.length >= 3 && !containsPoint(center, contour));
}

const TERRAIN_PALETTES = {
  home: { tops: [0x84964c, 0x9ca657, 0xb4a868, 0xc0a873], side: 0x805b39 },
  forest: { tops: [0x647e43, 0x78884b, 0x9c975b, 0xb29d70], side: 0x67472e },
  camp: { tops: [0x8a784e, 0x9e8953, 0xb2a067, 0xc1ad78], side: 0x775037 },
  river: { tops: [0x71836f, 0x849478, 0xa19d70, 0xb8a57b], side: 0x66563d },
  cave: { tops: [0x716b59, 0x82785f, 0x978365, 0xa89570], side: 0x5f4834 },
  ruins: { tops: [0x747e5c, 0x858861, 0x9b936b, 0xb2a079], side: 0x67503a },
  ridge: { tops: [0x7f754e, 0x918252, 0xa69462, 0xb9a678], side: 0x704c31 },
  meadow: { tops: [0x829351, 0x9ba25d, 0xb0a66a, 0xc1ae7b], side: 0x78603c },
  quarry: { tops: [0x817d69, 0x979176, 0xaca17e, 0xc0ae82], side: 0x65523b },
  marsh: { tops: [0x687b55, 0x7f895e, 0x99916a, 0xb1a079], side: 0x594c37 },
  vault: { tops: [0x70735c, 0x858168, 0x9a8c70, 0xb09d7c], side: 0x58432f },
};

export function createArenaCliffSegments(location) {
  const { walkablePoints, exits = [], dropZones = [] } = location;
  const segments = [];
  for (let index = 0; index < walkablePoints.length; index++) {
    const a = walkablePoints[index], b = walkablePoints[(index + 1) % walkablePoints.length];
    const x = (a.x + b.x) / 2, z = (a.z + b.z) / 2;
    if (exits.some(exit => Math.hypot(exit.x - x, exit.z - z) < 3.1)) continue;
    if (dropZones.some(zone => Math.hypot(zone.x - x, zone.z - z) < zone.radius)) continue;
    const dx = b.x - a.x, dz = b.z - a.z;
    const length = Math.hypot(dx, dz);
    const height = 1.15 + .65 * (.5 + .5 * Math.sin(index * 1.73 + (location.heightSeed % 97)));
    const outwardX = x, outwardZ = z, outwardLength = Math.hypot(outwardX, outwardZ) || 1;
    segments.push({
      x: x + outwardX / outwardLength * .22, z: z + outwardZ / outwardLength * .22,
      length: length + .1, height, angle: Math.atan2(-dz, dx),
    });
  }
  return segments;
}

function addArenaCliff(THREE, location, palette, corrugation, sceneStencil) {
  const segments = createArenaCliffSegments(location);
  if (!segments.length) return;
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const side = makeRoughCardboardMaterial(THREE, corrugation, palette.side, sceneStencil);
  const top = makeRoughCardboardMaterial(THREE, corrugation, palette.tops[1], sceneStencil);
  const mesh = new THREE.InstancedMesh(geometry, [side, side, top, side, side, side], segments.length);
  const matrix = new THREE.Matrix4();
  segments.forEach((segment, index) => {
    const position = new THREE.Vector3(segment.x, segment.height / 2 - .07, segment.z);
    const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), segment.angle);
    const scale = new THREE.Vector3(segment.length, segment.height, .68);
    matrix.compose(position, rotation, scale);
    mesh.setMatrixAt(index, matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = `cardboard-cliff-${location.id}`;
  location.sceneGroup.add(mesh);
}

export function createTerrainRenderer({ THREE, locations, createTerrainHeightMap, extractTerrainContours,
  paper, playfieldCardboard = paper, roughCardboard = paper, terrainCorrugation, sceneStencil, maxHeight = 3.6 }) {
  for (const location of Object.values(locations)) {
    const seed = location.heightSeed ?? (location.id === 'home' ? 8128 : location.id === 'forest' ? 42119 : 99731);
    const bounds = location.walkablePoints.reduce((result, point) => ({
      minX: Math.min(result.minX, point.x), maxX: Math.max(result.maxX, point.x),
      minZ: Math.min(result.minZ, point.z), maxZ: Math.max(result.maxZ, point.z),
    }), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity });
    const terrainMargin = 6;
    const heightMap = createTerrainHeightMap(seed, location.walkablePoints,
      { minX: bounds.minX - terrainMargin, maxX: bounds.maxX + terrainMargin,
        minZ: bounds.minZ - terrainMargin, maxZ: bounds.maxZ + terrainMargin,
        cellSize: .85, step: .24, maxHeight });
    location.terrainHeightMap = heightMap;
    location.sceneGroup.userData.terrainHeightMap = heightMap;
    const palette = TERRAIN_PALETTES[location.terrainStyle ?? location.id] ?? TERRAIN_PALETTES.forest;
    const layers = [{
      shapes: [terrainShape(THREE, location.walkablePoints)], depth: .3, top: 0,
      topColor: palette.tops[0], sideColor: palette.side,
    }, ...heightMap.layers.filter(layer => layer.contours.length).map((layer, index) => ({
      shapes: shapesFromContours(THREE, filterTerrainContours(layer.contours, location.walkablePoints)),
      depth: heightMap.step, top: layer.height,
      topColor: palette.tops[(index + 2) % palette.tops.length],
      sideColor: index % 2 ? palette.side : 0x9c7243,
    }))];

    for (const layer of layers) {
      if (!layer.shapes.length) continue;
      const uvGenerator = {
        generateTopUV(_geometry, vertices, a, b, c) {
          return [a, b, c].map(index => new THREE.Vector2(vertices[index * 3], vertices[index * 3 + 1]));
        },
        generateSideWallUV(_geometry, vertices, a, b, c, d) {
          const horizontal = Math.abs(vertices[b * 3] - vertices[a * 3])
            >= Math.abs(vertices[b * 3 + 1] - vertices[a * 3 + 1]);
          return [a, b, c, d].map(index => {
            const alongEdge = horizontal ? vertices[index * 3] : vertices[index * 3 + 1];
            return new THREE.Vector2(alongEdge * .25, vertices[index * 3 + 2] / layer.depth);
          });
        },
      };
      const geometry = new THREE.ExtrudeGeometry(layer.shapes, {
        depth: layer.depth, bevelEnabled: false, steps: 1, UVGenerator: uvGenerator,
      });
      geometry.rotateX(-Math.PI / 2);
      const topMaterial = layer.top === 0
        ? makePlayfieldCardboardMaterial(THREE, playfieldCardboard, layer.topColor, sceneStencil)
        : makeRoughCardboardMaterial(THREE, roughCardboard, layer.topColor, sceneStencil);
      const mesh = new THREE.Mesh(geometry, [
        topMaterial,
        makeRoughCardboardMaterial(THREE, terrainCorrugation, layer.sideColor, sceneStencil),
      ]);
      mesh.position.y = layer.top - layer.depth;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      location.sceneGroup.add(mesh);
    }
    addArenaCliff(THREE, location, palette, terrainCorrugation, sceneStencil);
  }
}
