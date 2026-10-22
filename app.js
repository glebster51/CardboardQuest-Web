import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { createGameAudio } from './audio/game-audio.mjs?v=3';
import { createAudioControls } from './audio/audio-controls.mjs';
import { audioMood, audioAmbience, chargeReadyCue } from './audio/audio-rules.mjs?v=2';
import { createLocationStreaming } from './game/location-streaming.mjs';
import { createGeometryClient } from './render/geometry-client.mjs?v=4';
import { DEFAULT_SCREEN_EFFECTS, normalizeScreenEffects, SCREEN_EFFECT_SETTINGS_KEY } from './screen-effects.mjs?v=1';
import { disposeUnusedScenes, sceneResources } from './render/scene-resources.mjs';
import { restoreTerrainSampler } from './render/terrain-sampler.mjs';
import { applyTerrainEdgeStyle } from './render/terrain-edge-style.mjs?v=1';
import { createLocationEdgeShade, LOCATION_FAR_COLOR } from './render/location-edge-shade.mjs?v=13';
import { createPlayerOcclusionReveal } from './render/player-occlusion-reveal.mjs?v=2';
import { SCENE_OVERRIDES } from './scene-overrides.mjs?v=129';
import { createSceneRegistry } from './editor/scene-registry.mjs?v=135';
import { installSceneEditor } from './editor/scene-editor.mjs?v=140';
import { catalogAsset } from './editor/asset-catalog.mjs?v=4';
import { createCardboardGrainTexture } from './cardboard-surface.mjs?v=2';
import { advanceEnemyAI } from './game/enemy-ai.mjs?v=3';
import { STORY_ENCOUNTERS, ENEMY_STATS } from './game/encounters.mjs?v=2';
import { advanceStoneProjectile } from './game/projectiles.mjs?v=1';
import { createPointerInput } from './game/pointer-input.mjs?v=4';
import { PLAYER_PICK_LAYER, ENEMY_PICK_LAYER } from './game/pick-layers.mjs?v=1';
import { followDirection, followMotion, nearestAwakeThreat } from './render/camera-follow.mjs?v=1';
import { getStoryDialogue } from './game/story-dialogue.mjs?v=3';
import { createDialoguePanel } from './render/dialogue-panel.mjs?v=1';
import { createLocationMapView } from './render/location-map-view.mjs?v=3';
import { createCampaignNodeVisuals } from './render/campaign-graph-view.mjs?v=2';
import { createCampaignGraph, applyCampaignGraphToLocation } from './game/campaign-graph.mjs?v=1';
import { buildLocationMapGraph } from './game/location-map-data.mjs';
import { createInventoryPanel } from './render/inventory-panel.mjs?v=2';
import { createStoryActors, isStoryActorVisible } from './render/story-actors.mjs?v=3';
import { createFigureFactory } from './render/figure-factory.mjs?v=3';
import { createGroundRenderer } from './render/ground-renderer.mjs?v=4';
import { createLocationExitVisuals, updateLocationExitLock } from './render/location-exits.mjs?v=9';
import { createScenerySystem } from './render/scenery-system.mjs?v=10';
import { populateNarrativeScenery } from './render/location-scenery.mjs?v=4';
import { hazardAtPoint, isPlayableFloor } from './game/world-hazards.mjs?v=1';
import { launch, advanceWorld, facingAngle, turnToward, isAttacking, WALKABLE_POINTS, PUCK_RADIUS, LAUNCH_GAIN, PLAYER_DASH_DISTANCE_MULTIPLIER, PLAYER_DASH_SPEED_MULTIPLIER, GOBLIN_DASH_MAX_POWER } from './physics.mjs?v=25';
import { loadLocationDepthMaps } from './depth-map-assets.mjs?v=1';
import { createMarkerContours, markerFillTransform } from './marker-shapes.mjs?v=1';
import { advanceChargeRecharge, chargeRechargeProgress, spendCharge, PLAYER_CHARGE_RECHARGE_INTERVAL } from './charge-recharge.mjs?v=5';
import { heartHealthLevels, ricochetDamageQuarters, shouldShowHealthHud } from './heart-health.mjs?v=2';
import { canEnemyDamagePlayer, clearDirectHitProtectionWhenSafe, markDirectPlayerHit } from './game/attack-protection.mjs?v=1';
import { createLocationWalkPaths, pointInWalkableArea, scatterGroundDetails } from './ground-decoration.mjs?v=3';
import { advanceVictoryLoop, canCelebrateLocationVictory, createVictoryLoop, settleEnemiesForVictory } from './victory-animation.mjs?v=2';
import { recoverAfterFall } from './game/fall-recovery.mjs?v=1';
import { CACHE_LOOT_SPAWN_DURATION, advanceCacheOpening, cacheOpeningPhase, createCacheOpening } from './game/cache-animation.mjs?v=2';
import { CAMPAIGN, CAMPAIGN_SAVE_KEY, addItems, campaignLocation, chooseCampaignOption,
  collectCampaignStoryPickup, consumeInventoryItem, createCampaignState, inspectCampaignLocation, openCampaignCache,
  visitCampaignLocation, CAMPAIGN_EDGES } from './game/story-campaign.mjs?v=7';
import { normalizeWorldLoot, rollEnemyLoot, scatterWorldLoot, takeWorldLoot } from './game/world-items.mjs?v=1';
import { createCampaignLocations, isCampaignPositionSafe, resolveCampaignPlayerStart } from './game/story-world.mjs?v=16';
import { CAMP_BOSS_DEFEATS, CAMP_GOBLIN_SPAWNS, CAMP_GOBLIN_TOTAL, CAMP_HUT_ANCHORS, CAMP_LIVING_CAP, LOCATION_SCALE,
  createExitBarrierBodies, createLocationNetwork, findNearbyExit, lastExitPosition, locationArrival, locationEntryDirection,
  locationHasLivingEnemies, shouldIgnoreEntryExit,
  finishCampReinforcement, recordCampDefeat, rememberExitPosition, takeDueReinforcement, wakeForestCombat } from './location-network.mjs?v=12';

const host = document.querySelector('#scene');
const loading = document.querySelector('#loading');
const audio = createGameAudio();
const scaled = value => value * LOCATION_SCALE;
const yieldFrameWork = () => new Promise(resolve => {
  if (window.requestIdleCallback) window.requestIdleCallback(resolve, { timeout: 120 });
  else setTimeout(resolve, 16);
});
const heroBody = { id: 'hero', team: 'player', x: 0, z: 0, vx: 0, vz: 0,
  health: 20, maxHealth: 20, charges: 3, maxCharges: 3, rechargeTimer: 0, chargePop: [0, 0, 0] };
let bodies = [heroBody];
let state = heroBody;
let selected = true;
const GROUND_UI_Y = .026;
const MAX_RENDER_FPS = 60;
const FRAME_INTERVAL_MS = 1000 / MAX_RENDER_FPS;
const AIM_DRAG_SENSITIVITY = 1 / 3;
const AIM_MARKER_LENGTH_SCALE = 1 / 1.3;
const MAX_AIM_MARKER_EXTENSION = 5.4 * AIM_MARKER_LENGTH_SCALE;
const randomBetween = (min, max) => min + Math.random() * (max - min);

