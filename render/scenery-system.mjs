import { makeScenerySprite } from '../scenery-model-v4.mjs';
import { PUCK_CENTER_Y, PUCK_HEIGHT, sceneryTokenLayout } from '../scenery-layout.mjs?v=2';
import { WALKABLE_POINTS } from '../physics.mjs';
import { nearestPointOnPath } from '../terrain-shapes.mjs';

/** Own scenery asset templates and construct location props from them. */
export function createScenerySystem({ THREE, renderer, scene, locations, corrugation, paper,
  terrainCorrugation, sceneStencil, assetBase = 'assets/' }) {
  const templates = new Map();
  const facePairs = [];

  function loadTemplate(path) {
    if (templates.has(path)) return templates.get(path);
    const pending = (async () => {
      const source = await new THREE.TextureLoader().loadAsync(`${assetBase}${path.replace(/^assets\//, '')}?art=4`);
      const art = makeScenerySprite(source.image, corrugation, renderer.capabilities.getMaxAnisotropy());
      source.dispose();
      return art.group;
    })();
    templates.set(path, pending);
    pending.catch(() => templates.delete(path));
    return pending;
  }

  async function create(path, x, z, size, parent = scene, allowFlat = false, options = {}) {
    const template = await loadTemplate(path);
    const art = template.clone(true);
    const layout = sceneryTokenLayout(size, options.base ? options.fixedRadius ?? 0 : 0);
    art.scale.set(layout.scale, layout.scale, layout.depthScale);
    art.position.y = layout.artY;
    if (options.flat) {
      art.rotation.x = -Math.PI / 2;
      art.position.y = .1;
    }
    const terrain = parent.userData.terrainHeightMap ?? locations.home.terrainHeightMap;
    const elevation = options.elevation ?? terrain.sample(x, z);
    if (elevation <= 0 && !allowFlat) return null;

    const prop = new THREE.Group();
    prop.position.set(x, elevation, z);
    prop.add(art);
    if (options.fixedRadius) {
      if (options.base) {
        const base = new THREE.Mesh(new THREE.CylinderGeometry(options.fixedRadius, options.fixedRadius, PUCK_HEIGHT, 64), [
          new THREE.MeshStandardMaterial({ map: terrainCorrugation, roughness: 1, ...sceneStencil }),
          new THREE.MeshStandardMaterial({ map: paper, roughness: .96, ...sceneStencil }),
          new THREE.MeshStandardMaterial({ color: 0x97713e, ...sceneStencil }),
        ]);
        base.position.y = PUCK_CENTER_Y;
        base.castShadow = true; base.receiveShadow = true;
        prop.add(base);
      }
      const owner = Object.values(locations).find(location => location.sceneGroup === parent);
      owner?.obstacles.push({ id: `obstacle-${owner.id}-${owner.obstacles.length + 1}`,
        x, z, vx: 0, vz: 0, radius: options.fixedRadius, fixed: true, team: 'obstacle' });
    }

    const inward = nearestPointOnPath(x, z, parent.userData.walkablePoints ?? WALKABLE_POINTS);
    prop.rotation.y = options.yaw ?? Math.atan2(inward.x - x, inward.z - z);
    if (!options.flat) facePairs.push({ prop, front: art.getObjectByName('scenery-front'), back: art.getObjectByName('scenery-back') });
    parent.add(prop);
    return prop;
  }

  return { create, loadTemplate, facePairs };
}
