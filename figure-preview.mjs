import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { silhouetteShapes, makeExtrudedSprite } from './figure-model.mjs?v=4';
import { unionSpriteAlpha, clipSpriteToAlphaMask } from './sprite-geometry.mjs?v=5';

const states = ['idle', 'aiming', 'attack', 'deal-damage', 'on-hit', 'dead'];
const subjects = [{ id: 'hero', label: 'Игрок' }, { id: 'goblin', label: 'Гоблин' }];
const views = [{ id: 'front', label: 'Спереди', angle: 0 }, { id: 'three-quarter', label: '¾', angle: Math.PI / 4 }, { id: 'back', label: 'Сзади', angle: Math.PI }];
const status = document.querySelector('#status'), sheet = document.querySelector('#sheet');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, stencil: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); renderer.setClearColor(0xf0e3c8); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.autoClear = false;
renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:1;pointer-events:none';
sheet.style.position = 'relative'; sheet.append(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xf0e3c8);
scene.add(new THREE.HemisphereLight(0xfff8ea, 0x817054, 2.6));
const key = new THREE.DirectionalLight(0xffebcb, 2.8); key.position.set(-4, 8, 7); scene.add(key);
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 50);
const loader = new THREE.TextureLoader();
const corrugationCanvas = document.createElement('canvas'); corrugationCanvas.width = 1024; corrugationCanvas.height = 128;
const cc = corrugationCanvas.getContext('2d'); cc.fillStyle = '#a77b46'; cc.fillRect(0, 0, 1024, 128);
for (let y = 0; y < 128; y += 32) { cc.fillStyle = '#e0bf85'; cc.fillRect(0, y, 1024, 5); cc.strokeStyle = '#67482b'; cc.lineWidth = 3; cc.beginPath(); for (let x = 0; x <= 1024; x += 2) { const yy = y + 18 + 9 * Math.sin(x * .18); x ? cc.lineTo(x, yy) : cc.moveTo(x, yy); } cc.stroke(); }
const corrugation = new THREE.CanvasTexture(corrugationCanvas); corrugation.colorSpace = THREE.SRGBColorSpace;
const paperCanvas = document.createElement('canvas'); paperCanvas.width = paperCanvas.height = 128;
const pc = paperCanvas.getContext('2d'); pc.fillStyle = '#e4d0a8'; pc.fillRect(0, 0, 128, 128);
for (let i = 0; i < 900; i++) { pc.fillStyle = i % 2 ? '#98734112' : '#fff7db24'; pc.fillRect(Math.random() * 128, Math.random() * 128, 1, 1); }
const paper = new THREE.CanvasTexture(paperCanvas); paper.colorSpace = THREE.SRGBColorSpace;
const built = new Map(), cells = [];

