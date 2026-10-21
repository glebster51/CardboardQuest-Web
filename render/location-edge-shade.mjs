import { FOG_DEFAULTS } from '../fog-settings.mjs?v=2';
export const LOCATION_FAR_COLOR = 0x242039;

function distanceToSegment(x, z, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const lengthSquared = dx * dx + dz * dz;
  const t = lengthSquared ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / lengthSquared)) : 0;
  return Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t));
}

function pathDistanceAt(x, z, paths) {
  let nearest = Infinity;
  for (const path of paths) for (let index = 1; index < path.points.length; index++) {
    const a = path.points[index - 1], b = path.points[index];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const lengthSquared = dx * dx + dz * dz;
    const t = lengthSquared ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / lengthSquared)) : 0;
    nearest = Math.min(nearest, Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t)));
  }
  return nearest;
}

function isInsidePolygon(x, z, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if ((a.z > z) !== (b.z > z) && x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

function locationEdgeDistanceAt(x, z, points) {
  if (points.length < 3) return 1;
  let distance = Infinity;
  for (let index = 0; index < points.length; index++)
    distance = Math.min(distance, distanceToSegment(x, z, points[index], points[(index + 1) % points.length]));
  return isInsidePolygon(x, z, points) ? -distance : distance;
}

function shadeAtDistance(distance, settings) {
  const t = Math.max(0, Math.min(1, (distance - settings.start) / Math.max(.1, settings.end - settings.start)));
  const smooth = t * t * (3 - 2 * t);
  return smooth;
}

export function locationEdgeShadeAt(x, z, points, settings = FOG_DEFAULTS) {
  return points.length < 3 ? 1 : shadeAtDistance(locationEdgeDistanceAt(x, z, points), settings);
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
    const fogSurface = Boolean(object.userData?.locationFogSurface);
    const terrainSurface = /^(playfield|terrain)-top-/.test(object.name);
    if (!terrainSurface && !scenerySprite && !fogSurface) return;
    const reveal = scenerySprite || /^terrain-top-/.test(object.name);
    const materials = [object.material].flat();
    const patchedMaterials = materials.map(material => {
      if ((reveal && (material?.isMeshStandardMaterial || material?.isMeshBasicMaterial)
        || scenerySprite && material?.isMeshStandardMaterial || fogSurface && material?.isMeshBasicMaterial)
        && !material.userData.locationEdgeShadePatched)
        material = material.clone();
      patchMaterial(material, reveal);
      return material;
    });
    if (Array.isArray(object.material)) object.material = patchedMaterials;
    else object.material = patchedMaterials[0];
  });
}

