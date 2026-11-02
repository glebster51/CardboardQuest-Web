import { createWorldItemsController } from './runtime/world-items-controller.mjs?v=f484ba7b7b13e7f6';
import { createCombatController } from './runtime/combat-controller.mjs?v=f484ba7b7b13e7f6';
import { createLocationLifecycle } from './runtime/location-lifecycle.mjs?v=f484ba7b7b13e7f6';
import { updateFigurePresentation } from './render/figure-presentation.mjs?v=f484ba7b7b13e7f6';
import { applicationMode } from './game/application-mode.mjs?v=f484ba7b7b13e7f6';
import { captureLocationSnapshot, persistCampaignSnapshot } from './game/campaign-snapshot.mjs?v=f484ba7b7b13e7f6';
import { applyCombatDamage } from './game/combat-damage.mjs?v=f484ba7b7b13e7f6';
import { OGRE_SETTINGS, loadOgreSettings, setOgreSettings } from './bosses/ogre/settings.mjs?v=f484ba7b7b13e7f6';
import * as THREE from './vendor/three/build/three.module.js?v=f484ba7b7b13e7f6';
import { getBrowserStorage, createMemoryStorage } from './storage.mjs?v=f484ba7b7b13e7f6';
import { createCampaignSaveRepository } from './game/campaign-save.mjs?v=f484ba7b7b13e7f6';
import { createSaveStatus } from './render/save-status.mjs?v=f484ba7b7b13e7f6';
import { createGameAudio } from './audio/game-audio.mjs?v=f484ba7b7b13e7f6';
import { createAudioControls } from './audio/audio-controls.mjs?v=f484ba7b7b13e7f6';
import { audioMood, audioAmbience, chargeReadyCue } from './audio/audio-rules.mjs?v=f484ba7b7b13e7f6';
import { createLocationStreaming } from './game/location-streaming.mjs?v=f484ba7b7b13e7f6';
import { createGeometryClient } from './render/geometry-client.mjs?v=f484ba7b7b13e7f6';
import { attachSceneryToTerrain, regroundLocationScenery } from './render/scenery-grounding.mjs?v=f484ba7b7b13e7f6';
import { installTerrainVolumeTexture } from './render/terrain-volume-texture.mjs?v=f484ba7b7b13e7f6';
import { DEFAULT_SCREEN_EFFECTS, normalizeScreenEffects, SCREEN_EFFECT_SETTINGS_KEY } from './screen-effects.mjs?v=f484ba7b7b13e7f6';
import { createSceneResourceOwner } from './render/scene-resources.mjs?v=f484ba7b7b13e7f6';
import { restoreTerrainSampler } from './render/terrain-sampler.mjs?v=f484ba7b7b13e7f6';
import { applyTerrainEdgeStyle } from './render/terrain-edge-style.mjs?v=f484ba7b7b13e7f6';
import { createLocationEdgeShade, LOCATION_FAR_COLOR } from './render/location-edge-shade.mjs?v=f484ba7b7b13e7f6';
import { createPlayerOcclusionDither } from './render/player-occlusion-dither.mjs?v=f484ba7b7b13e7f6';
import { applyCardboardOcclusionStencil } from './render/enemy-occlusion-silhouette.mjs?v=f484ba7b7b13e7f6';
import { createHexTiltShiftShader, createPostEffectInputShader, createTiltShiftCompositeShader, tiltShiftRenderPixelRatio } from './render/hex-tilt-shift.mjs?v=f484ba7b7b13e7f6';
import { renderSharpHudOverlay } from './render/sharp-hud-overlay.mjs?v=f484ba7b7b13e7f6';
import { hideUIWindow, indicateUIChange, installUIFeedback, showUIWindow } from './render/ui-window-motion.mjs?v=f484ba7b7b13e7f6';
import { createStatusHeartMaterials } from './render/status-effect-visuals.mjs?v=f484ba7b7b13e7f6';
import { SCENE_OVERRIDES as RELEASE_SCENE_OVERRIDES } from './scene-overrides.mjs?v=f484ba7b7b13e7f6';
import { createSceneRegistry } from './scene/scene-registry.mjs?v=f484ba7b7b13e7f6';
import { SCENE_BUILD } from './scene/schema.mjs?v=f484ba7b7b13e7f6';
import { clearLocalEditorDraft, isLocalEditorOrigin } from './editor/release-local-editor-state.mjs?v=f484ba7b7b13e7f6';
import { connectLocalEditor, loadLocalEditorUi } from './editor/release-local-editor-client.mjs?v=f484ba7b7b13e7f6';
import { ASSET_CATALOG, catalogAsset } from './editor/asset-catalog.mjs?v=f484ba7b7b13e7f6';
import { createCardboardGrainTexture } from './cardboard-surface.mjs?v=f484ba7b7b13e7f6';
import { CARDBOARD_DAMAGE_DEFAULTS, cardboardDamageStageForHealth, cardboardPropDamageStageForHealth, applyCardboardPropHit, updateCardboardDamageTree } from './cardboard-damage.mjs?v=f484ba7b7b13e7f6';
import { advanceEnemyAI } from './game/enemy-ai.mjs?v=f484ba7b7b13e7f6';
import { advanceEarthShatterWave, createEarthShatterWave, earthShatterRockCanDamage,
  createEarthShatterKnockback,
  earthShatterAttackPoseActive } from './game/earth-shatter.mjs?v=f484ba7b7b13e7f6';
import { groundSlamProgress, groundSlamJumpHeight, groundSlamContains, createGroundSlamKnockback } from './bosses/ogre/ground-slam.mjs?v=f484ba7b7b13e7f6';
import { bossCanShatterOwnRock } from './bosses/ogre/attacks.mjs?v=f484ba7b7b13e7f6';
import { sampleOpeningCinematic } from './game/opening-cinematic.mjs?v=f484ba7b7b13e7f6';
import { createInspectionTrigger } from './game/inspection-trigger.mjs?v=f484ba7b7b13e7f6';
import { resolveSpawnOrigin } from './game/spawn-origin.mjs?v=f484ba7b7b13e7f6';
import { createEntryCheckpoint, createLocationStartCheckpoint, restoreCampaignCheckpointAfterDeath } from './game/campaign-checkpoint.mjs?v=f484ba7b7b13e7f6';
import { captureDeathResumeSnapshot, restoreDeathResumeSnapshot } from './game/death-recovery.mjs?v=f484ba7b7b13e7f6';
import { STORY_ENCOUNTERS, ENEMY_STATS } from './game/encounters.mjs?v=f484ba7b7b13e7f6';
import { advanceEnemySpawner, ENEMY_SPAWNER_DEFAULTS, isEnemySpawnerRequestCurrent, normalizeEnemySpawner } from './game/enemy-spawners.mjs?v=f484ba7b7b13e7f6';
import { advanceDayNightClock, DAY_NIGHT_STATES, resetEncounterSnapshot } from './game/day-night.mjs?v=f484ba7b7b13e7f6';
import { advanceStoneProjectile, projectileStatusEffect } from './game/projectiles.mjs?v=f484ba7b7b13e7f6';
import { createPointerInput } from './game/pointer-input.mjs?v=f484ba7b7b13e7f6';
import { PLAYER_PICK_LAYER, ENEMY_PICK_LAYER } from './game/pick-layers.mjs?v=f484ba7b7b13e7f6';
import { followDirection, followMotion, combatCenterOfMass } from './render/camera-follow.mjs?v=f484ba7b7b13e7f6';
import { getStoryDialogue } from './game/story-dialogue.mjs?v=f484ba7b7b13e7f6';
import { createDialoguePanel } from './render/dialogue-panel.mjs?v=f484ba7b7b13e7f6';
import { createLocationMapView } from './render/location-map-view.mjs?v=f484ba7b7b13e7f6';
import { createCampaignNodeVisuals } from './render/campaign-graph-view.mjs?v=f484ba7b7b13e7f6';
import { createCampaignGraph, applyCampaignGraphToLocation } from './game/campaign-graph.mjs?v=f484ba7b7b13e7f6';
import { buildLocationMapGraph } from './game/location-map-data.mjs?v=f484ba7b7b13e7f6';
import { createInventoryPanel } from './render/inventory-panel.mjs?v=f484ba7b7b13e7f6';
import { EQUIPMENT_ITEMS, combatBonuses, equipInventoryItem, unequipItem, grantEquipmentStarter, playerDamageTaken } from './game/equipment.mjs?v=f484ba7b7b13e7f6';
import { createCharacterEquipment } from './render/character-equipment.mjs?v=f484ba7b7b13e7f6';
import { COIN_SKINS, coinSkin, creditCoins, rollCoins } from './game/currency.mjs?v=f484ba7b7b13e7f6';
import { executeMerchantTrade, canReachMerchant, merchantDefinition } from './game/merchants.mjs?v=f484ba7b7b13e7f6';
import { createLocationMerchants, createMerchantActor } from './render/merchants.mjs?v=f484ba7b7b13e7f6';
import { createShopPanel } from './render/shop-panel.mjs?v=f484ba7b7b13e7f6';
import { createStoryActors, isStoryActorVisible } from './render/story-actors.mjs?v=f484ba7b7b13e7f6';
import { createFigureFactory } from './render/figure-factory.mjs?v=f484ba7b7b13e7f6';
import { updateFigureHitFlash } from './render/figure-hit-flash.mjs?v=f484ba7b7b13e7f6';
import { createEarthShatterVisual, createEarthShatterWarning, createGroundSlamWarning } from './render/earth-shatter.mjs?v=f484ba7b7b13e7f6';
import { loadRockEffectAssets } from './render/rock-effect-animation.mjs?v=f484ba7b7b13e7f6';
import { createGroundRenderer } from './render/ground-renderer.mjs?v=f484ba7b7b13e7f6';
import { createScenePlaceholder, updateScenePlaceholderName } from './render/scene-placeholder.mjs?v=f484ba7b7b13e7f6';
import { createGroundGrid } from './render/ground-grid.mjs?v=f484ba7b7b13e7f6';
import { createLocationExitVisuals, updateLocationExitLock } from './render/location-exits.mjs?v=f484ba7b7b13e7f6';
import { createScenerySystem } from './render/scenery-system.mjs?v=f484ba7b7b13e7f6';
import { sceneryFaceForCamera } from './scenery-face.mjs?v=f484ba7b7b13e7f6';
import { cardboardFallGroundOffset } from './scenery-layout.mjs?v=f484ba7b7b13e7f6';
import { populateNarrativeScenery } from './render/location-scenery.mjs?v=f484ba7b7b13e7f6';
import { hazardAtPoint, isPlayableFloor } from './game/world-hazards.mjs?v=f484ba7b7b13e7f6';
import { launch, advanceWorld, facingAngle, turnToward, isAttacking, WALKABLE_POINTS, PUCK_RADIUS, LAUNCH_GAIN, PLAYER_DASH_DISTANCE_MULTIPLIER, PLAYER_DASH_SPEED_MULTIPLIER, GOBLIN_DASH_MAX_POWER } from './physics.mjs?v=f484ba7b7b13e7f6';
import { loadLocationDepthMaps } from './depth-map-assets.mjs?v=f484ba7b7b13e7f6';
import { createVectorMarker as makeVectorMarker, resizeRingGeometry } from './render/vector-marker.mjs?v=f484ba7b7b13e7f6';
import { advanceChargeRecharge, chargeRechargeProgress, spendCharge, refillCharges, playerChargeRechargeInterval } from './charge-recharge.mjs?v=f484ba7b7b13e7f6';
import { heartHealthLevels, healthHeartRenderOrder, healthRestoreVisual, restoredHeartIndices,
  ricochetDamageQuarters, shouldShowHealthHud } from './heart-health.mjs?v=f484ba7b7b13e7f6';
import { canEnemyDamagePlayer, clearDirectHitProtectionWhenSafe, markDirectPlayerHit } from './game/attack-protection.mjs?v=f484ba7b7b13e7f6';
import { createLocationWalkPaths, pointInWalkableArea, scatterGroundDetails } from './ground-decoration.mjs?v=f484ba7b7b13e7f6';
import { advanceVictoryLoop, canCelebrateLocationVictory, createVictoryLoop, settleEnemiesForVictory } from './victory-animation.mjs?v=f484ba7b7b13e7f6';
import { recoverAfterFall } from './game/fall-recovery.mjs?v=f484ba7b7b13e7f6';
import { CACHE_LOOT_SPAWN_DURATION, advanceCacheOpening, cacheOpeningPhase, createCacheOpening } from './game/cache-animation.mjs?v=f484ba7b7b13e7f6';
import { CAMPAIGN, addItems, campaignLocation, chooseCampaignOption,
  collectCampaignStoryPickup, consumeInventoryItem, createCampaignState, inspectCampaignLocation, openCampaignCache,
  visitCampaignLocation, CAMPAIGN_EDGES } from './game/story-campaign.mjs?v=f484ba7b7b13e7f6';
import { locationNeedsLootSprites, normalizeWorldLoot, rollEditorChestLoot, rollEnemyLoot, scatterWorldLoot, takeWorldLoot, unlockDroppedLootAfterLeaving, WORLD_ITEM_IDS } from './game/world-items.mjs?v=f484ba7b7b13e7f6';
import { INVENTORY_ITEMS, removeInventoryItem } from './game/inventory-items.mjs?v=f484ba7b7b13e7f6';
import { createItemIconFlight, itemIconFlightPosition, itemMagnetWorldPosition, ITEM_MAGNET_DEFAULTS,
  ITEM_MAGNET_STORAGE_KEY, itemMagnetRadiusForItem, normalizeItemMagnetSettings, sampleItemMagnetMotion } from './game/item-magnet.mjs?v=f484ba7b7b13e7f6';
import { createCampaignLocations, isCampaignPositionSafe, resolveCampaignPlayerStart } from './game/story-world.mjs?v=f484ba7b7b13e7f6';
import { createPerformanceProfiler } from './diagnostics/release-performance-profiler.mjs?v=f484ba7b7b13e7f6';
import { advanceStatusEffects, advanceStatusLocations, applyConsumableEffect, applyStatusEffect,
  statusEffectLabels } from './game/status-effects.mjs?v=f484ba7b7b13e7f6';
import { isMobileRenderTarget, localRenderFps, renderQualityProfile } from './game/frame-rate.mjs?v=f484ba7b7b13e7f6';
import { CAMP_BOSS_DEFEATS, CAMP_GOBLIN_SPAWNS, CAMP_GOBLIN_TOTAL, CAMP_HUT_ANCHORS, CAMP_LIVING_CAP, LOCATION_SCALE,
  createExitBarrierBodies, createLocationNetwork, findNearbyExit, lastExitPosition, locationArrival, locationEntryDirection,
  locationHasLivingEnemies, shouldIgnoreEntryExit,
  finishCampReinforcement, recordCampDefeat, rememberExitPosition, takeDueReinforcement, wakeForestCombat } from './location-network.mjs?v=f484ba7b7b13e7f6';

const host = document.querySelector('#scene');
const loading = document.querySelector('#loading');
const loadDebugEnabled = new URLSearchParams(location.search).get('loadDebug') === '1';
const loadDebugPanel = document.querySelector('#load-debug');
const loadDebugList = document.querySelector('#load-debug-list');
const loadDebugCurrent = document.querySelector('#load-debug-current');
let currentLoadStage = 'JavaScript entry';
function reportLoadStage(name, status = 'running', detail = '') {
  currentLoadStage = name;
  if (!loadDebugEnabled || !loadDebugPanel || !loadDebugList) return;
  loadDebugPanel.hidden = false;
  loadDebugCurrent.textContent = `${status.toUpperCase()} · ${name}${detail ? ` · ${detail}` : ''}`;
  const row = document.createElement('li'); row.dataset.state = status;
  row.textContent = `${new Date().toLocaleTimeString()} · ${name} · ${status}${detail ? ` · ${detail}` : ''}`;
  loadDebugList.append(row);
  while (loadDebugList.children.length > 80) loadDebugList.firstElementChild.remove();
  loadDebugList.scrollTop = loadDebugList.scrollHeight;
}
if (loadDebugEnabled) {
  reportLoadStage('JavaScript и статические модули', 'ready');
  window.__CQ_LOAD_STATUS__ = reportLoadStage;
}
const browserStorage = getBrowserStorage();
const localStorage = browserStorage ?? createMemoryStorage();
let campaignSaves;
const showSaveStatus = createSaveStatus(document.querySelector('#save-status'), () => campaignSaves);
campaignSaves = createCampaignSaveRepository({ getStorage: getBrowserStorage, onStatus: showSaveStatus });
const audio = createGameAudio({ storage: localStorage });
const scaled = value => value * LOCATION_SCALE;
const yieldFrameWork = () => new Promise(resolve => {
  if (window.requestIdleCallback) window.requestIdleCallback(resolve, { timeout: 120 });
  else setTimeout(resolve, 16);
});
const heroBody = { id: 'hero', team: 'player', x: 0, z: 0, vx: 0, vz: 0,
  health: 20, maxHealth: 20, charges: 3, maxCharges: 3, rechargeTimer: 0, chargePop: [0, 0, 0] };
const playerRestoredHearts = new Map();
let healthRestoreSerial = 0;
let bodies = [heroBody];
let state = heroBody;
let selected = true;
const GROUND_UI_Y = .026;
const IS_MOBILE_RENDER_TARGET = isMobileRenderTarget({
    userAgent: navigator.userAgent,
    mobileHint: navigator.userAgentData?.mobile,
    pixel7Preview: new URLSearchParams(location.search).get('pixel7Preview') === '1',
  });
const MAX_RENDER_FPS = localRenderFps({
  isLocal: isLocalEditorOrigin(location.hostname), isMobile: IS_MOBILE_RENDER_TARGET,
});
const RENDER_QUALITY = renderQualityProfile(IS_MOBILE_RENDER_TARGET);
const FRAME_INTERVAL_MS = 1000 / MAX_RENDER_FPS;
const performanceProfiler = createPerformanceProfiler({ enabled: isLocalEditorOrigin(location.hostname)
  && ['4174', '4175'].includes(location.port) });
const AIM_DRAG_SENSITIVITY = 1 / 3;
const AIM_MARKER_LENGTH_SCALE = 1 / 1.3;
const MAX_AIM_MARKER_EXTENSION = 5.4 * AIM_MARKER_LENGTH_SCALE;
const randomBetween = (min, max) => min + Math.random() * (max - min);

