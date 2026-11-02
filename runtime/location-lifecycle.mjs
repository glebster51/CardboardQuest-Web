import * as THREE from '../vendor/three/build/three.module.js?v=f484ba7b7b13e7f6';
import { regroundLocationScenery } from '../render/scenery-grounding.mjs?v=f484ba7b7b13e7f6';
import { installTerrainVolumeTexture } from '../render/terrain-volume-texture.mjs?v=f484ba7b7b13e7f6';
import { sceneResources } from '../render/scene-resources.mjs?v=f484ba7b7b13e7f6';
import { restoreTerrainSampler } from '../render/terrain-sampler.mjs?v=f484ba7b7b13e7f6';
import { applyTerrainEdgeStyle } from '../render/terrain-edge-style.mjs?v=f484ba7b7b13e7f6';
import { createLocationEdgeShade } from '../render/location-edge-shade.mjs?v=f484ba7b7b13e7f6';
import { hideUIWindow, indicateUIChange, showUIWindow } from '../render/ui-window-motion.mjs?v=f484ba7b7b13e7f6';
import { catalogAsset } from '../editor/asset-catalog.mjs?v=f484ba7b7b13e7f6';
import { createEntryCheckpoint } from '../game/campaign-checkpoint.mjs?v=f484ba7b7b13e7f6';
import { advanceDayNightClock } from '../game/day-night.mjs?v=f484ba7b7b13e7f6';
import { getStoryDialogue } from '../game/story-dialogue.mjs?v=f484ba7b7b13e7f6';
import { applyCampaignGraphToLocation } from '../game/campaign-graph.mjs?v=f484ba7b7b13e7f6';
import { createLocationMerchants } from '../render/merchants.mjs?v=f484ba7b7b13e7f6';
import { createStoryActors } from '../render/story-actors.mjs?v=f484ba7b7b13e7f6';
import { createGroundRenderer } from '../render/ground-renderer.mjs?v=f484ba7b7b13e7f6';
import { createGroundGrid } from '../render/ground-grid.mjs?v=f484ba7b7b13e7f6';
import { createLocationExitVisuals } from '../render/location-exits.mjs?v=f484ba7b7b13e7f6';
import { populateNarrativeScenery } from '../render/location-scenery.mjs?v=f484ba7b7b13e7f6';
import { isPlayableFloor } from '../game/world-hazards.mjs?v=f484ba7b7b13e7f6';
import { PUCK_RADIUS } from '../physics.mjs?v=f484ba7b7b13e7f6';
import { loadLocationDepthMaps } from '../depth-map-assets.mjs?v=f484ba7b7b13e7f6';
import { refillCharges } from '../charge-recharge.mjs?v=f484ba7b7b13e7f6';
import { createLocationWalkPaths, scatterGroundDetails } from '../ground-decoration.mjs?v=f484ba7b7b13e7f6';
import { visitCampaignLocation } from '../game/story-campaign.mjs?v=f484ba7b7b13e7f6';
import { locationNeedsLootSprites } from '../game/world-items.mjs?v=f484ba7b7b13e7f6';
import { isCampaignPositionSafe } from '../game/story-world.mjs?v=f484ba7b7b13e7f6';
import { advanceStatusLocations } from '../game/status-effects.mjs?v=f484ba7b7b13e7f6';
import { CAMP_HUT_ANCHORS, LOCATION_SCALE, createExitBarrierBodies, lastExitPosition, locationArrival, locationEntryDirection, locationHasLivingEnemies, rememberExitPosition } from '../location-network.mjs?v=f484ba7b7b13e7f6';

/** Application orchestration with explicit live state and service ports.
 * The composition root owns these bindings; this subsystem owns the operations below. */
