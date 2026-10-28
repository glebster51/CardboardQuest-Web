import { applyPlayerOcclusionDitherShader } from './render/player-occlusion-dither.mjs?v=7c14a71de3a9af87';

export const CARDBOARD_DAMAGE_DEFAULTS = Object.freeze({
  corrugationSize: 1,
  tornTextureSize: 1,
  tearNoiseOffset: 0,
  dentStrength: .28,
  wrinkleScale: 14,
  wrinkleStrength: .22,
  depthOffset: .035,
  tornDissolve: .42,
  exposedCardboard: .78,
  darken: .1,
  dentAtHealth: .65,
  tearAtHealth: .3,
  hitPoints: 3,
  fallDuration: .42,
});

export const CARDBOARD_DAMAGE_STAGE_PRESETS = Object.freeze({
  intact: Object.freeze(['corrugationSize']),
  dented: Object.freeze(['corrugationSize', 'dentStrength', 'wrinkleScale', 'wrinkleStrength', 'depthOffset', 'darken']),
  torn: Object.freeze(['corrugationSize', 'tornTextureSize', 'tearNoiseOffset', 'dentStrength', 'wrinkleScale', 'wrinkleStrength',
    'depthOffset', 'tornDissolve', 'exposedCardboard', 'darken']),
});
const stageNames = ['intact', 'dented', 'torn'];

const ranges = Object.freeze({
  corrugationSize: [.25, 4],
  tornTextureSize: [.25, 4],
  tearNoiseOffset: [-1, 1],
  dentStrength: [0, 1], wrinkleScale: [2, 48], wrinkleStrength: [0, 1], depthOffset: [0, .2],
  tornDissolve: [0, .9], exposedCardboard: [0, 1], darken: [0, .5], dentAtHealth: [.05, .95],
  tearAtHealth: [0, .9], hitPoints: [3, 3], fallDuration: [.1, 2],
});
const stateVariantData = new WeakMap();
const isFlatCardboardFace = object => object.name === 'cardboard-front' || object.name === 'cardboard-back';
const isDamageCardboardSurface = object => ['cardboard-front', 'cardboard-back', 'cardboard-side'].includes(object.name);
export const ENEMY_DAMAGE_STENCIL_MASK = 0x0c;
export const CARDBOARD_OCCLUSION_STENCIL_BIT = 0x02;
export function cardboardDamageStencilValue(kind, stage) {
  const index = Math.max(0, Math.min(2, Math.round(stage)));
  return kind === 'enemy' ? [0x04, 0x08, 0x0c][index] : 0;
}

export function normalizeCardboardDamageSettings(settings = {}) {
  const { stagePresets: inputPresets = {}, ...flatSettings } = settings;
  const normalized = { ...CARDBOARD_DAMAGE_DEFAULTS, ...flatSettings };
  // There are three authored visuals: intact, dented, and torn. Each prop hit
  // advances exactly one state, and the next hit destroys it.
  normalized.hitPoints = CARDBOARD_DAMAGE_DEFAULTS.hitPoints;
  for (const [key, [min, max]] of Object.entries(ranges)) {
    if (!Number.isFinite(normalized[key]) || normalized[key] < min || normalized[key] > max)
      throw new Error(`Invalid cardboard damage setting: ${key}`);
  }
  if (normalized.tearAtHealth >= normalized.dentAtHealth) throw new Error('Tear threshold must be below dent threshold');
  if (!inputPresets || typeof inputPresets !== 'object' || Array.isArray(inputPresets)
    || Object.keys(inputPresets).some(name => !stageNames.includes(name))) throw new Error('Invalid cardboard damage presets');
  normalized.stagePresets = Object.fromEntries(stageNames.map(name => {
    const overrides = inputPresets[name] ?? {};
    if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)
      || Object.keys(overrides).some(key => !CARDBOARD_DAMAGE_STAGE_PRESETS[name].includes(key)))
      throw new Error(`Invalid cardboard damage preset: ${name}`);
    const preset = Object.fromEntries(CARDBOARD_DAMAGE_STAGE_PRESETS[name].map(key => [key, normalized[key]]));
    for (const [key, value] of Object.entries(overrides)) {
      const [min, max] = ranges[key];
      if (!Number.isFinite(value) || value < min || value > max) throw new Error(`Invalid cardboard damage setting: ${key}`);
      preset[key] = value;
    }
    return [name, preset];
  }));
  return normalized;
}

