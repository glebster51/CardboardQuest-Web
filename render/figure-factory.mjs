import { unionSpriteAlpha, clipSpriteToAlphaMask } from '../sprite-geometry.mjs?v=7c14a71de3a9af87';
import { silhouetteShapes as buildSilhouetteShapes, makeExtrudedSprite as buildExtrudedSprite } from '../figure-model.mjs?v=7c14a71de3a9af87';
import { HEALTH_HEART_SIZE, heartHealthLevels, healthHeartLayout, healthHeartRenderOrder } from '../heart-health.mjs?v=7c14a71de3a9af87';
import { enableFigurePickLayer } from '../game/pick-layers.mjs?v=7c14a71de3a9af87';
import { bindSsaoSpriteAlphaCutouts, markSsaoSpriteAlphaCutout } from './ssao-alpha-cutout.mjs?v=7c14a71de3a9af87';
import { assignSharpHudLayer } from './sharp-hud-overlay.mjs?v=7c14a71de3a9af87';
import { createStatusEffectIndicators } from './status-effect-visuals.mjs?v=7c14a71de3a9af87';
import { applyEnemySilhouetteStencil } from './enemy-occlusion-silhouette.mjs?v=7c14a71de3a9af87';
import { bindCardboardDamageTree } from '../cardboard-damage.mjs?v=7c14a71de3a9af87';

const VISUAL_STATES = ['idle', 'aiming', 'attack', 'deal-damage', 'on-hit', 'dead'];
const damageSeed = value => {
  let hash = 2166136261;
  for (const character of String(value)) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return (hash >>> 0) / 4294967295 * 1000;
};

function cloneSpriteModel(model, damageContext = null) {
  const group = model.group.clone(true);
  const damageMaterials = [];
  group.traverse(object => {
    if (!object.isMesh || !(object.userData.cardboardSurface || object.name.startsWith('cardboard-'))) return;
    object.userData.cardboardSurface = true;
    object.material = Array.isArray(object.material) ? object.material.map(material => material.clone()) : object.material.clone();
  });
  if (damageContext) damageMaterials.push(...bindCardboardDamageTree(group, damageContext));
  bindSsaoSpriteAlphaCutouts(group);
  // Resolve references after the single material-cloning pass. Otherwise the
  // animation updates an orphan material while the rendered clone stays at 0.
  return installWhiteHitShader({ ...model, group, frontCap: group.getObjectByName('cardboard-front'), damageMaterials });
}

function installWhiteHitShader(model) {
  for (const [meshName, materialKey] of [['cardboard-front-flash', 'flashMaterial'], ['cardboard-back-flash', 'backFlashMaterial']]) {
    const mesh = model.group.getObjectByName(meshName);
    if (!mesh?.material) continue;
    const face = model.group.getObjectByName(meshName === 'cardboard-front-flash' ? 'cardboard-front' : 'cardboard-back');
    // Follow baked damage deformations instead of sinking into a dented face.
    if (face) mesh.geometry = face.geometry;
    const material = mesh.material.clone();
    material.toneMapped = false;
    const previousCompile = material.onBeforeCompile;
    const previousKey = material.customProgramCacheKey;
    material.onBeforeCompile = function (shader, renderer) {
      previousCompile?.call(this, shader, renderer);
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>',
        '#include <color_fragment>\ndiffuseColor.rgb = vec3(1.0);');
    };
    material.customProgramCacheKey = function () { return `${previousKey?.call(this) ?? ''}|cq-white-hit-v1`; };
    material.needsUpdate = true;
    mesh.material = material;
    model[materialKey] = material;
  }
  return model;
}

