import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { makeScenerySprite } from './scenery-model-v4.mjs?v=3';
import { PUCK_CENTER_Y, PUCK_HEIGHT, sceneryTokenLayout } from './scenery-layout.mjs?v=1';

const assets = [
  { id: 'hero-house', label: 'Дом героя', path: 'assets/hero-house.png', height: 3.5, radius: 1.2 },
  { id: 'goblin-hut', label: 'Хижина гоблинов', path: 'assets/env-troll-hut.png', height: 3.2, radius: 1.04 },
  { id: 'tree', label: 'Дерево', path: 'assets/env-tree.png', height: 3.0 },
  { id: 'evergreen', label: 'Ель', path: 'assets/env-evergreen.png', height: 3.0 },
  { id: 'moss-rocks', label: 'Мох и камни', path: 'assets/env-moss-rocks.png', height: 2.2 },
  { id: 'bushes', label: 'Кусты', path: 'assets/env-bushes.png', height: 2.4 },
  { id: 'fortress', label: 'Крепость', path: 'assets/env-fortress.png', height: 3.1 },
];
const views = [
  { id: 'front', label: 'Спереди', angle: 0 },
  { id: 'three-quarter', label: '¾', angle: Math.PI / 4 },
  { id: 'side', label: 'Сбоку', angle: Math.PI / 2 },
  { id: 'back', label: 'Сзади', angle: Math.PI },
];
const status = document.querySelector('#status'), auditElement = document.querySelector('#render-audit');
const sheet = document.querySelector('#sheet'), renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); renderer.setClearColor(0xf0e3c8); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.autoClear = false;
renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none'; sheet.append(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xf0e3c8);
scene.add(new THREE.HemisphereLight(0xfff8ea, 0x817054, 2.6));
const key = new THREE.DirectionalLight(0xffebcb, 2.8); key.position.set(-4, 8, 7); scene.add(key);
const camera = new THREE.OrthographicCamera(-2, 2, 2, -2, .1, 50);
const corrugationCanvas = document.createElement('canvas'); corrugationCanvas.width = 1024; corrugationCanvas.height = 128;
const cc = corrugationCanvas.getContext('2d'); cc.fillStyle = '#a77b46'; cc.fillRect(0, 0, 1024, 128);
for (let y = 0; y < 128; y += 32) {
  cc.fillStyle = '#e0bf85'; cc.fillRect(0, y, 1024, 5); cc.strokeStyle = '#67482b'; cc.lineWidth = 3;
  cc.beginPath(); for (let x = 0; x <= 1024; x += 2) { const yy = y + 18 + 9 * Math.sin(x * .18); x ? cc.lineTo(x, yy) : cc.moveTo(x, yy); } cc.stroke();
}
const corrugation = new THREE.CanvasTexture(corrugationCanvas); corrugation.colorSpace = THREE.SRGBColorSpace;
const paperCanvas = document.createElement('canvas'); paperCanvas.width = paperCanvas.height = 128;
const pc = paperCanvas.getContext('2d'); pc.fillStyle = '#e4d0a8'; pc.fillRect(0, 0, 128, 128);
const paper = new THREE.CanvasTexture(paperCanvas); paper.colorSpace = THREE.SRGBColorSpace;
const cells = [], models = new Map(), audit = [];

function addCards() {
  const banner = document.createElement('div'); banner.className = 'state'; banner.textContent = 'ФИШКИ'; sheet.append(banner);
  for (const asset of assets) for (const view of views) {
    const cell = document.createElement('div'); cell.className = 'cell';
    const label = document.createElement('span'); label.className = 'label'; label.textContent = asset.label;
    const angle = document.createElement('span'); angle.className = 'view'; angle.textContent = view.label;
    cell.append(label, angle); sheet.append(cell); cells.push({ cell, asset, view });
  }
}