async function start() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, stencil: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(LOCATION_FAR_COLOR);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.append(renderer.domElement);
  let tiltShiftComposer = null, tiltShiftPass = null, ssaoPass = null, tiltShiftPixelRatio = 1, postProcessingPromise = null;
  let screenEffects = DEFAULT_SCREEN_EFFECTS;
  try { screenEffects = normalizeScreenEffects(JSON.parse(localStorage.getItem(SCREEN_EFFECT_SETTINGS_KEY) || 'null')); }
  catch { screenEffects = normalizeScreenEffects(null); }
  const setSsaoSize = () => {
    if (!ssaoPass) return;
    const scale = Math.min(.5, 720 / Math.max(1, innerWidth), 540 / Math.max(1, innerHeight));
    ssaoPass.setSize(Math.max(1, Math.round(innerWidth * scale * tiltShiftPixelRatio)),
      Math.max(1, Math.round(innerHeight * scale * tiltShiftPixelRatio)));
  };
  const renderScene = () => {
    if (!tiltShiftComposer || (!screenEffects.ssao && !screenEffects.tiltShift)) return renderer.render(scene, camera);
    try { tiltShiftComposer.render(); }
    catch (error) {
      if (ssaoPass?.enabled) {
        ssaoPass.enabled = false;
        console.warn('SSAO отключён после ошибки; сохраняю остальные эффекты', error);
        try { tiltShiftComposer.render(); return; } catch { /* Fall back to the direct renderer below. */ }
      }
      tiltShiftComposer.dispose(); tiltShiftComposer = null; ssaoPass = null;
      console.warn('Постобработка остановлена; используется обычный рендер', error);
      renderer.render(scene, camera);
    }
  };
  async function enableTiltShift() {
    if ((!screenEffects.ssao && !screenEffects.tiltShift) || tiltShiftComposer) return;
    if (postProcessingPromise) return postProcessingPromise;
    postProcessingPromise = (async () => { try {
      const [composerModule, renderModule, ssaoModule, shaderModule, shaderPassModule, outputModule] = await Promise.all([
        import('three/addons/postprocessing/EffectComposer.js'),
        import('three/addons/postprocessing/RenderPass.js'),
        import('three/addons/postprocessing/SSAOPass.js'),
        import('three/addons/shaders/VerticalTiltShiftShader.js'),
        import('three/addons/postprocessing/ShaderPass.js'),
        import('three/addons/postprocessing/OutputPass.js'),
      ]);
      const target = new THREE.WebGLRenderTarget(1, 1, { format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType, depthBuffer: true, stencilBuffer: false });
      const composer = new composerModule.EffectComposer(renderer, target);
      tiltShiftPixelRatio = Math.min(renderer.getPixelRatio(), 1);
      composer.setPixelRatio(tiltShiftPixelRatio);
      composer.addPass(new renderModule.RenderPass(scene, camera));
      try {
        const ssao = new ssaoModule.SSAOPass(scene, camera, innerWidth, innerHeight, 12);
        ssao.kernelRadius = 5;
        ssao.minDistance = .008;
        ssao.maxDistance = .12;
        ssao.enabled = screenEffects.ssao;
        composer.addPass(ssao);
        ssaoPass = ssao;
      } catch (error) {
        console.warn('SSAO недоступен; остальные эффекты сохраняются', error);
      }
      const tilt = new shaderPassModule.ShaderPass(shaderModule.VerticalTiltShiftShader);
      tilt.uniforms.r.value = .48;
      tilt.uniforms.v.value = 7 / Math.max(1, innerHeight * tiltShiftPixelRatio);
      tilt.enabled = screenEffects.tiltShift;
      composer.addPass(tilt);
      composer.addPass(new outputModule.OutputPass());
      composer.setSize(innerWidth, innerHeight);
      setSsaoSize();
      tiltShiftComposer = composer; tiltShiftPass = tilt;
      tiltShiftPass.enabled = screenEffects.tiltShift;
      if (ssaoPass) ssaoPass.enabled = screenEffects.ssao;
    } catch (error) {
      console.warn('Постобработка недоступна; используется обычный рендер', error);
    } finally { postProcessingPromise = null; } })();
    return postProcessingPromise;
  }
  function setScreenEffects(value) {
    screenEffects = normalizeScreenEffects(value);
    try { localStorage.setItem(SCREEN_EFFECT_SETTINGS_KEY, JSON.stringify(screenEffects)); }
    catch { /* The current session still honors the selected effects. */ }
    if (tiltShiftPass) tiltShiftPass.enabled = screenEffects.tiltShift;
    if (ssaoPass) ssaoPass.enabled = screenEffects.ssao;
    if (screenEffects.ssao || screenEffects.tiltShift) void enableTiltShift();
  }

  const scene = new THREE.Scene();
  let sunLight = null;
  const playerOcclusionReveal = createPlayerOcclusionReveal(THREE, renderer);
  scene.background = new THREE.Color(LOCATION_FAR_COLOR);
  let savedCampaign = null;
  try { savedCampaign = JSON.parse(localStorage.getItem(CAMPAIGN_SAVE_KEY) || 'null'); } catch { /* Ignore a damaged local save. */ }
  const campaignState = createCampaignState(savedCampaign);
  campaignState.currentLocationId = campaignLocation(campaignState.currentLocationId)?.id ?? 'home';
  const locations = createCampaignLocations(createLocationNetwork(), LOCATION_SCALE, [campaignState.currentLocationId]);
  let activeCampaignGraph = SCENE_OVERRIDES.graph ?? null;
  await loadLocationDepthMaps({ [campaignState.currentLocationId]: locations[campaignState.currentLocationId] });
  // Rebuild authored footprints now that raster-derived features (notably the
  // black river mask) are available to gameplay collision and floor cutting.
  if (locations[campaignState.currentLocationId].art.depthMap)
    createCampaignLocations(locations, LOCATION_SCALE, [campaignState.currentLocationId]);
  const authoredEntry = SCENE_OVERRIDES.locations[campaignState.currentLocationId]?.entry;
  if (authoredEntry) Object.assign(locations[campaignState.currentLocationId].entry,
    { x: authoredEntry.position[0], z: authoredEntry.position[2] });
  if (activeCampaignGraph) for (const location of Object.values(locations)) applyCampaignGraphToLocation(location, activeCampaignGraph);
  const sceneRegistry = createSceneRegistry({ THREE, overrides: SCENE_OVERRIDES, setLighting(settings) {
    if (!sunLight) return;
    sunLight.position.set(...settings.direction);
    sunLight.intensity = settings.intensity;
    sunLight.color.set(settings.color);
  }, setTerrainStyle(settings) {
    for (const location of Object.values(locations)) if (location.sceneGroup)
      applyTerrainEdgeStyle(location.sceneGroup, THREE, settings);
  }, setFog(settings) {
    scene.background.set(settings.color); renderer.setClearColor(settings.color);
    playerOcclusionReveal.updateSettings(settings);
    for (const location of Object.values(locations)) {
      location.edgeShade?.update(settings);
      location.exitVisuals?.shadowMaterial.color.set(settings.color);
    }
  } });
  sceneRegistry.sync();
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
  }
  heroBody.maxHealth = 20 + campaignState.maxHealthBonus;
  const playerStart = resolveCampaignPlayerStart(locations[campaignState.currentLocationId], {
    health: savedCampaign?.playerHealth, maxHealth: heroBody.maxHealth, position: savedCampaign?.playerPosition,
  });
  heroBody.health = playerStart.health;
  heroBody.x = playerStart.position.x; heroBody.z = playerStart.position.z;
  const savedLastSafePosition = resolveCampaignPlayerStart(locations[campaignState.currentLocationId], {
    health: heroBody.health, maxHealth: heroBody.maxHealth, position: savedCampaign?.lastSafePosition,
  }).position;
  heroBody.lastSafePosition = savedCampaign?.lastSafePosition && isCampaignPositionSafe(
    locations[campaignState.currentLocationId], savedCampaign.lastSafePosition)
    ? savedLastSafePosition : { ...playerStart.position };
  for (const location of Object.values(locations)) location.obstacles = [];
  for (const location of Object.values(locations)) location.loot ??= [];
  let activeLocation = locations[campaignState.currentLocationId];
  const locationTitle = document.querySelector('#location-title');
  const locationDetail = document.querySelector('#location-detail');
  const interactButton = document.querySelector('#interact');
  const dialoguePanel = document.querySelector('#story-dialogue');
  const inventoryPanel = document.querySelector('#inventory-panel');
  const mapPanel = document.querySelector('#world-map');
  const mapButton = document.querySelector('#map-toggle');
  const locationMap = createLocationMapView({ root: mapPanel,
    viewport: document.querySelector('#world-map-viewport'), graph: document.querySelector('#world-map-graph'),
    progress: document.querySelector('#world-map-progress'), openButton: mapButton,
    closeButton: document.querySelector('#world-map-close'), campaign: CAMPAIGN, edges: CAMPAIGN_EDGES });
  let campaignGraphData = null, campaignGraphDataKey = null;
  function applyEditedAnchorsToGraphLayouts(layouts) {
    const editsByLocation = Object.fromEntries(Object.entries(SCENE_OVERRIDES.locations ?? {}).map(([id, edits]) => [id, { ...edits }]));
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
    const sourceKey = JSON.stringify({ fog: sceneRegistry.fog, location: activeLocation?.id,
      edges: activeCampaignGraph?.edges, graphEdits });
    if (campaignGraphData && sourceKey === campaignGraphDataKey) {
      campaignGraphData.graph = activeCampaignGraph ?? campaignGraphData.graph;
      if (includeVisuals && !campaignGraphData.visuals) {
        const layouts = createCampaignLocations(createLocationNetwork(), LOCATION_SCALE);
        applyEditedAnchorsToGraphLayouts(layouts);
        if (activeLocation?.layoutReady) layouts[activeLocation.id] = activeLocation;
        campaignGraphData.visuals = createCampaignNodeVisuals(layouts, campaignGraphData.graph, sceneRegistry.fog);
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
    const visuals = includeVisuals ? createCampaignNodeVisuals(layouts, graph, sceneRegistry.fog) : null;
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
  let sceneEditor = null;
  const audioControls = createAudioControls({ audio, root: document.querySelector('#audio-panel'),
    trigger: document.querySelector('#audio-toggle'), onOpen() { inputController?.cancel(); } });
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
    getState: () => campaignState, getHealth: () => ({ health: heroBody.health, maxHealth: heroBody.maxHealth }),
    onOpen() { inputController?.cancel(); },
    onUse(id, slotIndex) {
      const result = consumeInventoryItem(campaignState, id, heroBody.health, heroBody.maxHealth);
      if (result.consumed) {
        audio.play(id === 'bandage' ? 'bandage' : 'eat');
        heroBody.health = result.health;
        campaignState.inventorySlots[slotIndex] = null;
        persistCampaign();
      }
      return result;
    },
  });
  const locationGroups = {};
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 280);
  const target = new THREE.Vector3(0, .65, 0);
  const orbit = { theta: .22, phi: .86, distance: innerWidth < 650 ? 27 : 15.75 };
  let cameraManualOverride = 0;
  scene.add(new THREE.HemisphereLight(0xfff8ea, 0x8f826a, 2.5));
  sunLight = new THREE.DirectionalLight();
  sunLight.position.set(...sceneRegistry.lighting.direction);
  sunLight.intensity = sceneRegistry.lighting.intensity;
  sunLight.color.set(sceneRegistry.lighting.color);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
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
  const heartMaterials = heartTextures.map(map => new THREE.MeshBasicMaterial({ map, transparent: true,
    side: THREE.DoubleSide, depthWrite: false, depthTest: false }));
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
    await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
    sliceStarted = performance.now();
  };
  const geometryClient = createGeometryClient(THREE,
    { paper, grain: cardboardGrain, corrugation, terrainCorrugation }, yieldLocationWork);
  const createFigure = createFigureFactory({ THREE, scene, renderer, ambientShadowMaterial, contactShadowMaterial,
    corrugation, paper, sceneStencil, heartMaterials, geometryClient,
    createEnemyMarker: (...args) => createVectorMarker(...args), groundUiY: GROUND_UI_Y });
  const scenerySystem = createScenerySystem({ THREE, renderer, scene, locations, corrugation,
    paper, terrainCorrugation, sceneStencil, geometryClient });
  const { create: createScenery, loadTemplate: loadSceneryTemplate, loadStateTemplates,
    createSprite: createScenerySpriteModel, facePairs: sceneryFacePairs } = scenerySystem;
  const figures = [];
  const heroFigure = await createFigure(heroBody, 'hero');
  heroFigure.facing = 0;
  heroFigure.group.rotation.y = 0;
  orbit.theta = Math.PI;
  target.set(heroBody.x, .65, heroBody.z);
  heroFigure.locationId = 'home'; figures.push(heroFigure);
  const revealTarget = new THREE.Vector3();
  function updatePlayerReveal() {
    revealTarget.set(heroFigure.group.position.x, 1.05, heroFigure.group.position.z);
    playerOcclusionReveal.update(camera, revealTarget, heroBody.health > 0 && heroFigure.group.visible);
  }
  const enemyBody = (id, locationId, x, z, options = {}) => {
    const stored = campaignState.world?.[locationId]?.enemies?.find(enemy => enemy.id === id);
    return {
    id, team: 'enemy', locationId, x: stored?.x ?? x, z: stored?.z ?? z, vx: stored?.vx ?? 0, vz: stored?.vz ?? 0,
    health: Math.min(options.maxHealth ?? 32, stored?.health ?? options.health ?? 32), maxHealth: options.maxHealth ?? 32,
    charges: stored?.charges ?? 3, maxCharges: 3, rechargeTimer: stored?.rechargeTimer ?? 0,
    aiPhase: stored?.aiPhase ?? 'pause', aiTimer: stored?.aiTimer ?? randomBetween(1, 4),
    aiAimAngle: stored?.aiAimAngle, aiAimDuration: stored?.aiAimDuration,
    aiTargetX: stored?.aiTargetX, aiTargetZ: stored?.aiTargetZ, aiStunRemaining: stored?.aiStunRemaining ?? 0,
    directHitProtection: stored?.directHitProtection ?? false, attackRicochets: stored?.attackRicochets ?? 0,
    lootDropped: stored?.lootDropped ?? false, defeatRecorded: stored?.defeatRecorded ?? false,
    hitCooldown: stored?.hitCooldown ?? 0,
    combatAwake: stored?.combatAwake ?? options.combatAwake ?? false,
    spawnReady: stored?.spawnReady ?? options.spawnReady ?? true,
    boss: options.boss ?? false,
    archetype: options.archetype ?? 'goblin', damageQuarters: options.damageQuarters ?? 4,
    fell: stored?.fell ?? false,
    };
  };
  const forestSpawns = [{ x: scaled(-3.1), z: scaled(.3) }, { x: scaled(3.1), z: scaled(.3) }];
  const campSpawns = CAMP_GOBLIN_SPAWNS.map((spawn, index) => ({
    x: scaled(spawn.x), z: scaled(spawn.z),
    hutX: scaled(CAMP_HUT_ANCHORS[index].x), hutZ: scaled(CAMP_HUT_ANCHORS[index].z),
  }));
  async function createLocationEnemies(location) {
    if (location.id === 'forest')
    for (let index = 0; index < forestSpawns.length; index++) {
      const point = forestSpawns[index];
      const body = enemyBody(`forest-goblin-${index + 1}`, 'forest', point.x, point.z,
        { combatAwake: locations.forest.combatTriggered });
      locations.forest.enemies.push(body);
      const figure = await createFigure(body, 'goblin');
      figure.locationId = 'forest'; figure.group.visible = false; figure.healthHUD.visible = false;
      figure.enemyMarker.group.visible = false; figures.push(figure);
    }
    if (location.id === 'camp')
    for (let index = 0; index < campSpawns.length; index++) {
      const point = campSpawns[index];
      const body = enemyBody(`camp-goblin-${index + 1}`, 'camp', point.x, point.z, { spawnReady: false, combatAwake: true });
      locations.camp.enemies.push(body);
      const figure = await createFigure(body, 'goblin');
      figure.locationId = 'camp'; figure.spawnSource = { x: point.hutX, z: point.hutZ }; figure.spawnStarted = false;
      figure.group.visible = false; figure.healthHUD.visible = false; figure.enemyMarker.group.visible = false;
      figures.push(figure);
    }
    for (const encounter of STORY_ENCOUNTERS.filter(encounter => encounter.location === location.id)) for (const unit of encounter.units) {
      const body = enemyBody(`${encounter.location}-${unit.id}`, encounter.location,
        scaled(unit.x), scaled(unit.z), { combatAwake: true, archetype: unit.type, ...ENEMY_STATS[unit.type] });
      body.lastSafePosition = { x: body.x, z: body.z };
      locations[encounter.location].enemies.push(body);
      const figure = await createFigure(body, unit.type);
      figure.locationId = encounter.location; figure.group.visible = false;
      figure.healthHUD.visible = false; figure.enemyMarker.group.visible = false;
      figures.push(figure);
    }
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
  const initialStoryCard = initialVisit?.firstVisit ? { title: activeLocation.title, text: activeLocation.campaignIntro,
    lines: getStoryDialogue(campaignState, activeLocation.id, 'intro') } : null;
  renderInventory();
  function setVisualState(figure, visualState) {
    const art = figure.artStates[visualState];
    for (const [name, stateArt] of Object.entries(figure.artStates)) stateArt.group.visible = name === visualState;
    if (figure.visualState === visualState) return;
    figure.artGroup = art.group;
    figure.alphaPixels = art.alphaPixels;
    figure.width = art.width;
    figure.height = art.height;
    figure.flashMaterial = art.frontArt.flashMaterial;
    figure.backFlashMaterial = art.backArt.flashMaterial;
    figure.visualState = visualState;
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
        : figure.hurtAge < .55 ? 'on-hit'
          : figure.dealDamageAge < .32 ? 'deal-damage'
            : body.team === 'enemy' && body.aiPhase === 'aim' ? 'aiming' : 'idle';
      setVisualState(figure, visualState);
      figure.healthHUD.position.set(body.x, 2.65, body.z);
      figure.healthHUD.quaternion.copy(camera.quaternion);
      if (figure.enemyMarker) {
        figure.enemyMarker.group.position.set(body.x, GROUND_UI_Y, body.z);
        figure.enemyMarker.group.rotation.y = body.aiPhase === 'aim' ? body.aiAimAngle : figure.facing;
      }
    }
    playerMarker.group.position.set(state.x, GROUND_UI_Y, state.z);
    for (const { prop, front, back } of sceneryFacePairs) {
      const dx = camera.position.x - prop.position.x, dz = camera.position.z - prop.position.z;
      const cameraOnFront = dx * Math.sin(prop.rotation.y) + dz * Math.cos(prop.rotation.y) >= 0;
      front.visible = cameraOnFront;
      back.visible = !cameraOnFront;
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
      front.visible = cameraOnFront; back.visible = !cameraOnFront;
    }
  }
  let activeFigure = figures[0];
  let selectionAge = .6;
  let elapsed = 0;
  let transitionCooldown = 0;
  let locationTransition = false;
  let victorySequenceActive = false;
  const debugMode = new URLSearchParams(location.search).has('debug');
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
      const body = enemyBody('camp-ogre-pool', 'camp', 0, 0,
        { health: 0, maxHealth: 48, spawnReady: false, combatAwake: true, boss: true });
      const figure = await createFigure(body, 'ogre');
      figure.locationId = 'camp'; figure.poolDormant = true;
      figure.group.visible = false; figure.healthHUD.visible = false; figure.enemyMarker.group.visible = false;
      figures.push(figure); campOgrePool = figure;
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
        figures.push(figure); campGoblinPool.push(figure);
        await yieldFrameWork();
      }
    })().catch(error => { campPreloadPromise = null; throw error; });
    try { await campPreloadPromise; }
    finally { campPreloadPromise = null; }
  }
  let campRestorePromise = null;
  async function restoreSavedCampEnemies() {
    const storedEnemies = campaignState.world?.camp?.enemies;
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
          isBoss ? { health: 48, maxHealth: 48, combatAwake: true, boss: true }
            : { health: 32, maxHealth: 32, combatAwake: true });
        body.spawnReady = true;
        figure.body = body; figure.group.userData.figure = figure; figure.poolDormant = false;
        figure.spawnAnimation = null; figure.victoryAnimation = null; figure.bossScale = isBoss ? 1.35 : 1;
        figure.hitAge = 10; figure.hitStrength = 0; figure.hurtAge = 10; figure.dealDamageAge = 10;
        figure.viewBack = false; figure.locationId = 'camp';
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
  function snapshotLocation(location) {
    if (!location.runtimeReady) return campaignState.world?.[location.id] ?? {};
    return {
      actors: storyActors.actors.filter(actor => actor.spec.location === location.id)
        .map(actor => ({ id: actor.spec.id, x: actor.body.x, z: actor.body.z })),
      enemies: location.enemies.map(enemy => ({ ...enemy })),
      defeats: location.defeats, goblinsSpawned: location.goblinsSpawned,
      reinforcementQueue: (location.reinforcementQueue ?? []).map(due => Math.max(0, due - elapsed)), bossSpawned: location.bossSpawned,
      initialized: location.initialized, combatTriggered: location.combatTriggered,
      lastExitPositions: location.lastExitPositions,
      loot: location.loot.map(({ id, itemId, x, z }) => ({ id, itemId, x, z })),
    };
  }
  function persistCampaign() {
    campaignState.currentLocationId = activeLocation.id;
    campaignState.playerHealth = heroBody.health;
    campaignState.playerPosition = { x: heroBody.x, z: heroBody.z };
    campaignState.lastSafePosition = { ...heroBody.lastSafePosition };
    campaignState.elapsed = elapsed;
    campaignState.world = Object.fromEntries(Object.values(locations).map(location => [location.id, snapshotLocation(location)]));
    try { localStorage.setItem(CAMPAIGN_SAVE_KEY, JSON.stringify(campaignState)); } catch (error) {
      console.warn('Не удалось сохранить поход', error);
    }
  }
  document.querySelector('#inventory-toggle').addEventListener('click', () => {
    if (dialogue.isOpen() || locationTransition) return;
    inventory.open();
  });
  mapButton.addEventListener('click', () => {
    if (dialogue.isOpen()) return;
    inputController?.cancel(); inventory.hide();
    try {
      const graphData = ensureCampaignGraphData(campaignState, { includeVisuals: false });
      locationMap.setCampaignGraph(activeCampaignGraph ?? graphData.graph);
      locationMap.show(campaignState);
    } catch (error) {
      const message = document.querySelector('#error'); message.hidden = false;
      message.textContent = `Не удалось построить карту мира: ${error.message}`;
    }
  });
  interactButton.addEventListener('click', () => {
    const result = inspectCampaignLocation(campaignState, activeLocation.id);
    if (!result) return;
    persistCampaign(); renderInventory();
    showStoryCard({ ...result, lines: campaignState.collected[activeLocation.id] ? []
      : getStoryDialogue(campaignState, activeLocation.id) });
  });
  document.querySelector('#restart').addEventListener('click', () => {
    try { localStorage.removeItem(CAMPAIGN_SAVE_KEY); } catch { /* A fresh session still starts at home. */ }
    location.reload();
  });

  const chestVisuals = new Map();
  const worldItemVisuals = new Map();
  const storyPickupVisuals = new Map();
  const lootItemIds = ['berries', 'hardtack', 'jerky', 'bandage', 'scrap', 'nuts', 'bladeShard'];
  const lootSpriteModels = new Map();
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
        lootSpriteModels.set(id, await createScenerySpriteModel(canvas));
      }
      lootAtlas.dispose();
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
  function createLootVisual(location, item, source = null) {
    const group = new THREE.Group();
    group.name = item.id;
    const model = lootSpriteModels.get(item.itemId) ?? lootSpriteModels.get('scrap');
    const icon = model.group.clone(true), iconHeight = .54 * 3, iconScale = iconHeight / 2.05;
    icon.scale.set(iconScale, iconScale, 1); icon.position.y = .11 + iconHeight / 2; group.add(icon);
    const facePair = { prop: group, front: icon.getObjectByName('scenery-front'), back: icon.getObjectByName('scenery-back') };
    sceneryFacePairs.push(facePair);
    const rays = new THREE.Sprite(lootRayMaterial); rays.name = 'loot-rays';
    rays.scale.set(1.9, 1.9, 1); rays.position.set(0, icon.position.y, -.12); rays.renderOrder = 4; group.add(rays);
    const glints = lootGlintOffsets.map(([x, y], index) => {
      const sprite = new THREE.Sprite(lootGlintMaterial.clone()); sprite.name = `loot-glint-${index}`;
      sprite.position.set(x, icon.position.y + y, .12); sprite.scale.setScalar(.22); sprite.renderOrder = 7; group.add(sprite); return sprite;
    });
    group.position.set(item.x, 0, item.z);
    location.sceneGroup.add(group);
    const visual = { group, icon, rays, glints, facePair, spawn: source ? { ...source, age: 0, duration: .62 } : null };
    worldItemVisuals.set(item.id, visual);
    return visual;
  }
  function createStoryPickupVisual(location, pickup) {
    const group = new THREE.Group(); group.name = pickup.id;
    const icon = new THREE.Mesh(storyPickupIconGeometry, storyPickupIconMaterial);
    icon.position.y = .34; icon.renderOrder = 6; group.add(icon);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(.34, 28),
      new THREE.MeshBasicMaterial({ color: 0xffd879, transparent: true, opacity: .075, depthWrite: false, toneMapped: false }));
    glow.rotation.x = -Math.PI / 2; glow.position.y = .018; group.add(glow);
    const beam = new THREE.Mesh(lootBeamGeometry, lootBeamMaterial);
    beam.scale.set(1.02, 1.7, 1); beam.position.set(0, 1.08, -.025); beam.renderOrder = 5; group.add(beam);
    group.position.set(pickup.x, 0, pickup.z); location.sceneGroup.add(group);
    const visual = { group, beam, glow, spin: 0 };
    storyPickupVisuals.set(pickup.id, visual);
    return visual;
  }
  async function makeCacheBody(location, chestTemplates) {
    const position = location.cachePosition ?? [{ x: scaled(3.4), z: 0 }, { x: scaled(-3.4), z: 0 },
      { x: 0, z: scaled(3.4) }, { x: 0, z: scaled(-3.4) }]
      .find(point => isCampaignPositionSafe(location, point, 1.5)) ?? location.entry;
    const opened = Boolean(campaignState.collected[location.id]);
    const body = { id: `cache-${location.id}`, kind: 'cache-chest', team: 'neutral', locationId: location.id,
      x: position.x, z: position.z, vx: 0, vz: 0, radius: 1.12, fixed: true, opened };
    location.cacheBody = body;
    if (!opened) location.obstacles.push(body);
    const group = new THREE.Group(); group.name = body.id;
    group.userData.sceneEditId = 'interactive:cache'; group.userData.sceneEditLabel = 'Сундук';
    group.userData.sceneEditCategory = 'interactive'; group.userData.sceneEditBody = body;
    group.userData.sceneEditSync = () => { body.x = group.position.x; body.z = group.position.z; };
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.22, 48), ambientShadowMaterial);
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = .008; group.add(shadow);
    const puck = new THREE.Mesh(new THREE.CylinderGeometry(body.radius, body.radius, .2, 64), [
      new THREE.MeshStandardMaterial({ map: corrugation, roughness: 1, ...sceneStencil }),
      new THREE.MeshStandardMaterial({ map: paper, roughness: .96, ...sceneStencil }),
      new THREE.MeshStandardMaterial({ color: 0x97713e, ...sceneStencil }),
    ]);
    puck.position.y = .1; puck.visible = !opened; puck.scale.setScalar(opened ? 0 : 1);
    puck.castShadow = true; puck.receiveShadow = true; group.add(puck);
    const artHolder = new THREE.Group(); artHolder.position.y = opened ? 0 : .21; group.add(artHolder);
    const stateArt = chestTemplates.map((template, index) => {
      const art = template.clone(true);
      const spriteHeight = 1.72, scale = spriteHeight / 2.05;
      art.scale.set(scale, scale, 1); art.position.y = spriteHeight / 2;
      art.visible = index === (opened ? 1 : 0); artHolder.add(art);
      sceneryFacePairs.push({ prop: group, front: art.getObjectByName('scenery-front'), back: art.getObjectByName('scenery-back') });
      return art;
    });
    group.position.set(body.x, 0, body.z); location.sceneGroup.add(group);
    chestVisuals.set(location.id, { body, group, puck, artHolder, stateArt,
      opening: null, lootVisuals: [], pendingStory: null });
  }
  let groundResources = null;
  async function createEditorAsset(location, id, value) {
    const item = catalogAsset(value.asset);
    if (!item) throw new Error(`Unknown scene asset: ${value.asset}`);
    const prop = await createScenery(value.asset, value.position[0], value.position[2], value.size, location.sceneGroup, true,
      { elevation: value.position[1], yaw: value.rotation[1], fixedRadius: Math.min(.7, value.size * .19),
        sceneEditId: id, sceneEditLabel: item.label });
    prop.position.fromArray(value.position); prop.rotation.set(...value.rotation); prop.scale.fromArray(value.scale);
    prop.userData.sceneEditAsset = value.asset; prop.userData.sceneEditSize = value.size;
    location.edgeShade?.applyTo(prop); return prop;
  }
  async function buildLocation(id, stillWanted) {
    const location = locations[id];
    const checkpoint = async () => {
      await yieldLocationWork();
      if (!stillWanted()) throw new Error('Location preparation cancelled');
    };
    await checkpoint();
    let rebuildLayout = !location.layoutReady;
    if (location.art.depthMapUrl && !location.art.depthMap) {
      await loadLocationDepthMaps({ [id]: location });
      rebuildLayout = true;
    }
    const terrain = await geometryClient.run('terrain', {
      id, scale: LOCATION_SCALE, layoutReady: !rebuildLayout,
      heightSeed: location.heightSeed, walkablePoints: location.walkablePoints,
      exits: location.exits, dropZones: location.dropZones, hazards: location.hazards,
      art: location.art, terrainStyle: location.terrainStyle, terrainEdits: sceneRegistry.terrainEdits(id) });
    if (terrain.layout) Object.assign(location, terrain.layout);
    if (activeCampaignGraph) { applyCampaignGraphToLocation(location, activeCampaignGraph); sceneRegistry.graphChanged(location); }
    applyTerrainEdgeStyle(terrain.group, THREE, sceneRegistry.terrainStyle);
    location.sceneGroup = terrain.group; locationGroups[id] = terrain.group;
    terrain.group.visible = false; scene.add(terrain.group);
    location.terrainHeightMap = restoreTerrainSampler(terrain.heightMap,
      { rounded: terrain.rounded, depthMap: Boolean(location.art.depthMap), walkablePoints: location.walkablePoints });
    delete location.terrainHeightMap.layers;
    terrain.group.userData.terrainHeightMap = location.terrainHeightMap;
    terrain.group.userData.walkablePoints = location.walkablePoints;
    location.edgeShade = await createLocationEdgeShade({ THREE, location, settings: sceneRegistry.fog,
      revealUniforms: playerOcclusionReveal.uniforms, yieldWork: checkpoint });
    location.edgeShade?.update(sceneRegistry.fog);
    if (location.edgeShade?.texture) renderer.initTexture(location.edgeShade.texture);
    await checkpoint();
    await createLocationEnemies(location);
    if (id === 'camp') {
      location.reinforcementQueue = (campaignState.world?.camp?.reinforcementQueue ?? []).map(due => due + elapsed);
      await restoreSavedCampEnemies();
      await preloadCampEnemies();
      if (!location.bossSpawned) await preloadCampOgre();
    }
    await checkpoint();
    if (location.enemies.length || location.secret || location.loot.length) await ensureLootSprites();
    await populateNarrativeScenery({ locations: { [id]: location }, createScenery, loadTemplate: loadSceneryTemplate,
      scale: LOCATION_SCALE, hutAnchors: CAMP_HUT_ANCHORS, puckRadius: PUCK_RADIUS, yieldWork: checkpoint });
    const actors = await createStoryActors({ locations: { [id]: location }, createScenery, scale: LOCATION_SCALE, campaign: campaignState });
    storyActors.actors.push(...actors.actors);
    await checkpoint();
    groundResources = await createGroundRenderer({ THREE, renderer, locations: { [id]: location }, specsByLocation: decorationSpecs,
      pathTargets: { camp: CAMP_HUT_ANCHORS.map(hut => ({ x: scaled(hut.x), z: scaled(hut.z) })) },
      createLocationWalkPaths, scatterGroundDetails, resources: groundResources, geometryClient, yieldWork: checkpoint });
    const exitLocked = locationHasLivingEnemies(location);
    location.exitBarriers = createExitBarrierBodies(location);
    if (exitLocked) location.obstacles.push(...location.exitBarriers);
    location.exitVisuals = createLocationExitVisuals({ THREE, location, locked: exitLocked });
    location.exitVisuals.shadowMaterial.color.set(sceneRegistry.fog.color);
    if (location.secret) await makeCacheBody(location, await loadStateTemplates('assets/chest-states.png', 2));
    for (const item of location.loot) { createLootVisual(location, item); await checkpoint(); }
    for (const pickup of location.storyPickups ?? []) if (!campaignState.flags[pickup.flag]) createStoryPickupVisual(location, pickup);
    await sceneRegistry.restorePlaced(location, createEditorAsset);
    sceneRegistry.prepare(location);
    for (const figure of figures) if (figure.locationId === id && figure.body.team === 'enemy')
      sceneRegistry.bindEntity(location, `enemy:${figure.body.id}`, `Враг · ${figure.body.archetype}`, figure.group, {
        category: 'enemies', deletable: false,
        sync() { figure.body.x = figure.group.position.x; figure.body.z = figure.group.position.z; figure.facing = figure.group.rotation.y; },
      });
    location.edgeShade?.applyTo(location.sceneGroup);
    // Upload each bitmap while the scene is hidden, instead of uploading all of
    // a neighboring location's textures in its first visible frame.
    const roots = [location.sceneGroup, ...figures.filter(figure => figure.locationId === id).map(figure => figure.group)];
    if (!frameWorkStarted) roots.push(heroFigure.group);
    for (const resource of sceneResources(roots)) if (resource.isTexture) { renderer.initTexture(resource); await checkpoint(); }
    await checkpoint();
    location.runtimeReady = true;
    return location;
  }
  async function rebuildLocationTerrain(location, edits) {
    if (!location?.runtimeReady || !location.sceneGroup) return;
    const result = await geometryClient.run('terrain', {
      id: location.id, scale: LOCATION_SCALE, layoutReady: true, heightSeed: location.heightSeed,
      walkablePoints: location.walkablePoints, exits: location.exits, dropZones: location.dropZones,
      hazards: location.hazards, art: location.art, terrainStyle: location.terrainStyle, terrainEdits: edits,
    });
    const isTerrain = object => /^(terrain|playfield)-top-/.test(object.name);
    const removed = location.sceneGroup.children.filter(isTerrain);
    for (const object of removed) location.sceneGroup.remove(object);
    const replacement = result.group.children.filter(isTerrain);
    applyTerrainEdgeStyle(result.group, THREE, sceneRegistry.terrainStyle);
    location.edgeShade?.applyTo(result.group);
    for (const object of replacement) location.sceneGroup.add(object);
    location.terrainHeightMap = restoreTerrainSampler(result.heightMap,
      { rounded: result.rounded, depthMap: Boolean(location.art.depthMap), walkablePoints: location.walkablePoints });
    delete location.terrainHeightMap.layers;
    location.sceneGroup.userData.terrainHeightMap = location.terrainHeightMap;
    disposeUnusedScenes([removed, result.group], [location.sceneGroup],
      [paper, cardboardGrain, corrugation, terrainCorrugation]);
    renderer.renderLists.dispose();
  }
  async function releaseLocation(id) {
    const location = locations[id], removed = [];
    sceneRegistry.release(id);
    if (location.runtimeReady) campaignState.world[id] = snapshotLocation(location);
    if (location.sceneGroup) { removed.push(location.sceneGroup); scene.remove(location.sceneGroup); }
    for (let index = figures.length - 1; index >= 0; index--) {
      const figure = figures[index];
      if (figure === heroFigure || figure.locationId !== id) continue;
      for (const group of [figure.group, figure.healthHUD, figure.enemyMarker?.group].filter(Boolean)) {
        scene.remove(group); removed.push(group);
      }
      figures.splice(index, 1);
    }
    const belongs = object => removed.some(root => { for (let p = object; p; p = p.parent) if (p === root) return true; return false; });
    for (let index = sceneryFacePairs.length - 1; index >= 0; index--)
      if (belongs(sceneryFacePairs[index].prop)) sceneryFacePairs.splice(index, 1);
    for (const cache of [worldItemVisuals, storyPickupVisuals]) for (const [key, visual] of cache)
      if (belongs(visual.group)) cache.delete(key);
    for (let index = storyActors.actors.length - 1; index >= 0; index--)
      if (storyActors.actors[index].spec.location === id) storyActors.actors.splice(index, 1);
    chestVisuals.delete(id); delete locationGroups[id];
    delete location.sceneGroup; delete location.terrainHeightMap; delete location.groundDetails;
    delete location.edgeShade;
    delete location.cacheBody; delete location.exitVisuals; delete location.exitBarriers;
    location.enemies = []; location.obstacles = []; location.runtimeReady = false;
    if (id === 'camp') { campGoblinPool.length = 0; campOgrePool = null; }
    const retained = [scene, ...[...lootSpriteModels.values()].map(model => model.group)];
    removed.push(...await createFigure.releaseUnused(new Set(figures.map(figure => figure.prefix))));
    removed.push(...await scenerySystem.releaseUnused(retained));
    disposeUnusedScenes(removed, retained, [paper, cardboardGrain, corrugation, terrainCorrugation,
      ambientShadowMaterial, contactShadowMaterial, ...heartMaterials,
      ...heartTextures, puckAmbientShadow, figureContactShadow, lootBeamGeometry, lootBeamMaterial, lootBeamTexture,
      lootRayMaterial, lootRayTexture, lootGlintTexture, lootGlintMaterial,
      storyPickupIconGeometry, storyPickupIconMaterial, storyPickupIconMaterial.map,
      ...[...(groundResources?.materials.values() ?? [])], ...[...(groundResources?.textures.values() ?? [])]]);
    if (location.art.depthMapUrl) delete location.art.depthMap;
    renderer.renderLists.dispose();
  }
  const locationStreaming = createLocationStreaming({
    neighbors: id => locations[id].exits.map(exit => exit.to).filter(Boolean), build: buildLocation, release: releaseLocation,
    schedule: callback => requestAnimationFrame(() => setTimeout(callback, 0)),
    onError: error => console.error('Не удалось подготовить соседнюю локацию', error),
  });

  function refreshLocationInfo() {
    locationTitle.textContent = activeLocation.title;
    const progress = `${campaignState.visited.length}/${CAMPAIGN.length} мест`;
    if (activeLocation.kind === 'forest') locationDetail.textContent = activeLocation.combatTriggered
      ? `Гоблины напали · ${progress}` : `Следы деда уходят в лес · ${progress}`;
    else if (activeLocation.kind === 'camp') locationDetail.textContent = activeLocation.bossSpawned
      ? `Вожак вышел · ${progress}`
      : `Лагерь: ${activeLocation.defeats}/${CAMP_BOSS_DEFEATS} побед · ${progress}`;
    else locationDetail.textContent = activeLocation.campaignIntro.length > 54
      ? `${activeLocation.campaignIntro.slice(0, 52)}… · ${progress}`
      : `${activeLocation.campaignIntro} · ${progress}`;
  }
  function rebuildBodies() {
    bodies = [heroBody, ...activeLocation.obstacles.filter(body => body.active !== false), ...activeLocation.enemies.filter(body => body.spawnReady)];
  }
  rebuildBodies();
  function showActiveLocationFigures() {
    for (const figure of figures) {
      const active = figure.body === heroBody || figure.locationId === activeLocation.id;
      const spawning = Boolean(figure.spawnAnimation);
      figure.group.visible = !figure.poolDormant && !figure.body.fell && active && (!spawning || figure.spawnAnimation.age >= 0);
      figure.healthHUD.visible = active && shouldShowHealthHud(figure.body.team, figure.body.health, figure.body.maxHealth) && !spawning;
      if (figure.enemyMarker) figure.enemyMarker.group.visible = active && !victorySequenceActive
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
  function beginVictorySequence() {
    if (victorySequenceActive) return;
    victorySequenceActive = true;
    audio.play('defeat');
    inputController.cancel(); selected = false;
    playerMarker.group.visible = false;
    heroBody.vx = 0; heroBody.vz = 0;
    for (const location of Object.values(locations)) settleEnemiesForVictory(location.enemies);
    for (const figure of figures) startUnitVictory(figure);
    rebuildBodies();
  }
  function beginSpawn(figure, from) {
    figure.spawnSource = from;
    figure.spawnAnimation = { age: 0, duration: .78, fromX: from.x, fromZ: from.z };
    const isCurrentLocation = activeLocation.id === figure.locationId;
    figure.group.visible = isCurrentLocation;
    figure.healthHUD.visible = false;
    if (figure.enemyMarker) figure.enemyMarker.group.visible = false;
  }
  async function spawnCampGoblin(source = null, boss = false) {
    await preloadCampEnemies();
    if (boss) await preloadCampOgre();
    const figure = boss ? campOgrePool : campGoblinPool.pop();
    if (!figure) return null;
    const spawn = source ?? campSpawnPoints[Math.floor(Math.random() * campSpawnPoints.length)];
    if (boss) campOgrePool = null;
    const body = enemyBody(boss ? 'camp-ogre' : `camp-goblin-${locations.camp.goblinsSpawned + 1}`,
      'camp', spawn.x, spawn.z, boss
        ? { health: 48, maxHealth: 48, combatAwake: true, spawnReady: false, boss: true }
        : { combatAwake: true, spawnReady: false });
    body.aiPhase = 'pause'; body.aiTimer = randomBetween(.4, 1.2);
    figure.body = body; figure.group.userData.figure = figure; figure.poolDormant = false;
    figure.spawnAnimation = null; figure.victoryAnimation = null; figure.bossScale = boss ? 1.35 : 1;
    figure.hitAge = 10; figure.hitStrength = 0; figure.hurtAge = 10; figure.dealDamageAge = 10;
    figure.viewBack = false; setVisualState(figure, 'idle');
    locations.camp.enemies.push(body);
    figure.locationId = 'camp';
    if (boss) {
      figure.bossScale = 1.35;
      figure.spawnSource = { x: 0, z: scaled(-6.1) };
    } else figure.spawnSource = { x: spawn.hutX, z: spawn.hutZ };
    beginSpawn(figure, figure.spawnSource);
    if (victorySequenceActive) startUnitVictory(figure);
    if (activeLocation.id === 'camp') refreshLocationInfo();
    return figure;
  }
  async function enterLocation(locationId, fromLocationId) {
    const next = locations[locationId];
    if (!next || locationTransition) return;
    rememberExitPosition(activeLocation, locationId, heroBody);
    inputController.cancel();
    persistCampaign();
    locationTransition = true;
    loading.hidden = locationStreaming.isReady(locationId);
    try {
      const prepared = await locationStreaming.retain(locationId);
      if (!prepared) return false;
      heroFigure.victoryAnimation = null;
      clearProjectiles();
      activeLocation = next;
      audio.play('transition');
      dialogue.close();
      protectedEntryFrom = fromLocationId;
      const remembered = sceneRegistry.hasEdit(activeLocation.id, `arrival:${fromLocationId}`)
        ? null : lastExitPosition(activeLocation, fromLocationId);
      const arrival = remembered && isPlayableFloor(activeLocation, remembered.x, remembered.z, .2)
        ? remembered : locationArrival(activeLocation, fromLocationId);
      heroBody.x = arrival.x; heroBody.z = arrival.z; heroBody.vx = 0; heroBody.vz = 0;
      heroBody.lastSafePosition = { x: arrival.x, z: arrival.z };
      const direction = locationEntryDirection(activeLocation, fromLocationId);
      const heading = Math.atan2(direction.x, direction.z);
      heroFigure.facing = heading; heroFigure.group.rotation.y = heading;
      orbit.theta = heading + Math.PI;
      target.set(heroBody.x, .65, heroBody.z);
      transitionCooldown = .85;
      const visit = visitCampaignLocation(campaignState, activeLocation.id);
      storyActors.update();
      if (activeLocation.kind === 'camp') {
        activeLocation.initialized = true;
        for (const figure of figures.filter(item => item.locationId === 'camp' && !item.poolDormant
          && !item.body.boss && item.body.health > 0 && !item.body.spawnReady && !item.spawnAnimation)) {
          beginSpawn(figure, figure.spawnSource);
        }
      }
      showActiveLocationFigures();
      rebuildBodies();
      refreshLocationInfo();
      renderInventory();
      persistCampaign();
      prepareScenePresentation();
      if (visit?.firstVisit) showStoryCard({ title: activeLocation.title, text: activeLocation.campaignIntro,
        lines: getStoryDialogue(campaignState, activeLocation.id, 'intro') });
      return true;
    } catch (error) {
      console.error('Не удалось открыть локацию', error);
      document.querySelector('#error').hidden = false;
      document.querySelector('#error').textContent = `Не удалось подготовить локацию: ${error.message}. Попробуй перейти ещё раз.`;
      return false;
    } finally { locationTransition = false; loading.hidden = true; }
  }
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
  const stoneGeometry = new THREE.IcosahedronGeometry(.17, 0);
  const stoneMaterial = new THREE.MeshStandardMaterial({ color: 0xb6ac91, roughness: .86 });
  function clearProjectiles() {
    for (const shot of projectiles) scene.remove(shot.mesh);
    projectiles.length = 0;
  }
  function spawnStoneProjectile(shot) {
    if (projectiles.length >= 16) return;
    const mesh = new THREE.Mesh(stoneGeometry, stoneMaterial);
    mesh.position.set(shot.x, .58, shot.z); mesh.castShadow = true; scene.add(mesh);
    projectiles.push({ ...shot, mesh });
  }
  function updateProjectiles(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const shot = projectiles[i];
      const result = advanceStoneProjectile(shot, dt, heroBody, activeLocation.obstacles);
      shot.mesh.position.set(shot.x, .55 + Math.sin(Math.min(1, shot.age / shot.lifetime) * Math.PI) * .4, shot.z);
      shot.mesh.rotation.x += dt * 7;
      if (result.hitPlayer && damage(heroBody, shot.damageQuarters, 8)) {
        heroBody.vx += shot.vx * .24; heroBody.vz += shot.vz * .24;
        burst(heroBody.x, heroBody.z, .6); vibrate([35, 20, 35]);
      }
      if (result.expired) { scene.remove(shot.mesh); projectiles.splice(i, 1); }
    }
  }
  const burstGeometry = new THREE.RingGeometry(.15, .22, 40);
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
    const ring = new THREE.Mesh(burstGeometry, material);
    ring.rotation.x = -Math.PI / 2; group.add(ring);
    const dots = Array.from({ length: 6 }, () => {
      const dot = new THREE.Mesh(dustGeometry, material); group.add(dot); return dot;
    });
    bursts.push({ group, ring, dots, material, age: 0, strength });
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
  function openCache(body) {
    if (!body || body.opened || body.opening || body.locationId !== activeLocation.id) return false;
    const result = openCampaignCache(campaignState, body.locationId);
    if (!result) return false;
    body.opening = true;
    const visual = chestVisuals.get(activeLocation.id);
    if (visual) {
      visual.opening = createCacheOpening();
      visual.pendingStory = { ...result, lines: getStoryDialogue(campaignState, activeLocation.id) };
      const drops = spawnWorldLoot(activeLocation, body.id, body.x, body.z, result.rewards, true);
      visual.lootVisuals = drops.map(item => worldItemVisuals.get(item.id)).filter(Boolean);
    } else {
      body.opened = true; body.opening = false;
      activeLocation.obstacles = activeLocation.obstacles.filter(obstacle => obstacle !== body);
      spawnWorldLoot(activeLocation, body.id, body.x, body.z, result.rewards);
      showStoryCard({ ...result, lines: getStoryDialogue(campaignState, activeLocation.id) });
    }
    rebuildBodies();
    persistCampaign();
    refreshLocationInfo();
    return true;
  }
  function updateWorldLoot(dt) {
    for (const item of [...activeLocation.loot]) {
      let visual = worldItemVisuals.get(item.id);
      if (!visual) visual = createLootVisual(activeLocation, item);
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
      } else {
        visual.group.position.set(item.x, 0, item.z);
      }
      const cameraDx = camera.position.x - visual.group.position.x, cameraDz = camera.position.z - visual.group.position.z;
      const cameraOnFront = cameraDx * Math.sin(visual.group.rotation.y) + cameraDz * Math.cos(visual.group.rotation.y) >= 0;
      const faceSign = cameraOnFront ? 1 : -1;
      visual.rays.position.z = -faceSign * .12;
      lootRayMaterial.rotation = elapsed * .32;
      const pulse = .96 + Math.sin(elapsed * 2.7 + item.x * 2 + item.z) * .055;
      visual.rays.scale.setScalar(1.9 * pulse);
      for (let i = 0; i < visual.glints.length; i++) {
        const glint = visual.glints[i], phase = (elapsed * (1.35 + i * .13) + i * 1.9 + item.x * .4) % 3.4;
        const flash = Math.max(0, 1 - Math.abs(phase - 1.7) / .42);
        glint.position.z = faceSign * .12;
        glint.material.opacity = flash * .94;
        glint.material.rotation = elapsed * (i % 2 ? -.42 : .52) + i;
        glint.scale.setScalar(.07 + flash * .19);
      }
      if (heroBody.health <= 0 || Math.hypot(heroBody.x - item.x, heroBody.z - item.z) > PUCK_RADIUS + .35) continue;
      const pickup = takeWorldLoot(activeLocation.loot, item.id);
      if (!pickup) continue;
      activeLocation.sceneGroup.remove(visual.group);
      const facePairIndex = sceneryFacePairs.indexOf(visual.facePair);
      if (facePairIndex >= 0) sceneryFacePairs.splice(facePairIndex, 1);
      worldItemVisuals.delete(item.id);
      for (const glint of visual.glints) glint.material.dispose();
      addItems(campaignState, { [pickup.itemId]: 1 });
      audio.play('pickup');
      renderInventory();
      burst(item.x, item.z, .48);
      vibrate(16);
      persistCampaign();
    }
    for (const pickup of activeLocation.storyPickups ?? []) {
      if (campaignState.flags[pickup.flag]) continue;
      let visual = storyPickupVisuals.get(pickup.id);
      if (!visual) visual = createStoryPickupVisual(activeLocation, pickup);
      visual.group.rotation.y = Math.atan2(camera.position.x - pickup.x, camera.position.z - pickup.z) + visual.spin;
      const pulse = .9 + Math.sin(elapsed * 3.6 + pickup.z) * .09;
      visual.beam.scale.y = 1.7 * pulse;
      visual.beam.position.y = .34 + .74 * pulse;
      visual.beam.material.opacity = .86 + (Math.sin(elapsed * 4 + pickup.x) + 1) * .07;
      visual.glow.material.opacity = .055 + (Math.sin(elapsed * 4 + pickup.z) + 1) * .025;
      if (heroBody.health <= 0 || Math.hypot(heroBody.x - pickup.x, heroBody.z - pickup.z) > PUCK_RADIUS + .35) continue;
      const collected = collectCampaignStoryPickup(campaignState, activeLocation.id, pickup.id);
      if (!collected) continue;
      audio.play('clue');
      activeLocation.sceneGroup.remove(visual.group); storyPickupVisuals.delete(pickup.id);
      visual.glow.geometry.dispose(); visual.glow.material.dispose();
      burst(pickup.x, pickup.z, .7); vibrate(24); persistCampaign();
      showStoryCard({ title: activeLocation.title, text: 'Ты подобрал вещь, которую дед потерял у ручья.',
        lines: getStoryDialogue(campaignState, activeLocation.id, 'pickup') });
      break;
    }
  }
  function updateCacheAnimation(dt) {
    const visual = chestVisuals.get(activeLocation.id);
    if (!visual?.opening) return;
    const motion = advanceCacheOpening(visual.opening, dt);
    visual.artHolder.position.y = motion.holderY + motion.lift;
    visual.artHolder.scale.set(motion.scaleX, motion.scaleY, 1);
    visual.puck.scale.setScalar(motion.puckScale);
    if (motion.landed) {
      burst(visual.body.x, visual.body.z, .72);
      vibrate(28);
    }
    if (motion.opened) {
      visual.body.opened = true; visual.body.opening = false;
      activeLocation.obstacles = activeLocation.obstacles.filter(obstacle => obstacle !== visual.body);
      visual.puck.visible = false;
      visual.stateArt[0].visible = false;
      visual.stateArt[1].visible = true;
      audio.play('chest');
      rebuildBodies();
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
  function showCacheStoryAfterLootLands() {
    const visual = chestVisuals.get(activeLocation.id);
    if (!visual?.pendingStory || visual.opening
      || visual.lootVisuals.some(item => item.group.parent && item.spawn)) return false;
    const story = visual.pendingStory; visual.pendingStory = null;
    showStoryCard(story);
    return true;
  }
  function damage(target, damageQuarters, speed) {
    if (target.hitCooldown > 0 || target.health <= 0) return false;
    const rawDamage = Math.max(1, Math.trunc(damageQuarters));
    const armor = target.team === 'player' ? campaignState.defenseBonus : 0;
    target.health = Math.max(0, target.health - Math.max(1, rawDamage - armor));
    audio.play(target.team === 'player' ? 'hurt' : target.health <= 0 ? 'enemyDeath' : 'hit',
      { pan: (target.x - heroBody.x) / 15 });
    target.hitCooldown = .65;
    if (target.team === 'enemy') target.aiStunRemaining = Math.max(target.aiStunRemaining || 0, .55);
    const figure = figures.find(item => item.body === target);
    if (figure) {
      figure.hitAge = 0;
      figure.hitStrength = THREE.MathUtils.clamp(speed / 22, .15, .38);
      figure.hurtAge = 0;
      figure.flashMaterial.opacity = 1;
      figure.backFlashMaterial.opacity = 1;
    }
    if (target.team === 'enemy' && target.locationId === 'camp' && !target.boss && target.health === 0 && !target.defeatRecorded) {
      target.defeatRecorded = true;
      const bossUnlocked = recordCampDefeat(locations.camp, elapsed);
      refreshLocationInfo();
      if (bossUnlocked) spawnCampBoss();
    }
    if (target.team === 'enemy' && target.health === 0 && !target.lootDropped) {
      target.lootDropped = true;
      const dropPosition = target.lootPosition ?? { x: target.x, z: target.z };
      spawnWorldLoot(locations[target.locationId], target.id, dropPosition.x, dropPosition.z, rollEnemyLoot());
    }
    persistCampaign();
    return true;
  }
  let lastVibration = 0;
  function vibrate(pattern) {
    const now = performance.now();
    if (now - lastVibration < 100) return;
    lastVibration = now;
    navigator.vibrate?.(pattern);
  }
  function recoverPlayerFromFall(body) {
    if (body.team === 'enemy') {
      if (body.health > 0) {
        body.lootPosition = body.lastSafePosition ?? activeLocation.entry;
        body.hitCooldown = 0;
        damage(body, body.health, 18);
      }
      const figure = figures.find(item => item.body === body);
      if (figure) { figure.fallAge = 0; setVisualState(figure, 'dead'); }
      burst(body.x, body.z, .8);
      return;
    }
    if (body !== heroBody) return;
    audio.play('fall');
    const safe = body.lastSafePosition ?? activeLocation.entry;
    recoverAfterFall(body, safe);
    const figure = figures.find(item => item.body === body);
    if (figure) { figure.hurtAge = 0; figure.hitAge = 0; figure.hitStrength = .2; }
    vibrate([55, 24, 55]);
    burst(body.x, body.z, .9);
    persistCampaign();
  }
  function onImpact(a, b, speed, attackingA = false, attackingB = false) {
    if (a === heroBody || b === heroBody) audio.play('impact', { strength: Math.min(1, speed / 10) });
    for (const figure of figures) {
      if (figure.body === a || figure.body === b) {
        figure.hitAge = 0;
        figure.hitStrength = THREE.MathUtils.clamp(speed / 28, .08, .3);
      }
    }
    if (b) {
      let playerDealtDamage = false, playerTookDamage = false;
      const attackHit = (attacker, target) => {
        if (attacker.fixed) return;
        if (target.kind === 'cache-chest') {
          if (attacker.team === 'player' && attacker.health > 0) openCache(target);
          return;
        }
        if (target.fixed) return;
        if (!canEnemyDamagePlayer(attacker, target)) return;
        if (attacker.health <= 0 || (attacker.team === target.team && attacker.team !== 'enemy') || (attacker.attackRicochets || 0) >= 3) return;
        const bonus = attacker.team === 'player' ? campaignState.damageBonus : 0;
        const hitDamage = attacker.archetype === 'boar'
          ? Math.max(1, Math.floor((attacker.damageQuarters ?? 6) / 2 ** (attacker.attackRicochets || 0)))
          : ricochetDamageQuarters(attacker.attackRicochets || 0);
        if (!damage(target, hitDamage + bonus, speed)) return;
        markDirectPlayerHit(attacker, target);
        attacker.attackRicochets = (attacker.attackRicochets || 0) + 1;
        const attackerFigure = figures.find(item => item.body === attacker);
        if (attackerFigure) attackerFigure.dealDamageAge = 0;
        if (attacker.team === 'player') playerDealtDamage = true;
        if (target.team === 'player') playerTookDamage = true;
      };
      if (attackingA) attackHit(a, b);
      if (attackingB) attackHit(b, a);
      if (playerDealtDamage && playerTookDamage) vibrate([32, 18, 48]);
      else if (playerTookDamage) vibrate([48, 24, 70]);
      else if (playerDealtDamage) vibrate(28);
    }
    burst(b ? (a.x + b.x) / 2 : a.x, b ? (a.z + b.z) / 2 : a.z, Math.min(1.5, speed / 7));
  }
  function markerGeometry(extension, filled = false) {
    const { outer, inner } = createMarkerContours(1.13, extension, .26, 48);
    const orientedPath = (points, clockwise) => {
      const ordered = THREE.ShapeUtils.isClockWise(points) === clockwise ? points : [...points].reverse();
      const path = new THREE.Path();
      path.moveTo(ordered[0].x, ordered[0].y);
      for (let i = 1; i < ordered.length; i++) path.lineTo(ordered[i].x, ordered[i].y);
      path.closePath();
      return path;
    };
    if (filled) {
      const fillPath = orientedPath(inner, false);
      const fillShape = new THREE.Shape();
      fillShape.moveTo(fillPath.curves[0].v1.x, fillPath.curves[0].v1.y);
      for (const curve of fillPath.curves) fillShape.lineTo(curve.v2.x, curve.v2.y);
      fillShape.closePath();
      return new THREE.ShapeGeometry(fillShape);
    }
    const shape = new THREE.Shape();
    const outside = orientedPath(outer, false);
    shape.moveTo(outside.curves[0].v1.x, outside.curves[0].v1.y);
    for (const curve of outside.curves) shape.lineTo(curve.v2.x, curve.v2.y);
    shape.closePath();
    shape.holes.push(orientedPath(inner, true));
    return new THREE.ShapeGeometry(shape);
  }
  function createVectorMarker(color, fillColor, showProgress, showOverlap = false) {
    const group = new THREE.Group();
    const outlineMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .96,
      side: THREE.DoubleSide, depthWrite: false, depthTest: true });
    const outline = new THREE.Mesh(markerGeometry(0), outlineMaterial);
    outline.rotation.x = Math.PI / 2; outline.renderOrder = 2; group.add(outline);
    let overlap = null;
    if (showOverlap) {
      const overlapMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .5,
        side: THREE.DoubleSide, depthWrite: false, depthTest: false, stencilWrite: true,
        stencilRef: 1, stencilFunc: THREE.EqualStencilFunc });
      overlap = new THREE.Mesh(outline.geometry, overlapMaterial);
      overlap.rotation.x = Math.PI / 2; overlap.renderOrder = 20; group.add(overlap);
    }
    let progress = null;
    const fullExtension = MAX_AIM_MARKER_EXTENSION;
    const backEdge = -.87;
    if (showProgress) {
      progress = new THREE.Mesh(markerGeometry(fullExtension, true),
        new THREE.MeshBasicMaterial({ color: fillColor, transparent: true, opacity: .94,
          side: THREE.DoubleSide, depthWrite: false, depthTest: true }));
      progress.rotation.x = Math.PI / 2; progress.visible = false; progress.renderOrder = 3;
      group.add(progress);
    }
    let currentExtension = 0;
    return {
      group, outline, material: outlineMaterial, progress, overlap,
      setExtension(extension) {
        const nextExtension = Math.max(0, extension);
        if (Math.abs(nextExtension - currentExtension) < 1e-4) return;
        const previous = outline.geometry;
        outline.geometry = markerGeometry(nextExtension);
        if (overlap) overlap.geometry = outline.geometry;
        previous.dispose();
        currentExtension = nextExtension;
      },
      setProgress(amount) {
        if (!progress) return;
        const transform = markerFillTransform(amount, backEdge);
        progress.scale.y = Math.max(.001, transform.scaleY);
        progress.position.z = transform.offsetY;
        progress.visible = amount > .005;
      },
    };
  }
  const playerMarker = createVectorMarker(0x65d536, 0xd8ff91, false, true);
  playerMarker.group.position.y = GROUND_UI_Y;
  scene.add(playerMarker.group);

  const raycaster = new THREE.Raycaster();
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
      playerMarker.group.scale.setScalar(.001);
    }
    selected = true;
    playerMarker.group.visible = true;
  }
  function stopAim() {
    playerMarker.setExtension(0);
    host.classList.remove('aiming');
  }
  inputController = createPointerInput({ THREE, host, inputElement: renderer.domElement, camera, orbit, playerMarker,
    isBlocked: () => sceneEditor?.active || locationTransition || dialogue.isOpen() || !inventoryPanel.hidden || locationMap.isOpen() || audioControls.isOpen(),
    onManualOrbit: () => { cameraManualOverride = 3; },
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
      if (cameraManualOverride === 0 && !inputController.isOrbiting() && !inputController.getAimingBody()) {
        const threat = heroBody.health > 0 ? nearestAwakeThreat(heroBody, activeLocation.enemies) : null;
        orbit.theta = threat
          ? followDirection(orbit.theta, threat.x - heroBody.x, threat.z - heroBody.z, dt)
          : followMotion(orbit.theta, heroBody.vx, heroBody.vz, dt);
      }
    }
    camera.position.set(target.x + orbit.distance * Math.sin(orbit.phi) * Math.sin(orbit.theta),
      target.y + orbit.distance * Math.cos(orbit.phi), target.z + orbit.distance * Math.sin(orbit.phi) * Math.cos(orbit.theta));
    camera.lookAt(target);
    camera.updateMatrixWorld();
  }
  function resize() {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix(); updateCamera();
    if (tiltShiftComposer) {
      tiltShiftComposer.setSize(innerWidth, innerHeight);
      tiltShiftPass.uniforms.v.value = 7 / Math.max(1, innerHeight * tiltShiftPixelRatio);
      setSsaoSize();
    }
  }
  addEventListener('resize', resize); resize();
  await locationStreaming.retain(activeLocation.id, false);
  showActiveLocationFigures();
  rebuildBodies();
  prepareScenePresentation();
  if (activeLocation.id === 'camp') {
    activeLocation.initialized = true;
    for (const figure of figures.filter(item => item.locationId === 'camp' && !item.poolDormant
      && !item.body.boss && item.body.health > 0 && !item.body.spawnReady)) beginSpawn(figure, figure.spawnSource);
  }
  loading.hidden = true;
  persistCampaign();
  if (initialStoryCard) showStoryCard(initialStoryCard);
  sceneEditor = installSceneEditor({ THREE, scene, camera, renderer, registry: sceneRegistry, createAsset: createEditorAsset,
    rebuildTerrain: rebuildLocationTerrain,
    getLocation: () => activeLocation, canOpen: () => !locationTransition,
    getScreenEffects: () => ({ ...screenEffects }), onScreenEffectsChange: setScreenEffects,
    getCampaignGraphData: state => ensureCampaignGraphData(state), onCampaignGraphChange: applyCampaignGraph,
    onActiveChange(editing) { inputController.cancel(); if (!editing) rebuildBodies(); } });
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
    story(kind = 'scene') {
      const card = inspectCampaignLocation(campaignState, activeLocation.id);
      showStoryCard({ ...card, lines: getStoryDialogue(campaignState, activeLocation.id, kind) });
    },
    actorView(id, angle = 0) {
      const actor = storyActors.actors.find(actor => actor.spec.id === id);
      if (!actor) throw new Error(`Unknown story actor: ${id}`);
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
    audioCue(name) { return audio.play(name); },
    place(id, x, z, vx = 0, vz = 0) {
      const body = id === 'hero' ? heroBody : activeLocation.enemies.find(enemy => enemy.id === id);
      if (!body) throw new Error(`Unknown test unit: ${id}`);
      Object.assign(body, { x, z, vx, vz });
    },
    snapshot() {
      const heroScreen = new THREE.Vector3(heroBody.x, .12, heroBody.z).project(camera);
      return { location: activeLocation.id, combatTriggered: activeLocation.combatTriggered, victorySequenceActive,
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
          health: heroBody.health, charges: heroBody.charges, rechargeTimer: heroBody.rechargeTimer,
          renderedX: heroFigure.group.position.x, renderedZ: heroFigure.group.position.z, viewBack: heroFigure.viewBack,
          visualState: heroFigure.visualState },
        aim: { active: Boolean(inputController.getAimingBody()), color: playerMarker.material.color.getHexString(),
          opacity: playerMarker.material.opacity, x: playerMarker.group.position.x, z: playerMarker.group.position.z,
          angle: playerMarker.group.rotation.y },
        audio: audio.snapshot(),
        dialogue: dialogue.frame(), elapsed,
        campaignFlags: { ...campaignState.flags },
        storyPickups: (activeLocation.storyPickups ?? []).filter(pickup => !campaignState.flags[pickup.flag])
          .map(({ id, x, z }) => ({ id, x, z })),
        actors: storyActors.actors.filter(actor => actor.spec.location === activeLocation.id)
          .map(actor => ({ id: actor.spec.id, visible: actor.prop.visible, fixed: actor.body.fixed, x: actor.body.x, z: actor.body.z,
            baseY: actor.prop.position.y, meshes: actor.prop.children.length })),
        heroVictory: Boolean(heroFigure.victoryAnimation), hazards: activeLocation.hazards,
        enemies: activeLocation.enemies.map(({ id, x, z, vx, vz, health, archetype, fell, aiPhase, aiTimer, charges, rechargeTimer }) =>
          ({ id, x, z, vx, vz, health, archetype, fell, aiPhase, aiTimer, charges, rechargeTimer })),
        projectiles: projectiles.length,
        shots: projectiles.map(({ x, z, age }) => ({ x, z, age })),
        cache: activeLocation.cacheBody ? { opened: activeLocation.cacheBody.opened,
          opening: chestVisuals.get(activeLocation.id)?.opening ? {
            age: chestVisuals.get(activeLocation.id).opening.age,
            phase: cacheOpeningPhase(chestVisuals.get(activeLocation.id).opening),
          } : null,
          collidable: bodies.includes(activeLocation.cacheBody),
          puckVisible: chestVisuals.get(activeLocation.id)?.puck.visible ?? false,
          puckScale: chestVisuals.get(activeLocation.id)?.puck.scale.x ?? 0,
          holderY: chestVisuals.get(activeLocation.id)?.artHolder.position.y ?? 0,
          rotationY: chestVisuals.get(activeLocation.id)?.group.rotation.y ?? 0,
          lootVisible: chestVisuals.get(activeLocation.id)?.lootVisuals.some(item => item.group.visible) ?? false,
          lootSettled: chestVisuals.get(activeLocation.id)?.lootVisuals.every(item => !item.group.parent || !item.spawn) ?? true,
          lootMotion: chestVisuals.get(activeLocation.id)?.lootVisuals.map(item => ({ parent: Boolean(item.group.parent),
            age: item.spawn?.age ?? null, duration: item.spawn?.duration ?? null })) ?? [],
          openSprite: chestVisuals.get(activeLocation.id)?.stateArt[1].visible ?? false } : null,
        terrain: activeLocation.art.terrain, sceneryCount: activeLocation.sceneryCount,
        loot: activeLocation.loot, render: { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles } };
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
    if (time < nextFrameAt) return;
    if (time - nextFrameAt > FRAME_INTERVAL_MS * 4) nextFrameAt = time;
    nextFrameAt += FRAME_INTERVAL_MS;
    const frameDt = previousTime === null ? 0 : Math.min((time - previousTime) / 1000, .05);
    const dt = simulationPaused ? 0 : frameDt;
    previousTime = time;
    audio.setScene({ nextMood: audioMood(activeLocation, heroBody.health, canCelebrateLocationVictory(activeLocation, CAMP_GOBLIN_TOTAL)),
      nextAmbience: audioAmbience(activeLocation),
      paused: sceneEditor.active || simulationPaused || locationTransition || dialogue.isOpen() || !inventoryPanel.hidden || locationMap.isOpen() || audioControls.isOpen(),
      speed: Math.hypot(heroBody.vx, heroBody.vz) });
    if (sceneEditor.graphOpen) return;
    if (sceneEditor.active) {
      sceneEditor.update(frameDt); updateEditorPresentation(); updatePlayerReveal(); renderScene(); return;
    }
    updateCacheAnimation(dt);
    if (locationTransition || dialogue.isOpen() || !inventoryPanel.hidden || locationMap.isOpen() || audioControls.isOpen()) {
      updateCamera(); updatePlayerReveal(); renderScene(); return;
    }
    elapsed += dt;
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
      const living = activeLocation.enemies.filter(enemy => enemy.health > 0 && !enemy.boss).length;
      if (takeDueReinforcement(activeLocation, elapsed, living)) startQueuedReinforcement();
    }
    const aimingBody = inputController.getAimingBody();
    if (aimingBody && !previousAim) audio.play('aim');
    previousAim = Boolean(aimingBody);
    for (const body of bodies) {
      if (body.fixed) continue;
      body.hitCooldown = Math.max(0, (body.hitCooldown || 0) - dt);
      const rechargeInterval = body === heroBody ? PLAYER_CHARGE_RECHARGE_INTERVAL : undefined;
      const restored = advanceChargeRecharge(body, dt, rechargeInterval);
      if (body === heroBody && restored > 0) {
        const mood = audioMood(activeLocation, heroBody.health, canCelebrateLocationVictory(activeLocation, CAMP_GOBLIN_TOTAL));
        audio.play(chargeReadyCue(mood));
      }
      if (body.team !== 'enemy') continue;
      if (victorySequenceActive) continue;
      const figure = figures.find(item => item.body === body);
      const decision = advanceEnemyAI(body, state, figure, dt, randomBetween);
      if (decision.launched) { burst(body.x, body.z, .45); audio.play('enemyDash', { pan: (body.x - heroBody.x) / 15 }); }
      if (decision.shot) {
        audio.play('projectile', { pan: (body.x - heroBody.x) / 15 });
        spawnStoneProjectile(decision.shot);
        if (figure) figure.dealDamageAge = 0;
      }
    }
    for (let remaining = dt; remaining > 0 && !dialogue.isOpen(); remaining -= 1 / 120) {
      advanceWorld(bodies, Math.min(remaining, 1 / 120), null, onImpact, activeLocation.walkablePoints, {
        fallZones: activeLocation.dropZones, hazards: activeLocation.hazards,
        fallable: body => body === heroBody || body.team === 'enemy', onFall: recoverPlayerFromFall,
      });
      if (victorySequenceActive) for (const body of bodies) if (!body.fixed) body.vx = body.vz = 0;
    }
    for (const enemy of activeLocation.enemies)
      clearDirectHitProtectionWhenSafe(enemy, isAttacking(enemy));
    if (dialogue.isOpen()) { updateCamera(); updatePlayerReveal(); renderScene(); return; }
    updateWorldLoot(dt);
    showCacheStoryAfterLootLands();
    updateProjectiles(dt);
    storyActors.update();
    if (isCampaignPositionSafe(activeLocation, heroBody)) heroBody.lastSafePosition = { x: heroBody.x, z: heroBody.z };
    for (const enemy of activeLocation.enemies) if (enemy.health > 0 && isCampaignPositionSafe(activeLocation, enemy))
      enemy.lastSafePosition = { x: enemy.x, z: enemy.z };
    for (const figure of figures) {
      if (figure.poolDormant) continue;
      const body = figure.body;
      if (body !== heroBody && figure.locationId !== activeLocation.id) continue;
      if (body.fell) {
        figure.healthHUD.visible = false;
        if (figure.enemyMarker) figure.enemyMarker.group.visible = false;
        if (typeof figure.fallAge !== 'number') { figure.group.visible = false; continue; }
        figure.fallAge += dt;
        const t = Math.min(1, figure.fallAge / .65);
        figure.group.position.set(body.x, -3 * t, body.z);
        figure.group.scale.setScalar(Math.max(.05, 1 - t * .85));
        figure.group.visible = t < 1;
        continue;
      }
      if (figure.spawnAnimation) continue;
      figure.healthHUD.visible = shouldShowHealthHud(body.team, body.health, body.maxHealth);
      figure.group.position.set(body.x, 0, body.z);
      const speed = Math.hypot(body.vx, body.vz);
      const victoryPose = body.health > 0 && figure.victoryAnimation
        ? advanceVictoryLoop(figure.victoryAnimation, dt) : null;
      if (victoryPose) figure.group.rotation.y = figure.victoryBaseYaw + victoryPose.spinY;
      else if (body.health > 0 && body !== aimingBody && !(body.team === 'enemy' && body.aiPhase === 'aim')) {
        figure.facing = facingAngle(body.vx, body.vz, figure.facing);
      }
      if (body.health > 0 && !victoryPose) figure.group.rotation.y = turnToward(figure.group.rotation.y, figure.facing, dt);
      const cameraDx = camera.position.x - figure.group.position.x, cameraDz = camera.position.z - figure.group.position.z;
      const cameraDistance = Math.max(.001, Math.hypot(cameraDx, cameraDz));
      const facingDot = (cameraDx * Math.sin(figure.group.rotation.y) + cameraDz * Math.cos(figure.group.rotation.y)) / cameraDistance;
      if (body.health <= 0) figure.viewBack = false;
      else if (figure.viewBack ? facingDot > .025 : facingDot < -.025) figure.viewBack = !figure.viewBack;
      for (const art of Object.values(figure.artStates)) {
        art.frontArt.group.visible = !figure.viewBack;
        art.backArt.group.visible = figure.viewBack;
      }
      figure.hitAge += dt;
      figure.hurtAge += dt;
      figure.dealDamageAge += dt;
      const visualState = body.health <= 0 ? 'dead'
        : victoryPose ? victoryPose.sprite
          : figure.hurtAge < .55 ? 'on-hit'
          : figure.dealDamageAge < .32 ? 'deal-damage'
            : body === aimingBody || (body.team === 'enemy' && body.aiPhase === 'aim') ? 'aiming'
              : isAttacking(body) ? 'attack' : 'idle';
      setVisualState(figure, visualState);
      const flashOpacity = figure.hurtAge < .42 && Math.floor(figure.hurtAge / .055) % 2 === 0 ? 1 : 0;
      figure.flashMaterial.opacity = figure.viewBack ? 0 : flashOpacity;
      figure.backFlashMaterial.opacity = figure.viewBack ? flashOpacity : 0;
      const spring = Math.exp(-figure.hitAge * 9) * Math.sin(figure.hitAge * 28);
      const squash = figure.hitStrength * spring;
      const artScale = figure.bossScale ?? 1;
      if (visualState === 'dead') {
        figure.artGroup.scale.set(artScale, artScale, artScale);
        figure.artGroup.position.y = figure.deadGroundedY;
        figure.artGroup.rotation.set(0, 0, 0);
      } else if (victoryPose) {
        figure.artGroup.scale.set(artScale * victoryPose.scaleX, artScale * victoryPose.scaleY, artScale);
        figure.artGroup.position.y = 1.25 + victoryPose.lift;
        figure.artGroup.rotation.set(0, 0, 0);
      } else {
        figure.artGroup.scale.set(artScale * (1 + squash * .7), artScale * (1 - squash), artScale);
        figure.artGroup.position.y = 1.25 + Math.max(0, squash) * .2;
        figure.artGroup.rotation.set(0, 0, squash * .15 + Math.sin(elapsed * 19) * Math.min(speed / 20, 1) * .012);
      }
      figure.attacking = isAttacking(body);
      const heartLevels = heartHealthLevels(body.health, body.maxHealth);
      figure.heartIcons.forEach((icon, index) => {
        const level = heartLevels[index];
        if (icon.level === level) return;
        icon.mesh.material = heartMaterials[level];
        icon.level = level;
      });
      const rechargeProgress = chargeRechargeProgress(body,
        body === heroBody ? PLAYER_CHARGE_RECHARGE_INTERVAL : undefined);
      figure.chargePips.forEach(({ group, base, fill }, index) => {
        const amount = index < body.charges ? 1 : index === body.charges ? rechargeProgress : 0;
        group.visible = body.team === 'player';
        const popRemaining = body.chargePop?.[index] ?? 0;
        body.chargePop[index] = Math.max(0, popRemaining - dt);
        if (popRemaining > 0 && index < body.charges) {
          const t = 1 - popRemaining / .48;
          const bounce = t >= 1 ? 1 : 1 + Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * 2 * Math.PI / 3);
          fill.scale.setScalar(1.05 * Math.max(.001, bounce));
          fill.material.opacity = 1 - .1 * t;
        } else {
          fill.scale.setScalar(amount * (index < body.charges ? 1.05 : 1));
          fill.material.opacity = .9;
        }
        base.material.opacity = .4;
      });
      if (figure.enemyMarker) {
        const aiming = !victorySequenceActive && body.health > 0 && body.aiPhase === 'aim';
        figure.enemyMarker.group.position.set(body.x, GROUND_UI_Y, body.z);
        figure.enemyMarker.group.rotation.y = aiming ? body.aiAimAngle : figure.facing;
        figure.enemyMarker.group.visible = !victorySequenceActive && body.health > 0;
        figure.enemyMarker.setExtension(aiming ? MAX_AIM_MARKER_EXTENSION : 0);
        figure.enemyMarker.setProgress(aiming ? 1 - body.aiTimer / body.aiAimDuration : 0);
        figure.enemyMarker.material.color.lerp(body.health > 0 && isAttacking(body) ? attackColor : enemyColor, 1 - Math.exp(-18 * dt));
        figure.enemyMarker.material.opacity = body.health > 0 ? .96 : .35;
      }
    }
    for (let i = bursts.length - 1; i >= 0; i--) {
      const effect = bursts[i]; effect.age += dt;
      const t = effect.age / .42;
      if (t >= 1) {
        scene.remove(effect.group); effect.material.dispose(); bursts.splice(i, 1); continue;
      }
      effect.material.opacity = (1 - t) ** 2 * .85;
      effect.ring.scale.setScalar(.5 + t * 4 * effect.strength);
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
      playerMarker.group.scale.setScalar(Math.max(.001, scale));
    }
    const exitsLocked = locationHasLivingEnemies(activeLocation);
    if (updateLocationExitLock(activeLocation.exitVisuals, exitsLocked, dt)) {
      activeLocation.obstacles = activeLocation.obstacles.filter(obstacle => obstacle.kind !== 'exit-barrier');
      if (exitsLocked) activeLocation.obstacles.push(...activeLocation.exitBarriers);
      rebuildBodies();
    }
    if (transitionCooldown <= 0) {
      let exit = findNearbyExit(activeLocation, heroBody);
      if (exit && protectedEntryFrom && shouldIgnoreEntryExit(activeLocation, protectedEntryFrom, heroBody)) exit = null;
      else if (protectedEntryFrom) protectedEntryFrom = null;
      if (exit && !exitsLocked) enterLocation(exit.to, activeLocation.id);
    }
    const nearInteraction = heroBody.health > 0 && Math.hypot(heroBody.x, heroBody.z) <= 2.65;
    interactButton.hidden = activeLocation.secret || !nearInteraction || Boolean(campaignState.collected[activeLocation.id]) || victorySequenceActive
      || activeLocation.enemies.some(enemy => enemy.health > 0);
    interactButton.textContent = 'Осмотреть';
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
    for (const { prop, front, back } of sceneryFacePairs) {
      const dx = camera.position.x - prop.position.x, dz = camera.position.z - prop.position.z;
      const cameraOnFront = dx * Math.sin(prop.rotation.y) + dz * Math.cos(prop.rotation.y) >= 0;
      front.visible = cameraOnFront;
      back.visible = !cameraOnFront;
    }
    for (const figure of figures) {
      if (figure.poolDormant) continue;
      if (figure.body !== heroBody && figure.locationId !== activeLocation.id) continue;
      figure.healthHUD.position.set(figure.body.x, 2.65, figure.body.z);
      figure.healthHUD.quaternion.copy(camera.quaternion);
    }
    updatePlayerReveal();
    renderScene();
  });
  frameWorkStarted = true;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    void enableTiltShift();
    if (!locationTransition) locationStreaming.retain(activeLocation.id)
      .catch(error => console.error('Не удалось подготовить соседние места', error));
  }));
}

start().catch(error => {
  loading.hidden = true;
  document.querySelector('#error').hidden = false;
  document.querySelector('#error').textContent = `Не удалось загрузить сцену: ${error.message || error}. Обнови страницу.`;
  console.error(error);
});

