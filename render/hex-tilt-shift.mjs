import { MOBILE_RENDER_PIXEL_RATIO_CAP, MOBILE_POST_EFFECT_SCALE } from '../game/frame-rate.mjs';
export { MOBILE_POST_EFFECT_SCALE };

export const HEX_BOKEH_DIRECTIONS = Object.freeze([
  [1, 0], [0.5, Math.sqrt(3) / 2], [-0.5, Math.sqrt(3) / 2],
  [-1, 0], [-0.5, -Math.sqrt(3) / 2], [0.5, -Math.sqrt(3) / 2],
]);

export function createPostEffectInputShader() {
  return {
    uniforms: { tDiffuse: { value: null }, sharpTexture: { value: null } },
    vertexShader,
    fragmentShader: /* glsl */`
      uniform sampler2D sharpTexture;
      varying vec2 vUv;
      void main() { gl_FragColor = texture2D(sharpTexture, vUv); }
    `,
  };
}

export function tiltShiftRenderPixelRatio(rendererPixelRatio, isMobile = false) {
  return isMobile
    ? Math.min(rendererPixelRatio, MOBILE_RENDER_PIXEL_RATIO_CAP) * MOBILE_POST_EFFECT_SCALE
    : Math.min(rendererPixelRatio, 2);
}

export const tiltShiftGradientGLSL = /* glsl */`
  float tiltShiftGradient(vec2 uv, float focus, float upperGradientShift,
      float lowerGradientShift, float gradientMultiplier) {
    float signedDistanceFromFocus = uv.y - focus;
    float distanceFromFocus = signedDistanceFromFocus >= 0.0
      ? max(0.0, signedDistanceFromFocus - upperGradientShift)
      : max(0.0, -signedDistanceFromFocus - lowerGradientShift);
    return smoothstep(0.035, 0.24, distanceFromFocus) * gradientMultiplier;
  }
`;

export function createTiltShiftCompositeShader() {
  return {
    uniforms: {
      tDiffuse: { value: null },
      sharpTexture: { value: null },
      focus: { value: 0.48 },
      upperGradientShift: { value: 0 },
      lowerGradientShift: { value: 0 },
      gradientMultiplier: { value: 1 },
      tiltShiftActive: { value: true },
      showGradient: { value: false },
    },
    vertexShader,
    fragmentShader: /* glsl */`
      uniform sampler2D tDiffuse;
      uniform sampler2D sharpTexture;
      uniform float focus;
      uniform float upperGradientShift;
      uniform float lowerGradientShift;
      uniform float gradientMultiplier;
      uniform bool tiltShiftActive;
      uniform bool showGradient;
      varying vec2 vUv;
      ${tiltShiftGradientGLSL}
      void main() {
        vec4 sharp = texture2D(sharpTexture, vUv);
        vec4 processed = texture2D(tDiffuse, vUv);
        float mask = tiltShiftActive
          ? tiltShiftGradient(vUv, focus, upperGradientShift, lowerGradientShift, gradientMultiplier)
          : 1.0;
        if (showGradient) mask = 1.0;
        gl_FragColor = mix(sharp, processed, mask);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  };
}

const vertexShader = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */`
  uniform sampler2D tDiffuse;
  uniform float focus;
  uniform float blurPixels;
  uniform float upperGradientShift;
  uniform float lowerGradientShift;
  uniform float gradientMultiplier;
  uniform bool showGradient;
  uniform float pixelRatio;
  uniform vec2 resolution;
  varying vec2 vUv;
  ${tiltShiftGradientGLSL}

  vec4 sampleHexRing(float radiusPixels) {
    vec2 r = vec2(radiusPixels) / resolution;
    const float HALF_ROOT_THREE = 0.8660254038;
    vec4 color = vec4(0.0);
    color += texture2D(tDiffuse, vUv + vec2( r.x, 0.0));
    color += texture2D(tDiffuse, vUv + vec2( r.x * 0.5,  r.y * HALF_ROOT_THREE));
    color += texture2D(tDiffuse, vUv + vec2(-r.x * 0.5,  r.y * HALF_ROOT_THREE));
    color += texture2D(tDiffuse, vUv + vec2(-r.x, 0.0));
    color += texture2D(tDiffuse, vUv + vec2(-r.x * 0.5, -r.y * HALF_ROOT_THREE));
    color += texture2D(tDiffuse, vUv + vec2( r.x * 0.5, -r.y * HALF_ROOT_THREE));
    return color / 6.0;
  }

  void main() {
    vec4 sharp = texture2D(tDiffuse, vUv);
    float blurAmount = tiltShiftGradient(vUv, focus, upperGradientShift, lowerGradientShift, gradientMultiplier);
    if (showGradient) {
      gl_FragColor = vec4(vec3(blurAmount), 1.0);
      return;
    }
    if (blurAmount < 0.002 || blurPixels < 0.1) {
      gl_FragColor = sharp;
      return;
    }
    float radiusPixels = blurPixels * pixelRatio * blurAmount;
    vec4 hexBokeh = sampleHexRing(radiusPixels);
    gl_FragColor = mix(sharp, hexBokeh, blurAmount);
  }
`;

export function createHexTiltShiftShader(THREE) {
  return {
    uniforms: {
      tDiffuse: { value: null },
      focus: { value: 0.48 },
      blurPixels: { value: 12 },
      upperGradientShift: { value: 0 },
      lowerGradientShift: { value: 0 },
      gradientMultiplier: { value: 1 },
      showGradient: { value: false },
      pixelRatio: { value: 1 },
      resolution: { value: new THREE.Vector2(1, 1) },
    },
    vertexShader,
    fragmentShader,
  };
}
