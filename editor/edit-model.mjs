export const SCENE_DIFF_FORMAT = 'cardboardquest.scene-diff.v1';
export const SCENE_BUILD = '153';
import { FOG_DEFAULTS } from '../fog-settings.mjs?v=2';
import { catalogAsset } from './asset-catalog.mjs?v=4';
import { validateFogPaths } from '../fog-paths.mjs';
import { validateCampaignGraph } from '../game/campaign-graph.mjs';
import { validateTerrainEdits } from '../game/terrain-sculpt.mjs';
export { FOG_DEFAULTS };
export const LIGHTING_DEFAULTS = { direction: [-5, 12, 7], intensity: 3, color: '#ffebcb' };
export const TERRAIN_STYLE_DEFAULTS = {
  edgeColor: '#fff0c7', edgeStrength: .38, edgeWidth: .16,
  baseColor: '#33271f', baseStrength: .42, baseWidth: .3,
};
const clone = value => JSON.parse(JSON.stringify(value));
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const roundSceneValue = value => Math.round(value * 100000) / 100000;
export function readTransform(object) {
  return Object.fromEntries(['position', 'rotation', 'scale'].map(key => [key,
    ['x', 'y', 'z'].map(axis => roundSceneValue(object[key][axis]))]));
}
export function writeTransform(object, value) {
  for (const key of ['position', 'rotation', 'scale']) object[key].set(...value[key]);
  object.updateMatrixWorld(true);
}
export function validateSceneValue(value, fog = false, fogPaths = false, graph = false, lighting = false, terrain = false, globalTerrainStyle = false) {
  if (value === null && !fog && !fogPaths && !graph && !lighting && !terrain && !globalTerrainStyle) return value;
  if (!value || typeof value !== 'object') throw new Error('Scene value must be an object');
  if (fogPaths) return validateFogPaths(value);
  if (graph) return validateCampaignGraph(value);
  if (terrain) return validateTerrainEdits(value);
  if (globalTerrainStyle) {
    const keys = Object.keys(TERRAIN_STYLE_DEFAULTS);
    if (Object.keys(value).some(key => !keys.includes(key))
      || !/^#[0-9a-f]{6}$/i.test(value.edgeColor) || !/^#[0-9a-f]{6}$/i.test(value.baseColor)
      || !Number.isFinite(value.edgeStrength) || value.edgeStrength < 0 || value.edgeStrength > 1
      || !Number.isFinite(value.baseStrength) || value.baseStrength < 0 || value.baseStrength > 1
      || !Number.isFinite(value.edgeWidth) || value.edgeWidth < .03 || value.edgeWidth > .5
      || !Number.isFinite(value.baseWidth) || value.baseWidth < .03 || value.baseWidth > .5)
      throw new Error('Invalid global terrain style');
    return value;
  }
  const allowed = fog ? ['start', 'end', 'color', 'tint', 'curve', 'revealInnerRadius', 'revealOuterRadius']
    : lighting ? ['direction', 'intensity', 'color'] : ['position', 'rotation', 'scale', 'asset', 'size'];
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new Error('Unexpected scene value field');
  if (fog) {
    if (!Number.isFinite(value.start) || !Number.isFinite(value.end) || value.start < -20 || value.end > 60 || value.end - value.start < .1
      || !/^#[0-9a-f]{6}$/i.test(value.color) || !Number.isFinite(value.tint) || value.tint < 0 || value.tint > 1
      || !Number.isFinite(value.curve) || value.curve < .2 || value.curve > 4
      || (value.revealInnerRadius !== undefined && (!Number.isFinite(value.revealInnerRadius) || value.revealInnerRadius < 0 || value.revealInnerRadius > 480))
      || (value.revealOuterRadius !== undefined && (!Number.isFinite(value.revealOuterRadius) || value.revealOuterRadius < 1 || value.revealOuterRadius > 640))
      || (value.revealInnerRadius !== undefined && value.revealOuterRadius !== undefined
        && value.revealOuterRadius <= value.revealInnerRadius)) throw new Error('Invalid fog settings');
  } else if (lighting) {
    if (!Array.isArray(value.direction) || value.direction.length !== 3
      || !value.direction.every(number => Number.isFinite(number) && Math.abs(number) <= 30)
      || Math.hypot(...value.direction) < .1 || !Number.isFinite(value.intensity) || value.intensity < 0 || value.intensity > 8
      || !/^#[0-9a-f]{6}$/i.test(value.color)) throw new Error('Invalid lighting settings');
  } else {
    for (const key of ['position', 'rotation', 'scale']) {
      if (!Array.isArray(value[key]) || value[key].length !== 3 || !value[key].every(Number.isFinite)
        || value[key].some(number => Math.abs(number) > 10000)
        || (key === 'scale' && value[key].some(number => number < .001))) throw new Error(`Invalid transform ${key}`);
    }
    if ('asset' in value && (!catalogAsset(value.asset) || !Number.isFinite(value.size) || value.size < .1 || value.size > 30))
      throw new Error('Invalid library asset');
  }
  return value;
}

/** Baselines survive scene eviction; repeated changes collapse into one before/after pair. */
export function createEditModel() {
  const records = new Map(), undo = [], redo = [];
  let transaction = null;
  const id = (location, object) => JSON.stringify([location, object]);
  return {
    register(location, object, value) {
      const key = id(location, object);
      if (!records.has(key)) records.set(key, { location, object, before: clone(value), after: clone(value) });
      return clone(records.get(key).after);
    },
    has(location, object) { return records.has(id(location, object)); },
    get(location, object) { const entry = records.get(id(location, object)); return entry ? clone(entry.after) : null; },
    begin() { if (!transaction) transaction = new Map(); },
    set(location, object, value) {
      validateSceneValue(value, object === 'fog', object === 'fog-paths', object === 'campaign-graph', object === 'lighting', object === 'terrain', object === 'terrain-style');
      const key = id(location, object), entry = records.get(key);
      if (!entry) throw new Error(`Unregistered scene object: ${object}`);
      if (equal(entry.after, value)) return false;
      const change = { key, before: clone(entry.after), after: clone(value) };
      if (transaction) {
        const previous = transaction.get(key);
        transaction.set(key, { ...change, before: previous?.before ?? change.before });
      } else { undo.push([change]); redo.length = 0; }
      entry.after = clone(value); return true;
    },
    commit() {
      if (!transaction) return;
      const changes = [...transaction.values()].filter(change => !equal(change.before, change.after));
      if (changes.length) { undo.push(changes); redo.length = 0; }
      transaction = null;
    },
    undo() {
      this.commit(); const changes = undo.pop(); if (!changes) return false;
      for (const change of changes) records.get(change.key).after = clone(change.before);
      redo.push(changes); return true;
    },
    redo() {
      const changes = redo.pop(); if (!changes) return false;
      for (const change of changes) records.get(change.key).after = clone(change.after);
      undo.push(changes); return true;
    },
    reset(location, object) { const entry = records.get(id(location, object)); return entry ? this.set(location, object, entry.before) : false; },
    resetAll() {
      this.commit(); this.begin();
      for (const entry of records.values()) this.set(entry.location, entry.object, entry.before);
      this.commit();
    },
    diff() {
      return { format: SCENE_DIFF_FORMAT, baseBuild: SCENE_BUILD,
        changes: [...records.values()].filter(entry => !equal(entry.before, entry.after)).map(clone)
          .sort((a, b) => `${a.location}/${a.object}`.localeCompare(`${b.location}/${b.object}`)) };
    },
    text() { return JSON.stringify(this.diff(), null, 2); },
  };
}

export function mergeSceneDiff(overrides, diff) {
  if (diff?.format !== SCENE_DIFF_FORMAT || !Array.isArray(diff.changes) || diff.changes.length > 5000)
    throw new Error('Not a CardboardQuest scene diff');
  const result = clone(overrides);
  if (result.version !== 1) throw new Error('Unsupported scene override version');
  for (const change of diff.changes) {
    const { location, object, before, after } = change;
    if (typeof object !== 'string' || !/^[a-zA-Z0-9:/._-]+$/.test(object) || /(?:__proto__|constructor|prototype)/.test(object))
      throw new Error('Invalid scene object id');
    const fog = object === 'fog', fogPaths = object === 'fog-paths', graph = object === 'campaign-graph',
      lighting = object === 'lighting', terrain = object === 'terrain', globalTerrainStyle = object === 'terrain-style';
    if (fog || graph || lighting || globalTerrainStyle ? location !== null : typeof location !== 'string' || !/^[a-z0-9-]+$/.test(location)
      || ['constructor', 'prototype'].includes(location)) throw new Error('Invalid scene location');
    validateSceneValue(before, fog, fogPaths, graph, lighting, terrain, globalTerrainStyle);
    validateSceneValue(after, fog, fogPaths, graph, lighting, terrain, globalTerrainStyle);
    if (before === null && after === null) throw new Error('An empty edit has no effect');
    if (before === null && (!object.startsWith('placed:') || !after.asset)) throw new Error('New objects must come from the asset library');
    const current = fog ? { ...FOG_DEFAULTS, ...result.fog } : lighting ? { ...LIGHTING_DEFAULTS, ...result.lighting }
      : globalTerrainStyle ? { ...TERRAIN_STYLE_DEFAULTS, ...result.terrainStyle }
      : graph ? result.graph ?? before : terrain ? result.locations[location]?.terrain ?? { strokes: [] }
        : result.locations[location]?.[object];
    const matches = (value, expected) => fog
      ? Object.keys(expected).every(key => equal(value?.[key], expected[key]))
      : equal(value, expected);
    if ((fog || lighting || graph || terrain || globalTerrainStyle || Object.hasOwn(result.locations[location] ?? {}, object)) && !matches(current, before) && !matches(current, after))
      throw new Error(`Scene edit conflict: ${location}/${object}`);
    if (fog) result.fog = { ...current, ...clone(after) };
    else if (lighting) result.lighting = clone(after);
    else if (globalTerrainStyle) result.terrainStyle = clone(after);
    else if (graph) result.graph = clone(after);
    else { result.locations[location] ??= {}; result.locations[location][object] = clone(after); }
  }
  return result;
}