export function cardboardDamageSettingsForStage(settings = CARDBOARD_DAMAGE_DEFAULTS, stage = 0) {
  const normalized = normalizeCardboardDamageSettings(settings);
  const name = stageNames[Math.max(0, Math.min(2, Math.round(stage)))];
  return { ...normalized, ...normalized.stagePresets[name] };
}

export function cardboardDamageStageForHealth(health, maxHealth, settings = CARDBOARD_DAMAGE_DEFAULTS) {
  const ratio = maxHealth > 0 ? Math.max(0, health / maxHealth) : 1;
  return ratio <= settings.tearAtHealth ? 2 : ratio <= settings.dentAtHealth ? 1 : 0;
}

export function cardboardPropDamageStageForHealth(health, maxHealth) {
  if (!Number.isFinite(health) || !Number.isFinite(maxHealth) || maxHealth <= 0) return 0;
  return Math.min(2, Math.max(0, Math.floor(maxHealth - Math.max(0, health) + 1e-6)));
}

export function applyCardboardPropHit(target) {
  if (!target || !Number.isFinite(target.health) || target.health <= 0) return false;
  target.health = Math.max(0, Math.round(target.health) - 1);
  return true;
}

function updateDamageStencil(material, state, THREE = {}) {
  if (state.kind !== 'enemy') return;
  // A visible enemy surface must erase a cardboard marker left by a prop
  // behind it, regardless of which opaque mesh was submitted first.
  const stageMask = ENEMY_DAMAGE_STENCIL_MASK | CARDBOARD_OCCLUSION_STENCIL_BIT;
  material.stencilWrite = true;
  material.stencilRef = cardboardDamageStencilValue(state.kind, state.stage);
  material.stencilFunc = THREE.AlwaysStencilFunc ?? 519;
  material.stencilFuncMask = 0xff;
  material.stencilWriteMask = stageMask;
  material.stencilFail = THREE.KeepStencilOp ?? 7680;
  material.stencilZFail = THREE.KeepStencilOp ?? 7680;
  material.stencilZPass = THREE.ReplaceStencilOp ?? 7681;
  material.userData.cardboardDamageStencilMask = stageMask;
  material.userData.cardboardDamageStencilValue = cardboardDamageStencilValue(state.kind, state.stage);
}

