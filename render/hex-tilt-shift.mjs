export const HEX_BOKEH_DIRECTIONS = Object.freeze([
  [1, 0], [0.5, Math.sqrt(3) / 2], [-0.5, Math.sqrt(3) / 2],
  [-1, 0], [-0.5, -Math.sqrt(3) / 2], [0.5, -Math.sqrt(3) / 2],
]);

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
    float radiusPixels = blurPixels * abs(vUv.y - focus);
    vec4 center = texture2D(tDiffuse, vUv);
    vec4 innerHex = sampleHexRing(radiusPixels * 0.5);
    vec4 outerHex = sampleHexRing(radiusPixels);
    gl_FragColor = center * 0.2 + innerHex * 0.35 + outerHex * 0.45;
  }
`;

export function createHexTiltShiftShader(THREE) {
  return {
    uniforms: {
      tDiffuse: { value: null },
      focus: { value: 0.48 },
      blurPixels: { value: 7 },
      resolution: { value: new THREE.Vector2(1, 1) },
    },
    vertexShader,
    fragmentShader,
  };
}
