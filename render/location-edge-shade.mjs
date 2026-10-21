const EDGE_FADE_WIDTH = 4.6;
const MAX_EDGE_MIX = .92;

function distanceToSegment(x, z, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const lengthSquared = dx * dx + dz * dz;
  const t = lengthSquared ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / lengthSquared)) : 0;
  return Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t));
}

function isInsidePolygon(x, z, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if ((a.z > z) !== (b.z > z) && x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

export function locationEdgeShadeAt(x, z, points, fadeWidth = EDGE_FADE_WIDTH) {
  if (points.length < 3) return 1;
  let distance = Infinity;
  for (let index = 0; index < points.length; index++)
    distance = Math.min(distance, distanceToSegment(x, z, points[index], points[(index + 1) % points.length]));
  const signedDistance = isInsidePolygon(x, z, points) ? distance : -distance;
  const t = Math.max(0, Math.min(1, .5 - signedDistance / (fadeWidth * 2)));
  const smooth = t * t * (3 - 2 * t);
  return Math.max(0, Math.min(1, smooth * MAX_EDGE_MIX + (signedDistance < 0 ? 1 - MAX_EDGE_MIX : 0)));
}

export async function createLocationEdgeShade({ THREE, location, resolution = 256, margin = 34, yieldWork = async () => {} }) {
  const points = location.walkablePoints ?? [];
  const bounds = points.reduce((result, point) => ({
    minX: Math.min(result.minX, point.x), maxX: Math.max(result.maxX, point.x),
    minZ: Math.min(result.minZ, point.z), maxZ: Math.max(result.maxZ, point.z),
  }), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity });
  if (!Number.isFinite(bounds.minX) || points.length < 3) return null;
  bounds.minX -= margin; bounds.maxX += margin; bounds.minZ -= margin; bounds.maxZ += margin;
  const width = bounds.maxX - bounds.minX, height = bounds.maxZ - bounds.minZ;
  const data = new Uint8Array(resolution * resolution * 4);
  for (let y = 0; y < resolution; y++) {
    for (let x = 0; x < resolution; x++) {
      const worldX = bounds.minX + (x + .5) / resolution * width;
      const worldZ = bounds.minZ + (y + .5) / resolution * height;
      const shade = Math.round(locationEdgeShadeAt(worldX, worldZ, points) * 255);
      const offset = (y * resolution + x) * 4;
      data[offset] = shade; data[offset + 1] = shade; data[offset + 2] = shade; data[offset + 3] = 255;
    }
    if ((y + 1) % 16 === 0) await yieldWork();
  }
  const texture = new THREE.DataTexture(data, resolution, resolution, THREE.RGBAFormat);
  texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false; texture.needsUpdate = true;
  const uniforms = { cqEdgeShadeMap: { value: texture },
    cqEdgeShadeBounds: { value: new THREE.Vector4(bounds.minX, bounds.minZ, width, height) } };
  const patchMaterial = material => {
    if (!material?.isMeshStandardMaterial || material.userData.locationEdgeShadePatched) return;
    material.userData.locationEdgeShadePatched = true;
    material.userData.locationEdgeShadeTexture = texture;
    const previousCompile = material.onBeforeCompile;
    material.onBeforeCompile = shader => {
      previousCompile?.(shader);
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vCQLocationWorld;')
        .replace('#include <project_vertex>', 'vCQLocationWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#include <project_vertex>');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D cqEdgeShadeMap;\nuniform vec4 cqEdgeShadeBounds;\nvarying vec3 vCQLocationWorld;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          vec2 cqEdgeUv = (vCQLocationWorld.xz - cqEdgeShadeBounds.xy) / cqEdgeShadeBounds.zw;
          float cqEdgeShade = texture2D(cqEdgeShadeMap, cqEdgeUv).r;
          float cqLuma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          vec3 cqMuted = mix(diffuseColor.rgb, vec3(cqLuma), cqEdgeShade * 0.78);
          vec3 cqTwilight = vec3(0.035, 0.026, 0.105) + cqMuted * 0.12;
          diffuseColor.rgb = mix(cqMuted, cqTwilight, cqEdgeShade);`);
    };
    material.customProgramCacheKey = () => 'cq-location-edge-shade-v1';
    material.needsUpdate = true;
  };
  location.sceneGroup.traverse(object => {
    if (!object.isMesh || !/^(playfield|terrain)-top-/.test(object.name)) return;
    for (const material of [object.material].flat()) patchMaterial(material);
  });
  return { texture, bounds, uniforms };
}
