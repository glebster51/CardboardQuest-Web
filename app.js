import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { clampPull, launch, advanceWorld, facingAngle, turnToward, isAttacking, MAX_PULL, WALKABLE_POINTS, PUCK_RADIUS } from './physics.mjs?v=19';
import { unionSpriteAlpha, clipSpriteToAlphaMask } from './sprite-geometry.mjs?v=6';
import { createTerrainHeightMap, extractTerrainContours, nearestPointOnPath } from './terrain-shapes.mjs?v=3';
import { createMarkerContours, markerFillTransform } from './marker-shapes.mjs?v=1';
import { advanceChargeRecharge, chargeRechargeProgress } from './charge-recharge.mjs?v=1';
import { heartHealthLevels, ricochetDamageQuarters } from './heart-health.mjs?v=1';
import { silhouetteShapes as buildSilhouetteShapes, makeExtrudedSprite as buildExtrudedSprite } from './figure-model.mjs?v=4';
import { makeScenerySprite } from './scenery-model-v4.mjs?v=4';
import { PUCK_CENTER_Y, PUCK_HEIGHT, sceneryTokenLayout } from './scenery-layout.mjs?v=1';
import { createLocationWalkPaths, scatterGroundDetails } from './ground-decoration.mjs?v=1';
import { advanceVictoryLoop, createVictoryLoop, settleEnemiesForVictory } from './victory-animation.mjs?v=1';
import { CAMP_BOSS_DEFEATS, CAMP_GOBLIN_SPAWNS, CAMP_HUT_ANCHORS, CAMP_LIVING_CAP, LOCATION_SCALE,
  createLocationNetwork, findNearbyExit, lastExitPosition, locationArrival, locationEntryDirection, shouldIgnoreEntryExit,
  recordCampDefeat, rememberExitPosition, takeDueReinforcement, wakeForestCombat } from './location-network.mjs?v=5';

const host = document.querySelector('#scene');
const loading = document.querySelector('#loading');
const scaled = value => value * LOCATION_SCALE;
const heroBody = { id: 'hero', team: 'player', x: 0, z: 0, vx: 0, vz: 0,
  health: 20, maxHealth: 20, charges: 3, maxCharges: 3, rechargeTimer: 0, chargePop: [0, 0, 0] };
