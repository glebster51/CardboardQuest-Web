import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { advanceEnemyAI } from './game/enemy-ai.mjs?v=1';
import { createPointerInput } from './game/pointer-input.mjs?v=1';
import { createFigureFactory } from './render/figure-factory.mjs?v=1';
import { createGroundRenderer } from './render/ground-renderer.mjs?v=1';
import { createScenerySystem } from './render/scenery-system.mjs?v=1';
import { createTerrainRenderer } from './render/terrain-renderer.mjs?v=1';
import { launch, advanceWorld, facingAngle, turnToward, isAttacking, WALKABLE_POINTS, PUCK_RADIUS } from './physics.mjs?v=19';
import { createTerrainHeightMap, extractTerrainContours } from './terrain-shapes.mjs?v=3';
import { createMarkerContours, markerFillTransform } from './marker-shapes.mjs?v=1';
import { advanceChargeRecharge, chargeRechargeProgress } from './charge-recharge.mjs?v=1';
import { heartHealthLevels, ricochetDamageQuarters } from './heart-health.mjs?v=1';
import { createLocationWalkPaths, scatterGroundDetails } from './ground-decoration.mjs?v=1';
import { advanceVictoryLoop, createVictoryLoop, settleEnemiesForVictory } from './victory-animation.mjs?v=1';
import { CAMP_BOSS_DEFEATS, CAMP_GOBLIN_SPAWNS, CAMP_HUT_ANCHORS, CAMP_LIVING_CAP, LOCATION_SCALE,
  createLocationNetwork, findNearbyExit, lastExitPosition, locationArrival, locationEntryDirection, shouldIgnoreEntryExit,
  finishCampReinforcement, recordCampDefeat, rememberExitPosition, takeDueReinforcement, wakeForestCombat } from './location-network.mjs?v=6';

const host = document.querySelector('#scene');
const loading = document.querySelector('#loading');
const scaled = value => value * LOCATION_SCALE;
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

