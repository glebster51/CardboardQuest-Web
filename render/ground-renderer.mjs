const DECAL_ASSETS = [
  'ground-pit', 'ground-grass-ring', 'ground-dirt-patch', 'ground-footprints',
  'ground-footsteps', 'ground-scuff', 'ground-pebbles', 'ground-cracks',
  ...Array.from({ length: 8 }, (_, index) => `grass-tuft-${index + 1}`),
];

function makeMarkMaterial(THREE, texture, opacity) {
  return new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: .035, opacity,
    depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 });
}

function addInstances(THREE, parent, kind, marks, materials, upright = false) {
  if (!marks.length) return;
  const multiplier = upright ? 2 : 1;
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), materials.get(kind), marks.length * multiplier);
  const position = new THREE.Vector3(), quaternion = new THREE.Quaternion(), scale = new THREE.Vector3();
  const matrix = new THREE.Matrix4(), euler = new THREE.Euler(0, 0, 0, 'XYZ');
  let index = 0;
  for (const mark of marks) for (let variant = 0; variant < multiplier; variant++) {
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
    mesh.setMatrixAt(index++, matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  // Flat ground marks sit below the gameplay markers (outline: 2, fill: 3).
  // Grass stays upright as crossed 3D sprite cards, but also renders before the HUD.
  mesh.renderOrder = upright ? 1 : 0;
  mesh.frustumCulled = false;
  parent.add(mesh);
}

/** Load shared decal resources once and build per-location instanced scenery. */
export async function createGroundRenderer({ THREE, renderer, locations, specsByLocation,
  pathTargets = {}, createLocationWalkPaths, scatterGroundDetails }) {
  const textureCache = new Map();
  const loadTexture = path => {
    if (!textureCache.has(path)) {
      textureCache.set(path, new THREE.TextureLoader().loadAsync(path).then(texture => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        return texture;
      }));
    }
    return textureCache.get(path);
  };
  const textures = new Map(await Promise.all(DECAL_ASSETS.map(async name =>
    [name, await loadTexture(`assets/${name}.png`)])));
  const materials = new Map(DECAL_ASSETS.map(name => [name,
    makeMarkMaterial(THREE, textures.get(name), name.startsWith('grass-tuft-') ? .94 : .8)]));

  for (const location of Object.values(locations)) {
    const paths = createLocationWalkPaths(location, pathTargets[location.id] ?? []);
    const details = scatterGroundDetails({ location, ...specsByLocation[location.id], paths });
    const group = new THREE.Group();
    group.name = `ground-details-${location.id}`;
    group.userData.walkPaths = paths;
    location.sceneGroup.add(group);
    const marks = [...details.decals, ...details.trail];
    for (const kind of DECAL_ASSETS.slice(0, 8)) {
      addInstances(THREE, group, kind, marks.filter(mark => mark.kind === kind), materials);
    }
    for (const kind of DECAL_ASSETS.slice(8)) {
      addInstances(THREE, group, kind, details.grass.filter(mark => mark.kind === kind), materials, true);
    }
    location.groundDetails = { ...details, paths };
  }
  return { textures, materials, textureCache };
}