function createStateVariant(material, { THREE, texture, noiseTexture, displacementNoiseTexture, tearNoiseTexture, settings = CARDBOARD_DAMAGE_DEFAULTS,
  stage = 0, seed = 0, tornSurface = true, kind = 'character', revealUniforms = null } = {}) {
  let state = stateVariantData.get(material);
  if (!state) {
    state = { THREE, settings: normalizeCardboardDamageSettings(settings), stage: 0, seed, kind,
      tornSurface, revealUniforms, baseColor: material.color?.clone?.() ?? null,
      texture, noiseTexture: noiseTexture ?? texture, displacementNoiseTexture: displacementNoiseTexture ?? noiseTexture ?? texture,
      tearNoiseTexture: tearNoiseTexture ?? texture, uniforms: tornSurface ? {
        cqWrinkleScale: { value: settings.wrinkleScale }, cqTornDissolve: { value: settings.tornDissolve },
        cqExposedCardboard: { value: settings.exposedCardboard }, cqDamageSeed: { value: seed },
        cqTearNoiseOffset: { value: settings.tearNoiseOffset },
        cqTornTextureSize: { value: settings.tornTextureSize },
        cqTornMap: { value: texture }, cqTearNoiseMap: { value: tearNoiseTexture ?? noiseTexture ?? texture },
      } : { cqCorrugationSize: { value: settings.corrugationSize } } };
    stateVariantData.set(material, state);
    if (!material.userData.cardboardDamageShaderPatched) {
      const previousCompile = material.onBeforeCompile;
      const previousKey = material.customProgramCacheKey;
      material.onBeforeCompile = function (shader, renderer) {
        previousCompile?.call(this, shader, renderer);
        const active = stateVariantData.get(this);
        if (!active) return;
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>',
          `#include <common>\n#define CQ_CARDBOARD_STAGE_${active.stage} 1`);
        if (!active.tornSurface) {
          Object.assign(shader.uniforms, active.uniforms);
          shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nuniform float cqCorrugationSize;')
            .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv = (vMapUv - vec2(0.5)) / max(cqCorrugationSize, 0.001) + vec2(0.5);\n#endif');
        } else if (active.stage === 2) {
          Object.assign(shader.uniforms, active.uniforms);
          shader.vertexShader = shader.vertexShader
            .replace('#include <common>', `#include <common>\nvarying vec2 vCqDamageUv;`)
            .replace('#include <uv_vertex>', `#include <uv_vertex>\nvCqDamageUv = uv;`);
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', `#include <common>\nuniform float cqWrinkleScale;\nuniform float cqTornDissolve;\nuniform float cqExposedCardboard;\nuniform float cqTearNoiseOffset;\nuniform float cqTornTextureSize;\nuniform float cqDamageSeed;\nuniform sampler2D cqTornMap;\nuniform sampler2D cqTearNoiseMap;\nvarying vec2 vCqDamageUv;\nfloat cqCrystal(vec2 uv){return texture2D(cqTearNoiseMap,uv+vec2(cqDamageSeed*.013,cqDamageSeed*.037)).r;}\nvec3 cqTornLinear(vec3 color){return pow(max(color,vec3(0.0)),vec3(2.2));}`)
            .replace('#include <color_fragment>', `#include <color_fragment>\nfloat cqTornNoise=clamp(cqCrystal(vCqDamageUv*(cqWrinkleScale*.065)+vec2(cqDamageSeed))+cqTearNoiseOffset,0.0,1.0);\nfloat cqBlendWidth=max(.04,cqTornDissolve);\nfloat cqTornBlend=smoothstep(.5-cqBlendWidth*.5,.5+cqBlendWidth*.5,cqTornNoise)*cqExposedCardboard;\nvec2 cqTornUv=(vCqDamageUv-vec2(.5))/max(cqTornTextureSize,.001)+vec2(.5);\nvec4 cqTorn=texture2D(cqTornMap,cqTornUv*vec2(.94,.94)+vec2(.03,.03));\ndiffuseColor.rgb=mix(diffuseColor.rgb,cqTornLinear(cqTorn.rgb),clamp(cqTornBlend,0.0,1.0));`);
        }
        if (active.kind === 'environment' && active.revealUniforms)
          applyPlayerOcclusionDitherShader(shader, active.revealUniforms);
      };
      material.customProgramCacheKey = function () {
        const active = stateVariantData.get(this);
        return `${previousKey?.call(this) ?? ''}|cq-cardboard-${active?.kind ?? kind}-${active?.tornSurface ? 'face' : 'side'}-state-${active?.stage ?? stage}-v12`;
      };
      material.userData.cardboardDamageShaderPatched = true;
    }
  }
  state.THREE = THREE ?? state.THREE;
  state.tearNoiseTexture = tearNoiseTexture ?? state.tearNoiseTexture;
  state.kind = kind ?? state.kind;
  state.tornSurface = tornSurface;
  state.revealUniforms = revealUniforms ?? state.revealUniforms;
  if (settings) state.settings = normalizeCardboardDamageSettings({ ...state.settings, ...settings });
  if (texture) { state.texture = texture; if (state.uniforms?.cqTornMap) state.uniforms.cqTornMap.value = texture; }
  if (tearNoiseTexture) { state.tearNoiseTexture = tearNoiseTexture; if (state.uniforms?.cqTearNoiseMap) state.uniforms.cqTearNoiseMap.value = tearNoiseTexture; }
  if (noiseTexture) state.noiseTexture = noiseTexture;
  if (displacementNoiseTexture) state.displacementNoiseTexture = displacementNoiseTexture;
  if (state.uniforms) {
    if (!state.tornSurface) state.uniforms.cqCorrugationSize.value = state.settings.corrugationSize;
    else {
      state.uniforms.cqWrinkleScale.value = state.settings.wrinkleScale;
      state.uniforms.cqTornDissolve.value = state.settings.tornDissolve;
      state.uniforms.cqExposedCardboard.value = state.settings.exposedCardboard;
      state.uniforms.cqTearNoiseOffset.value = state.settings.tearNoiseOffset;
      state.uniforms.cqTornTextureSize.value = state.settings.tornTextureSize;
    }
  }
  const nextStage = Math.max(0, Math.min(2, Math.round(stage)));
  if (state.stage !== nextStage) { state.stage = nextStage; material.needsUpdate = true; }
  material.userData.cardboardDamage = true;
  material.userData.cardboardDamageKind = state.kind;
  updateDamageStencil(material, state, state.THREE);
  if (state.baseColor && material.color?.copy)
    material.color.copy(state.baseColor).multiplyScalar(1 - state.settings.darken * state.stage);
  return material;
}