export function createLocationLifecycle(context) {
  async function buildLocation(id, stillWanted) {
    const location = context.locations[id];
    context.reportLoadStage(`Локация ${id}: подготовка`);
    const checkpoint = async () => {
      await context.yieldLocationWork();
      if (!stillWanted()) throw new Error('Location preparation cancelled');
    };
    await checkpoint();
    let rebuildLayout = !location.layoutReady;
    if (location.art.depthMapUrl && !location.art.depthMap) {
      context.reportLoadStage(`Карта глубины: ${id}`);
      await loadLocationDepthMaps({ [id]: location });
      context.reportLoadStage(`Карта глубины: ${id}`, 'ready');
      rebuildLayout = true;
    }
    context.reportLoadStage(`Геометрия террейна: ${id}`);
    const terrain = await context.geometryClient.run('terrain', {
      id, scale: LOCATION_SCALE, layoutReady: !rebuildLayout,
      heightSeed: location.heightSeed, walkablePoints: location.walkablePoints,
      exits: location.exits, dropZones: location.dropZones, hazards: location.hazards,
      fogPaths: location.fogPaths,
      art: location.art, terrainStyle: location.terrainStyle, terrainEdits: context.sceneRegistry.terrainEdits(id),
      fog: { enabled: context.sceneRegistry.fogFor(id).enabled, start: context.sceneRegistry.fogFor(id).start, end: context.sceneRegistry.fogFor(id).end } });
    if (terrain.layout) Object.assign(location, terrain.layout);
    if (context.activeCampaignGraph) { applyCampaignGraphToLocation(location, context.activeCampaignGraph); context.sceneRegistry.graphChanged(location); }
    applyTerrainEdgeStyle(terrain.group, THREE, context.sceneRegistry.terrainStyle);
    location.sceneGroup = terrain.group; context.locationGroups[id] = terrain.group;
    terrain.group.visible = false; context.scene.add(terrain.group);
    context.reportLoadStage(`Геометрия террейна: ${id}`, 'ready', `${terrain.group.children.length} элементов`);
    location.terrainHeightMap = restoreTerrainSampler(terrain.heightMap,
      { rounded: terrain.rounded, depthMap: Boolean(location.art.depthMap), walkablePoints: location.walkablePoints,
        sculpted: context.sceneRegistry.terrainEdits(id).strokes.length > 0 });
    delete location.terrainHeightMap.layers;
    terrain.group.userData.terrainHeightMap = location.terrainHeightMap;
    installTerrainVolumeTexture(THREE,context.renderer,location);
    terrain.group.userData.walkablePoints = location.walkablePoints;
    context.reportLoadStage(`Кромки и туман: ${id}`);
    location.edgeShade = await createLocationEdgeShade({ THREE, location, settings: context.sceneRegistry.fogFor(id),
      revealUniforms: context.playerOcclusionDither.uniforms,
      yieldWork: checkpoint });
    location.edgeShade?.update(context.sceneRegistry.fogFor(id));
    if (location.edgeShade?.texture) context.renderer.initTexture(location.edgeShade.texture);
    context.reportLoadStage(`Кромки и туман: ${id}`, 'ready');
    await checkpoint();
    // Fail a missing mandatory boss resource before allocating the camp's
    // figure pools, which would otherwise be discarded and rebuilt on retry.
    if (id === 'camp') await context.ensureRockEffectAssets();
    await context.createLocationEnemies(location);
    if (id === 'camp') {
      location.reinforcementQueue = (context.campaignState.world?.camp?.reinforcementQueue ?? []).map(due => due + context.elapsed);
      await context.restoreSavedCampEnemies();
      await context.preloadCampEnemies();
      if (!location.bossSpawned) await context.preloadCampOgre();
    }
    await checkpoint();
    if (locationNeedsLootSprites(location)) await context.ensureLootSprites();
    let sceneryIndex = 0;
    const createSceneryTracked = async (...args) => {
      const asset = args[0], catalogEntry = catalogAsset(asset);
      const label = `${id} · ${catalogEntry?.label ?? asset} · ${++sceneryIndex}`;
      context.reportLoadStage(`Пропс: ${label}`);
      try {
        const prop = await context.createScenery(...args);
        context.reportLoadStage(`Пропс: ${label}`, 'ready');
        return prop;
      } catch (error) {
        context.reportLoadStage(`Пропс: ${label}`, 'error', error.message || String(error));
        throw error;
      }
    };
    context.reportLoadStage(`Окружение: ${id}`);
    await populateNarrativeScenery({ locations: { [id]: location }, createScenery: createSceneryTracked, loadTemplate: context.loadSceneryTemplate,
      scale: LOCATION_SCALE, hutAnchors: CAMP_HUT_ANCHORS, puckRadius: PUCK_RADIUS, yieldWork: checkpoint });
    context.reportLoadStage(`Сюжетные персонажи: ${id}`);
    const actors = await createStoryActors({ locations: { [id]: location }, createScenery: createSceneryTracked, scale: LOCATION_SCALE, campaign: context.campaignState });
    context.storyActors.actors.push(...actors.actors);
    context.merchantActors.push(...await createLocationMerchants({ location, createScenery: createSceneryTracked, scale: LOCATION_SCALE }));
    context.reportLoadStage(`Сюжетные персонажи: ${id}`, 'ready', `${actors.actors.length} актёров`);
    await checkpoint();
    context.reportLoadStage(`Подготовка оформления земли: ${id}`);
    context.groundResources = await createGroundRenderer({ THREE, renderer: context.renderer, locations: { [id]: location }, specsByLocation: context.decorationSpecs,
      pathTargets: { camp: CAMP_HUT_ANCHORS.map(hut => ({ x: context.scaled(hut.x), z: context.scaled(hut.z) })) },
      createLocationWalkPaths, scatterGroundDetails, resources: context.groundResources, geometryClient: context.geometryClient, yieldWork: checkpoint,
      reportStatus: context.reportLoadStage });
    createGroundGrid(THREE, location, context.sceneRegistry.groundGrid, context.sceneRegistry.groundGridColor(id));
    context.reportLoadStage(`Оформление земли: ${id}`, 'ready', 'декали и трава скрыты');
    context.reportLoadStage(`Выходы и барьеры: ${id}`);
    const exitLocked = locationHasLivingEnemies(location);
    location.exitBarriers = createExitBarrierBodies(location);
    if (exitLocked) location.obstacles.push(...location.exitBarriers);
    location.exitVisuals = createLocationExitVisuals({ THREE, location, locked: exitLocked });
    location.exitVisuals.shadowMaterial.color.set(context.sceneRegistry.fogFor(id).color);
    context.reportLoadStage(`Выходы и барьеры: ${id}`, 'ready');
    if (location.secret) {
      context.reportLoadStage(`Сундук: ${id}`);
      const chestTemplates = await context.loadStateTemplates('assets/chest-states.png', 2);
      await context.makeCacheBody(location, chestTemplates);
      context.reportLoadStage(`Сундук: ${id}`, 'ready');
    }
    for (const item of location.loot) {
      context.reportLoadStage(`Добыча: ${item.id}`);
      context.createLootVisual(location, item); await checkpoint();
      context.reportLoadStage(`Добыча: ${item.id}`, 'ready');
    }
    for (const pickup of location.storyPickups ?? []) if (!context.campaignState.flags[pickup.flag]) {
      context.reportLoadStage(`Сюжетный предмет: ${pickup.id}`);
      context.createStoryPickupVisual(location, pickup);
      context.reportLoadStage(`Сюжетный предмет: ${pickup.id}`, 'ready');
    }
    context.reportLoadStage(`Редакторские объекты: ${id}`);
    await context.sceneRegistry.restorePlaced(location, context.createEditorAsset);
    context.sceneRegistry.prepare(location);
    context.reportLoadStage(`Редакторские объекты: ${id}`, 'ready', `${context.sceneRegistry.bindings(id).length} объектов`);
    for (const figure of context.figures) if (figure.locationId === id && figure.body.team === 'enemy' && !figure.body.editorPlaced)
      context.sceneRegistry.bindEntity(location, `enemy:${figure.body.id}`, `Враг · ${figure.body.archetype}`, figure.group, {
        category: 'enemies', deletable: false,
        sync() { figure.body.x = figure.group.position.x; figure.body.z = figure.group.position.z; figure.facing = figure.group.rotation.y; },
      });
    location.edgeShade?.applyTo(location.sceneGroup);
    // Upload each bitmap while the scene is hidden, instead of uploading all of
    // a neighboring location's textures in its first visible frame.
    const roots = [location.sceneGroup, ...context.figures.filter(figure => figure.locationId === id).map(figure => figure.group)];
    if (!context.frameWorkStarted) roots.push(context.heroFigure.group);
    let textureIndex = 0;
    for (const resource of sceneResources(roots)) if (resource.isTexture) {
      textureIndex++;
      context.reportLoadStage(`GPU-текстура ${textureIndex}: ${resource.name || resource.image?.src?.split('/').pop() || 'CanvasTexture'}`);
      context.renderer.initTexture(resource); await checkpoint();
      context.reportLoadStage(`GPU-текстура ${textureIndex}`, 'ready');
    }
    await checkpoint();
    location.runtimeReady = true;
    context.reportLoadStage(`Локация ${id}: готова`, 'ready');
    if (!location.secret) void context.ensureInspectionMarker(location);
    return location;
  }

  async function rebuildLocationTerrain(location, edits) {
    if (!location?.runtimeReady || !location.sceneGroup) return;
    const result = await context.geometryClient.run('terrain', {
      id: location.id, scale: LOCATION_SCALE, layoutReady: true, heightSeed: location.heightSeed,
      walkablePoints: location.walkablePoints, exits: location.exits, dropZones: location.dropZones,
      fogPaths: location.fogPaths,
      hazards: location.hazards, art: location.art, terrainStyle: location.terrainStyle, terrainEdits: edits,
      fog: { enabled: context.sceneRegistry.fogFor(location.id).enabled, start: context.sceneRegistry.fogFor(location.id).start, end: context.sceneRegistry.fogFor(location.id).end },
    });
    const isTerrain = object => /^(terrain|playfield)-top-/.test(object.name);
    const removed = location.sceneGroup.children.filter(isTerrain);
    for (const object of removed) location.sceneGroup.remove(object);
    const replacement = result.group.children.filter(isTerrain);
    applyTerrainEdgeStyle(result.group, THREE, context.sceneRegistry.terrainStyle);
    location.edgeShade?.applyTo(result.group);
    for (const object of replacement) {
      location.sceneGroup.add(object);
    }
    location.terrainHeightMap = restoreTerrainSampler(result.heightMap,
      { rounded: result.rounded, depthMap: Boolean(location.art.depthMap), walkablePoints: location.walkablePoints,
        sculpted: edits.strokes.length > 0 });
    delete location.terrainHeightMap.layers;
    location.sceneGroup.userData.terrainHeightMap = location.terrainHeightMap;
    installTerrainVolumeTexture(THREE,context.renderer,location);
    regroundLocationScenery(location);
    location.groundGridMesh?.userData.refreshTerrain();
    for(const fall of context.cardboardFalls)if(fall.prop.parent===location.sceneGroup)
      fall.baseY=fall.prop.position.y-(fall.prop.userData.cardboardGroundLift??0);
    context.resourceOwner.release([...removed, result.group], [context.scene]);
    context.renderer.renderLists.dispose();
  }

  async function releaseLocation(id) {
    const location = context.locations[id], removed = [];
    location.terrainVolumeTexture?.dispose();delete location.terrainVolumeTexture;
    context.sceneRegistry.release(id);
    if (location.runtimeReady) context.campaignState.world[id] = context.snapshotLocation(location);
    if (location.sceneGroup) { removed.push(location.sceneGroup); context.scene.remove(location.sceneGroup); }
    for (let index = context.figures.length - 1; index >= 0; index--) {
      const figure = context.figures[index];
      if (figure === context.heroFigure || figure.locationId !== id) continue;
      removed.push(...context.createFigure.detach(figure));
      context.figures.splice(index, 1);
    }
    const belongs = object => removed.some(root => { for (let p = object; p; p = p.parent) if (p === root) return true; return false; });
    for (let index = context.sceneryFacePairs.length - 1; index >= 0; index--)
      if (belongs(context.sceneryFacePairs[index].prop)) context.sceneryFacePairs.splice(index, 1);
    for (const cache of [context.worldItemVisuals, context.storyPickupVisuals]) for (const [key, visual] of cache)
      if (belongs(visual.group)) cache.delete(key);
    for (let index = context.storyActors.actors.length - 1; index >= 0; index--)
      if (context.storyActors.actors[index].spec.location === id) context.storyActors.actors.splice(index, 1);
    for (let index = context.merchantActors.length - 1; index >= 0; index--) if (context.merchantActors[index].locationId === id) context.merchantActors.splice(index, 1);
    for (const [key, visual] of context.chestVisuals) if (visual.body.locationId === id) context.chestVisuals.delete(key);
    delete context.locationGroups[id];
    delete location.sceneGroup; delete location.terrainHeightMap; delete location.groundDetails;
    delete location.inspectionMarker;
    delete location.edgeShade;
    delete location.cacheBody; delete location.exitVisuals; delete location.exitBarriers;
    location.enemies = []; location.obstacles = []; location.runtimeReady = false;
    if (id === 'camp') { context.campGoblinPool.length = 0; context.campOgrePool = null; }
    const retained = [context.scene, ...[...context.lootSpriteModels.values()].map(model => model.group)];
    removed.push(...await context.createFigure.releaseUnused(new Set(context.figures.map(figure => figure.prefix))));
    removed.push(...await context.scenerySystem.releaseUnused(retained));
    context.resourceOwner.release(removed, retained);
    if (location.art.depthMapUrl) delete location.art.depthMap;
    context.renderer.renderLists.dispose();
  }

  async function enterLocation(locationId, fromLocationId) {
    context.shop.hide();
    const next = context.locations[locationId];
    if (!next || context.locationTransition) return;
    let failedRetryButton = null;
    context.failedTransitionTo = null;
    void hideUIWindow(document.querySelector('#error'));
    context.clearAllEarthShatter();
    rememberExitPosition(context.activeLocation, locationId, context.heroBody);
    context.inputController.cancel();
    context.persistCampaign();
    if (fromLocationId !== locationId) {
      context.campaignState.entryCheckpoint = createEntryCheckpoint(context.campaignState, context.activeLocation, locationId,
        point => isCampaignPositionSafe(context.activeLocation, point));
      context.persistCampaign();
    }
    context.locationTransition = true;
    context.loading.hidden = context.locationStreaming.isReady(locationId);
    try {
      const prepared = await context.locationStreaming.retain(locationId);
      if (!prepared) return false;
      context.heroFigure.victoryAnimation = null;
      context.clearProjectiles();
      refillCharges(context.heroBody);
      context.activeLocation = next;
      context.activeFogLocationId = context.activeLocation.id;
      context.sceneRegistry.activateLocation(context.activeFogLocationId);
      let clockAdvance = null;
      if (fromLocationId !== locationId) {
        clockAdvance = advanceDayNightClock(context.campaignState);
        context.campaignState.timeState = clockAdvance.timeState; context.campaignState.dayNumber = clockAdvance.dayNumber;
        context.sceneRegistry.setTimeOfDay(clockAdvance.state.period); context.renderDayClock();
        if (clockAdvance.newDay) context.resetCampaignEncountersForNewDay();
      }
      context.heroFigure.locationId = context.activeLocation.id;
      context.audio.play('transition');
      context.dialogue.close();
      context.protectedEntryFrom = fromLocationId;
      const remembered = context.sceneRegistry.hasEdit(context.activeLocation.id, `arrival:${fromLocationId}`)
        ? null : lastExitPosition(context.activeLocation, fromLocationId);
      const arrival = remembered && isPlayableFloor(context.activeLocation, remembered.x, remembered.z, .2)
        ? remembered : locationArrival(context.activeLocation, fromLocationId);
      context.heroBody.x = arrival.x; context.heroBody.z = arrival.z; context.heroBody.vx = 0; context.heroBody.vz = 0;
      context.heroBody.lastSafePosition = { x: arrival.x, z: arrival.z };
      context.locationArrivalCheckpoint = { locationId: context.activeLocation.id, x: arrival.x, z: arrival.z,
        health: context.heroBody.health, charges: context.heroBody.charges, rechargeTimer: context.heroBody.rechargeTimer,
        coins: context.campaignState.coins, inventorySlots: [...(context.campaignState.inventorySlots ?? [])],
        statusEffects: structuredClone(context.campaignState.statusEffects ?? []),
        combatTriggered: context.activeLocation.combatTriggered, loot: context.activeLocation.loot.map(item => ({ ...item })),
        defeats: context.activeLocation.defeats, goblinsSpawned: context.activeLocation.goblinsSpawned,
        bossSpawned: context.activeLocation.bossSpawned, initialized: context.activeLocation.initialized };
      const direction = locationEntryDirection(context.activeLocation, fromLocationId);
      const heading = Math.atan2(direction.x, direction.z);
      context.heroFigure.facing = heading; context.heroFigure.group.rotation.y = heading;
      context.orbit.theta = heading + Math.PI;
      context.target.set(context.heroBody.x, context.cameraFocusHeight, context.heroBody.z);
      context.transitionCooldown = .85;
      const visit = visitCampaignLocation(context.campaignState, context.activeLocation.id);
      if (fromLocationId !== context.activeLocation.id) advanceStatusLocations(context.campaignState);
      context.updateEnemySpawners(context.activeLocation, 0);
      context.renderStatusEffectsHud();
      context.storyActors.update();
      if (context.activeLocation.kind === 'camp') {
        context.activeLocation.initialized = true;
        for (const figure of context.figures.filter(item => item.locationId === 'camp' && !item.poolDormant
          && !item.body.boss && item.body.health > 0 && !item.body.spawnReady && !item.spawnAnimation)) {
          context.beginSpawn(figure, figure.spawnSource);
        }
      }
      context.showActiveLocationFigures();
      context.rebuildBodies();
      context.refreshLocationInfo();
      context.renderInventory();
      context.persistCampaign();
      context.prepareScenePresentation();
      if (visit?.firstVisit) context.showStoryCard({ title: context.activeLocation.title, text: context.activeLocation.campaignIntro,
        lines: getStoryDialogue(context.campaignState, context.activeLocation.id, 'intro') });
      return true;
    } catch (error) {
      console.error('Не удалось открыть локацию', error);
      context.reportLoadStage(`Переход в локацию ${locationId}`, 'error', error.message || String(error));
      context.failedTransitionTo = locationId;
      const panel = document.querySelector('#error'), message = document.createElement('p');
      panel.dataset.uiAnchor ??= 'center'; panel.dataset.uiMotionSurface = '';
      message.textContent = 'Не удалось подготовить следующее место. Можно повторить переход или остаться здесь.';
      const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Повторить переход';
      retry.disabled = true; failedRetryButton = retry;
      retry.addEventListener('click', () => {
        const retryWhenReady = () => {
          if (context.locationTransition) { setTimeout(retryWhenReady, 16); return; }
          void enterLocation(locationId, fromLocationId);
        };
        retryWhenReady();
      });
      const stay = document.createElement('button'); stay.type = 'button'; stay.textContent = 'Остаться здесь';
      stay.addEventListener('click', () => { void hideUIWindow(panel); });
      panel.replaceChildren(message, retry, stay); void showUIWindow(panel); indicateUIChange(panel, 'error');
      return false;
    } finally {
      context.locationTransition = false; context.loading.hidden = true;
      if (failedRetryButton) failedRetryButton.disabled = false;
    }
  }
  return { buildLocation, releaseLocation, enterLocation, rebuildLocationTerrain };
}