export async function createLocationEdgeShade({ THREE, location, resolution = 256, margin = 34, settings = {}, revealUniforms = {}, yieldWork = async () => {} }) {
  settings = { ...FOG_DEFAULTS, ...settings };
  const points = location.walkablePoints ?? [];
  const paths = location.fogPaths?.paths ?? [];
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
      const offset = (y * resolution + x) * 4;
      const pathShade = paths.length ? Math.round(shadeAtDistance(pathDistanceAt(worldX, worldZ, paths), settings) * 255) : 0;
      data[offset] = pathShade; data[offset + 3] = 255;
    }
    if ((y + 1) % 16 === 0) await yieldWork();
  }
  const texture = new THREE.DataTexture(data, resolution, resolution, THREE.RGBAFormat);
  texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false; texture.needsUpdate = true;
  const uniforms = { cqPathFogMap: { value: texture },
    cqPathFogColor: { value: new THREE.Color(settings.color) },
    cqPathFogTint: { value: settings.tint }, cqPathFogCurve: { value: settings.curve },
    cqPathFogBounds: { value: new THREE.Vector4(bounds.minX, bounds.minZ, width, height) } };
  const patchMaterial = (material, reveal = false) => {
    if ((!material?.isMeshStandardMaterial && !material?.isMeshBasicMaterial) || material.userData.locationEdgeShadePatched) return;
    material.userData.locationEdgeShadePatched = true;
    material.userData.locationEdgeShadeTexture = texture;
    const previousCompile = material.onBeforeCompile;
    material.onBeforeCompile = shader => {
      previousCompile?.(shader);
      Object.assign(shader.uniforms, uniforms, reveal ? revealUniforms : {});
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
          varying vec3 vCQLocationWorld;
          ${reveal ? 'varying float vCQRevealDepth;' : ''}`)
        .replace('#include <project_vertex>', `vCQLocationWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
          #include <project_vertex>
          ${reveal ? 'vCQRevealDepth = -mvPosition.z;' : ''}`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform sampler2D cqPathFogMap;
          uniform vec3 cqPathFogColor;
          uniform float cqPathFogTint;
          uniform float cqPathFogCurve;
          uniform vec4 cqPathFogBounds;
          varying vec3 vCQLocationWorld;
          ${reveal ? `uniform float cqRevealEnabled;
            uniform vec2 cqRevealScreen;
            uniform float cqRevealPlayerDepth;
            uniform float cqRevealTime;
            uniform float cqRevealInnerRadius;
            uniform float cqRevealOuterRadius;
            varying float vCQRevealDepth;` : ''}
          ${reveal ? `float cqRevealHash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
          }
          float cqRevealNoise(vec2 p) {
            vec2 i = floor(p), f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            float a = cqRevealHash(i), b = cqRevealHash(i + vec2(1.0, 0.0));
            float c = cqRevealHash(i + vec2(0.0, 1.0)), d = cqRevealHash(i + vec2(1.0, 1.0));
            return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
          }` : ''}
          vec3 cqLinearToOklab(vec3 c) {
            vec3 lms = vec3(
              0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b,
              0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b,
              0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b);
            lms = pow(max(lms, vec3(0.0)), vec3(1.0 / 3.0));
            return vec3(
              0.2104542553 * lms.x + 0.7936177850 * lms.y - 0.0040720468 * lms.z,
              1.9779984951 * lms.x - 2.4285922050 * lms.y + 0.4505937099 * lms.z,
              0.0259040371 * lms.x + 0.7827717662 * lms.y - 0.8086757660 * lms.z);
          }
          vec3 cqOklabToLinear(vec3 lab) {
            float l = lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z;
            float m = lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z;
            float s = lab.x - 0.0894841775 * lab.y - 1.2914855480 * lab.z;
            l = l * l * l; m = m * m * m; s = s * s * s;
            return max(vec3(
              4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
              -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
              -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s), vec3(0.0));
          }
          vec3 cqSoftLight(vec3 base, vec3 layer) {
            vec3 low = base - (1.0 - 2.0 * layer) * base * (1.0 - base);
            vec3 high = base + (2.0 * layer - 1.0) * (sqrt(max(base, vec3(0.0))) - base);
            return mix(low, high, step(vec3(0.5), layer));
          }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          vec2 cqPathFogUv = (vCQLocationWorld.xz - cqPathFogBounds.xy) / cqPathFogBounds.zw;
          float cqPathFog = texture2D(cqPathFogMap, cqPathFogUv).r;`)
        .replace('#include <opaque_fragment>', `${reveal ? `
          float cqRevealDistance = length(gl_FragCoord.xy - cqRevealScreen);
          float cqRevealBeforePlayer = step(vCQRevealDepth + 0.025, cqRevealPlayerDepth);
          if (cqRevealEnabled > 0.5 && cqRevealBeforePlayer > 0.5 && cqRevealDistance < cqRevealOuterRadius) {
            float cqRevealFade = 1.0 - smoothstep(cqRevealInnerRadius, cqRevealOuterRadius, cqRevealDistance);
            vec2 cqRevealDelta = gl_FragCoord.xy - cqRevealScreen;
            float cqRevealAngle = atan(cqRevealDelta.y, cqRevealDelta.x) * 0.15915494 + 0.5;
            float cqRevealRadius = cqRevealDistance / max(1.0, cqRevealOuterRadius);
            vec2 cqRevealPolarDirection = vec2(cos(cqRevealAngle * 6.2831853), sin(cqRevealAngle * 6.2831853));
            vec2 cqRevealPolarUv = cqRevealPolarDirection * 7.0 + vec2(cqRevealRadius * 8.0);
            vec2 cqRevealDrift = vec2(cqRevealTime * 0.018, -cqRevealTime * 0.012);
            float cqRevealSplash = cqRevealNoise(cqRevealPolarUv + cqRevealDrift);
            vec2 cqRevealWorldUv = vCQLocationWorld.xz;
            float cqRevealBroad = cqRevealNoise(cqRevealWorldUv * 0.75 + cqRevealDrift);
            float cqRevealMid = cqRevealNoise(cqRevealWorldUv * 2.4 - cqRevealDrift * 1.7);
            float cqRevealFine = cqRevealNoise(cqRevealWorldUv * 8.0 + cqRevealDrift * 2.4);
            float cqRevealNoiseValue = cqRevealBroad * 0.34 + cqRevealMid * 0.25
              + cqRevealFine * 0.16 + cqRevealSplash * 0.25;
            float cqRevealEdge = clamp(cqRevealFade + (cqRevealSplash - 0.5) * 0.3
              * 4.0 * cqRevealFade * (1.0 - cqRevealFade), 0.0, 1.0);
            if (cqRevealEdge > cqRevealNoiseValue) discard;
          }` : ''}
          vec3 cqBaseLight = max(outgoingLight, vec3(0.0));
          vec3 cqSoftTint = cqSoftLight(cqBaseLight, cqPathFogColor);
          vec3 cqOverlaid = mix(cqBaseLight, cqSoftTint, cqPathFog * cqPathFogTint);
          float cqFogConvergence = pow(cqPathFog, cqPathFogCurve);
          vec3 cqFogLab = mix(cqLinearToOklab(cqOverlaid), cqLinearToOklab(cqPathFogColor), cqFogConvergence);
          outgoingLight = cqOklabToLinear(cqFogLab);
          #include <opaque_fragment>`);
    };
    if (reveal) { material.transparent = false; material.depthWrite = true; }
    material.customProgramCacheKey = () => `cq-location-path-fog-v10-dither-clip-${reveal}`;
    material.needsUpdate = true;
  };
  const applyTo = root => applyLocationEdgeShade(root, patchMaterial);
  applyTo(location.sceneGroup);
  const update = next => {
    const previous = settings; settings = { ...settings, ...next };
    if (previous.start !== settings.start || previous.end !== settings.end) redrawPathTexture();
    uniforms.cqPathFogColor.value.set(settings.color);
    uniforms.cqPathFogTint.value = settings.tint; uniforms.cqPathFogCurve.value = settings.curve;
  };
  const redrawPathTexture = () => {
    for (let y = 0; y < resolution; y++) for (let x = 0; x < resolution; x++) {
      const worldX = bounds.minX + (x + .5) / resolution * width;
      const worldZ = bounds.minZ + (y + .5) / resolution * height;
      const offset = (y * resolution + x) * 4;
      data[offset] = paths.length ? Math.round(shadeAtDistance(pathDistanceAt(worldX, worldZ, paths), settings) * 255) : 0;
    }
    texture.needsUpdate = true;
  };
  const updatePaths = nextPaths => {
    paths.splice(0, paths.length, ...(nextPaths?.paths ?? []));
    redrawPathTexture();
  };
  return { texture, bounds, uniforms, applyTo, update, updatePaths };
}