export function applyCardboardDamageMaterial(material, { THREE, texture, noiseTexture, displacementNoiseTexture, tearNoiseTexture, settings = CARDBOARD_DAMAGE_DEFAULTS,
  stage = 0, seed = 0, tornSurface = true, kind = 'character', revealUniforms = null } = {}) {
  if (!material?.isMeshStandardMaterial) return material;
  return createStateVariant(material, { THREE, texture, noiseTexture, displacementNoiseTexture, tearNoiseTexture, settings, stage, seed, tornSurface, kind, revealUniforms });
}

export function updateCardboardDamageMaterial(material, { settings, stage, texture, noiseTexture, displacementNoiseTexture, tearNoiseTexture } = {}) {
  const variant = material && stateVariantData.get(material);
  if (variant) {
    if (settings) variant.settings = normalizeCardboardDamageSettings({ ...variant.settings, ...settings });
    if (stage !== undefined) {
      const nextStage = Math.max(0, Math.min(2, Math.round(stage)));
      if (nextStage !== variant.stage) { variant.stage = nextStage; material.needsUpdate = true; }
    }
    if (texture) { variant.texture = texture; if (variant.uniforms?.cqTornMap) variant.uniforms.cqTornMap.value = texture; }
    if (tearNoiseTexture) { variant.tearNoiseTexture = tearNoiseTexture; if (variant.uniforms?.cqTearNoiseMap) variant.uniforms.cqTearNoiseMap.value = tearNoiseTexture; }
    if (noiseTexture) variant.noiseTexture = noiseTexture;
    if (displacementNoiseTexture) variant.displacementNoiseTexture = displacementNoiseTexture;
    if (variant.uniforms) {
      if (!variant.tornSurface) variant.uniforms.cqCorrugationSize.value = variant.settings.corrugationSize;
      else {
        variant.uniforms.cqWrinkleScale.value = variant.settings.wrinkleScale;
        variant.uniforms.cqTornDissolve.value = variant.settings.tornDissolve;
        variant.uniforms.cqExposedCardboard.value = variant.settings.exposedCardboard;
        variant.uniforms.cqTearNoiseOffset.value = variant.settings.tearNoiseOffset;
        variant.uniforms.cqTornTextureSize.value = variant.settings.tornTextureSize;
      }
    }
    updateDamageStencil(material, variant, variant.THREE);
    if (variant.baseColor && material.color?.copy)
      material.color.copy(variant.baseColor).multiplyScalar(1 - variant.settings.darken * variant.stage);
    return;
  }
}

export function updateCardboardDamageTree(root, options = {}) {
  root?.traverse(object => {
    if (!object.isMesh || !isDamageCardboardSurface(object)) return;
    const material = [object.material].flat().find(item => item && stateVariantData.has(item));
    const stage = options.stage ?? stateVariantData.get(material)?.stage ?? meshDamageData.get(object)?.stage ?? 0;
    const settings = cardboardDamageSettingsForStage(options.settings ?? CARDBOARD_DAMAGE_DEFAULTS, stage);
    const stageOptions = { ...options, stage, settings };
    updateCardboardDamageGeometry(object, stageOptions);
    for (const material of [object.material].flat()) {
      if (material && stateVariantData.has(material)) updateCardboardDamageMaterial(material, stageOptions);
      else applyCardboardDamageMaterial(material, { ...stageOptions, kind: object.userData.cardboardDamageKind ?? options.kind,
        revealUniforms: object.userData.cardboardRevealUniforms ?? options.revealUniforms,
        tornSurface: isFlatCardboardFace(object) });
    }
  });
}

