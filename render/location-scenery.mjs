import { hazardAtPoint, isPlayableFloor, pointInPolygon } from '../game/world-hazards.mjs';

const original = new Set(['tree', 'evergreen', 'moss-rocks', 'bushes']);
const neutral = new Set(['fallen-log', 'rock-cluster', 'wildflowers', 'mushrooms']);
export const sceneryAsset = name => name === 'hero-house' ? 'assets/hero-house.png'
  : neutral.has(name) ? `assets/env-neutral-${name}.png`
    : `assets/${original.has(name) ? `env-${name}` : `env-narrative-${name}`}.png`;
const sizes = { tree: [3, 4.4], evergreen: [2.8, 4.5], birch: [3.2, 5], fern: [1, 1.8],
  reeds: [1.6, 2.9], stump: [1.8, 3.2], 'moss-rocks': [1, 2.5], bushes: [1.1, 2.1],
  'charred-tree': [2.5, 4.1], totem: [2.3, 3.6], shrine: [1.5, 2.5], 'root-arch': [2.3, 3.2],
  'fallen-log': [1.4, 2.4], 'rock-cluster': [.9, 1.8], wildflowers: [.9, 1.5], mushrooms: [.8, 1.4] };

export async function populateNarrativeScenery({ locations, createScenery, loadTemplate, scale, hutAnchors, puckRadius, yieldWork = async () => {} }) {
  const assets = new Set(Object.values(locations).flatMap(location => location.art.props.map(sceneryAsset)));
  for (const location of Object.values(locations)) if (location.art.focal) assets.add(sceneryAsset(location.art.focal[0]));
  if (locations.camp) assets.add('assets/env-troll-hut.png');
  await Promise.all([...assets].map(loadTemplate));
  for (const location of Object.values(locations)) {
    let seed = location.heightSeed >>> 0;
    const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    const placed = [], tasks = [];
    for (const pickup of location.storyPickups ?? []) placed.push({ x: pickup.x, z: pickup.z, radius: 2.1 });
    const focal = location.art.focal;
    if (focal) {
      const [name, x, z, size] = focal;
      const house = name === 'hero-house';
      const options = house ? { fixedRadius: 1.2, base: true }
        : name === 'broken-bridge' ? { yaw: 0, elevation: 0 }
          : name === 'cart' ? { elevation: -.35 } : { fixedRadius: .7 };
      tasks.push(createScenery(sceneryAsset(name), x * scale, z * scale, size, location.sceneGroup, true, options));
      placed.push({ x: x * scale, z: z * scale, radius: 2.6 });
    }
    if (location.id === 'camp') for (const anchor of hutAnchors) {
      tasks.push(createScenery('assets/env-troll-hut.png', anchor.x * scale, anchor.z * scale,
        3.2, location.sceneGroup, true, { fixedRadius: puckRadius * 1.3, base: true }));
      placed.push({ x: anchor.x * scale, z: anchor.z * scale, radius: 2.7 });
    }
    const count = location.art.density;
    for (let attempt = 0, countPlaced = 0; attempt < count * 35 && countPlaced < count; attempt++) {
      if (attempt % 16 === 0) await yieldWork();
      const boundary = location.walkablePoints, index = Math.floor(random() * boundary.length), edge = boundary[index];
      const before = boundary[(index + boundary.length - 1) % boundary.length], after = boundary[(index + 1) % boundary.length];
      const length = Math.hypot(after.x - before.x, after.z - before.z) || 1;
      let nx = (after.z - before.z) / length, nz = -(after.x - before.x) / length;
      if (pointInPolygon(edge.x + nx, edge.z + nz, boundary)) { nx = -nx; nz = -nz; }
      const outward = -.9 + random() ** 1.8 * 8.5;
      const x = edge.x + nx * outward, z = edge.z + nz * outward;
      if (hazardAtPoint(x, z, location.hazards, 1)) continue;
      if (location.dropZones.some(zone => Math.hypot(x - zone.x, z - zone.z) < zone.radius + 1.2)) continue;
      if (location.exits.some(exit => {
        const l = Math.hypot(exit.x, exit.z), ux = exit.dirX ?? exit.x / l, uz = exit.dirZ ?? exit.z / l;
        const along = (x - exit.x) * ux + (z - exit.z) * uz;
        const across = Math.abs((x - exit.x) * uz - (z - exit.z) * ux);
        return along > -5.2 && across < (exit.halfWidth ?? 2.3) + 1.1;
      })) continue;
      if (placed.some(p => Math.hypot(x - p.x, z - p.z) < p.radius)) continue;
      const type = location.art.props[Math.floor(random() * location.art.props.length)];
      const range = sizes[type] ?? [1.6, 2.8];
      const size = range[0] + random() * (range[1] - range[0]);
      const onFloor = isPlayableFloor(location, x, z);
      tasks.push(createScenery(sceneryAsset(type), x, z, size, location.sceneGroup, true,
        onFloor ? { fixedRadius: Math.min(.7, size * .19) } : {}));
      placed.push({ x, z, radius: type === 'fern' || type === 'reeds' ? .9 : 1.3 }); countPlaced++;
    }
    location.sceneryCount = tasks.length;
    await Promise.all(tasks);
  }
}
