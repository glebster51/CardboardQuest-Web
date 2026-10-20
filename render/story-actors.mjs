import { hasGrandpaDied } from '../game/story-campaign.mjs?v=5';
import { isPlayableFloor } from '../game/world-hazards.mjs';

export const STORY_ACTORS = [
  { id: 'grandpa-alive', location: 'bell-vault', sprite: 'npc-grandpa-idle', x: -2.1, z: -1.4, height: 1.8, radius: .8 },
  { id: 'grandpa-after', location: 'bell-vault', sprite: 'npc-grandpa-dead', x: -2.1, z: -1.4, height: .85, radius: .8, dead: true },
  { id: 'grandpa-final', location: 'grandpa', sprite: 'npc-grandpa-dead', x: -1.5, z: -1.4, height: .85, radius: .8, dead: true },
  { id: 'martyn', location: 'cartographer', sprite: 'npc-cartographer-idle', x: -2, z: 0, height: 1.75, radius: .8 },
];

export function isStoryActorVisible(actor, campaign) {
  const dead = hasGrandpaDied(campaign);
  if (actor.id === 'grandpa-alive') return !dead;
  if (actor.id === 'grandpa-after') return dead;
  return true;
}

/** Same extruded sticker, mirrored back and puck as the other tabletop tokens. */
export async function createStoryActors({ locations, createScenery, scale, campaign }) {
  const actors = [];
  for (const spec of STORY_ACTORS) {
    const location = locations[spec.location];
    if (!location) continue;
    const saved = campaign.world?.[spec.location]?.actors?.find(actor => actor.id === spec.id);
    const position = spec.dead && saved && Number.isFinite(saved.x) && Number.isFinite(saved.z)
      && isPlayableFloor(location, saved.x, saved.z, spec.radius)
      ? saved : { x: spec.x * scale, z: spec.z * scale };
    const prop = await createScenery(`assets/${spec.sprite}.png`, position.x, position.z,
      spec.height, location.sceneGroup, true, { base: true, fixedRadius: spec.radius, elevation: 0, yaw: 0 });
    const body = location.obstacles.at(-1);
    Object.assign(body, { id: spec.id, health: 0, maxHealth: 0, fixed: !spec.dead, team: 'neutral', active: true });
    actors.push({ spec, prop, body });
  }
  function update() {
    for (const actor of actors) {
      actor.prop.visible = isStoryActorVisible(actor.spec, campaign);
      actor.body.active = actor.prop.visible;
      actor.prop.position.x = actor.body.x; actor.prop.position.z = actor.body.z;
    }
  }
  update();
  return { update, actors };
}
