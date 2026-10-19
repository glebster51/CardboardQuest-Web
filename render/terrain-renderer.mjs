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

const TERRAIN_PALETTES = {
  home: { tops: [0x84964c, 0x9ca657, 0xb4a868, 0xc0a873], side: 0x805b39 },
  forest: { tops: [0x647e43, 0x78884b, 0x9c975b, 0xb29d70], side: 0x67472e },
  camp: { tops: [0x8a784e, 0x9e8953, 0xb2a067, 0xc1ad78], side: 0x775037 },
};

export function createTerrainRenderer({ THREE, locations, createTerrainHeightMap, extractTerrainContours,
  paper, terrainCorrugation, sceneStencil }) {
  for (const location of Object.values(locations)) {
    const seed = location.id === 'home' ? 8128 : location.id === 'forest' ? 42119 : 99731;
    const heightMap = createTerrainHeightMap(seed, location.walkablePoints,
      { cellSize: .85, step: .24, maxHeight: 3.6 });
    location.terrainHeightMap = heightMap;
    location.sceneGroup.userData.terrainHeightMap = heightMap;
    const palette = TERRAIN_PALETTES[location.id];
    const layers = [{
      shapes: [terrainShape(THREE, location.walkablePoints)], depth: .3, top: 0,
      topColor: palette.tops[0], sideColor: palette.side,
    }, {
      shapes: shapesFromContours(THREE, extractTerrainContours(heightMap, .001)),
      depth: heightMap.step, top: heightMap.step, topColor: palette.tops[1], sideColor: palette.side,
    }, ...heightMap.layers.filter(layer => layer.contours.length).map((layer, index) => ({
      shapes: shapesFromContours(THREE, layer.contours), depth: heightMap.step, top: layer.height,
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
      const mesh = new THREE.Mesh(geometry, [
        new THREE.MeshStandardMaterial({ color: layer.topColor, map: layer.top === 0 ? paper : null,
          roughness: .96, ...sceneStencil }),
        new THREE.MeshStandardMaterial({ color: layer.sideColor, map: terrainCorrugation,
          roughness: 1, ...sceneStencil }),
      ]);
      mesh.position.y = layer.top - layer.depth;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      location.sceneGroup.add(mesh);
    }
  }
}
