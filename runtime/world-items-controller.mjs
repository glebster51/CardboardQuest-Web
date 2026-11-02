import { catalogAsset } from '../editor/asset-catalog.mjs?v=f484ba7b7b13e7f6';
import { getStoryDialogue } from '../game/story-dialogue.mjs?v=f484ba7b7b13e7f6';
import { coinSkin, creditCoins, rollCoins } from '../game/currency.mjs?v=f484ba7b7b13e7f6';
import { isPlayableFloor } from '../game/world-hazards.mjs?v=f484ba7b7b13e7f6';
import { PUCK_RADIUS } from '../physics.mjs?v=f484ba7b7b13e7f6';
import { CACHE_LOOT_SPAWN_DURATION, advanceCacheOpening, createCacheOpening } from '../game/cache-animation.mjs?v=f484ba7b7b13e7f6';
import { addItems, collectCampaignStoryPickup, openCampaignCache } from '../game/story-campaign.mjs?v=f484ba7b7b13e7f6';
import { rollEditorChestLoot, scatterWorldLoot, takeWorldLoot, unlockDroppedLootAfterLeaving, WORLD_ITEM_IDS } from '../game/world-items.mjs?v=f484ba7b7b13e7f6';
import { INVENTORY_ITEMS, removeInventoryItem } from '../game/inventory-items.mjs?v=f484ba7b7b13e7f6';
import { createItemIconFlight, itemMagnetWorldPosition, itemMagnetRadiusForItem, sampleItemMagnetMotion } from '../game/item-magnet.mjs?v=f484ba7b7b13e7f6';
import { isCampaignPositionSafe } from '../game/story-world.mjs?v=f484ba7b7b13e7f6';

/** Application orchestration with explicit live state and service ports.
 * The composition root owns these bindings; this subsystem owns the operations below. */