const meshDamageData = new WeakMap();
export function bindCardboardDamageTree(root, options = {}) {
  const materials = [];
  const stage = options.stage ?? 0;
  const settings = cardboardDamageSettingsForStage(options.settings ?? CARDBOARD_DAMAGE_DEFAULTS, stage);
  const stageOptions = { ...options, stage, settings };
  root?.traverse(object => {
    if (!object.isMesh || !isDamageCardboardSurface(object)) return;
    object.userData.cardboardSurface = true;
    object.userData.cardboardDamageKind = options.kind ?? object.userData.cardboardDamageKind ?? 'character';
    if (options.revealUniforms) object.userData.cardboardRevealUniforms = options.revealUniforms;
    if (['cardboard-side', 'cardboard-front', 'cardboard-back'].includes(object.name) && object.geometry && !meshDamageData.has(object)) {
      object.geometry = object.geometry.clone();
      meshDamageData.set(object, { basePositions: object.geometry.attributes.position.array.slice(),
        seed: options.seed ?? 0, THREE: options.THREE, noiseTexture: options.noiseTexture,
        displacementNoiseTexture: options.displacementNoiseTexture, tearNoiseTexture: options.tearNoiseTexture, stage: 0, signature: null,
        worldWidth: object.userData.cardboardDamageWorldWidth, worldHeight: object.userData.cardboardDamageWorldHeight });
    }
    const meshState = meshDamageData.get(object);
    if (meshState && options.noiseTexture) meshState.noiseTexture = options.noiseTexture;
    if (meshState && options.displacementNoiseTexture) meshState.displacementNoiseTexture = options.displacementNoiseTexture;
    if (meshState && options.tearNoiseTexture) meshState.tearNoiseTexture = options.tearNoiseTexture;
    for (const material of [object.material].flat()) {
      applyCardboardDamageMaterial(material, { ...stageOptions, kind: object.userData.cardboardDamageKind,
        revealUniforms: object.userData.cardboardRevealUniforms, tornSurface: isFlatCardboardFace(object) });
      if (material?.userData?.cardboardDamage) materials.push(material);
    }
    updateCardboardDamageGeometry(object, stageOptions);
  });
  return materials;
}

const voronoiPixels = new WeakMap();
function readVoronoiPixels(texture) {
  if (!texture?.image) return null;
  if (voronoiPixels.has(texture)) return voronoiPixels.get(texture);
  const image = texture.image;
  if (!(image.complete === undefined || image.complete) || !(image.naturalWidth || image.width)) return null;
  const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth || image.width; canvas.height = image.naturalHeight || image.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  try {
    context.drawImage(image, 0, 0); const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const result = { pixels, width: canvas.width, height: canvas.height }; voronoiPixels.set(texture, result); return result;
  } catch { return null; }
}

function damageNoise(x, y, seed, bakedNoise) {
  if (bakedNoise) {
    const wrap = value => ((value % 1) + 1) % 1;
    const px = wrap(x) * bakedNoise.width - .5, py = wrap(y) * bakedNoise.height - .5;
    const x0 = Math.floor(px), y0 = Math.floor(py), tx = px - x0, ty = py - y0;
    const sample = (sx, sy) => {
      const ix = ((sx % bakedNoise.width) + bakedNoise.width) % bakedNoise.width;
      const iy = ((sy % bakedNoise.height) + bakedNoise.height) % bakedNoise.height;
      return bakedNoise.pixels[(iy * bakedNoise.width + ix) * 4] / 255;
    };
    const top = sample(x0, y0) * (1 - tx) + sample(x0 + 1, y0) * tx;
    const bottom = sample(x0, y0 + 1) * (1 - tx) + sample(x0 + 1, y0 + 1) * tx;
    return top * (1 - ty) + bottom * ty;
  }
  const hash = (a, b) => { const value = Math.sin(a * 127.1 + b * 311.7 + seed * 19.19) * 43758.5453; return value - Math.floor(value); };
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  let first = 1, second = 1;
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    const px = ox + hash(ix + ox, iy + oy) * .82 + .09 - fx;
    const py = oy + hash(ix + ox + 19.19, iy + oy + 7.13) * .82 + .09 - fy;
    const distance = Math.hypot(px, py);
    if (distance < first) { second = first; first = distance; } else if (distance < second) second = distance;
  }
  return Math.max(0, Math.min(1, (second - first) * 2.1));
}

