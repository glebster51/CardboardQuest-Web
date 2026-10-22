const EDGE_SHADER_KEY = 'cardboardquest-terrain-edge-blend-modes-v2';

/** Add two inexpensive color bands to the existing terrace wall shader. */
export function applyTerrainEdgeStyle(root, THREE, settings) {
  root?.traverse(object => {
    if (!object.isMesh || !object.name.startsWith('terrain-top-') || !Array.isArray(object.material)) return;
    const geometry = object.geometry;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const layerDepth = Math.max(.001, geometry.boundingBox.max.y - geometry.boundingBox.min.y);
    for (const material of [object.material[1]]) {
      if (!material.isMeshStandardMaterial) continue;
      const state = material.userData.cqTerrainEdgeStyle ??= {};
      Object.assign(state, settings, { layerDepth });
      if (!state.installed) {
        state.installed = true;
        material.onBeforeCompile = shader => {
          const uniforms = {
            cqTerrainEdgeColor: { value: new THREE.Color(state.edgeColor) },
            cqTerrainBaseColor: { value: new THREE.Color(state.baseColor) },
            cqTerrainEdgeStrength: { value: state.edgeStrength },
            cqTerrainBaseStrength: { value: state.baseStrength },
            cqTerrainEdgeWidth: { value: state.edgeWidth },
            cqTerrainBaseWidth: { value: state.baseWidth },
            cqTerrainLayerDepth: { value: state.layerDepth },
          };
          Object.assign(shader.uniforms, uniforms);
          state.uniforms = uniforms;
          shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nvarying float vCqTerrainLayerHeight;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCqTerrainLayerHeight = position.y;');
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', `#include <common>
varying float vCqTerrainLayerHeight;
uniform vec3 cqTerrainEdgeColor;
uniform vec3 cqTerrainBaseColor;
uniform float cqTerrainEdgeStrength;
uniform float cqTerrainBaseStrength;
uniform float cqTerrainEdgeWidth;
uniform float cqTerrainBaseWidth;
uniform float cqTerrainLayerDepth;`)
            .replace('#include <roughnessmap_fragment>', `float cqLayerHeight = clamp(vCqTerrainLayerHeight / cqTerrainLayerDepth, 0.0, 1.0);
float cqTopEdgeBand = smoothstep(1.0 - cqTerrainEdgeWidth, 1.0 - cqTerrainEdgeWidth * 0.45, cqLayerHeight);
float cqBaseShadeBand = 1.0 - smoothstep(cqTerrainBaseWidth * 0.55, cqTerrainBaseWidth, cqLayerHeight);
float cqBaseMultiply = cqBaseShadeBand * cqTerrainBaseStrength;
diffuseColor.rgb *= mix(vec3(1.0), cqTerrainBaseColor, cqBaseMultiply);
diffuseColor.rgb += cqTerrainEdgeColor * (cqTopEdgeBand * cqTerrainEdgeStrength);
#include <roughnessmap_fragment>`);
        };
        material.customProgramCacheKey = () => EDGE_SHADER_KEY;
        material.needsUpdate = true;
      }
      const uniforms = state.uniforms;
      if (!uniforms) continue;
      uniforms.cqTerrainEdgeColor.value.set(settings.edgeColor);
      uniforms.cqTerrainBaseColor.value.set(settings.baseColor);
      uniforms.cqTerrainEdgeStrength.value = settings.edgeStrength;
      uniforms.cqTerrainBaseStrength.value = settings.baseStrength;
      uniforms.cqTerrainEdgeWidth.value = settings.edgeWidth;
      uniforms.cqTerrainBaseWidth.value = settings.baseWidth;
      uniforms.cqTerrainLayerDepth.value = state.layerDepth;
    }
  });
}
