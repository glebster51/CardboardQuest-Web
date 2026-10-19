import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { clampPull, launch, advanceWorld, facingAngle, turnToward, isAttacking, MAX_PULL } from './physics.mjs?v=6';

const host = document.querySelector('#scene');
const loading = document.querySelector('#loading');
const bodies = [
  { id: 'hero', team: 'player', x: 0, z: 0, vx: 0, vz: 0, health: 100, maxHealth: 100, charges: 3, maxCharges: 3, rechargeTimer: 0 },
  { id: 'goblin-1', team: 'enemy', x: -3.1, z: 2.8, vx: 0, vz: 0, health: 100, maxHealth: 100, charges: 3, maxCharges: 3, rechargeTimer: 0, aiTimer: .5 },
  { id: 'goblin-2', team: 'enemy', x: 3.1, z: 2.8, vx: 0, vz: 0, health: 100, maxHealth: 100, charges: 3, maxCharges: 3, rechargeTimer: 0, aiTimer: 1.1 },
  { id: 'goblin-3', team: 'enemy', x: 0, z: 5.7, vx: 0, vz: 0, health: 100, maxHealth: 100, charges: 3, maxCharges: 3, rechargeTimer: 0, aiTimer: 1.7 },
];
let state = bodies[0];
let selected = true;
const pointers = new Map();
let gesture = null;

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
  const wood = texture(1024, 1024, (c, w, h) => {
    c.fillStyle = '#cbb795'; c.fillRect(0, 0, w, h);
    let seed = 31;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 4200; i++) {
      const x = random() * w, y = random() * h;
      c.strokeStyle = `rgba(104,77,40,${random() * .075})`;
      c.lineWidth = random() + .3;
      c.beginPath(); c.moveTo(x, y);
      c.bezierCurveTo(x + 40, y - 1, x + 90, y + 1, x + random() * 300, y);
      c.stroke();
    }
    for (let y = 0; y < h; y += 256) {
      c.fillStyle = '#76573514'; c.fillRect(0, y, w, 2);
    }
  });
  wood.wrapS = wood.wrapT = THREE.RepeatWrapping;
  wood.repeat.set(3, 3);
  const tabletop = new THREE.Mesh(new THREE.BoxGeometry(24, .4, 20), [
    new THREE.MeshStandardMaterial({ color: 0x9a7850, roughness: .95 }),
    new THREE.MeshStandardMaterial({ color: 0x9a7850, roughness: .95 }),
    new THREE.MeshStandardMaterial({ map: wood, roughness: .94 }),
    new THREE.MeshStandardMaterial({ color: 0x9a7850 }),
    new THREE.MeshStandardMaterial({ color: 0x9a7850, roughness: .95 }),
    new THREE.MeshStandardMaterial({ color: 0x9a7850, roughness: .95 }),
  ]);
  tabletop.position.y = -.2;
  tabletop.receiveShadow = true;
  scene.add(tabletop);

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
  async function createFigure(body, frontPath, backPath) {
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
    const [tex, backTex] = await Promise.all([
      loader.loadAsync(frontPath),
      loader.loadAsync(backPath),
    ]);
    tex.colorSpace = THREE.SRGBColorSpace;
    const image = tex.image;
    const silhouette = document.createElement('canvas');
    silhouette.width = image.width; silhouette.height = image.height;
    const context = silhouette.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    let x0 = image.width, y0 = image.height, x1 = 0, y1 = 0;
    for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
      if (pixels[(y * image.width + x) * 4 + 3] > 100) {
        x0 = Math.min(x0, x); x1 = Math.max(x1, x);
        y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
    }
    const cut = document.createElement('canvas');
    cut.width = x1 - x0 + 1; cut.height = y1 - y0 + 1;
    const cutContext = cut.getContext('2d', { willReadFrequently: true });
    cutContext.drawImage(image, x0, y0, cut.width, cut.height, 0, 0, cut.width, cut.height);
    const alphaPixels = cutContext.getImageData(0, 0, cut.width, cut.height).data;
    const art = new THREE.CanvasTexture(cut); art.colorSpace = THREE.SRGBColorSpace;
    art.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    const backCut = document.createElement('canvas');
    backCut.width = cut.width; backCut.height = cut.height;
    const backContext = backCut.getContext('2d');
    // Both prints share the front's cutout and registration, even at different resolutions.
    backContext.fillStyle = '#fff4d8';
    backContext.fillRect(0, 0, cut.width, cut.height);
    const backScaleX = backTex.image.width / image.width;
    const backScaleY = backTex.image.height / image.height;
    backContext.drawImage(backTex.image, x0 * backScaleX, y0 * backScaleY,
      cut.width * backScaleX, cut.height * backScaleY, 0, 0, cut.width, cut.height);
    backContext.globalCompositeOperation = 'destination-in';
    backContext.drawImage(cut, 0, 0);
    const backArt = new THREE.CanvasTexture(backCut); backArt.colorSpace = THREE.SRGBColorSpace;
    backArt.anisotropy = art.anisotropy;
    tex.dispose(); backTex.dispose();
    const geometry = new THREE.PlaneGeometry(2.05 * cut.width / cut.height, 2.05);
    const edgeMaterial = new THREE.MeshStandardMaterial({ alphaMap: art, alphaTest: .5, color: 0x9d7746, roughness: 1, side: THREE.DoubleSide });
    // AlphaMap reads green rather than PNG alpha; use the same silhouette through map.
    edgeMaterial.alphaMap = null;
    edgeMaterial.map = art;
    edgeMaterial.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb = vec3(0.48, 0.31, 0.15);');
    };
    const printMaterial = new THREE.MeshStandardMaterial({ map: art, alphaTest: .5, roughness: 1, side: THREE.FrontSide });
    // Keep identical UVs: looking through the back of the card mirrors the print naturally.
    const backMaterial = new THREE.MeshStandardMaterial({ map: backArt, alphaTest: .5, roughness: 1, side: THREE.BackSide });
    const artGroup = new THREE.Group();
    artGroup.position.y = .225;
    group.add(artGroup);
    for (let i = 0; i < 9; i++) {
      const face = new THREE.Mesh(geometry, i === 8 ? printMaterial : i === 0 ? backMaterial : edgeMaterial);
      face.position.set(0, 1.025, (i - 4) * .006);
      face.castShadow = true;
      face.userData.print = true;
      artGroup.add(face);
    }

    const healthBack = new THREE.Mesh(new THREE.PlaneGeometry(1.5, .14),
      new THREE.MeshBasicMaterial({ color: 0x392719, side: THREE.DoubleSide }));
    const healthFill = new THREE.Mesh(new THREE.PlaneGeometry(1.42, .075),
      new THREE.MeshBasicMaterial({ color: body.team === 'player' ? 0x65d536 : 0xd84a38, side: THREE.DoubleSide }));
    healthBack.position.set(0, 2.65, .035); healthFill.position.set(-.04, 2.65, .045);
    group.add(healthBack, healthFill);
    const chargePips = Array.from({ length: body.maxCharges }, (_, index) => {
      const pip = new THREE.Mesh(new THREE.SphereGeometry(.065, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0xf5d476, emissive: 0x5b4014, roughness: .48 }));
      pip.position.set((index - (body.maxCharges - 1) / 2) * .25, .245, .53);
      group.add(pip);
      return pip;
    });
    let enemyRing = null;
    if (body.team === 'enemy') {
      enemyRing = new THREE.Mesh(new THREE.RingGeometry(.87, 1.13, 80),
        new THREE.MeshBasicMaterial({ color: 0xdf3830, transparent: true, opacity: .9, side: THREE.DoubleSide, depthWrite: false }));
      enemyRing.rotation.x = -Math.PI / 2; scene.add(enemyRing);
    }
    const figure = { group, artGroup, body, alphaPixels, width: cut.width, height: cut.height,
      healthFill, chargePips, enemyRing, markerAge: 10, facing: 0, hitAge: 10, hitStrength: 0 };
    group.userData.figure = figure;
    group.position.set(body.x, 0, body.z);
    return figure;
  }
  const figures = await Promise.all([
    createFigure(bodies[0], 'assets/hero-a.png', 'assets/hero-back.png'),
    createFigure(bodies[1], 'assets/goblin-front.png', 'assets/goblin-back.png'),
    createFigure(bodies[2], 'assets/goblin-front.png', 'assets/goblin-back.png'),
    createFigure(bodies[3], 'assets/goblin-front.png', 'assets/goblin-back.png'),
  ]);
  let activeFigure = figures[0];
  let selectionAge = 0;
  let elapsed = 0;
  const bursts = [];
  const burstGeometry = new THREE.RingGeometry(.15, .22, 40);
  const dustGeometry = new THREE.SphereGeometry(.045, 5, 4);
  const selectedColor = new THREE.Color(0x65d536);
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
  function damage(target, speed) {
    if (target.hitCooldown > 0 || target.health <= 0) return;
    target.health = Math.max(0, target.health - THREE.MathUtils.clamp(Math.round(speed * 2.3), 8, 24));
    target.hitCooldown = .65;
    const figure = figures.find(item => item.body === target);
    if (figure) {
      figure.hitAge = 0;
      figure.hitStrength = THREE.MathUtils.clamp(speed / 22, .15, .38);
    }
  }
  function onImpact(a, b, speed, attackingA = false, attackingB = false) {
    for (const figure of figures) {
      if (figure.body === a || figure.body === b) {
        figure.hitAge = 0;
        figure.hitStrength = THREE.MathUtils.clamp(speed / 28, .08, .3);
      }
    }
    if (b && a.team !== b.team) {
      if (attackingA) damage(b, speed);
      if (attackingB) damage(a, speed);
    }
    burst(b ? (a.x + b.x) / 2 : a.x, b ? (a.z + b.z) / 2 : a.z, Math.min(1.5, speed / 7));
  }
  const selectionRing = new THREE.Mesh(new THREE.RingGeometry(.87, 1.13, 80), new THREE.MeshBasicMaterial({ color: 0x65d536, transparent: true, opacity: .95, side: THREE.DoubleSide, depthWrite: false }));
  selectionRing.rotation.x = -Math.PI / 2; selectionRing.position.y = .012;
  selectionRing.visible = true; scene.add(selectionRing);
  const aiming = new THREE.Group(); aiming.visible = false; scene.add(aiming);
  const arrowShape = new THREE.Shape([
    new THREE.Vector2(-.5, 0), new THREE.Vector2(.5, 0),
    new THREE.Vector2(.5, .68), new THREE.Vector2(.8, .68),
    new THREE.Vector2(0, 1), new THREE.Vector2(-.8, .68), new THREE.Vector2(-.5, .68),
  ]);
  const arrow = new THREE.Mesh(new THREE.ShapeGeometry(arrowShape),
    new THREE.MeshBasicMaterial({ color: 0x607948, transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false }));
  arrow.rotation.x = Math.PI / 2;
  aiming.add(arrow);

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
      if (!hit.object.userData.print || !hit.uv) return figure;
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
      gesture = { mode: 'touchOrbit',
        lastX: (points[0].x + points[1].x) / 2, lastY: (points[0].y + points[1].y) / 2 };
      return;
    }
    if (event.button === 2 || event.altKey) {
      gesture = { mode: 'orbit', pointer: event.pointerId, startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastY: event.clientY, moved: false };
    } else {
      const hit = hitFigure(event.clientX, event.clientY);
      if (hit) choose(hit);
      state.vx = 0; state.vz = 0;
      gesture = { mode: 'aim', pointer: event.pointerId, pull: { x: 0, z: 0 },
        hit, startX: event.clientX, startY: event.clientY, moved: false };
      host.classList.add('aiming');
    }
  });
  host.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId) || !gesture) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (gesture.mode === 'touchOrbit') {
      if (pointers.size >= 2) {
        const points = [...pointers.values()];
        const x = (points[0].x + points[1].x) / 2, y = (points[0].y + points[1].y) / 2;
        theta -= (x - gesture.lastX) * .007;
        phi = THREE.MathUtils.clamp(phi - (y - gesture.lastY) * .005, .35, 1.3);
        gesture.lastX = x; gesture.lastY = y;
      }
      return;
    }
    if (event.pointerId !== gesture.pointer) return;
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
        aiming.position.set(state.x, .025, state.z);
        aiming.rotation.y = activeFigure.facing;
        arrow.scale.y = .8 + 3.6 * length / MAX_PULL;
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
        }
        if (body.charges === body.maxCharges) body.rechargeTimer = 0;
      }
      if (body.team !== 'enemy') continue;
      body.aiTimer -= dt;
      const dx = state.x - body.x, dz = state.z - body.z;
      const distanceToPlayer = Math.hypot(dx, dz);
      if (state.health > 0 && distanceToPlayer > .001 && Math.hypot(body.vx, body.vz) < .05) {
        const figure = figures.find(item => item.body === body);
        figure.facing = facingAngle(dx, dz, figure.facing);
      }
      if (state.health > 0 && body.health > 0 && body.charges > 0 && body.aiTimer <= 0 && Math.hypot(body.vx, body.vz) < 1.2) {
        const power = THREE.MathUtils.clamp(distanceToPlayer * .12, .55, .95);
        body.charges--; body.rechargeTimer = 0; body.aiTimer = 1.1;
        launch(body, { x: -dx / Math.max(.001, distanceToPlayer) * power,
          z: -dz / Math.max(.001, distanceToPlayer) * power });
        burst(body.x, body.z, .35);
      }
      if (body.health <= 0) body.vx = body.vz = 0;
    }
    if (state.health <= 0) state.vx = state.vz = 0;
    for (let remaining = dt; remaining > 0; remaining -= 1 / 120) advanceWorld(bodies, Math.min(remaining, 1 / 120), held, onImpact);
    for (const figure of figures) {
      const body = figure.body;
      figure.group.position.set(body.x, 0, body.z);
      const speed = Math.hypot(body.vx, body.vz);
      if (body !== held) figure.facing = facingAngle(body.vx, body.vz, figure.facing);
      figure.group.rotation.y = turnToward(figure.group.rotation.y, figure.facing, dt);
      figure.hitAge += dt;
      const spring = Math.exp(-figure.hitAge * 9) * Math.sin(figure.hitAge * 28);
      const squash = figure.hitStrength * spring;
      figure.artGroup.scale.set(1 + squash * .7, 1 - squash, 1);
      figure.artGroup.position.y = .225 + Math.max(0, squash) * .2;
      figure.artGroup.rotation.z = squash * .15 + Math.sin(elapsed * 19) * Math.min(speed / 20, 1) * .012;
      figure.attacking = isAttacking(body) && body !== held;
      const healthRatio = Math.max(0, body.health / body.maxHealth);
      figure.healthFill.scale.x = healthRatio;
      figure.healthFill.position.x = -.04 - .71 * (1 - healthRatio);
      figure.healthFill.material.color.setHex(body.health <= 25 ? 0xf2a33b : body.team === 'player' ? 0x65d536 : 0xd84a38);
      figure.chargePips.forEach((pip, index) => {
        pip.visible = index < body.charges;
        pip.material.emissive.setHex(index < body.charges ? 0x5b4014 : 0x000000);
      });
      if (figure.enemyRing) {
        figure.markerAge += dt;
        const t = Math.min(1, figure.markerAge / .55);
        const bounce = t === 1 ? 1 : 1 + Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * 2 * Math.PI / 3);
        figure.enemyRing.position.set(body.x, .013, body.z);
        figure.enemyRing.scale.setScalar(Math.max(.001, bounce) * (body.health > 0 ? 1 : .88));
        figure.enemyRing.material.opacity = body.health > 0 ? .9 : .35;
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
    selectionRing.position.set(state.x, .012, state.z);
    updateCamera(); renderer.render(scene, camera);
  });
}

start().catch(error => {
  loading.hidden = true;
  document.querySelector('#error').hidden = false;
  document.querySelector('#error').textContent = 'Не удалось загрузить сцену. Обнови страницу.';
  console.error(error);
});
