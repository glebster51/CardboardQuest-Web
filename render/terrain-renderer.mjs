import { makePlayfieldCardboardMaterial, makeRoughCardboardMaterial } from '../cardboard-surface.mjs?v=7c14a71de3a9af87';
import { exitRoadContinuation } from '../game/location-art.mjs?v=7c14a71de3a9af87';
import { coarsenClosedTerrainContour, smoothClosedContour, createTerrainHeightMap as defaultHeightMap,
  createTerrainHeightMapFromDepthMap as defaultDepthMap, extractTerrainContours as defaultContours } from '../terrain-shapes.mjs?v=7c14a71de3a9af87';
import { terrainLevelCenter, terrainSideTriangleMask } from '../terrain-side-culling.mjs?v=7c14a71de3a9af87';
import { buildFogPathTopology } from './location-edge-shade.mjs?v=7c14a71de3a9af87';
import { terrainSurfaceContours } from './terrain-cutouts.mjs?v=7c14a71de3a9af87';
import { createTerrainVolume, createVolumeCollisionField } from '../game/terrain-volume.mjs?v=7c14a71de3a9af87';
import {createVisibleTerrainSlices} from './terrain-visibility.mjs?v=7c14a71de3a9af87';
import {createTerrainSafetyFloor} from './terrain-safety-floor.mjs?v=7c14a71de3a9af87';
import {terrainOperations,isHeightStroke} from '../game/terrain-brush.mjs?v=7c14a71de3a9af87';
import {simpleTerrainLayout} from '../game/terrain-base.mjs?v=7c14a71de3a9af87';

const TERRACE_HEIGHT_SCALE = 3;

/** Shared by the renderer and Apply: bake exactly the same terrain data. */
export function createLocationTerrainData(location,{createTerrainHeightMap=defaultHeightMap,
  createTerrainHeightMapFromDepthMap=defaultDepthMap,extractTerrainContours=defaultContours,maxHeight=3.6}={}) {
  const seed=location.heightSeed??(location.id==='home'?8128:location.id==='forest'?42119:99731);
  const bounds=location.walkablePoints.reduce((r,p)=>({minX:Math.min(r.minX,p.x),maxX:Math.max(r.maxX,p.x),
    minZ:Math.min(r.minZ,p.z),maxZ:Math.max(r.maxZ,p.z)}),{minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity});
  const simple=location.terrainEdits?.base==='simple'?simpleTerrainLayout(location):null;
  const terraceStep=simple ? .72 : (location.art?.depthMap?.elevation?.step??location.art?.terrain?.step??.24)*TERRACE_HEIGHT_SCALE;
  const operations=terrainOperations(location.terrainEdits),firstVolume=operations.findIndex(stroke=>!isHeightStroke(stroke));
  const prefix=location.terrainBake?.volume?0:firstVolume<0?operations.length:firstVolume;
  const sculpt={sculptEdits:{...location.terrainEdits,strokes:operations.slice(0,prefix),volumeStrokes:[]},bakedHeight:location.terrainBake?.height,step:terraceStep};
  const heightMap=simple?createTerrainHeightMap(9137,location.walkablePoints,{...simple.bounds,cellSize:.7,step:terraceStep,
      maxHeight:3.6,edgeHeight:0,peakCount:0,heightAt:simple.heightAt,...sculpt}):location.art?.depthMap
    ?createTerrainHeightMapFromDepthMap(location.art.depthMap,location.walkablePoints,sculpt)
    :createTerrainHeightMap(seed,location.walkablePoints,{minX:bounds.minX-30,maxX:bounds.maxX+30,
      minZ:bounds.minZ-30,maxZ:bounds.maxZ+30,cellSize:.7,maxHeight,...location.art?.terrain,
      exits:location.exits,dropZones:location.dropZones,...sculpt});
  let backingOutline;
  heightMap.baseKind=simple?'simple':'authored';
  if(simple){
    // Keep scenery's authored height reference stable when replacing the base.
    // Only the new simple height field is used to build visible terrain.
    const reference=location.art?.depthMap?createTerrainHeightMapFromDepthMap(location.art.depthMap,location.walkablePoints,{step:terraceStep})
      :createTerrainHeightMap(seed,location.walkablePoints,{...simple.bounds,cellSize:.7,maxHeight,...location.art?.terrain,
        exits:location.exits,dropZones:location.dropZones,step:terraceStep});
    heightMap.baseValues=Float32Array.from(heightMap.values,(_,i)=>reference.sample(heightMap.minX+i%heightMap.columns*heightMap.cellSize,
      heightMap.minZ+Math.floor(i/heightMap.columns)*heightMap.cellSize));
    const mask={...heightMap,values:Float32Array.from(heightMap.values,(_,i)=>simple.footprintAt(heightMap.minX+i%heightMap.columns*heightMap.cellSize,
      heightMap.minZ+Math.floor(i/heightMap.columns)*heightMap.cellSize))};
    backingOutline=extractTerrainContours(mask,0).map(contour=>smoothClosedContour(contour,4)).sort((a,b)=>b.length-a.length)[0]??[];
  }else backingOutline=createTerrainBackingOutline(extractTerrainContours(heightMap,.001));
  heightMap.volume=createTerrainVolume(heightMap,backingOutline.length>=3?backingOutline:location.walkablePoints,
    operations.slice(prefix),location.terrainBake?.volume);
  // Height-only edits used to fall back to separate playfield, backing and
  // exit-road meshes. Their independently cut/coarsened borders leave cracks.
  // Every edited surface must use the same density slices as volume brushes.
  heightMap.volume.renderUnified=Boolean(simple)||heightMap.volume.edited||operations.length>0||Boolean(location.terrainBake);
  if(heightMap.volume.edited)heightMap.volume.clearance=createVolumeCollisionField(heightMap.volume);
  return {heightMap,backingOutline,terraceStep};
}

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

