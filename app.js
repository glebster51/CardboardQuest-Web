import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { clampPull, launch, advanceWorld, facingAngle, turnToward, isAttacking, MAX_PULL, ARENA_POINTS } from './physics.mjs?v=11';

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
const randomBetween = (min, max) => min + Math.random() * (max - min);
const VISUAL_STATES = ['idle', 'aiming', 'attack', 'deal-damage', 'on-hit', 'dead'];

function silhouetteShapes(alphaPixels, width, height, worldWidth, worldHeight) {
  const scale = Math.min(1, 128 / Math.max(width, height));
  const gridWidth = Math.max(2, Math.round(width * scale));
  const gridHeight = Math.max(2, Math.round(height * scale));
  const mask = new Uint8Array(gridWidth * gridHeight);
  for (let y = 0; y < gridHeight; y++) for (let x = 0; x < gridWidth; x++) {
    const sx = Math.min(width - 1, Math.floor((x + .5) * width / gridWidth));
    const sy = Math.min(height - 1, Math.floor((y + .5) * height / gridHeight));
    mask[y * gridWidth + x] = alphaPixels[(sy * width + sx) * 4 + 3] > 80 ? 1 : 0;
  }
  const edges = [];
  const addEdge = (ax, ay, bx, by) => edges.push({ ax, ay, bx, by, used: false });
  const filled = (x, y) => x >= 0 && y >= 0 && x < gridWidth && y < gridHeight && mask[y * gridWidth + x] === 1;
  for (let y = 0; y < gridHeight; y++) for (let x = 0; x < gridWidth; x++) if (filled(x, y)) {
    if (!filled(x, y - 1)) addEdge(x, y, x + 1, y);
    if (!filled(x + 1, y)) addEdge(x + 1, y, x + 1, y + 1);
    if (!filled(x, y + 1)) addEdge(x + 1, y + 1, x, y + 1);
    if (!filled(x - 1, y)) addEdge(x, y + 1, x, y);
  }
  const starts = new Map();
  edges.forEach((edge, index) => {
    const key = `${edge.ax},${edge.ay}`;
    if (!starts.has(key)) starts.set(key, []);
    starts.get(key).push(index);
  });
  const loops = [];
  for (let start = 0; start < edges.length; start++) {
    if (edges[start].used) continue;
    const points = [];
    let index = start;
    for (let guard = 0; guard <= edges.length; guard++) {
      const edge = edges[index];
      if (edge.used) break;
      edge.used = true;
      points.push(new THREE.Vector2((edge.ax / gridWidth - .5) * worldWidth,
        (.5 - edge.ay / gridHeight) * worldHeight));
      const key = `${edge.bx},${edge.by}`;
      if (key === `${edges[start].ax},${edges[start].ay}`) break;
      const candidates = (starts.get(key) || []).filter(candidate => !edges[candidate].used);
      if (!candidates.length) break;
      const incomingX = edge.bx - edge.ax, incomingY = edge.by - edge.ay;
      candidates.sort((a, b) => {
        const rank = candidate => {
          const next = edges[candidate];
          const cross = incomingX * (next.by - next.ay) - incomingY * (next.bx - next.ax);
          const dot = incomingX * (next.bx - next.ax) + incomingY * (next.by - next.ay);
          const angle = (Math.atan2(cross, dot) + Math.PI * 2) % (Math.PI * 2);
          return angle < .01 ? 1 : angle < Math.PI ? 0 : 2;
        };
        return rank(a) - rank(b);
      });
      index = candidates[0];
    }
    if (points.length >= 3) loops.push(points);
  }
  const area = points => points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0) / 2;
  const contains = (point, polygon) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i], b = polygon[j];
      if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  };
  const entries = loops.map(points => ({ points, area: Math.abs(area(points)), parent: null, depth: 0 }))
    .sort((a, b) => b.area - a.area);
  for (let i = 0; i < entries.length; i++) {
    for (let j = 0; j < i; j++) if (contains(entries[i].points[0], entries[j].points)) {
      entries[i].parent = entries[j]; entries[i].depth = entries[j].depth + 1; break;
    }
  }
  const pathFrom = (points, clockwise) => {
    const ordered = THREE.ShapeUtils.isClockWise(points) === clockwise ? points : [...points].reverse();
    const path = new THREE.Path();
    path.moveTo(ordered[0].x, ordered[0].y);
    for (let i = 1; i < ordered.length; i++) path.lineTo(ordered[i].x, ordered[i].y);
    path.closePath();
    return path;
  };
  const shapes = [];
  for (const entry of entries) if (entry.depth % 2 === 0) {
    const shape = new THREE.Shape();
    const outer = pathFrom(entry.points, false);
    shape.moveTo(outer.curves[0].v1.x, outer.curves[0].v1.y);
    for (const curve of outer.curves) shape.lineTo(curve.v2.x, curve.v2.y);
    shape.closePath();
    for (const hole of entries) if (hole.parent === entry && hole.depth % 2 === 1) shape.holes.push(pathFrom(hole.points, true));
    shapes.push(shape);
  }
  return shapes;
}

