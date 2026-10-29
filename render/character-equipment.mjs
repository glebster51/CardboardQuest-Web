import { EQUIPMENT_ITEMS, equipmentItem, equipmentOrbPosition, normalizeEquipment } from '../game/equipment.mjs?v=ab782efa5048549c';
import { equipmentMount } from './equipment-poses.mjs?v=ab782efa5048549c';
import { bindSsaoSpriteAlphaCutouts } from './ssao-alpha-cutout.mjs?v=ab782efa5048549c';

/** Three cached cardboard prints, reused by all pose/side mounts. Only the active pose draws. */
export async function createCharacterEquipment({ THREE, figure, loadTemplate, getEquipment, sceneStencil }) {
  const items = EQUIPMENT_ITEMS.filter(item => item.slot !== 'orb'), mounts = [];
  const templates = await Promise.all(items.map(item => loadTemplate(item.image)));
  for (const [poseName, pose] of Object.entries(figure.artStates)) for (const side of ['front', 'back']) {
    const face = pose[`${side}Art`];
    for (const [index, item] of items.entries()) {
      const slot = item.slot;
      const transform = equipmentMount(poseName, side, slot, pose.width, pose.height);
      const mount = new THREE.Group(); mount.name = `equipment-${poseName}-${side}-${slot}`;
      mount.position.set(transform.x, transform.y, transform.z); mount.rotation.z = transform.angle;
      const art = templates[index].children[0].clone(true);
      // All units use the same physical cardboard construction. A smaller depth makes a glued-on layer.
      const size = new THREE.Box3().setFromObject(art).getSize(new THREE.Vector3());
      const scale = transform.width ? transform.width / size.x : transform.height / size.y;
      art.scale.set(scale, scale, .44);
      art.position.y = -(transform.pivotY ?? 0) * scale;
      art.traverse(mesh => {
        if (!mesh.isMesh) return;
        mesh.material = mesh.material.clone(); Object.assign(mesh.material, sceneStencil);
        // Raw scenery templates have no damage-baked vertex colours. Reading
        // a missing colour attribute multiplies the equipment print by black.
        mesh.material.vertexColors = Boolean(mesh.geometry.getAttribute('color'));
        // Equipment shares the player's stencil, and is never an environmental reveal occluder.
        mesh.material.stencilRef = 1;
        mesh.userData.characterEquipment = true;
      });
      bindSsaoSpriteAlphaCutouts(art); mount.add(art); face.group.add(mount);
      mounts.push({ mount, slot, poseName, side, itemId: item.id });
    }
  }
  const orbitRoot = new THREE.Group(); orbitRoot.name = 'equipment-orbits'; figure.group.add(orbitRoot);
  const sphere = new THREE.SphereGeometry(.13, 16, 10);
  const orbs = Array.from({ length: 3 }, (_, index) => {
    const group = new THREE.Group(); group.name = `equipment-orb-${index}`;
    const material = new THREE.MeshStandardMaterial({ roughness: .46, metalness: .05, emissiveIntensity: .7, ...sceneStencil, stencilRef: 1 });
    const core = new THREE.Mesh(sphere, material); group.add(core);
    const shell = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: '#ffe9b7', side: THREE.BackSide, ...sceneStencil, stencilRef: 1 }));
    shell.scale.setScalar(1.12); group.add(shell); orbitRoot.add(group);
    const positions = new Float32Array(16 * 3), geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const trail = new THREE.Line(geometry, new THREE.LineBasicMaterial({ transparent: true, opacity: .32,
      blending: THREE.AdditiveBlending, depthWrite: false }));
    trail.frustumCulled = false; orbitRoot.add(trail);
    return { group, material, trail, index, id: null };
  });
  let signature = '';
  function update(time) {
    const gear = normalizeEquipment(getEquipment()), next = JSON.stringify(gear);
    if (signature !== next) {
      signature = next;
      for (const { mount, slot, itemId } of mounts) mount.visible = gear[slot] === itemId;
      for (const orb of orbs) {
        const item = equipmentItem(gear.orbs[orb.index]); orb.id = item?.id ?? null;
        orb.group.visible = orb.trail.visible = Boolean(item);
        if (item) { orb.material.color.set(item.color); orb.material.emissive.set(item.color); orb.trail.material.color.set(item.color); }
      }
    }
    orbitRoot.rotation.y = -figure.group.rotation.y;
    orbitRoot.visible = figure.body.health > 0 && figure.visualState !== 'dead';
    for (const orb of orbs) if (orb.group.visible) {
      const position = equipmentOrbPosition(orb.index, time); orb.group.position.set(position.x, position.y, position.z);
      const array = orb.trail.geometry.attributes.position.array;
      for (let point = 0; point < 16; point++) {
        const p = equipmentOrbPosition(orb.index, time - (15 - point) * .025);
        array.set([p.x, p.y, p.z], point * 3);
      }
      orb.trail.geometry.attributes.position.needsUpdate = true;
    }
  }
  update(0);
  return { update, inspect: () => ({ equipment: normalizeEquipment(getEquipment()),
    mounts: mounts.map(({ mount, slot, poseName, side }) => ({ slot, pose: poseName, side, visible: mount.visible,
      position: mount.position.toArray(), rotation: mount.rotation.z, children: mount.children.length })),
    orbs: orbs.map(orb => ({ id: orb.id, visible: orb.group.visible && orbitRoot.visible, position: orb.group.position.toArray() })) }) };
}
