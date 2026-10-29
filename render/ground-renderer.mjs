import { markSsaoSpriteAlphaCutout } from './ssao-alpha-cutout.mjs?v=ab782efa5048549c';

const GROUND_DECALS = [
  'ground-v2-pit', 'ground-v2-grass-ring', 'ground-v2-dirt-patch', 'ground-v2-footprints',
  'ground-v2-footsteps', 'ground-v2-scuff', 'ground-v2-pebbles', 'ground-v2-cracks',
  'ground-v2-twig', 'ground-v2-hooves', 'ground-v2-stones', 'ground-v2-cracks-broad',
];
const GRASS_DECALS = Array.from({ length: 8 }, (_, index) => `grass-tuft-v2-${index + 1}`);
const DECAL_ASSETS = [...GROUND_DECALS, ...GRASS_DECALS];

function makeMarkMaterial(THREE, texture, opacity) {
  return new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: .035, opacity,
    depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 });
}

function addInstances(THREE, parent, kind, marks, materials, upright = false, ids = new Map()) {
  if (!marks.length) return;
  const multiplier = upright ? 2 : 1;
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), materials.get(kind), marks.length * multiplier);
  const material = materials.get(kind);
  markSsaoSpriteAlphaCutout(mesh, material.map, material.alphaTest);
  const position = new THREE.Vector3(), quaternion = new THREE.Quaternion(), scale = new THREE.Vector3();
  const matrix = new THREE.Matrix4(), euler = new THREE.Euler(0, 0, 0, 'XYZ');
  const editEntries = [];
  let index = 0;
  for (const mark of marks) {
    const id = ids.get(mark);
    const entry = { id, label: `${upright ? 'Травинка' : 'Декаль'} · ${mark.kind} · ${id?.split(':').at(-1)}`,
      upright, instanceIds: [], width: mark.width, height: mark.height,
      position: [mark.x, upright ? mark.height / 2 + .009 : .018, mark.z],
      rotation: upright ? [0, mark.rotation, 0] : [-Math.PI / 2, 0, mark.rotation],
      scale: [mark.width, mark.height, 1] };
    for (let variant = 0; variant < multiplier; variant++) {
      if (upright) {
        position.set(mark.x, mark.height / 2 + .009, mark.z);
        euler.set(0, mark.rotation + variant * Math.PI / 2, 0);
      } else {
        position.set(mark.x, .018, mark.z);
        euler.set(-Math.PI / 2, 0, mark.rotation);
      }
      quaternion.setFromEuler(euler);
      scale.set(mark.width, mark.height, 1);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(index, matrix); entry.instanceIds.push(index++);
    }
    editEntries.push(entry);
  }
  mesh.instanceMatrix.needsUpdate = true;
  // Flat ground marks sit below the gameplay markers (outline: 2, fill: 3).
  // Grass stays upright as crossed 3D sprite cards, but also renders before the HUD.
  mesh.renderOrder = upright ? 1 : 0;
  mesh.userData.locationFogSurface = true;
  mesh.userData.sceneEditGroundEntries = editEntries;
  mesh.userData.sceneEditInstanceBindings = new Map();
  mesh.frustumCulled = false;
  parent.add(mesh);
}

/** Load shared decal resources once and build per-location instanced scenery. */
export async function createGroundRenderer({ THREE, renderer, locations, specsByLocation,
  pathTargets = {}, createLocationWalkPaths, scatterGroundDetails, assetBase = 'assets/', resources, geometryClient,
  yieldWork = async () => {}, reportStatus = () => {}, renderDetails = false }) {
  const textureCache = new Map();
  const loadTexture = path => {
    if (!textureCache.has(path)) {
      const stage = `Текстура окружения: ${path.split('/').pop()}`;
      reportStatus(stage);
      textureCache.set(path, new THREE.TextureLoader().loadAsync(`${assetBase}${path.replace(/^assets\//, '')}`).then(texture => {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
          reportStatus(stage, 'ready');
          return texture;
        }).catch(error => {
          reportStatus(stage, 'error', error.message || String(error));
          throw error;
        }));
    }
    return textureCache.get(path);
  };
  const textures = resources?.textures ?? new Map();
  const materials = resources?.materials ?? new Map();
  if (renderDetails && !resources?.textures) {
    for (const [name, texture] of await Promise.all(DECAL_ASSETS.map(async name =>
      [name, await loadTexture(`assets/${name}.png`)]))) textures.set(name, texture);
  }
  if (renderDetails && !resources?.materials) {
    for (const name of DECAL_ASSETS) materials.set(name,
      makeMarkMaterial(THREE, textures.get(name), name.startsWith('grass-tuft-v2-') ? .94 : .8));
  }

  for (const location of Object.values(locations)) {
    const generated = geometryClient ? await geometryClient.run('ground', {
      location: { walkablePoints: location.walkablePoints, hazards: location.hazards, dropZones: location.dropZones,
        exits: location.exits, arrivals: location.arrivals, entry: location.entry },
      specs: specsByLocation[location.id], targets: pathTargets[location.id] ?? [] }) : null;
    const paths = generated?.paths ?? createLocationWalkPaths(location, pathTargets[location.id] ?? []);
    const details = generated?.details ?? scatterGroundDetails({ location, ...specsByLocation[location.id], paths });
    location.groundDetails = { ...details, paths };
    if (!renderDetails) { await yieldWork(); continue; }
    const group = new THREE.Group();
    group.name = `ground-details-${location.id}`;
    group.userData.walkPaths = paths;
    location.sceneGroup.add(group);
    const marks = [...details.decals, ...details.trail];
    const decalIds = new Map([...details.decals.map((mark, index) => [mark, `ground-decal:${String(index).padStart(4, '0')}`]),
      ...details.trail.map((mark, index) => [mark, `ground-trail:${String(index).padStart(4, '0')}`])]);
    const grassIds = new Map(details.grass.map((mark, index) => [mark, `ground-grass:${String(index).padStart(4, '0')}`]));
    for (const kind of GROUND_DECALS) {
      const matching = marks.filter(mark => mark.kind === kind);
      const stage = `Декали окружения: ${location.id} · ${kind}`;
      reportStatus(stage);
      addInstances(THREE, group, kind, matching, materials, false, decalIds);
      reportStatus(stage, 'ready', `${matching.length} экземпляров`);
      await yieldWork();
    }
    for (const kind of GRASS_DECALS) {
      const matching = details.grass.filter(mark => mark.kind === kind);
      const stage = `Травинки окружения: ${location.id} · ${kind}`;
      reportStatus(stage);
      addInstances(THREE, group, kind, matching, materials, true, grassIds);
      reportStatus(stage, 'ready', `${matching.length} экземпляров`);
      await yieldWork();
    }
  }
  return { textures, materials, textureCache };
}
