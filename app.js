import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { clampPull, launch, advance, facingAngle, MAX_PULL } from './physics.mjs?v=3';

const host = document.querySelector('#scene');
const loading = document.querySelector('#loading');
const state = { x: 0, z: 0, vx: 0, vz: 0 };
let selected = false;
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
  let theta = .22, phi = .86, distance = innerWidth < 650 ? 10.5 : 9;
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
  const hero = new THREE.Group();
  scene.add(hero);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(.8, .8, .2, 80), [
    new THREE.MeshStandardMaterial({ map: corrugation, roughness: 1 }),
    new THREE.MeshStandardMaterial({ map: paper, roughness: 1 }),
    new THREE.MeshStandardMaterial({ color: 0x97713e }),
  ]);
  base.position.y = .115; base.castShadow = true; base.receiveShadow = true;
  hero.add(base);
  const slot = new THREE.Mesh(new THREE.BoxGeometry(1.08, .012, .075), new THREE.MeshStandardMaterial({ color: 0x6c502f }));
  slot.position.y = .219; hero.add(slot);

  const selectionRing = new THREE.Mesh(new THREE.RingGeometry(.9, .93, 80), new THREE.MeshBasicMaterial({ color: 0x647b48, transparent: true, opacity: .65, side: THREE.DoubleSide, depthWrite: false }));
  selectionRing.rotation.x = -Math.PI / 2; selectionRing.position.y = .012;
  selectionRing.visible = false; scene.add(selectionRing);
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

  const loader = new THREE.TextureLoader();
  const [tex, backTex] = await Promise.all([
    loader.loadAsync('assets/hero-a.png'),
    loader.loadAsync('assets/hero-back.png'),
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
  for (let i = 0; i < 9; i++) {
    const face = new THREE.Mesh(geometry, i === 8 ? printMaterial : i === 0 ? backMaterial : edgeMaterial);
    face.position.set(0, .225 + 1.025, (i - 4) * .006);
    face.castShadow = true;
    face.userData.print = true;
    hero.add(face);
  }

  const raycaster = new THREE.Raycaster();
  function rayAt(x, y) {
    raycaster.setFromCamera(new THREE.Vector2(x / innerWidth * 2 - 1, 1 - y / innerHeight * 2), camera);
  }
  function hitsHero(x, y) {
    rayAt(x, y);
    return raycaster.intersectObject(hero, true).some(hit => {
      if (!hit.object.userData.print || !hit.uv) return true;
      const px = Math.min(cut.width - 1, Math.max(0, Math.floor(hit.uv.x * cut.width)));
      const py = Math.min(cut.height - 1, Math.max(0, Math.floor((1 - hit.uv.y) * cut.height)));
      return alphaPixels[(py * cut.width + px) * 4 + 3] > 100;
    });
  }
  function choose(value) { selected = value; selectionRing.visible = value; }
  function stopAim() {
    aiming.visible = false;
    host.classList.remove('aiming');
  }
  function pinchDistance() {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
  host.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button !== 0 && event.button !== 2) return;
    host.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size > 1) {
      stopAim();
      const points = [...pointers.values()];
      gesture = { mode: 'pinch', distance: pinchDistance(), zoom: distance,
        lastX: (points[0].x + points[1].x) / 2, lastY: (points[0].y + points[1].y) / 2 };
      return;
    }
    if (event.button === 2 || event.altKey) {
      gesture = { mode: 'orbit', pointer: event.pointerId, startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastY: event.clientY, moved: false };
    } else {
      state.vx = 0; state.vz = 0;
      gesture = { mode: 'aim', pointer: event.pointerId, pull: { x: 0, z: 0 },
        hit: hitsHero(event.clientX, event.clientY), startX: event.clientX, startY: event.clientY, moved: false };
      host.classList.add('aiming');
    }
  });
  host.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId) || !gesture) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (gesture.mode === 'pinch') {
      if (pointers.size >= 2) {
        distance = THREE.MathUtils.clamp(gesture.zoom * gesture.distance / Math.max(1, pinchDistance()), 4.5, 18);
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
      choose(true);
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
        hero.rotation.y = facingAngle(direction.x, direction.z, hero.rotation.y);
        aiming.position.set(state.x, .025, state.z);
        aiming.rotation.y = hero.rotation.y;
        arrow.scale.y = .8 + 3.6 * length / MAX_PULL;
        arrow.material.color.setHSL(.25 - .18 * length / MAX_PULL, .42, .36);
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
        if (!cancelled && gesture.moved) launch(state, gesture.pull);
        else if (!cancelled) choose(gesture.hit);
        stopAim();
      }
      gesture = null;
    }
    pointers.delete(event.pointerId);
    if (pointers.size === 0) gesture = null;
  }
  host.addEventListener('pointerup', event => release(event, false));
  host.addEventListener('pointercancel', event => release(event, true));
  host.addEventListener('lostpointercapture', event => release(event, true));
  host.addEventListener('contextmenu', event => event.preventDefault());
  host.addEventListener('wheel', event => {
    event.preventDefault();
    if (gesture?.mode === 'aim') return;
    distance = THREE.MathUtils.clamp(distance * Math.exp(event.deltaY * .001), 4.5, 18);
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
    if (gesture?.mode !== 'aim') {
      for (let remaining = dt; remaining > 0; remaining -= 1 / 120) advance(state, Math.min(remaining, 1 / 120));
      hero.rotation.y = facingAngle(state.vx, state.vz, hero.rotation.y);
      if (selected) {
        const easing = 1 - Math.exp(-dt * 8);
        target.x += (state.x - target.x) * easing;
        target.z += (state.z - target.z) * easing;
      }
    }
    hero.position.set(state.x, 0, state.z);
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
