import { LOCATION_FAR_COLOR } from './location-edge-shade.mjs?v=2';

function makeFoliageShadowTexture(THREE) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const context = canvas.getContext('2d');
  context.filter = 'blur(13px)';
  context.fillStyle = 'rgba(255,255,255,1)';
  context.strokeStyle = 'rgba(255,255,255,1)';
  context.lineCap = 'round'; context.lineJoin = 'round';
  const branches = [
    [[-70, 20], [75, 130], [180, 225], [275, 510]],
    [[530, 5], [420, 120], [330, 235], [235, 500]],
    [[150, -20], [240, 110], [300, 210], [390, 430]],
  ];
  for (const [start, c1, c2, end] of branches) {
    context.lineWidth = 17; context.beginPath(); context.moveTo(...start);
    context.bezierCurveTo(...c1, ...c2, ...end); context.stroke();
    const steps = 11;
    for (let index = 0; index < steps; index++) {
      const t = .12 + index / steps * .8;
      const x = (1 - t) ** 3 * start[0] + 3 * (1 - t) ** 2 * t * c1[0] + 3 * (1 - t) * t ** 2 * c2[0] + t ** 3 * end[0];
      const y = (1 - t) ** 3 * start[1] + 3 * (1 - t) ** 2 * t * c1[1] + 3 * (1 - t) * t ** 2 * c2[1] + t ** 3 * end[1];
      for (const side of [-1, 1]) {
        const angle = -.72 + side * .78;
        context.save(); context.translate(x + side * 34, y - 10);
        context.rotate(angle + (index % 2 ? .24 : -.2));
        context.beginPath(); context.ellipse(0, 0, 52, 17, 0, 0, Math.PI * 2); context.fill();
        context.restore();
      }
    }
  }
  context.filter = 'none';
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
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

function makeArrowShape(THREE) {
  const shape = new THREE.Shape();
  shape.moveTo(0, -.78); shape.lineTo(-.52, -.12); shape.lineTo(-.2, -.12);
  shape.lineTo(-.2, .62); shape.lineTo(.2, .62); shape.lineTo(.2, -.12);
  shape.lineTo(.52, -.12); shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

/** Mark each exit with a broad, flat canopy shadow and ground-only lock cues. */
export function createLocationExitVisuals({ THREE, location, locked }) {
  const root = new THREE.Group(); root.name = `location-exits-${location.id}`;
  const foliageTexture = makeFoliageShadowTexture(THREE);
  const blockedTexture = makeBlockedGroundTexture(THREE);
  const shadowMaterial = new THREE.MeshBasicMaterial({ map: foliageTexture, color: LOCATION_FAR_COLOR, transparent: true,
    opacity: 1, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
  const blockedMaterial = new THREE.MeshBasicMaterial({ map: blockedTexture, transparent: true,
    opacity: locked ? 1 : 0, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
  const arrowOutlineMaterial = new THREE.MeshBasicMaterial({ color: 0x171426, transparent: true,
    opacity: locked ? .32 : .76, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
  const arrowMaterial = new THREE.MeshBasicMaterial({ color: 0xf0dca5, transparent: true,
    opacity: locked ? .18 : .98, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
  const floor = new THREE.PlaneGeometry(1, 1), arrowGeometry = makeArrowShape(THREE), markers = [];
  for (const exit of location.exits ?? []) {
    const radius = Math.hypot(exit.x, exit.z) || 1;
    const dx = exit.dirX ?? exit.x / radius, dz = exit.dirZ ?? exit.z / radius;
    const width = (exit.halfWidth ?? 2.3) * 2;
    const marker = new THREE.Group(); marker.position.set(exit.x, 0, exit.z); marker.rotation.y = Math.atan2(dx, dz);
    const shadow = new THREE.Mesh(floor, shadowMaterial);
    shadow.rotation.x = -Math.PI / 2; shadow.scale.set(Math.max(12, width * 2.2), 13, 1);
    shadow.position.set(0, .023, 5.1); shadow.renderOrder = 1; marker.add(shadow);
    const arrowOutline = new THREE.Mesh(arrowGeometry, arrowOutlineMaterial);
    arrowOutline.rotation.x = -Math.PI / 2; arrowOutline.scale.set(1.52, 1.52, 1);
    arrowOutline.position.set(0, .035, -.55); arrowOutline.renderOrder = 2; marker.add(arrowOutline);
    const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
    arrow.rotation.x = -Math.PI / 2; arrow.scale.set(1.2, 1.2, 1);
    arrow.position.set(0, .041, -.55); arrow.renderOrder = 3; marker.add(arrow);
    const blocked = new THREE.Mesh(floor, blockedMaterial);
    blocked.rotation.x = -Math.PI / 2; blocked.scale.set(Math.max(5, width + 1.5), 2.4, 1);
    blocked.position.set(0, .048, 1.5); blocked.renderOrder = 4; marker.add(blocked);
    marker.name = `exit-${exit.to}`; root.add(marker); markers.push({ blocked });
  }
  location.sceneGroup.add(root);
  return { root, markers, shadowMaterial, blockedMaterial, arrowOutlineMaterial, arrowMaterial,
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
  system.arrowOutlineMaterial.opacity = system.locked ? .4 : .76;
  system.arrowMaterial.opacity = system.locked ? .22 : .98;
  for (const marker of system.markers) marker.blocked.visible = system.blockedOpacity > .015;
  return changed;
}
