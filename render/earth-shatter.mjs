import { UNIT_MARKER_RADIUS, MARKER_STROKE_WIDTH } from '../marker-shapes.mjs?v=7c14a71de3a9af87';
export { createUnityRockEffectVisual as createEarthShatterVisual } from './unity-rock-effect.mjs?v=7c14a71de3a9af87';

/** A radial fill, sampled from the AI timer so stun and pause cannot desync landing. */
export function createGroundSlamWarning(THREE, scene, zone, getProgress) {
  const group = new THREE.Group(); group.name = 'ground-slam-warning';
  const outlineGeometry = new THREE.RingGeometry(zone.radius - MARKER_STROKE_WIDTH, zone.radius, 96);
  const fillGeometry = new THREE.CircleGeometry(zone.radius, 96);
  const outlineMaterial = new THREE.MeshBasicMaterial({ color: 0xe33a32, transparent: true, opacity: .95,
    side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
  const fillMaterial = new THREE.MeshBasicMaterial({ color: 0xe33a32, transparent: true, opacity: .38,
    side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
  const outline = new THREE.Mesh(outlineGeometry, outlineMaterial), fill = new THREE.Mesh(fillGeometry, fillMaterial);
  for (const mesh of [outline, fill]) { mesh.rotation.x = -Math.PI / 2; group.add(mesh); }
  outline.position.y = .035; outline.renderOrder = 13;
  fill.position.y = .03; fill.renderOrder = 12;
  fill.scale.setScalar(0); group.position.set(zone.x, 0, zone.z); scene.add(group);
  return { group, outline, fill,
    update() {
      const progress = Math.max(0, Math.min(1, getProgress()));
      group.position.set(zone.x, 0, zone.z);
      fill.scale.setScalar(progress);
      return progress >= 1;
    },
    dispose() {
      scene.remove(group); outlineGeometry.dispose(); fillGeometry.dispose();
      outlineMaterial.dispose(); fillMaterial.dispose();
    } };
}

export function createEarthShatterWarning(THREE, scene, positions, duration) {
  const group = new THREE.Group(); group.name = 'earth-shatter-warning';
  const geometry = new THREE.RingGeometry(UNIT_MARKER_RADIUS-MARKER_STROKE_WIDTH, UNIT_MARKER_RADIUS, 48);
  const material = new THREE.MeshBasicMaterial({ color: 0xf1bd70, transparent: true, opacity: .5,
    side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
  for (const point of positions) {
    const ring = new THREE.Mesh(geometry, material);
    ring.rotation.x = -Math.PI / 2; ring.position.set(point.x, .025, point.z);
    group.add(ring);
  }
  scene.add(group);
  return { group, geometry, material, age: 0, duration,
    update(dt) { this.age += dt; material.opacity = .5 * Math.max(0, 1 - this.age / duration); return this.age >= duration; },
    dispose() { scene.remove(group); geometry.dispose(); material.dispose(); } };
}
