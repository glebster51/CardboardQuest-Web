import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { createCardboardGrainTexture } from './cardboard-surface.mjs?v=2';
import { advanceEnemyAI } from './game/enemy-ai.mjs?v=2';
import { STORY_ENCOUNTERS, ENEMY_STATS } from './game/encounters.mjs?v=1';
import { advanceStoneProjectile } from './game/projectiles.mjs?v=1';
import { createPointerInput } from './game/pointer-input.mjs?v=2';
import { getStoryDialogue } from './game/story-dialogue.mjs?v=3';
import { createDialoguePanel } from './render/dialogue-panel.mjs?v=1';
import { createStoryActors } from './render/story-actors.mjs?v=1';
import { createFigureFactory } from './render/figure-factory.mjs?v=1';
import { createGroundRenderer } from './render/ground-renderer.mjs?v=2';
import { createScenerySystem } from './render/scenery-system.mjs?v=8';
import { populateNarrativeScenery } from './render/location-scenery.mjs?v=3';
import { hazardAtPoint, isPlayableFloor } from './game/world-hazards.mjs?v=1';
import { createTerrainRenderer } from './render/terrain-renderer.mjs?v=9';
import { launch, advanceWorld, facingAngle, turnToward, isAttacking, WALKABLE_POINTS, PUCK_RADIUS } from './physics.mjs?v=21';
import { createTerrainHeightMap, createTerrainHeightMapFromDepthMap, extractTerrainContours } from './terrain-shapes.mjs?v=8';
import { loadLocationDepthMaps } from './depth-map-assets.mjs?v=1';
import { createMarkerContours, markerFillTransform } from './marker-shapes.mjs?v=1';
import { advanceChargeRecharge, chargeRechargeProgress } from './charge-recharge.mjs?v=1';
import { heartHealthLevels, ricochetDamageQuarters } from './heart-health.mjs?v=1';
import { canEnemyDamagePlayer, clearDirectHitProtectionWhenSafe, markDirectPlayerHit } from './game/attack-protection.mjs?v=1';
import { createLocationWalkPaths, pointInWalkableArea, scatterGroundDetails } from './ground-decoration.mjs?v=3';
import { advanceVictoryLoop, canCelebrateLocationVictory, createVictoryLoop, settleEnemiesForVictory } from './victory-animation.mjs?v=2';
import { recoverAfterFall } from './game/fall-recovery.mjs?v=1';
import { CACHE_OPEN_FRAME_DELAY, CACHE_SQUASH_DURATION, cacheSquashScale } from './game/cache-animation.mjs?v=1';
import { CAMPAIGN, CAMPAIGN_SAVE_KEY, ITEM_LABELS, addItems, campaignLocation, chooseCampaignOption,
  collectCampaignStoryPickup, consumeFood, createCampaignState, inspectCampaignLocation, openCampaignCache,
  visitCampaignLocation } from './game/story-campaign.mjs?v=5';
import { normalizeWorldLoot, rollEnemyLoot, scatterWorldLoot, takeWorldLoot } from './game/world-items.mjs?v=1';
import { createCampaignLocations, isCampaignPositionSafe, resolveCampaignPlayerStart } from './game/story-world.mjs?v=7';
import { CAMP_BOSS_DEFEATS, CAMP_GOBLIN_SPAWNS, CAMP_GOBLIN_TOTAL, CAMP_HUT_ANCHORS, CAMP_LIVING_CAP, LOCATION_SCALE,
  createLocationNetwork, findNearbyExit, lastExitPosition, locationArrival, locationEntryDirection, shouldIgnoreEntryExit,
  finishCampReinforcement, recordCampDefeat, rememberExitPosition, takeDueReinforcement, wakeForestCombat } from './location-network.mjs?v=8';

const host = document.querySelector('#scene');
const loading = document.querySelector('#loading');
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
const AIM_DRAG_SENSITIVITY = 1 / 3;
const AIM_MARKER_LENGTH_SCALE = 1 / 1.3;
const MAX_AIM_MARKER_EXTENSION = 5.4 * AIM_MARKER_LENGTH_SCALE;
const randomBetween = (min, max) => min + Math.random() * (max - min);