document.querySelector('#restart').addEventListener('click', () => location.reload());

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
  const locations = createLocationNetwork();
  for (const location of Object.values(locations)) location.obstacles = [];
  let activeLocation = locations.home;
  const locationTitle = document.querySelector('#location-title');
  const locationDetail = document.querySelector('#location-detail');
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
  createTerrainRenderer({ THREE, locations, createTerrainHeightMap, extractTerrainContours,
    paper, terrainCorrugation, sceneStencil });
  const createFigure = createFigureFactory({ THREE, scene, renderer, ambientShadowMaterial, contactShadowMaterial,
    corrugation, paper, sceneStencil, heartMaterials,
    createEnemyMarker: (...args) => createVectorMarker(...args), groundUiY: GROUND_UI_Y });
  const scenerySystem = createScenerySystem({ THREE, renderer, scene, locations, corrugation,
    paper, terrainCorrugation, sceneStencil });
  const { create: createScenery, loadTemplate: loadSceneryTemplate, facePairs: sceneryFacePairs } = scenerySystem;
  const figures = [];
  const heroFigure = await createFigure(heroBody, 'hero');
  heroFigure.facing = 0;
  heroFigure.group.rotation.y = 0;
  orbit.theta = Math.PI;
  target.set(heroBody.x, .65, heroBody.z);
  heroFigure.locationId = 'home'; figures.push(heroFigure);
  const enemyBody = (id, locationId, x, z, options = {}) => ({
    id, team: 'enemy', locationId, x, z, vx: 0, vz: 0,
    health: options.health ?? 32, maxHealth: options.maxHealth ?? 32,
    charges: 3, maxCharges: 3, rechargeTimer: 0, aiPhase: 'pause', aiTimer: randomBetween(1, 4),
    combatAwake: options.combatAwake ?? false, spawnReady: options.spawnReady ?? true,
    boss: options.boss ?? false,
  });
  const forestSpawns = [{ x: scaled(-3.1), z: scaled(.3) }, { x: scaled(3.1), z: scaled(.3) }];
  for (let index = 0; index < forestSpawns.length; index++) {
    const point = forestSpawns[index];
    const body = enemyBody(`forest-goblin-${index + 1}`, 'forest', point.x, point.z);
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
  const propTypes = [
    { path: 'assets/env-tree.png', weight: .28, size: [2.1, 3.3] },
    { path: 'assets/env-evergreen.png', weight: .24, size: [1.9, 3.1] },
    { path: 'assets/env-moss-rocks.png', weight: .28, size: [1.1, 2.4] },
    { path: 'assets/env-bushes.png', weight: .2, size: [1.4, 2.6] },
  ];
  await Promise.all(propTypes.map(type => loadSceneryTemplate(type.path)));
  const populateForestEdge = async (location, count, seedOffset = 0) => {
    const group = locationGroups[location.id];
    const random = (() => { let seed = (0x4f1bbcdc + seedOffset) >>> 0; return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); })();
    const tasks = [];
    const scatterTypes = [propTypes[0], propTypes[1], propTypes[2], propTypes[3]];
    let placed = 0;
    for (let candidate = 0; candidate < 180 && placed < count; candidate++) {
      const angle = random() * Math.PI * 2;
      const radius = scaled(10.8 + Math.sqrt(random()) * 3.3);
      const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius * .78;
      if (location.terrainHeightMap.sample(x, z) <= 0) continue;
      const type = scatterTypes[Math.floor(random() * scatterTypes.length)];
      tasks.push(createScenery(type.path, x, z, randomBetween(...type.size), group)); placed++;
    }
    await Promise.all(tasks);
  };
  const homeGroup = locationGroups.home, forestGroup = locationGroups.forest, campGroup = locationGroups.camp;
  const sceneDetails = [
    createScenery('assets/hero-house.png', scaled(-2.4), scaled(-2.4), 3.5, homeGroup, true, { fixedRadius: 1.2, base: true }),
    populateForestEdge(locations.home, 10, 11),
    populateForestEdge(locations.forest, 36, 23),
    ...CAMP_HUT_ANCHORS.map(hut => createScenery('assets/env-troll-hut.png', scaled(hut.x), scaled(hut.z), 3.2,
      campGroup, true, { fixedRadius: PUCK_RADIUS * 1.3, base: true })),
    populateForestEdge(locations.camp, 18, 37),
  ];
  await Promise.all(sceneDetails);
  const decorationSpecs = {
    home: { seed: 1601, decalCount: 19, grassCount: 40,
      exclusions: [{ x: scaled(-2.4), z: scaled(-2.4), radius: 2.7 }, { x: 0, z: 0, radius: 1.55 }] },
    forest: { seed: 2719, decalCount: 38, grassCount: 78,
      exclusions: forestSpawns.map(point => ({ ...point, radius: 1.5 })) },
    camp: { seed: 3899, decalCount: 44, grassCount: 52,
      exclusions: [...campSpawns.map(point => ({ x: point.x, z: point.z, radius: 1.45 })),
        ...CAMP_HUT_ANCHORS.map(hut => ({ x: scaled(hut.x), z: scaled(hut.z), radius: 1.95 }))] },
  };
  await createGroundRenderer({ THREE, renderer, locations, specsByLocation: decorationSpecs,
    pathTargets: { camp: CAMP_HUT_ANCHORS.map(hut => ({ x: scaled(hut.x), z: scaled(hut.z) })) },
    createLocationWalkPaths, scatterGroundDetails });
  refreshLocationInfo();
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
  let activeFigure = figures[0];
  let selectionAge = .6;
  let elapsed = 0;
  let transitionCooldown = 0;
  let victorySequenceActive = false;
  let protectedEntryFrom = null;
  const campSpawnPoints = campSpawns;
  const campGoblinPool = [];
  let campOgrePool = null;
  let campPreloadPromise = null;
  async function preloadCampEnemies() {
    if (campGoblinPool.length >= CAMP_GOBLIN_TOTAL - CAMP_LIVING_CAP && campOgrePool) return;
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
      if (!campOgrePool) {
        const body = enemyBody('camp-ogre-pool', 'camp', 0, 0,
          { health: 0, maxHealth: 48, spawnReady: false, combatAwake: true, boss: true });
        const figure = await createFigure(body, 'ogre');
        figure.locationId = 'camp'; figure.poolDormant = true;
        figure.group.visible = false; figure.healthHUD.visible = false; figure.enemyMarker.group.visible = false;
        figures.push(figure); campOgrePool = figure;
      }
    })().catch(error => { campPreloadPromise = null; throw error; });
    try { await campPreloadPromise; }
    finally { campPreloadPromise = null; }
  }
  function scheduleCampPreload() {
    const preload = () => preloadCampEnemies().catch(error => console.error('Не удалось заранее подготовить лагерь', error));
    if (window.requestIdleCallback) window.requestIdleCallback(preload, { timeout: 1200 });
    else setTimeout(preload, 100);
  }
  function refreshLocationInfo() {
    locationTitle.textContent = activeLocation.title;
    if (activeLocation.kind === 'home') locationDetail.textContent = 'Проход между холмами ведёт в лес';
    else if (activeLocation.kind === 'forest') locationDetail.textContent = activeLocation.combatTriggered
      ? 'Гоблины напали. Узкие проходы ведут домой и к лагерю'
      : 'Тихий лес. Подойди к гоблинам, чтобы начать бой';
    else locationDetail.textContent = activeLocation.bossSpawned
      ? `Вожак вышел! Победы: ${activeLocation.defeats}/${CAMP_BOSS_DEFEATS}`
      : `Победы: ${activeLocation.defeats}/${CAMP_BOSS_DEFEATS} · живых гоблинов: ${activeLocation.enemies.filter(enemy => enemy.health > 0 && !enemy.boss).length}`;
  }
  function rebuildBodies() {
    bodies = [heroBody, ...activeLocation.obstacles, ...activeLocation.enemies.filter(body => body.spawnReady)];
  }
  rebuildBodies();
  function showActiveLocationFigures() {
    for (const figure of figures) {
      const active = figure.body === heroBody || figure.locationId === activeLocation.id;
      const spawning = Boolean(figure.spawnAnimation);
      figure.group.visible = !figure.poolDormant && active && (!spawning || figure.spawnAnimation.age >= 0);
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
    const figure = boss ? campOgrePool : campGoblinPool.pop();
    if (!figure) return null;
    const spawn = source ?? campSpawnPoints[Math.floor(Math.random() * campSpawnPoints.length)];
    if (boss) campOgrePool = null;
    const body = enemyBody(boss ? 'camp-ogre' : `camp-goblin-${locations.camp.goblinsSpawned}`,
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
    activeLocation = next;
    protectedEntryFrom = fromLocationId;
    const arrival = lastExitPosition(activeLocation, fromLocationId) ?? locationArrival(activeLocation, fromLocationId);
    heroBody.x = arrival.x; heroBody.z = arrival.z; heroBody.vx = 0; heroBody.vz = 0;
    const direction = locationEntryDirection(activeLocation, fromLocationId);
    const heading = Math.atan2(direction.x, direction.z);
    heroFigure.facing = heading; heroFigure.group.rotation.y = heading;
    orbit.theta = heading + Math.PI;
    target.set(heroBody.x, .65, heroBody.z);
    transitionCooldown = .85;
    if (activeLocation.kind === 'camp' && !activeLocation.initialized) {
      activeLocation.initialized = true;
      for (const figure of figures.filter(item => item.locationId === 'camp' && !item.poolDormant
        && !item.body.boss && !item.body.spawnReady && !item.spawnAnimation)) {
        beginSpawn(figure, figure.spawnSource);
      }
    }
    if (next.id === 'forest') scheduleCampPreload();
    showActiveLocationFigures();
    rebuildBodies();
    refreshLocationInfo();
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
  function damage(target, damageQuarters, speed) {
    if (target.hitCooldown > 0 || target.health <= 0) return false;
    target.health = Math.max(0, target.health - Math.max(1, Math.trunc(damageQuarters)));
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
    return true;
  }
  let lastVibration = 0;
  function vibrate(pattern) {
    const now = performance.now();
    if (now - lastVibration < 100) return;
    lastVibration = now;
    navigator.vibrate?.(pattern);
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
        if (attacker.fixed || target.fixed) return;
        if (attacker.health <= 0 || (attacker.team === target.team && attacker.team !== 'enemy') || (attacker.attackRicochets || 0) >= 3) return;
        if (!damage(target, ricochetDamageQuarters(attacker.attackRicochets || 0), speed)) return;
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
        const quantized = Math.max(0, Math.round(extension * 12) / 12);
        if (Math.abs(quantized - currentExtension) < 1e-6) return;
        const previous = outline.geometry;
        outline.geometry = markerGeometry(quantized);
        if (overlap) overlap.geometry = outline.geometry;
        previous.dispose();
        currentExtension = quantized;
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
  const inputController = createPointerInput({ THREE, host, inputElement: renderer.domElement, camera, orbit, playerMarker,
    getBody: () => state, getActiveFigure: () => activeFigure, hitFigure, choose, stopAim,
    groundUiY: GROUND_UI_Y, aimDragSensitivity: AIM_DRAG_SENSITIVITY,
    maxAimMarkerExtension: MAX_AIM_MARKER_EXTENSION,
    onLaunch(body, pull) {
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
  loading.hidden = true;
  let previousTime = null;
  renderer.setAnimationLoop(time => {
    const dt = previousTime === null ? 0 : Math.min((time - previousTime) / 1000, .05);
    previousTime = time;
    elapsed += dt;
    transitionCooldown = Math.max(0, transitionCooldown - dt);
    if (heroBody.health <= 0) beginVictorySequence();
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
    }
    for (let remaining = dt; remaining > 0; remaining -= 1 / 120) {
      advanceWorld(bodies, Math.min(remaining, 1 / 120), held, onImpact, activeLocation.walkablePoints);
      if (victorySequenceActive) for (const body of bodies) if (!body.fixed) body.vx = body.vz = 0;
    }
    for (const figure of figures) {
      if (figure.poolDormant) continue;
      const body = figure.body;
      if (body !== heroBody && figure.locationId !== activeLocation.id) continue;
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

