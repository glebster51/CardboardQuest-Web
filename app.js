import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { clampPull, launch, advanceWorld, facingAngle, turnToward, isAttacking, MAX_PULL, WALKABLE_POINTS, PUCK_RADIUS } from './physics.mjs?v=17';
import { unionSpriteAlpha, clipSpriteToAlphaMask } from './sprite-geometry.mjs?v=5';
import { createTerrainPeaks, makeNoisyBoundary, gaussianGrowthField, nearestPointOnPath, containingTerrainLayer } from './terrain-shapes.mjs?v=2';
import { createMarkerContours, markerFillTransform } from './marker-shapes.mjs?v=1';
import { advanceChargeRecharge, chargeRechargeProgress } from './charge-recharge.mjs?v=1';
import { silhouetteShapes as buildSilhouetteShapes, makeExtrudedSprite as buildExtrudedSprite } from './figure-model.mjs?v=4';

const host = document.querySelector('#scene');
const loading = document.querySelector('#loading');
const bodies = [
  { id: 'hero', team: 'player', x: 0, z: 0, vx: 0, vz: 0, health: 100, maxHealth: 100, charges: 3, maxCharges: 3, rechargeTimer: 0, chargePop: [0, 0, 0] },
  { id: 'goblin-1', team: 'enemy', x: -3.1, z: 2.8, vx: 0, vz: 0, health: 100, maxHealth: 100, charges: 3, maxCharges: 3, rechargeTimer: 0, aiPhase: 'pause', aiTimer: 1 + Math.random() * 3 },
  { id: 'goblin-2', team: 'enemy', x: 3.1, z: 2.8, vx: 0, vz: 0, health: 100, maxHealth: 100, charges: 3, maxCharges: 3, rechargeTimer: 0, aiPhase: 'pause', aiTimer: 1 + Math.random() * 3 },
  { id: 'goblin-3', team: 'enemy', x: 0, z: 5.7, vx: 0, vz: 0, health: 100, maxHealth: 100, charges: 3, maxCharges: 3, rechargeTimer: 0, aiPhase: 'pause', aiTimer: 1 + Math.random() * 3 },
];
let state = bodies[0];
let selected = true;
const pointers = new Map();
let gesture = null;
const GROUND_UI_Y = .026;
const AIM_DRAG_SENSITIVITY = 1 / 3;
const AIM_MARKER_LENGTH_SCALE = 1 / 1.3;
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
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 280);
  const target = new THREE.Vector3(0, .65, 0);
  let theta = .22, phi = .86, distance = innerWidth < 650 ? 18 : 10.5;
  scene.add(new THREE.HemisphereLight(0xfff8ea, 0x8f826a, 2.5));
  const sun = new THREE.DirectionalLight(0xffebcb, 3);
  sun.position.set(-5, 12, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 17, bottom: -17, far: 50 });
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
  const terrainPeaks = createTerrainPeaks(1937, 34, 6.5);
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
  const terrainScales = [1, 1.15, 1.32, 1.52, 1.76, 2.05, 2.4, 2.82, 3.3, 3.85, 4.45, 5.1, 5.8, 6.5];
  const terrainBoundaries = terrainScales.map(scale => makeNoisyBoundary(WALKABLE_POINTS, scale, terrainPeaks, 7));
  const terrainCorrugation = corrugation.clone();
  terrainCorrugation.wrapS = terrainCorrugation.wrapT = THREE.RepeatWrapping;
  terrainCorrugation.repeat.set(1, 1);
  const terrainColors = [0x789456, 0x91a05b, 0xa2a063, 0xb1a36c, 0x9b8c66, 0x897858, 0x9f956f, 0xb2a878, 0x8b8369, 0x9d9477, 0xb4a983, 0x968e79, 0xb3aa91, 0x8b816e];
  const terrainLayers = terrainBoundaries.map((boundary, index) => ({
    outer: boundary, inner: index ? terrainBoundaries[index - 1] : null,
    depth: index === 0 ? .3 : .25 + index * .012,
    top: index * .28,
    topColor: terrainColors[index],
    sideColor: index % 2 ? 0x805b39 : 0x9c7243,
  }));
  const sceneStencil = { stencilWrite: true, stencilRef: 0, stencilFunc: THREE.AlwaysStencilFunc,
    stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp, stencilZPass: THREE.ReplaceStencilOp };
  for (const layer of terrainLayers) {
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
    const geometry = new THREE.ExtrudeGeometry(terrainShape(layer.outer, layer.inner), {
      depth: layer.depth, bevelEnabled: false, steps: 1, UVGenerator: terrainUvGenerator,
    });
    geometry.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, [
      new THREE.MeshStandardMaterial({ color: layer.topColor, map: layer.top === 0 ? paper : null, roughness: .96, ...sceneStencil }),
      new THREE.MeshStandardMaterial({ color: layer.sideColor, map: terrainCorrugation, roughness: 1, ...sceneStencil }),
    ]);
    mesh.position.y = layer.top - layer.depth;
    mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
  }
  async function createFigure(body, prefix) {
    const group = new THREE.Group();
    scene.add(group);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.8, .8, .2, 80), [
      new THREE.MeshStandardMaterial({ map: corrugation, roughness: 1, ...sceneStencil }),
      new THREE.MeshStandardMaterial({ map: paper, roughness: 1, ...sceneStencil }),
      new THREE.MeshStandardMaterial({ color: 0x97713e, ...sceneStencil }),
    ]);
    base.position.y = .115; base.castShadow = true; base.receiveShadow = true;
    group.add(base);
    const slot = new THREE.Mesh(new THREE.BoxGeometry(1.08, .012, .075), new THREE.MeshStandardMaterial({ color: 0x6c502f }));
    slot.position.y = .219; group.add(slot);

    const loader = new THREE.TextureLoader();
    const artStates = {};
    const sources = await Promise.all(VISUAL_STATES.map(visualState => loader.loadAsync(`assets/${prefix}-${visualState}.png?sheet=2`)));
    const backTextures = await Promise.all(VISUAL_STATES.map(visualState => loader.loadAsync(`assets/${prefix}-${visualState}-back.png?sheet=2`)));
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

    const healthHUD = new THREE.Group();
    const healthBack = new THREE.Mesh(new THREE.PlaneGeometry(1.5, .14),
      new THREE.MeshBasicMaterial({ color: 0x392719, side: THREE.DoubleSide }));
    const healthFill = new THREE.Mesh(new THREE.PlaneGeometry(1.42, .075),
      new THREE.MeshBasicMaterial({ color: body.team === 'player' ? 0x65d536 : 0xd84a38, side: THREE.DoubleSide }));
    healthFill.position.set(-.04, 0, .01);
    healthHUD.add(healthBack, healthFill);
    let chargePips = [];
    if (body.team === 'player') {
      chargePips = Array.from({ length: body.maxCharges }, (_, index) => {
        const pip = new THREE.Group();
        const base = new THREE.Mesh(new THREE.CircleGeometry(.09, 32),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .4, side: THREE.DoubleSide, depthWrite: false }));
        const fill = new THREE.Mesh(new THREE.CircleGeometry(.09, 32),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .9, side: THREE.DoubleSide, depthWrite: false }));
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
      healthHUD, healthFill, chargePips, enemyMarker,
      flashMaterial: initialArt.frontArt.flashMaterial, backFlashMaterial: initialArt.backArt.flashMaterial,
      viewBack: false, facing: 0, hitAge: 10, hitStrength: 0,
      hurtAge: 10, dealDamageAge: 10 };
    group.userData.figure = figure;
    group.position.set(body.x, 0, body.z);
    return figure;
  }
  const sceneryTemplates = new Map();
  function extractMainScenerySprite(image) {
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(image, 0, 0);
    const imageData = context.getImageData(0, 0, image.width, image.height);
    const pixels = imageData.data, width = image.width, height = image.height;
    const visited = new Uint8Array(width * height), stack = new Int32Array(width * height);
    let largest = null;
    for (let start = 0; start < width * height; start++) {
      if (visited[start] || pixels[start * 4 + 3] <= 80) continue;
      let top = 0, count = 0, x0 = width, y0 = height, x1 = -1, y1 = -1;
      stack[top++] = start; visited[start] = 1;
      while (top) {
        const index = stack[--top], x = index % width, y = (index / width) | 0;
        count++; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
        for (let ny = Math.max(0, y - 1); ny <= Math.min(height - 1, y + 1); ny++) {
          for (let nx = Math.max(0, x - 1); nx <= Math.min(width - 1, x + 1); nx++) {
            const next = ny * width + nx;
            if (!visited[next] && pixels[next * 4 + 3] > 80) { visited[next] = 1; stack[top++] = next; }
          }
        }
      }
      if (!largest || count > largest.count) largest = { count, x0, y0, x1, y1 };
    }
    if (!largest) throw new Error('Scenery sprite has no opaque artwork');
    const padding = 2;
    const cropX = Math.max(0, largest.x0 - padding), cropY = Math.max(0, largest.y0 - padding);
    const cropRight = Math.min(width - 1, largest.x1 + padding), cropBottom = Math.min(height - 1, largest.y1 + padding);
    const cropWidth = cropRight - cropX + 1, cropHeight = cropBottom - cropY + 1;
    const cut = document.createElement('canvas'); cut.width = cropWidth; cut.height = cropHeight;
    const cutContext = cut.getContext('2d', { willReadFrequently: true });
    cutContext.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    const cutData = cutContext.getImageData(0, 0, cropWidth, cropHeight);
    // Keep the dominant connected silhouette plus its antialiased edge; clear detached atlas fragments.
    for (let y = 0; y < cropHeight; y++) for (let x = 0; x < cropWidth; x++) {
      const sourceX = cropX + x, sourceY = cropY + y, sourceIndex = sourceY * width + sourceX;
      let connected = visited[sourceIndex] === 1;
      if (!connected) {
        for (let ny = Math.max(0, sourceY - padding); ny <= Math.min(height - 1, sourceY + padding) && !connected; ny++)
          for (let nx = Math.max(0, sourceX - padding); nx <= Math.min(width - 1, sourceX + padding); nx++)
            if (visited[ny * width + nx]) { connected = true; break; }
      }
      if (!connected) cutData.data[(y * cropWidth + x) * 4 + 3] = 0;
    }
    cutContext.putImageData(cutData, 0, 0);
    return { cut, alphaPixels: cutData.data, width: cropWidth, height: cropHeight };
  }
  function loadSceneryTemplate(path) {
    if (sceneryTemplates.has(path)) return sceneryTemplates.get(path);
    const pending = (async () => {
    const source = await new THREE.TextureLoader().loadAsync(`${path}?art=2`);
    const { cut, alphaPixels, width, height } = extractMainScenerySprite(source.image);
    const artTexture = new THREE.CanvasTexture(cut); artTexture.colorSpace = THREE.SRGBColorSpace;
    artTexture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    const art = buildExtrudedSprite(alphaPixels, width, height, artTexture, artTexture, corrugation);
    art.group.position.y = 1.025;
    source.dispose();
    return art.group;
    })();
    sceneryTemplates.set(path, pending);
    return pending;
  }
  async function createScenery(path, x, z, size) {
    const template = await loadSceneryTemplate(path);
    const art = template.clone(true);
    // Scale the artwork to its requested height while keeping a consistent cardboard edge thickness.
    art.scale.set(size / 2.05, size / 2.05, 1);
    const layerIndex = containingTerrainLayer(x, z, terrainBoundaries);
    if (layerIndex < 0) return;
    const elevation = layerIndex * .28;
    const prop = new THREE.Group(); prop.position.set(x, elevation, z); prop.add(art);
    const inward = nearestPointOnPath(x, z, WALKABLE_POINTS);
    prop.rotation.y = Math.atan2(inward.x - x, inward.z - z);
    scene.add(prop);
  }
  const figures = await Promise.all([
    createFigure(bodies[0], 'hero'),
    createFigure(bodies[1], 'goblin'),
    createFigure(bodies[2], 'goblin'),
    createFigure(bodies[3], 'goblin'),
  ]);
  const sceneryPaths = [
    createScenery('assets/env-tree.png', -13, -3.5, 3.8),
    createScenery('assets/env-bushes.png', -10.5, -9.3, 2.6),
    createScenery('assets/env-troll-hut.png', 0, -14, 3.9),
    createScenery('assets/env-moss-rocks.png', 12.2, -8.8, 2.8),
    createScenery('assets/env-fortress.png', 14, 1.4, 3.8),
    createScenery('assets/env-evergreen.png', 5.5, 13.2, 3.7),
  ];
  const growthRandom = (() => { let seed = 0x51a7c0de; return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); })();
  const propTypes = [
    { path: 'assets/env-tree.png', weight: .28, size: [2.1, 3.3] },
    { path: 'assets/env-evergreen.png', weight: .24, size: [1.9, 3.1] },
    { path: 'assets/env-moss-rocks.png', weight: .28, size: [1.1, 2.4] },
    { path: 'assets/env-bushes.png', weight: .2, size: [1.4, 2.6] },
  ];
  await Promise.all(propTypes.map(type => loadSceneryTemplate(type.path)));
  let addedProps = 0;
  for (let candidate = 0; candidate < 600 && addedProps < 72; candidate++) {
    const angle = growthRandom() * Math.PI * 2;
    const radius = 1.22 + Math.sqrt(growthRandom()) * 5.12;
    const density = gaussianGrowthField(radius, angle, terrainPeaks);
    if (density < .18 || growthRandom() > .18 + density * .62) continue;
    const typeRoll = growthRandom();
    const type = propTypes.find((item, index) => typeRoll < propTypes.slice(0, index + 1).reduce((sum, entry) => sum + entry.weight, 0)) || propTypes[0];
    const x = Math.cos(angle) * radius * 10.8, z = Math.sin(angle) * radius * 8.2;
    if (containingTerrainLayer(x, z, terrainBoundaries) < 0) continue;
    if (radius < 1.35 && WALKABLE_POINTS.some(point => Math.hypot(point.x - x, point.z - z) < 1.1)) continue;
    const distanceScale = radius > 3.5 ? .64 : radius > 2.3 ? .82 : 1;
    sceneryPaths.push(createScenery(type.path, x, z, randomBetween(...type.size) * distanceScale));
    addedProps++;
  }
  await Promise.all(sceneryPaths);
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
  function damage(target, speed, multiplier = 1) {
    if (target.hitCooldown > 0 || target.health <= 0) return false;
    target.health = Math.max(0, target.health - THREE.MathUtils.clamp(Math.round(speed * 2.3), 8, 24) * multiplier);
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
        if (attacker.health <= 0 || (attacker.team === target.team && attacker.team !== 'enemy') || (attacker.attackRicochets || 0) >= 3) return;
        if (!damage(target, speed, Math.pow(.5, attacker.attackRicochets || 0))) return;
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
    const fullExtension = 5.4 * AIM_MARKER_LENGTH_SCALE;
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
    for (const hit of raycaster.intersectObjects(figures.map(figure => figure.group), true)) {
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
    for (const figure of figures) {
      const dx = groundPoint.x - figure.body.x, dz = groundPoint.z - figure.body.z;
      const distanceSquared = dx * dx + dz * dz;
      if (distanceSquared < closestDistance) { closest = figure; closestDistance = distanceSquared; }
    }
    return closest;
  }
  function choose(figure) {
    if (!figure || figure.body.team !== 'player') return;
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
      if (hit) {
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
        distance = THREE.MathUtils.clamp(gesture.zoomStart * gesture.pinchStart / Math.max(1, pinch), 4.5, 18);
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
      playerMarker.setExtension(length > .02 ? length * 3.2 / AIM_DRAG_SENSITIVITY * AIM_MARKER_LENGTH_SCALE : 0);
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
      distance = THREE.MathUtils.clamp(distance * Math.exp(comfortableDelta * .0012), 4.5, 18);
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
    const held = gesture?.mode === 'aim' ? state : null;
    for (const body of bodies) {
      body.hitCooldown = Math.max(0, (body.hitCooldown || 0) - dt);
      advanceChargeRecharge(body, dt);
      if (body.team !== 'enemy') continue;
      if (body.health <= 0) continue;
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
    for (let remaining = dt; remaining > 0; remaining -= 1 / 120) advanceWorld(bodies, Math.min(remaining, 1 / 120), held, onImpact);
    for (const figure of figures) {
      const body = figure.body;
      figure.group.position.set(body.x, 0, body.z);
      const speed = Math.hypot(body.vx, body.vz);
      if (body.health > 0 && body !== held && !(body.team === 'enemy' && body.aiPhase === 'aim')) {
        figure.facing = facingAngle(body.vx, body.vz, figure.facing);
      }
      if (body.health > 0) figure.group.rotation.y = turnToward(figure.group.rotation.y, figure.facing, dt);
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
      if (visualState === 'dead') {
        const lyingScale = .72;
        figure.artGroup.scale.setScalar(lyingScale);
        figure.artGroup.position.y = .215 + .144 * lyingScale / 2 + .002;
        figure.artGroup.rotation.set(-Math.PI / 2, 0, 0);
      } else {
        figure.artGroup.scale.set(1 + squash * .7, 1 - squash, 1);
        figure.artGroup.position.y = 1.25 + Math.max(0, squash) * .2;
        figure.artGroup.rotation.set(0, 0, squash * .15 + Math.sin(elapsed * 19) * Math.min(speed / 20, 1) * .012);
      }
      figure.attacking = isAttacking(body) && body !== held;
      const healthRatio = Math.max(0, body.health / body.maxHealth);
      figure.healthFill.scale.x = healthRatio;
      figure.healthFill.position.x = -.04 - .71 * (1 - healthRatio);
      figure.healthFill.material.color.setHex(body.health <= 25 ? 0xf2a33b : body.team === 'player' ? 0x65d536 : 0xd84a38);
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
        const aiming = body.health > 0 && body.aiPhase === 'aim';
        figure.enemyMarker.group.position.set(body.x, GROUND_UI_Y, body.z);
        figure.enemyMarker.group.rotation.y = aiming ? body.aiAimAngle : figure.facing;
        figure.enemyMarker.group.visible = body.health > 0;
        figure.enemyMarker.setExtension(aiming ? 5.4 * AIM_MARKER_LENGTH_SCALE : 0);
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
    playerMarker.material.color.lerp(
      state.health > 0 && isAttacking(state) && state !== held ? attackColor : selectedColor,
      1 - Math.exp(-18 * dt));
    playerMarker.group.position.set(state.x, GROUND_UI_Y, state.z);
    updateCamera();
    for (const figure of figures) {
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

