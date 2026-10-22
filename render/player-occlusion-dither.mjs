export const PLAYER_REVEAL_DEFAULTS = Object.freeze({ revealEnabled: true, revealInnerRadius: 85, revealOuterRadius: 311,
  revealNoiseEnabled: true, revealNoiseType: 'gaussian', revealNoiseSize: 115, revealNoiseShift: 1,
  revealNoiseMultiply: .6, revealNoiseSpeedX: .08, revealNoiseSpeedY: .41, revealCheckerSize: 1,
  revealDepthFadeAdd: .8, revealDepthFadeMultiply: 1.25 });

/** Adds the screen-space dither discard to one opaque scenery shader. */
export function applyPlayerOcclusionDitherShader(shader, uniforms) {
  Object.assign(shader.uniforms, uniforms);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>
      varying float vCQRevealDepth;`)
    .replace('#include <project_vertex>', `#include <project_vertex>
      vCQRevealDepth = -mvPosition.z;`);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>
      uniform float cqRevealEnabled;
      uniform float cqRevealEffectEnabled;
      uniform vec2 cqRevealScreen;
      uniform float cqRevealPlayerDepth;
      uniform float cqRevealInnerRadius;
      uniform float cqRevealOuterRadius;
      uniform float cqRevealDepthFadeAdd;
      uniform float cqRevealDepthFadeMultiply;
      uniform float cqRevealCheckerSize;
      uniform float cqRevealNoiseEnabled;
      uniform float cqRevealNoiseSize;
      uniform float cqRevealNoiseShift;
      uniform float cqRevealNoiseMultiply;
      uniform float cqRevealTime;
      uniform vec2 cqRevealNoiseSpeed;
      uniform sampler2D cqRevealNoiseMap;
      varying float vCQRevealDepth;
      float cqRevealBayer4(vec2 p) {
        vec2 cell = mod(floor(p), 4.0);
        float low = mod(cell.x, 2.0) + 2.0 * mod(cell.y, 2.0);
        float high = mod(floor(cell.x * 0.5) + 2.0 * floor(cell.y * 0.5), 4.0);
        return (low * 4.0 + high + 0.5) / 16.0;
      }`)
    .replace('#include <opaque_fragment>', `
      float cqRevealDistance = length(gl_FragCoord.xy - cqRevealScreen);
      if (cqRevealEnabled > 0.5 && cqRevealEffectEnabled > 0.5 && cqRevealDistance < cqRevealOuterRadius) {
        float cqRevealCoverage = 1.0 - smoothstep(cqRevealInnerRadius, cqRevealOuterRadius, cqRevealDistance);
        if (cqRevealNoiseEnabled > 0.5 && cqRevealDistance > cqRevealInnerRadius) {
          vec2 cqRevealNoiseUv = gl_FragCoord.xy / (cqRevealNoiseSize * 32.0)
            + cqRevealNoiseSpeed * cqRevealTime / 8.0;
          float cqRevealRemappedNoise = texture2D(cqRevealNoiseMap, cqRevealNoiseUv).r * 2.0 - 1.0;
          float cqRevealNoise = (cqRevealRemappedNoise + cqRevealNoiseShift) * cqRevealNoiseMultiply;
          cqRevealCoverage = clamp((cqRevealCoverage + cqRevealNoise) * cqRevealCoverage, 0.0, 1.0);
        }
        float cqRevealDepthInput = (cqRevealPlayerDepth - vCQRevealDepth + cqRevealDepthFadeAdd)
          * cqRevealDepthFadeMultiply;
        float cqRevealDepthFade = smoothstep(0.0, 1.0, clamp(cqRevealDepthInput, 0.0, 1.0));
        cqRevealCoverage *= cqRevealDepthFade;
        vec2 cqRevealPixel = floor(gl_FragCoord.xy / cqRevealCheckerSize);
        float cqRevealChecker = mod(cqRevealPixel.x + cqRevealPixel.y, 2.0);
        float cqRevealThreshold = fract(cqRevealBayer4(cqRevealPixel) + cqRevealChecker * 0.0625);
        if (cqRevealThreshold < cqRevealCoverage) discard;
      }
      #include <opaque_fragment>`);
}