function makeExtrudedSprite(alphaPixels, width, height, front, back, corrugation) {
  const worldWidth = 2.05 * width / height;
  const worldHeight = 2.05;
  const depth = .144;
  const shapes = silhouetteShapes(alphaPixels, width, height, worldWidth, worldHeight);
  const uv = (vertices, index) => {
    const x = vertices[index * 3], y = vertices[index * 3 + 1];
    return new THREE.Vector2(x / worldWidth + .5, y / worldHeight + .5);
  };
  const uvGenerator = {
    generateTopUV(_geometry, vertices, a, b, c) { return [uv(vertices, a), uv(vertices, b), uv(vertices, c)]; },
    generateSideWallUV(_geometry, vertices, a, b, c, d) {
      const horizontal = Math.abs(vertices[b * 3] - vertices[a * 3]) >= Math.abs(vertices[b * 3 + 1] - vertices[a * 3 + 1]);
      return [a, b, c, d].map(index => new THREE.Vector2(
        horizontal ? vertices[index * 3] / worldWidth + .5 : vertices[index * 3 + 1] / worldHeight + .5,
        vertices[index * 3 + 2] / depth));
    },
  };
  const geometry = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: false, steps: 1, UVGenerator: uvGenerator });
  geometry.translate(0, 0, -depth / 2);
  const frontMaterial = new THREE.MeshStandardMaterial({ map: front, alphaTest: .5, roughness: 1, side: THREE.FrontSide });
  const sideMaterial = new THREE.MeshStandardMaterial({ map: corrugation, color: 0xc39658, roughness: 1, side: THREE.FrontSide });
  const body = new THREE.Mesh(geometry, [frontMaterial, sideMaterial]);
  body.castShadow = true;
  body.userData.print = true;
  const backPlane = new THREE.Mesh(new THREE.PlaneGeometry(worldWidth, worldHeight),
    new THREE.MeshStandardMaterial({ map: back, alphaTest: .5, roughness: 1, side: THREE.BackSide }));
  backPlane.position.z = -depth / 2 - .002;
  backPlane.userData.print = true;
  const flashGeometry = new THREE.PlaneGeometry(worldWidth, worldHeight);
  const whiteMask = document.createElement('canvas');
  whiteMask.width = width; whiteMask.height = height;
  const whiteContext = whiteMask.getContext('2d');
  whiteContext.fillStyle = '#fff'; whiteContext.fillRect(0, 0, width, height);
  const alphaCanvas = document.createElement('canvas'); alphaCanvas.width = width; alphaCanvas.height = height;
  const imageData = alphaCanvas.getContext('2d').createImageData(width, height);
  for (let i = 0; i < width * height; i++) imageData.data[i * 4 + 3] = alphaPixels[i * 4 + 3];
  alphaCanvas.getContext('2d').putImageData(imageData, 0, 0);
  whiteContext.globalCompositeOperation = 'destination-in'; whiteContext.drawImage(alphaCanvas, 0, 0);
  const flashTexture = new THREE.CanvasTexture(whiteMask);
  const flashMaterial = new THREE.MeshBasicMaterial({ map: flashTexture, transparent: true, opacity: 0, alphaTest: .1,
    side: THREE.DoubleSide, depthWrite: false });
  const frontFlash = new THREE.Mesh(flashGeometry, flashMaterial);
  const backFlash = new THREE.Mesh(flashGeometry, flashMaterial);
  frontFlash.position.z = depth / 2 + .004; backFlash.position.z = -depth / 2 - .004;
  frontFlash.userData.print = backFlash.userData.print = true;
  const group = new THREE.Group();
  group.add(body, backPlane, frontFlash, backFlash);
  return { group, body, geometry, frontMaterial, sideMaterial, backPlane, flashMaterial, flashTexture, alphaPixels, width, height };
}