async function loadSubject(subject) {
  const textures = await Promise.all(states.map(state => loader.loadAsync(`assets/${subject.id}-${state}.png?sheet=2`)));
  const backTextures = await Promise.all(states.map(state => loader.loadAsync(`assets/${subject.id}-${state}-back.png?sheet=2`)));
  const frameWidth = textures[0].image.width, frameHeight = textures[0].image.height;
  if (textures.some(texture => texture.image.width !== frameWidth || texture.image.height !== frameHeight)
    || backTextures.some(texture => texture.image.width !== frameWidth || texture.image.height !== frameHeight)) {
    throw new Error(`Pose sheet cells must share one frame: ${subject.id}`);
  }
  const prepareFace = (image, state, side) => {
    const canvas = document.createElement('canvas'); canvas.width = frameWidth; canvas.height = frameHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(image, 0, 0, frameWidth, frameHeight);
    const pixels = ctx.getImageData(0, 0, frameWidth, frameHeight).data;
    if (!pixels.some((_value, index) => index % 4 === 3 && pixels[index] > 80)) throw new Error(`Empty sprite: ${subject.id}-${state}-${side}`);
    const cleaned = unionSpriteAlpha(pixels, pixels, frameWidth, frameHeight);
    const worldWidth = 2.05 * frameWidth / frameHeight;
    const outline = silhouetteShapes(cleaned, frameWidth, frameHeight, worldWidth, 2.05);
    const alphaPixels = clipSpriteToAlphaMask(pixels, outline.rasterMask);
    ctx.putImageData(new ImageData(alphaPixels, frameWidth, frameHeight), 0, 0);
    const faceTexture = new THREE.CanvasTexture(canvas); faceTexture.colorSpace = THREE.SRGBColorSpace;
    const model = makeExtrudedSprite(alphaPixels, frameWidth, frameHeight, faceTexture, faceTexture,
      corrugation, subject.id === 'hero', outline.shapes, alphaPixels);
    model.group.rotation.y = side === 'back' ? Math.PI : 0;
    return model;
  };
  for (let si = 0; si < states.length; si++) {
    const frontArt = prepareFace(textures[si].image, states[si], 'front');
    const backArt = prepareFace(backTextures[si].image, states[si], 'back');
    const art = { group: new THREE.Group(), frontArt, backArt };
    art.group.add(frontArt.group, backArt.group); frontArt.group.visible = true; backArt.group.visible = false;
    const group = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.8, .8, .2, 48), [
      new THREE.MeshStandardMaterial({ map: corrugation, roughness: 1 }),
      new THREE.MeshStandardMaterial({ map: paper, roughness: 1 }),
      new THREE.MeshStandardMaterial({ color: 0x97713e }),
    ]);
    base.position.y = .115; group.add(base); art.group.position.y = 1.25; group.add(art.group);
    built.set(`${subject.id}:${states[si]}`, { group, art, source, front, back });
    backTexture.dispose();
  }
}

function addCards() {
  for (const state of states) {
    const banner = document.createElement('div'); banner.className = 'state'; banner.textContent = state.toUpperCase(); sheet.append(banner);
    for (const subject of subjects) for (const view of views) {
      const cell = document.createElement('div'); cell.className = 'cell';
      const label = document.createElement('span'); label.className = 'label'; label.textContent = subject.label;
      const viewLabel = document.createElement('span'); viewLabel.className = 'view'; viewLabel.textContent = view.label;
      cell.append(label, viewLabel); sheet.append(cell);
      cells.push({ cell, subject, state, view });
    }
  }
}

function render() {
  const ratio = renderer.getPixelRatio(), bounds = renderer.domElement.getBoundingClientRect();
  renderer.setSize(sheet.clientWidth, sheet.clientHeight, false);
  renderer.setScissorTest(true);
  for (const { cell, subject, state, view } of cells) {
    const r = cell.getBoundingClientRect(), x = Math.round((r.left - bounds.left) * ratio), y = Math.round((bounds.bottom - r.bottom) * ratio);
    const w = Math.round(r.width * ratio), h = Math.round(r.height * ratio);
    renderer.setViewport(x, y, w, h); renderer.setScissor(x, y, w, h); renderer.clear(true, true, true);
    const model = built.get(`${subject.id}:${state}`); scene.add(model.group);
    model.art.group.rotation.set(0, view.angle, 0);
    model.art.frontArt.group.visible = view.angle <= Math.PI / 2;
    model.art.backArt.group.visible = view.angle > Math.PI / 2;
    model.art.group.updateMatrix(); model.art.group.updateMatrixWorld(true);
    const aspect = r.width / r.height, halfHeight = 1.58;
    camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect; camera.top = halfHeight; camera.bottom = -halfHeight;
    camera.position.set(0, 2.5, 8); camera.lookAt(0, 1.16, 0); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    renderer.render(scene, camera); scene.remove(model.group);
  }
  renderer.setScissorTest(false);
}

try {
  addCards(); await Promise.all(subjects.map(loadSubject));
  status.textContent = 'Готово. Сравнивайте совпадение спрайта с контуром, заднюю текстуру и толщину с трёх сторон.';
  render(); addEventListener('resize', render);
} catch (error) {
  status.classList.add('error'); status.textContent = `Не удалось построить лист предпросмотра: ${error.message}`; console.error(error);
}