/** Shares a camera-space reveal mask across opaque scenery materials. */
export function createPlayerOcclusionDither(THREE, renderer,
  getRenderPixelRatio = () => renderer.getPixelRatio()) {
  let noiseTexture = null;
  let loadNoiseTexture = null;
  const noiseTextures = new Map();
  if (THREE.TextureLoader) {
    const loader = new THREE.TextureLoader();
    const getNoiseTexture = type => {
      const existing = noiseTextures.get(type);
      if (existing) return existing;
      const name = type === 'gaussian' ? 'player-reveal-gaussian-256.png?v=1' : 'player-reveal-voronoi-256.png?v=1';
      const texture = loader.load(new URL(`../assets/${name}`, import.meta.url).href);
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = true;
      texture.colorSpace = THREE.NoColorSpace;
      noiseTextures.set(type, texture);
      return texture;
    };
    noiseTexture = getNoiseTexture(PLAYER_REVEAL_DEFAULTS.revealNoiseType);
    loadNoiseTexture = getNoiseTexture;
  }
  const uniforms = {
    cqRevealEnabled: { value: 0 },
    cqRevealEffectEnabled: { value: Number(PLAYER_REVEAL_DEFAULTS.revealEnabled) },
    cqRevealScreen: { value: new THREE.Vector2() },
    cqRevealPlayerDepth: { value: 0 },
    cqRevealInnerRadius: { value: PLAYER_REVEAL_DEFAULTS.revealInnerRadius },
    cqRevealOuterRadius: { value: PLAYER_REVEAL_DEFAULTS.revealOuterRadius },
    cqRevealDepthFadeAdd: { value: PLAYER_REVEAL_DEFAULTS.revealDepthFadeAdd },
    cqRevealDepthFadeMultiply: { value: PLAYER_REVEAL_DEFAULTS.revealDepthFadeMultiply },
    cqRevealCheckerSize: { value: PLAYER_REVEAL_DEFAULTS.revealCheckerSize },
    cqRevealNoiseEnabled: { value: Number(PLAYER_REVEAL_DEFAULTS.revealNoiseEnabled) },
    cqRevealNoiseSize: { value: PLAYER_REVEAL_DEFAULTS.revealNoiseSize },
    cqRevealNoiseShift: { value: PLAYER_REVEAL_DEFAULTS.revealNoiseShift },
    cqRevealNoiseMultiply: { value: PLAYER_REVEAL_DEFAULTS.revealNoiseMultiply },
    cqRevealTime: { value: 0 },
    cqRevealNoiseSpeed: { value: new THREE.Vector2(PLAYER_REVEAL_DEFAULTS.revealNoiseSpeedX,
      PLAYER_REVEAL_DEFAULTS.revealNoiseSpeedY) },
    cqRevealNoiseMap: { value: noiseTexture },
  };
  const screen = new THREE.Vector3();
  const viewPosition = new THREE.Vector3();
  const viewport = new THREE.Vector2();
  let innerRadius = PLAYER_REVEAL_DEFAULTS.revealInnerRadius;
  let effectEnabled = PLAYER_REVEAL_DEFAULTS.revealEnabled;
  let outerRadius = PLAYER_REVEAL_DEFAULTS.revealOuterRadius;
  let depthFadeAdd = PLAYER_REVEAL_DEFAULTS.revealDepthFadeAdd;
  let depthFadeMultiply = PLAYER_REVEAL_DEFAULTS.revealDepthFadeMultiply;
  let checkerSize = PLAYER_REVEAL_DEFAULTS.revealCheckerSize;
  let noiseEnabled = PLAYER_REVEAL_DEFAULTS.revealNoiseEnabled;
  let noiseType = PLAYER_REVEAL_DEFAULTS.revealNoiseType;
  let noiseSize = PLAYER_REVEAL_DEFAULTS.revealNoiseSize;
  let noiseShift = PLAYER_REVEAL_DEFAULTS.revealNoiseShift;
  let noiseMultiply = PLAYER_REVEAL_DEFAULTS.revealNoiseMultiply;
  let noiseSpeedX = PLAYER_REVEAL_DEFAULTS.revealNoiseSpeedX;
  let noiseSpeedY = PLAYER_REVEAL_DEFAULTS.revealNoiseSpeedY;
  let appliedPixelRatio = null;
  let appliedZoomScale = null;
  let referencePlayerDepth = null;

  function syncPixelRatio(zoomScale = 1) {
    const devicePixelRatio = renderer.getPixelRatio();
    const renderPixelRatio = getRenderPixelRatio();
    const pixelRatio = Number.isFinite(renderPixelRatio) && renderPixelRatio > 0
      ? renderPixelRatio : devicePixelRatio;
    if (pixelRatio === appliedPixelRatio && zoomScale === appliedZoomScale) return pixelRatio;
    appliedPixelRatio = pixelRatio;
    appliedZoomScale = zoomScale;
    uniforms.cqRevealInnerRadius.value = innerRadius * pixelRatio * zoomScale;
    uniforms.cqRevealOuterRadius.value = outerRadius * pixelRatio * zoomScale;
    uniforms.cqRevealCheckerSize.value = checkerSize * pixelRatio;
    uniforms.cqRevealNoiseSize.value = noiseSize * pixelRatio * zoomScale;
    return pixelRatio;
  }

  function updateSettings(settings = {}) {
    effectEnabled = settings.revealEnabled ?? effectEnabled;
    innerRadius = settings.revealInnerRadius ?? innerRadius;
    outerRadius = settings.revealOuterRadius ?? outerRadius;
    depthFadeAdd = settings.revealDepthFadeAdd ?? depthFadeAdd;
    depthFadeMultiply = settings.revealDepthFadeMultiply ?? depthFadeMultiply;
    checkerSize = settings.revealCheckerSize ?? checkerSize;
    noiseEnabled = settings.revealNoiseEnabled ?? noiseEnabled;
    noiseType = settings.revealNoiseType ?? noiseType;
    noiseSize = settings.revealNoiseSize ?? noiseSize;
    noiseShift = settings.revealNoiseShift ?? noiseShift;
    noiseMultiply = settings.revealNoiseMultiply ?? noiseMultiply;
    noiseSpeedX = settings.revealNoiseSpeedX ?? noiseSpeedX;
    noiseSpeedY = settings.revealNoiseSpeedY ?? noiseSpeedY;
    uniforms.cqRevealNoiseEnabled.value = noiseEnabled ? 1 : 0;
    uniforms.cqRevealEffectEnabled.value = effectEnabled ? 1 : 0;
    uniforms.cqRevealDepthFadeAdd.value = depthFadeAdd;
    uniforms.cqRevealDepthFadeMultiply.value = depthFadeMultiply;
    if (loadNoiseTexture) uniforms.cqRevealNoiseMap.value = loadNoiseTexture(noiseType);
    uniforms.cqRevealNoiseShift.value = noiseShift;
    uniforms.cqRevealNoiseMultiply.value = noiseMultiply;
    uniforms.cqRevealNoiseSpeed.value.set(noiseSpeedX, noiseSpeedY);
    appliedPixelRatio = null;
    syncPixelRatio();
  }

  function update(camera, playerPosition, enabled = true,
    timeSeconds = globalThis.performance ? globalThis.performance.now() / 1000 : 0) {
    uniforms.cqRevealTime.value = timeSeconds;
    camera.updateMatrixWorld();
    screen.copy(playerPosition).project(camera);
    viewPosition.copy(playerPosition).applyMatrix4(camera.matrixWorldInverse);
    const playerDepth = -viewPosition.z;
    if (Number.isFinite(playerDepth) && playerDepth > 0) {
      referencePlayerDepth ??= playerDepth;
    }
    // Under a perspective camera the on-screen height of a fixed-size sprite
    // is inversely proportional to its camera-space depth.
    const zoomScale = referencePlayerDepth && playerDepth > 0 ? referencePlayerDepth / playerDepth : 1;
    renderer.getDrawingBufferSize(viewport);
    const renderPixelRatio = syncPixelRatio(zoomScale);
    const renderScale = renderPixelRatio / renderer.getPixelRatio();
    viewport.set(viewport.x * renderScale, viewport.y * renderScale);
    const visible = enabled && viewPosition.z < 0 && screen.z >= -1 && screen.z <= 1
      && Math.abs(screen.x) <= 1 && Math.abs(screen.y) <= 1;
    uniforms.cqRevealEnabled.value = visible ? 1 : 0;
    if (!visible) return;
    uniforms.cqRevealScreen.value.set((screen.x * .5 + .5) * viewport.x,
      (screen.y * .5 + .5) * viewport.y);
    uniforms.cqRevealPlayerDepth.value = playerDepth;
  }

  return { uniforms, update, updateSettings };
}
