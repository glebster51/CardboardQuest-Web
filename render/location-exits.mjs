import { LOCATION_FAR_COLOR } from './location-edge-shade.mjs?v=ab782efa5048549c';
import { markSsaoSpriteAlphaCutout } from './ssao-alpha-cutout.mjs?v=ab782efa5048549c';
import { EXIT_FOG_CENTER_DEPTH, EXIT_FOG_LENGTH } from '../exit-fog.mjs?v=ab782efa5048549c';

export const EXIT_SHADOW_LENGTH = EXIT_FOG_LENGTH;
export const EXIT_SHADOW_CENTER_DEPTH = EXIT_FOG_CENTER_DEPTH;

function makeFoliageShadowTexture(THREE) {
  const url = new URL('../assets/location-exit-foliage-v4.png', import.meta.url).href;
  const texture = new THREE.TextureLoader().load(url);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeBlockedGroundTexture(THREE) {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 128;
  const context = canvas.getContext('2d'); context.lineCap = 'round'; context.lineJoin = 'round';
  context.strokeStyle = 'rgba(213,194,220,.86)'; context.lineWidth = 13;
  context.beginPath(); context.moveTo(20, 20); context.lineTo(236, 108);
  context.moveTo(236, 20); context.lineTo(20, 108); context.stroke();
  context.strokeStyle = 'rgba(40,30,56,.78)'; context.lineWidth = 4;
  for (let x = 34; x < 230; x += 28) {
    context.beginPath(); context.moveTo(x, 17); context.lineTo(x - 17, 111); context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Mark each exit with a leaf-built fog gradient and ground-only lock cues. */
export function createLocationExitVisuals({ THREE, location, locked }) {
  const root = new THREE.Group(); root.name = `location-exits-${location.id}`;
  const foliageTexture = makeFoliageShadowTexture(THREE);
  const blockedTexture = makeBlockedGroundTexture(THREE);
  const shadowMaterial = new THREE.MeshBasicMaterial({ map: foliageTexture, color: LOCATION_FAR_COLOR, transparent: true,
    opacity: 1, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
  const blockedMaterial = new THREE.MeshBasicMaterial({ map: blockedTexture, transparent: true,
    opacity: locked ? 1 : 0, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
  const floor = new THREE.PlaneGeometry(1, 1), markers = [];
  for (const exit of location.exits ?? []) {
    const radius = Math.hypot(exit.x, exit.z) || 1;
    const dx = exit.dirX ?? exit.x / radius, dz = exit.dirZ ?? exit.z / radius;
    const width = (exit.halfWidth ?? 2.3) * 2;
    const marker = new THREE.Group(); marker.position.set(exit.x, 0, exit.z); marker.rotation.y = Math.atan2(dx, dz);
    const shadow = new THREE.Mesh(floor, shadowMaterial);
    markSsaoSpriteAlphaCutout(shadow, foliageTexture, .035);
    shadow.rotation.x = -Math.PI / 2; shadow.scale.set(Math.max(12, width * 2.2), EXIT_SHADOW_LENGTH, 1);
    shadow.position.set(0, .023, EXIT_SHADOW_CENTER_DEPTH); shadow.renderOrder = 1; marker.add(shadow);
    const blocked = new THREE.Mesh(floor, blockedMaterial);
    markSsaoSpriteAlphaCutout(blocked, blockedTexture, .035);
    blocked.rotation.x = -Math.PI / 2; blocked.scale.set(Math.max(5, width + 1.5), 2.4, 1);
    blocked.position.set(0, .048, 1.5); blocked.renderOrder = 2; marker.add(blocked);
    marker.name = `exit-${exit.to}`; root.add(marker); markers.push({ exit, marker, shadow, blocked });
  }
  location.sceneGroup.add(root);
  return { root, markers, shadowMaterial, blockedMaterial,
    locked: Boolean(locked), blockedOpacity: locked ? 1 : 0 };
}

/** Fade the painted ground mark as enemies clear or relock the exit. */
export function updateLocationExitLock(system, locked, dt = 0) {
  if (!system) return false;
  const changed = system.locked !== Boolean(locked);
  system.locked = Boolean(locked);
  const targetOpacity = system.locked ? 1 : 0;
  const step = Math.max(0, dt) * (system.locked ? 4 : 2.5);
  system.blockedOpacity += Math.sign(targetOpacity - system.blockedOpacity)
    * Math.min(Math.abs(targetOpacity - system.blockedOpacity), step);
  system.blockedMaterial.opacity = system.blockedOpacity;
  for (const marker of system.markers) marker.blocked.visible = !marker.exit.disabled && system.blockedOpacity > .015;
  return changed;
}