async function start() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, stencil: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0xc7b391);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xc7b391, 68, 230);
  let savedCampaign = null;
  try { savedCampaign = JSON.parse(localStorage.getItem(CAMPAIGN_SAVE_KEY) || 'null'); } catch { /* Ignore a damaged local save. */ }
  const campaignState = createCampaignState(savedCampaign);
  const locations = createCampaignLocations(createLocationNetwork(), LOCATION_SCALE);
  await loadLocationDepthMaps(locations);
  campaignState.currentLocationId = campaignLocation(campaignState.currentLocationId)?.id ?? 'home';
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
  let inputController = null;
  const dialogue = createDialoguePanel({ root: dialoguePanel,
    onOpen() { inputController?.cancel(); inventoryPanel.hidden = true; },
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
  const locationGroups = Object.fromEntries(Object.values(locations).map(location => {
    const group = new THREE.Group(); group.visible = location.id === activeLocation.id; scene.add(group);
    location.sceneGroup = group;
    group.userData.walkablePoints = location.walkablePoints;
    return [location.id, group];
  }));
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 280);
  const target = new THREE.Vector3(0, .65, 0);
  const orbit = { theta: .22, phi: .86, distance: innerWidth < 650 ? 27 : 15.75 };
  scene.add(new THREE.HemisphereLight(0xfff8ea, 0x8f826a, 2.5));
  const sun = new THREE.DirectionalLight(0xffebcb, 3);
  sun.position.set(-5, 12, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -25.5, right: 25.5, top: 25.5, bottom: -25.5, far: 60 });
  sun.shadow.normalBias = .025;
  sun.shadow.bias = -.0002;
  scene.add(sun);

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
  createTerrainRenderer({ THREE, locations, createTerrainHeightMap, createTerrainHeightMapFromDepthMap, extractTerrainContours,
    paper, playfieldCardboard: cardboardGrain, roughCardboard: cardboardGrain,
    terrainCorrugation, sceneStencil });
  const createFigure = createFigureFactory({ THREE, scene, renderer, ambientShadowMaterial, contactShadowMaterial,
    corrugation, paper, sceneStencil, heartMaterials,
    createEnemyMarker: (...args) => createVectorMarker(...args), groundUiY: GROUND_UI_Y });
  const scenerySystem = createScenerySystem({ THREE, renderer, scene, locations, corrugation,
    paper, terrainCorrugation, sceneStencil });
  const { create: createScenery, loadTemplate: loadSceneryTemplate, loadStateTemplates,
    createSprite: createScenerySpriteModel, facePairs: sceneryFacePairs } = scenerySystem;
  const figures = [];
  const heroFigure = await createFigure(heroBody, 'hero');
  heroFigure.facing = 0;
  heroFigure.group.rotation.y = 0;
  orbit.theta = Math.PI;
  target.set(heroBody.x, .65, heroBody.z);
  heroFigure.locationId = 'home'; figures.push(heroFigure);
  const enemyBody = (id, locationId, x, z, options = {}) => {
    const stored = campaignState.world?.[locationId]?.enemies?.find(enemy => enemy.id === id);
    return {
    id, team: 'enemy', locationId, x: stored?.x ?? x, z: stored?.z ?? z, vx: stored?.vx ?? 0, vz: stored?.vz ?? 0,
    health: Math.min(options.maxHealth ?? 32, stored?.health ?? options.health ?? 32), maxHealth: options.maxHealth ?? 32,
    charges: 3, maxCharges: 3, rechargeTimer: 0, aiPhase: 'pause', aiTimer: randomBetween(1, 4),
    combatAwake: stored?.combatAwake ?? options.combatAwake ?? false,
    spawnReady: stored?.spawnReady ?? options.spawnReady ?? true,
    boss: options.boss ?? false,
    archetype: options.archetype ?? 'goblin', damageQuarters: options.damageQuarters ?? 4,
    fell: stored?.fell ?? false,
    };
  };
  const forestSpawns = [{ x: scaled(-3.1), z: scaled(.3) }, { x: scaled(3.1), z: scaled(.3) }];
  for (let index = 0; index < forestSpawns.length; index++) {
    const point = forestSpawns[index];
    const body = enemyBody(`forest-goblin-${index + 1}`, 'forest', point.x, point.z,
      { combatAwake: locations.forest.combatTriggered });
    locations.forest.enemies.push(body);
    const figure = await createFigure(body, 'goblin');
    figure.locationId = 'forest'; figure.group.visible = false; figure.healthHUD.visible = false;
    figure.enemyMarker.group.visible = false; figures.push(figure);
  }
  const campSpawns = CAMP_GOBLIN_SPAWNS.map((spawn, index) => ({
    x: scaled(spawn.x), z: scaled(spawn.z),
    hutX: scaled(CAMP_HUT_ANCHORS[index].x), hutZ: scaled(CAMP_HUT_ANCHORS[index].z),
  }));
  for (let index = 0; index < campSpawns.length; index++) {
    const point = campSpawns[index];
    const body = enemyBody(`camp-goblin-${index + 1}`, 'camp', point.x, point.z, { spawnReady: false, combatAwake: true });
    locations.camp.enemies.push(body);
    const figure = await createFigure(body, 'goblin');
    figure.locationId = 'camp'; figure.spawnSource = { x: point.hutX, z: point.hutZ }; figure.spawnStarted = false;
    figure.group.visible = false; figure.healthHUD.visible = false; figure.enemyMarker.group.visible = false;
    figures.push(figure);
  }
  for (const encounter of STORY_ENCOUNTERS) for (const unit of encounter.units) {
    const body = enemyBody(`${encounter.location}-${unit.id}`, encounter.location,
      scaled(unit.x), scaled(unit.z), { combatAwake: true, archetype: unit.type, ...ENEMY_STATS[unit.type] });
    body.lastSafePosition = { x: body.x, z: body.z };
    locations[encounter.location].enemies.push(body);
    const figure = await createFigure(body, unit.type);
    figure.locationId = encounter.location; figure.group.visible = false;
    figure.healthHUD.visible = false; figure.enemyMarker.group.visible = false;
    figures.push(figure);
  }
  await populateNarrativeScenery({ locations, createScenery, loadTemplate: loadSceneryTemplate,
    scale: LOCATION_SCALE, hutAnchors: CAMP_HUT_ANCHORS, puckRadius: PUCK_RADIUS });
  const storyActors = await createStoryActors({ locations, createScenery, scale: LOCATION_SCALE, campaign: campaignState });
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
  await createGroundRenderer({ THREE, renderer, locations, specsByLocation: decorationSpecs,
    pathTargets: { camp: CAMP_HUT_ANCHORS.map(hut => ({ x: scaled(hut.x), z: scaled(hut.z) })) },
    createLocationWalkPaths, scatterGroundDetails });
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
  let activeFigure = figures[0];
  let selectionAge = .6;
  let elapsed = 0;
  let transitionCooldown = 0;
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
  async function preloadCampEnemies() {
    if (campGoblinPool.length >= CAMP_GOBLIN_TOTAL - CAMP_LIVING_CAP) return;
    if (campPreloadPromise) return campPreloadPromise;
    campPreloadPromise = (async () => {
      while (campGoblinPool.length < CAMP_GOBLIN_TOTAL - CAMP_LIVING_CAP) {
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
    const preloadOgre = () => preloadCampOgre().catch(error => {
      console.error('Не удалось заранее подготовить огра', error);
    });
    if (window.requestIdleCallback) window.requestIdleCallback(preloadOgre, { timeout: 1600 });
    else setTimeout(preloadOgre, 100);
  }
  let campRestorePromise = null;
  async function restoreSavedCampEnemies() {
    const storedEnemies = campaignState.world?.camp?.enemies;
    if (!storedEnemies?.length) return;
    if (campRestorePromise) return campRestorePromise;
    campRestorePromise = (async () => {
      await preloadCampEnemies();
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
        figure.healthHUD.visible = figure.group.visible && body.health > 0;
        if (figure.enemyMarker) figure.enemyMarker.group.visible = figure.group.visible && body.health > 0;
        locations.camp.enemies.push(body);
        if (isBoss) campOgrePool = null;
      }
      if (activeLocation.id === 'camp') { showActiveLocationFigures(); rebuildBodies(); refreshLocationInfo(); }
    })().finally(() => { campRestorePromise = null; });
    return campRestorePromise;
  }
  function scheduleCampPreload() {
    const preload = () => preloadCampEnemies().catch(error => console.error('Не удалось заранее подготовить лагерь', error));
    if (window.requestIdleCallback) window.requestIdleCallback(preload, { timeout: 1200 });
    else setTimeout(preload, 100);
  }
  function renderInventory() {
    const items = document.querySelector('#inventory-items');
    items.replaceChildren();
    const entries = Object.entries(campaignState.items).filter(([, count]) => count > 0);
    if (!entries.length) {
      const empty = document.createElement('span'); empty.textContent = 'Мешок пуст'; empty.style.gridColumn = '1 / -1'; items.append(empty);
    } else for (const [id, count] of entries) {
      const label = document.createElement('span'), amount = document.createElement('strong');
      label.textContent = ITEM_LABELS[id] ?? id; amount.textContent = `× ${count}`;
      items.append(label, amount);
    }
    if (campaignState.defenseBonus > 0) {
      const label = document.createElement('span'), amount = document.createElement('strong');
      label.textContent = 'Картонный оберег'; amount.textContent = `−${campaignState.defenseBonus} урона`;
      items.append(label, amount);
    }
    if (campaignState.damageBonus > 0) {
      const label = document.createElement('span'), amount = document.createElement('strong');
      label.textContent = 'Заточенный осколок'; amount.textContent = `+${campaignState.damageBonus} урона`;
      items.append(label, amount);
    }
    const carried = entries.reduce((sum, [, count]) => sum + count, 0);
    document.querySelector('#inventory-toggle').textContent = carried ? `Рюкзак · ${carried}` : 'Рюкзак';
    document.querySelector('#use-food').disabled = !['bandage', 'jerky', 'hardtack', 'berries'].some(id => campaignState.items[id] > 0)
      || heroBody.health <= 0 || heroBody.health >= heroBody.maxHealth;
  }
  function showStoryCard(card) {
    dialogue.show({ ...card, title: card.title ?? activeLocation.title });
  }
  function persistCampaign() {
    campaignState.currentLocationId = activeLocation.id;
    campaignState.playerHealth = heroBody.health;
    campaignState.playerPosition = { x: heroBody.x, z: heroBody.z };
    campaignState.lastSafePosition = { ...heroBody.lastSafePosition };
    campaignState.elapsed = elapsed;
    campaignState.world = Object.fromEntries(Object.values(locations).map(location => [location.id, {
      actors: storyActors.actors.filter(actor => actor.spec.location === location.id)
        .map(actor => ({ id: actor.spec.id, x: actor.body.x, z: actor.body.z })),
      enemies: location.enemies.map(enemy => ({ id: enemy.id, x: enemy.x, z: enemy.z, vx: enemy.vx, vz: enemy.vz,
        health: enemy.health, combatAwake: enemy.combatAwake, spawnReady: enemy.spawnReady, fell: enemy.fell })),
      defeats: location.defeats, goblinsSpawned: location.goblinsSpawned,
      reinforcementQueue: (location.reinforcementQueue ?? []).map(due => Math.max(0, due - elapsed)), bossSpawned: location.bossSpawned,
      initialized: location.initialized, combatTriggered: location.combatTriggered,
      lastExitPositions: location.lastExitPositions,
      loot: location.loot.map(({ id, itemId, x, z }) => ({ id, itemId, x, z })),
    }]));
    try { localStorage.setItem(CAMPAIGN_SAVE_KEY, JSON.stringify(campaignState)); } catch (error) {
      console.warn('Не удалось сохранить поход', error);
    }
  }
  if (savedCampaign && playerStart.recovered) persistCampaign();
  document.querySelector('#inventory-toggle').addEventListener('click', () => {
    if (dialogue.isOpen()) return;
    inputController?.cancel();
    renderInventory(); inventoryPanel.hidden = false;
  });
  document.querySelector('#inventory-close').addEventListener('click', () => { inventoryPanel.hidden = true; });
  document.querySelector('#use-food').addEventListener('click', () => {
    const result = consumeFood(campaignState, heroBody.health, heroBody.maxHealth);
    if (!result.consumed) return;
    heroBody.health = result.health; persistCampaign(); renderInventory();
    showStoryCard({ title: 'Передышка', text: `${result.consumed === 'bandage' ? 'Ты перевязал рану' : `Ты съел: ${ITEM_LABELS[result.consumed]}`}. Восстановлено ${result.healed / 4} сердца.` });
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
  const lootAtlas = await new THREE.TextureLoader().loadAsync('assets/loot-atlas.png?v=1');
  lootAtlas.colorSpace = THREE.SRGBColorSpace;
  lootAtlas.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  const lootCellWidth = lootAtlas.image.width / 4, lootCellHeight = lootAtlas.image.height / 2;
  const lootSpriteModels = new Map(lootItemIds.map((id, index) => {
    const canvas = document.createElement('canvas'); canvas.width = lootCellWidth; canvas.height = lootCellHeight;
    canvas.getContext('2d', { willReadFrequently: true }).drawImage(lootAtlas.image,
      (index % 4) * lootCellWidth, Math.floor(index / 4) * lootCellHeight, lootCellWidth, lootCellHeight,
      0, 0, lootCellWidth, lootCellHeight);
    return [id, createScenerySpriteModel(canvas)];
  }));
  lootAtlas.dispose();
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
  function createLootVisual(location, item, source = null) {
    const group = new THREE.Group();
    group.name = item.id;
    const model = lootSpriteModels.get(item.itemId) ?? lootSpriteModels.get('scrap');
    const icon = model.group.clone(true), iconHeight = .54 * 3, iconScale = iconHeight / 2.05;
    icon.scale.set(iconScale, iconScale, 1); icon.position.y = .11 + iconHeight / 2; group.add(icon);
    const facePair = { prop: group, front: icon.getObjectByName('scenery-front'), back: icon.getObjectByName('scenery-back') };
    sceneryFacePairs.push(facePair);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(.22, 28),
      new THREE.MeshBasicMaterial({ color: 0xffd879, transparent: true, opacity: .05, depthWrite: false, toneMapped: false }));
    glow.rotation.x = -Math.PI / 2; glow.position.y = .018; group.add(glow);
    const beam = new THREE.Mesh(lootBeamGeometry, lootBeamMaterial);
    beam.scale.set(.82, 1.44, 1); beam.position.set(0, 1.02, -.025); beam.renderOrder = 5; group.add(beam);
    group.position.set(item.x, 0, item.z);
    location.sceneGroup.add(group);
    const visual = { group, icon, beam, glow, facePair, spawn: source ? { ...source, age: 0, duration: .62 } : null };
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
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.22, 48), ambientShadowMaterial);
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = .008; group.add(shadow);
    const puck = new THREE.Mesh(new THREE.CylinderGeometry(body.radius, body.radius, .2, 64), [
      new THREE.MeshStandardMaterial({ map: corrugation, roughness: 1, ...sceneStencil }),
      new THREE.MeshStandardMaterial({ map: paper, roughness: .96, ...sceneStencil }),
      new THREE.MeshStandardMaterial({ color: 0x97713e, ...sceneStencil }),
    ]);
    puck.position.y = .1; puck.castShadow = true; puck.receiveShadow = true; group.add(puck);
    const artHolder = new THREE.Group(); artHolder.position.y = .21; group.add(artHolder);
    const stateArt = chestTemplates.map((template, index) => {
      const art = template.clone(true);
      const spriteHeight = 1.72, scale = spriteHeight / 2.05;
      art.scale.set(scale, scale, 1); art.position.y = spriteHeight / 2;
      art.visible = index === (opened ? 1 : 0); artHolder.add(art);
      sceneryFacePairs.push({ prop: group, front: art.getObjectByName('scenery-front'), back: art.getObjectByName('scenery-back') });
      return art;
    });
    group.position.set(body.x, 0, body.z); location.sceneGroup.add(group);
    chestVisuals.set(location.id, { body, group, artHolder, stateArt, openingAge: null });
  }
  const chestTemplates = Object.values(locations).some(location => location.secret)
    ? await loadStateTemplates('assets/chest-states.png', 2) : [];
  for (const location of Object.values(locations)) {
    if (location.secret) await makeCacheBody(location, chestTemplates);
    for (const item of location.loot) createLootVisual(location, item);
    for (const pickup of location.storyPickups ?? []) if (!campaignState.flags[pickup.flag])
      createStoryPickupVisual(location, pickup);
  }

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
      figure.healthHUD.visible = active && figure.body.health > 0 && !spawning;
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
    figure.healthHUD.visible = figure.group.visible;
    if (figure.enemyMarker) figure.enemyMarker.group.visible = false;
  }
  function beginVictorySequence() {
    if (victorySequenceActive) return;
    victorySequenceActive = true;
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
  function enterLocation(locationId, fromLocationId) {
    const next = locations[locationId];
    if (!next) return;
    rememberExitPosition(activeLocation, locationId, heroBody);
    inputController.cancel();
    heroFigure.victoryAnimation = null;
    clearProjectiles();
    activeLocation = next;
    dialogue.close();
    protectedEntryFrom = fromLocationId;
    const remembered = lastExitPosition(activeLocation, fromLocationId);
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
      restoreSavedCampEnemies().catch(error => console.error('Не удалось восстановить состояние лагеря', error));
      activeLocation.initialized = true;
      for (const figure of figures.filter(item => item.locationId === 'camp' && !item.poolDormant
        && !item.body.boss && item.body.health > 0 && !item.body.spawnReady && !item.spawnAnimation)) {
        beginSpawn(figure, figure.spawnSource);
      }
    }
    if (next.id === 'forest') scheduleCampPreload();
    showActiveLocationFigures();
    rebuildBodies();
    refreshLocationInfo();
    renderInventory();
    persistCampaign();
    prepareScenePresentation();
    if (visit?.firstVisit) showStoryCard({ title: activeLocation.title, text: activeLocation.campaignIntro,
      lines: getStoryDialogue(campaignState, activeLocation.id, 'intro') });
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
  function spawnWorldLoot(location, sourceId, x, z, rewards) {
    if (!location || !rewards) return [];
    const drops = scatterWorldLoot({ sourceId, x, z, rewards,
      isInside: (px, pz) => isPlayableFloor(location, px, pz, .45),
      spread: [1.15, 2.65] });
    location.loot.push(...drops);
    for (const item of drops) createLootVisual(location, item, { x, z });
    return drops;
  }
  function openCache(body) {
    if (body.opened || body.locationId !== activeLocation.id) return false;
    const result = openCampaignCache(campaignState, body.locationId);
    if (!result) return false;
    body.opened = true;
    activeLocation.obstacles = activeLocation.obstacles.filter(obstacle => obstacle !== body);
    const visual = chestVisuals.get(activeLocation.id);
    if (visual) {
      visual.openingAge = 0;
      visual.stateArt[0].visible = true;
      visual.stateArt[1].visible = false;
    }
    spawnWorldLoot(activeLocation, body.id, body.x, body.z, result.rewards);
    rebuildBodies();
    burst(body.x, body.z, 1.2);
    vibrate(28);
    persistCampaign();
    refreshLocationInfo();
    showStoryCard({ ...result, lines: getStoryDialogue(campaignState, activeLocation.id) });
    return true;
  }
  function updateWorldLoot(dt) {
    for (const item of [...activeLocation.loot]) {
      let visual = worldItemVisuals.get(item.id);
      if (!visual) visual = createLootVisual(activeLocation, item);
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
      const pulse = .82 + Math.sin(elapsed * 3.4 + item.x * 2 + item.z) * .12;
      visual.beam.scale.y = 1.44 * pulse;
      visual.beam.position.y = .30 + .72 * pulse;
      visual.beam.material.opacity = .78 + (Math.sin(elapsed * 4 + item.z) + 1) * .1;
      visual.glow.material.opacity = .035 + (Math.sin(elapsed * 4 + item.z) + 1) * .018;
      if (heroBody.health <= 0 || Math.hypot(heroBody.x - item.x, heroBody.z - item.z) > PUCK_RADIUS + .35) continue;
      const pickup = takeWorldLoot(activeLocation.loot, item.id);
      if (!pickup) continue;
      activeLocation.sceneGroup.remove(visual.group);
      const facePairIndex = sceneryFacePairs.indexOf(visual.facePair);
      if (facePairIndex >= 0) sceneryFacePairs.splice(facePairIndex, 1);
      worldItemVisuals.delete(item.id);
      addItems(campaignState, { [pickup.itemId]: 1 });
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
      activeLocation.sceneGroup.remove(visual.group); storyPickupVisuals.delete(pickup.id);
      burst(pickup.x, pickup.z, .7); vibrate(24); persistCampaign();
      showStoryCard({ title: activeLocation.title, text: 'Ты подобрал вещь, которую дед потерял у ручья.',
        lines: getStoryDialogue(campaignState, activeLocation.id, 'pickup') });
      break;
    }
  }
  function updateCacheAnimation(dt) {
    const visual = chestVisuals.get(activeLocation.id);
    if (!visual || visual.openingAge === null) return;
    visual.openingAge += dt;
    if (visual.openingAge >= CACHE_OPEN_FRAME_DELAY) {
      visual.stateArt[0].visible = false;
      visual.stateArt[1].visible = true;
    }
    const scale = cacheSquashScale(visual.openingAge);
    visual.artHolder.scale.set(scale.x, scale.y, scale.z);
    if (visual.openingAge >= CACHE_SQUASH_DURATION) {
      visual.openingAge = null;
      visual.artHolder.scale.set(1, 1, 1);
      visual.stateArt[0].visible = false;
      visual.stateArt[1].visible = true;
    }
  }
  function damage(target, damageQuarters, speed) {
    if (target.hitCooldown > 0 || target.health <= 0) return false;
    const rawDamage = Math.max(1, Math.trunc(damageQuarters));
    const armor = target.team === 'player' ? campaignState.defenseBonus : 0;
    target.health = Math.max(0, target.health - Math.max(1, rawDamage - armor));
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
    const safe = body.lastSafePosition ?? activeLocation.entry;
    recoverAfterFall(body, safe);
    const figure = figures.find(item => item.body === body);
    if (figure) { figure.hurtAge = 0; figure.hitAge = 0; figure.hitStrength = .2; }
    vibrate([55, 24, 55]);
    burst(body.x, body.z, .9);
    persistCampaign();
  }
  function onImpact(a, b, speed, attackingA = false, attackingB = false) {
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
    for (const hit of raycaster.intersectObjects(visibleFigures.map(figure => figure.group), true)) {
      let root = hit.object;
      while (root && !root.userData.figure) root = root.parent;
      const figure = root?.userData.figure;
      if (!figure) continue;
      if (hit.object.userData.sideWall || !hit.object.userData.print || !hit.uv) return figure;
      const px = Math.min(figure.width - 1, Math.max(0, Math.floor(hit.uv.x * figure.width)));
      const py = Math.min(figure.height - 1, Math.max(0, Math.floor((1 - hit.uv.y) * figure.height)));
      if (figure.alphaPixels[(py * figure.width + px) * 4 + 3] > 100) return figure;
    }
    const groundPoint = raycaster.ray.intersectPlane(figureHitPlane, new THREE.Vector3());
    if (!groundPoint) return null;
    let closest = null, closestDistance = (PUCK_RADIUS + .08) ** 2;
    for (const figure of visibleFigures) {
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
    isBlocked: () => dialogue.isOpen() || !inventoryPanel.hidden,
    getBody: () => state, getActiveFigure: () => activeFigure, hitFigure, choose, stopAim,
    groundUiY: GROUND_UI_Y, aimDragSensitivity: AIM_DRAG_SENSITIVITY,
    maxAimMarkerExtension: MAX_AIM_MARKER_EXTENSION,
    onLaunch(body, pull) {
      if (body === heroBody) heroFigure.victoryAnimation = null;
      body.charges--; body.chargePop[body.charges] = 0; body.attackRicochets = 0;
      launch(body, pull);
      if (Math.hypot(body.vx, body.vz) > 1) burst(body.x, body.z, .55);
    },
  });

  function updateCamera() {
    camera.position.set(target.x + orbit.distance * Math.sin(orbit.phi) * Math.sin(orbit.theta),
      target.y + orbit.distance * Math.cos(orbit.phi), target.z + orbit.distance * Math.sin(orbit.phi) * Math.cos(orbit.theta));
    camera.lookAt(target);
    camera.updateMatrixWorld();
  }
  function resize() {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix(); updateCamera();
  }
  addEventListener('resize', resize); resize();
  showActiveLocationFigures();
  rebuildBodies();
  prepareScenePresentation();
  if (activeLocation.id === 'forest') scheduleCampPreload();
  if (activeLocation.id === 'camp') restoreSavedCampEnemies().then(() => {
    showActiveLocationFigures(); rebuildBodies();
  }).catch(error => console.error('Не удалось восстановить состояние лагеря', error));
  loading.hidden = true;
  if (initialStoryCard) showStoryCard(initialStoryCard);
  if (debugMode) window.__CQ_DEBUG__ = {
    locations: Object.keys(locations),
    enter(id) { enterLocation(id, activeLocation.id); },
    view(id, distance = 43) {
      simulationPaused = true;
      enterLocation(id, activeLocation.id);
      dialogue.close(); inventoryPanel.hidden = true;
      heroBody.x = 0; heroBody.z = 0; heroBody.vx = 0; heroBody.vz = 0;
      heroBody.health = heroBody.maxHealth;
      heroFigure.victoryAnimation = null;
      const points = activeLocation.walkablePoints;
      const minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x));
      const minZ = Math.min(...points.map(p => p.z)), maxZ = Math.max(...points.map(p => p.z));
      target.set((minX + maxX) / 2, .65, (minZ + maxZ) / 2);
      orbit.distance = Math.max(distance, Math.max(maxX - minX, maxZ - minZ) * 1.45);
      orbit.phi = .62; orbit.theta = .35; scene.fog.near = 120;
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
    place(id, x, z, vx = 0, vz = 0) {
      const body = id === 'hero' ? heroBody : activeLocation.enemies.find(enemy => enemy.id === id);
      if (!body) throw new Error(`Unknown test unit: ${id}`);
      Object.assign(body, { x, z, vx, vz });
    },
    snapshot() {
      return { location: activeLocation.id, combatTriggered: activeLocation.combatTriggered, victorySequenceActive,
        hero: { x: heroBody.x, z: heroBody.z, health: heroBody.health, charges: heroBody.charges, rechargeTimer: heroBody.rechargeTimer,
          renderedX: heroFigure.group.position.x, renderedZ: heroFigure.group.position.z, viewBack: heroFigure.viewBack,
          visualState: heroFigure.visualState },
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
          openingAge: chestVisuals.get(activeLocation.id)?.openingAge ?? null,
          scale: chestVisuals.get(activeLocation.id)?.artHolder.scale.toArray() ?? null,
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
  renderer.setAnimationLoop(time => {
    const dt = simulationPaused || previousTime === null ? 0 : Math.min((time - previousTime) / 1000, .05);
    previousTime = time;
    updateCacheAnimation(dt);
    if (dialogue.isOpen() || !inventoryPanel.hidden) {
      updateCamera(); renderer.render(scene, camera); return;
    }
    elapsed += dt;
    transitionCooldown = Math.max(0, transitionCooldown - dt);
    if (heroBody.health <= 0) beginVictorySequence();
    if (!victorySequenceActive && heroBody.health > 0 && !celebratedLocations.has(activeLocation.id)
      && canCelebrateLocationVictory(activeLocation, CAMP_GOBLIN_TOTAL)) {
      celebratedLocations.add(activeLocation.id);
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
          figure.healthHUD.visible = figure.body.health > 0;
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
    const held = inputController.getHeldBody();
    for (const body of bodies) {
      if (body.fixed) continue;
      body.hitCooldown = Math.max(0, (body.hitCooldown || 0) - dt);
      advanceChargeRecharge(body, dt);
      if (body.team !== 'enemy') continue;
      if (victorySequenceActive) continue;
      const figure = figures.find(item => item.body === body);
      const decision = advanceEnemyAI(body, state, figure, dt, randomBetween);
      if (decision.launched) burst(body.x, body.z, .45);
      if (decision.shot) {
        spawnStoneProjectile(decision.shot);
        if (figure) figure.dealDamageAge = 0;
      }
    }
    for (let remaining = dt; remaining > 0 && !dialogue.isOpen(); remaining -= 1 / 120) {
      advanceWorld(bodies, Math.min(remaining, 1 / 120), held, onImpact, activeLocation.walkablePoints, {
        fallZones: activeLocation.dropZones, hazards: activeLocation.hazards,
        fallable: body => body === heroBody || body.team === 'enemy', onFall: recoverPlayerFromFall,
      });
      if (victorySequenceActive) for (const body of bodies) if (!body.fixed) body.vx = body.vz = 0;
    }
    for (const enemy of activeLocation.enemies)
      clearDirectHitProtectionWhenSafe(enemy, isAttacking(enemy));
    updateCacheAnimation(dt);
    if (dialogue.isOpen()) { updateCamera(); renderer.render(scene, camera); return; }
    updateWorldLoot(dt);
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
      figure.group.position.set(body.x, 0, body.z);
      const speed = Math.hypot(body.vx, body.vz);
      const victoryPose = body.health > 0 && figure.victoryAnimation
        ? advanceVictoryLoop(figure.victoryAnimation, dt) : null;
      if (victoryPose) figure.group.rotation.y = figure.victoryBaseYaw + victoryPose.spinY;
      else if (body.health > 0 && body !== held && !(body.team === 'enemy' && body.aiPhase === 'aim')) {
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
            : body === held || (body.team === 'enemy' && body.aiPhase === 'aim') ? 'aiming'
              : isAttacking(body) && body !== held ? 'attack' : 'idle';
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
      figure.attacking = isAttacking(body) && body !== held;
      const heartLevels = heartHealthLevels(body.health, body.maxHealth);
      figure.heartIcons.forEach((icon, index) => {
        const level = heartLevels[index];
        if (icon.level === level) return;
        icon.mesh.material = heartMaterials[level];
        icon.level = level;
      });
      const rechargeProgress = chargeRechargeProgress(body);
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
    if (transitionCooldown <= 0) {
      let exit = findNearbyExit(activeLocation, heroBody);
      if (exit && protectedEntryFrom && shouldIgnoreEntryExit(activeLocation, protectedEntryFrom, heroBody)) exit = null;
      else if (protectedEntryFrom) protectedEntryFrom = null;
      if (exit) enterLocation(exit.to, activeLocation.id);
    }
    const nearInteraction = heroBody.health > 0 && Math.hypot(heroBody.x, heroBody.z) <= 2.65;
    interactButton.hidden = activeLocation.secret || !nearInteraction || Boolean(campaignState.collected[activeLocation.id]) || victorySequenceActive
      || activeLocation.enemies.some(enemy => enemy.health > 0);
    interactButton.textContent = 'Осмотреть';
    playerMarker.material.color.lerp(
      state.health > 0 && isAttacking(state) && state !== held ? attackColor : selectedColor,
      1 - Math.exp(-18 * dt));
    playerMarker.group.position.set(state.x, GROUND_UI_Y, state.z);
    updateCamera();
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
    renderer.render(scene, camera);
  });
}

start().catch(error => {
  loading.hidden = true;
  document.querySelector('#error').hidden = false;
  document.querySelector('#error').textContent = `Не удалось загрузить сцену: ${error.message || error}. Обнови страницу.`;
  console.error(error);
});

