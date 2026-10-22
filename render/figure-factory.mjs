import { unionSpriteAlpha, clipSpriteToAlphaMask } from '../sprite-geometry.mjs?v=8';
import { silhouetteShapes as buildSilhouetteShapes, makeExtrudedSprite as buildExtrudedSprite } from '../figure-model.mjs?v=8';
import { heartHealthLevels } from '../heart-health.mjs';
import { enableFigurePickLayer } from '../game/pick-layers.mjs';
import { bindSsaoSpriteAlphaCutouts, markSsaoSpriteAlphaCutout } from './ssao-alpha-cutout.mjs?v=1';

const VISUAL_STATES = ['idle', 'aiming', 'attack', 'deal-damage', 'on-hit', 'dead'];

function cloneSpriteModel(model) {
  const group = model.group.clone(true);
  const frontFlashMesh = group.children.find(child => child.material === model.flashMaterial);
  const backFlashMesh = group.children.find(child => child.material === model.backFlashMaterial);
  const flashMaterial = model.flashMaterial.clone(), backFlashMaterial = model.backFlashMaterial.clone();
  if (frontFlashMesh) frontFlashMesh.material = flashMaterial;
  if (backFlashMesh) backFlashMesh.material = backFlashMaterial;
  bindSsaoSpriteAlphaCutouts(group);
  return { ...model, group, flashMaterial, backFlashMaterial };
}

function yieldFrameWork() {
  return new Promise(resolve => {
    if (window.requestIdleCallback) window.requestIdleCallback(resolve, { timeout: 120 });
    else setTimeout(resolve, 16);
  });
}

