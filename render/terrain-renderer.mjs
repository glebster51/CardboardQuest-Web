import { makePlayfieldCardboardMaterial, makeRoughCardboardMaterial } from '../cardboard-surface.mjs';
import { exitRoadContinuation } from '../game/location-art.mjs';

function terrainShape(THREE, outerPoints, holes = []) {
  const shape = new THREE.Shape();
  const outer = outerPoints.map(point => new THREE.Vector2(point.x, -point.z));
  const ordered = THREE.ShapeUtils.isClockWise(outer) ? [...outer].reverse() : outer;
  shape.moveTo(ordered[0].x, ordered[0].y);
  for (let i = 1; i < ordered.length; i++) shape.lineTo(ordered[i].x, ordered[i].y);
  shape.closePath();
  for (const points of holes) {
    const vertices = points.map(point => new THREE.Vector2(point.x, -point.z));
    const orderedHole = THREE.ShapeUtils.isClockWise(vertices) ? vertices : [...vertices].reverse();
    const hole = new THREE.Path();
    hole.moveTo(orderedHole[0].x, orderedHole[0].y);
    for (const vertex of orderedHole.slice(1)) hole.lineTo(vertex.x, vertex.y);
    hole.closePath(); shape.holes.push(hole);
  }
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

/** A solid footprint beneath the noisy terrace islands, so low valleys cannot show through. */
export function createTerrainBackingOutline(contours, padding = .75) {
  const points = contours.flatMap(contour => contour.flatMap(point => [
    { x: point.x - padding, z: point.z - padding }, { x: point.x + padding, z: point.z - padding },
    { x: point.x + padding, z: point.z + padding }, { x: point.x - padding, z: point.z + padding },
  ])).sort((a, b) => a.x - b.x || a.z - b.z);
  if (points.length < 3) return [];
  const cross = (a, b, c) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
  const lower = [];
  for (const point of points) {
    while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), point) <= 0) lower.pop();
    lower.push(point);
  }
  const upper = [];
  for (let index = points.length - 1; index >= 0; index--) {
    const point = points[index];
    while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), point) <= 0) upper.pop();
    upper.push(point);
  }
  lower.pop(); upper.pop();
  return [...lower, ...upper];
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

function addDropZoneUnderside(THREE, location) {
  for (const zone of location.dropZones ?? []) {
    const length = Math.hypot(zone.x, zone.z) || 1;
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(zone.radius + 1.8, 48),
      new THREE.MeshBasicMaterial({ color: zone.kind === 'water' ? 0x285d6e : 0x171b24, side: THREE.DoubleSide }));
    mesh.scale.set(1.7, 1, 1);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(zone.x + zone.x / length * 1.8, -.58, zone.z + zone.z / length * 1.8);
    mesh.name = `abyss-underlayer-${location.id}`;
    location.sceneGroup.add(mesh);
  }
}

function addHazardBasins(THREE, location, paper, corrugation) {
  for (const hazard of location.hazards ?? []) {
    if (hazard.kind === 'cliff') continue;
    const center = hazard.points.reduce((p, v) => ({ x: p.x + v.x / hazard.points.length,
      z: p.z + v.z / hazard.points.length }), { x: 0, z: 0 });
    const inset = amount => hazard.points.map(p => ({ x: center.x + (p.x - center.x) * amount,
      z: center.z + (p.z - center.z) * amount }));
    for (let index = 0; index < 3; index++) {
      const shape = terrainShape(THREE, inset(1 - index * .055), [inset(1 - (index + 1) * .055)]);
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: .2, bevelEnabled: false });
      geometry.rotateX(-Math.PI / 2);
      const material = makeRoughCardboardMaterial(THREE, paper,
        hazard.kind === 'abyss' ? [0x71694c, 0x504936, 0x302d27][index] : [0x857d54, 0x656543, 0x3f5147][index]);
      const wall = new THREE.Mesh(geometry, [material, makeRoughCardboardMaterial(THREE, corrugation, 0x65503a)]);
      wall.position.y = -.2 - index * .22; wall.receiveShadow = true;
      location.sceneGroup.add(wall);
    }
    const water = hazard.kind !== 'abyss';
    const surface = new THREE.Mesh(new THREE.ShapeGeometry(terrainShape(THREE, inset(.87))),
      new THREE.MeshStandardMaterial({ color: hazard.kind === 'peat' ? 0x284745 : water ? 0x318a9c : 0x11151e,
        roughness: water ? .72 : 1, metalness: 0, side: THREE.DoubleSide }));
    surface.rotation.x = -Math.PI / 2;
    // Keep water close under the playfield cut-out; dropping it below the
    // cardboard backing makes shallow rivers disappear from an oblique view.
    surface.position.y = hazard.kind === 'abyss' ? -.79 : .025;
    surface.name = `hazard-${hazard.id}`; surface.receiveShadow = true;
    location.sceneGroup.add(surface);
  }
  const bank = location.art?.terrain?.cliffBank;
  if (bank) {
    const color = [0x9b8059, 0x8b704e, 0x7b6043, 0x6c533c];
    const count = Math.max(1, Math.trunc(bank.layers ?? 18));
    const wallPositions = [], wallIndices = [], wallUvs = [];
    const wallSegments = 60;
    for (let index = 0; index <= wallSegments; index++) {
      const t = index / wallSegments, x = bank.minX + t * (bank.maxX - bank.minX);
      const noise = Math.sin(x * .21 + (bank.seed ?? 1)) * .24 + Math.sin(x * .43 - 1.1) * .12;
      const z = bank.frontZ + noise, peak = bank.height * (.82 + .18 * Math.sin(t * Math.PI * 2.3 + .6));
      wallPositions.push(x, 0, -z, x, peak, -z);
      wallUvs.push(t * 8, 0, t * 8, peak * .45);
      if (index < wallSegments) {
        const a = index * 2, b = a + 2;
        wallIndices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const wallGeometry = new THREE.BufferGeometry();
    wallGeometry.setAttribute('position', new THREE.Float32BufferAttribute(wallPositions, 3));
    wallGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(wallUvs, 2));
    wallGeometry.setIndex(wallIndices); wallGeometry.computeVertexNormals();
    const wall = new THREE.Mesh(wallGeometry, makeRoughCardboardMaterial(THREE, corrugation, 0x604832));
    wall.material.side = THREE.DoubleSide;
    wall.castShadow = true; wall.receiveShadow = true;
    wall.name = `river-cliff-face-${location.id}`;
    location.sceneGroup.add(wall);
    for (let tier = 0; tier < count; tier++) {
      const progress = tier / Math.max(1, count - 1);
      const halfWidth = (bank.maxX - bank.minX) * (.5 - progress * .075);
      const steps = 30, front = [], rear = [];
      for (let index = 0; index <= steps; index++) {
        const x = -halfWidth + index / steps * halfWidth * 2;
        const noise = Math.sin(x * .21 + (bank.seed ?? 1)) * .24 + Math.sin(x * .43 - 1.1) * .12;
        const z = bank.frontZ + noise + progress * 6;
        front.push({ x, z });
        rear.push({ x: x * .985, z: z + .48 + .14 * Math.sin(x * .09 + tier * .17) });
      }
      const shape = terrainShape(THREE, [...front, ...rear.reverse()]);
      const depth = .3, top = (tier + 1) * (bank.height / count);
      const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1 });
      geometry.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geometry, [
        makeRoughCardboardMaterial(THREE, paper, color[tier % color.length]),
        makeRoughCardboardMaterial(THREE, corrugation, 0x59412e),
      ]);
      mesh.position.y = top - depth;
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.name = `river-cliff-tier-${location.id}-${tier}`;
      location.sceneGroup.add(mesh);
    }
  }
}