function shapesFromContours(THREE, contours, reduction = 3) {
  const records = contours.map(contour => {
    const points = coarsenClosedTerrainContour(contour, reduction);
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

function cullFogHiddenOutwardWalls(THREE, geometry, levelCenter, fogTopology, fogSettings) {
  const expanded = geometry.index ? geometry.toNonIndexed() : geometry;
  const positions = expanded.getAttribute('position').array;
  const keep = terrainSideTriangleMask(positions, expanded.groups, levelCenter, fogTopology, fogSettings);
  if (keep.every(Boolean)) {
    if (expanded !== geometry) expanded.dispose();
    return geometry;
  }
  const filtered = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(expanded.attributes)) {
    const values = []; let outputVertexCount = 0;
    for (const group of expanded.groups) {
      const groupStart = outputVertexCount;
      const start = group.start, end = Math.min(positions.length / 3, start + group.count);
      for (let vertex = start; vertex + 2 < end; vertex += 3) {
        if (!keep[vertex / 3]) continue;
        for (let corner = 0; corner < 3; corner++) {
          const offset = (vertex + corner) * attribute.itemSize;
          for (let component = 0; component < attribute.itemSize; component++) values.push(attribute.array[offset + component]);
        }
        outputVertexCount += 3;
      }
      if (name === 'position' && outputVertexCount > groupStart)
        filtered.addGroup(groupStart, outputVertexCount - groupStart, group.materialIndex);
    }
    filtered.setAttribute(name, new THREE.BufferAttribute(new Float32Array(values), attribute.itemSize, attribute.normalized));
  }
  filtered.computeBoundingBox(); filtered.computeBoundingSphere();
  if (expanded !== geometry) expanded.dispose();
  geometry.dispose();
  return filtered;
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
    const contour = smoothClosedContour(hazard.points, 3);
    const center = contour.reduce((p, v) => ({ x: p.x + v.x / contour.length,
      z: p.z + v.z / contour.length }), { x: 0, z: 0 });
    const inset = amount => contour.map(p => ({ x: center.x + (p.x - center.x) * amount,
      z: center.z + (p.z - center.z) * amount }));
    // Raster-authored water is already at the ground datum. It is a flat
    // surface mask, never an excavated bowl with stacked cardboard walls.
    if (hazard.kind !== 'depth-water') for (let index = 0; index < 3; index++) {
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
    const waterPoints = hazard.kind === 'depth-water' ? contour : inset(.87);
    const surface = new THREE.Mesh(new THREE.ShapeGeometry(terrainShape(THREE, waterPoints)),
      new THREE.MeshStandardMaterial({ color: hazard.kind === 'depth-water' ? 0x318a9c : hazard.kind === 'peat' ? 0x284745 : water ? 0x318a9c : 0x11151e,
        roughness: water ? .72 : 1, metalness: 0, side: THREE.DoubleSide }));
    surface.rotation.x = -Math.PI / 2;
    // Keep water close under the playfield cut-out; dropping it below the
    // cardboard backing makes shallow rivers disappear from an oblique view.
    surface.position.y = hazard.kind === 'abyss' ? -.79 : .025;
    surface.name = `hazard-${hazard.id}`; surface.receiveShadow = true;
    location.sceneGroup.add(surface);
  }
}

export function createTerrainRenderer({ THREE, locations, createTerrainHeightMap, createTerrainHeightMapFromDepthMap = createTerrainHeightMap, extractTerrainContours,
  paper, playfieldCardboard = paper, roughCardboard = paper, terrainCorrugation, sceneStencil, maxHeight = 3.6,
  fogSettings }) {
  for (const location of Object.values(locations)) {
    const levelCenter = terrainLevelCenter(location.walkablePoints);
    const fogTopology = buildFogPathTopology(location.fogPaths?.paths ?? []);
    const {heightMap,backingOutline,terraceStep}=createLocationTerrainData(location,
      {createTerrainHeightMap,createTerrainHeightMapFromDepthMap,extractTerrainContours,maxHeight});
    location.terrainHeightMap = heightMap;
    location.sceneGroup.userData.terrainHeightMap = heightMap;
    const palette = TERRAIN_PALETTES[location.terrainStyle ?? location.id] ?? TERRAIN_PALETTES.forest;
    const hasPits = Boolean(heightMap.negativeContours?.length);
    if (!heightMap.volume.renderUnified && backingOutline.length >= 3) {
      const shapes = hasPits ? shapesFromContours(THREE,terrainSurfaceContours(heightMap,[backingOutline],[location.walkablePoints]))
        : [terrainShape(THREE,backingOutline,[location.walkablePoints])];
      const depth = .3;
      let backingGeometry = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: false, steps: 1 });
      backingGeometry.rotateX(-Math.PI / 2);
      backingGeometry = cullFogHiddenOutwardWalls(THREE, backingGeometry, levelCenter, fogTopology, fogSettings);
      const backing = new THREE.Mesh(backingGeometry, [
        makeRoughCardboardMaterial(THREE, roughCardboard, palette.tops[0], sceneStencil),
        makeRoughCardboardMaterial(THREE, terrainCorrugation, palette.side, sceneStencil),
      ]);
      backing.position.y = -depth - .015;
      backing.receiveShadow = true;
      backing.name = `terrain-top-backing-${location.id}`;
      location.sceneGroup.add(backing);
    }
    const hazards=(location.hazards??[]).filter(hazard=>hazard.kind!=='depth-water').map(hazard=>hazard.points);
    let layers = [{
      shapes: hasPits ? shapesFromContours(THREE,terrainSurfaceContours(heightMap,[location.walkablePoints],hazards))
        : [terrainShape(THREE,location.walkablePoints,hazards)], depth: .3, top: 0,
      topColor: palette.tops[0], sideColor: palette.side,
    }, ...heightMap.layers.filter(layer => layer.contours.length).map((layer, index) => ({
      // Descending terraces are bands, not lids over every deeper pit floor.
      shapes: shapesFromContours(THREE, [...layer.contours,...(layer.height<0
        ? heightMap.layers.find(next=>Math.abs(next.height-(layer.height-heightMap.step))<1e-6)?.contours??[] : [])],layer.height<0?1:3),
      depth: heightMap.step, top: layer.height,
      topColor: palette.tops[(index + 2) % palette.tops.length],
      sideColor: index % 2 ? palette.side : 0x9c7243,
    }))];

    if (location.art) layers.push({ shapes: hasPits
      ? shapesFromContours(THREE,terrainSurfaceContours(heightMap,location.exits.map(exit=>exitRoadContinuation(exit))))
      : location.exits.map(exit => terrainShape(THREE, exitRoadContinuation(exit))),
      depth: .3, top: 0, topColor: palette.tops[0], sideColor: palette.side });

    if(heightMap.volume.renderUnified) {
      layers=[];const volume=heightMap.volume;
      heightMap.groundDomain={floor:[],blockers:[]};
      const visible=createVisibleTerrainSlices(volume);
      heightMap.visibility=visible.stats;
      const referenceHeight=heightMap.values.reduce((low,height)=>Math.min(low,height),Infinity);
      heightMap.safetyFloor=createTerrainSafetyFloor(volume,visible,referenceHeight);
      if(heightMap.safetyFloor) {
        const floor=heightMap.safetyFloor;
        if(Math.abs(floor.top)<1e-6)heightMap.groundDomain.floor=[floor.contour];
        layers.push({shapes:[terrainShape(THREE,floor.contour)],top:floor.top,depth:floor.depth,
          topColor:palette.tops[0],sideColor:palette.side,safety:true});
      }
      for(let index=0;index<visible.slices.length;index++) {
        const layer=visible.firstLayer+index,slice=visible.slices[index];
        if(heightMap.safetyFloor&&(layer+1)*terraceStep<=heightMap.safetyFloor.top+1e-6)continue;
        // Caps and side walls use this same smoothed contour. Never replace
        // smoothing with a separate coarse floor to repair seams.
        const contours=extractTerrainContours(slice,0).map(contour=>smoothClosedContour(contour,4));
        const bottom=layer*terraceStep,top=(layer+1)*terraceStep;
        if(Math.abs(top)<1e-6)heightMap.groundDomain.floor=contours;
        if(bottom>=-1e-6&&bottom<2.25)heightMap.groundDomain.blockers.push(contours);
        if(!contours.length)continue;
        layers.push({shapes:shapesFromContours(THREE,contours,1),depth:terraceStep,top:(layer+1)*terraceStep,
          topColor:(layer+1)===0?palette.tops[0]:palette.tops[((layer%palette.tops.length)+palette.tops.length)%palette.tops.length],sideColor:palette.side});
      }
    }

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
      let geometry = new THREE.ExtrudeGeometry(layer.shapes, {
        depth: layer.depth, bevelEnabled: false, steps: 1, UVGenerator: uvGenerator,
      });
      geometry.rotateX(-Math.PI / 2);
      geometry = cullFogHiddenOutwardWalls(THREE, geometry, levelCenter, fogTopology, fogSettings);
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
      mesh.name = layer.safety?`terrain-top-safety-${location.id}`:`${layer.top === 0 ? 'playfield' : 'terrain'}-top-${location.id}-${location.sceneGroup.children.length}`;
      location.sceneGroup.add(mesh);
    }
    addDropZoneUnderside(THREE, location);
    addHazardBasins(THREE, location, roughCardboard, terrainCorrugation);
  }
}