export function createWorldItemsController(context) {
  const { THREE } = context;
  let inventoryDropSerial = 0;
  function createLootVisual(location, item, source = null) {
    const group = new THREE.Group();
    group.name = item.id;
    const modelKey = item.itemId === 'coins' ? coinSkin(item.amount).id : item.itemId;
    const model = context.lootSpriteModels.get(modelKey) ?? context.lootSpriteModels.get('scrap');
    group.userData.lootSkin = modelKey;
    const icon = model.group.clone(true), iconHeight = item.itemId === 'coins' ? .85 : .54 * 3, iconScale = iconHeight / 2.05;
    icon.traverse(mesh => {
      if (!mesh.isMesh || !['cardboard-front', 'cardboard-back'].includes(mesh.name)
        || !['scenery-front', 'scenery-back'].includes(mesh.parent?.name)) return;
      const printed = mesh.material;
      if (!printed?.map) return;
      printed.map.colorSpace = THREE.SRGBColorSpace;
      const material = new THREE.MeshBasicMaterial({ map: printed.map, color: 0xffffff, alphaTest: printed.alphaTest || .5,
        side: printed.side, depthTest: printed.depthTest, depthWrite: printed.depthWrite, toneMapped: false,
        stencilWrite: printed.stencilWrite, stencilRef: printed.stencilRef, stencilFunc: printed.stencilFunc,
        stencilFail: printed.stencilFail, stencilZFail: printed.stencilZFail, stencilZPass: printed.stencilZPass });
      material.name = 'loot-artwork-unlit';
      mesh.material = material;
    });
    icon.scale.set(iconScale, iconScale, 1); icon.position.y = .11 + iconHeight / 2; group.add(icon);
    const facePair = { prop: group, front: icon.getObjectByName('scenery-front'), back: icon.getObjectByName('scenery-back') };
    context.sceneryFacePairs.push(facePair);
    const rays = new THREE.Sprite(context.lootRayMaterial); rays.name = 'loot-rays';
    rays.scale.set(1.9, 1.9, 1); rays.position.set(0, icon.position.y, -.12); rays.renderOrder = 4; group.add(rays);
    const glints = context.lootGlintOffsets.map(([x, y], index) => {
      const sprite = new THREE.Sprite(context.lootGlintMaterial.clone()); sprite.name = `loot-glint-${index}`;
      sprite.position.set(x, icon.position.y + y, .12); sprite.scale.setScalar(.22); sprite.renderOrder = 7; group.add(sprite); return sprite;
    });
    group.position.set(item.x, 0, item.z);
    location.sceneGroup.add(group);
    const visual = { group, icon, rays, glints, facePair, spawn: source ? { ...source, age: 0, duration: .62 } : null };
    context.worldItemVisuals.set(item.id, visual);
    return visual;
  }

  function createStoryPickupVisual(location, pickup) {
    const group = new THREE.Group(); group.name = pickup.id;
    const icon = new THREE.Mesh(context.storyPickupIconGeometry, context.storyPickupIconMaterial);
    icon.position.y = .34; icon.renderOrder = 6; group.add(icon);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(.34, 28),
      new THREE.MeshBasicMaterial({ color: 0xffd879, transparent: true, opacity: .075, depthWrite: false, toneMapped: false }));
    glow.rotation.x = -Math.PI / 2; glow.position.y = .018; group.add(glow);
    const beam = new THREE.Mesh(context.lootBeamGeometry, context.lootBeamMaterial);
    beam.scale.set(1.02, 1.7, 1); beam.position.set(0, 1.08, -.025); beam.renderOrder = 5; group.add(beam);
    group.position.set(pickup.x, 0, pickup.z); location.sceneGroup.add(group);
    const visual = { group, beam, glow, spin: 0 };
    context.storyPickupVisuals.set(pickup.id, visual);
    return visual;
  }

  async function makeCacheBody(location, chestTemplates) {
    const position = location.cachePosition ?? [{ x: context.scaled(3.4), z: 0 }, { x: context.scaled(-3.4), z: 0 },
      { x: 0, z: context.scaled(3.4) }, { x: 0, z: context.scaled(-3.4) }]
      .find(point => isCampaignPositionSafe(location, point, 1.5)) ?? location.entry;
    const opened = Boolean(context.campaignState.collected[location.id]);
    const body = { id: `cache-${location.id}`, kind: 'cache-chest', team: 'neutral', locationId: location.id,
      x: position.x, z: position.z, vx: 0, vz: 0, radius: 1.12, fixed: true, opened };
    location.cacheBody = body;
    if (!opened) location.obstacles.push(body);
    const group = new THREE.Group(); group.name = body.id;
    group.userData.disablePlayerReveal = true;
    group.userData.sceneEditId = 'interactive:cache'; group.userData.sceneEditLabel = 'Сундук';
    group.userData.sceneEditCategory = 'interactive'; group.userData.sceneEditBody = body;
    group.userData.sceneEditSync = () => { body.x = group.position.x; body.z = group.position.z; };
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.22, 48), context.ambientShadowMaterial);
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = .008; group.add(shadow);
    const puck = new THREE.Mesh(new THREE.CylinderGeometry(body.radius, body.radius, .2, 64), [
      new THREE.MeshStandardMaterial({ map: context.corrugation, roughness: 1, ...context.sceneStencil }),
      new THREE.MeshStandardMaterial({ map: context.paper, roughness: .96, ...context.sceneStencil }),
      new THREE.MeshStandardMaterial({ color: 0x97713e, ...context.sceneStencil }),
    ]);
    puck.position.y = .1; puck.visible = !opened; puck.scale.setScalar(opened ? 0 : 1);
    puck.castShadow = true; puck.receiveShadow = true; group.add(puck);
    const artHolder = new THREE.Group(); artHolder.position.y = opened ? 0 : .21; group.add(artHolder);
    const stateArt = chestTemplates.map((template, index) => {
      const art = template.clone(true);
      const spriteHeight = 1.72, scale = spriteHeight / 2.05;
      art.scale.set(scale, scale, 1); art.position.y = spriteHeight / 2;
      art.visible = index === (opened ? 1 : 0); artHolder.add(art);
      context.sceneryFacePairs.push({ prop: group, front: art.getObjectByName('scenery-front'), back: art.getObjectByName('scenery-back') });
      return art;
    });
    group.position.set(body.x, 0, body.z); location.sceneGroup.add(group);
    context.chestVisuals.set(body.id, { body, group, puck, artHolder, stateArt,
      opening: null, lootVisuals: [], pendingStory: null });
  }

  async function createPlacedChest(location, id, value, item) {
    const chestTemplates = await context.loadStateTemplates('assets/chest-states.png', 2);
    const opened = (location.openedPlacedChests ??= []).includes(id);
    const body = { id, kind: 'editor-chest', team: 'neutral', locationId: location.id,
      x: value.position[0], z: value.position[2], vx: 0, vz: 0, radius: 1.12, fixed: true, opened };
    if (!opened) location.obstacles.push(body);
    const group = new THREE.Group(); group.name = id;
    Object.assign(group.userData, { disablePlayerReveal: true, sceneEditId: id, sceneEditLabel: item.label, sceneEditCategory: 'interactive',
      sceneEditAsset: value.asset, sceneEditSize: value.size, sceneEditBody: body,
      sceneEditSync() { body.x = group.position.x; body.z = group.position.z; },
      sceneEditDelete(deleted) {
        body.active = !deleted && !body.opened;
        location.obstacles = location.obstacles.filter(obstacle => obstacle !== body);
        if (body.active) location.obstacles.push(body);
      } });
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.22, 48), context.ambientShadowMaterial);
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = .008; group.add(shadow);
    const puck = new THREE.Mesh(new THREE.CylinderGeometry(body.radius, body.radius, .2, 64), [
      new THREE.MeshStandardMaterial({ map: context.corrugation, roughness: 1, ...context.sceneStencil }),
      new THREE.MeshStandardMaterial({ map: context.paper, roughness: .96, ...context.sceneStencil }),
      new THREE.MeshStandardMaterial({ color: 0x97713e, ...context.sceneStencil }),
    ]);
    puck.position.y = .1; puck.visible = !opened; puck.scale.setScalar(opened ? 0 : 1);
    puck.castShadow = true; puck.receiveShadow = true; group.add(puck);
    const artHolder = new THREE.Group(); artHolder.position.y = opened ? 0 : .21; group.add(artHolder);
    const stateArt = chestTemplates.map((template, index) => {
      const art = template.clone(true);
      const spriteHeight = 1.72, scale = spriteHeight / 2.05;
      art.scale.set(scale, scale, 1); art.position.y = spriteHeight / 2;
      art.visible = index === (opened ? 1 : 0); artHolder.add(art);
      context.sceneryFacePairs.push({ prop: group, front: art.getObjectByName('scenery-front'), back: art.getObjectByName('scenery-back') });
      return art;
    });
    group.position.fromArray(value.position); group.rotation.set(...value.rotation); group.scale.fromArray(value.scale);
    location.sceneGroup.add(group);
    context.chestVisuals.set(id, { body, group, puck, artHolder, stateArt, opening: null, lootVisuals: [], pendingStory: null });
    return group;
  }

  function spawnWorldLoot(location, sourceId, x, z, rewards, deferSpill = false) {
    if (!location || !rewards) return [];
    const drops = scatterWorldLoot({ sourceId, x, z, rewards,
      isInside: (px, pz) => isPlayableFloor(location, px, pz, .45),
      spread: [1.15, 2.65] });
    location.loot.push(...drops);
    for (const item of drops) {
      const visual = createLootVisual(location, item, { x, z });
      if (deferSpill) { visual.spillLocked = true; visual.group.visible = false; }
    }
    return drops;
  }

  function findInventoryDropPosition(screenPoint) {
    context.camera.updateMatrixWorld(true);
    const projectedPlayer = new THREE.Vector3(context.heroBody.x, .2, context.heroBody.z).project(context.camera);
    const playerX = (projectedPlayer.x + 1) * innerWidth / 2, playerY = (1 - projectedPlayer.y) * innerHeight / 2;
    const dx = screenPoint.x - playerX, dy = screenPoint.y - playerY;
    const right = new THREE.Vector3(), up = new THREE.Vector3(), back = new THREE.Vector3();
    context.camera.matrixWorld.extractBasis(right, up, back);
    const direction = right.multiplyScalar(dx).addScaledVector(up, -dy).setY(0);
    if (direction.lengthSq() < 1e-6) direction.set(0, 0, 1);
    direction.normalize();
    const angles = [0, -.42, .42, -.84, .84, -1.26, 1.26];
    for (const angle of angles) for (const distance of [2.1, 2.6, 3.1, 1.6]) {
      const rotatedX = direction.x * Math.cos(angle) - direction.z * Math.sin(angle);
      const rotatedZ = direction.x * Math.sin(angle) + direction.z * Math.cos(angle);
      const point = { x: context.heroBody.x + rotatedX * distance, z: context.heroBody.z + rotatedZ * distance };
      if (isPlayableFloor(context.activeLocation, point.x, point.z, .35)) return point;
    }
    return null;
  }

  function dropInventoryItem(itemId, slotIndex, screenPoint) {
    if (!WORLD_ITEM_IDS.includes(itemId) || !Number.isInteger(slotIndex)) return { error: 'Этот предмет нельзя выбросить.' };
    const position = findInventoryDropPosition(screenPoint);
    if (!position) return { error: 'Рядом нет свободного места, куда можно выбросить предмет.' };
    if (!removeInventoryItem(context.campaignState, itemId, slotIndex)) return { error: 'Предмет уже переместился из этой ячейки.' };
    const definition = INVENTORY_ITEMS.find(item => item.id === itemId);
    const item = { id: `loot-drop-${Date.now().toString(36)}-${(++inventoryDropSerial).toString(36)}`,
      itemId, ...position, pickupBlocked: true };
    context.activeLocation.loot.push(item);
    createLootVisual(context.activeLocation, item, { x: context.heroBody.x, z: context.heroBody.z });
    context.persistCampaign();
    return { dropped: true, name: definition?.name ?? itemId };
  }

  function openCache(body) {
    if (!body || body.opened || body.opening || body.locationId !== context.activeLocation.id) return false;
    const editorChest = body.kind === 'editor-chest';
    const result = editorChest ? { rewards: rollEditorChestLoot() } : openCampaignCache(context.campaignState, body.locationId);
    if (!result) return false;
    if (!editorChest) result.rewards = { ...result.rewards, coins: rollCoins('chest') };
    body.opening = true;
    if (editorChest) {
      const opened = context.activeLocation.openedPlacedChests ??= [];
      if (!opened.includes(body.id)) opened.push(body.id);
    }
    const visual = context.chestVisuals.get(body.id);
    if (visual) {
      visual.opening = createCacheOpening();
      visual.pendingStory = editorChest ? null : { ...result, lines: getStoryDialogue(context.campaignState, context.activeLocation.id) };
      const drops = spawnWorldLoot(context.activeLocation, body.id, body.x, body.z, result.rewards, true);
      visual.lootVisuals = drops.map(item => context.worldItemVisuals.get(item.id)).filter(Boolean);
    } else {
      body.opened = true; body.opening = false;
      context.activeLocation.obstacles = context.activeLocation.obstacles.filter(obstacle => obstacle !== body);
      spawnWorldLoot(context.activeLocation, body.id, body.x, body.z, result.rewards);
      context.showStoryCard({ ...result, lines: getStoryDialogue(context.campaignState, context.activeLocation.id) });
    }
    context.rebuildBodies();
    context.persistCampaign();
    context.refreshLocationInfo();
    return true;
  }

  function updateWorldLoot(dt) {
    for (const item of [...context.activeLocation.loot]) {
      if (context.activeLocation.collectedPlacedItems?.includes(item.id)) continue;
      let visual = context.worldItemVisuals.get(item.id);
      if (!visual) visual = createLootVisual(context.activeLocation, item);
      if (visual.spillLocked) continue;
      if (visual.spawn) {
        visual.spawn.age += dt;
        const t = Math.min(1, visual.spawn.age / visual.spawn.duration);
        const eased = 1 - (1 - t) ** 3;
        visual.group.position.set(
          visual.spawn.x + (item.x - visual.spawn.x) * eased,
          Math.sin(t * Math.PI) * .9,
          visual.spawn.z + (item.z - visual.spawn.z) * eased,
        );
        if (t >= 1) { visual.group.position.y = 0; visual.spawn = null; }
      } else if (!visual.magnet) {
        visual.group.position.set(item.x, 0, item.z);
      }
      const cameraDx = context.camera.position.x - visual.group.position.x, cameraDz = context.camera.position.z - visual.group.position.z;
      const cameraOnFront = cameraDx * Math.sin(visual.group.rotation.y) + cameraDz * Math.cos(visual.group.rotation.y) >= 0;
      const faceSign = cameraOnFront ? 1 : -1;
      visual.rays.position.z = -faceSign * .12;
      context.lootRayMaterial.rotation = context.elapsed * .32;
      const pulse = .96 + Math.sin(context.elapsed * 2.7 + item.x * 2 + item.z) * .055;
      visual.rays.scale.setScalar(1.9 * pulse);
      for (let i = 0; i < visual.glints.length; i++) {
        const glint = visual.glints[i], phase = (context.elapsed * (1.35 + i * .13) + i * 1.9 + item.x * .4) % 3.4;
        const flash = Math.max(0, 1 - Math.abs(phase - 1.7) / .42);
        glint.position.z = faceSign * .12;
        glint.material.opacity = flash * .94;
        glint.material.rotation = context.elapsed * (i % 2 ? -.42 : .52) + i;
        glint.scale.setScalar(.07 + flash * .19);
      }
      if (visual.spawn) continue;
      const radiusSignature = `${context.itemMagnetSettings.radius}:${context.itemMagnetSettings.radiusSpread}`;
      if (visual.magnetRadiusSignature !== radiusSignature) {
        visual.magnetRadiusSignature = radiusSignature;
        visual.magnetRadius = itemMagnetRadiusForItem(item.id, context.itemMagnetSettings);
      }
      if (unlockDroppedLootAfterLeaving(item, context.heroBody.x, context.heroBody.z, visual.magnetRadius)) context.persistCampaign();
      if (item.pickupBlocked) continue;
      if (!visual.magnet && context.heroBody.health > 0
        && Math.hypot(context.heroBody.x - item.x, context.heroBody.z - item.z) <= visual.magnetRadius) {
        const motion = sampleItemMagnetMotion(context.itemMagnetSettings);
        visual.magnet = { from: { x: visual.group.position.x, y: visual.group.position.y, z: visual.group.position.z }, age: 0,
          duration: motion.worldDuration, arc: motion.worldArc };
      }
      if (visual.magnet) {
        visual.magnet.age += dt;
        const progress = Math.min(1, visual.magnet.age / visual.magnet.duration);
        const position = itemMagnetWorldPosition(visual.magnet, progress, { x: context.heroBody.x, y: .92, z: context.heroBody.z });
        visual.group.position.set(position.x, position.y, position.z);
        visual.group.scale.setScalar(position.scale);
        if (progress >= 1) {
          const pickup = takeWorldLoot(context.activeLocation.loot, item.id);
          if (!pickup) continue;
          const placedItem = catalogAsset(visual.group.userData.sceneEditAsset);
          if (placedItem?.kind === 'world-item') {
            const collected = context.activeLocation.collectedPlacedItems ??= [];
            if (!collected.includes(item.id)) collected.push(item.id);
          }
          const playerScreen = new THREE.Vector3(context.heroBody.x, .2, context.heroBody.z).project(context.camera);
          const backpackRect = document.querySelector('#inventory-toggle').getBoundingClientRect();
          const from = { x: (playerScreen.x + 1) * innerWidth / 2, y: (1 - playerScreen.y) * innerHeight / 2 };
          const to = { x: backpackRect.left + backpackRect.width / 2, y: backpackRect.top + backpackRect.height / 2 };
          const icon = context.lootIconCanvases.get(pickup.itemId === 'coins' ? coinSkin(pickup.amount).id : pickup.itemId) ?? context.lootIconCanvases.get('scrap');
          if (icon) {
            const motion = sampleItemMagnetMotion(context.itemMagnetSettings);
            context.itemIconFlights.push({ icon, flight: createItemIconFlight(from, to,
              { duration: motion.iconDuration, arc: motion.iconArc }) });
          }
          context.activeLocation.sceneGroup.remove(visual.group);
          const facePairIndex = context.sceneryFacePairs.indexOf(visual.facePair);
          if (facePairIndex >= 0) context.sceneryFacePairs.splice(facePairIndex, 1);
          context.worldItemVisuals.delete(item.id);
          for (const glint of visual.glints) glint.material.dispose();
          if (pickup.itemId === 'coins') creditCoins(context.campaignState, pickup.amount); else addItems(context.campaignState, { [pickup.itemId]: 1 });
          context.audio.play('pickup'); context.renderInventory(); context.burst(context.heroBody.x, context.heroBody.z, .48); context.vibrate(16); context.persistCampaign();
        }
      }
    }
    for (const pickup of context.activeLocation.storyPickups ?? []) {
      if (context.campaignState.flags[pickup.flag]) continue;
      let visual = context.storyPickupVisuals.get(pickup.id);
      if (!visual) visual = createStoryPickupVisual(context.activeLocation, pickup);
      visual.group.rotation.y = Math.atan2(context.camera.position.x - pickup.x, context.camera.position.z - pickup.z) + visual.spin;
      const pulse = .9 + Math.sin(context.elapsed * 3.6 + pickup.z) * .09;
      visual.beam.scale.y = 1.7 * pulse;
      visual.beam.position.y = .34 + .74 * pulse;
      visual.beam.material.opacity = .86 + (Math.sin(context.elapsed * 4 + pickup.x) + 1) * .07;
      visual.glow.material.opacity = .055 + (Math.sin(context.elapsed * 4 + pickup.z) + 1) * .025;
      if (context.heroBody.health <= 0 || Math.hypot(context.heroBody.x - pickup.x, context.heroBody.z - pickup.z) > PUCK_RADIUS + .35) continue;
      const collected = collectCampaignStoryPickup(context.campaignState, context.activeLocation.id, pickup.id);
      if (!collected) continue;
      context.audio.play('clue');
      context.activeLocation.sceneGroup.remove(visual.group); context.storyPickupVisuals.delete(pickup.id);
      visual.glow.geometry.dispose(); visual.glow.material.dispose();
      context.burst(pickup.x, pickup.z, .7); context.vibrate(24); context.persistCampaign();
      context.showStoryCard({ title: context.activeLocation.title, text: 'Ты подобрал вещь, которую дед потерял у ручья.',
        lines: getStoryDialogue(context.campaignState, context.activeLocation.id, 'pickup') });
      break;
    }
  }

  function updateCacheAnimation(dt) {
    for (const visual of context.chestVisuals.values()) {
      if (visual.body.locationId !== context.activeLocation.id || !visual.opening) continue;
      const motion = advanceCacheOpening(visual.opening, dt);
      visual.artHolder.position.y = motion.holderY + motion.lift;
      visual.artHolder.scale.set(motion.scaleX, motion.scaleY, 1);
      visual.puck.scale.setScalar(motion.puckScale);
      if (motion.landed) {
        context.burst(visual.body.x, visual.body.z, .72);
        context.vibrate(28);
      }
      if (motion.opened) {
        visual.body.opened = true; visual.body.opening = false;
        context.activeLocation.obstacles = context.activeLocation.obstacles.filter(obstacle => obstacle !== visual.body);
        if (visual.body.kind === 'editor-chest') {
          const opened = context.activeLocation.openedPlacedChests ??= [];
          if (!opened.includes(visual.body.id)) opened.push(visual.body.id);
          context.persistCampaign();
        }
        visual.puck.visible = false;
        visual.stateArt[0].visible = false;
        visual.stateArt[1].visible = true;
        context.audio.play('chest');
        context.rebuildBodies();
      }
      if (motion.spilled) for (const loot of visual.lootVisuals) {
        loot.spillLocked = false; loot.group.visible = true;
        loot.spawn = { x: visual.body.x, z: visual.body.z, age: 0, duration: CACHE_LOOT_SPAWN_DURATION };
      }
      if (motion.complete) {
        visual.opening = null;
        visual.artHolder.position.y = 0;
        visual.artHolder.scale.set(1, 1, 1);
        visual.puck.visible = false; visual.puck.scale.setScalar(0);
        visual.stateArt[0].visible = false;
        visual.stateArt[1].visible = true;
      }
    }
  }

  function showCacheStoryAfterLootLands() {
    for (const visual of context.chestVisuals.values()) {
      if (visual.body.locationId !== context.activeLocation.id || !visual.pendingStory || visual.opening
        || visual.lootVisuals.some(item => item.group.parent && item.spawn)) continue;
      const story = visual.pendingStory; visual.pendingStory = null;
      context.showStoryCard(story); return true;
    }
    return false;
  }
  return { createLootVisual, createStoryPickupVisual, makeCacheBody, createPlacedChest, spawnWorldLoot, openCache, updateWorldLoot, updateCacheAnimation, showCacheStoryAfterLootLands, dropInventoryItem, findInventoryDropPosition };
}