/** Build display instances from cached pose geometry and source textures. */
export function createFigureFactory({ THREE, scene, renderer, ambientShadowMaterial, contactShadowMaterial,
  corrugation, paper, sceneStencil, heartMaterials, createEnemyMarker, groundUiY, assetBase = 'assets/', geometryClient }) {
  const artCache = new Map();
  let puckColors = { player: '#d1e8ae', enemy: '#e9a092' };
  const unitPucks = new Set();
  function setPuckColors(settings) {
    puckColors = { ...puckColors, ...settings };
    for (const { base, team } of unitPucks) for (const material of [base.material].flat()) material.color.set(puckColors[team]);
  }

  async function loadWorkerArt(body, prefix) {
    const states = {};
    const prepared = await Promise.all(VISUAL_STATES.flatMap(visualState => ['front', 'back'].map(side => {
      const url = new URL(`${assetBase}${prefix}-${visualState}${side === 'back' ? '-back' : ''}.png?sheet=3`, location.href).href;
      return geometryClient.run('figure', { url, player: body.team === 'player',
        flip: body.team === 'player' && visualState === 'idle' && side === 'front' });
    })));
    let faceIndex = 0;
    for (const visualState of VISUAL_STATES) {
      const faces = [];
      for (const side of ['front', 'back']) {
        const model = prepared[faceIndex++];
        model.flashMaterial = model.byUuid.get(model.flashUuid).material;
        model.backFlashMaterial = model.byUuid.get(model.backFlashUuid).material;
        model.group.rotation.y = side === 'back' ? Math.PI : 0;
        faces.push(model);
      }
      const [frontArt, backArt] = faces, group = new THREE.Group(); group.position.y = 1.25;
      group.add(frontArt.group, backArt.group); backArt.group.visible = false;
      states[visualState] = { group, frontArt, backArt, alphaPixels: frontArt.alphaPixels,
        width: frontArt.width, height: frontArt.height };
    }
    const { width, height, alphaPixels } = states.dead;
    let bottomRow = height - 1;
    outer: for (let y = height - 1; y >= 0; y--) for (let x = 0; x < width; x++)
      if (alphaPixels[(y * width + x) * 4 + 3] > 80) { bottomRow = y; break outer; }
    return { states, deadGroundedY: .215 - (.5 - bottomRow / height) * 2.05 };
  }

  async function loadFigureArt(body, prefix) {
    const key = `${prefix}:${body.team === 'player' ? 'player' : 'enemy'}`;
    let pending = artCache.get(key);
    if (!pending) {
      pending = (async () => {
        if (geometryClient) return loadWorkerArt(body, prefix);
        const loader = new THREE.TextureLoader();
        const frontSources = await Promise.all(VISUAL_STATES.map(state =>
          loader.loadAsync(`${assetBase}${prefix}-${state}.png?sheet=3`)));
        const backSources = await Promise.all(VISUAL_STATES.map(state =>
          loader.loadAsync(`${assetBase}${prefix}-${state}-back.png?sheet=3`)));
        const width = frontSources[0].image.width, height = frontSources[0].image.height;
        if ([...frontSources, ...backSources].some(source => source.image.width !== width || source.image.height !== height)) {
          throw new Error(`Pose sheet cells must share one frame: ${prefix}`);
        }

        const prepareFace = (image, visualState, side) => {
          const canvas = document.createElement('canvas');
          canvas.width = width; canvas.height = height;
          const context = canvas.getContext('2d', { willReadFrequently: true });
          const flipIdlePlayerFront = body.team === 'player' && visualState === 'idle' && side === 'front';
          if (flipIdlePlayerFront) { context.translate(width, 0); context.scale(-1, 1); }
          context.drawImage(image, 0, 0, width, height);
          if (flipIdlePlayerFront) context.setTransform(1, 0, 0, 1, 0, 0);
          const pixels = context.getImageData(0, 0, width, height).data;
          if (!pixels.some((_value, index) => index % 4 === 3 && pixels[index] > 80)) {
            throw new Error(`Empty sprite: ${prefix}-${visualState}-${side}`);
          }
          const cleanedMask = unionSpriteAlpha(pixels, pixels, width, height);
          const geometry = buildSilhouetteShapes(cleanedMask, width, height, 2.05 * width / height, 2.05);
          const alphaPixels = clipSpriteToAlphaMask(pixels, geometry.rasterMask);
          context.putImageData(new ImageData(alphaPixels, width, height), 0, 0);
          const texture = new THREE.CanvasTexture(canvas);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
          const model = buildExtrudedSprite(alphaPixels, width, height, texture, texture,
            corrugation, body.team === 'player', geometry.shapes, alphaPixels);
          model.group.rotation.y = side === 'back' ? Math.PI : 0;
          return { ...model, texture };
        };

        const states = {};
        for (let index = 0; index < VISUAL_STATES.length; index++) {
          const visualState = VISUAL_STATES[index];
          const frontArt = prepareFace(frontSources[index].image, visualState, 'front');
          await yieldFrameWork();
          const backArt = prepareFace(backSources[index].image, visualState, 'back');
          await yieldFrameWork();
          const group = new THREE.Group(); group.position.y = 1.25;
          group.add(frontArt.group, backArt.group);
          frontArt.group.visible = true; backArt.group.visible = false;
          states[visualState] = { group, frontArt, backArt,
            alphaPixels: frontArt.alphaPixels, width, height };
          frontSources[index].dispose(); backSources[index].dispose();
        }

        let bottomRow = height - 1;
        for (let y = height - 1; y >= 0; y--) {
          let visible = false;
          for (let x = 0; x < width; x++) if (states.dead.alphaPixels[(y * width + x) * 4 + 3] > 80) {
            visible = true; break;
          }
          if (visible) { bottomRow = y; break; }
        }
        const bottomLocalY = (.5 - bottomRow / height) * 2.05;
        return { states, deadGroundedY: .215 - bottomLocalY };
      })();
      artCache.set(key, pending);
      pending.catch(() => artCache.delete(key));
    }
    return pending;
  }

  const createFigure = async function(body, prefix) {
    const group = new THREE.Group();
    group.visible = !geometryClient || body.team === 'player';
    scene.add(group);
    const ambientShadow = new THREE.Mesh(new THREE.CircleGeometry(1.02, 64), ambientShadowMaterial);
    ambientShadow.rotation.x = -Math.PI / 2; ambientShadow.position.y = .008; ambientShadow.renderOrder = 1;
    group.add(ambientShadow);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.8, .8, .2, 80), [
      new THREE.MeshStandardMaterial({ map: corrugation, roughness: 1, ...sceneStencil }),
      new THREE.MeshStandardMaterial({ map: paper, roughness: 1, ...sceneStencil }),
      new THREE.MeshStandardMaterial({ color: 0x97713e, ...sceneStencil }),
    ]);
    const puckTeam = body.team === 'player' ? 'player' : 'enemy';
    base.userData.unitPuckTeam = puckTeam;
    unitPucks.add({ base, team: puckTeam });
    for (const material of [base.material].flat()) material.color.set(puckColors[puckTeam]);
    base.position.y = .115; base.castShadow = true; base.receiveShadow = true;
    group.add(base);
    const contactShadow = new THREE.Mesh(new THREE.PlaneGeometry(.98, .34), contactShadowMaterial);
    markSsaoSpriteAlphaCutout(contactShadow, contactShadowMaterial.map, .04);
    contactShadow.rotation.x = -Math.PI / 2; contactShadow.position.set(0, .218, .02); contactShadow.renderOrder = 5;
    group.add(contactShadow);
    const slot = new THREE.Mesh(new THREE.BoxGeometry(1.08, .012, .075), new THREE.MeshStandardMaterial({ color: 0x6c502f }));
    slot.position.y = .219; group.add(slot);

    const assets = await loadFigureArt(body, prefix);
    const artStates = {};
    for (const visualState of VISUAL_STATES) {
      const template = assets.states[visualState];
      const frontArt = cloneSpriteModel(template.frontArt), backArt = cloneSpriteModel(template.backArt);
      const artGroup = new THREE.Group(); artGroup.position.y = 1.25;
      artGroup.add(frontArt.group, backArt.group);
      artGroup.visible = false; group.add(artGroup);
      artStates[visualState] = { group: artGroup, frontArt, backArt,
        alphaPixels: frontArt.alphaPixels, width: frontArt.width, height: frontArt.height };
    }
    const initialArt = artStates.idle;
    initialArt.group.visible = true;
    initialArt.frontArt.group.visible = true; initialArt.backArt.group.visible = false;

    const healthHUD = new THREE.Group();
    const levels = heartHealthLevels(body.health, body.maxHealth);
    const heartIcons = levels.map((level, index) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(.23, .23), heartMaterials[level]);
      markSsaoSpriteAlphaCutout(mesh, heartMaterials[level].map, heartMaterials[level].alphaTest || .04);
      mesh.renderOrder = 100;
      mesh.position.set((index - (levels.length - 1) / 2) * .245, 0, .01);
      healthHUD.add(mesh);
      return { mesh, level };
    });
    let chargePips = [];
    if (body.team === 'player') {
      chargePips = Array.from({ length: body.maxCharges }, (_, index) => {
        const pip = new THREE.Group();
        const baseMesh = new THREE.Mesh(new THREE.CircleGeometry(.09, 32),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .4, side: THREE.DoubleSide, depthWrite: false }));
        const fill = new THREE.Mesh(new THREE.CircleGeometry(.09, 32),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .9, side: THREE.DoubleSide, depthWrite: false, depthTest: false }));
        baseMesh.material.depthTest = false;
        baseMesh.renderOrder = 100; fill.renderOrder = 101;
        fill.position.z = .012;
        pip.position.set((index - (body.maxCharges - 1) / 2) * .32, .29, .02);
        pip.add(baseMesh, fill); healthHUD.add(pip);
        return { group: pip, base: baseMesh, fill };
      });
    }
    healthHUD.position.set(body.x, 2.65, body.z); scene.add(healthHUD);
    let enemyMarker = null;
    if (body.team === 'enemy') {
      enemyMarker = createEnemyMarker(0xdf3830, 0xff887d, true);
      enemyMarker.group.rotation.y = body.aiAimAngle ?? 0;
      enemyMarker.group.position.set(body.x, groundUiY, body.z);
      scene.add(enemyMarker.group);
    }
    const figure = { group, prefix, artGroup: initialArt.group, artStates, visualState: 'idle', body,
      alphaPixels: initialArt.alphaPixels, width: initialArt.width, height: initialArt.height,
      healthHUD, heartIcons, chargePips, enemyMarker, deadGroundedY: assets.deadGroundedY,
      flashMaterial: initialArt.frontArt.flashMaterial, backFlashMaterial: initialArt.backArt.flashMaterial,
      viewBack: false, facing: 0, hitAge: 10, hitStrength: 0, hurtAge: 10, dealDamageAge: 10 };
    group.userData.figure = figure;
    group.position.set(body.x, 0, body.z);
    enableFigurePickLayer(group, body.team);
    return figure;
  };
  createFigure.setPuckColors = setPuckColors;
  createFigure.releaseUnused = async prefixes => {
    const removed = [];
    for (const [key, pending] of artCache) if (!prefixes.has(key.split(':')[0])) {
      const art = await pending;
      removed.push(...Object.values(art.states).map(state => state.group)); artCache.delete(key);
    }
    return removed;
  };
  return createFigure;
}