function createHoverOutline(THREE, model, color = [255, 157, 34]) {
  if (!model?.alphaPixels || !model.width || !model.height || !model.frontCap) return null;
  const padding = 14, radius = 12, width = model.width, height = model.height;
  const textureWidth = width + padding * 2, textureHeight = height + padding * 2;
  const source = new Uint8Array(textureWidth * textureHeight);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    source[(y + padding) * textureWidth + x + padding] = model.alphaPixels[(y * width + x) * 4 + 3];
  }
  const horizontal = new Uint8Array(source.length), dilated = new Uint8Array(source.length);
  const maxFilter = (input, output, horizontalAxis) => {
    const lineCount = horizontalAxis ? textureHeight : textureWidth;
    const lineLength = horizontalAxis ? textureWidth : textureHeight;
    const queue = new Int32Array(lineLength);
    for (let line = 0; line < lineCount; line++) {
      let head = 0, tail = 0, next = 0;
      for (let position = 0; position < lineLength; position++) {
        const right = Math.min(lineLength - 1, position + radius);
        while (next <= right) {
          const sampleIndex = horizontalAxis ? line * textureWidth + next : next * textureWidth + line;
          const value = input[sampleIndex];
          while (tail > head) {
            const previous = queue[tail - 1];
            const previousIndex = horizontalAxis ? line * textureWidth + previous : previous * textureWidth + line;
            if (input[previousIndex] > value) break;
            tail--;
          }
          queue[tail++] = next++;
        }
        while (tail > head && queue[head] < position - radius) head++;
        const maxIndex = horizontalAxis ? line * textureWidth + queue[head] : queue[head] * textureWidth + line;
        const outputIndex = horizontalAxis ? line * textureWidth + position : position * textureWidth + line;
        output[outputIndex] = input[maxIndex];
      }
    }
  };
  maxFilter(source, horizontal, true); maxFilter(horizontal, dilated, false);
  const pixels = new Uint8Array(source.length * 4);
  for (let index = 0; index < source.length; index++) {
    pixels[index * 4] = color[0]; pixels[index * 4 + 1] = color[1]; pixels[index * 4 + 2] = color[2];
    pixels[index * 4 + 3] = Math.max(0, dilated[index] - source[index]);
  }
  const canvas = document.createElement('canvas'); canvas.width = textureWidth; canvas.height = textureHeight;
  const context = canvas.getContext('2d');
  const image = context.createImageData(textureWidth, textureHeight); image.data.set(pixels); context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  const material = new THREE.MeshBasicMaterial({ map: texture, alphaTest: .08, side: THREE.DoubleSide,
    depthTest: false, depthWrite: false, toneMapped: false });
  const front = model.frontCap, sourceWidth = front.geometry.parameters?.width ?? 2.05 * width / height;
  const sourceHeight = front.geometry.parameters?.height ?? 2.05;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(sourceWidth * textureWidth / width,
    sourceHeight * textureHeight / height), material);
  mesh.position.z = front.position.z + .006;
  mesh.renderOrder = 200;
  mesh.visible = false;
  model.group.add(mesh);
  return mesh;
}

function createEnemyOcclusionArt(THREE, sourceModel) {
  const model = cloneSpriteModel(sourceModel);
  model.group.traverse(object => {
    if (!object.isMesh) return;
    const tint = source => applyEnemySilhouetteStencil(new THREE.MeshBasicMaterial({ map: source.map ?? null,
      alphaMap: source.alphaMap ?? null, color: 0xff4444, alphaTest: Math.max(.04, source.alphaTest ?? 0),
      transparent: true, opacity: .38, depthTest: false, depthWrite: false,
      side: THREE.DoubleSide, toneMapped: false }), THREE);
    object.material = Array.isArray(object.material) ? object.material.map(tint) : tint(object.material);
    object.renderOrder = 98;
  });
  const outline = createHoverOutline(THREE, model, [255, 45, 42]);
  if (outline) {
    applyEnemySilhouetteStencil(outline.material, THREE);
    outline.renderOrder = 99;
  }
  return model;
}

function yieldFrameWork() {
  return new Promise(resolve => {
    if (window.requestIdleCallback) window.requestIdleCallback(resolve, { timeout: 120 });
    else setTimeout(resolve, 16);
  });
}