document.querySelector('#restart').addEventListener('click', () => location.reload());

async function start() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0xc7b391);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xc7b391, 24, 55);
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 80);
  const target = new THREE.Vector3(0, .65, 0);
  let theta = .22, phi = .86, distance = innerWidth < 650 ? 18 : 10.5;
  const environmentSprites = [];
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
  function terrainShape(scale = 1) {
    const shape = new THREE.Shape();
    shape.moveTo(ARENA_POINTS[0].x * scale, -ARENA_POINTS[0].z * scale);
    for (let i = 1; i < ARENA_POINTS.length; i++) shape.lineTo(ARENA_POINTS[i].x * scale, -ARENA_POINTS[i].z * scale);
    shape.closePath();
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
  const terrainLayers = [
    { scale: 1.2, depth: .46, top: -.88, topColor: 0x755535, sideColor: 0x65472c },
    { scale: 1.12, depth: .34, top: -.54, topColor: 0x987044, sideColor: 0x78542f },
    { scale: 1.055, depth: .26, top: -.28, topColor: 0xb28b56, sideColor: 0x8e6338 },
    { scale: 1, depth: .28, top: 0, topColor: 0x789456, sideColor: 0x9c7243 },
  ];
  for (const layer of terrainLayers) {
    const geometry = new THREE.ExtrudeGeometry(terrainShape(layer.scale), { depth: layer.depth, bevelEnabled: false, steps: 1 });
    geometry.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, [
      new THREE.MeshStandardMaterial({ color: layer.topColor, map: layer.top === 0 ? paper : null, roughness: .96 }),
      new THREE.MeshStandardMaterial({ color: layer.sideColor, map: corrugation, roughness: 1 }),
    ]);
    mesh.position.y = layer.top - layer.depth;
    mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
  }
  async function createFigure(body, prefix, backPath) {
    const group = new THREE.Group();
    scene.add(group);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.8, .8, .2, 80), [
      new THREE.MeshStandardMaterial({ map: corrugation, roughness: 1 }),
      new THREE.MeshStandardMaterial({ map: paper, roughness: 1 }),
      new THREE.MeshStandardMaterial({ color: 0x97713e }),
    ]);
    base.position.y = .115; base.castShadow = true; base.receiveShadow = true;
    group.add(base);
    const slot = new THREE.Mesh(new THREE.BoxGeometry(1.08, .012, .075), new THREE.MeshStandardMaterial({ color: 0x6c502f }));
    slot.position.y = .219; group.add(slot);

    const loader = new THREE.TextureLoader();
    const backTexture = await loader.loadAsync(backPath);
    const artStates = {};
    for (const visualState of VISUAL_STATES) {
      const source = await loader.loadAsync(`assets/${prefix}-${visualState}.png`);
      const image = source.image;
      const sourceCanvas = document.createElement('canvas');
      sourceCanvas.width = image.width; sourceCanvas.height = image.height;
      const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });
      sourceContext.drawImage(image, 0, 0);
      const sourcePixels = sourceContext.getImageData(0, 0, image.width, image.height).data;
      let x0 = image.width, y0 = image.height, x1 = -1, y1 = -1;
      for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
        if (sourcePixels[(y * image.width + x) * 4 + 3] > 80) {
          x0 = Math.min(x0, x); x1 = Math.max(x1, x);
          y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        }
      }
      if (x1 < x0 || y1 < y0) throw new Error(`Empty sprite: ${prefix}-${visualState}`);
      const cut = document.createElement('canvas');
      cut.width = x1 - x0 + 1; cut.height = y1 - y0 + 1;
      const cutContext = cut.getContext('2d', { willReadFrequently: true });
      cutContext.drawImage(image, x0, y0, cut.width, cut.height, 0, 0, cut.width, cut.height);
      const alphaPixels = cutContext.getImageData(0, 0, cut.width, cut.height).data;
      const front = new THREE.CanvasTexture(cut); front.colorSpace = THREE.SRGBColorSpace;
      front.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      const backCanvas = document.createElement('canvas'); backCanvas.width = cut.width; backCanvas.height = cut.height;
      const backContext = backCanvas.getContext('2d');
      backContext.fillStyle = '#fff4d8'; backContext.fillRect(0, 0, cut.width, cut.height);
      backContext.drawImage(backTexture.image, 0, 0, cut.width, cut.height);
      backContext.globalCompositeOperation = 'destination-in'; backContext.drawImage(cut, 0, 0);
      const back = new THREE.CanvasTexture(backCanvas); back.colorSpace = THREE.SRGBColorSpace;
      back.anisotropy = front.anisotropy;
      const art = makeExtrudedSprite(alphaPixels, cut.width, cut.height, front, back, corrugation);
      art.group.position.y = 1.25;
      art.group.visible = visualState === 'idle';
      group.add(art.group);
      artStates[visualState] = art;
      source.dispose();
    }
    backTexture.dispose();
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
    let enemyRing = null;
    let attackIndicator = null;
    let attackProgress = null;
    if (body.team === 'enemy') {
      enemyRing = new THREE.Mesh(new THREE.RingGeometry(.87, 1.13, 80),
        new THREE.MeshBasicMaterial({ color: 0xdf3830, transparent: true, opacity: .9, side: THREE.DoubleSide, depthWrite: false, depthTest: false }));
      enemyRing.rotation.x = -Math.PI / 2; enemyRing.renderOrder = 1; scene.add(enemyRing);
      attackIndicator = new THREE.Group();
      const warning = createArrowSkin(0xd82932, 0xff5b50, true);
      warning.group.scale.set(1.6, 12, 1);
      attackIndicator.add(warning.group);
      attackProgress = warning.progress;
      attackIndicator.visible = false; scene.add(attackIndicator);
    }
    const figure = { group, artGroup: initialArt.group, artStates, visualState: 'idle', body,
      alphaPixels: initialArt.alphaPixels, width: initialArt.width, height: initialArt.height,
      healthHUD, healthFill, chargePips, enemyRing, attackIndicator, attackProgress,
      flashMaterial: initialArt.flashMaterial, markerAge: 10, facing: 0, hitAge: 10, hitStrength: 0,
      hurtAge: 10, dealDamageAge: 10 };
    group.userData.figure = figure;
    group.position.set(body.x, 0, body.z);
    return figure;
  }
  async function createScenery(path, x, z, size) {
    const source = await new THREE.TextureLoader().loadAsync(path);
    const image = source.image;
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    let x0 = image.width, y0 = image.height, x1 = -1, y1 = -1;
    for (let py = 0; py < image.height; py++) for (let px = 0; px < image.width; px++) {
      if (pixels[(py * image.width + px) * 4 + 3] > 80) {
        x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
      }
    }
    const cut = document.createElement('canvas'); cut.width = x1 - x0 + 1; cut.height = y1 - y0 + 1;
    const cutContext = cut.getContext('2d', { willReadFrequently: true });
    cutContext.drawImage(image, x0, y0, cut.width, cut.height, 0, 0, cut.width, cut.height);
    const alphaPixels = cutContext.getImageData(0, 0, cut.width, cut.height).data;
    const artTexture = new THREE.CanvasTexture(cut); artTexture.colorSpace = THREE.SRGBColorSpace;
    artTexture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    const art = makeExtrudedSprite(alphaPixels, cut.width, cut.height, artTexture, artTexture, corrugation);
    art.group.position.y = 1.025; art.group.scale.setScalar(size / 2.05);
    const radius = Math.hypot(x / 10.8, z / 8.55);
    const elevation = radius <= 1 ? 0 : radius <= 1.055 ? -.28 : radius <= 1.12 ? -.54 : radius <= 1.2 ? -.88 : -1.34;
    const prop = new THREE.Group(); prop.position.set(x, elevation, z); prop.add(art.group);
    prop.userData.billboard = true; scene.add(prop); environmentSprites.push(prop);
    source.dispose();
  }
  const figures = await Promise.all([
    createFigure(bodies[0], 'hero', 'assets/hero-back.png'),
    createFigure(bodies[1], 'goblin', 'assets/goblin-back.png'),
    createFigure(bodies[2], 'goblin', 'assets/goblin-back.png'),
    createFigure(bodies[3], 'goblin', 'assets/goblin-back.png'),
  ]);
  await Promise.all([
    createScenery('assets/env-tree.png', -10.5, -4.2, 3.8),
    createScenery('assets/env-bushes.png', -8, -7.5, 2.6),
    createScenery('assets/env-troll-hut.png', 0, -9.75, 3.9),
    createScenery('assets/env-moss-rocks.png', 8.3, -6.8, 2.8),
    createScenery('assets/env-fortress.png', 11.9, .3, 3.8),
    createScenery('assets/env-evergreen.png', 6.2, 8.4, 3.7),
  ]);
  function setVisualState(figure, visualState) {
    if (figure.visualState === visualState) return;
    figure.artGroup.visible = false;
    const art = figure.artStates[visualState];
    art.group.visible = true;
    figure.artGroup = art.group;
    figure.alphaPixels = art.alphaPixels;
    figure.width = art.width;
    figure.height = art.height;
    figure.flashMaterial = art.flashMaterial;
    figure.visualState = visualState;
  }
  let activeFigure = figures[0];
  let selectionAge = 0;
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
  const selectionRing = new THREE.Mesh(new THREE.RingGeometry(.87, 1.13, 80), new THREE.MeshBasicMaterial({ color: 0x65d536, transparent: true, opacity: .95, side: THREE.DoubleSide, depthWrite: false }));
  selectionRing.rotation.x = -Math.PI / 2; selectionRing.position.y = GROUND_UI_Y;
  selectionRing.material.depthTest = false; selectionRing.renderOrder = 1;
  selectionRing.visible = true; scene.add(selectionRing);
  const aiming = new THREE.Group(); aiming.visible = false; scene.add(aiming);
  const playerArrow = createArrowSkin(0x65d536, 0xd8ff91, false);
  playerArrow.group.scale.x = 1.6;
  aiming.add(playerArrow.group);
  const arrow = playerArrow.arrow;
  function createArrowSkin(color, glowColor, showProgress) {
    const shape = new THREE.Shape([
      new THREE.Vector2(-.5, 0), new THREE.Vector2(.5, 0), new THREE.Vector2(.5, .76),
      new THREE.Vector2(0, 1.25), new THREE.Vector2(-.5, .76),
    ]);
    const geometry = new THREE.ShapeGeometry(shape);
    const group = new THREE.Group();
    const glow = new THREE.Mesh(geometry,
      new THREE.MeshBasicMaterial({ color: glowColor, transparent: true, opacity: showProgress ? .18 : .42, side: THREE.DoubleSide, depthWrite: false, depthTest: false }));
    glow.rotation.x = Math.PI / 2; glow.scale.set(1.14, 1, 1); glow.renderOrder = 2; group.add(glow);
    const arrow = new THREE.Mesh(geometry,
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: showProgress ? .4 : .96, side: THREE.DoubleSide, depthWrite: false, depthTest: false }));
    arrow.rotation.x = Math.PI / 2; arrow.renderOrder = 3; group.add(arrow);
    const outline = new THREE.LineSegments(new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({ color: 0xfff4d4, transparent: true, opacity: showProgress ? .4 : .96, depthTest: false }));
    outline.rotation.x = Math.PI / 2; outline.renderOrder = 4; group.add(outline);
    let progress = null;
    if (showProgress) {
      progress = new THREE.Mesh(geometry,
        new THREE.MeshBasicMaterial({ color: 0xff5148, transparent: true, opacity: 1, side: THREE.DoubleSide, depthTest: false, depthWrite: false }));
      progress.rotation.x = Math.PI / 2; progress.scale.y = .001; progress.visible = false; progress.renderOrder = 5;
      group.add(progress);
    }
    return { group, arrow, progress };
  }

  const raycaster = new THREE.Raycaster();
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
      if (!hit.object.userData.print || !hit.uv || hit.face?.materialIndex === 1) return figure;
      const px = Math.min(figure.width - 1, Math.max(0, Math.floor(hit.uv.x * figure.width)));
      const py = Math.min(figure.height - 1, Math.max(0, Math.floor((1 - hit.uv.y) * figure.height)));
      if (figure.alphaPixels[(py * figure.width + px) * 4 + 3] > 100) return figure;
    }
    return null;
  }
  function choose(figure) {
    if (!figure) return;
    if (figure.body.team === 'enemy') {
      figure.markerAge = 0;
      return;
    }
    if (figure !== activeFigure) {
      activeFigure = figure; state = figure.body;
      selectionAge = 0;
      selectionRing.scale.setScalar(.001);
    }
    selected = true;
    selectionRing.visible = true;
  }
  function stopAim() {
    aiming.visible = false;
    host.classList.remove('aiming');
  }
  host.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button !== 0 && event.button !== 2) return;
    host.setPointerCapture(event.pointerId);
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
      if (hit) choose(hit);
      if (hit) {
        if (state.charges > 0 && state.health > 0) {
          state.vx = 0; state.vz = 0;
          gesture = { mode: 'aim', pointer: event.pointerId, pull: { x: 0, z: 0 },
            hit, startX: event.clientX, startY: event.clientY, moved: false };
          host.classList.add('aiming');
        } else {
          gesture = { mode: 'blocked', pointer: event.pointerId };
        }
      } else {
        gesture = { mode: 'orbit', pointer: event.pointerId, startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastY: event.clientY, moved: false };
      }
    }
  });
  host.addEventListener('pointermove', event => {
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
      choose(activeFigure);
      // Use drag displacement, independent of where on the screen it started.
      const scale = 2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / innerHeight;
      const dx = (event.clientX - gesture.startX) * scale;
      const dz = (event.clientY - gesture.startY) * scale / Math.cos(phi);
      gesture.pull = clampPull(Math.cos(theta) * dx + Math.sin(theta) * dz,
        -Math.sin(theta) * dx + Math.cos(theta) * dz);
      const direction = new THREE.Vector3(-gesture.pull.x, 0, -gesture.pull.z);
      const length = direction.length();
      aiming.visible = length > .06;
      if (length > .06) {
        activeFigure.facing = facingAngle(direction.x, direction.z, activeFigure.facing);
        aiming.position.set(state.x, GROUND_UI_Y, state.z);
        aiming.rotation.y = activeFigure.facing;
        playerArrow.group.scale.y = 88 * length / MAX_PULL;
        if (state.charges > 0 && state.health > 0) arrow.material.color.setHSL(.25 - .18 * length / MAX_PULL, .42, .36);
        else arrow.material.color.setHex(0x77736b);
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
            state.charges--; state.rechargeTimer = 0;
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
  host.addEventListener('pointerup', event => release(event, false));
  host.addEventListener('pointercancel', event => release(event, true));
  host.addEventListener('lostpointercapture', event => release(event, true));
  host.addEventListener('contextmenu', event => event.preventDefault());
  host.addEventListener('wheel', event => {
    event.preventDefault();
  }, { passive: false });
  addEventListener('blur', () => { stopAim(); gesture = null; pointers.clear(); });

  function updateCamera() {
    camera.position.set(target.x + distance * Math.sin(phi) * Math.sin(theta), target.y + distance * Math.cos(phi), target.z + distance * Math.sin(phi) * Math.cos(theta));
    camera.lookAt(target);
    for (const sprite of environmentSprites) {
      sprite.rotation.y = Math.atan2(camera.position.x - sprite.position.x, camera.position.z - sprite.position.z);
    }
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
      if (body.charges < body.maxCharges) {
        body.rechargeTimer += dt;
        while (body.rechargeTimer >= 3 && body.charges < body.maxCharges) {
          body.rechargeTimer -= 3;
          body.charges++;
          body.chargePop ??= Array(body.maxCharges).fill(0);
          body.chargePop[body.charges - 1] = .48;
        }
        if (body.charges === body.maxCharges) body.rechargeTimer = 0;
      }
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
        body.charges--; body.rechargeTimer = 0; body.aiPhase = 'dash'; body.attackRicochets = 0;
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
      figure.hitAge += dt;
      figure.hurtAge += dt;
      figure.dealDamageAge += dt;
      const visualState = body.health <= 0 ? 'dead'
        : figure.hurtAge < .55 ? 'on-hit'
          : figure.dealDamageAge < .32 ? 'deal-damage'
            : body === held || (body.team === 'enemy' && body.aiPhase === 'aim') ? 'aiming'
              : isAttacking(body) && body !== held ? 'attack' : 'idle';
      setVisualState(figure, visualState);
      figure.flashMaterial.opacity = figure.hurtAge < .42 && Math.floor(figure.hurtAge / .055) % 2 === 0 ? 1 : 0;
      const spring = Math.exp(-figure.hitAge * 9) * Math.sin(figure.hitAge * 28);
      const squash = figure.hitStrength * spring;
      figure.artGroup.scale.set(1 + squash * .7, 1 - squash, 1);
      figure.artGroup.position.y = 1.25 + Math.max(0, squash) * .2;
      figure.artGroup.rotation.z = squash * .15 + Math.sin(elapsed * 19) * Math.min(speed / 20, 1) * .012;
      figure.attacking = isAttacking(body) && body !== held;
      const healthRatio = Math.max(0, body.health / body.maxHealth);
      figure.healthFill.scale.x = healthRatio;
      figure.healthFill.position.x = -.04 - .71 * (1 - healthRatio);
      figure.healthFill.material.color.setHex(body.health <= 25 ? 0xf2a33b : body.team === 'player' ? 0x65d536 : 0xd84a38);
      const rechargeProgress = body.charges < body.maxCharges ? body.rechargeTimer / 3 : 0;
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
      if (figure.enemyRing) {
        figure.markerAge += dt;
        const t = Math.min(1, figure.markerAge / .55);
        const bounce = t === 1 ? 1 : 1 + Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * 2 * Math.PI / 3);
        figure.enemyRing.position.set(body.x, GROUND_UI_Y, body.z);
        figure.enemyRing.scale.setScalar(Math.max(.001, bounce) * (body.health > 0 ? 1 : .88));
        figure.enemyRing.material.opacity = body.health > 0 ? .9 : .35;
        figure.enemyRing.material.color.lerp(body.health > 0 && isAttacking(body) ? attackColor : enemyColor, 1 - Math.exp(-18 * dt));
        const aimingAtPlayer = body.health > 0 && body.aiPhase === 'aim';
        figure.attackIndicator.visible = aimingAtPlayer;
        if (aimingAtPlayer) {
          figure.attackIndicator.position.set(body.x, GROUND_UI_Y, body.z);
          figure.attackIndicator.rotation.y = body.aiAimAngle;
          const progress = 1 - body.aiTimer / body.aiAimDuration;
          figure.attackProgress.scale.y = Math.max(.001, progress);
          figure.attackProgress.position.y = 0;
          figure.attackProgress.visible = progress > .005;
        }
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
      selectionRing.scale.setScalar(Math.max(.001, scale));
    }
    selectionRing.material.color.lerp(
      state.health > 0 && isAttacking(state) && state !== held ? attackColor : selectedColor,
      1 - Math.exp(-18 * dt));
    selectionRing.position.set(state.x, GROUND_UI_Y, state.z);
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
  document.querySelector('#error').textContent = 'Не удалось загрузить сцену. Обнови страницу.';
  console.error(error);
});