export function createTerrainRenderer({ THREE, locations, createTerrainHeightMap, extractTerrainContours,
  paper, playfieldCardboard = paper, roughCardboard = paper, terrainCorrugation, sceneStencil, maxHeight = 3.6 }) {
  for (const location of Object.values(locations)) {
    const seed = location.heightSeed ?? (location.id === 'home' ? 8128 : location.id === 'forest' ? 42119 : 99731);
    const bounds = location.walkablePoints.reduce((result, point) => ({
      minX: Math.min(result.minX, point.x), maxX: Math.max(result.maxX, point.x),
      minZ: Math.min(result.minZ, point.z), maxZ: Math.max(result.maxZ, point.z),
    }), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity });
    const terrainMargin = 30;
    const heightMap = createTerrainHeightMap(seed, location.walkablePoints,
      { minX: bounds.minX - terrainMargin, maxX: bounds.maxX + terrainMargin,
        minZ: bounds.minZ - terrainMargin, maxZ: bounds.maxZ + terrainMargin,
        cellSize: .7, step: .24, maxHeight, ...location.art?.terrain,
        exits: location.exits, dropZones: location.dropZones });
    location.terrainHeightMap = heightMap;
    location.sceneGroup.userData.terrainHeightMap = heightMap;
    const palette = TERRAIN_PALETTES[location.terrainStyle ?? location.id] ?? TERRAIN_PALETTES.forest;
    const backingOutline = createTerrainBackingOutline(extractTerrainContours(heightMap, .001));
    if (backingOutline.length >= 3) {
      const shape = terrainShape(THREE, backingOutline, [location.walkablePoints]);
      const depth = .3;
      const backing = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1 }), [
        makeRoughCardboardMaterial(THREE, roughCardboard, palette.tops[0], sceneStencil),
        makeRoughCardboardMaterial(THREE, terrainCorrugation, palette.side, sceneStencil),
      ]);
      backing.rotation.x = -Math.PI / 2;
      backing.position.y = -depth - .015;
      backing.receiveShadow = true;
      backing.name = `terrain-backing-${location.id}`;
      location.sceneGroup.add(backing);
    }
    const layers = [{
      shapes: [terrainShape(THREE, location.walkablePoints, (location.hazards ?? []).map(hazard => hazard.points))], depth: .3, top: 0,
      topColor: palette.tops[0], sideColor: palette.side,
    }, ...heightMap.layers.filter(layer => layer.contours.length).map((layer, index) => ({
      shapes: shapesFromContours(THREE, layer.contours),
      depth: heightMap.step, top: layer.height,
      topColor: palette.tops[(index + 2) % palette.tops.length],
      sideColor: index % 2 ? palette.side : 0x9c7243,
    }))];

    if (location.art) layers.push({ shapes: location.exits.map(exit => terrainShape(THREE, exitRoadContinuation(exit))),
      depth: .3, top: 0, topColor: palette.tops[0], sideColor: palette.side });

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
    addDropZoneUnderside(THREE, location);
    addHazardBasins(THREE, location, roughCardboard, terrainCorrugation);
  }
}
