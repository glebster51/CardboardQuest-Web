export const LOCATION_FAR_COLOR = 0x242039;
const FOG_START_DISTANCE = 1.5;
const FOG_END_DISTANCE = 23;

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

export function locationEdgeShadeAt(x, z, points) {
  if (points.length < 3) return 1;
  let distance = Infinity;
  for (let index = 0; index < points.length; index++)
    distance = Math.min(distance, distanceToSegment(x, z, points[index], points[(index + 1) % points.length]));
  const signedDistance = isInsidePolygon(x, z, points) ? distance : -distance;
  const fogDistance = -signedDistance;
  const t = Math.max(0, Math.min(1, (fogDistance - FOG_START_DISTANCE) / (FOG_END_DISTANCE - FOG_START_DISTANCE)));
  const smooth = t * t * (3 - 2 * t);
  return smooth;
}

export function applyLocationEdgeShade(root, patchMaterial) {
  const isScenerySprite = object => {
    for (let parent = object.parent; parent && parent !== root; parent = parent.parent)
      if (parent.name === 'scenery-front' || parent.name === 'scenery-back') return true;
    return false;
  };
  root.traverse(object => {
    if (!object.isMesh) return;
    const scenerySprite = isScenerySprite(object);
    if (!/^(playfield|terrain)-top-/.test(object.name) && !scenerySprite) return;
    const materials = [object.material].flat();
    const patchedMaterials = materials.map(material => {
      if (scenerySprite && material?.isMeshStandardMaterial && !material.userData.locationEdgeShadePatched)
        material = material.clone();
      patchMaterial(material);
      return material;
    });
    if (Array.isArray(object.material)) object.material = patchedMaterials;
    else object.material = patchedMaterials[0];
  });
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
    cqEdgeShadeColor: { value: new THREE.Color(LOCATION_FAR_COLOR) },
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
        .replace('#include <common>', '#include <common>\nuniform sampler2D cqEdgeShadeMap;\nuniform vec3 cqEdgeShadeColor;\nuniform vec4 cqEdgeShadeBounds;\nvarying vec3 vCQLocationWorld;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          vec2 cqEdgeUv = (vCQLocationWorld.xz - cqEdgeShadeBounds.xy) / cqEdgeShadeBounds.zw;
          float cqEdgeShade = texture2D(cqEdgeShadeMap, cqEdgeUv).r;
          float cqLuma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          vec3 cqMuted = mix(diffuseColor.rgb, vec3(cqLuma), cqEdgeShade * 0.78);
          diffuseColor.rgb = cqMuted;`)
        .replace('#include <opaque_fragment>', 'outgoingLight = mix(outgoingLight, cqEdgeShadeColor, cqEdgeShade);\n#include <opaque_fragment>');
    };
    material.customProgramCacheKey = () => 'cq-location-edge-shade-v3';
    material.needsUpdate = true;
  };
  const applyTo = root => applyLocationEdgeShade(root, patchMaterial);
  applyTo(location.sceneGroup);
  return { texture, bounds, uniforms, applyTo };
}