async function start() {
  const resourceOwner = createSceneResourceOwner();
  const worldItemsController = createWorldItemsController({
    get THREE() { return THREE; },
    get sceneryFacePairs() { return sceneryFacePairs; },
    get loadStateTemplates() { return loadStateTemplates; },
    get activeLocation() { return activeLocation; },
    get ambientShadowMaterial() { return ambientShadowMaterial; },
    get audio() { return audio; },
    get burst() { return burst; },
    get camera() { return camera; },
    get campaignState() { return campaignState; },
    get chestVisuals() { return chestVisuals; },
    get corrugation() { return corrugation; },
    get elapsed() { return elapsed; },
    get heroBody() { return heroBody; },
    get itemIconFlights() { return itemIconFlights; },
    get itemMagnetSettings() { return itemMagnetSettings; },
    get lootBeamGeometry() { return lootBeamGeometry; },
    get lootBeamMaterial() { return lootBeamMaterial; },
    get lootGlintMaterial() { return lootGlintMaterial; },
    get lootGlintOffsets() { return lootGlintOffsets; },
    get lootIconCanvases() { return lootIconCanvases; },
    get lootRayMaterial() { return lootRayMaterial; },
    get lootSpriteModels() { return lootSpriteModels; },
    get paper() { return paper; },
    get persistCampaign() { return persistCampaign; },
    get rebuildBodies() { return rebuildBodies; },
    get refreshLocationInfo() { return refreshLocationInfo; },
    get renderInventory() { return renderInventory; },
    get scaled() { return scaled; },
    get sceneStencil() { return sceneStencil; },
    get showStoryCard() { return showStoryCard; },
    get storyPickupIconGeometry() { return storyPickupIconGeometry; },
    get storyPickupIconMaterial() { return storyPickupIconMaterial; },
    get storyPickupVisuals() { return storyPickupVisuals; },
    get vibrate() { return vibrate; },
    get worldItemVisuals() { return worldItemVisuals; },
  });
  const combatController = createCombatController({
    get activeLocation() { return activeLocation; },
    get audio() { return audio; },
    get breakEarthShatterRockOnActor() { return breakEarthShatterRockOnActor; },
    get burst() { return burst; },
    get campaignState() { return campaignState; },
    get cardboardDamageSettings() { return cardboardDamageSettings; },
    get cardboardDamageTexture() { return cardboardDamageTexture; },
    get cardboardFalls() { return cardboardFalls; },
    get cardboardPerlinTexture() { return cardboardPerlinTexture; },
    get cardboardTearNoiseTexture() { return cardboardTearNoiseTexture; },
    get cardboardVoronoiTexture() { return cardboardVoronoiTexture; },
    get clearAbilityTelegraph() { return clearAbilityTelegraph; },
    get clearEarthShatterForBoss() { return clearEarthShatterForBoss; },
    get clearLostHealthRestoration() { return clearLostHealthRestoration; },
    get dialogue() { return dialogue; },
    get earthShatterRocks() { return earthShatterRocks; },
    get elapsed() { return elapsed; },
    get figureByBody() { return figureByBody; },
    get figures() { return figures; },
    get heroBody() { return heroBody; },
    get locations() { return locations; },
    get merchantActors() { return merchantActors; },
    get merchantContext() { return merchantContext; },
    get openCache() { return openCache; },
    get persistCampaign() { return persistCampaign; },
    get rebuildBodies() { return rebuildBodies; },
    get refreshLocationInfo() { return refreshLocationInfo; },
    get setVisualState() { return setVisualState; },
    get shop() { return shop; },
    get spawnCampBoss() { return spawnCampBoss; },
    get spawnWorldLoot() { return spawnWorldLoot; },
    get syncFigureDamageStage() { return syncFigureDamageStage; },
    get vibrate() { return vibrate; },
  });
  const locationLifecycle = createLocationLifecycle({
    get resourceOwner() { return resourceOwner; },
    get createScenery() { return createScenery; },
    get loadSceneryTemplate() { return loadSceneryTemplate; },
    get loadStateTemplates() { return loadStateTemplates; },
    get sceneryFacePairs() { return sceneryFacePairs; },
    get activeCampaignGraph() { return activeCampaignGraph; },
    get activeFogLocationId() { return activeFogLocationId; }, set activeFogLocationId(value) { activeFogLocationId = value; },
    get activeLocation() { return activeLocation; }, set activeLocation(value) { activeLocation = value; },
    get audio() { return audio; },
    get beginSpawn() { return beginSpawn; },
    get cameraFocusHeight() { return cameraFocusHeight; },
    get campGoblinPool() { return campGoblinPool; },
    get campOgrePool() { return campOgrePool; }, set campOgrePool(value) { campOgrePool = value; },
    get campaignState() { return campaignState; },
    get cardboardFalls() { return cardboardFalls; },
    get chestVisuals() { return chestVisuals; },
    get clearAllEarthShatter() { return clearAllEarthShatter; },
    get clearProjectiles() { return clearProjectiles; },
    get createEditorAsset() { return createEditorAsset; },
    get createFigure() { return createFigure; },
    get createLocationEnemies() { return createLocationEnemies; },
    get createLootVisual() { return createLootVisual; },
    get createStoryPickupVisual() { return createStoryPickupVisual; },
    get decorationSpecs() { return decorationSpecs; },
    get dialogue() { return dialogue; },
    get elapsed() { return elapsed; },
    get ensureInspectionMarker() { return ensureInspectionMarker; },
    get ensureLootSprites() { return ensureLootSprites; },
    get ensureRockEffectAssets() { return ensureRockEffectAssets; },
    get failedTransitionTo() { return failedTransitionTo; }, set failedTransitionTo(value) { failedTransitionTo = value; },
    get figures() { return figures; },
    get frameWorkStarted() { return frameWorkStarted; },
    get geometryClient() { return geometryClient; },
    get groundResources() { return groundResources; }, set groundResources(value) { groundResources = value; },
    get heroBody() { return heroBody; },
    get heroFigure() { return heroFigure; },
    get inputController() { return inputController; },
    get loading() { return loading; },
    get locationArrivalCheckpoint() { return locationArrivalCheckpoint; }, set locationArrivalCheckpoint(value) { locationArrivalCheckpoint = value; },
    get locationGroups() { return locationGroups; },
    get locationStreaming() { return locationStreaming; },
    get locationTransition() { return locationTransition; }, set locationTransition(value) { locationTransition = value; },
    get locations() { return locations; },
    get lootSpriteModels() { return lootSpriteModels; },
    get makeCacheBody() { return makeCacheBody; },
    get merchantActors() { return merchantActors; },
    get orbit() { return orbit; },
    get persistCampaign() { return persistCampaign; },
    get playerOcclusionDither() { return playerOcclusionDither; },
    get preloadCampEnemies() { return preloadCampEnemies; },
    get preloadCampOgre() { return preloadCampOgre; },
    get prepareScenePresentation() { return prepareScenePresentation; },
    get protectedEntryFrom() { return protectedEntryFrom; }, set protectedEntryFrom(value) { protectedEntryFrom = value; },
    get rebuildBodies() { return rebuildBodies; },
    get refreshLocationInfo() { return refreshLocationInfo; },
    get renderDayClock() { return renderDayClock; },
    get renderInventory() { return renderInventory; },
    get renderStatusEffectsHud() { return renderStatusEffectsHud; },
    get renderer() { return renderer; },
    get reportLoadStage() { return reportLoadStage; },
    get resetCampaignEncountersForNewDay() { return resetCampaignEncountersForNewDay; },
    get restoreSavedCampEnemies() { return restoreSavedCampEnemies; },
    get scaled() { return scaled; },
    get scene() { return scene; },
    get sceneRegistry() { return sceneRegistry; },
    get scenerySystem() { return scenerySystem; },
    get shop() { return shop; },
    get showActiveLocationFigures() { return showActiveLocationFigures; },
    get showStoryCard() { return showStoryCard; },
    get snapshotLocation() { return snapshotLocation; },
    get storyActors() { return storyActors; },
    get storyPickupVisuals() { return storyPickupVisuals; },
    get target() { return target; },
    get transitionCooldown() { return transitionCooldown; }, set transitionCooldown(value) { transitionCooldown = value; },
    get updateEnemySpawners() { return updateEnemySpawners; },
    get worldItemVisuals() { return worldItemVisuals; },
    get yieldLocationWork() { return yieldLocationWork; },
  });
  installUIFeedback(document);
  reportLoadStage('Настройки босса');
  const ogreConfig = await loadOgreSettings();
  reportLoadStage('Настройки босса', 'ready');
  await performanceProfiler.start({ build: SCENE_BUILD, origin: location.origin, hostname: location.hostname,
    userAgent: navigator.userAgent, viewport: [innerWidth, innerHeight], devicePixelRatio,
    hardwareConcurrency: navigator.hardwareConcurrency ?? null, deviceMemory: navigator.deviceMemory ?? null,
    isMobileRenderTarget: IS_MOBILE_RENDER_TARGET, targetFps: MAX_RENDER_FPS });
  const localEditor = await connectLocalEditor();
  const pixel7Preview = Boolean(localEditor) && new URLSearchParams(location.search).get('pixel7Preview') === '1';
  if (pixel7Preview) {
    try { Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2.625 }); }
    catch { /* The 412 × 915 CSS viewport still applies when DPR cannot be overridden. */ }
  }
  const persistEditorState = Boolean(localEditor) && isLocalEditorOrigin(location.hostname);
  let savedEditorDiff = null, sceneOverrides = RELEASE_SCENE_OVERRIDES;
  let sharedEditorDraft = null;
  if (localEditor) {
    try {
      sharedEditorDraft = await localEditor.readDraft();
      if (sharedEditorDraft.diff?.baseBuild === SCENE_BUILD) savedEditorDiff = sharedEditorDraft.diff;
      else if (sharedEditorDraft.diff === null) {
        savedEditorDiff = null;
        // The shared LAN draft is authoritative. Clear any older per-device
        // copy so it cannot reappear on this client after another device Applys.
        clearLocalEditorDraft(localStorage, persistEditorState);
      }
      else if (sharedEditorDraft.diff?.baseBuild !== SCENE_BUILD) {
        console.warn('Общий черновик редактора пропущен: версия исходной сцены изменилась');
        savedEditorDiff = null;
      }
    } catch (error) { savedEditorDiff = null; console.warn('Не удалось прочитать общий черновик редактора', error); }
  }
  if (savedEditorDiff) {
    if (savedEditorDiff.baseBuild !== SCENE_BUILD) {
      console.warn('Черновик редактора пропущен: версия исходной сцены изменилась');
      savedEditorDiff = null;
    } else {
      try { sceneOverrides = localEditor.mergeSceneDiff(RELEASE_SCENE_OVERRIDES, savedEditorDiff); }
      catch (error) { console.warn('Черновик редактора не удалось восстановить', error); savedEditorDiff = null; }
    }
  }
  let heroEquipment = null;
  let shop = null;
  const merchantActors = [];
  let equipmentPosePreview = null;
  reportLoadStage('Создание WebGL-рендера');
  // Desktop hybrid-GPU browsers otherwise choose the integrated adapter for WebGL.
  const renderer = new THREE.WebGLRenderer({ antialias: true, stencil: true,
    powerPreference: IS_MOBILE_RENDER_TARGET ? 'default' : 'high-performance' });
  performanceProfiler.attachRenderer(renderer);
  reportLoadStage('Создание WebGL-рендера', 'ready');
  renderer.setPixelRatio(Math.min(devicePixelRatio, RENDER_QUALITY.pixelRatioCap));
  renderer.setClearColor(LOCATION_FAR_COLOR);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const cardboardDamageTexture = new THREE.TextureLoader().load('assets/cardboard-torn-corrugation.webp?v=2');
  cardboardDamageTexture.wrapS = cardboardDamageTexture.wrapT = THREE.RepeatWrapping;
  cardboardDamageTexture.colorSpace = THREE.SRGBColorSpace;
  const cardboardPerlinTexture = new THREE.TextureLoader().load('assets/cardboard-perlin-256.png?v=1');
  cardboardPerlinTexture.wrapS = cardboardPerlinTexture.wrapT = THREE.RepeatWrapping;
  cardboardPerlinTexture.colorSpace = THREE.NoColorSpace;
  const cardboardVoronoiTexture = new THREE.TextureLoader().load('assets/player-reveal-voronoi-256.png?v=1');
  cardboardVoronoiTexture.wrapS = cardboardVoronoiTexture.wrapT = THREE.RepeatWrapping;
  cardboardVoronoiTexture.colorSpace = THREE.NoColorSpace;
  let rockEffectAssets = null, rockEffectAssetsPromise = null;
  async function ensureRockEffectAssets() {
    if (rockEffectAssets) return rockEffectAssets;
    if (!rockEffectAssetsPromise) {
      reportLoadStage('Эффект земляной атаки');
      rockEffectAssetsPromise = loadRockEffectAssets(THREE).then(assets => {
        rockEffectAssets = assets;
        return assets;
      });
    }
    try {
      rockEffectAssets = await rockEffectAssetsPromise;
      reportLoadStage('Эффект земляной атаки', 'ready');
      return rockEffectAssets;
    } catch (error) {
      rockEffectAssetsPromise = null;
      reportLoadStage('Эффект земляной атаки', 'error', error.message);
      throw error;
    }
  }
  let cardboardTearNoiseTexture = null;
  host.append(renderer.domElement);
  let tiltShiftComposer = null, tiltShiftInputPass = null, tiltShiftPass = null,
    tiltShiftCompositePass = null,
    sharpSceneTarget = null,
    tiltShiftPixelRatio = 1, postProcessingPromise = null;
  let screenEffects = DEFAULT_SCREEN_EFFECTS;
  try { screenEffects = normalizeScreenEffects(persistEditorState
    ? sceneOverrides.screenEffects ?? null : JSON.parse(localStorage.getItem(SCREEN_EFFECT_SETTINGS_KEY) || 'null')); }
  catch { screenEffects = normalizeScreenEffects(null); }
  let itemMagnetSettings = ITEM_MAGNET_DEFAULTS;
  try { itemMagnetSettings = normalizeItemMagnetSettings(persistEditorState
    ? sceneOverrides.itemMagnet ?? null : JSON.parse(localStorage.getItem(ITEM_MAGNET_STORAGE_KEY) || 'null')); }
  catch { itemMagnetSettings = normalizeItemMagnetSettings(null); }
  const setItemMagnetSettings = settings => {
    itemMagnetSettings = normalizeItemMagnetSettings(settings);
    try { localStorage.setItem(ITEM_MAGNET_STORAGE_KEY, JSON.stringify(itemMagnetSettings)); } catch { /* Current settings still apply for this session. */ }
  };
  const renderScene = () => {
    performanceProfiler.beginPhase('renderPreparation');
    try {
      heroEquipment?.update(elapsed);
      for (const rock of earthShatterRocks) rock.visual.faceCamera(camera);
      updateEnemyOcclusionSilhouettes();
      if (!sceneEditor.active) for (const actor of merchantActors) if (actor.locationId === activeLocation.id && actor.prop.visible)
        actor.prop.rotation.y = Math.atan2(heroBody.x - actor.body.x, heroBody.z - actor.body.z);
    } finally { performanceProfiler.endPhase('renderPreparation'); }
    performanceProfiler.beginPhase('renderSubmissionCpu');
    const gpuQuery = performanceProfiler.beginGpu();
    try {
      if (!tiltShiftComposer || (!screenEffects.tiltShift && !screenEffects.tiltShiftShowGradient)) {
        renderer.render(scene, camera);
        renderSharpHudOverlay(renderer, scene, camera);
        return;
      }
      try {
        const previousTarget = renderer.getRenderTarget();
        renderer.setRenderTarget(sharpSceneTarget);
        renderer.clear(true, true, true);
        renderer.render(scene, camera);
        renderer.setRenderTarget(previousTarget);
        tiltShiftInputPass.uniforms.sharpTexture.value = sharpSceneTarget.texture;
        tiltShiftCompositePass.uniforms.sharpTexture.value = sharpSceneTarget.texture;
        tiltShiftComposer.render();
        renderSharpHudOverlay(renderer, scene, camera);
      }
      catch (error) {
        renderer.setRenderTarget(null);
        tiltShiftComposer.dispose(); tiltShiftComposer = null;
        tiltShiftInputPass = null; tiltShiftCompositePass = null;
        sharpSceneTarget?.dispose(); sharpSceneTarget = null;
        console.warn('Постобработка остановлена; используется обычный рендер', error);
        renderer.render(scene, camera);
        renderSharpHudOverlay(renderer, scene, camera);
      }
    } finally {
      performanceProfiler.endGpu(gpuQuery);
      performanceProfiler.endPhase('renderSubmissionCpu');
    }
  };
  async function enableTiltShift() {
    if ((!screenEffects.tiltShift && !screenEffects.tiltShiftShowGradient) || tiltShiftComposer) return;
    if (postProcessingPromise) return postProcessingPromise;
    postProcessingPromise = (async () => { try {
      const [composerModule, shaderPassModule] = await Promise.all([
        import("./vendor/three/examples/jsm/postprocessing/EffectComposer.js?v=f484ba7b7b13e7f6"),
        import("./vendor/three/examples/jsm/postprocessing/ShaderPass.js?v=f484ba7b7b13e7f6"),
      ]);
      const target = new THREE.WebGLRenderTarget(1, 1, { format: THREE.RGBAFormat,
        type: THREE.HalfFloatType, depthBuffer: true, stencilBuffer: false });
      const composer = new composerModule.EffectComposer(renderer, target);
      tiltShiftPixelRatio = tiltShiftRenderPixelRatio(renderer.getPixelRatio(), IS_MOBILE_RENDER_TARGET);
      composer.setPixelRatio(tiltShiftPixelRatio);
      const drawingBufferSize = renderer.getDrawingBufferSize(new THREE.Vector2());
      sharpSceneTarget = new THREE.WebGLRenderTarget(Math.max(1, drawingBufferSize.x), Math.max(1, drawingBufferSize.y), {
        format: THREE.RGBAFormat, type: THREE.HalfFloatType, depthBuffer: true, stencilBuffer: true,
        minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      });
      const input = new shaderPassModule.ShaderPass(createPostEffectInputShader());
      input.uniforms.sharpTexture.value = sharpSceneTarget.texture;
      composer.addPass(input);
      const tilt = new shaderPassModule.ShaderPass(createHexTiltShiftShader(THREE));
      tilt.uniforms.focus.value = screenEffects.tiltShiftFocus;
      tilt.uniforms.blurPixels.value = screenEffects.tiltShiftBlur;
      tilt.uniforms.upperGradientShift.value = screenEffects.tiltShiftUpperGradientShift;
      tilt.uniforms.lowerGradientShift.value = screenEffects.tiltShiftLowerGradientShift;
      tilt.uniforms.gradientMultiplier.value = screenEffects.tiltShiftGradientMultiplier;
      tilt.uniforms.showGradient.value = screenEffects.tiltShiftShowGradient;
      tilt.uniforms.pixelRatio.value = tiltShiftPixelRatio;
      tilt.uniforms.resolution.value.set(innerWidth * tiltShiftPixelRatio, innerHeight * tiltShiftPixelRatio);
      tilt.enabled = screenEffects.tiltShift || screenEffects.tiltShiftShowGradient;
      composer.addPass(tilt);
      const composite = new shaderPassModule.ShaderPass(createTiltShiftCompositeShader());
      composite.uniforms.sharpTexture.value = sharpSceneTarget.texture;
      composite.uniforms.focus.value = screenEffects.tiltShiftFocus;
      composite.uniforms.upperGradientShift.value = screenEffects.tiltShiftUpperGradientShift;
      composite.uniforms.lowerGradientShift.value = screenEffects.tiltShiftLowerGradientShift;
      composite.uniforms.gradientMultiplier.value = screenEffects.tiltShiftGradientMultiplier;
      composite.uniforms.tiltShiftActive.value = screenEffects.tiltShift;
      composite.uniforms.showGradient.value = screenEffects.tiltShiftShowGradient;
      composite.renderToScreen = true;
      composer.addPass(composite);
      composer.setSize(innerWidth, innerHeight);
      tiltShiftComposer = composer; tiltShiftInputPass = input; tiltShiftPass = tilt; tiltShiftCompositePass = composite;
      tiltShiftPass.enabled = screenEffects.tiltShift || screenEffects.tiltShiftShowGradient;
    } catch (error) {
      console.warn('Постобработка недоступна; используется обычный рендер', error);
    } finally { postProcessingPromise = null; } })();
    return postProcessingPromise;
  }
  function setScreenEffects(value) {
    screenEffects = normalizeScreenEffects(value);
    try { localStorage.setItem(SCREEN_EFFECT_SETTINGS_KEY, JSON.stringify(screenEffects)); }
    catch { /* The current session still honors the selected effects. */ }
    if (tiltShiftPass) tiltShiftPass.enabled = screenEffects.tiltShift || screenEffects.tiltShiftShowGradient;
    if (tiltShiftPass) {
      tiltShiftPass.uniforms.focus.value = screenEffects.tiltShiftFocus;
      tiltShiftPass.uniforms.blurPixels.value = screenEffects.tiltShiftBlur;
      tiltShiftPass.uniforms.upperGradientShift.value = screenEffects.tiltShiftUpperGradientShift;
      tiltShiftPass.uniforms.lowerGradientShift.value = screenEffects.tiltShiftLowerGradientShift;
      tiltShiftPass.uniforms.gradientMultiplier.value = screenEffects.tiltShiftGradientMultiplier;
      tiltShiftPass.uniforms.showGradient.value = screenEffects.tiltShiftShowGradient;
    }
    if (tiltShiftCompositePass) {
      tiltShiftCompositePass.uniforms.focus.value = screenEffects.tiltShiftFocus;
      tiltShiftCompositePass.uniforms.upperGradientShift.value = screenEffects.tiltShiftUpperGradientShift;
      tiltShiftCompositePass.uniforms.lowerGradientShift.value = screenEffects.tiltShiftLowerGradientShift;
      tiltShiftCompositePass.uniforms.gradientMultiplier.value = screenEffects.tiltShiftGradientMultiplier;
      tiltShiftCompositePass.uniforms.tiltShiftActive.value = screenEffects.tiltShift;
      tiltShiftCompositePass.uniforms.showGradient.value = screenEffects.tiltShiftShowGradient;
    }
    if (screenEffects.tiltShift || screenEffects.tiltShiftShowGradient) void enableTiltShift();
  }

  const scene = new THREE.Scene();
  let sunLight = null;
  scene.background = new THREE.Color(LOCATION_FAR_COLOR);
  let savedCampaign = null;
  reportLoadStage('Сохранение кампании и текущая локация');
  savedCampaign = campaignSaves.load();
  savedCampaign = restoreCampaignCheckpointAfterDeath(savedCampaign) ?? savedCampaign;
  const campaignState = createCampaignState(savedCampaign);
  // One introductory set also migrates existing saves, without replacing any owned items.
  grantEquipmentStarter(campaignState);
  campaignState.currentLocationId = campaignLocation(campaignState.currentLocationId)?.id ?? 'home';
  const dayClock = document.querySelector('#day-clock');
  function renderDayClock() {
    if (!dayClock) return;
    const state = DAY_NIGHT_STATES[campaignState.timeState] ?? DAY_NIGHT_STATES[0];
    dayClock.dataset.state = String(campaignState.timeState);
    dayClock.style.setProperty('--clock-angle', `${campaignState.timeState * 60}deg`);
    dayClock.dataset.period = state.period;
    dayClock.setAttribute('aria-label', `День ${campaignState.dayNumber}, ${state.label}`);
    dayClock.title = `День ${campaignState.dayNumber} · ${state.label}`;
    const dayLabel = dayClock.querySelector('.day-clock-label'), previousDay = dayLabel.textContent;
    dayLabel.textContent = `${campaignState.dayNumber}`;
    if (previousDay && previousDay !== dayLabel.textContent) indicateUIChange(dayLabel, 'day');
  }
  renderDayClock();
  const locations = createCampaignLocations(createLocationNetwork(), LOCATION_SCALE, [campaignState.currentLocationId]);
  reportLoadStage('Сохранение кампании и текущая локация', 'ready', campaignState.currentLocationId);
  let activeCampaignGraph = sceneOverrides.graph ?? null;
  reportLoadStage(`Карта глубины: ${campaignState.currentLocationId}`);
  await loadLocationDepthMaps({ [campaignState.currentLocationId]: locations[campaignState.currentLocationId] });
  // Rebuild authored footprints now that raster-derived features (notably the
  // black river mask) are available to gameplay collision and floor cutting.
  if (locations[campaignState.currentLocationId].art.depthMap)
    createCampaignLocations(locations, LOCATION_SCALE, [campaignState.currentLocationId]);
  reportLoadStage(`Карта глубины: ${campaignState.currentLocationId}`, 'ready');
  const authoredEntry = sceneOverrides.locations[campaignState.currentLocationId]?.entry;
  if (authoredEntry) Object.assign(locations[campaignState.currentLocationId].entry,
    { x: authoredEntry.position[0], z: authoredEntry.position[2] });
  if (activeCampaignGraph) for (const location of Object.values(locations)) applyCampaignGraphToLocation(location, activeCampaignGraph);
  let playerOcclusionDither = null, applyUnitPuckColors = () => {}, activeFogLocationId = campaignState.currentLocationId;
  let cardboardDamageSettings = { ...CARDBOARD_DAMAGE_DEFAULTS }, applyFigureDamageSettings = () => {};
  const sceneRegistry = createSceneRegistry({ createModel: localEditor?.createEditModel, THREE, overrides: { ...sceneOverrides, bossSettings: ogreConfig }, setOgreSettings, savedDiff: savedEditorDiff,
    locationIds: Object.keys(locations),
    getActiveLocationId: () => activeFogLocationId, setScreenEffects, setItemMagnetSettings,
    setCardboardDamage(settings) {
      cardboardDamageSettings = settings;
      applyFigureDamageSettings(settings, cardboardDamageTexture, cardboardVoronoiTexture, cardboardTearNoiseTexture, cardboardPerlinTexture);
      if (scene) updateCardboardDamageTree(scene, { settings, texture: cardboardDamageTexture, noiseTexture: cardboardVoronoiTexture,
        displacementNoiseTexture: cardboardPerlinTexture, tearNoiseTexture: cardboardTearNoiseTexture });
    },
    setGroundGrid(settings) {
      for (const location of Object.values(locations)) location.groundGridMesh?.userData.updateGroundGrid(settings);
    },
    setGroundGridColor(locationId, color) {
      locations[locationId]?.groundGridMesh?.userData.setGroundGridColor(color);
    },
    setUnitPuckColors(settings) {
    applyUnitPuckColors(settings);
  }, setLighting(settings) {
    if (!sunLight) return;
    sunLight.position.set(...settings.direction);
    sunLight.intensity = settings.intensity;
    sunLight.color.set(settings.color);
  }, setTerrainStyle(settings) {
    for (const location of Object.values(locations)) if (location.sceneGroup)
      applyTerrainEdgeStyle(location.sceneGroup, THREE, settings);
  }, setFog(locationId, settings) {
    const location = locations[locationId];
    location?.edgeShade?.update(settings);
    location?.exitVisuals?.shadowMaterial.color.set(settings.color);
    if (locationId !== activeFogLocationId) return;
    scene.background.set(settings.color); renderer.setClearColor(settings.color);
    playerOcclusionDither?.updateSettings(settings);
  } });
  reportLoadStage('Реестр сцены и релизные настройки');
  sceneRegistry.sync();
  sceneRegistry.setTimeOfDay(DAY_NIGHT_STATES[campaignState.timeState].period);
  sceneRegistry.activateLocation(activeFogLocationId);
  reportLoadStage('Реестр сцены и релизные настройки', 'ready');
  for (const [id, stored] of Object.entries(campaignState.world ?? {})) if (locations[id] && stored) {
    const location = locations[id];
    location.defeats = stored.defeats ?? location.defeats;
    location.goblinsSpawned = stored.goblinsSpawned ?? location.goblinsSpawned;
    location.reinforcementQueue = Array.isArray(stored.reinforcementQueue) ? [...stored.reinforcementQueue] : location.reinforcementQueue;
    location.bossSpawned = stored.bossSpawned ?? location.bossSpawned;
    location.initialized = stored.initialized ?? location.initialized;
    location.combatTriggered = stored.combatTriggered ?? location.combatTriggered;
    location.lastExitPositions = stored.lastExitPositions ?? location.lastExitPositions;
    location.loot = normalizeWorldLoot(stored.loot);
    location.openedPlacedChests = Array.isArray(stored.openedPlacedChests) ? [...stored.openedPlacedChests] : [];
    location.collectedPlacedItems = Array.isArray(stored.collectedPlacedItems) ? [...stored.collectedPlacedItems] : [];
  }
  heroBody.maxHealth = 20 + campaignState.maxHealthBonus;
  const playerStart = resolveCampaignPlayerStart(locations[campaignState.currentLocationId], {
    health: savedCampaign?.playerHealth, maxHealth: heroBody.maxHealth, position: savedCampaign?.playerPosition,
  });
  reportLoadStage('Точка появления игрока', 'ready', `${playerStart.position.x}, ${playerStart.position.z}`);
  heroBody.health = playerStart.health;
  heroBody.x = playerStart.position.x; heroBody.z = playerStart.position.z;
  const savedLastSafePosition = resolveCampaignPlayerStart(locations[campaignState.currentLocationId], {
    health: heroBody.health, maxHealth: heroBody.maxHealth, position: savedCampaign?.lastSafePosition,
  }).position;
  heroBody.lastSafePosition = savedCampaign?.lastSafePosition && isCampaignPositionSafe(
    locations[campaignState.currentLocationId], savedCampaign.lastSafePosition)
    ? savedLastSafePosition : { ...playerStart.position };
  if (heroBody.health > 0 && !campaignState.entryCheckpoint) {
    campaignState.playerHealth = heroBody.health;
    campaignState.playerPosition = { x: heroBody.x, z: heroBody.z };
    campaignState.lastSafePosition = { ...heroBody.lastSafePosition };
    campaignState.entryCheckpoint = createLocationStartCheckpoint(campaignState, campaignState.currentLocationId);
  }
  for (const location of Object.values(locations)) location.obstacles = [];
  for (const location of Object.values(locations)) location.loot ??= [];
  let activeLocation = locations[campaignState.currentLocationId];
  const inspectionTrigger = createInspectionTrigger();
  const locationTitle = document.querySelector('#location-title');
  const locationInfoButton = document.querySelector('#location-info');
  const statusEffectsHud = document.querySelector('#status-effects-hud');
  const statusEffectTooltip = document.querySelector('#status-effect-tooltip');
  let selectedStatusEffectId = null, statusTooltipPositioning = false;
  function hideStatusEffectTooltip() {
    selectedStatusEffectId = null;
    if (statusEffectTooltip) void hideUIWindow(statusEffectTooltip);
    for (const badge of statusEffectsHud?.querySelectorAll('.status-effect-badge') ?? []) badge.setAttribute('aria-expanded', 'false');
  }
  function positionStatusEffectTooltip() {
    if (!selectedStatusEffectId || !statusEffectTooltip || statusEffectTooltip.hidden) return;
    const anchor = [...(statusEffectsHud?.querySelectorAll('.status-effect-badge') ?? [])]
      .find(badge => badge.dataset.effectId === selectedStatusEffectId);
    if (!anchor) { hideStatusEffectTooltip(); return; }
    const rect = anchor.getBoundingClientRect(), box = statusEffectTooltip.getBoundingClientRect();
    const viewport = window.visualViewport, insetX = viewport?.offsetLeft ?? 0, insetY = viewport?.offsetTop ?? 0;
    const width = viewport?.width ?? innerWidth, height = viewport?.height ?? innerHeight;
    const left = Math.max(insetX + 10, Math.min(insetX + width - box.width - 10, rect.x + rect.width / 2 - box.width / 2));
    const above = rect.top - box.height - 13, below = above < insetY + 10;
    const top = below ? Math.min(insetY + height - box.height - 10, rect.bottom + 13) : above;
    statusEffectTooltip.style.left = `${left}px`; statusEffectTooltip.style.top = `${Math.max(insetY + 10, top)}px`;
    statusEffectTooltip.style.setProperty('--tooltip-tip', `${Math.max(22, Math.min(box.width - 22, rect.x + rect.width / 2 - left))}px`);
    statusEffectTooltip.classList.toggle('is-below', below);
  }
  function scheduleStatusTooltipPosition() {
    if (statusTooltipPositioning || !selectedStatusEffectId) return;
    statusTooltipPositioning = true;
    requestAnimationFrame(() => { statusTooltipPositioning = false; positionStatusEffectTooltip(); });
  }
  function showStatusEffectTooltip(effect, badge) {
    if (!statusEffectTooltip) return;
    selectedStatusEffectId = effect.id;
    for (const item of statusEffectsHud.querySelectorAll('.status-effect-badge')) item.setAttribute('aria-expanded', String(item === badge));
    statusEffectTooltip.querySelector('#status-effect-name').textContent = effect.label;
    statusEffectTooltip.querySelector('#status-effect-description').textContent = effect.description;
    statusEffectTooltip.querySelector('#status-effect-duration').textContent = effect.remaining;
    statusEffectTooltip.dataset.uiAnchor ??= 'center'; statusEffectTooltip.dataset.uiMotionSurface = '';
    if (statusEffectTooltip.hidden || statusEffectTooltip.dataset.uiMotionState === 'closing') void showUIWindow(statusEffectTooltip);
    else indicateUIChange(statusEffectTooltip.querySelector('#status-effect-duration'), 'duration');
    positionStatusEffectTooltip();
  }
  function renderStatusEffectsHud() {
    if (!statusEffectsHud) return;
    const previousBadges = new Map([...statusEffectsHud.querySelectorAll('.status-effect-badge')]
      .map(badge => [badge.dataset.effectId, badge.textContent]));
    const hadBadges = previousBadges.size > 0;
    const effects = statusEffectLabels(campaignState.statusEffects);
    statusEffectsHud.replaceChildren(...effects.map(effect => {
      const badge = document.createElement('button'); badge.type = 'button'; badge.className = 'status-effect-badge';
      badge.dataset.kind = effect.kind; badge.dataset.effectId = effect.id; badge.textContent = `${effect.label}${effect.duration}`;
      if (hadBadges && previousBadges.get(effect.id) !== badge.textContent) indicateUIChange(badge, 'status');
      badge.setAttribute('aria-haspopup', 'dialog'); badge.setAttribute('aria-expanded', String(selectedStatusEffectId === effect.id));
      badge.setAttribute('aria-label', `${effect.label}${effect.duration}. Показать, что делает эффект`);
      badge.addEventListener('click', () => selectedStatusEffectId === effect.id && !statusEffectTooltip.hidden
        ? hideStatusEffectTooltip() : showStatusEffectTooltip(effect, badge));
      return badge;
    }));
    if (selectedStatusEffectId) {
      const current = effects.find(effect => effect.id === selectedStatusEffectId);
      if (current) showStatusEffectTooltip(current, [...statusEffectsHud.querySelectorAll('.status-effect-badge')]
        .find(badge => badge.dataset.effectId === current.id));
      else hideStatusEffectTooltip();
    }
  }
  document.querySelector('#status-effect-tooltip-close')?.addEventListener('click', hideStatusEffectTooltip);
  document.addEventListener('pointerdown', event => {
    if (selectedStatusEffectId && !statusEffectTooltip?.contains(event.target) && !event.target.closest?.('.status-effect-badge')) hideStatusEffectTooltip();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && selectedStatusEffectId) { event.preventDefault(); hideStatusEffectTooltip(); }
  });
  window.addEventListener('resize', scheduleStatusTooltipPosition, { passive: true });
  window.visualViewport?.addEventListener('resize', scheduleStatusTooltipPosition, { passive: true });
  let statusHudRefresh = 0;
  const dialoguePanel = document.querySelector('#story-dialogue');
  const inventoryPanel = document.querySelector('#inventory-panel');
  const mapPanel = document.querySelector('#world-map');
  const deathScreen = document.querySelector('#death-screen');
  const deathCheckpointButton = document.querySelector('#death-checkpoint');
  const deathReviveButton = document.querySelector('#death-revive');
  const deathCheckpointNote = document.querySelector('#death-checkpoint-note');
  const deathAdOverlay = document.querySelector('#death-ad-overlay');
  const deathAdCountdown = document.querySelector('#death-ad-countdown');
  const deathAdCancel = document.querySelector('#death-ad-cancel');
  const locationMap = createLocationMapView({ root: mapPanel,
    viewport: document.querySelector('#world-map-viewport'), graph: document.querySelector('#world-map-graph'),
    progress: document.querySelector('#world-map-progress'), openButton: locationInfoButton,
    closeButton: document.querySelector('#world-map-close'), campaign: CAMPAIGN, edges: CAMPAIGN_EDGES });
  let campaignGraphData = null, campaignGraphDataKey = null;
  function applyEditedAnchorsToGraphLayouts(layouts) {
    const editsByLocation = Object.fromEntries(Object.entries(sceneOverrides.locations ?? {}).map(([id, edits]) => [id, { ...edits }]));
    for (const change of sceneRegistry.model.diff().changes) if (change.location && change.after !== null) {
      editsByLocation[change.location] ??= {};
      editsByLocation[change.location][change.object] = change.after;
    }
    for (const [id, edits] of Object.entries(editsByLocation)) {
      const location = layouts[id]; if (!location?.layoutReady) continue;
      const applyPoint = (value, previous = {}) => ({ ...previous, x: value.position[0], z: value.position[2], rotationY: value.rotation[1] });
      if (edits.entry) location.entry = applyPoint(edits.entry, location.entry);
      for (const [key, value] of Object.entries(edits)) {
        const arrival = key.match(/^arrival:([a-z0-9-]+)$/);
        if (arrival) location.arrivals[arrival[1]] = applyPoint(value, location.arrivals[arrival[1]]);
        if (key === 'fog-paths') location.fogPaths = value;
        const exit = key.match(/^exit:([a-z0-9-]+):trigger$/);
        if (exit) {
          const gate = location.exits.find(item => item.to === exit[1]);
          if (gate) { gate.x = value.position[0]; gate.z = value.position[2];
            gate.halfWidth = value.scale[0] / 2; gate.halfDepth = value.scale[2] / 2;
            gate.dirX = Math.sin(value.rotation[1]); gate.dirZ = Math.cos(value.rotation[1]); }
        }
      }
    }
  }
  function ensureCampaignGraphData(state = campaignState, { includeVisuals = true } = {}) {
    const graphEdits = sceneRegistry.model.diff().changes.filter(change => change.object === 'fog-paths'
      || change.object === 'entry' || /^arrival:/.test(change.object) || /^exit:.*:trigger$/.test(change.object));
    const allFogSettings = Object.fromEntries(Object.keys(locations).map(id => [id, sceneRegistry.fogFor(id)]));
    const sourceKey = JSON.stringify({ fog: allFogSettings, location: activeLocation?.id,
      edges: activeCampaignGraph?.edges, graphEdits });
    if (campaignGraphData && sourceKey === campaignGraphDataKey) {
      campaignGraphData.graph = activeCampaignGraph ?? campaignGraphData.graph;
      if (includeVisuals && !campaignGraphData.visuals) {
        const layouts = createCampaignLocations(createLocationNetwork(), LOCATION_SCALE);
        applyEditedAnchorsToGraphLayouts(layouts);
        if (activeLocation?.layoutReady) layouts[activeLocation.id] = activeLocation;
        campaignGraphData.visuals = createCampaignNodeVisuals(layouts, campaignGraphData.graph, allFogSettings);
      }
      campaignGraphData.currentLocationId = state?.currentLocationId ?? campaignState.currentLocationId;
      campaignGraphData.visited = [...(state?.visited ?? campaignState.visited ?? [])];
      locationMap.setCampaignGraph(campaignGraphData.graph);
      return campaignGraphData;
    }
    const layouts = createCampaignLocations(createLocationNetwork(), LOCATION_SCALE);
    applyEditedAnchorsToGraphLayouts(layouts);
    if (activeLocation?.layoutReady) layouts[activeLocation.id] = activeLocation;
    const mapLayout = buildLocationMapGraph(CAMPAIGN, CAMPAIGN_EDGES);
    const graph = createCampaignGraph(layouts, mapLayout, activeCampaignGraph);
    const visuals = includeVisuals ? createCampaignNodeVisuals(layouts, graph, allFogSettings) : null;
    campaignGraphData = { graph, visuals, labels: Object.fromEntries(CAMPAIGN.map(item => [item.id, item.title])) };
    campaignGraphDataKey = sourceKey;
    if (!activeCampaignGraph) activeCampaignGraph = graph;
    campaignGraphData.currentLocationId = state?.currentLocationId ?? campaignState.currentLocationId;
    campaignGraphData.visited = [...(state?.visited ?? campaignState.visited ?? [])];
    locationMap.setCampaignGraph(activeCampaignGraph);
    return campaignGraphData;
  }
  function applyCampaignGraph(graph) {
    const topologyChanged = JSON.stringify(activeCampaignGraph?.edges ?? null) !== JSON.stringify(graph.edges);
    activeCampaignGraph = graph;
    if (topologyChanged) {
      for (const location of Object.values(locations)) {
        applyCampaignGraphToLocation(location, graph);
        sceneRegistry.graphChanged?.(location);
      }
    }
    if (campaignGraphData) locationMap.setCampaignGraph(graph);
  }
  let inputController = null;
  let sceneEditor = { active: false, graphOpen: false, refreshBindings() {}, update() {} };
  const audioControls = createAudioControls({ audio, root: document.querySelector('#audio-panel'),
    trigger: document.querySelector('#audio-toggle'), onOpen() { inputController?.cancel(); shop?.hide(); } });
  const dialogue = createDialoguePanel({ root: dialoguePanel,
    onOpen() { inputController?.cancel(); inventory.hide(); },
    onClose() {
      if (activeLocation.id === 'bell-vault' && (campaignState.flags.choseGoodbye || campaignState.flags.triedToReplaceGrandpa)) {
        campaignState.flags.grandpaDead = true;
        storyActors.update(); rebuildBodies(); persistCampaign();
      }
    },
    onChoose(option) {
      const result = chooseCampaignOption(campaignState, activeLocation.id, option.id);
      if (!result) return null;
      persistCampaign(); renderInventory(); refreshLocationInfo();
      const lines = getStoryDialogue(campaignState, activeLocation.id, 'choice', option.id);
      return { ...result, lines };
    },
  });
  const inventory = createInventoryPanel({ root: inventoryPanel, trigger: document.querySelector('#inventory-toggle'),
    getState: () => campaignState, getHealth: () => ({ health: heroBody.health, maxHealth: heroBody.maxHealth,
      restoredHearts: [...playerRestoredHearts].map(([index, pulse]) => ({ index, ...pulse })) }),
    onOpen() { inputController?.cancel(); },
    onEquip(id, slotIndex) {
      const result = equipInventoryItem(campaignState, id, slotIndex);
      if (result.changed) { heroEquipment?.update(elapsed); persistCampaign(); audio.play('pickup'); }
      return result;
    },
    onUnequip(slot, index) {
      const result = unequipItem(campaignState, slot, index);
      if (result.changed) { heroEquipment?.update(elapsed); persistCampaign(); }
      return result;
    },
    onDrop(id, slotIndex, screenPoint) { return dropInventoryItem(id, slotIndex, screenPoint); },
    onUse(id, slotIndex) {
      const result = consumeInventoryItem(campaignState, id, heroBody.health, heroBody.maxHealth);
      if (result.consumed) {
        audio.play(id === 'bandage' ? 'bandage' : 'eat');
        const previousHealth = heroBody.health;
        heroBody.health = result.health;
        noteHealthRestoration(heroFigure, previousHealth, heroBody.health);
        syncFigureDamageStage(heroFigure);
        result.effectLabel = applyConsumableEffect(campaignState, id);
        campaignState.inventorySlots[slotIndex] = null;
        renderStatusEffectsHud();
        persistCampaign();
      }
      return result;
    },
  });
  function merchantContext(actor) {
    return { merchantId: actor?.merchantId, locationId: actor?.locationId, health: heroBody.health,
      enabled: merchantActors.includes(actor) && Boolean(actor?.prop.visible && actor.body.active !== false),
      x: heroBody.x, z: heroBody.z, merchantX: actor?.body.x, merchantZ: actor?.body.z,
      inCombat: locationHasLivingEnemies(activeLocation) };
  }
  shop = createShopPanel({ getState: () => campaignState,
    onOpen() { inputController?.cancel(); inventory.hide(); },
    onTrade(actor, proposal) { return executeMerchantTrade(campaignState, actor.merchantId, proposal, merchantContext(actor)); },
    onCommit() { audio.play('pickup'); renderInventory(); persistCampaign(); } });
  const locationGroups = {};
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 280);
  playerOcclusionDither = createPlayerOcclusionDither(THREE, renderer);
  cardboardTearNoiseTexture = playerOcclusionDither.getNoiseTexture('gaussian');
  playerOcclusionDither.updateSettings(sceneRegistry.fog);
  const cameraFocusHeight = 2.75;
  const target = new THREE.Vector3(0, cameraFocusHeight, 0);
  const orbit = { theta: .22, phi: .86, distance: innerWidth < 650 ? 27 : 15.75 };
  let cameraManualOverride = 0;
  const hemisphereLight = new THREE.HemisphereLight(0xfff8ea, 0x8f826a, 2.5);
  scene.add(hemisphereLight);
  sunLight = new THREE.DirectionalLight();
  sunLight.position.set(...sceneRegistry.lighting.direction);
  sunLight.intensity = sceneRegistry.lighting.intensity;
  sunLight.color.set(sceneRegistry.lighting.color);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(RENDER_QUALITY.shadowMapSize, RENDER_QUALITY.shadowMapSize);
  Object.assign(sunLight.shadow.camera, { left: -25.5, right: 25.5, top: 25.5, bottom: -25.5, far: 60 });
  sunLight.shadow.normalBias = .025;
  sunLight.shadow.bias = -.0002;
  scene.add(sunLight);

  function texture(width, height, draw) {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    draw(canvas.getContext('2d'), width, height);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    return map;
  }
  const paper = texture(256, 256, (c, w, h) => {
    c.fillStyle = '#e4d0a8'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 4000; i++) {
      c.fillStyle = i % 2 ? '#98734112' : '#fff7db24';
      c.fillRect(Math.random() * w, Math.random() * h, 1, 1);
    }
  });
  const cardboardGrain = createCardboardGrainTexture({ THREE, texture });
  const corrugation = texture(1024, 128, (c, w, h) => {
    c.fillStyle = '#a77b46'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32) {
      c.fillStyle = '#e0bf85'; c.fillRect(0, y, w, 5);
      c.strokeStyle = '#67482b'; c.lineWidth = 3; c.beginPath();
      for (let x = 0; x <= w; x += 2) {
        const yy = y + 18 + 9 * Math.sin(x * .18);
        x ? c.lineTo(x, yy) : c.moveTo(x, yy);
      }
      c.stroke();
    }
  });
  reportLoadStage('Текстура: атлас сердец');
  const heartAtlasImage = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Не удалось загрузить атлас сердечек.'));
    image.src = new URL('./assets/health-hearts-atlas.png?v=52', import.meta.url).href;
  });
  const heartAtlasCanvas = document.createElement('canvas');
  heartAtlasCanvas.width = heartAtlasImage.naturalWidth;
  heartAtlasCanvas.height = heartAtlasImage.naturalHeight;
  const heartAtlasContext = heartAtlasCanvas.getContext('2d', { willReadFrequently: true });
  heartAtlasContext.drawImage(heartAtlasImage, 0, 0);
  const heartAtlasPixels = heartAtlasContext.getImageData(0, 0, heartAtlasCanvas.width, heartAtlasCanvas.height).data;
  const heartCellWidth = heartAtlasCanvas.width / 5;
  const heartTextures = Array.from({ length: 5 }, (_, index) => {
    const cellStart = Math.floor(index * heartCellWidth);
    const cellEnd = Math.ceil((index + 1) * heartCellWidth);
    let minX = cellEnd, minY = heartAtlasCanvas.height, maxX = cellStart - 1, maxY = -1;
    for (let y = 0; y < heartAtlasCanvas.height; y++) for (let x = cellStart; x < cellEnd; x++) {
      if (heartAtlasPixels[(y * heartAtlasCanvas.width + x) * 4 + 3] < 24) continue;
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
    if (maxX < minX || maxY < minY) throw new Error(`Атлас сердечек: пустая ячейка ${index + 1}.`);
    const sourceWidth = maxX - minX + 1, sourceHeight = maxY - minY + 1;
    const scale = Math.min(120 / sourceWidth, 120 / sourceHeight);
    const drawWidth = sourceWidth * scale, drawHeight = sourceHeight * scale;
    return texture(128, 128, context => {
      context.save();
      context.translate(128, 0);
      context.scale(-1, 1);
      context.drawImage(heartAtlasImage,
        minX, minY, sourceWidth, sourceHeight,
        (128 - drawWidth) / 2, (128 - drawHeight) / 2, drawWidth, drawHeight);
      context.restore();
    });
  });
  const poisonHeartTextures = heartTextures.map(source => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(source.image, 0, 0, 128, 128);
    const pixels = context.getImageData(0, 0, 128, 128);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const offset = (y * 128 + x) * 4, red = pixels.data[offset], green = pixels.data[offset + 1], blue = pixels.data[offset + 2];
      if (pixels.data[offset + 3] < 12 || red < 72 || red < Math.max(green, blue) * 1.24) continue;
      const value = Math.max(red, green, blue);
      const grain = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      const noise = grain - Math.floor(grain);
      const mottling = (noise - .5) * .13, yellowMoss = noise > .91 ? .12 : 0;
      pixels.data[offset] = Math.min(255, value * (.34 + yellowMoss));
      pixels.data[offset + 1] = Math.min(255, value * (.68 + mottling + yellowMoss));
      pixels.data[offset + 2] = Math.min(255, value * (.17 + yellowMoss * .28));
    }
    context.putImageData(pixels, 0, 0);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; return map;
  });
  const restoredHeartTextures = heartTextures.map(source => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(source.image, 0, 0, 128, 128);
    const pixels = context.getImageData(0, 0, 128, 128);
    for (let offset = 0; offset < pixels.data.length; offset += 4) {
      if (pixels.data[offset + 3] < 12) continue;
      pixels.data[offset] = 76; pixels.data[offset + 1] = 239; pixels.data[offset + 2] = 104;
    }
    context.putImageData(pixels, 0, 0);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; return map;
  });
  const heartMaterialVariants = createStatusHeartMaterials(THREE, heartTextures, poisonHeartTextures, restoredHeartTextures);
  resourceOwner.share('health-hud', () => [...heartMaterialVariants.all, ...heartTextures, ...poisonHeartTextures, ...restoredHeartTextures]);
  reportLoadStage('Текстура: атлас сердец', 'ready', `${heartAtlasCanvas.width}×${heartAtlasCanvas.height}`);
  const puckAmbientShadow = texture(256, 256, (context, width, height) => {
    const gradient = context.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width / 2);
    gradient.addColorStop(0, 'rgba(35, 24, 12, .12)');
    gradient.addColorStop(.62, 'rgba(35, 24, 12, .28)');
    gradient.addColorStop(.84, 'rgba(35, 24, 12, .16)');
    gradient.addColorStop(1, 'rgba(35, 24, 12, 0)');
    context.fillStyle = gradient; context.fillRect(0, 0, width, height);
  });
  const figureContactShadow = texture(256, 256, (context, width, height) => {
    const gradient = context.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width / 2);
    gradient.addColorStop(0, 'rgba(41, 25, 12, .44)');
    gradient.addColorStop(.48, 'rgba(41, 25, 12, .32)');
    gradient.addColorStop(1, 'rgba(41, 25, 12, 0)');
    context.fillStyle = gradient; context.fillRect(0, 0, width, height);
  });
  const ambientShadowMaterial = new THREE.MeshBasicMaterial({ map: puckAmbientShadow, transparent: true,
    opacity: .9, depthWrite: false, side: THREE.DoubleSide });
  const contactShadowMaterial = new THREE.MeshBasicMaterial({ map: figureContactShadow, transparent: true,
    opacity: .9, depthWrite: false, side: THREE.DoubleSide });
  const terrainCorrugation = corrugation.clone();
  terrainCorrugation.wrapS = terrainCorrugation.wrapT = THREE.RepeatWrapping;
  terrainCorrugation.repeat.set(1, 1);
  const sceneStencil = { stencilWrite: true, stencilRef: 0, stencilFunc: THREE.AlwaysStencilFunc,
    stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp, stencilZPass: THREE.ReplaceStencilOp };
  let frameWorkStarted = false, sliceStarted = performance.now();
  const yieldLocationWork = async () => {
    if (!frameWorkStarted || performance.now() - sliceStarted < 3) return;
    await new Promise(resolve => {
      let settled = false;
      const resume = () => { if (!settled) { settled = true; resolve(); } };
      requestAnimationFrame(() => setTimeout(resume, 0));
      setTimeout(resume, 50);
    });
    sliceStarted = performance.now();
  };
  const geometryClient = createGeometryClient(THREE,
    { paper, grain: cardboardGrain, corrugation, terrainCorrugation }, yieldLocationWork);
  const createFigure = createFigureFactory({ THREE, scene, renderer, ambientShadowMaterial, contactShadowMaterial,
    corrugation, paper, sceneStencil, heartMaterialVariants, geometryClient, cardboardDamageTexture, cardboardVoronoiTexture, cardboardTearNoiseTexture,
    cardboardPerlinTexture,
    revealUniforms: playerOcclusionDither.uniforms, getCardboardDamageSettings: () => cardboardDamageSettings,
    createEnemyMarker: (...args) => createVectorMarker(...args), groundUiY: GROUND_UI_Y });
  applyFigureDamageSettings = createFigure.setCardboardDamage;
  applyFigureDamageSettings(cardboardDamageSettings, cardboardDamageTexture, cardboardVoronoiTexture, cardboardTearNoiseTexture, cardboardPerlinTexture);
  applyUnitPuckColors = createFigure.setPuckColors;
  applyUnitPuckColors(sceneRegistry.unitPuckColors);
  const scenerySystem = createScenerySystem({ THREE, renderer, scene, locations, corrugation,
    paper, terrainCorrugation, sceneStencil, geometryClient, cardboardDamageTexture, cardboardVoronoiTexture, cardboardTearNoiseTexture,
    cardboardPerlinTexture,
    revealUniforms: playerOcclusionDither.uniforms, getCardboardDamageSettings: () => cardboardDamageSettings });
  const { create: createScenery, loadTemplate: loadSceneryTemplate, loadStateTemplates,
    createSprite: createScenerySpriteModel, facePairs: sceneryFacePairs } = scenerySystem;
  const figures = [];
  const figureByBody = new WeakMap();
  const registerFigure = figure => { figures.push(figure); if (figure?.body) figureByBody.set(figure.body, figure); return figure; };
  const cardboardFalls = [];
  reportLoadStage('Персонаж: игрок');
  const heroFigure = await createFigure(heroBody, 'hero');
  reportLoadStage('Экипировка: картонные накладки и сферы');
  heroEquipment = await createCharacterEquipment({ THREE, figure: heroFigure, loadTemplate: loadSceneryTemplate,
    getEquipment: () => campaignState.equipment, sceneStencil });
  reportLoadStage('Экипировка: картонные накладки и сферы', 'ready');
  reportLoadStage('Персонаж: игрок', 'ready');
  heroFigure.facing = 0;
  heroFigure.group.rotation.y = 0;
  orbit.theta = Math.PI;
  target.set(heroBody.x, cameraFocusHeight, heroBody.z);
  heroFigure.locationId = activeLocation.id; registerFigure(heroFigure);
  const revealTarget = new THREE.Vector3();
  function updatePlayerReveal() {
    revealTarget.set(heroFigure.group.position.x, 1.05, heroFigure.group.position.z);
    // Inactive location groups are hidden; a stale figure location must not disable the shared reveal mask.
    playerOcclusionDither.update(camera, revealTarget,
      heroBody.health > 0 && heroFigure.group.visible, performance.now() / 1000);
  }
  const enemyBody = (id, locationId, x, z, options = {}) => {
    const stored = options.freshSpawn ? null : campaignState.world?.[locationId]?.enemies?.find(enemy => enemy.id === id);
    return {
    id, team: 'enemy', locationId, x: stored?.x ?? x, z: stored?.z ?? z, vx: stored?.vx ?? 0, vz: stored?.vz ?? 0,
    health: Math.min(options.maxHealth ?? 32, stored?.health ?? options.health ?? 32), maxHealth: options.maxHealth ?? 32,
    charges: stored?.charges ?? 3, maxCharges: 3, rechargeTimer: stored?.rechargeTimer ?? 0,
    aiPhase: ['earth-slam-windup', 'earth-windup'].includes(stored?.aiPhase) ? 'pause' : stored?.aiPhase ?? 'pause',
    aiTimer: stored?.aiTimer ?? randomBetween(1, 4),
    bossSeriesAttack: ['dash', 'wave', 'leap-slam'].includes(stored?.bossSeriesAttack) ? stored.bossSeriesAttack : null,
    bossSeriesRemaining: Math.max(0, Math.min(3, Math.trunc(stored?.bossSeriesRemaining ?? 0))),
    bossGroundCooldown: Math.max(0, stored?.bossGroundCooldown ?? 0),
    aiAimAngle: stored?.aiAimAngle, aiAimDuration: stored?.aiAimDuration,
    aiTargetX: stored?.aiTargetX, aiTargetZ: stored?.aiTargetZ, aiStunRemaining: stored?.aiStunRemaining ?? 0,
    pendingEarthShatterPositions: Array.isArray(stored?.pendingEarthShatterPositions)
      ? stored.pendingEarthShatterPositions.filter(point => Number.isFinite(point?.x) && Number.isFinite(point?.z)) : null,
    directHitProtection: stored?.directHitProtection ?? false, attackRicochets: stored?.attackRicochets ?? 0,
    lootDropped: stored?.lootDropped ?? false, defeatRecorded: stored?.defeatRecorded ?? false,
    hitCooldown: stored?.hitCooldown ?? 0,
    combatAwake: stored?.combatAwake ?? options.combatAwake ?? false,
    spawnReady: stored?.spawnReady ?? options.spawnReady ?? true,
    boss: options.boss ?? false,
    archetype: options.archetype ?? 'goblin', damageQuarters: options.damageQuarters ?? 4,
    ...(Number.isFinite(options.radius) ? { radius: options.radius } : {}), active: stored?.active ?? true,
    fell: stored?.fell ?? false,
    };
  };
  const forestSpawns = [{ x: scaled(-3.1), z: scaled(.3) }, { x: scaled(3.1), z: scaled(.3) }];
  const campSpawns = CAMP_GOBLIN_SPAWNS.map((spawn, index) => ({
    x: scaled(spawn.x), z: scaled(spawn.z),
    hutX: scaled(CAMP_HUT_ANCHORS[index].x), hutZ: scaled(CAMP_HUT_ANCHORS[index].z),
  }));
  async function createAuthoredSpawner(location, id, archetype, x, z, unitId, { spawnAnimation = false, origin = null } = {}) {
    if (archetype === 'ogre' || archetype === 'ogre-boss') await ensureRockEffectAssets();
    const group = await createEditorAsset(location, id, { asset: 'editor-spawner', size: 1.15,
      position: [x, 0, z], rotation: [0, 0, 0], scale: [1, 1, 1],
      spawn: { ...ENEMY_SPAWNER_DEFAULTS, archetype, count: 1, maxAlive: 1, autoSpawn: true, spawnAnimation } });
    group.userData.sceneSpawnerUnitIds = [unitId];
    if (origin) group.userData.sceneSpawnerOrigin = origin;
    if (campaignState.world?.[location.id]?.enemies?.some(enemy => enemy.id === unitId))
      group.userData.sceneSpawnerState.spawned = 1;
    const saved = campaignState.world?.[location.id]?.enemies?.find(enemy => enemy.id === unitId);
    if (saved) {
      const stats = ENEMY_STATS[archetype] ?? {};
      const body = enemyBody(unitId, location.id, x, z, { ...stats, archetype, combatAwake: location.combatTriggered });
      if (body.health > 0 && !body.spawnReady) body.spawnReady = true;
      body.spawnerId = id; body.lastSafePosition = { x: body.x, z: body.z };
      location.enemies.push(body);
      const figure = await createFigure(body, archetype);
      figure.locationId = location.id; figure.group.visible = false; figure.healthHUD.visible = false;
      figure.enemyMarker.group.visible = false; registerFigure(figure);
    }
    return group;
  }
  async function createLocationEnemies(location) {
    location.spawners = [];
    location.spawnerStates = { ...(campaignState.world?.[location.id]?.spawners ?? {}) };
    if (location.id === 'forest') for (let index = 0; index < forestSpawns.length; index++) {
      const point = forestSpawns[index];
      await createAuthoredSpawner(location, `spawner:forest:${index + 1}`, 'goblin', point.x, point.z,
        `forest-goblin-${index + 1}`);
    }
    if (location.id === 'camp') for (let index = 0; index < campSpawns.length; index++) {
      const point = campSpawns[index];
      await createAuthoredSpawner(location, `spawner:camp:goblin-${index + 1}`, 'goblin', point.x, point.z,
        `camp-goblin-${index + 1}`, { spawnAnimation: true, origin: { x: point.hutX, z: point.hutZ } });
    }
    for (const encounter of STORY_ENCOUNTERS.filter(encounter => encounter.location === location.id))
      for (const unit of encounter.units) await createAuthoredSpawner(location,
        `spawner:${encounter.location}:${unit.id}`, unit.type, scaled(unit.x), scaled(unit.z), `${encounter.location}-${unit.id}`);
  }
  const storyActors = { actors: [], update() {
    for (const actor of this.actors) {
      const visible = !actor.prop.userData.sceneEditDeleted && isStoryActorVisible(actor.spec, campaignState);
      actor.prop.visible = visible; actor.body.active = visible;
      actor.prop.position.x = actor.body.x; actor.prop.position.z = actor.body.z;
    }
  } };
  const decorationSpecs = Object.fromEntries(Object.values(locations).map((location, index) => [location.id, {
    seed: location.heightSeed,
    decalCount: location.kind === 'camp' ? 48 : location.biome === 'quarry' ? 36 : 28,
    grassCount: location.biome === 'meadow' ? 110 : location.biome === 'marsh' ? 95
      : ['cave', 'vault', 'quarry'].includes(location.biome) ? 10 : location.biome === 'ridge' ? 18 : 64,
    exclusions: [
      ...(location.id === 'home' ? [{ x: scaled(-2.4), z: scaled(-2.4), radius: 2.7 }] : []),
      ...(location.id === 'forest' ? forestSpawns.map(point => ({ ...point, radius: 1.5 })) : []),
      ...(location.id === 'camp' ? [
        ...campSpawns.map(point => ({ x: point.x, z: point.z, radius: 1.45 })),
        ...CAMP_HUT_ANCHORS.map(hut => ({ x: scaled(hut.x), z: scaled(hut.z), radius: 1.95 })),
      ] : []),
      { x: 0, z: 0, radius: 1.45 },
    ],
  }]));
  refreshLocationInfo();
  const initialVisit = visitCampaignLocation(campaignState, activeLocation.id);
  renderStatusEffectsHud();
  const initialStoryCard = initialVisit?.firstVisit ? { title: activeLocation.title, text: activeLocation.campaignIntro,
    lines: getStoryDialogue(campaignState, activeLocation.id, 'intro') } : null;
  renderInventory();
  function setVisualState(figure, visualState) {
    const art = figure.artStates[visualState];
    for (const [name, stateArt] of Object.entries(figure.artStates)) stateArt.group.visible = name === visualState;
    figure.artGroup = art.group;
    figure.alphaPixels = art.alphaPixels;
    figure.width = art.width;
    figure.height = art.height;
    figure.flashMaterial = art.frontArt.flashMaterial;
    figure.backFlashMaterial = art.backArt.flashMaterial;
    if (figure.visualState === visualState) return;
    figure.visualState = visualState;
  }
  function noteHealthRestoration(figure, previousHealth, nextHealth) {
    if (!figure || nextHealth <= previousHealth) return;
    const startedAt = performance.now();
    figure.healthRestoreHearts ??= new Map();
    for (const index of restoredHeartIndices(previousHealth, nextHealth, figure.body.maxHealth)) {
      const pulse = { startedAt, token: ++healthRestoreSerial };
      figure.healthRestoreHearts.set(index, pulse);
      if (figure.body === heroBody) playerRestoredHearts.set(index, pulse);
    }
  }
  function clearLostHealthRestoration(figure, previousHealth, nextHealth) {
    if (!figure || nextHealth >= previousHealth) return;
    const changedHearts = restoredHeartIndices(nextHealth, previousHealth, figure.body.maxHealth);
    for (const index of changedHearts) {
      figure.healthRestoreHearts?.delete(index);
      if (figure.body === heroBody) playerRestoredHearts.delete(index);
    }
  }
  function syncFigureDamageStage(figure) {
    if (!figure?.cardboardDamageMaterials) return;
    const stage = cardboardDamageStageForHealth(figure.body.health, figure.body.maxHealth, cardboardDamageSettings);
    const signature = `${stage}:${JSON.stringify(cardboardDamageSettings)}`;
    if (figure.cardboardDamageSignature === signature) return;
    figure.cardboardDamageSignature = signature;
    updateCardboardDamageTree(figure.group, { settings: cardboardDamageSettings, stage,
      texture: cardboardDamageTexture, noiseTexture: cardboardVoronoiTexture,
      displacementNoiseTexture: cardboardPerlinTexture, tearNoiseTexture: cardboardTearNoiseTexture });
  }
  function prepareScenePresentation() {
    updateCamera();
    for (const figure of figures) {
      if (figure.poolDormant || (figure.body !== heroBody && figure.locationId !== activeLocation.id)) continue;
      const body = figure.body;
      if (!body.fell && !figure.spawnAnimation) figure.group.position.set(body.x, 0, body.z);
      const cameraDx = camera.position.x - figure.group.position.x;
      const cameraDz = camera.position.z - figure.group.position.z;
      const cameraDistance = Math.max(.001, Math.hypot(cameraDx, cameraDz));
      const facingDot = (cameraDx * Math.sin(figure.group.rotation.y) + cameraDz * Math.cos(figure.group.rotation.y)) / cameraDistance;
      figure.viewBack = body.health > 0 && facingDot < 0;
      for (const art of Object.values(figure.artStates)) {
        art.frontArt.group.visible = !figure.viewBack;
        art.backArt.group.visible = figure.viewBack;
      }
      const visualState = body.health <= 0 ? 'dead'
        : earthShatterAttackPoseActive(figure.earthShatterAttackAge) ? 'attack'
          : figure.hurtAge < .55 ? 'on-hit'
          : figure.dealDamageAge < .32 ? 'deal-damage'
            : body.team === 'enemy' && ['aim', 'guard'].includes(body.aiPhase) ? 'aiming' : 'idle';
      setVisualState(figure, visualState);
      figure.healthHUD.position.set(body.x, 2.65, body.z);
      figure.healthHUD.quaternion.copy(camera.quaternion);
      if (figure.enemyMarker) {
        figure.enemyMarker.group.position.set(body.x, GROUND_UI_Y, body.z);
        figure.enemyMarker.group.rotation.y = ['aim', 'guard'].includes(body.aiPhase) ? body.aiAimAngle : figure.facing;
      }
    }
    playerMarker.group.position.set(state.x, GROUND_UI_Y, state.z);
    for (const { prop, front, back } of sceneryFacePairs) {
      const dx = camera.position.x - prop.position.x, dz = camera.position.z - prop.position.z;
      const cameraOnFront = dx * Math.sin(prop.rotation.y) + dz * Math.cos(prop.rotation.y) >= 0;
      const face = sceneryFaceForCamera(cameraOnFront, prop.userData.cardboardFallenFace);
      front.visible = face === 'front';
      back.visible = face === 'back';
    }
  }
  function updateEditorPresentation() {
    for (const figure of figures) {
      if (figure.poolDormant || (figure.body !== heroBody && figure.locationId !== activeLocation.id)) continue;
      const localCamera = figure.group.worldToLocal(camera.position.clone());
      figure.viewBack = figure.body.health > 0 && localCamera.z < 0;
      for (const art of Object.values(figure.artStates)) {
        art.frontArt.group.visible = !figure.viewBack; art.backArt.group.visible = figure.viewBack;
      }
      figure.healthHUD.quaternion.copy(camera.quaternion);
    }
    for (const { prop, front, back } of sceneryFacePairs) {
      const cameraOnFront = prop.worldToLocal(camera.position.clone()).z >= 0;
      const face = sceneryFaceForCamera(cameraOnFront, prop.userData.cardboardFallenFace);
      front.visible = face === 'front'; back.visible = face === 'back';
    }
  }
  let activeFigure = figures[0];
  let selectionAge = .6;
  let elapsed = 0;
  let transitionCooldown = 0;
  let locationTransition = false;
  let failedTransitionTo = null;
  let startupCinematic = null;
  let victorySequenceActive = false;
  let locationArrivalCheckpoint = null;
  let deathScreenOpen = false;
  let deathResumeSnapshot = null;
  let deathAdTimer = null;
  const debugMode = Boolean(localEditor) && new URLSearchParams(location.search).has('debug');
  let simulationPaused = debugMode;
  const celebratedLocations = new Set();
  let protectedEntryFrom = null;
  const campSpawnPoints = campSpawns;
  const campGoblinPool = [];
  let campOgrePool = null;
  let campPreloadPromise = null;
  let campOgrePreloadPromise = null;
  async function preloadCampOgre() {
    if (campOgrePool) return campOgrePool;
    if (campOgrePreloadPromise) return campOgrePreloadPromise;
    campOgrePreloadPromise = (async () => {
      await ensureRockEffectAssets();
      const body = enemyBody('camp-ogre-pool', 'camp', 0, 0,
        { health: 0, maxHealth: OGRE_SETTINGS.health, spawnReady: false, combatAwake: true, boss: true,
          archetype: 'ogre-boss', radius: PUCK_RADIUS * 1.5 });
      const figure = await createFigure(body, 'ogre');
      figure.puck.scale.set(1.5, 1, 1.5);
      figure.locationId = 'camp'; figure.poolDormant = true;
      figure.group.visible = false; figure.healthHUD.visible = false; figure.enemyMarker.group.visible = false;
      registerFigure(figure); campOgrePool = figure;
      return figure;
    })();
    try { return await campOgrePreloadPromise; }
    finally { campOgrePreloadPromise = null; }
  }
  async function preloadCampEnemies(required = CAMP_GOBLIN_TOTAL - Math.max(CAMP_LIVING_CAP, locations.camp.goblinsSpawned)) {
    if (campGoblinPool.length >= required) return;
    if (campPreloadPromise) return campPreloadPromise;
    campPreloadPromise = (async () => {
      while (campGoblinPool.length < required) {
        const body = enemyBody(`camp-goblin-pool-${campGoblinPool.length + 1}`, 'camp', 0, 0,
          { health: 0, maxHealth: 32, spawnReady: false, combatAwake: true });
        const figure = await createFigure(body, 'goblin');
        figure.locationId = 'camp'; figure.poolDormant = true;
        figure.group.visible = false; figure.healthHUD.visible = false; figure.enemyMarker.group.visible = false;
        registerFigure(figure); campGoblinPool.push(figure);
        await yieldFrameWork();
      }
    })().catch(error => { campPreloadPromise = null; throw error; });
    try { await campPreloadPromise; }
    finally { campPreloadPromise = null; }
  }
  let campRestorePromise = null;
  async function restoreSavedCampEnemies() {
    // Authored units are restored through their current scene definitions, never from the wave pool.
    const storedEnemies = campaignState.world?.camp?.enemies?.filter(enemy => enemy.id === 'camp-ogre'
      || /^camp-goblin-[1-9]\d*$/.test(enemy.id) && Number(enemy.id.slice('camp-goblin-'.length)) <= CAMP_GOBLIN_TOTAL);
    if (!storedEnemies?.length) return;
    if (campRestorePromise) return campRestorePromise;
    campRestorePromise = (async () => {
      await preloadCampEnemies(storedEnemies.filter(enemy => enemy.id !== 'camp-ogre'
        && !locations.camp.enemies.some(body => body.id === enemy.id)).length);
      if (campaignState.world?.camp?.bossSpawned) await preloadCampOgre();
      for (const saved of storedEnemies) {
        if (locations.camp.enemies.some(enemy => enemy.id === saved.id)) continue;
        const isBoss = saved.id === 'camp-ogre';
        const figure = isBoss ? campOgrePool : campGoblinPool.pop();
        if (!figure) continue;
        const body = enemyBody(saved.id, 'camp', saved.x, saved.z,
          isBoss ? { health: OGRE_SETTINGS.health, maxHealth: OGRE_SETTINGS.health, combatAwake: true, boss: true,
            archetype: 'ogre-boss', radius: PUCK_RADIUS * 1.5 }
            : { health: 32, maxHealth: 32, combatAwake: true });
        body.spawnReady = true;
        figure.body = body; figure.group.userData.figure = figure; figure.poolDormant = false;
        createFigure.attach(figure);
        if (!figures.includes(figure)) registerFigure(figure);
        figure.spawnAnimation = null; figure.victoryAnimation = null; figure.bossScale = isBoss ? 1.5 : 1;
        figure.hitAge = 10; figure.hitStrength = 0; figure.hurtAge = 10; figure.dealDamageAge = 10;
        figure.viewBack = false; figure.locationId = 'camp'; syncFigureDamageStage(figure);
        setVisualState(figure, body.health > 0 ? 'idle' : 'dead');
        figure.group.visible = activeLocation.id === 'camp';
        figure.healthHUD.visible = figure.group.visible && shouldShowHealthHud(body.team, body.health, body.maxHealth);
        if (figure.enemyMarker) figure.enemyMarker.group.visible = figure.group.visible && body.health > 0;
        locations.camp.enemies.push(body);
        if (isBoss) campOgrePool = null;
      }
      if (activeLocation.id === 'camp') { showActiveLocationFigures(); rebuildBodies(); refreshLocationInfo(); }
    })().finally(() => { campRestorePromise = null; });
    return campRestorePromise;
  }
  function renderInventory() { inventory.render(); }
  function showStoryCard(card) {
    dialogue.show({ ...card, title: card.title ?? activeLocation.title });
  }
  function inspectCurrentLocation() {
    if (activeLocation.secret || campaignState.collected[activeLocation.id] || victorySequenceActive
      || locationHasLivingEnemies(activeLocation) || dialogue.isOpen()) return false;
    const result = inspectCampaignLocation(campaignState, activeLocation.id);
    if (!result) return false;
    persistCampaign(); renderInventory();
    showStoryCard({ ...result, lines: campaignState.collected[activeLocation.id] ? []
      : getStoryDialogue(campaignState, activeLocation.id) });
    return true;
  }
  function snapshotLocation(location) { return captureLocationSnapshot(location, { campaignState, actors: storyActors.actors, elapsed }); }
  function persistCampaign() { return persistCampaignSnapshot({ campaignState, activeLocation, heroBody, elapsed,
    locations, actors: storyActors.actors, repository: campaignSaves }); }
  const getApplicationMode = () => applicationMode({ editor: sceneEditor?.active, transition: locationTransition,
    cinematic: Boolean(startupCinematic), dialogue: dialogue.isOpen(), inventory: !inventoryPanel.hidden,
    map: locationMap.isOpen(), audio: audioControls.isOpen(), shop: shop.isOpen(), death: deathScreenOpen, manualPause: simulationPaused });
  document.querySelector('#inventory-toggle').addEventListener('click', () => {
    if (dialogue.isOpen() || locationTransition) return;
    shop.hide();
    inventory.open();
  });
  locationInfoButton.addEventListener('click', () => {
    if (dialogue.isOpen()) return;
    shop.hide();
    inputController?.cancel(); inventory.hide();
    try {
      const graphData = ensureCampaignGraphData(campaignState, { includeVisuals: false });
      locationMap.setCampaignGraph(activeCampaignGraph ?? graphData.graph);
      locationMap.show(campaignState);
    } catch (error) {
      const message = document.querySelector('#error'); message.dataset.uiAnchor ??= 'center'; message.dataset.uiMotionSurface = '';
      message.textContent = `Не удалось построить карту мира: ${error.message}`;
      void showUIWindow(message);
    }
  });
  document.querySelector('#restart').addEventListener('click', () => {
    campaignSaves.clear();
    location.reload();
  });

  const chestVisuals = new Map();
  const worldItemVisuals = new Map();
  const storyPickupVisuals = new Map();
  const lootItemIds = ['berries', 'hardtack', 'jerky', 'bandage', 'scrap', 'nuts', 'bladeShard'];
  const lootSpriteModels = new Map();
  const lootIconCanvases = new Map(), itemIconFlights = [];
  const itemFlightCanvas = document.querySelector('#item-flight-canvas');
  const itemFlightContext = itemFlightCanvas.getContext('2d');
  let itemFlightCanvasHasPixels = false;
  function resizeItemFlightCanvas() {
    const ratio = Math.min(devicePixelRatio || 1, 2);
    itemFlightCanvas.width = Math.round(innerWidth * ratio);
    itemFlightCanvas.height = Math.round(innerHeight * ratio);
    itemFlightCanvas.style.width = `${innerWidth}px`; itemFlightCanvas.style.height = `${innerHeight}px`;
    itemFlightContext.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  resizeItemFlightCanvas();
  let lootAssetsPromise = null;
  function ensureLootSprites() {
    if (lootAssetsPromise) return lootAssetsPromise;
    lootAssetsPromise = (async () => {
      const lootAtlas = await new THREE.TextureLoader().loadAsync('assets/loot-atlas.png?v=1');
      lootAtlas.colorSpace = THREE.SRGBColorSpace;
      lootAtlas.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      const lootCellWidth = lootAtlas.image.width / 4, lootCellHeight = lootAtlas.image.height / 2;
      for (const [index, id] of lootItemIds.entries()) {
        const canvas = document.createElement('canvas'); canvas.width = lootCellWidth; canvas.height = lootCellHeight;
        canvas.getContext('2d', { willReadFrequently: true }).drawImage(lootAtlas.image,
          (index % 4) * lootCellWidth, Math.floor(index / 4) * lootCellHeight, lootCellWidth, lootCellHeight,
          0, 0, lootCellWidth, lootCellHeight);
        lootIconCanvases.set(id, canvas);
        lootSpriteModels.set(id, await createScenerySpriteModel(canvas));
      }
      lootAtlas.dispose();
      for (const item of EQUIPMENT_ITEMS) {
        const source = await new THREE.TextureLoader().loadAsync(item.image);
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
        const size = Math.min(256 / source.image.width, 256 / source.image.height);
        const width = source.image.width * size, height = source.image.height * size;
        canvas.getContext('2d').drawImage(source.image, (256 - width) / 2, (256 - height) / 2, width, height);
        source.dispose(); lootIconCanvases.set(item.id, canvas);
        lootSpriteModels.set(item.id, await createScenerySpriteModel(canvas));
      }
      const coins = await new THREE.TextureLoader().loadAsync('assets/economy/coins.png');
      for (const skin of COIN_SKINS) {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
        const cellWidth = coins.image.width / 3, cellHeight = coins.image.height, scale = Math.min(256 / cellWidth, 256 / cellHeight);
        const width = cellWidth * scale, height = cellHeight * scale;
        canvas.getContext('2d').drawImage(coins.image, skin.frame * cellWidth, 0, cellWidth, cellHeight, (256 - width) / 2, (256 - height) / 2, width, height);
        lootIconCanvases.set(skin.id, canvas); lootSpriteModels.set(skin.id, await createScenerySpriteModel(canvas));
      }
      coins.dispose();
    })().catch(error => { lootAssetsPromise = null; throw error; });
    return lootAssetsPromise;
  }
  function makeMittenTexture() {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const context = canvas.getContext('2d');
    const path = new Path2D();
    path.moveTo(39, 111); path.lineTo(28, 105); path.lineTo(33, 83);
    path.bezierCurveTo(24, 78, 14, 69, 10, 60); path.bezierCurveTo(6, 50, 14, 41, 23, 45);
    path.lineTo(35, 55); path.lineTo(35, 31); path.bezierCurveTo(35, 17, 45, 9, 57, 10);
    path.bezierCurveTo(70, 9, 80, 18, 82, 32); path.lineTo(84, 62);
    path.bezierCurveTo(87, 79, 79, 96, 73, 111); path.closePath();
    context.lineJoin = 'round'; context.lineCap = 'round';
    context.fillStyle = '#c9995e'; context.strokeStyle = '#f2dfb7'; context.lineWidth = 15; context.stroke(path);
    context.strokeStyle = '#49301e'; context.lineWidth = 10; context.stroke(path); context.fill(path);
    context.beginPath(); context.moveTo(34, 88); context.lineTo(78, 91); context.lineTo(74, 109); context.lineTo(30, 105); context.closePath();
    context.fillStyle = '#8b4935'; context.fill(); context.strokeStyle = '#49301e'; context.lineWidth = 6; context.stroke();
    context.strokeStyle = '#e8c58c'; context.lineWidth = 3;
    for (let i = 0; i < 4; i++) { context.beginPath(); context.moveTo(39 + i * 9, 94); context.lineTo(37 + i * 9, 101); context.stroke(); }
    context.strokeStyle = '#f3d6a2'; context.lineWidth = 4;
    context.beginPath(); context.moveTo(49, 25); context.quadraticCurveTo(58, 18, 68, 26); context.stroke();
    for (let i = 0; i < 3; i++) {
      const x = 47 + i * 10;
      context.beginPath(); context.moveTo(x, 57); context.lineTo(x + 4, 48); context.lineTo(x + 8, 57); context.closePath();
      context.fillStyle = '#f3d6a2'; context.fill();
    }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    return texture;
  }
  const storyPickupIconMaterial = new THREE.MeshBasicMaterial({ map: makeMittenTexture(), transparent: true,
    alphaTest: .08, side: THREE.DoubleSide, depthTest: true, depthWrite: true, toneMapped: false });
  const storyPickupIconGeometry = new THREE.PlaneGeometry(.82, .82);
  function makeLootBeamTexture() {
    const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 320;
    const context = canvas.getContext('2d'), image = context.createImageData(canvas.width, canvas.height);
    const center = canvas.width / 2;
    for (let y = 0; y < canvas.height; y++) {
      const upward = (canvas.height - 1 - y) / (canvas.height - 1);
      const halfWidth = 4 + 70 * upward ** .82;
      for (let x = 0; x < canvas.width; x++) {
        const edge = Math.abs(x + .5 - center) / halfWidth;
        if (edge >= 1) continue;
        const softEdge = 1 - THREE.MathUtils.smoothstep(edge, .68, 1);
        const alpha = Math.round(255 * softEdge * (.42 * Math.exp(-upward * 2.35)));
        const offset = (y * canvas.width + x) * 4, warmth = Math.min(1, edge * 1.15);
        image.data[offset] = 255;
        image.data[offset + 1] = Math.round(250 - warmth * 35);
        image.data[offset + 2] = Math.round(216 - warmth * 76);
        image.data[offset + 3] = alpha;
      }
    }
    context.putImageData(image, 0, 0);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
  const lootBeamTexture = makeLootBeamTexture();
  const lootBeamMaterial = new THREE.MeshBasicMaterial({ map: lootBeamTexture, transparent: true,
    opacity: .9, side: THREE.DoubleSide, depthTest: true, depthWrite: false,
    blending: THREE.AdditiveBlending, toneMapped: false });
  const lootBeamGeometry = new THREE.PlaneGeometry(1, 1);
  function makeLootRayTexture() {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const context = canvas.getContext('2d'), center = 128;
    const halo = context.createRadialGradient(center, center, 4, center, center, 126);
    halo.addColorStop(0, 'rgba(255,245,204,.8)'); halo.addColorStop(.24, 'rgba(255,207,105,.48)');
    halo.addColorStop(.72, 'rgba(255,159,54,.12)'); halo.addColorStop(1, 'rgba(255,159,54,0)');
    context.fillStyle = halo; context.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 28; i++) {
      const angle = i * Math.PI * 2 / 28, inner = i % 2 ? 43 : 36, outer = i % 2 ? 118 : 92;
      const spread = i % 2 ? .035 : .052;
      context.beginPath(); context.moveTo(center + Math.cos(angle) * inner, center + Math.sin(angle) * inner);
      context.lineTo(center + Math.cos(angle - spread) * outer, center + Math.sin(angle - spread) * outer);
      context.lineTo(center + Math.cos(angle + spread) * outer, center + Math.sin(angle + spread) * outer);
      context.closePath(); context.fillStyle = i % 4 ? 'rgba(255,198,91,.24)' : 'rgba(255,243,188,.42)'; context.fill();
    }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
  }
  function makeLootGlintTexture() {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const context = canvas.getContext('2d'), center = 64;
    const glow = context.createRadialGradient(center, center, 0, center, center, 61);
    glow.addColorStop(0, 'rgba(255,255,255,1)'); glow.addColorStop(.08, 'rgba(255,248,211,.96)');
    glow.addColorStop(.27, 'rgba(255,215,130,.58)'); glow.addColorStop(1, 'rgba(255,200,100,0)');
    context.fillStyle = glow; context.fillRect(0, 0, 128, 128);
    for (const [width, height, alpha] of [[8, 60, .9], [60, 8, .9], [5, 38, .58], [38, 5, .58]]) {
      context.fillStyle = `rgba(255,250,222,${alpha})`; context.beginPath();
      context.ellipse(center, center, width / 2, height / 2, 0, 0, Math.PI * 2); context.fill();
    }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
  }
  const lootRayTexture = makeLootRayTexture(), lootRayMaterial = new THREE.SpriteMaterial({ map: lootRayTexture,
    color: 0xffd27c, transparent: true, opacity: .78, depthTest: true, depthWrite: false,
    blending: THREE.AdditiveBlending, toneMapped: false });
  const lootGlintTexture = makeLootGlintTexture(), lootGlintMaterial = new THREE.SpriteMaterial({ map: lootGlintTexture,
    color: 0xfff1c0, transparent: true, opacity: 0, depthTest: true, depthWrite: false,
    blending: THREE.AdditiveBlending, toneMapped: false });
  const lootGlintOffsets = [[-.28, .31], [.34, .03], [-.12, -.33]];
  function createLootVisual(...args) { return worldItemsController.createLootVisual(...args); }
  function createStoryPickupVisual(...args) { return worldItemsController.createStoryPickupVisual(...args); }
  function makeCacheBody(...args) { return worldItemsController.makeCacheBody(...args); }
  function createPlacedChest(...args) { return worldItemsController.createPlacedChest(...args); }
  let groundResources = null;
  resourceOwner.share('terrain-textures', [paper, cardboardGrain, corrugation, terrainCorrugation]);
  resourceOwner.share('contact-shadows', [ambientShadowMaterial, contactShadowMaterial, puckAmbientShadow, figureContactShadow]);
  resourceOwner.share('loot', [lootBeamGeometry, lootBeamMaterial, lootRayMaterial, lootGlintMaterial]);
  resourceOwner.share('story-pickups', [storyPickupIconGeometry, storyPickupIconMaterial]);
  resourceOwner.share('ground-cache', () => [...(groundResources?.materials.values() ?? []), ...(groundResources?.textures.values() ?? [])]);
  function decorateInspectionMarker(marker) {
    marker.userData.disablePlayerReveal = true;
    marker.userData.disableEnemySilhouette = true;
    const art = marker.children[0];
    if (art) { art.scale.x *= 1.5; art.scale.y *= 1.5; art.position.y += 1.12; }
    const dark = new THREE.MeshBasicMaterial({ color: 0x3c241c, ...sceneStencil });
    const cream = new THREE.MeshBasicMaterial({ color: 0xffe9b0, ...sceneStencil });
    const dotOuter = new THREE.Mesh(new THREE.CylinderGeometry(.145, .145, .055, 20), dark);
    dotOuter.position.y = .03;
    const dotCenter = new THREE.Mesh(new THREE.CylinderGeometry(.105, .105, .058, 20), cream);
    dotCenter.position.y = .034;
    marker.add(dotOuter, dotCenter);
    const groundArms = 4, armLength = .24, armCenterY = .065;
    const outerArms = new THREE.InstancedMesh(new THREE.CylinderGeometry(.052, .052, armLength, 8), dark, groundArms);
    const innerArms = new THREE.InstancedMesh(new THREE.CylinderGeometry(.031, .031, armLength, 8), cream, groundArms);
    const armTransform = new THREE.Object3D();
    const armPlacements = [
      { x: -.225, z: 0, rotateX: 0, rotateZ: Math.PI / 2 },
      { x: .225, z: 0, rotateX: 0, rotateZ: Math.PI / 2 },
      { x: 0, z: -.225, rotateX: Math.PI / 2, rotateZ: 0 },
      { x: 0, z: .225, rotateX: Math.PI / 2, rotateZ: 0 },
    ];
    for (let index = 0; index < groundArms; index++) {
      const arm = armPlacements[index];
      armTransform.position.set(arm.x, armCenterY, arm.z);
      armTransform.rotation.set(arm.rotateX, 0, arm.rotateZ);
      armTransform.updateMatrix();
      outerArms.setMatrixAt(index, armTransform.matrix);
      innerArms.setMatrixAt(index, armTransform.matrix);
    }
    outerArms.instanceMatrix.needsUpdate = true;
    innerArms.instanceMatrix.needsUpdate = true;
    marker.add(outerArms, innerArms);
    const dashCount = 7, dashHeight = .075, dashPitch = .15;
    // Outline and fill keep the doubled dash width readable at phone scale.
    const outerDashes = new THREE.InstancedMesh(new THREE.CylinderGeometry(.062, .062, dashHeight, 8), dark, dashCount);
    const innerDashes = new THREE.InstancedMesh(new THREE.CylinderGeometry(.037, .037, dashHeight, 8), cream, dashCount);
    const dashTransform = new THREE.Object3D();
    for (let index = 0; index < dashCount; index++) {
      dashTransform.position.set(0, .18 + index * dashPitch, 0);
      dashTransform.updateMatrix();
      outerDashes.setMatrixAt(index, dashTransform.matrix);
      innerDashes.setMatrixAt(index, dashTransform.matrix);
    }
    outerDashes.instanceMatrix.needsUpdate = true;
    innerDashes.instanceMatrix.needsUpdate = true;
    marker.add(outerDashes, innerDashes);
    return marker;
  }
  async function createEditorWorldItem(location, id, value, item) {
    if ((location.collectedPlacedItems ?? []).includes(id)) return null;
    await ensureLootSprites();
    let pickup = location.loot.find(loot => loot.id === id);
    if (!pickup) {
      pickup = { id, itemId: item.itemId, x: value.position[0], z: value.position[2], ...(item.itemId === 'coins' ? { amount: item.amount } : {}) };
      location.loot.push(pickup);
    }
    pickup.x = value.position[0]; pickup.z = value.position[2];
    let visual = worldItemVisuals.get(id);
    if (!visual) visual = createLootVisual(location, pickup);
    const group = visual.group;
    Object.assign(group.userData, { sceneEditId: id, sceneEditLabel: item.label, sceneEditCategory: 'interactive',
      sceneEditAsset: value.asset, sceneEditSize: value.size,
      sceneEditSync() { pickup.x = group.position.x; pickup.z = group.position.z; },
      sceneEditDelete(deleted) {
        if (deleted) {
          location.loot = location.loot.filter(loot => loot.id !== id);
          worldItemVisuals.delete(id);
        } else {
          if (!location.loot.some(loot => loot.id === id)) location.loot.push(pickup);
          worldItemVisuals.set(id, visual);
        }
      } });
    group.position.fromArray(value.position); group.rotation.set(...value.rotation); group.scale.fromArray(value.scale);
    return group;
  }
  async function createEditorAsset(location, id, value) {
    const item = catalogAsset(value.asset);
    if (!item) throw new Error(`Unknown scene asset: ${value.asset}`);
    if (item.kind === 'placeholder') {
      const placeholder = createScenePlaceholder(THREE, { name: value.name, size: value.size });
      placeholder.name = id; placeholder.position.fromArray(value.position);
      placeholder.rotation.set(...value.rotation); placeholder.scale.fromArray(value.scale);
      attachSceneryToTerrain(placeholder,location.terrainHeightMap);
      Object.assign(placeholder.userData, { sceneEditId: id, sceneEditLabel: value.name || item.label,
        sceneEditCategory: item.category, sceneEditKind: 'placeholder', sceneEditAsset: value.asset,
        sceneEditSize: value.size, sceneNoteName: value.name || 'Новая идея',
        sceneNoteDescription: value.description || '' });
      placeholder.userData.sceneEditSync = () => updateScenePlaceholderName(placeholder, placeholder.userData.sceneNoteName);
      location.sceneGroup.add(placeholder);
      location.edgeShade?.applyTo(placeholder);
      return placeholder;
    }
    if (item.kind === 'spawner') {
      const group = new THREE.Group();
      const wood = new THREE.MeshStandardMaterial({ color: 0x76502c, roughness: 1 });
      const post = new THREE.Mesh(new THREE.CylinderGeometry(.045, .065, .52, 6), wood);
      post.position.y = .26; post.castShadow = true; group.add(post);
      const plaque = new THREE.Mesh(new THREE.BoxGeometry(.78, .78, .095), wood.clone());
      plaque.position.y = .83; plaque.castShadow = true; plaque.receiveShadow = true; group.add(plaque);
      const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
      const context = canvas.getContext('2d');
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
      const portrait = new THREE.Mesh(new THREE.PlaneGeometry(.69, .69), new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide }));
      portrait.position.set(0, .83, .052); group.add(portrait);
      group.userData.sceneSpawner = normalizeEnemySpawner(value.spawn);
      group.userData.sceneSpawnerSync = () => {
        const config = group.userData.sceneSpawner, heads = { goblin: '👺', slinger: '🏹', boar: '🐗', ogre: '👹',
          'acid-spitter': '🟢', shellguard: '🐢', burrower: '🪱', flanker: '🗡️', 'ember-moth': '🦋', hexer: '🔮' };
        context.clearRect(0, 0, 256, 256);
        context.fillStyle = '#b9834b'; context.fillRect(12, 12, 232, 232);
        context.fillStyle = '#5a351f'; context.fillRect(20, 18, 216, 220);
        context.fillStyle = '#d9b278'; context.beginPath(); context.arc(128, 111, 82, 0, Math.PI * 2); context.fill();
        context.strokeStyle = '#57341f'; context.lineWidth = 9; context.stroke();
        context.textAlign = 'center'; context.textBaseline = 'middle'; context.font = '112px "Segoe UI Emoji", sans-serif';
        context.fillText(heads[config.archetype] ?? '👺', 128, 113);
        context.fillStyle = '#fff3d1'; context.font = 'bold 30px sans-serif';
        context.fillText(`×${config.count}`, 128, 216);
        texture.needsUpdate = true;
      };
      group.userData.sceneSpawnerSync();
      group.name = id; group.position.fromArray(value.position); group.rotation.set(...value.rotation); group.scale.fromArray(value.scale);
      group.visible = Boolean(sceneEditor.active);
      attachSceneryToTerrain(group, location.terrainHeightMap);
      Object.assign(group.userData, { sceneEditId: id, sceneEditLabel: `Спавнер · ${item.label}`,
        sceneEditCategory: 'technical', sceneEditAsset: value.asset, sceneEditPrefabId: item.id,
        sceneEditSize: value.size, sceneSpawnerState: location.spawnerStates?.[id] ?? { spawned: 0, timer: 0 } });
      location.sceneGroup.add(group); location.spawners?.push(group);
      location.edgeShade?.applyTo(group);
      return group;
    }
    if (item.kind === 'chest') return createPlacedChest(location, id, value, item);
    if (item.kind === 'world-item') return createEditorWorldItem(location, id, value, item);
    if (item.kind === 'enemy') {
      const stats = ENEMY_STATS[item.archetype] ?? { health: 32, maxHealth: 32, damageQuarters: 4 };
      const body = enemyBody(id, location.id, value.position[0], value.position[2], {
        ...stats, archetype: item.archetype, combatAwake: true, radius: stats.radius,
      });
      body.editorPlaced = true;
      if (item.customSprite) body.spriteAsset = item.asset;
      body.lastSafePosition = { x: body.x, z: body.z };
      const figure = await createFigure(body, item.archetype);
      figure.locationId = location.id;
      figure.group.name = id; figure.group.position.fromArray(value.position);
      figure.group.rotation.set(...value.rotation); figure.group.scale.fromArray(value.scale);
      figure.group.userData.sceneEditId = id;
      figure.group.userData.sceneEditLabel = `Враг · ${item.label}`;
      figure.group.userData.sceneEditCategory = 'enemies';
      figure.group.userData.sceneEditAsset = item.asset;
      figure.group.userData.sceneEditSize = value.size;
      figure.group.userData.sceneEditBody = body;
      figure.group.userData.sceneEditDelete = deleted => {
        body.active = !deleted;
        figure.group.visible = !deleted;
        figure.healthHUD.visible = !deleted && location.id === activeLocation.id
          && shouldShowHealthHud(body.team, body.health, body.maxHealth);
        figure.enemyMarker.group.visible = !deleted && location.id === activeLocation.id && body.health > 0;
      };
      location.sceneGroup.add(figure.group);
      location.enemies.push(body); registerFigure(figure);
      figure.group.visible = true;
      figure.healthHUD.visible = location.id === activeLocation.id
        && shouldShowHealthHud(body.team, body.health, body.maxHealth);
      figure.enemyMarker.group.visible = location.id === activeLocation.id;
      return figure.group;
    }
    if (item.kind === 'merchant') {
      const actor = await createMerchantActor({ location, createScenery, definition: merchantDefinition(item.merchantId), id,
        x: value.position[0], z: value.position[2] });
      actor.prop.position.fromArray(value.position); actor.prop.rotation.set(...value.rotation); actor.prop.scale.fromArray(value.scale);
      actor.body.x = actor.prop.position.x; actor.body.z = actor.prop.position.z;
      merchantActors.push(actor); location.edgeShade?.applyTo(actor.prop); return actor.prop;
    }
    if (item.id === 'inspect') {
      const marker = await createScenery(value.asset, value.position[0], value.position[2], value.size, location.sceneGroup, true,
        { elevation: value.position[1], yaw: value.rotation[1], fixedRadius: .52, sceneEditId: id, sceneEditLabel: item.label });
      if (!marker) return null;
      marker.position.fromArray(value.position); marker.rotation.set(...value.rotation); marker.scale.fromArray(value.scale);
      marker.userData.sceneEditAsset = value.asset; marker.userData.sceneEditSize = value.size;
      Object.assign(marker.userData.sceneEditBody, { id, kind: 'inspection-marker', team: 'neutral', locationId: location.id,
        health: 0, maxHealth: 0, fixed: true, active: true });
      location.obstacles = location.obstacles.filter(body => body !== marker.userData.sceneEditBody);
      decorateInspectionMarker(marker); location.edgeShade?.applyTo(marker); return marker;
    }
    const prop = await createScenery(value.asset, value.position[0], value.position[2], value.size, location.sceneGroup, true,
      { elevation: value.position[1], yaw: value.rotation[1], fixedRadius: Math.min(.7, value.size * .19),
        sceneEditId: id, sceneEditLabel: item.label });
    prop.position.fromArray(value.position); prop.rotation.set(...value.rotation); prop.scale.fromArray(value.scale);
    prop.userData.sceneEditAsset = value.asset; prop.userData.sceneEditSize = value.size;
    location.edgeShade?.applyTo(prop); return prop;
  }
  function buildLocation(...args) { return locationLifecycle.buildLocation(...args); }
  async function ensureInspectionMarker(location) {
    if (!location || location.secret || location.inspectionMarker || !location.sceneGroup) return;
    const parent = location.sceneGroup;
    try {
      const groundY = location.terrainHeightMap?.sample(0, 0) ?? 0;
      const marker = await createScenery('assets/poi-inspection-bark.webp', 0, 0, .72, parent, true,
        { elevation: groundY, yaw: 0, fixedRadius: .52, sceneEditId: `inspection-marker:${location.id}`, sceneEditLabel: 'Знак точки интереса' });
      if (!marker || location.sceneGroup !== parent) {
        if (marker) {
          parent.remove(marker);
          for (let index = sceneryFacePairs.length - 1; index >= 0; index--)
            if (sceneryFacePairs[index].prop === marker) sceneryFacePairs.splice(index, 1);
        }
        return;
      }
      marker.name = `inspection-marker:${location.id}`;
      marker.userData.sceneEditAsset = 'assets/poi-inspection-bark.webp';
      marker.userData.sceneEditSize = .72;
      const body = marker.userData.sceneEditBody;
      Object.assign(body, { id: `inspection-marker:${location.id}`, kind: 'inspection-marker', team: 'neutral',
        locationId: location.id, health: 0, maxHealth: 0, fixed: true, active: true });
      location.obstacles = location.obstacles.filter(obstacle => obstacle !== body);
      decorateInspectionMarker(marker);
      location.edgeShade?.applyTo(marker);
      sceneRegistry.bindEntity(location, marker.userData.sceneEditId, marker.userData.sceneEditLabel, marker,
        { category: 'interactive', asset: marker.userData.sceneEditAsset, size: marker.userData.sceneEditSize, body,
          sync() { body.x = marker.position.x; body.z = marker.position.z; body.radius = .52 * Math.max(marker.scale.x, marker.scale.z); } });
      sceneEditor?.refreshBindings();
      if (activeLocation === location) rebuildBodies();
      for (const resource of sceneResources([marker])) if (resource.isTexture) renderer.initTexture(resource);
      location.inspectionMarker = marker;
    } catch (error) {
      console.warn(`Не удалось создать маркер осмотра для ${location.id}`, error);
    }
  }
  let terrainFogRebuildTimer = 0, terrainFogRebuildChain = Promise.resolve();
  function scheduleTerrainFogRebuild(locationId = null) {
    clearTimeout(terrainFogRebuildTimer);
    terrainFogRebuildTimer = setTimeout(() => {
      terrainFogRebuildChain = terrainFogRebuildChain.catch(() => {}).then(async () => {
        const targets = locationId ? [locations[locationId]].filter(Boolean) : Object.values(locations);
        for (const location of targets) if (location.runtimeReady) {
          try { await rebuildLocationTerrain(location, sceneRegistry.terrainEdits(location.id)); }
          catch (error) { console.warn(`Не удалось обновить отсечение террейна для ${location.id}`, error); }
        }
      });
    }, 180);
  }
  function rebuildLocationTerrain(...args) { return locationLifecycle.rebuildLocationTerrain(...args); }
  function releaseLocation(...args) { return locationLifecycle.releaseLocation(...args); }
  const locationStreaming = createLocationStreaming({
    neighbors: id => locations[id].exits.map(exit => exit.to).filter(Boolean), build: buildLocation, release: releaseLocation,
    schedule: callback => requestAnimationFrame(() => setTimeout(callback, 0)),
    onError: error => {
      const stackLine = String(error?.stack ?? '').split('\n').find(line => /:\d+:\d+\)?$/.test(line.trim()))?.trim();
      reportLoadStage('Подготовка соседней локации', 'error', `${error.message || error}${stackLine ? ` · ${stackLine}` : ''}`);
      console.error('Не удалось подготовить соседнюю локацию', error);
    },
  });

  function refreshLocationInfo() {
    const previousTitle = locationTitle.textContent;
    locationTitle.textContent = activeLocation.title;
    locationInfoButton.setAttribute('aria-label', `${activeLocation.title}. Открыть карту локаций`);
    if (previousTitle && previousTitle !== locationTitle.textContent) indicateUIChange(locationTitle, 'location');
  }
  function rebuildBodies() {
    bodies = [heroBody, ...activeLocation.obstacles.filter(body => body.active !== false),
      ...activeLocation.enemies.filter(body => body.spawnReady && body.active !== false && !body.burrowed)];
  }
  rebuildBodies();
  function showActiveLocationFigures() {
    for (const figure of figures) {
      const active = figure.body === heroBody || figure.locationId === activeLocation.id;
      const spawning = Boolean(figure.spawnAnimation);
      figure.group.visible = !figure.poolDormant && figure.body.active !== false && !figure.body.fell
        && active && (!spawning || figure.spawnAnimation.age >= 0);
      figure.healthHUD.visible = active && figure.body.active !== false
        && shouldShowHealthHud(figure.body.team, figure.body.health, figure.body.maxHealth) && !spawning;
      if (figure.enemyMarker) figure.enemyMarker.group.visible = active && figure.body.active !== false && !victorySequenceActive
        && figure.body.health > 0 && !spawning;
    }
    for (const [id, group] of Object.entries(locationGroups)) group.visible = id === activeLocation.id;
  }
  function startUnitVictory(figure) {
    if (figure.body.health <= 0) return;
    figure.body.spawnReady = true;
    figure.body.vx = 0; figure.body.vz = 0;
    figure.body.aiPhase = 'victory';
    figure.spawnAnimation = null;
    figure.group.position.set(figure.body.x, 0, figure.body.z);
    figure.victoryAnimation = createVictoryLoop();
    figure.victoryBaseYaw = figure.group.rotation.y;
    figure.group.visible = figure.body === heroBody || figure.locationId === activeLocation.id;
    figure.healthHUD.visible = figure.group.visible && shouldShowHealthHud(figure.body.team, figure.body.health, figure.body.maxHealth);
    if (figure.enemyMarker) figure.enemyMarker.group.visible = false;
  }
  function hasDeathCheckpoint() {
    return campaignSaves.hasDeathCheckpoint(restoreCampaignCheckpointAfterDeath);
  }
  function openDeathScreen() {
    if (!deathScreen) return;
    for (const image of deathScreen.querySelectorAll('img[data-src]')) {
      image.src = image.dataset.src; delete image.dataset.src;
    }
    deathScreenOpen = true;
    deathScreen.dataset.uiAnchor ??= 'center';
    void showUIWindow(deathScreen);
    void hideUIWindow(deathAdOverlay);
    deathReviveButton.disabled = false;
    const canReturn = hasDeathCheckpoint();
    deathCheckpointButton.disabled = !canReturn;
    deathCheckpointNote.textContent = canReturn ? 'Загрузка снимка перед входом в эту локацию.'
      : 'Сохранения перед этой локацией нет.';
    deathCheckpointButton.focus({ preventScroll: true });
  }
  function reviveFromDeath() {
    if (!deathScreenOpen || !deathResumeSnapshot) return;
    const previousHealth = heroBody.health;
    const restored = restoreDeathResumeSnapshot(deathResumeSnapshot, {
      campaignState, figures, heroBody, health: heroBody.maxHealth,
    });
    if (!restored) return;
    victorySequenceActive = false;
    deathScreenOpen = false;
    void hideUIWindow(deathScreen);
    void hideUIWindow(deathAdOverlay);
    deathResumeSnapshot = null;
    noteHealthRestoration(heroFigure, previousHealth, heroBody.health);
    inputController?.cancel(); selected = false;
    for (const figure of restored.figures) {
      if (figure === heroFigure) setVisualState(figure, 'idle');
      else setVisualState(figure, figure.visualState || 'idle');
      syncFigureDamageStage(figure);
    }
    heroBody.x = heroBody.lastSafePosition.x;
    heroBody.z = heroBody.lastSafePosition.z;
    heroBody.vx = 0; heroBody.vz = 0; heroBody.active = true; heroBody.fell = false;
    heroBody.hitCooldown = Math.max(heroBody.hitCooldown || 0, .9);
    heroFigure.group.position.set(heroBody.x, 0, heroBody.z);
    playerMarker.group.visible = true;
    playerMarker.group.position.set(heroBody.x, GROUND_UI_Y, heroBody.z);
    showActiveLocationFigures(); rebuildBodies();
    refreshLocationInfo(); renderStatusEffectsHud(); renderInventory(); persistCampaign();
  }
  function cancelDeathAd() {
    if (deathAdTimer !== null) clearInterval(deathAdTimer);
    deathAdTimer = null;
    deathReviveButton.disabled = false;
    void hideUIWindow(deathAdOverlay);
    deathReviveButton.focus({ preventScroll: true });
  }
  function beginDeathAd() {
    if (!deathScreenOpen || deathAdTimer !== null) return;
    deathReviveButton.disabled = true;
    deathAdOverlay.dataset.uiAnchor ??= 'center';
    void showUIWindow(deathAdOverlay);
    const finishesAt = performance.now() + 3000;
    const updateCountdown = () => {
      const remaining = Math.max(0, finishesAt - performance.now());
      const previousCount = deathAdCountdown.textContent;
      deathAdCountdown.textContent = String(Math.ceil(remaining / 1000));
      if (previousCount !== deathAdCountdown.textContent) indicateUIChange(deathAdCountdown, 'countdown');
      if (remaining > 0) return;
      clearInterval(deathAdTimer); deathAdTimer = null;
      reviveFromDeath();
    };
    updateCountdown();
    deathAdTimer = setInterval(updateCountdown, 80);
  }
  deathCheckpointButton?.addEventListener('click', () => {
    if (!deathScreenOpen || !hasDeathCheckpoint()) return;
    location.reload();
  });
  deathReviveButton?.addEventListener('click', beginDeathAd);
  deathAdCancel?.addEventListener('click', cancelDeathAd);
  function beginVictorySequence() {
    if (victorySequenceActive) return;
    if (heroBody.health <= 0) deathResumeSnapshot = captureDeathResumeSnapshot({
      campaignState, activeLocationId: activeLocation.id, heroBody, figures,
    });
    victorySequenceActive = true;
    audio.play('defeat');
    inputController.cancel(); selected = false;
    playerMarker.group.visible = false;
    heroBody.vx = 0; heroBody.vz = 0;
    for (const location of Object.values(locations)) settleEnemiesForVictory(location.enemies);
    for (const figure of figures) startUnitVictory(figure);
    rebuildBodies();
    if (heroBody.health <= 0) openDeathScreen();
  }
  function beginSpawn(figure, from) {
    const origin = resolveSpawnOrigin(from, figure?.body);
    if (origin.usedFallback) reportLoadStage(`Точка появления: ${figure?.body?.id ?? 'неизвестный враг'}`, 'warning',
      `источник ${JSON.stringify(from)}; продолжение с позиции юнита (${origin.x}, ${origin.z})`);
    figure.spawnSource = { x: origin.x, z: origin.z };
    figure.spawnAnimation = { age: 0, duration: .78, fromX: origin.x, fromZ: origin.z };
    const isCurrentLocation = activeLocation.id === figure.locationId;
    figure.group.visible = isCurrentLocation;
    figure.healthHUD.visible = false;
    if (figure.enemyMarker) figure.enemyMarker.group.visible = false;
  }
  async function spawnSpawnerUnit(location, spawner, ordinal, requestState) {
    const settings = normalizeEnemySpawner(spawner.userData.sceneSpawner);
    if (settings.archetype === 'ogre' || settings.archetype === 'ogre-boss') await ensureRockEffectAssets();
    const id = spawner.userData.sceneSpawnerUnitIds?.[ordinal - 1] ?? `${spawner.userData.sceneEditId}:unit:${ordinal}`;
    const angle = ordinal * 2.399963229728653, radius = ordinal === 1 ? 0 : .45 + .16 * Math.sqrt(ordinal);
    const x = spawner.position.x + Math.cos(angle) * radius, z = spawner.position.z + Math.sin(angle) * radius;
    const definition = ASSET_CATALOG.find(item => item.archetype === settings.archetype);
    const stats = ENEMY_STATS[settings.archetype] ?? { health: 32, maxHealth: 32, damageQuarters: 4, radius: .62 };
    const body = enemyBody(id, location.id, x, z, { ...stats, freshSpawn: true, combatAwake: location.id === 'forest'
      ? Boolean(location.combatTriggered) : true, archetype: settings.archetype, spawnReady: !settings.spawnAnimation });
    body.spawnerId = spawner.userData.sceneEditId;
    body.lastSafePosition = { x: body.x, z: body.z };
    if (definition?.customSprite) body.spriteAsset = definition.asset;
    const figure = await createFigure(body, settings.archetype, { deferAttach: true });
    if (!isEnemySpawnerRequestCurrent(spawner.userData.sceneSpawnerState, requestState, spawner.userData.sceneEditDeleted)
      || !location.runtimeReady || !location.sceneGroup || !location.spawners?.includes(spawner)) {
      if (spawner.userData.sceneSpawnerState === requestState)
        requestState.spawned = Math.max(0, requestState.spawned - 1);
      return null;
    }
    createFigure.attach(figure);
    figure.locationId = location.id; figure.group.name = id; figure.group.position.set(x, 0, z);
    location.enemies.push(body);
    location.sceneGroup.add(figure.group); registerFigure(figure);
    figure.group.visible = location === activeLocation;
    figure.healthHUD.visible = figure.group.visible && shouldShowHealthHud(body.team, body.health, body.maxHealth);
    figure.enemyMarker.group.visible = false;
    if (settings.spawnAnimation) beginSpawn(figure, { x: spawner.position.x, z: spawner.position.z });
    else { body.spawnReady = true; figure.group.position.set(x, 0, z); figure.enemyMarker.group.visible = figure.group.visible; rebuildBodies(); }
    if (location === activeLocation) { rebuildBodies(); persistCampaign(); }
    return figure;
  }
  function updateEnemySpawners(location, dt = 0) {
    if (!location?.runtimeReady || !Array.isArray(location.spawners)) return;
    for (const spawner of location.spawners) {
      const settings = spawner.userData.sceneSpawner;
      if (!settings || spawner.userData.sceneEditDeleted) continue;
      const state = spawner.userData.sceneSpawnerState ??= { spawned: 0, timer: 0, pending: 0 };
      const alive = location.enemies.filter(enemy => enemy.spawnerId === spawner.userData.sceneEditId
        && enemy.active !== false && enemy.health > 0).length;
      const step = advanceEnemySpawner(state, settings, alive + (state.pending ?? 0), dt);
      Object.assign(state, step.state);
      if (!step.spawn) continue;
      state.pending = (state.pending ?? 0) + 1;
      void spawnSpawnerUnit(location, spawner, state.spawned, state).catch(error => {
        if (spawner.userData.sceneSpawnerState === state) state.spawned = Math.max(0, state.spawned - 1);
        console.error('Не удалось создать врага из спавнера', error);
      }).finally(() => { state.pending = Math.max(0, (state.pending ?? 1) - 1); });
    }
  }
  function resetCampaignEncountersForNewDay() {
    for (const location of Object.values(locations)) {
      const saved = resetEncounterSnapshot(snapshotLocation(location), { camp: location.id === 'camp' });
      campaignState.world[location.id] = saved;
      location.enemies.length = 0;
      location.defeats = 0;
      if (location.id === 'camp') {
        location.goblinsSpawned = 0; location.reinforcementQueue = []; location.bossSpawned = false;
        location.initialized = false; location.combatTriggered = false;
      }
      location.spawnerStates = Object.fromEntries(Object.keys(saved.spawners ?? {}).map(id => [id, { spawned: 0, timer: 0 }]));
      for (const spawner of location.spawners ?? []) {
        const reset = { spawned: 0, timer: 0, pending: 0 };
        spawner.userData.sceneSpawnerState = reset;
        location.spawnerStates[spawner.userData.sceneEditId] = reset;
      }
      if (location.id === 'camp') { campGoblinPool.length = 0; campOgrePool = null; }
      for (let index = figures.length - 1; index >= 0; index--) {
        const figure = figures[index];
        if (figure === heroFigure || figure.locationId !== location.id) continue;
        figure.group.visible = false; figure.healthHUD.visible = false; figure.enemyMarker.group.visible = false;
        figure.group.removeFromParent(); figure.healthHUD.removeFromParent(); figure.enemyMarker.group.removeFromParent();
        figure.sceneAttached = false;
        figure.poolDormant = true;
        if (location.id === 'camp' && figure.body.id.startsWith('camp-goblin-')) campGoblinPool.push(figure);
        if (location.id === 'camp' && figure.body.boss) campOgrePool = figure;
        figures.splice(index, 1);
      }
    }
    clearProjectiles(); clearAllEarthShatter();
    showActiveLocationFigures(); rebuildBodies();
    updateEnemySpawners(activeLocation, 0);
    refreshLocationInfo(); persistCampaign(); renderDayClock();
  }
  async function spawnCampGoblin(source = null, boss = false, forcedId = null) {
    await preloadCampEnemies();
    if (boss) await preloadCampOgre();
    const figure = boss ? campOgrePool : campGoblinPool.pop();
    if (!figure) return null;
    const spawn = source ?? campSpawnPoints[Math.floor(Math.random() * campSpawnPoints.length)];
    if (boss) campOgrePool = null;
    const body = enemyBody(boss ? 'camp-ogre' : (forcedId ?? `camp-goblin-${locations.camp.goblinsSpawned + 1}`),
      'camp', spawn.x, spawn.z, boss
        ? { health: OGRE_SETTINGS.health, maxHealth: OGRE_SETTINGS.health, freshSpawn: true, combatAwake: true, spawnReady: false, boss: true,
          archetype: 'ogre-boss', radius: PUCK_RADIUS * 1.5 }
        : { freshSpawn: true, combatAwake: true, spawnReady: false });
    body.aiPhase = 'pause'; body.aiTimer = randomBetween(.4, 1.2);
    figure.body = body; figure.group.userData.figure = figure; figure.poolDormant = false;
    createFigure.attach(figure);
    if (!figures.includes(figure)) registerFigure(figure);
    figure.spawnAnimation = null; figure.victoryAnimation = null; figure.bossScale = boss ? 1.5 : 1;
    figure.hitAge = 10; figure.hitStrength = 0; figure.hurtAge = 10; figure.dealDamageAge = 10;
    figure.viewBack = false; syncFigureDamageStage(figure); setVisualState(figure, 'idle');
    locations.camp.enemies.push(body);
    figure.locationId = 'camp';
    if (boss) {
      figure.bossScale = 1.5;
      figure.puck.scale.set(1.5, 1, 1.5);
      figure.spawnSource = { x: 0, z: scaled(-6.1) };
    } else figure.spawnSource = { x: spawn.hutX, z: spawn.hutZ };
    beginSpawn(figure, figure.spawnSource);
    if (victorySequenceActive) startUnitVictory(figure);
    if (activeLocation.id === 'camp') refreshLocationInfo();
    return figure;
  }
  function enterLocation(...args) { return locationLifecycle.enterLocation(...args); }
  function startQueuedReinforcement() {
    const camp = locations.camp;
    const finish = spawned => {
      finishCampReinforcement(camp, elapsed, spawned);
      if (activeLocation.id === camp.id) refreshLocationInfo();
    };
    spawnCampGoblin().then(figure => finish(Boolean(figure))).catch(error => {
      finish(false);
      console.error('Не удалось создать гоблина лагеря', error);
    });
  }
  function spawnCampBoss() {
    spawnCampGoblin({ x: 0, z: scaled(-4.2), hutX: 0, hutZ: scaled(-7.4) }, true)
      .catch(error => console.error('Не удалось создать огра', error));
  }
  const bursts = [];
  const projectiles = [];
  const acidPuddles = [];
  const acidPuddleGeometry = new THREE.CircleGeometry(.82, 28);
  const stoneGeometry = new THREE.IcosahedronGeometry(.17, 0);
  const stoneMaterial = new THREE.MeshStandardMaterial({ color: 0xb6ac91, roughness: .86 });
  function clearProjectiles() {
    for (const shot of projectiles) { scene.remove(shot.mesh); shot.ownMaterial?.dispose(); }
    projectiles.length = 0;
    for (const puddle of acidPuddles) { scene.remove(puddle.mesh); puddle.material.dispose(); }
    acidPuddles.length = 0;
    for (const enemyId of abilityTelegraphs.keys()) clearAbilityTelegraph(enemyId);
  }
  function spawnStoneProjectile(shot) {
    if (projectiles.length >= 16) return;
    const isAcid = shot.sourceArchetype === 'acid-spitter';
    const material = isAcid ? new THREE.MeshStandardMaterial({ color: 0x9dcf46, emissive: 0x33440b,
      roughness: .38, metalness: 0 }) : stoneMaterial;
    const mesh = new THREE.Mesh(stoneGeometry, material);
    if (isAcid) mesh.scale.set(1.22, .85, 1.22);
    mesh.position.set(shot.x, .58, shot.z); mesh.castShadow = true; scene.add(mesh);
    projectiles.push({ ...shot, mesh, ownMaterial: isAcid ? material : null });
  }
  function updateProjectiles(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const shot = projectiles[i];
      const friendlyFireTargets = shot.sourceArchetype === 'slinger' ? activeLocation.enemies : [];
      const result = advanceStoneProjectile(shot, dt, heroBody, activeLocation.obstacles, friendlyFireTargets);
      shot.mesh.position.set(shot.x, .55 + Math.sin(Math.min(1, shot.age / shot.lifetime) * Math.PI) * .4, shot.z);
      shot.mesh.rotation.x += dt * 7;
      if (result.hitPlayer && damage(heroBody, shot.damageQuarters, 8)) {
        heroBody.vx += shot.vx * .24; heroBody.vz += shot.vz * .24;
        const effect = projectileStatusEffect(shot, heroBody);
        if (effect) {
          applyStatusEffect(campaignState, effect);
          renderStatusEffectsHud(); persistCampaign();
        }
        burst(heroBody.x, heroBody.z, .6); vibrate([35, 20, 35]);
      }
      if (result.hitEnemy && damage(result.hitEnemy, shot.damageQuarters, 8)) {
        result.hitEnemy.vx += shot.vx * .24; result.hitEnemy.vz += shot.vz * .24;
        const effect = projectileStatusEffect(shot, result.hitEnemy);
        if (effect) applyStatusEffect(result.hitEnemy, effect);
        burst(result.hitEnemy.x, result.hitEnemy.z, .6);
      }
      if (result.hitObstacle?.kind === 'cardboard-prop') damageCardboardProp(result.hitObstacle, shot.damageQuarters, shot);
      if (result.expired) {
        if (shot.sourceArchetype === 'acid-spitter' && !result.hitPlayer) {
          const material = new THREE.MeshBasicMaterial({ color: 0x9dcf46, transparent: true,
            opacity: .2, side: THREE.DoubleSide, depthWrite: false });
          const mesh = new THREE.Mesh(acidPuddleGeometry, material);
          mesh.rotation.x = -Math.PI / 2; mesh.position.set(shot.x, .025, shot.z); mesh.renderOrder = 7;
          scene.add(mesh); acidPuddles.push({ x: shot.x, z: shot.z, mesh, material, age: 0, duration: 2.6, touched: false });
        }
        scene.remove(shot.mesh); shot.ownMaterial?.dispose(); projectiles.splice(i, 1);
      }
    }
  }
  function updateAcidPuddles(dt) {
    for (let index = acidPuddles.length - 1; index >= 0; index--) {
      const puddle = acidPuddles[index]; puddle.age += dt;
      const remaining = Math.max(0, 1 - puddle.age / puddle.duration);
      puddle.material.opacity = .2 * remaining;
      if (!puddle.touched && Math.hypot(heroBody.x - puddle.x, heroBody.z - puddle.z) < .95) {
        puddle.touched = true;
        applyStatusEffect(campaignState, 'poison'); renderStatusEffectsHud(); persistCampaign();
      }
      if (puddle.age >= puddle.duration) {
        scene.remove(puddle.mesh); puddle.material.dispose(); acidPuddles.splice(index, 1);
      }
    }
  }
  const abilityTelegraphs = new Map();
  const earthShatterWarnings = new Map();
  const earthShatterWaves = [];
  const earthShatterRocks = [];
  function clearEarthShatterWarning(enemyId) {
    const warning = earthShatterWarnings.get(enemyId);
    if (!warning) return;
    warning.dispose(); earthShatterWarnings.delete(enemyId);
  }
  function removeEarthShatterRock(rock) {
    rock.body.active = false;
    rock.visual.dispose();
    activeLocation.obstacles = activeLocation.obstacles.filter(body => body !== rock.body);
    const index = earthShatterRocks.indexOf(rock);
    if (index >= 0) earthShatterRocks.splice(index, 1);
    rebuildBodies();
  }
  function clearEarthShatterForBoss(enemyId) {
    const body = activeLocation.enemies.find(enemy => enemy.id === enemyId);
    if (body) { body.bossWaveLeap = null; body.bossLeapHeight = 0; body.bossLeapAttack = null; }
    clearEarthShatterWarning(enemyId);
    for (const rock of [...earthShatterRocks]) if (rock.ownerId === enemyId) removeEarthShatterRock(rock);
    for (let index = earthShatterWaves.length - 1; index >= 0; index--)
      if (earthShatterWaves[index].ownerId === enemyId) earthShatterWaves.splice(index, 1);
    rebuildBodies();
  }
  function clearAllEarthShatter() {
    for (const body of activeLocation.enemies) if (['earth-slam-windup', 'earth-windup'].includes(body.aiPhase)) {
      body.aiPhase = 'pause'; body.aiTimer = 1.2; body.pendingGroundSlam = null;
      body.bossWaveLeap = null; body.bossLeapHeight = 0; body.bossLeapAttack = null; body.pendingEarthShatterPositions = null;
    }
    for (const id of [...earthShatterWarnings.keys()]) clearEarthShatterWarning(id);
    for (const rock of [...earthShatterRocks]) removeEarthShatterRock(rock);
    earthShatterWaves.length = 0;
    rebuildBodies();
  }
  function showEarthShatterWarning(enemy, positions, duration) {
    clearEarthShatterWarning(enemy.id);
    earthShatterWarnings.set(enemy.id, createEarthShatterWarning(THREE, scene, positions, duration));
  }
  function applyEarthShatterDecision(body, figure, decision) {
    if (decision.earthShatterCancelled) clearEarthShatterWarning(body.id);
    if (decision.earthShatterWarning) showEarthShatterWarning(body, decision.earthShatterWarning, decision.duration);
    if (decision.groundSlamWarning) {
      clearEarthShatterWarning(body.id);
      earthShatterWarnings.set(body.id, createGroundSlamWarning(THREE, scene, decision.groundSlamWarning,
        () => {
          decision.groundSlamWarning.x = body.x; decision.groundSlamWarning.z = body.z;
          return groundSlamProgress(body.aiTimer);
        }));
    }
    if (!decision.earthShatterSlam) return;
    clearEarthShatterWarning(body.id);
    if (figure) figure.earthShatterAttackAge = 0;
    if (decision.groundSlamImpact) {
      for (const actor of [heroBody, ...activeLocation.enemies]) {
        if (actor.id === body.id || actor.active === false || actor.fell || actor.health <= 0
            || !groundSlamContains(decision.groundSlamImpact, actor)) continue;
        if (damage(actor, OGRE_SETTINGS.rockDamage, 8)) {
          actor.vx = actor.vz = 0;
          actor.earthShatterKnockback = createGroundSlamKnockback(actor, decision.groundSlamImpact);
        }
      }
    }
    earthShatterWaves.push(createEarthShatterWave(decision.earthShatterSlam, body.id));
    burst(body.x, body.z, .95); audio.play('impact', { strength: .95, pan: (body.x - heroBody.x) / 15 });
  }
  function spawnEarthShatterRock(position, ownerId) {
    const body = { id: `earth-shatter:${ownerId}:${Math.random().toString(36).slice(2, 8)}`,
      kind: 'earth-shatter-rock', team: 'neutral', locationId: activeLocation.id,
      x: position.x, z: position.z, vx: 0, vz: 0, radius: .47, fixed: true, active: true, ownerId };
    const visual = createEarthShatterVisual(THREE, scene, position, sceneStencil, rockEffectAssets);
    const rock = { body, visual, ownerId, age: 0,
      forwardX: position.forwardX ?? 0, forwardZ: position.forwardZ ?? 1 };
    activeLocation.obstacles.push(body); earthShatterRocks.push(rock);
    rebuildBodies();
  }
  function updateEarthShatter(dt) {
    for (const [id, warning] of earthShatterWarnings) if (warning.update(dt)) clearEarthShatterWarning(id);
    for (let index = earthShatterWaves.length - 1; index >= 0; index--) {
      const wave = earthShatterWaves[index];
      const result = advanceEarthShatterWave(wave, dt);
      for (const position of result.spawned) spawnEarthShatterRock(position, wave.ownerId);
      if (result.complete) earthShatterWaves.splice(index, 1);
    }
    let bodiesChanged = false;
    for (const rock of [...earthShatterRocks]) {
      rock.age += dt;
      const wasBroken = rock.visual.broken;
      const finished = rock.visual.update(dt);
      if (!wasBroken && rock.visual.broken && rock.body.active !== false) {
        rock.body.active = false;
        activeLocation.obstacles = activeLocation.obstacles.filter(body => body !== rock.body);
        bodiesChanged = true;
      }
      if (finished) removeEarthShatterRock(rock);
    }
    if (bodiesChanged) rebuildBodies();
  }
  function breakEarthShatterRockOnActor(rock, actor, tieBreak = 0) {
    if (!rock || rock.visual.broken || actor.id === rock.ownerId && !bossCanShatterOwnRock(rock, actor)
      || (actor.team !== 'player' && actor.team !== 'enemy') || actor.active === false || actor.fell) return false;
    if (actor.id !== rock.ownerId && actor.health > 0 && earthShatterRockCanDamage(rock.age)) damage(actor, OGRE_SETTINGS.rockDamage, 8);
    if (actor.id !== rock.ownerId && earthShatterRockCanDamage(rock.age)) {
      actor.vx = 0; actor.vz = 0;
      actor.earthShatterKnockback = createEarthShatterKnockback(actor,
        rock.body.x, rock.body.z, rock.forwardX, rock.forwardZ, tieBreak);
    }
    rock.visual.shatter(); rock.body.active = false;
    activeLocation.obstacles = activeLocation.obstacles.filter(body => body !== rock.body);
    return true;
  }
  function checkEarthShatterContacts() {
    let bodiesChanged = false;
    const actors = [heroBody, ...activeLocation.enemies];
    let tieBreak = 0;
    for (const rock of [...earthShatterRocks]) {
      if (rock.visual.broken || rock.body.active === false) continue;
      const actor = actors.find(body => (body.id !== rock.ownerId || bossCanShatterOwnRock(rock, body))
        && (body.team !== 'player' || body.health > 0)
        && body.active !== false && !body.fell
        && Math.hypot(body.x - rock.body.x, body.z - rock.body.z) < (body.radius ?? PUCK_RADIUS) + rock.body.radius + .025);
      if (!actor) continue;
      if (breakEarthShatterRockOnActor(rock, actor, tieBreak++)) bodiesChanged = true;
    }
    if (bodiesChanged) rebuildBodies();
  }
  function clearAbilityTelegraph(enemyId) {
    const marker = abilityTelegraphs.get(enemyId);
    if (!marker) return;
    scene.remove(marker.group); marker.material.dispose(); marker.geometry.dispose(); abilityTelegraphs.delete(enemyId);
  }
  function showAbilityTelegraph(enemy, zone, duration) {
    clearAbilityTelegraph(enemy.id);
    const geometry = new THREE.RingGeometry(0, zone.radius, 40);
    resizeRingGeometry(geometry,zone.radius);
    const material = new THREE.MeshBasicMaterial({ color: 0x9e58d0, transparent: true, opacity: .32,
      side: THREE.DoubleSide, depthWrite: false });
    const ring = new THREE.Mesh(geometry, material);
    ring.rotation.x = -Math.PI / 2; ring.position.set(zone.x, .035, zone.z);
    ring.renderOrder = 8;
    const group = new THREE.Group(); group.add(ring); scene.add(group);
    abilityTelegraphs.set(enemy.id, { group, material, geometry, age: 0, duration, radius: zone.radius, ring });
  }
  function updateAbilityTelegraphs(dt) {
    for (const marker of abilityTelegraphs.values()) {
      marker.age = Math.min(marker.duration, marker.age + dt);
      const progress = marker.age / marker.duration;
      resizeRingGeometry(marker.geometry,marker.radius * (.58 + progress * .42));
      marker.material.opacity = .24 + progress * .48;
    }
  }
  const dustGeometry = new THREE.SphereGeometry(.045, 5, 4);
  const selectedColor = new THREE.Color(0x65d536);
  const unavailableAimColor = new THREE.Color(0x9299a2);
  const enemyColor = new THREE.Color(0xdf3830);
  const attackColor = new THREE.Color(0xffffff);
  function burst(x, z, strength = 1) {
    if (bursts.length >= 12) return;
    const group = new THREE.Group();
    group.position.set(x, .035, z); scene.add(group);
    const material = new THREE.MeshBasicMaterial({ color: 0xfff6dc, transparent: true, side: THREE.DoubleSide, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(.04, .11, 40), material);
    ring.rotation.x = -Math.PI / 2; group.add(ring);
    const dots = Array.from({ length: 6 }, () => {
      const dot = new THREE.Mesh(dustGeometry, material); group.add(dot); return dot;
    });
    bursts.push({ group, ring, dots, material, age: 0, strength });
  }
  function spawnWorldLoot(...args) { return worldItemsController.spawnWorldLoot(...args); }
  function findInventoryDropPosition(...args) { return worldItemsController.findInventoryDropPosition(...args); }
  function dropInventoryItem(...args) { return worldItemsController.dropInventoryItem(...args); }
  function openCache(...args) { return worldItemsController.openCache(...args); }
  function updateWorldLoot(...args) { return worldItemsController.updateWorldLoot(...args); }
  function updateItemIconFlights(dt) {
    if (!itemIconFlights.length) {
      if (itemFlightCanvasHasPixels) itemFlightContext.clearRect(0, 0, innerWidth, innerHeight);
      itemFlightCanvasHasPixels = false;
      return;
    }
    itemFlightCanvasHasPixels = true;
    itemFlightContext.clearRect(0, 0, innerWidth, innerHeight);
    const targetButton = document.querySelector('#inventory-toggle');
    const rect = targetButton.getBoundingClientRect();
    for (let index = itemIconFlights.length - 1; index >= 0; index--) {
      const entry = itemIconFlights[index], flight = entry.flight;
      flight.age += dt;
      const progress = Math.min(1, flight.age / flight.duration);
      flight.to = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      const point = itemIconFlightPosition(flight, progress);
      const size = 34 * point.scale;
      itemFlightContext.save(); itemFlightContext.globalAlpha = point.alpha;
      itemFlightContext.translate(point.x, point.y); itemFlightContext.rotate(point.rotation);
      itemFlightContext.shadowColor = '#ffd477'; itemFlightContext.shadowBlur = 12;
      itemFlightContext.drawImage(entry.icon, -size / 2, -size / 2, size, size);
      itemFlightContext.restore();
      if (progress >= 1) {
        itemIconFlights.splice(index, 1);
        targetButton.animate([
          { transform: 'scale(1,1)' }, { transform: 'scale(1.18,.82)', offset: .3 },
          { transform: 'scale(.92,1.12)', offset: .58 }, { transform: 'scale(1.04,.97)', offset: .78 }, { transform: 'scale(1,1)' },
        ], { duration: 280, easing: 'cubic-bezier(.2,.75,.25,1)' });
      }
    }
  }
  function updateCacheAnimation(...args) { return worldItemsController.updateCacheAnimation(...args); }
  function showCacheStoryAfterLootLands(...args) { return worldItemsController.showCacheStoryAfterLootLands(...args); }
  function damage(...args) { return combatController.damage(...args); }
  function damageCardboardProp(...args) { return combatController.damageCardboardProp(...args); }
  function updateCardboardFalls(...args) { return combatController.updateCardboardFalls(...args); }
  let lastVibration = 0;
  function vibrate(pattern) {
    const now = performance.now();
    if (now - lastVibration < 100) return;
    lastVibration = now;
    navigator.vibrate?.(pattern);
  }
  function recoverPlayerFromFall(...args) { return combatController.recoverPlayerFromFall(...args); }
  function onImpact(...args) { return combatController.onImpact(...args); }
  function createVectorMarker(color, fillColor, showProgress, showOverlap = false) {
    return makeVectorMarker(THREE,color,fillColor,showProgress,showOverlap,MAX_AIM_MARKER_EXTENSION);
  }
  const playerMarker = createVectorMarker(0x65d536, 0xd8ff91, false, true);
  playerMarker.group.position.y = GROUND_UI_Y;
  scene.add(playerMarker.group);

  const raycaster = new THREE.Raycaster();
  const enemyOcclusionTaggedProps = new WeakSet();
  function setEnemyOcclusionGhost(figure, visible) {
    const ghost = figure.enemyOcclusionGhost;
    if (!ghost) return;
    const selectedState = figure.visualState;
    ghost.root.visible = visible;
    for (const [name, state] of Object.entries(ghost.states)) {
      const show = visible && name === selectedState;
      state.group.visible = show;
      if (!show) continue;
      const source = figure.artStates[name].group;
      state.group.position.copy(source.position);
      state.group.rotation.copy(source.rotation);
      state.group.scale.copy(source.scale);
      state.frontArt.group.visible = !figure.viewBack;
      state.backArt.group.visible = figure.viewBack;
    }
  }
  function updateEnemyOcclusionSilhouettes() {
    const enemyFigures = figures.filter(figure => figure.enemyOcclusionGhost);
    if (!enemyFigures.length) return;
    for (const { prop } of sceneryFacePairs) {
      if (!prop || enemyOcclusionTaggedProps.has(prop)) continue;
      prop.traverse(object => {
        if (!object.isMesh) return;
        for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
          if (material?.stencilWrite) applyCardboardOcclusionStencil(material, THREE, !prop.userData.disableEnemySilhouette);
        }
      });
      enemyOcclusionTaggedProps.add(prop);
    }
    const canReveal = !sceneEditor.active && !deathScreenOpen && Boolean(activeLocation.sceneGroup);
    for (const figure of enemyFigures) {
      const body = figure.body;
      const valid = canReveal && figure.locationId === activeLocation.id && figure.group.visible
        && body.active !== false && body.spawnReady !== false && body.health > 0 && !body.fell && !body.burrowed;
      setEnemyOcclusionGhost(figure, valid);
    }
  }
  const figureHitPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -.12);
  function rayAt(x, y) {
    raycaster.setFromCamera(new THREE.Vector2(x / innerWidth * 2 - 1, 1 - y / innerHeight * 2), camera);
  }
  function hitFigure(x, y) {
    rayAt(x, y);
    const visibleFigures = figures.filter(figure => figure.body === heroBody || figure.locationId === activeLocation.id);
    const findPrintedHit = candidates => {
      for (const hit of raycaster.intersectObjects(candidates.map(figure => figure.group), true)) {
        let root = hit.object;
        while (root && !root.userData.figure) root = root.parent;
        const figure = root?.userData.figure;
        if (!figure) continue;
        if (hit.object.userData.sideWall || !hit.object.userData.print || !hit.uv) return figure;
        const px = Math.min(figure.width - 1, Math.max(0, Math.floor(hit.uv.x * figure.width)));
        const py = Math.min(figure.height - 1, Math.max(0, Math.floor((1 - hit.uv.y) * figure.height)));
        if (figure.alphaPixels[(py * figure.width + px) * 4 + 3] > 100) return figure;
      }
      return null;
    };
    const player = visibleFigures.find(figure => figure.body === heroBody);
    if (player) {
      raycaster.layers.set(PLAYER_PICK_LAYER);
      const playerHit = findPrintedHit([player]);
      if (playerHit) return playerHit;
    }
    const groundPoint = raycaster.ray.intersectPlane(figureHitPlane, new THREE.Vector3());
    const playerPickRadius = (PUCK_RADIUS + .08) * 2;
    if (player && groundPoint && Math.hypot(groundPoint.x - player.body.x, groundPoint.z - player.body.z) < playerPickRadius) {
      return player;
    }
    if (!groundPoint) return null;
    let closest = null, closestDistance = (PUCK_RADIUS + .08) ** 2;
    const enemies = visibleFigures.filter(figure => figure.body.team === 'enemy');
    raycaster.layers.set(ENEMY_PICK_LAYER);
    const enemyHit = findPrintedHit(enemies);
    if (enemyHit) return enemyHit;
    for (const figure of enemies) {
      const dx = groundPoint.x - figure.body.x, dz = groundPoint.z - figure.body.z;
      const distanceSquared = dx * dx + dz * dz;
      if (distanceSquared < closestDistance) { closest = figure; closestDistance = distanceSquared; }
    }
    return closest;
  }
  function choose(figure) {
    if (victorySequenceActive || !figure || figure.body.health <= 0 || figure.body.team !== 'player') return;
    if (figure === heroFigure) figure.victoryAnimation = null;
    if (figure !== activeFigure) {
      activeFigure = figure; state = figure.body;
      selectionAge = 0;
      playerMarker.setSizeScale(.001);
    }
    selected = true;
    playerMarker.group.visible = true;
  }
  function stopAim() {
    playerMarker.setExtension(0);
    host.classList.remove('aiming');
  }
  inputController = createPointerInput({ THREE, host, inputElement: renderer.domElement, camera, orbit, playerMarker,
    isBlocked: () => getApplicationMode().blocksInput,
    onManualOrbit: () => { cameraManualOverride = 3; },
    onHover(figure) { for (const outline of heroFigure.hoverOutlineMeshes) outline.visible = figure === heroFigure; },
    getBody: () => state, getActiveFigure: () => activeFigure, hitFigure, choose, stopAim,
    groundUiY: GROUND_UI_Y, aimDragSensitivity: AIM_DRAG_SENSITIVITY,
    maxAimMarkerExtension: MAX_AIM_MARKER_EXTENSION,
    onLaunch(body, pull) {
      audio.play('dash');
      if (body === heroBody) cameraManualOverride = 0;
      if (body === heroBody) heroFigure.victoryAnimation = null;
      spendCharge(body); body.attackRicochets = 0;
      const isPlayerDash = body === heroBody;
      launch(body, pull, isPlayerDash ? PLAYER_DASH_DISTANCE_MULTIPLIER : 1,
        isPlayerDash ? PLAYER_DASH_SPEED_MULTIPLIER : 1,
        isPlayerDash ? LAUNCH_GAIN * GOBLIN_DASH_MAX_POWER * 1.02 : Infinity);
      if (Math.hypot(body.vx, body.vz) > 1) burst(body.x, body.z, .55);
    },
  });

  function updateCamera(dt = 0, followMovement = false) {
    if (followMovement && dt > 0) {
      cameraManualOverride = Math.max(0, cameraManualOverride - dt);
      if (cameraManualOverride === 0 && !inputController.isOrbiting() && !inputController.isAiming()) {
        const focus = heroBody.health > 0 ? combatCenterOfMass(heroBody, activeLocation.enemies) : null;
        const focusX = focus ? focus.x - heroBody.x : 0, focusZ = focus ? focus.z - heroBody.z : 0;
        orbit.theta = focus && Math.hypot(focusX, focusZ) >= .001
          ? followDirection(orbit.theta, focusX, focusZ, dt)
          : followMotion(orbit.theta, heroBody.vx, heroBody.vz, dt);
      }
    }
    camera.position.set(target.x + orbit.distance * Math.sin(orbit.phi) * Math.sin(orbit.theta),
      target.y + orbit.distance * Math.cos(orbit.phi), target.z + orbit.distance * Math.sin(orbit.phi) * Math.cos(orbit.theta));
    camera.lookAt(target);
    camera.updateMatrixWorld();
  }
  function createStartupCinematic() {
    const points = activeLocation.walkablePoints ?? [];
    const bounds = points.reduce((box, point) => ({ minX: Math.min(box.minX, point.x), maxX: Math.max(box.maxX, point.x),
      minZ: Math.min(box.minZ, point.z), maxZ: Math.max(box.maxZ, point.z) }),
    { minX: heroBody.x - 8, maxX: heroBody.x + 8, minZ: heroBody.z - 8, maxZ: heroBody.z + 8 });
    const centerX = (bounds.minX + bounds.maxX) / 2, centerZ = (bounds.minZ + bounds.maxZ) / 2;
    const overviewFov = 52, overviewPhi = .92;
    const halfFov = THREE.MathUtils.degToRad(overviewFov / 2), fit = Math.max(.1, Math.tan(halfFov));
    const aspect = Math.max(.35, camera.aspect);
    const worldWidth = Math.max(1, bounds.maxX - bounds.minX);
    const worldDepth = Math.max(1, bounds.maxZ - bounds.minZ) * Math.cos(overviewPhi);
    const overviewDistance = Math.max(worldWidth / (2 * fit * aspect), worldDepth / (2 * fit)) * 1.22;
    const gameplayView = { target: { x: heroBody.x, y: cameraFocusHeight, z: heroBody.z }, theta: heroFigure.facing + Math.PI,
      phi: .86, distance: orbit.distance, fov: 38 };
    const arrivalDistance = Math.min(gameplayView.distance, Math.max(8.5, gameplayView.distance * .76));
    const views = {
      overview: { target: { x: centerX, y: .65, z: centerZ }, theta: 0, phi: overviewPhi, distance: overviewDistance, fov: overviewFov },
      arrival: { target: { ...gameplayView.target }, theta: heroFigure.facing, phi: .9, distance: arrivalDistance, fov: gameplayView.fov },
      gameplay: gameplayView,
    };
    const wasPaused = simulationPaused;
    simulationPaused = true;
    heroFigure.group.visible = false;
    heroFigure.healthHUD.visible = false;
    playerMarker.group.visible = false;
    camera.fov = overviewFov; camera.updateProjectionMatrix();
    target.set(centerX, .65, centerZ);
    orbit.theta = views.overview.theta; orbit.phi = views.overview.phi; orbit.distance = views.overview.distance;
    updateCamera();
    return { views, elapsed: 0, wasPaused, playerSpawned: false };
  }
  function advanceStartupCinematic(dt) {
    if (!startupCinematic) return false;
    const cinematic = startupCinematic;
    cinematic.elapsed += dt;
    const frame = sampleOpeningCinematic(cinematic.views, cinematic.elapsed);
    target.set(frame.view.target.x, frame.view.target.y, frame.view.target.z);
    orbit.theta = frame.view.theta; orbit.phi = frame.view.phi; orbit.distance = frame.view.distance;
    if (camera.fov !== frame.view.fov) { camera.fov = frame.view.fov; camera.updateProjectionMatrix(); }
    // Refresh the camera-facing sprite and HUD even while the normal game loop is paused.
    prepareScenePresentation();
    if (frame.showPlayer && !cinematic.playerSpawned) {
      cinematic.playerSpawned = true;
      heroFigure.group.visible = true;
      heroFigure.healthHUD.visible = shouldShowHealthHud(heroBody.team, heroBody.health, heroBody.maxHealth);
      playerMarker.group.visible = true;
    }
    if (frame.complete) {
      startupCinematic = null;
      simulationPaused = cinematic.wasPaused;
      showStoryCard(initialStoryCard);
    }
    return true;
  }
  function resize() {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix(); updateCamera();
    if (tiltShiftComposer) {
      tiltShiftComposer.setSize(innerWidth, innerHeight);
      const drawingBufferSize = renderer.getDrawingBufferSize(new THREE.Vector2());
      sharpSceneTarget?.setSize(Math.max(1, drawingBufferSize.x), Math.max(1, drawingBufferSize.y));
      tiltShiftPass.uniforms.resolution.value.set(innerWidth * tiltShiftPixelRatio, innerHeight * tiltShiftPixelRatio);
    }
  }
  addEventListener('resize', resize); addEventListener('resize', resizeItemFlightCanvas); resize();
  reportLoadStage(`Стриминг: подготовка текущей локации ${activeLocation.id}`);
  await locationStreaming.retain(activeLocation.id, false);
  reportLoadStage(`Стриминг: подготовка текущей локации ${activeLocation.id}`, 'ready');
  showActiveLocationFigures();
  locationArrivalCheckpoint ??= { locationId: activeLocation.id, x: heroBody.x, z: heroBody.z,
    health: heroBody.health, charges: heroBody.charges, rechargeTimer: heroBody.rechargeTimer,
    coins: campaignState.coins, inventorySlots: [...(campaignState.inventorySlots ?? [])],
    statusEffects: structuredClone(campaignState.statusEffects ?? []),
    combatTriggered: activeLocation.combatTriggered, loot: activeLocation.loot.map(item => ({ ...item })),
    defeats: activeLocation.defeats, goblinsSpawned: activeLocation.goblinsSpawned,
    bossSpawned: activeLocation.bossSpawned, initialized: activeLocation.initialized };
  updateEnemySpawners(activeLocation, 0);
  rebuildBodies();
  prepareScenePresentation();
  if (initialStoryCard) startupCinematic = createStartupCinematic();
  if (activeLocation.id === 'camp') {
    activeLocation.initialized = true;
    for (const figure of figures.filter(item => item.locationId === 'camp' && !item.poolDormant
      && !item.body.boss && item.body.health > 0 && !item.body.spawnReady)) beginSpawn(figure, figure.spawnSource);
  }
  persistCampaign();
  reportLoadStage('Подключение редактора сцены');
  if (localEditor) {
    const { installSceneEditor, installPixel7Preview } = await loadLocalEditorUi();
    sceneEditor = installSceneEditor({ THREE, scene, camera, renderer, registry: sceneRegistry, createAsset: createEditorAsset,
      applyToSource: diff => localEditor.apply(diff),
      saveSharedDraft: diff => localEditor.writeDraft(diff), loadSharedDraft: () => localEditor.readDraft({ accept: false }), acceptSharedDraft: draft => localEditor.acceptDraft(draft),
      clearSharedDraft: () => localEditor.clearDraft(), sharedRevision: sharedEditorDraft?.revision ?? '',
      sharedWriter: localEditor.clientId,
      rebuildTerrain: rebuildLocationTerrain,
      onFogSettingsChange(_settings, key, location) {
        if (key === 'start' || key === 'end' || key === 'enabled') scheduleTerrainFogRebuild(location?.id);
      },
      onFogPathsChange() { scheduleTerrainFogRebuild(); },
      getLocation: () => activeLocation, getLocationIds: () => Object.keys(locations),
      canOpen: () => !locationTransition && !startupCinematic && !shop.isOpen(),
      getScreenEffects: () => ({ ...screenEffects }), onScreenEffectsChange: setScreenEffects,
      getItemMagnetSettings: () => ({ ...itemMagnetSettings }), onItemMagnetSettingsChange: setItemMagnetSettings,
      cardboardDamageTexture, cardboardVoronoiTexture, cardboardTearNoiseTexture, displacementNoiseTexture: cardboardPerlinTexture,
      corrugation, getCardboardDamageSettings: () => ({ ...sceneRegistry.cardboardDamage }),
      onCardboardDamageChange: settings => sceneRegistry.changeCardboardDamage(settings),
      getItemMagnetPlayerPosition: () => ({ x: heroBody.x, y: 0, z: heroBody.z }),
      getCampaignGraphData: state => ensureCampaignGraphData(state), onCampaignGraphChange: applyCampaignGraph,
      onResetLocation: async location => {
        clearProjectiles(); clearAllEarthShatter();
        for (const effect of bursts) {
          scene.remove(effect.group); effect.ring.geometry.dispose(); effect.material.dispose();
        }
        bursts.length = 0;
        const checkpoint = locationArrivalCheckpoint?.locationId === location.id ? locationArrivalCheckpoint : null;
        for (let index = figures.length - 1; index >= 0; index--) {
          const figure = figures[index];
          if (figure.body === heroBody || figure.locationId !== location.id || figure.poolDormant) continue;
          figure.body.active = false; figure.body.health = 0; figure.body.vx = 0; figure.body.vz = 0;
          figure.spawnAnimation = null; figure.victoryAnimation = null;
          figure.group.visible = false;
          figure.healthHUD.visible = false;
          if (figure.enemyMarker) figure.enemyMarker.group.visible = false;
          if (location.id === 'camp') {
            figure.poolDormant = true;
            if (figure.body.boss) campOgrePool = figure;
            else if (!campGoblinPool.includes(figure)) campGoblinPool.push(figure);
          } else {
            figure.group.removeFromParent(); figure.healthHUD.removeFromParent();
            figure.enemyMarker?.group.removeFromParent(); figures.splice(index, 1);
          }
        }
        location.enemies.length = 0;
        for (const spawner of location.spawners ?? [])
          spawner.userData.sceneSpawnerState = { spawned: 0, timer: 0, pending: 0 };
        location.combatTriggered = checkpoint?.combatTriggered ?? false;
        location.loot = (checkpoint?.loot ?? []).map(item => ({ ...item }));
        location.defeats = location.id === 'camp' ? 0 : (checkpoint?.defeats ?? 0);
        location.goblinsSpawned = location.id === 'camp' ? CAMP_LIVING_CAP : (checkpoint?.goblinsSpawned ?? 0);
        location.reinforcementQueue = []; location.bossSpawned = false;
        location.initialized = location.id === 'camp';
        const retainedLootIds = new Set(location.loot.map(item => item.id));
        for (const [id, visual] of worldItemVisuals) if (visual.group.parent === location.sceneGroup && !retainedLootIds.has(id)) {
          visual.group.visible = false; visual.group.removeFromParent(); worldItemVisuals.delete(id);
          const faceIndex = sceneryFacePairs.findIndex(pair => pair.prop === visual.group);
          if (faceIndex >= 0) sceneryFacePairs.splice(faceIndex, 1);
        }
        if (checkpoint) {
          heroBody.x = checkpoint.x; heroBody.z = checkpoint.z; heroBody.vx = 0; heroBody.vz = 0;
          const previousHealth = heroBody.health;
          heroBody.health = checkpoint.health; heroBody.charges = checkpoint.charges;
          noteHealthRestoration(heroFigure, previousHealth, heroBody.health);
          syncFigureDamageStage(heroFigure);
          heroBody.chargePop?.fill(0);
          heroBody.rechargeTimer = checkpoint.rechargeTimer; heroBody.lastSafePosition = { x: checkpoint.x, z: checkpoint.z };
          campaignState.coins = checkpoint.coins; campaignState.inventorySlots = [...checkpoint.inventorySlots];
          campaignState.statusEffects = structuredClone(checkpoint.statusEffects);
          target.set(checkpoint.x, cameraFocusHeight, checkpoint.z);
        }
        showActiveLocationFigures(); rebuildBodies(); storyActors.update(); refreshLocationInfo(); renderInventory();
        renderStatusEffectsHud(); persistCampaign(); updateCamera();
      },
      onActiveChange(editing) {
        inputController.cancel();
        for (const spawner of activeLocation.spawners ?? [])
          spawner.visible = editing && !spawner.userData.sceneEditDeleted;
        if (!editing) {
          sceneRegistry.setTimeOfDay(DAY_NIGHT_STATES[campaignState.timeState].period);
          rebuildBodies(); updateEnemySpawners(activeLocation, 0); persistCampaign();
        }
      } });
    installPixel7Preview({ editor: sceneEditor });
  }
  reportLoadStage('Подключение редактора сцены', 'ready');
  loading.hidden = true;
  if (debugMode) window.__CQ_DEBUG__ = {
    locations: Object.keys(locations),
    enter(id) { return enterLocation(id, activeLocation.id); },
    async view(id, distance = 43) {
      simulationPaused = true;
      await enterLocation(id, activeLocation.id);
      dialogue.close(); inventory.hide();
      heroBody.x = 0; heroBody.z = 0; heroBody.vx = 0; heroBody.vz = 0;
      heroBody.health = heroBody.maxHealth;
      heroFigure.victoryAnimation = null;
      const points = activeLocation.walkablePoints;
      const minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x));
      const minZ = Math.min(...points.map(p => p.z)), maxZ = Math.max(...points.map(p => p.z));
      target.set((minX + maxX) / 2, .65, (minZ + maxZ) / 2);
      orbit.distance = Math.max(distance, Math.max(maxX - minX, maxZ - minZ) * 1.45);
      orbit.phi = .62; orbit.theta = .35;
      updateCamera();
    },
    pause(value = true) { simulationPaused = value; },
    equipmentPose(pose = null, side = 'front') {
      if (pose && (!heroFigure.artStates[pose] || !['front', 'back'].includes(side))) throw new Error('Invalid equipment preview pose');
      equipmentPosePreview = pose ? { pose, side } : null;
      if (pose) {
        simulationPaused = true; dialogue.close(); inventory.hide();
        heroFigure.group.traverse(object => object.layers.enable(31));
        scene.traverse(object => { if (object.isLight) object.layers.enable(31); });
        camera.layers.set(31);
      } else { camera.layers.set(0); prepareScenePresentation(); }
    },
    story(kind = 'scene') {
      const card = inspectCampaignLocation(campaignState, activeLocation.id);
      showStoryCard({ ...card, lines: getStoryDialogue(campaignState, activeLocation.id, kind) });
    },
    actorView(id, angle = 0) {
      const actor = storyActors.actors.find(actor => actor.spec.id === id) ?? merchantActors.find(actor => actor.id === id);
      if (!actor) throw new Error(`Unknown actor: ${id}`);
      simulationPaused = true;
      target.set(actor.body.x, .75, actor.body.z);
      orbit.distance = 6; orbit.theta = angle; orbit.phi = .95;
      heroFigure.group.visible = false; playerMarker.group.visible = false;
      for (const figure of figures) figure.healthHUD.visible = false;
      updateCamera();
    },
    lootView() {
      const item = activeLocation.loot[0];
      if (!item) throw new Error('No world loot is available to preview');
      simulationPaused = true;
      const visual = worldItemVisuals.get(item.id);
      if (visual) { visual.spawn = null; visual.group.position.set(item.x, 0, item.z); }
      target.set(item.x, .92, item.z);
      orbit.distance = 5.3; orbit.theta = .9; orbit.phi = .9;
      updateCamera();
    },
    openCache() { return openCache(activeLocation.cacheBody); },
    defeatPlayer() {
      heroBody.health = 0;
      persistCampaign();
      beginVictorySequence();
    },
    audioCue(name) { return audio.play(name); },
    place(id, x, z, vx = 0, vz = 0) {
      const body = id === 'hero' ? heroBody : activeLocation.enemies.find(enemy => enemy.id === id);
      if (!body) throw new Error(`Unknown test unit: ${id}`);
      Object.assign(body, { x, z, vx, vz });
    },
    snapshot() {
      const heroScreen = new THREE.Vector3(heroBody.x, .12, heroBody.z).project(camera);
      return { location: activeLocation.id, combatTriggered: activeLocation.combatTriggered, victorySequenceActive,
        locationTransition, failedTransitionTo,
        rockEffectLoad: rockEffectAssets ? 'ready' : rockEffectAssetsPromise ? 'pending' : 'idle',
        campaignGraph: activeCampaignGraph,
        editor: { active: sceneEditor.active, ...sceneEditor.inspect(), fog: { ...sceneRegistry.fog }, diff: sceneRegistry.model.diff(),
          camera: { position: camera.position.toArray(), quaternion: camera.quaternion.toArray() },
          exits: activeLocation.exits.map(exit => ({ ...exit })), arrivals: activeLocation.arrivals,
          objects: sceneRegistry.bindings(activeLocation.id).map(binding => {
            const center = binding.object.getWorldPosition(new THREE.Vector3()).project(camera);
            return { id: binding.id, helper: binding.helper,
              screen: { x: (center.x + 1) * innerWidth / 2, y: (1 - center.y) * innerHeight / 2 } };
          }) },
        streaming: locationStreaming.snapshot(), memory: { ...renderer.info.memory },
        residentLocations: Object.keys(locationGroups), figureCount: figures.length,
        hero: { x: heroBody.x, z: heroBody.z, vx: heroBody.vx, vz: heroBody.vz,
          screen: { x: (heroScreen.x + 1) * innerWidth / 2, y: (1 - heroScreen.y) * innerHeight / 2 },
          visible: heroFigure.group.visible,
          health: heroBody.health, charges: heroBody.charges, rechargeTimer: heroBody.rechargeTimer,
          renderedX: heroFigure.group.position.x, renderedZ: heroFigure.group.position.z, viewBack: heroFigure.viewBack,
          healthHudBillboardAligned: Math.abs(heroFigure.healthHUD.quaternion.dot(camera.quaternion)) > .99999,
          visualState: heroFigure.visualState, equipment: heroEquipment.inspect(), bonuses: combatBonuses(campaignState) },
        aim: { active: Boolean(inputController.getAimingBody()), color: playerMarker.material.color.getHexString(),
          hoveringPlayer: inputController.isHoveringPlayer(),
          visibleHoverOutlines: heroFigure.hoverOutlineMeshes.filter(outline => outline.visible).length,
          opacity: playerMarker.material.opacity, x: playerMarker.group.position.x, z: playerMarker.group.position.z,
          angle: playerMarker.group.rotation.y },
        openingCinematic: startupCinematic ? {
          phase: sampleOpeningCinematic(startupCinematic.views, startupCinematic.elapsed).phase,
          cameraPosition: camera.position.toArray(),
        } : null,
        audio: audio.snapshot(),
        dialogue: dialogue.frame(), elapsed,
        campaignFlags: { ...campaignState.flags },
        storyPickups: (activeLocation.storyPickups ?? []).filter(pickup => !campaignState.flags[pickup.flag])
          .map(({ id, x, z }) => ({ id, x, z })),
        actors: storyActors.actors.filter(actor => actor.spec.location === activeLocation.id)
          .map(actor => ({ id: actor.spec.id, visible: actor.prop.visible, fixed: actor.body.fixed, x: actor.body.x, z: actor.body.z,
            baseY: actor.prop.position.y, meshes: actor.prop.children.length })),
        heroVictory: Boolean(heroFigure.victoryAnimation), hazards: activeLocation.hazards,
        enemies: activeLocation.enemies.map(({ id, x, z, vx, vz, health, archetype, fell, aiPhase, aiTimer, charges, rechargeTimer,
          pendingEarthShatterPositions }) => ({ id, x, z, vx, vz, health, archetype, fell, aiPhase, aiTimer, charges, rechargeTimer,
          pendingEarthShatterPositions })),
        projectiles: projectiles.length,
        shots: projectiles.map(({ x, z, age }) => ({ x, z, age })),
        cache: activeLocation.cacheBody ? { opened: activeLocation.cacheBody.opened,
          opening: chestVisuals.get(activeLocation.cacheBody.id)?.opening ? {
            age: chestVisuals.get(activeLocation.cacheBody.id).opening.age,
            phase: cacheOpeningPhase(chestVisuals.get(activeLocation.cacheBody.id).opening),
          } : null,
          collidable: bodies.includes(activeLocation.cacheBody),
          puckVisible: chestVisuals.get(activeLocation.cacheBody.id)?.puck.visible ?? false,
          puckScale: chestVisuals.get(activeLocation.cacheBody.id)?.puck.scale.x ?? 0,
          holderY: chestVisuals.get(activeLocation.cacheBody.id)?.artHolder.position.y ?? 0,
          rotationY: chestVisuals.get(activeLocation.cacheBody.id)?.group.rotation.y ?? 0,
          lootVisible: chestVisuals.get(activeLocation.cacheBody.id)?.lootVisuals.some(item => item.group.visible) ?? false,
          lootSettled: chestVisuals.get(activeLocation.cacheBody.id)?.lootVisuals.every(item => !item.group.parent || !item.spawn) ?? true,
          lootMotion: chestVisuals.get(activeLocation.cacheBody.id)?.lootVisuals.map(item => ({ parent: Boolean(item.group.parent),
            age: item.spawn?.age ?? null, duration: item.spawn?.duration ?? null })) ?? [],
          openSprite: chestVisuals.get(activeLocation.cacheBody.id)?.stateArt[1].visible ?? false } : null,
        terrain: activeLocation.art.terrain, sceneryCount: activeLocation.sceneryCount,
        coins: campaignState.coins, shopOpen: shop.isOpen(),
        merchants: merchantActors.filter(actor => actor.locationId === activeLocation.id).map(actor => ({ id: actor.id, merchantId: actor.merchantId,
          x: actor.body.x, z: actor.body.z, visible: actor.prop.visible, active: actor.body.active })),
        loot: activeLocation.loot.map(item => ({ ...item, skin: item.itemId === 'coins' ? coinSkin(item.amount).id : item.itemId })),
        render: { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles } };
    },
    defeatEnemy(id) {
      const enemy = activeLocation.enemies.find(body => body.id === id);
      if (enemy) { enemy.hitCooldown = 0; damage(enemy, enemy.health, 12); }
    },
  };
  let previousTime = null;
  let nextFrameAt = 0;
  let previousAim = false;
  renderer.setAnimationLoop(time => {
    if (window.__CQ_PIXEL7_PREVIEW_ACTIVE__) { previousTime = time; return; }
    if (time < nextFrameAt) return;
    const rawFrameDeltaMs = previousTime === null ? 0 : Math.max(0, time - previousTime);
    const profileFrame = performanceProfiler.beginFrame(time, rawFrameDeltaMs, FRAME_INTERVAL_MS);
    try {
      if (time - nextFrameAt > FRAME_INTERVAL_MS * 4) nextFrameAt = time;
      nextFrameAt += FRAME_INTERVAL_MS;
      const frameDt = previousTime === null ? 0 : Math.min((time - previousTime) / 1000, .05);
      const dt = simulationPaused ? 0 : frameDt;
      previousTime = time;
      performanceProfiler.beginPhase('frameSetup');
    audio.setScene({ nextMood: audioMood(activeLocation, heroBody.health, canCelebrateLocationVictory(activeLocation, CAMP_GOBLIN_TOTAL)),
      nextAmbience: audioAmbience(activeLocation),
      paused: getApplicationMode().paused,
      speed: Math.hypot(heroBody.vx, heroBody.vz) });
    updateItemIconFlights(frameDt);
    sceneEditor?.update(frameDt);
    performanceProfiler.endPhase('frameSetup');
    if (sceneEditor.materialPreviewOpen?.()) return;
    if (sceneEditor.graphOpen) return;
    if (advanceStartupCinematic(frameDt)) { updatePlayerReveal(); renderScene(); return; }
    if (equipmentPosePreview) {
      const { pose, side } = equipmentPosePreview;
      setVisualState(heroFigure, pose); heroFigure.viewBack = side === 'back';
      heroFigure.group.rotation.set(0, 0, 0);
      for (const art of Object.values(heroFigure.artStates)) {
        art.frontArt.group.visible = side === 'front'; art.backArt.group.visible = side === 'back';
      }
      heroFigure.artGroup.position.y = pose === 'dead' ? heroFigure.deadGroundedY : 1.25;
      heroFigure.artGroup.scale.setScalar(1); heroFigure.artGroup.rotation.set(0, 0, 0);
      camera.position.set(heroBody.x, 1.45, heroBody.z + (side === 'front' ? 4.8 : -4.8));
      camera.lookAt(heroBody.x, 1.45, heroBody.z); renderScene(); return;
    }
    if (sceneEditor.active) {
      updateEditorPresentation(); updatePlayerReveal(); renderScene(); return;
    }
    if (deathScreenOpen) { renderScene(); return; }
    if (getApplicationMode().renderOnly) {
      updateCamera(); updatePlayerReveal(); renderScene(); return;
    }
    updateCacheAnimation(dt);
    updateCardboardFalls(dt);
    elapsed += dt;
    updateEnemySpawners(activeLocation, dt);
    heartMaterialVariants.updateTime(elapsed);
    performanceProfiler.beginPhase('statusEffects');
    for (const body of [heroBody, ...activeLocation.enemies.filter(enemy => enemy.active !== false)]) {
      if (body.health <= 0) continue;
      const target = body === heroBody ? campaignState : body;
      const ticks = advanceStatusEffects(target, dt);
      const figure = figures.find(item => item.body === body);
      if (ticks.healing) {
        const previousHealth = body.health;
        body.health = Math.min(body.maxHealth, body.health + ticks.healing);
        noteHealthRestoration(figure, previousHealth, body.health);
      }
      if (ticks.healing && figure?.cardboardDamageMaterials) {
        syncFigureDamageStage(figure);
      }
      if (ticks.damage) damage(body, ticks.damage, 0, true);
      if (!ticks.healing && !ticks.damage) continue;
      if (body === heroBody) { persistCampaign(); if (ticks.healing) renderInventory(); }
      if (figure) {
        figure.healthHUD.visible = shouldShowHealthHud(body.team, body.health, body.maxHealth);
      }
    }
    performanceProfiler.endPhase('statusEffects');
    for (const obstacle of activeLocation.obstacles) if (obstacle.kind === 'cardboard-prop')
      obstacle.hitCooldown = Math.max(0, (obstacle.hitCooldown || 0) - dt);
    statusHudRefresh -= dt;
    if (statusHudRefresh <= 0) { statusHudRefresh = .5; renderStatusEffectsHud(); }
    transitionCooldown = Math.max(0, transitionCooldown - dt);
    if (heroBody.health <= 0) beginVictorySequence();
    if (!victorySequenceActive && heroBody.health > 0 && !celebratedLocations.has(activeLocation.id)
      && canCelebrateLocationVictory(activeLocation, CAMP_GOBLIN_TOTAL)) {
      celebratedLocations.add(activeLocation.id);
      audio.play('victory');
      clearProjectiles();
      startUnitVictory(heroFigure);
    }
    for (const figure of figures) if (figure.spawnAnimation) {
      const animation = figure.spawnAnimation;
      animation.age += dt;
      const t = Math.min(1, animation.age / animation.duration);
      const eased = 1 - (1 - t) ** 3;
      figure.group.position.set(
        animation.fromX + (figure.body.x - animation.fromX) * eased,
        Math.sin(t * Math.PI) * 1.05,
        animation.fromZ + (figure.body.z - animation.fromZ) * eased,
      );
      if (t >= 1) {
        figure.group.position.y = 0;
        figure.body.spawnReady = true;
        figure.spawnAnimation = null;
        if (figure.locationId === activeLocation.id) {
          figure.healthHUD.visible = shouldShowHealthHud(figure.body.team, figure.body.health, figure.body.maxHealth);
          if (figure.enemyMarker) figure.enemyMarker.group.visible = figure.body.health > 0;
          rebuildBodies();
        }
      }
    }
    if (!victorySequenceActive && activeLocation.kind === 'forest' && wakeForestCombat(activeLocation, heroBody)) {
      for (const enemy of activeLocation.enemies) enemy.aiTimer = randomBetween(.5, 1.4);
      refreshLocationInfo();
    }
    if (!victorySequenceActive && activeLocation.kind === 'camp') {
      const living = activeLocation.enemies.filter(enemy => enemy.active !== false && enemy.health > 0 && !enemy.boss).length;
      if (takeDueReinforcement(activeLocation, elapsed, living)) startQueuedReinforcement();
    }
    const aimingBody = inputController.getAimingBody();
    const showPlayerHoverOutline = inputController.isHoveringPlayer() && heroBody.health > 0 && heroFigure.group.visible;
    for (const outline of heroFigure.hoverOutlineMeshes) outline.visible = showPlayerHoverOutline;
    if (aimingBody && !previousAim) audio.play('aim');
    previousAim = Boolean(aimingBody);
    const playerRechargeInterval = playerChargeRechargeInterval(activeLocation.enemies);
    for (const body of bodies) {
      if (body.fixed) continue;
      body.hitCooldown = Math.max(0, (body.hitCooldown || 0) - dt);
      const rechargeInterval = body === heroBody ? playerRechargeInterval : undefined;
      const restored = advanceChargeRecharge(body, dt, rechargeInterval);
      if (body === heroBody && restored > 0) {
        const mood = audioMood(activeLocation, heroBody.health, canCelebrateLocationVictory(activeLocation, CAMP_GOBLIN_TOTAL));
        audio.play(chargeReadyCue(mood));
      }
    }
    performanceProfiler.beginPhase('enemyAI');
    for (const body of activeLocation.enemies) {
      if (!body.spawnReady || body.active === false || victorySequenceActive) continue;
      const figure = figures.find(item => item.body === body);
      const decision = advanceEnemyAI(body, state, figure, dt, randomBetween);
      if (decision.burrowed && figure) {
        figure.group.visible = false; figure.healthHUD.visible = false;
        figure.enemyMarker.group.visible = false; rebuildBodies();
      }
      if (decision.surfaced && figure) {
        figure.group.visible = true; figure.group.position.set(body.x, 0, body.z);
        figure.healthHUD.visible = shouldShowHealthHud(body.team, body.health, body.maxHealth);
        figure.enemyMarker.group.visible = body.health > 0; rebuildBodies();
      }
      if (decision.launched) { burst(body.x, body.z, .45); audio.play('enemyDash', { pan: (body.x - heroBody.x) / 15 }); }
      applyEarthShatterDecision(body, figure, decision);
      if (decision.zoneTelegraph) showAbilityTelegraph(body, decision.zoneTelegraph, decision.duration);
      if (decision.zoneDetonated) {
        const zone = decision.zoneDetonated;
        clearAbilityTelegraph(body.id);
        if (Math.hypot(heroBody.x - zone.x, heroBody.z - zone.z) <= zone.radius + .65
            && damage(heroBody, zone.damageQuarters, 0)) {
          applyStatusEffect(campaignState, zone.effect);
          renderStatusEffectsHud(); persistCampaign();
        }
        burst(zone.x, zone.z, zone.radius * .55);
      }
      if (decision.shot) {
        audio.play('projectile', { pan: (body.x - heroBody.x) / 15 });
        decision.shot.sourceArchetype = body.archetype;
        decision.shot.sourceId = body.id;
        spawnStoneProjectile(decision.shot);
        if (figure) figure.dealDamageAge = 0;
      }
    }
    performanceProfiler.endPhase('enemyAI');
    updateAbilityTelegraphs(dt);
    updateEarthShatter(dt);
    checkEarthShatterContacts();
    performanceProfiler.beginPhase('physics');
    for (let remaining = dt; remaining > 0 && !dialogue.isOpen(); remaining -= 1 / 120) {
      advanceWorld(bodies, Math.min(remaining, 1 / 120), null, onImpact, activeLocation.walkablePoints, {
        terrainVolume:activeLocation.terrainHeightMap?.volume,
        terrainGround:activeLocation.terrainHeightMap?.groundDomain,
        fallZones: activeLocation.dropZones, hazards: activeLocation.hazards,
        fallable: body => body === heroBody || body.team === 'enemy', onFall: recoverPlayerFromFall,
      });
      if (victorySequenceActive) for (const body of bodies) if (!body.fixed) body.vx = body.vz = 0;
    }
    checkEarthShatterContacts();
    performanceProfiler.endPhase('physics');
    inspectionTrigger.update(heroBody, activeLocation.inspectionMarker?.userData.sceneEditBody, inspectCurrentLocation);
    for (const enemy of activeLocation.enemies)
      clearDirectHitProtectionWhenSafe(enemy, isAttacking(enemy));
    if (dialogue.isOpen()) { updateCamera(); updatePlayerReveal(); renderScene(); return; }
    performanceProfiler.beginPhase('worldEffects');
    updateWorldLoot(dt);
    updateAcidPuddles(dt);
    showCacheStoryAfterLootLands();
    updateProjectiles(dt);
    storyActors.update();
    if (isCampaignPositionSafe(activeLocation, heroBody)) heroBody.lastSafePosition = { x: heroBody.x, z: heroBody.z };
    for (const enemy of activeLocation.enemies) if (enemy.health > 0 && isCampaignPositionSafe(activeLocation, enemy))
      enemy.lastSafePosition = { x: enemy.x, z: enemy.z };
    performanceProfiler.endPhase('worldEffects');
    performanceProfiler.beginPhase('figurePresentation');
    updateFigurePresentation({ figures, heroBody, activeLocation, aimingBody, camera, elapsed, campaignState, playerRestoredHearts, heartMaterialVariants, victorySequenceActive, GROUND_UI_Y, MAX_AIM_MARKER_EXTENSION, attackColor, enemyColor, setVisualState }, dt);
    performanceProfiler.endPhase('figurePresentation');
    for (let i = bursts.length - 1; i >= 0; i--) {
      const effect = bursts[i]; effect.age += dt;
      const t = effect.age / .42;
      if (t >= 1) {
        scene.remove(effect.group); effect.ring.geometry.dispose(); effect.material.dispose(); bursts.splice(i, 1); continue;
      }
      effect.material.opacity = (1 - t) ** 2 * .85;
      resizeRingGeometry(effect.ring.geometry,.22 * (.5 + t * 4 * effect.strength),.07);
      effect.dots.forEach((dot, index) => {
        const angle = index * Math.PI / 3;
        const radius = (.1 + t * .8) * effect.strength;
        dot.position.set(Math.cos(angle) * radius, Math.sin(t * Math.PI) * .3, Math.sin(angle) * radius);
      });
    }
    const easing = 1 - Math.exp(-dt * 8);
    target.x += (state.x - target.x) * easing;
    target.z += (state.z - target.z) * easing;
    if (selected) {
      selectionAge += dt;
      const t = Math.min(1, selectionAge / .6);
      const scale = t === 1 ? 1 : 1 + Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * 2 * Math.PI / 3);
      playerMarker.setSizeScale(scale);
    }
    const exitsLocked = locationHasLivingEnemies(activeLocation);
    if (updateLocationExitLock(activeLocation.exitVisuals, exitsLocked, dt)) {
      activeLocation.obstacles = activeLocation.obstacles.filter(obstacle => obstacle.kind !== 'exit-barrier');
      if (exitsLocked) activeLocation.obstacles.push(...activeLocation.exitBarriers);
      rebuildBodies();
    }
    if (transitionCooldown <= 0) {
      let exit = findNearbyExit(activeLocation, heroBody);
      if (!exit) failedTransitionTo = null;
      if (exit?.to === failedTransitionTo) exit = null;
      if (exit && protectedEntryFrom && shouldIgnoreEntryExit(activeLocation, protectedEntryFrom, heroBody)) exit = null;
      else if (protectedEntryFrom) protectedEntryFrom = null;
      if (exit && !exitsLocked) enterLocation(exit.to, activeLocation.id);
    }
    if (activeLocation.inspectionMarker) {
      const marker = activeLocation.inspectionMarker;
      marker.visible = !marker.userData.sceneEditDeleted
        && !activeLocation.secret && !campaignState.collected[activeLocation.id];
      if (activeLocation.terrainHeightMap)
        marker.position.y = activeLocation.terrainHeightMap.sample(marker.position.x, marker.position.z);
      const cameraYaw = Math.atan2(camera.position.x - marker.position.x, camera.position.z - marker.position.z);
      marker.rotation.y = turnToward(marker.rotation.y, cameraYaw, dt);
    }
    if (aimingBody) {
      playerMarker.material.color.copy(state.charges > 0 ? selectedColor : unavailableAimColor);
    } else {
      playerMarker.material.color.lerp(state.health > 0 && isAttacking(state) ? attackColor : selectedColor,
        1 - Math.exp(-18 * dt));
    }
    playerMarker.material.opacity = aimingBody && state.charges <= 0 ? .5 : .96;
    playerMarker.overlap.material.color.copy(playerMarker.material.color);
    playerMarker.overlap.material.opacity = playerMarker.material.opacity * .52;
    playerMarker.group.position.set(state.x, GROUND_UI_Y, state.z);
    updateCamera(dt, true);
    updatePlayerReveal();
    for (const { prop, front, back } of sceneryFacePairs) {
      const dx = camera.position.x - prop.position.x, dz = camera.position.z - prop.position.z;
      const cameraOnFront = dx * Math.sin(prop.rotation.y) + dz * Math.cos(prop.rotation.y) >= 0;
      const face = sceneryFaceForCamera(cameraOnFront, prop.userData.cardboardFallenFace);
      front.visible = face === 'front';
      back.visible = face === 'back';
    }
    for (const figure of figures) {
      if (figure.poolDormant) continue;
      if (figure.body !== heroBody && figure.locationId !== activeLocation.id) continue;
      figure.healthHUD.position.set(figure.body.x, 2.65, figure.body.z);
      figure.healthHUD.quaternion.copy(camera.quaternion);
    }
    renderScene();
    } finally {
      performanceProfiler.endFrame(profileFrame, () => ({
        location: activeLocation?.id ?? null,
        paused: simulationPaused,
        deathScreen: deathScreenOpen,
        sceneEditor: Boolean(sceneEditor?.active),
        bodies: bodies.length,
        enemies: activeLocation?.enemies?.length ?? 0,
        figures: figures.length,
        projectiles: projectiles.length,
        earthShatterRocks: earthShatterRocks.length,
        sceneryFaces: sceneryFacePairs.length,
        postEffects: { tiltShift: Boolean(screenEffects.tiltShift) },
      }));
    }
  });
  reportLoadStage('Игровой цикл и рендер', 'ready');
  frameWorkStarted = true;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    void enableTiltShift();
    if (!locationTransition) locationStreaming.retain(activeLocation.id)
      .catch(error => console.error('Не удалось подготовить соседние места', error));
  }));
}

start().catch(error => {
  const stackLine = String(error?.stack ?? '').split('\n').find(line => /:\d+:\d+\)?$/.test(line.trim()))?.trim();
  reportLoadStage(currentLoadStage, 'error', `${error.message || error}${stackLine ? ` · ${stackLine}` : ''}`);
  loading.hidden = true;
  const panel = document.querySelector('#error'); panel.dataset.uiAnchor ??= 'center'; panel.dataset.uiMotionSurface = '';
  panel.textContent = `Не удалось загрузить сцену на этапе «${currentLoadStage}»: ${error.message || error}. Обнови страницу.`;
  void showUIWindow(panel);
  dispatchEvent(new CustomEvent('cq-start-error', { detail: document.querySelector('#error').textContent }));
  console.error(error);
});