async function loadAssets() {
  const loader = new THREE.TextureLoader();
  for (const asset of assets) {
    const source = await loader.loadAsync(`${asset.path}?art=4`);
    const model = makeScenerySprite(source.image, corrugation, renderer.capabilities.getMaxAnisotropy()); source.dispose();
    model.geometry.computeBoundingBox();
    const depth = model.geometry.boundingBox.max.z - model.geometry.boundingBox.min.z;
    if (!(depth >= .14)) throw new Error(`${asset.label}: выдавливание пропало (глубина ${depth.toFixed(3)})`);
    const root = new THREE.Group();
    const paperSide = new THREE.MeshStandardMaterial({ map: paper, roughness: 1 });
    if (asset.radius) {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(asset.radius, asset.radius, PUCK_HEIGHT, 64), [
        new THREE.MeshStandardMaterial({ map: corrugation, roughness: 1 }), paperSide,
        new THREE.MeshStandardMaterial({ color: 0x97713e }),
      ]);
      base.position.y = PUCK_CENTER_Y; base.castShadow = true; base.receiveShadow = true; root.add(base);
    }
    const layout = sceneryTokenLayout(asset.height, asset.radius ?? 0);
    model.group.scale.setScalar(layout.scale);
    model.group.position.y = layout.artY;
    root.add(model.group);
    models.set(asset.id, { root, model });
    const baseTop = layout.baseTop;
    const artBottom = model.group.position.y - asset.height / 2;
    const flipMatches = model.backFlipMatches;
    const visibleExtrusions = Number(model.frontGroup.visible) + Number(model.backGroup.visible);
    audit.push({ id: asset.id, views: 4, extrusionDepth: depth * layout.scale,
      baseRadius: asset.radius ?? 0, baseTop, artBottom, groundGap: artBottom - baseTop,
      backFlipMatches: flipMatches, backTextureShared: model.backTextureShared,
      singleExtrusion: model.singleExtrusion, visibleExtrusions });
    if (!flipMatches) throw new Error(`${asset.label}: задняя сторона не совпадает со спрайтом, отражённым по X (audit=${String(flipMatches)})`);
    if (visibleExtrusions !== 1) throw new Error(`${asset.label}: одновременно видны две толщины картона`);
    if (Math.abs(artBottom - baseTop) > 1e-8) throw new Error(`${asset.label}: основание проваливается или висит над шайбой`);
  }
}

function render() {
  const ratio = renderer.getPixelRatio(), bounds = renderer.domElement.getBoundingClientRect();
  const activeExtrusions = Object.fromEntries(assets.map(asset => [asset.id, []]));
  renderer.setSize(sheet.clientWidth, sheet.clientHeight, false); renderer.setScissorTest(true);
  for (const { cell, asset, view } of cells) {
    const r = cell.getBoundingClientRect(), x = Math.round((r.left - bounds.left) * ratio), y = Math.round((bounds.bottom - r.bottom) * ratio);
    const w = Math.round(r.width * ratio), h = Math.round(r.height * ratio);
    renderer.setViewport(x, y, w, h); renderer.setScissor(x, y, w, h); renderer.clear(true, true, true);
    const model = models.get(asset.id); model.root.rotation.y = view.angle; model.model.setViewBack(view.angle > Math.PI / 2);
    const visibleExtrusions = Number(model.model.frontGroup.visible) + Number(model.model.backGroup.visible);
    activeExtrusions[asset.id].push(visibleExtrusions);
    if (visibleExtrusions !== 1) throw new Error(`${asset.label} (${view.label}): одновременно видны две толщины картона`);
    scene.add(model.root);
    const aspect = r.width / r.height, halfHeight = 2.1;
    camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect; camera.top = halfHeight; camera.bottom = -halfHeight;
    camera.position.set(0, 3.1, 8); camera.lookAt(0, 1.5, 0); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    renderer.render(scene, camera); scene.remove(model.root);
  }
  renderer.setScissorTest(false);
  for (const item of audit) item.activeExtrusionsPerView = activeExtrusions[item.id];
  status.textContent = `Готово: ${audit.length} фишек отрисованы в четырёх ракурсах; шайбы, толщина и зеркальные задники проверены.`;
  auditElement.textContent = JSON.stringify({ ok: true, models: audit });
}

try { addCards(); await loadAssets(); render(); addEventListener('resize', render); }
catch (error) {
  status.classList.add('error'); status.textContent = `Ошибка проверки фишек: ${error.message}`;
  auditElement.textContent = JSON.stringify({ ok: false, error: error.message, models: audit }); console.error(error);
}