/** Bake dent offsets into side-wall vertices only when a damage stage changes. */
function updateCardboardDamageGeometry(mesh, options = {}) {
  const meshState = meshDamageData.get(mesh), base = meshState?.basePositions, position = mesh.geometry?.attributes?.position;
  if (!base || !position) return;
  const stage = options.stage === undefined ? meshState.stage : Math.max(0, Math.min(2, Math.round(options.stage)));
  const settings = normalizeCardboardDamageSettings({ ...CARDBOARD_DAMAGE_DEFAULTS, ...options.settings });
  const seed = meshState.seed;
  const signature = `${stage}:${settings.dentStrength}:${settings.depthOffset}:${settings.wrinkleScale}:${settings.tornDissolve}:${settings.tearNoiseOffset}:${settings.exposedCardboard}:${seed}`;
  if (meshState.signature === signature) return;
  meshState.signature = signature; meshState.stage = stage;
  const positions = position.array;
  const THREE = options.THREE ?? meshState.THREE;
  let colors = mesh.geometry.attributes.color;
  if (!colors && THREE?.Float32BufferAttribute) {
    colors = new THREE.Float32BufferAttribute(new Float32Array(positions.length), 3);
    mesh.geometry.setAttribute('color', colors);
  }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < base.length; i += 3) { minX = Math.min(minX, base[i]); maxX = Math.max(maxX, base[i]); minY = Math.min(minY, base[i + 1]); maxY = Math.max(maxY, base[i + 1]); }
  const bakedNoise = readVoronoiPixels(options.displacementNoiseTexture ?? meshState.displacementNoiseTexture
    ?? options.noiseTexture ?? meshState.noiseTexture);
  const tornMask = readVoronoiPixels(options.tearNoiseTexture ?? meshState.tearNoiseTexture);
  const maskScale = settings.wrinkleScale * .065;
  const maskWidth = Math.max(.04, settings.tornDissolve);
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] = base[i]; positions[i + 1] = base[i + 1];
    const u = meshState.worldWidth ? (base[i] / meshState.worldWidth + .5) * 14 + seed * .013
      : (base[i] - minX) / Math.max(1e-6, maxX - minX) * 14 + seed * .013;
    const v = meshState.worldHeight ? (base[i + 1] / meshState.worldHeight + .5) * 14 + seed * .037
      : (base[i + 1] - minY) / Math.max(1e-6, maxY - minY) * 14 + seed * .037;
    const noise = damageNoise(u, v, seed, bakedNoise);
    let tearMask = 1;
    if (tornMask) {
      // Use artwork-space coordinates for caps and sidewalls alike, so dents
      // stay registered to the noise pattern revealing the torn paper.
      const textureU = (base[i] / (meshState.worldWidth || Math.max(1e-6, maxX - minX)) + .5) * maskScale + seed * 1.013;
      const textureV = (base[i + 1] / (meshState.worldHeight || Math.max(1e-6, maxY - minY)) + .5) * maskScale + seed * 1.037;
      const reveal = damageNoise(textureU, textureV, seed, tornMask) + settings.tearNoiseOffset;
      const lower = .5 - maskWidth * .5, upper = .5 + maskWidth * .5;
      const t = Math.max(0, Math.min(1, (reveal - lower) / Math.max(1e-6, upper - lower)));
      tearMask = t * t * (3 - 2 * t) * settings.exposedCardboard;
    }
    positions[i + 2] = base[i + 2] + (stage ? (noise - .45) * tearMask * settings.depthOffset * settings.dentStrength * stage : 0);
    if (colors) {
      const shade = stage ? (1 - settings.darken * stage) * (1 + (Math.abs(noise - .48) - .18) * settings.wrinkleStrength * stage) : 1;
      colors.array[i] = colors.array[i + 1] = colors.array[i + 2] = Math.max(.1, shade);
    }
  }
  position.needsUpdate = true; if (colors) colors.needsUpdate = true;
  mesh.geometry.computeVertexNormals?.(); mesh.geometry.computeBoundingSphere();
}
