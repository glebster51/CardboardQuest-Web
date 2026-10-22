export const HEX_BOKEH_DIRECTIONS = Object.freeze([
  [1, 0], [0.5, Math.sqrt(3) / 2], [-0.5, Math.sqrt(3) / 2],
  [-1, 0], [-0.5, -Math.sqrt(3) / 2], [0.5, -Math.sqrt(3) / 2],
]);

export function tiltShiftRenderPixelRatio(rendererPixelRatio, isCoarsePointer = false) {
  return Math.min(rendererPixelRatio, isCoarsePointer ? 1.5 : 2);
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
    float signedDistanceFromFocus = vUv.y - focus;
    float distanceFromFocus = signedDistanceFromFocus >= 0.0
      ? max(0.0, signedDistanceFromFocus - upperGradientShift)
      : max(0.0, -signedDistanceFromFocus - lowerGradientShift);
    float blurAmount = clamp(smoothstep(0.035, 0.24, distanceFromFocus) * gradientMultiplier, 0.0, 1.0);
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