let bodies = [heroBody];
let state = heroBody;
let selected = true;
const pointers = new Map();
let gesture = null;
const GROUND_UI_Y = .026;
const AIM_DRAG_SENSITIVITY = 1 / 3;
const AIM_MARKER_LENGTH_SCALE = 1 / 1.3;
const MAX_AIM_MARKER_EXTENSION = 5.4 * AIM_MARKER_LENGTH_SCALE;
const randomBetween = (min, max) => min + Math.random() * (max - min);
const VISUAL_STATES = ['idle', 'aiming', 'attack', 'deal-damage', 'on-hit', 'dead'];

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
  let theta = .22, phi = .86, distance = innerWidth < 650 ? 27 : 15.75;
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
  function terrainShape(outerPoints, innerPoints = null) {
    const shape = new THREE.Shape();
    const outer = outerPoints.map(point => new THREE.Vector2(point.x, -point.z));
    const orderedOuter = THREE.ShapeUtils.isClockWise(outer) ? [...outer].reverse() : outer;
    shape.moveTo(orderedOuter[0].x, orderedOuter[0].y);
    for (let i = 1; i < orderedOuter.length; i++) shape.lineTo(orderedOuter[i].x, orderedOuter[i].y);
    shape.closePath();
    if (innerPoints) {
      const inner = innerPoints.map(point => new THREE.Vector2(point.x, -point.z));
      const orderedInner = THREE.ShapeUtils.isClockWise(inner) ? inner : [...inner].reverse();
      const hole = new THREE.Path();
      hole.moveTo(orderedInner[0].x, orderedInner[0].y);
      for (let i = 1; i < orderedInner.length; i++) hole.lineTo(orderedInner[i].x, orderedInner[i].y);
      hole.closePath(); shape.holes.push(hole);
    }
    return shape;
  }
  function terrainShapesFromContours(contours) {
    const records = contours.map(points => {
      let area = 0;
      for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length];
        area += a.x * b.z - b.x * a.z;
      }
      return { points, area: Math.abs(area), parent: null, depth: 0 };
    });
    const contains = (point, polygon) => {
      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const a = polygon[i], b = polygon[j];
        if ((a.z > point.z) !== (b.z > point.z) && point.x < (b.x - a.x) * (point.z - a.z) / (b.z - a.z) + a.x) inside = !inside;
      }
      return inside;
    };
    for (const record of records) {
      record.parent = records.filter(candidate => candidate.area > record.area && contains(record.points[0], candidate.points))
        .sort((a, b) => a.area - b.area)[0] || null;
    }
    const depthOf = record => record.parent ? depthOf(record.parent) + 1 : 0;
    records.forEach(record => { record.depth = depthOf(record); });
    return records.filter(record => record.depth % 2 === 0).map(record => {
      const shape = terrainShape(record.points);
      for (const child of records) if (child.parent === record && child.depth === record.depth + 1) {
        const holePoints = child.points.map(point => new THREE.Vector2(point.x, -point.z));
        const orderedHole = THREE.ShapeUtils.isClockWise(holePoints) ? holePoints : [...holePoints].reverse();
        const hole = new THREE.Path();
        hole.moveTo(orderedHole[0].x, orderedHole[0].y);
        for (let i = 1; i < orderedHole.length; i++) hole.lineTo(orderedHole[i].x, orderedHole[i].y);
        hole.closePath(); shape.holes.push(hole);
      }
      return shape;
    });
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
  const terrainPalettes = {
    home: { tops: [0x84964c, 0x9ca657, 0xb4a868, 0xc0a873], side: 0x805b39 },
    forest: { tops: [0x647e43, 0x78884b, 0x9c975b, 0xb29d70], side: 0x67472e },
    camp: { tops: [0x8a784e, 0x9e8953, 0xb2a067, 0xc1ad78], side: 0x775037 },
  };
  for (const location of Object.values(locations)) {
    const map = createTerrainHeightMap(location.id === 'home' ? 8128 : location.id === 'forest' ? 42119 : 99731,
      location.walkablePoints, { cellSize: .85, step: .24, maxHeight: 3.6 });
    location.terrainHeightMap = map;
    location.sceneGroup.userData.terrainHeightMap = map;
    const palette = terrainPalettes[location.id];
    const layers = [{
      shapes: [terrainShape(location.walkablePoints)], depth: .3, top: 0,
      topColor: palette.tops[0], sideColor: palette.side,
    }, {
      shapes: terrainShapesFromContours(extractTerrainContours(map, .001)), depth: map.step, top: map.step,
      topColor: palette.tops[1], sideColor: palette.side,
    }, ...map.layers.filter(layer => layer.contours.length).map((layer, index) => ({
      shapes: terrainShapesFromContours(layer.contours), depth: map.step, top: layer.height,
      topColor: palette.tops[(index + 2) % palette.tops.length], sideColor: index % 2 ? palette.side : 0x9c7243,
    }))];
    for (const layer of layers) {
      if (!layer.shapes.length) continue;
      const terrainUvGenerator = {
        generateTopUV(_geometry, vertices, a, b, c) {
          return [a, b, c].map(index => new THREE.Vector2(vertices[index * 3], vertices[index * 3 + 1]));
        },
        generateSideWallUV(_geometry, vertices, a, b, c, d) {
          const horizontal = Math.abs(vertices[b * 3] - vertices[a * 3]) >= Math.abs(vertices[b * 3 + 1] - vertices[a * 3 + 1]);
          return [a, b, c, d].map(index => {
            const alongEdge = horizontal ? vertices[index * 3] : vertices[index * 3 + 1];
            return new THREE.Vector2(alongEdge * .25, vertices[index * 3 + 2] / layer.depth);
          });
        },
      };
      const geometry = new THREE.ExtrudeGeometry(layer.shapes, {
        depth: layer.depth, bevelEnabled: false, steps: 1, UVGenerator: terrainUvGenerator,
      });
      geometry.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geometry, [
        new THREE.MeshStandardMaterial({ color: layer.topColor, map: layer.top === 0 ? paper : null, roughness: .96, ...sceneStencil }),
        new THREE.MeshStandardMaterial({ color: layer.sideColor, map: terrainCorrugation, roughness: 1, ...sceneStencil }),
      ]);
      mesh.position.y = layer.top - layer.depth;
      mesh.castShadow = true; mesh.receiveShadow = true; location.sceneGroup.add(mesh);
    }
  }
  async function createFigure(body, prefix) {
    const group = new THREE.Group();
    scene.add(group);
    const ambientShadow = new THREE.Mesh(new THREE.CircleGeometry(1.02, 64), ambientShadowMaterial);
    ambientShadow.rotation.x = -Math.PI / 2; ambientShadow.position.y = .008; ambientShadow.renderOrder = 1;
    group.add(ambientShadow);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.8, .8, .2, 80), [
      new THREE.MeshStandardMaterial({ map: corrugation, roughness: 1, ...sceneStencil }),
      new THREE.MeshStandardMaterial({ map: paper, roughness: 1, ...sceneStencil }),
      new THREE.MeshStandardMaterial({ color: 0x97713e, ...sceneStencil }),
    ]);
    base.position.y = .115; base.castShadow = true; base.receiveShadow = true;
    group.add(base);
    const contactShadow = new THREE.Mesh(new THREE.PlaneGeometry(.98, .34), contactShadowMaterial);
    contactShadow.rotation.x = -Math.PI / 2; contactShadow.position.set(0, .218, .02); contactShadow.renderOrder = 5;
    group.add(contactShadow);
    const slot = new THREE.Mesh(new THREE.BoxGeometry(1.08, .012, .075), new THREE.MeshStandardMaterial({ color: 0x6c502f }));
    slot.position.y = .219; group.add(slot);

    const loader = new THREE.TextureLoader();
    const artStates = {};
    const sources = await Promise.all(VISUAL_STATES.map(visualState => loader.loadAsync(`assets/${prefix}-${visualState}.png?sheet=3`)));
    const backTextures = await Promise.all(VISUAL_STATES.map(visualState => loader.loadAsync(`assets/${prefix}-${visualState}-back.png?sheet=3`)));
    const frameWidth = sources[0].image.width, frameHeight = sources[0].image.height;
    if (sources.some(source => source.image.width !== frameWidth || source.image.height !== frameHeight)
      || backTextures.some(source => source.image.width !== frameWidth || source.image.height !== frameHeight)) {
      throw new Error(`Pose sheet cells must share one frame: ${prefix}`);
    }
    const prepareFace = (image, visualState, side) => {
      const canvas = document.createElement('canvas');
      canvas.width = frameWidth; canvas.height = frameHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      const flipIdlePlayerFront = body.team === 'player' && visualState === 'idle' && side === 'front';
      if (flipIdlePlayerFront) { context.translate(frameWidth, 0); context.scale(-1, 1); }
      context.drawImage(image, 0, 0, frameWidth, frameHeight);
      if (flipIdlePlayerFront) context.setTransform(1, 0, 0, 1, 0, 0);
      const pixels = context.getImageData(0, 0, frameWidth, frameHeight).data;
      if (!pixels.some((_value, index) => index % 4 === 3 && pixels[index] > 80)) throw new Error(`Empty sprite: ${prefix}-${visualState}-${side}`);
      const cleanedMask = unionSpriteAlpha(pixels, pixels, frameWidth, frameHeight);
      const worldWidth = 2.05 * frameWidth / frameHeight;
      const geometry = buildSilhouetteShapes(cleanedMask, frameWidth, frameHeight, worldWidth, 2.05);
      const alphaPixels = clipSpriteToAlphaMask(pixels, geometry.rasterMask);
      context.putImageData(new ImageData(alphaPixels, frameWidth, frameHeight), 0, 0);
      const faceTexture = new THREE.CanvasTexture(canvas); faceTexture.colorSpace = THREE.SRGBColorSpace;
      faceTexture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      const model = buildExtrudedSprite(alphaPixels, frameWidth, frameHeight, faceTexture, faceTexture,
        corrugation, body.team === 'player', geometry.shapes, alphaPixels);
      model.group.rotation.y = side === 'back' ? Math.PI : 0;
      return { ...model, texture: faceTexture };
    };
    for (let stateIndex = 0; stateIndex < VISUAL_STATES.length; stateIndex++) {
      const visualState = VISUAL_STATES[stateIndex];
      const frontArt = prepareFace(sources[stateIndex].image, visualState, 'front');
      const backArt = prepareFace(backTextures[stateIndex].image, visualState, 'back');
      const artGroup = new THREE.Group(); artGroup.position.y = 1.25;
      artGroup.add(frontArt.group, backArt.group);
      frontArt.group.visible = true; backArt.group.visible = false;
      artGroup.visible = visualState === 'idle';
      group.add(artGroup);
      artStates[visualState] = { group: artGroup, frontArt, backArt,
        alphaPixels: frontArt.alphaPixels, width: frameWidth, height: frameHeight };
      sources[stateIndex].dispose();
      backTextures[stateIndex].dispose();
    }
    const initialArt = artStates.idle;
    let deadBottomRow = frameHeight - 1;
    for (let y = frameHeight - 1; y >= 0; y--) {
      let hasVisiblePixel = false;
      for (let x = 0; x < frameWidth; x++) if (artStates.dead.alphaPixels[(y * frameWidth + x) * 4 + 3] > 80) {
        hasVisiblePixel = true; break;
      }
      if (hasVisiblePixel) { deadBottomRow = y; break; }
    }
    const deadBottomLocalY = (.5 - deadBottomRow / frameHeight) * 2.05;
    const deadGroundedY = .215 - deadBottomLocalY;

    const healthHUD = new THREE.Group();
    const initialHeartLevels = heartHealthLevels(body.health, body.maxHealth);
    const heartIcons = initialHeartLevels.map((level, index) => {
      const heart = new THREE.Mesh(new THREE.PlaneGeometry(.23, .23), heartMaterials[level]);
      heart.renderOrder = 100;
      heart.position.set((index - (initialHeartLevels.length - 1) / 2) * .245, 0, .01);
      healthHUD.add(heart);
      return { mesh: heart, level };
    });
    let chargePips = [];
    if (body.team === 'player') {
      chargePips = Array.from({ length: body.maxCharges }, (_, index) => {
        const pip = new THREE.Group();
        const base = new THREE.Mesh(new THREE.CircleGeometry(.09, 32),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .4, side: THREE.DoubleSide, depthWrite: false }));
        const fill = new THREE.Mesh(new THREE.CircleGeometry(.09, 32),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .9, side: THREE.DoubleSide, depthWrite: false, depthTest: false }));
        base.material.depthTest = false;
        base.renderOrder = 100; fill.renderOrder = 101;
        fill.position.z = .012;
        pip.position.set((index - (body.maxCharges - 1) / 2) * .32, .29, .02);
        pip.add(base, fill); healthHUD.add(pip);
        return { group: pip, base, fill };
      });
    }
    healthHUD.position.set(body.x, 2.65, body.z);
    scene.add(healthHUD);
    let enemyMarker = null;
    if (body.team === 'enemy') {
      enemyMarker = createVectorMarker(0xdf3830, 0xff887d, true);
      enemyMarker.group.rotation.y = body.aiAimAngle ?? 0;
      enemyMarker.group.position.set(body.x, GROUND_UI_Y, body.z);
      scene.add(enemyMarker.group);
    }
    const figure = { group, artGroup: initialArt.group, artStates, visualState: 'idle', body,
      alphaPixels: initialArt.alphaPixels, width: initialArt.width, height: initialArt.height,
      healthHUD, heartIcons, chargePips, enemyMarker, deadGroundedY,
      flashMaterial: initialArt.frontArt.flashMaterial, backFlashMaterial: initialArt.backArt.flashMaterial,
      viewBack: false, facing: 0, hitAge: 10, hitStrength: 0,
      hurtAge: 10, dealDamageAge: 10 };
    group.userData.figure = figure;
    group.position.set(body.x, 0, body.z);
    return figure;
  }
  const sceneryTemplates = new Map();
  const sceneryFacePairs = [];
  function loadSceneryTemplate(path) {
    if (sceneryTemplates.has(path)) return sceneryTemplates.get(path);
    const pending = (async () => {
    const source = await new THREE.TextureLoader().loadAsync(`${path}?art=4`);
    const art = makeScenerySprite(source.image, corrugation, renderer.capabilities.getMaxAnisotropy());
    source.dispose();
    return art.group;
    })();
    sceneryTemplates.set(path, pending);
    return pending;
  }
  async function createScenery(path, x, z, size, parent = scene, allowFlat = false, options = {}) {
    const template = await loadSceneryTemplate(path);
    const art = template.clone(true);
    // Scale the artwork to its requested height while keeping a consistent cardboard edge thickness.
    const layout = sceneryTokenLayout(size, options.base ? options.fixedRadius ?? 0 : 0);
    art.scale.setScalar(layout.scale);
    // The sprite's bottom rests on the ground or on top of its cardboard puck.
    art.position.y = layout.artY;
    const terrain = parent.userData.terrainHeightMap ?? locations.home.terrainHeightMap;
    const elevation = terrain.sample(x, z);
    if (elevation <= 0 && !allowFlat) return null;
    const prop = new THREE.Group(); prop.position.set(x, elevation, z); prop.add(art);
    if (options.fixedRadius) {
      const baseRadius = options.base ? options.fixedRadius : 0;
      if (baseRadius) {
        const base = new THREE.Mesh(new THREE.CylinderGeometry(baseRadius, baseRadius, PUCK_HEIGHT, 64), [
          new THREE.MeshStandardMaterial({ map: terrainCorrugation, roughness: 1, ...sceneStencil }),
          new THREE.MeshStandardMaterial({ map: paper, roughness: .96, ...sceneStencil }),
          new THREE.MeshStandardMaterial({ color: 0x97713e, ...sceneStencil }),
        ]);
        base.position.y = PUCK_CENTER_Y; base.castShadow = true; base.receiveShadow = true; prop.add(base);
      }
      const owner = Object.values(locations).find(location => location.sceneGroup === parent);
      owner?.obstacles.push({ id: `obstacle-${owner.id}-${owner.obstacles.length + 1}`, x, z,
        vx: 0, vz: 0, radius: options.fixedRadius, fixed: true, team: 'obstacle' });
    }
    const inward = nearestPointOnPath(x, z, parent.userData.walkablePoints ?? WALKABLE_POINTS);
    prop.rotation.y = Math.atan2(inward.x - x, inward.z - z);
    sceneryFacePairs.push({ prop, front: art.getObjectByName('scenery-front'), back: art.getObjectByName('scenery-back') });
    parent.add(prop);
    return prop;
  }
  const figures = [];
  const heroFigure = await createFigure(heroBody, 'hero');
  heroFigure.facing = 0;
  heroFigure.group.rotation.y = 0;
  theta = Math.PI;
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
  const groundTextureCache = new Map();
  const loadGroundTexture = path => {
    if (!groundTextureCache.has(path)) {
      groundTextureCache.set(path, new THREE.TextureLoader().loadAsync(path).then(texture => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        return texture;
      }));
    }
    return groundTextureCache.get(path);
  };
  const groundMarkMaterial = (texture, opacity) => new THREE.MeshBasicMaterial({ map: texture, transparent: true,
    alphaTest: .035, opacity, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 });
  const groundAssets = [
    'ground-pit', 'ground-grass-ring', 'ground-dirt-patch', 'ground-footprints',
    'ground-footsteps', 'ground-scuff', 'ground-pebbles', 'ground-cracks',
    ...Array.from({ length: 8 }, (_, index) => `grass-tuft-${index + 1}`),
  ];
  const groundTextures = new Map();
  await Promise.all(groundAssets.map(async name => groundTextures.set(name, await loadGroundTexture(`assets/${name}.png`))));
  const groundMaterials = new Map(groundAssets.map(name => [name,
    groundMarkMaterial(groundTextures.get(name), name.startsWith('grass-tuft-') ? .94 : .8)]));
  const addGroundInstances = (parent, kind, marks, upright = false) => {
    if (!marks.length) return;
    const multiplier = upright ? 2 : 1;
    const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), groundMaterials.get(kind), marks.length * multiplier);
    const position = new THREE.Vector3(), quaternion = new THREE.Quaternion(), scale = new THREE.Vector3(), matrix = new THREE.Matrix4();
    const euler = new THREE.Euler(0, 0, 0, 'XYZ');
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
    mesh.renderOrder = upright ? 3 : 2;
    mesh.frustumCulled = false;
    parent.add(mesh);
  };
  const decorationSpecs = {
    home: { seed: 1601, decalCount: 19, grassCount: 40,
      exclusions: [{ x: scaled(-2.4), z: scaled(-2.4), radius: 2.7 }, { x: 0, z: 0, radius: 1.55 }] },
    forest: { seed: 2719, decalCount: 38, grassCount: 78,
      exclusions: forestSpawns.map(point => ({ ...point, radius: 1.5 })) },
    camp: { seed: 3899, decalCount: 44, grassCount: 52,
      exclusions: [...campSpawns.map(point => ({ x: point.x, z: point.z, radius: 1.45 })),
        ...CAMP_HUT_ANCHORS.map(hut => ({ x: scaled(hut.x), z: scaled(hut.z), radius: 1.95 }))] },
  };
  for (const location of Object.values(locations)) {
    const specs = decorationSpecs[location.id];
    const hutPaths = location.id === 'camp' ? CAMP_HUT_ANCHORS.map(hut => ({ x: scaled(hut.x), z: scaled(hut.z) })) : [];
    const paths = createLocationWalkPaths(location, hutPaths);
    const details = scatterGroundDetails({ location, ...specs, paths });
    const ground = new THREE.Group();
    ground.name = `ground-details-${location.id}`;
    ground.userData.walkPaths = paths;
    location.sceneGroup.add(ground);
    const groundMarks = [...details.decals, ...details.trail];
    for (const kind of groundAssets.slice(0, 8)) addGroundInstances(ground, kind,
      groundMarks.filter(mark => mark.kind === kind));
    for (const kind of groundAssets.slice(8)) addGroundInstances(ground, kind,
      details.grass.filter(mark => mark.kind === kind), true);
    location.groundDetails = { ...details, paths };
  }
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
      figure.group.visible = active && (!spawning || figure.spawnAnimation.age >= 0);
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
    stopAim();
    gesture = null; pointers.clear(); selected = false;
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
    const spawn = source ?? campSpawnPoints[Math.floor(Math.random() * campSpawnPoints.length)];
    const index = locations.camp.enemies.filter(body => body.id.startsWith('camp-goblin-')).length + 1;
    const body = enemyBody(boss ? 'camp-ogre' : `camp-goblin-${index}-${Math.round(elapsed * 1000)}`,
      'camp', spawn.x, spawn.z, boss
        ? { health: 48, maxHealth: 48, combatAwake: true, spawnReady: false, boss: true }
        : { combatAwake: true, spawnReady: false });
    body.aiPhase = 'pause'; body.aiTimer = randomBetween(.4, 1.2);
    locations.camp.enemies.push(body);
    const figure = await createFigure(body, boss ? 'ogre' : 'goblin');
    figure.locationId = 'camp'; figures.push(figure);
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
    stopAim(); gesture = null; pointers.clear();
    activeLocation = next;
    protectedEntryFrom = fromLocationId;
    const arrival = lastExitPosition(activeLocation, fromLocationId) ?? locationArrival(activeLocation, fromLocationId);
    heroBody.x = arrival.x; heroBody.z = arrival.z; heroBody.vx = 0; heroBody.vz = 0;
    const direction = locationEntryDirection(activeLocation, fromLocationId);
    const heading = Math.atan2(direction.x, direction.z);
    heroFigure.facing = heading; heroFigure.group.rotation.y = heading;
    theta = heading + Math.PI;
    target.set(heroBody.x, .65, heroBody.z);
    transitionCooldown = .85;
    if (activeLocation.kind === 'camp' && !activeLocation.initialized) {
      activeLocation.initialized = true;
      for (const figure of figures.filter(item => item.locationId === 'camp' && !item.body.boss && !item.body.spawnReady)) {
        beginSpawn(figure, figure.spawnSource);
      }
    }
    showActiveLocationFigures();
    rebuildBodies();
    refreshLocationInfo();
  }
  function startQueuedReinforcement() {
    activeLocation.pendingSpawns = Math.max(0, activeLocation.pendingSpawns - 1);
    activeLocation.goblinsSpawned++;
    spawnCampGoblin().catch(error => console.error('Не удалось создать гоблина лагеря', error));
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
  renderer.domElement.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button !== 0 && event.button !== 2) return;
    event.preventDefault();
    try { event.target.setPointerCapture(event.pointerId); } catch { /* Window listeners still track the drag. */ }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size > 1) {
      stopAim();
      const points = [...pointers.values()];
      const pinchStart = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
      gesture = { mode: 'touchOrbit', pinchStart, zoomStart: distance,
        lastX: (points[0].x + points[1].x) / 2, lastY: (points[0].y + points[1].y) / 2 };
      return;
    }
    if (event.button === 2 || event.altKey) {
      gesture = { mode: 'orbit', pointer: event.pointerId, startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastY: event.clientY, moved: false };
    } else {
      const hit = hitFigure(event.clientX, event.clientY);
      if (hit?.body.team === 'player') choose(hit);
      if (hit?.body.team === 'enemy') {
        gesture = { mode: 'blocked', pointer: event.pointerId };
      } else if (hit) {
        if (state.charges > 0 && state.health > 0) {
          gesture = { mode: 'aim', pointer: event.pointerId, pull: { x: 0, z: 0 },
            hit, startX: event.clientX, startY: event.clientY, moved: false };
        } else {
          gesture = { mode: 'blocked', pointer: event.pointerId };
        }
      } else {
        gesture = { mode: 'orbit', pointer: event.pointerId, startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastY: event.clientY, moved: false };
      }
    }
  });
  addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId) || !gesture) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (gesture.mode === 'touchOrbit') {
      if (pointers.size >= 2) {
        const points = [...pointers.values()];
        const x = (points[0].x + points[1].x) / 2, y = (points[0].y + points[1].y) / 2;
        const pinch = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
        distance = THREE.MathUtils.clamp(gesture.zoomStart * gesture.pinchStart / Math.max(1, pinch), 4.5, 27);
        theta -= (x - gesture.lastX) * .007;
        phi = THREE.MathUtils.clamp(phi - (y - gesture.lastY) * .005, .35, 1.3);
        gesture.lastX = x; gesture.lastY = y;
      }
      return;
    }
    if (event.pointerId !== gesture.pointer) return;
    if (gesture.mode === 'blocked') return;
    if (Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > 7) gesture.moved = true;
    if (gesture.mode === 'aim') {
      if (!gesture.moved) return;
      if (!gesture.aimStarted) {
        state.vx = 0; state.vz = 0;
        gesture.aimStarted = true;
        host.classList.add('aiming');
      }
      choose(activeFigure);
      // Use drag displacement, independent of where on the screen it started.
      const scale = 2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / innerHeight;
      const dx = (event.clientX - gesture.startX) * scale;
      const dz = (event.clientY - gesture.startY) * scale / Math.cos(phi);
      gesture.pull = clampPull((Math.cos(theta) * dx + Math.sin(theta) * dz) * AIM_DRAG_SENSITIVITY,
        (-Math.sin(theta) * dx + Math.cos(theta) * dz) * AIM_DRAG_SENSITIVITY);
      const direction = new THREE.Vector3(-gesture.pull.x, 0, -gesture.pull.z);
      const length = direction.length();
      playerMarker.setExtension(length > .02 ? length / MAX_PULL * MAX_AIM_MARKER_EXTENSION : 0);
      if (length > .06) {
        activeFigure.facing = facingAngle(direction.x, direction.z, activeFigure.facing);
        playerMarker.group.position.set(state.x, GROUND_UI_Y, state.z);
        playerMarker.group.rotation.y = activeFigure.facing;
      }
    } else {
      const dx = event.clientX - gesture.lastX, dy = event.clientY - gesture.lastY;
      theta -= dx * .007;
      phi = THREE.MathUtils.clamp(phi - dy * .005, .35, 1.3);
      gesture.lastX = event.clientX; gesture.lastY = event.clientY;
    }
  });
  function release(event, cancelled) {
    if (!pointers.has(event.pointerId)) return;
    if (gesture?.pointer === event.pointerId) {
      if (gesture.mode === 'aim') {
        if (!cancelled && gesture.moved) {
          if (state.team === 'player' && state.health > 0 && state.charges > 0) {
            state.charges--;
            state.chargePop[state.charges] = 0;
            state.attackRicochets = 0;
            launch(state, gesture.pull);
            if (Math.hypot(state.vx, state.vz) > 1) burst(state.x, state.z, .55);
          }
        }
        else if (!cancelled) choose(gesture.hit);
        stopAim();
      }
      gesture = null;
    }
    if (gesture?.mode === 'touchOrbit') gesture = null;
    pointers.delete(event.pointerId);
    if (pointers.size === 0) gesture = null;
  }
  addEventListener('pointerup', event => release(event, false));
  addEventListener('pointercancel', event => release(event, true));
  addEventListener('lostpointercapture', event => release(event, true));
  host.addEventListener('contextmenu', event => event.preventDefault());
  host.addEventListener('wheel', event => {
    event.preventDefault();
    const deltaPixels = event.deltaY * (event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16
      : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? innerHeight : 1);
    if (Number.isFinite(deltaPixels)) {
      const comfortableDelta = THREE.MathUtils.clamp(deltaPixels, -240, 240);
      distance = THREE.MathUtils.clamp(distance * Math.exp(comfortableDelta * .0012), 4.5, 27);
    }
  }, { passive: false });
  addEventListener('blur', () => { stopAim(); gesture = null; pointers.clear(); });

  function updateCamera() {
    camera.position.set(target.x + distance * Math.sin(phi) * Math.sin(theta), target.y + distance * Math.cos(phi), target.z + distance * Math.sin(phi) * Math.cos(theta));
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
    const held = gesture?.mode === 'aim' ? state : null;
    for (const body of bodies) {
      if (body.fixed) continue;
      body.hitCooldown = Math.max(0, (body.hitCooldown || 0) - dt);
      advanceChargeRecharge(body, dt);
      if (body.team !== 'enemy') continue;
      if (body.health <= 0) continue;
      if (victorySequenceActive) continue;
      if (!body.combatAwake) {
        const dx = state.x - body.x, dz = state.z - body.z;
        const figure = figures.find(item => item.body === body);
        if (figure && Math.hypot(body.vx, body.vz) < .05) figure.facing = facingAngle(dx, dz, figure.facing);
        continue;
      }
      if (body.aiStunRemaining > 0) {
        body.aiStunRemaining = Math.max(0, body.aiStunRemaining - dt);
        continue;
      }
      if (body.aiPhase !== 'dash') body.aiTimer -= dt;
      const dx = state.x - body.x, dz = state.z - body.z;
      const distanceToPlayer = Math.hypot(dx, dz);
      const speed = Math.hypot(body.vx, body.vz);
      if (state.health > 0 && distanceToPlayer > .001 && speed < .05) {
        const figure = figures.find(item => item.body === body);
        figure.facing = facingAngle(dx, dz, figure.facing);
      }
      if (body.aiPhase === 'dash' && speed < .2) {
        body.aiPhase = 'pause'; body.aiTimer = randomBetween(1, 4);
      } else if (body.aiPhase === 'pause' && body.aiTimer <= 0) {
        body.aiPhase = 'aim'; body.aiTargetX = state.x; body.aiTargetZ = state.z;
        body.aiAimAngle = facingAngle(body.aiTargetX - body.x, body.aiTargetZ - body.z,
          figures.find(item => item.body === body)?.facing ?? 0);
        body.aiAimDuration = randomBetween(1.7, 2.7); body.aiTimer = body.aiAimDuration;
        const figure = figures.find(item => item.body === body);
        if (figure) figure.facing = body.aiAimAngle;
      } else if (body.aiPhase === 'aim' && body.aiTimer <= 0 && body.charges > 0 && state.health > 0 && body.health > 0) {
        const aimX = body.aiTargetX - body.x, aimZ = body.aiTargetZ - body.z;
        const aimDistance = Math.hypot(aimX, aimZ);
        const power = THREE.MathUtils.clamp(aimDistance * .12, .55, .95);
        body.charges--; body.aiPhase = 'dash'; body.attackRicochets = 0;
        launch(body, { x: -aimX / Math.max(.001, aimDistance) * power,
          z: -aimZ / Math.max(.001, aimDistance) * power });
        burst(body.x, body.z, .45);
      }
      if (body.health <= 0) body.vx = body.vz = 0;
    }
    for (let remaining = dt; remaining > 0; remaining -= 1 / 120) {
      advanceWorld(bodies, Math.min(remaining, 1 / 120), held, onImpact, activeLocation.walkablePoints);
      if (victorySequenceActive) for (const body of bodies) if (!body.fixed) body.vx = body.vz = 0;
    }
    for (const figure of figures) {
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

