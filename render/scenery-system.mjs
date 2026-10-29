import { makeScenerySprite } from '../scenery-model-v4.mjs?v=ab782efa5048549c';
import { PUCK_CENTER_Y, PUCK_HEIGHT, sceneryTokenLayout } from '../scenery-layout.mjs?v=ab782efa5048549c';
import { WALKABLE_POINTS } from '../physics.mjs?v=ab782efa5048549c';
import { nearestPointOnPath } from '../terrain-shapes.mjs?v=ab782efa5048549c';
import { sceneResources } from './scene-resources.mjs?v=ab782efa5048549c';
import { bindSsaoSpriteAlphaCutouts } from './ssao-alpha-cutout.mjs?v=ab782efa5048549c';
import { bindCardboardDamageTree } from '../cardboard-damage.mjs?v=ab782efa5048549c';
import { attachSceneryToTerrain } from './scenery-grounding.mjs?v=ab782efa5048549c';

function propSeed(value) {
  let hash = 2166136261;
  for (const character of String(value)) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return (hash >>> 0) / 4294967295 * 1000;
}

/** Own scenery asset templates and construct location props from them. */
export function createScenerySystem({ THREE, renderer, scene, locations, corrugation, paper,
  terrainCorrugation, sceneStencil, assetBase = 'assets/', geometryClient, cardboardDamageTexture, cardboardVoronoiTexture,
  cardboardTearNoiseTexture, cardboardPerlinTexture,
  revealUniforms,
  getCardboardDamageSettings = () => ({}) }) {
  const templates = new Map();
  const stateTemplates = new Map();
  const facePairs = [];

  function loadTemplate(path) {
    if (templates.has(path)) return templates.get(path);
    const pending = (async () => {
      if (geometryClient) {
        const url = new URL(`${assetBase}${path.replace(/^assets\//, '')}?art=4`, location.href).href;
        const result = await geometryClient.run('scenery', { url });
        return result.group.children[0];
      }
      const source = await new THREE.TextureLoader().loadAsync(`${assetBase}${path.replace(/^assets\//, '')}?art=4`);
      const art = makeScenerySprite(source.image, corrugation, renderer.capabilities.getMaxAnisotropy());
      source.dispose();
      return art.group;
    })();
    templates.set(path, pending);
    pending.catch(() => templates.delete(path));
    return pending;
  }

  function loadStateTemplates(path, frameCount = 2) {
    const key = `${path}:${frameCount}`;
    if (stateTemplates.has(key)) return stateTemplates.get(key);
    const pending = (async () => {
      if (geometryClient) {
        const url = new URL(`${assetBase}${path.replace(/^assets\//, '')}?states=1`, location.href).href;
        const result = await geometryClient.run('scenery', { url, frameCount });
        return [...result.group.children];
      }
      const source = await new THREE.TextureLoader().loadAsync(`${assetBase}${path.replace(/^assets\//, '')}?states=1`);
      const image = source.image;
      if (!Number.isInteger(frameCount) || frameCount < 2 || image.width % frameCount !== 0)
        throw new Error(`State atlas ${path} must split into ${frameCount} equal horizontal frames`);
      const width = image.width / frameCount, height = image.height;
      const result = [];
      try {
        for (let index = 0; index < frameCount; index++) {
          const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
          const context = canvas.getContext('2d', { willReadFrequently: true });
          context.drawImage(image, index * width, 0, width, height, 0, 0, width, height);
          result.push(makeScenerySprite(canvas, corrugation, renderer.capabilities.getMaxAnisotropy()).group);
        }
      } finally { source.dispose(); }
      return result;
    })();
    stateTemplates.set(key, pending);
    pending.catch(() => stateTemplates.delete(key));
    return pending;
  }

  function createSprite(image) {
    if (geometryClient) return createImageBitmap(image).then(bitmap => geometryClient.run('scenery', { bitmap }, [bitmap]))
      .then(result => ({ group: result.group.children[0] }));
    return makeScenerySprite(image, corrugation, renderer.capabilities.getMaxAnisotropy());
  }

  async function releaseUnused(roots) {
    const live = sceneResources(roots), removed = [];
    for (const cache of [templates, stateTemplates]) for (const [key, pending] of cache) {
      const groups = [await pending].flat();
      const used = [...sceneResources(groups)].some(resource => resource.isBufferGeometry && live.has(resource));
      if (!used) { cache.delete(key); removed.push(...groups); }
    }
    return removed;
  }

  async function create(path, x, z, size, parent = scene, allowFlat = false, options = {}) {
    const template = await loadTemplate(path);
    const art = template.clone(true);
    art.traverse(object => {
      if (!object.isMesh || !(object.userData.cardboardSurface || object.name.startsWith('cardboard-'))) return;
      object.material = Array.isArray(object.material) ? object.material.map(material => material.clone()) : object.material.clone();
    });
    const damageSeed = propSeed(`${options.sceneEditId ?? path}:${x.toFixed(3)}:${z.toFixed(3)}`);
    const damageMaterials = bindCardboardDamageTree(art, { THREE, texture: cardboardDamageTexture, noiseTexture: cardboardVoronoiTexture,
      displacementNoiseTexture: cardboardPerlinTexture, tearNoiseTexture: cardboardTearNoiseTexture,
      settings: getCardboardDamageSettings(), seed: damageSeed, kind: 'environment', revealUniforms });
    bindSsaoSpriteAlphaCutouts(art);
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
    const counters = parent.userData.sceneEditCounts ??= {};
    const instance = options.sceneEditId ? 0 : (counters[path] = (counters[path] ?? 0) + 1);
    prop.userData.sceneEditId = options.sceneEditId ?? `scenery:${path}:${instance}`;
    prop.userData.sceneEditLabel = options.sceneEditLabel ?? `${path.replace(/^assets\//, '').replace(/\.png$/, '')} · ${instance}`;
    prop.userData.cardboardDamageMaterials = damageMaterials;
    prop.position.set(x, elevation, z);
    attachSceneryToTerrain(prop,terrain);
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
    }

    const owner = Object.values(locations).find(location => location.sceneGroup === parent);
    if (owner && !options.flat) {
      const hitPoints = 3;
      const body = { id: `cardboard-${owner.id}-${owner.obstacles.length + 1}`, kind: 'cardboard-prop',
        team: 'prop', x, z, vx: 0, vz: 0, radius: options.fixedRadius ?? Math.max(.24, Math.min(.85, size * .22)),
        fixed: true, active: true, health: hitPoints, maxHealth: hitPoints, prop, cardboardDamageMaterials: damageMaterials };
      owner.obstacles.push(body); prop.userData.sceneEditBody = body;
    }

    const inward = nearestPointOnPath(x, z, parent.userData.walkablePoints ?? WALKABLE_POINTS);
    prop.rotation.y = options.yaw ?? Math.atan2(inward.x - x, inward.z - z);
    if (!options.flat) facePairs.push({ prop, front: art.getObjectByName('scenery-front'), back: art.getObjectByName('scenery-back') });
    parent.add(prop);
    return prop;
  }

  return { create, loadTemplate, loadStateTemplates, createSprite, facePairs, releaseUnused };
}
