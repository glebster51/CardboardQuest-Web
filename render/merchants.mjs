import { MERCHANTS } from '../game/merchants.mjs?v=7c14a71de3a9af87';
import { isPlayableFloor } from '../game/world-hazards.mjs?v=7c14a71de3a9af87';

export async function createMerchantActor({ location, definition, createScenery, id = `merchant:${definition.id}`, x, z, scale = 1.5 }) {
  const safe = (px, pz) => isPlayableFloor(location, px, pz, .8)
    && location.obstacles.every(body => body.active === false || Math.hypot(px - body.x, pz - body.z) > (body.radius || 0) + 1);
  let position = { x: x ?? definition.x * scale, z: z ?? definition.z * scale };
  if (x === undefined && !safe(position.x, position.z)) {
    const candidates = [];
    for (let radius = 2.5; radius <= 7; radius += .75) for (let step = 0; step < 16; step++) {
      const px = Math.cos(step / 16 * Math.PI * 2) * radius, pz = Math.sin(step / 16 * Math.PI * 2) * radius;
      if (safe(px, pz)) candidates.push({ x: px, z: pz });
    }
    candidates.sort((a, b) => Math.hypot(a.x - position.x, a.z - position.z) - Math.hypot(b.x - position.x, b.z - position.z));
    position = candidates[0] ?? { ...location.entry };
  }
  const prop = await createScenery('assets/economy/merchant.png', position.x, position.z, 1.9,
    location.sceneGroup, true, { base: true, fixedRadius: .65, elevation: 0, yaw: 0,
      sceneEditId: id, sceneEditLabel: `${definition.name} · ${definition.title}`, sceneEditCategory: 'characters' });
  const body = prop.userData.sceneEditBody;
  Object.assign(body, { id, kind: 'merchant', merchantId: definition.id, locationId: location.id, health: 0, maxHealth: 0, team: 'neutral', fixed: true, active: true });
  Object.assign(prop.userData, { sceneEditAsset: `assets/economy/merchant.png#${definition.id}`, sceneEditPrefabId: `merchant-${definition.id}` });
  return { id, merchantId: definition.id, locationId: location.id, prop, body };
}
export async function createLocationMerchants(options) {
  const result = [];
  for (const definition of MERCHANTS.filter(merchant => merchant.location === options.location.id))
    result.push(await createMerchantActor({ ...options, definition }));
  return result;
}