/** Build display instances from cached pose geometry and source textures. */
export function createFigureFactory({ THREE, scene, renderer, ambientShadowMaterial, contactShadowMaterial,
  corrugation, paper, sceneStencil, heartMaterialVariants, createEnemyMarker, groundUiY, assetBase = 'assets/', geometryClient,
  cardboardDamageTexture, cardboardVoronoiTexture, cardboardTearNoiseTexture, cardboardPerlinTexture,
  revealUniforms, getCardboardDamageSettings = () => ({}) }) {
  const artCache = new Map();
  const spriteBase = prefix => prefix === 'ogre' ? new URL('../bosses/ogre/textures/', import.meta.url).href : assetBase;
  let puckColors = { player: '#d1e8ae', enemy: '#e9a092' };
  const unitPucks = new Set();
  function setPuckColors(settings) {
    puckColors = { ...puckColors, ...settings };
    for (const { base, team } of unitPucks) for (const material of [base.material].flat()) material.color.set(puckColors[team]);
  }

  async function loadWorkerArt(body, prefix) {
    if (body.spriteAsset) {
      const spritePath = body.spriteAsset.replace(/^assets\//, '');
      const url = new URL(`${body.spriteAsset?.startsWith('bosses/') ? new URL('../', import.meta.url).href + body.spriteAsset : assetBase + spritePath}?sheet=3`, location.href).href;
      const model = await geometryClient.run('figure', { url, player: false });
      model.flashMaterial = model.byUuid.get(model.flashUuid).material;
      model.backFlashMaterial = model.byUuid.get(model.backFlashUuid).material;
      model.frontCap = model.byUuid.get(model.frontCapUuid);
      installWhiteHitShader(model);
      const frontArt = model, backArt = cloneSpriteModel(model);
      frontArt.group.rotation.y = 0; backArt.group.rotation.y = Math.PI;
      const group = new THREE.Group(); group.add(frontArt.group, backArt.group);
      const states = Object.fromEntries(VISUAL_STATES.map(visualState => [visualState, {
        group, frontArt, backArt, alphaPixels: model.alphaPixels, width: model.width, height: model.height,
      }]));
      let bottomRow = model.height - 1;
      outer: for (let y = model.height - 1; y >= 0; y--) for (let x = 0; x < model.width; x++)
        if (model.alphaPixels[(y * model.width + x) * 4 + 3] > 80) { bottomRow = y; break outer; }
      return { states, deadGroundedY: .215 - (.5 - bottomRow / model.height) * 2.05 };
    }
    const states = {};
    const prepared = await Promise.all(VISUAL_STATES.flatMap(visualState => ['front', 'back'].map(side => {
      const url = new URL(`${spriteBase(prefix)}${prefix}-${visualState}${side === 'back' ? '-back' : ''}.png?sheet=3`, location.href).href;
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
        model.frontCap = model.byUuid.get(model.frontCapUuid);
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
    const key = `${prefix}${body.spriteAsset ? `:sprite:${body.spriteAsset}` : ''}:${body.team === 'player' ? 'player' : 'enemy'}`;
    let pending = artCache.get(key);
    if (!pending) {
      pending = (async () => {
        if (geometryClient) return loadWorkerArt(body, prefix);
        const loader = new THREE.TextureLoader();
        const spritePath = body.spriteAsset?.replace(/^assets\//, '');
        const staticSource = spritePath
          ? await loader.loadAsync(`${body.spriteAsset?.startsWith('bosses/') ? new URL('../', import.meta.url).href + body.spriteAsset : assetBase + spritePath}?sheet=3`) : null;
        const frontSources = staticSource ? VISUAL_STATES.map(() => staticSource) : await Promise.all(VISUAL_STATES.map(state =>
          loader.loadAsync(`${spriteBase(prefix)}${prefix}-${state}.png?sheet=3`)));
        const backSources = staticSource ? VISUAL_STATES.map(() => staticSource) : await Promise.all(VISUAL_STATES.map(state =>
          loader.loadAsync(`${spriteBase(prefix)}${prefix}-${state}-back.png?sheet=3`)));
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
            corrugation, body.team === 'player', geometry.shapes, alphaPixels, geometry.smoothingAnchors, geometry.faceShapes);
          model.group.rotation.y = side === 'back' ? Math.PI : 0;
          return installWhiteHitShader({ ...model, texture });
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
          if (!staticSource) { frontSources[index].dispose(); backSources[index].dispose(); }
        }

        if (staticSource) staticSource.dispose();

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

  const createFigure = async function(body, prefix, { deferAttach = false } = {}) {
    const group = new THREE.Group();
    group.visible = !geometryClient || body.team === 'player';
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
    const puckEntry = { base, team: puckTeam };
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
      const seed = damageSeed(body.id);
      const damageContext = { THREE, texture: cardboardDamageTexture, noiseTexture: cardboardVoronoiTexture,
        displacementNoiseTexture: cardboardPerlinTexture, tearNoiseTexture: cardboardTearNoiseTexture,
        settings: getCardboardDamageSettings(), seed, kind: body.team === 'enemy' ? 'enemy' : 'character' };
      const frontArt = cloneSpriteModel(template.frontArt, damageContext), backArt = cloneSpriteModel(template.backArt, { ...damageContext, seed: seed + 187.3 });
      const hoverOutlineMeshes = body.team === 'player'
        ? [createHoverOutline(THREE, frontArt), createHoverOutline(THREE, backArt)].filter(Boolean) : [];
      const artGroup = new THREE.Group(); artGroup.position.y = 1.25;
      artGroup.add(frontArt.group, backArt.group);
      artGroup.visible = false; group.add(artGroup);
      artStates[visualState] = { group: artGroup, frontArt, backArt,
        alphaPixels: frontArt.alphaPixels, width: frontArt.width, height: frontArt.height, hoverOutlineMeshes };
    }
    let enemyOcclusionGhost = null;
    if (body.team === 'enemy') {
      const root = new THREE.Group();
      root.name = `enemy-occlusion:${body.id}`;
      root.visible = false;
      const states = {};
      for (const visualState of VISUAL_STATES) {
        const source = artStates[visualState];
        const frontArt = createEnemyOcclusionArt(THREE, source.frontArt);
        const backArt = createEnemyOcclusionArt(THREE, source.backArt);
        const artGroup = new THREE.Group();
        artGroup.position.copy(source.group.position);
        artGroup.visible = false;
        artGroup.add(frontArt.group, backArt.group);
        root.add(artGroup);
        states[visualState] = { group: artGroup, frontArt, backArt };
      }
      group.add(root);
      enemyOcclusionGhost = { root, states };
    }
    const initialArt = artStates.idle;
    initialArt.group.visible = true;
    initialArt.frontArt.group.visible = true; initialArt.backArt.group.visible = false;

    const healthHUD = new THREE.Group();
    const levels = heartHealthLevels(body.health, body.maxHealth);
    const heartLayout = healthHeartLayout(levels.length);
    const currentLastHeart = levels.reduce((last, level, index) => level > 0 ? index : last, -1);
    const heartIcons = levels.map((level, index) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(HEALTH_HEART_SIZE, HEALTH_HEART_SIZE), heartMaterialVariants.normal[level]);
      markSsaoSpriteAlphaCutout(mesh, heartMaterialVariants.normal[level].map, heartMaterialVariants.normal[level].alphaTest || .04);
      mesh.renderOrder = healthHeartRenderOrder(level, index, currentLastHeart);
      const scale = index === currentLastHeart ? 1.2 : 1;
      mesh.scale.set(scale, scale, 1);
      mesh.position.set(heartLayout.positions[index], 0, .01);
      healthHUD.add(mesh);
      return { mesh, level, currentLast: index === currentLastHeart };
    });
    const statusIndicators = createStatusEffectIndicators(THREE);
    healthHUD.add(statusIndicators.group);
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
    healthHUD.position.set(body.x, 2.65, body.z);
    assignSharpHudLayer(healthHUD);
    let enemyMarker = null;
    if (body.team === 'enemy') {
      enemyMarker = createEnemyMarker(0xdf3830, 0xff887d, true);
      enemyMarker.setSizeScale(body.boss ? 1.5 : 1);
      enemyMarker.group.rotation.y = body.aiAimAngle ?? 0;
      enemyMarker.group.position.set(body.x, groundUiY, body.z);
    }
    const figure = { group, puck: base, prefix, artGroup: initialArt.group, artStates, visualState: 'idle', body,
      alphaPixels: initialArt.alphaPixels, width: initialArt.width, height: initialArt.height,
      healthHUD, heartIcons, chargePips, statusIndicators, enemyMarker, deadGroundedY: assets.deadGroundedY,
      enemyOcclusionGhost,
      flashMaterial: initialArt.frontArt.flashMaterial, backFlashMaterial: initialArt.backArt.flashMaterial,
      hoverOutlineMeshes: Object.values(artStates).flatMap(art => art.hoverOutlineMeshes),
      cardboardDamageMaterials: Object.values(artStates).flatMap(art => [...art.frontArt.damageMaterials, ...art.backArt.damageMaterials]),
      puckEntry, sceneAttached: false,
      viewBack: false, facing: 0, hitAge: 10, hitStrength: 0, hurtAge: 10, dealDamageAge: 10 };
    group.userData.figure = figure;
    group.position.set(body.x, 0, body.z);
    enableFigurePickLayer(group, body.team);
    enemyOcclusionGhost?.root.traverse(object => object.layers.set(0));
    if (!deferAttach) createFigure.attach(figure);
    return figure;
  };
  createFigure.attach = figure => {
    if (!figure || figure.sceneAttached) return figure;
    scene.add(figure.group, figure.healthHUD);
    if (figure.enemyMarker?.group) scene.add(figure.enemyMarker.group);
    unitPucks.add(figure.puckEntry);
    figure.sceneAttached = true;
    return figure;
  };
  createFigure.setCardboardDamage = (settings, texture = cardboardDamageTexture, noiseTexture = cardboardVoronoiTexture,
    tearNoiseTexture = cardboardTearNoiseTexture, displacementNoiseTexture = cardboardPerlinTexture) => {
    cardboardDamageTexture = texture;
    cardboardVoronoiTexture = noiseTexture;
    cardboardTearNoiseTexture = tearNoiseTexture;
    cardboardPerlinTexture = displacementNoiseTexture;
    for (const [key, pending] of artCache) void pending.then(assets => {
      const kind = key.endsWith(':enemy') ? 'enemy' : 'character';
      for (const state of Object.values(assets.states)) for (const side of [state.frontArt, state.backArt])
        bindCardboardDamageTree(side.group, { THREE, texture, noiseTexture, displacementNoiseTexture, tearNoiseTexture, settings, kind });
    });
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
