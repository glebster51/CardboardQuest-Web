import { SCENE_BUILD, SCENE_DIFF_FORMAT, validateSceneValue } from './schema.mjs?v=f484ba7b7b13e7f6';
const clone = value => JSON.parse(JSON.stringify(value));
const key = (location, object) => JSON.stringify([location, object]);

/** Runtime values survive location eviction, without authoring history or Apply operations. */
export function createSceneModel() {
  const records = new Map();
  return {
    register(location, object, value) {
      const id = key(location, object);
      if (!records.has(id)) records.set(id, { location, object, before: clone(value), after: clone(value) });
      return clone(records.get(id).after);
    },
    has(location, object) { return records.has(key(location, object)); },
    get(location, object) { const record = records.get(key(location, object)); return record ? clone(record.after) : null; },
    set(location, object, value) {
      const record = records.get(key(location, object));
      if (!record) throw new Error(`Unregistered scene object: ${object}`);
      validateSceneValue(value, object === 'fog' || object === 'fog-night', object === 'fog-paths', object === 'campaign-graph', object === 'lighting' || object === 'lighting-night', object === 'terrain', object === 'terrain-style', object === 'unit-puck-colors', object.startsWith('prefab:') ? object.slice(7) : null, object === 'screen-effects', object === 'item-magnet', object === 'ground-grid', object === 'ground-grid-color', object === 'cardboard-damage', object === 'player-reveal', object === 'ogre-boss');
      if (JSON.stringify(record.after) === JSON.stringify(value)) return false;
      record.after = clone(value); return true;
    },
    diff() {
      return { format: SCENE_DIFF_FORMAT, baseBuild: SCENE_BUILD,
        changes: [...records.values()].filter(record => JSON.stringify(record.before) !== JSON.stringify(record.after)).map(clone)
          .sort((a, b) => `${a.location}/${a.object}`.localeCompare(`${b.location}/${b.object}`)) };
    },
  };
}
