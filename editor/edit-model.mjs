export const SCENE_DIFF_FORMAT = 'cardboardquest.scene-diff.v1';
export const SCENE_BUILD = '227';
import { FOG_DEFAULTS } from '../fog-settings.mjs?v=8';
import { catalogAsset, catalogPrefab } from './asset-catalog.mjs?v=10';
import { validateFogPaths } from '../fog-paths.mjs?v=2';
import { validateCampaignGraph } from '../game/campaign-graph.mjs';
import { validateTerrainEdits } from '../game/terrain-sculpt.mjs?v=2';
import { DEFAULT_SCREEN_EFFECTS, normalizeScreenEffects } from '../screen-effects.mjs';
import { ITEM_MAGNET_DEFAULTS, normalizeItemMagnetSettings } from '../game/item-magnet.mjs?v=2';
export { FOG_DEFAULTS };
export function scopeLegacyGlobalFogChanges(diff, locationIds, overrides = {}) {
  if (!diff || !Array.isArray(diff.changes)) return diff;
  const changes = [], fogChanges = diff.changes.filter(change => change.object === 'fog' && change.location === null);
  for (const change of diff.changes) {
    if (change.object !== 'fog' || change.location !== null) { changes.push(change); continue; }
    for (const location of new Set(locationIds)) {
      if (typeof location !== 'string' || !/^[a-z0-9-]+$/.test(location)) continue;
      const localFog = overrides.locations?.[location]?.fog ?? {};
      const current = { ...FOG_DEFAULTS, ...overrides.fog, ...localFog };
      changes.push({ ...change, location, before: current, after: { ...current, ...change.after, ...localFog } });
    }
  }
  return fogChanges.length ? { ...diff, changes } : diff;
}
export const LIGHTING_DEFAULTS = { direction: [-5, 12, 7], intensity: 3, color: '#ffebcb' };
export function lightingDirectionToAngles(direction) {
  const [x, y, z] = direction, magnitude = Math.hypot(x, y, z);
  if (!(magnitude > 0)) return { x: 0, y: 0 };
  return {
    x: Math.asin(Math.max(-1, Math.min(1, y / magnitude))) * 180 / Math.PI,
    y: Math.atan2(x, z) * 180 / Math.PI,
  };
}
export function lightingDirectionFromAngles(direction, angles) {
  const magnitude = Math.hypot(...direction) || 1;
  const pitch = angles.x * Math.PI / 180, yaw = angles.y * Math.PI / 180;
  const horizontal = magnitude * Math.cos(pitch);
  return [horizontal * Math.sin(yaw), magnitude * Math.sin(pitch), horizontal * Math.cos(yaw)];
}
export const TERRAIN_STYLE_DEFAULTS = {
  edgeColor: '#fff0c7', edgeStrength: .38, edgeWidth: .16,
  baseColor: '#33271f', baseStrength: .42, baseWidth: .3,
};
export const UNIT_PUCK_COLOR_DEFAULTS = { player: '#d1e8ae', enemy: '#e9a092' };
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
export function validateSceneValue(value, fog = false, fogPaths = false, graph = false, lighting = false, terrain = false, globalTerrainStyle = false, unitPuckColors = false, prefabId = null, screenEffects = false, itemMagnet = false) {
  if (value === null && !fog && !fogPaths && !graph && !lighting && !terrain && !globalTerrainStyle && !unitPuckColors && !prefabId && !screenEffects && !itemMagnet) return value;
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
  if (unitPuckColors) {
    if (Object.keys(value).some(key => !Object.hasOwn(UNIT_PUCK_COLOR_DEFAULTS, key))
      || !/^#[0-9a-f]{6}$/i.test(value.player) || !/^#[0-9a-f]{6}$/i.test(value.enemy))
      throw new Error('Invalid unit puck colors');
    return value;
  }
  if (screenEffects) {
    const normalized = normalizeScreenEffects(value);
    if (Object.keys(value).some(key => !Object.hasOwn(DEFAULT_SCREEN_EFFECTS, key))
      || Object.keys(DEFAULT_SCREEN_EFFECTS).some(key => !Object.hasOwn(value, key))
      || Object.keys(DEFAULT_SCREEN_EFFECTS).some(key => normalized[key] !== value[key]))
      throw new Error('Invalid screen effects');
    return value;
  }
  if (itemMagnet) {
    const normalized = normalizeItemMagnetSettings(value);
    if (Object.keys(value).some(key => !Object.hasOwn(ITEM_MAGNET_DEFAULTS, key))
      || Object.keys(ITEM_MAGNET_DEFAULTS).some(key => !Object.hasOwn(value, key))
      || Object.keys(ITEM_MAGNET_DEFAULTS).some(key => normalized[key] !== value[key]))
      throw new Error('Invalid item magnet settings');
    return value;
  }
  if (prefabId) {
    if (!catalogPrefab(prefabId) || Object.keys(value).some(key => key !== 'size')
      || !Number.isFinite(value.size) || value.size < .1 || value.size > 30)
      throw new Error('Invalid prefab settings');
    return value;
  }
  const allowed = fog ? ['enabled', 'revealEnabled', 'start', 'end', 'color', 'tint', 'curve', 'revealInnerRadius', 'revealOuterRadius',
    'revealNoiseEnabled', 'revealNoiseType', 'revealNoiseSize', 'revealNoiseShift', 'revealNoiseMultiply',
    'revealNoiseSpeedX', 'revealNoiseSpeedY', 'revealCheckerSize', 'revealDepthFadeAdd', 'revealDepthFadeMultiply']
    : lighting ? ['direction', 'intensity', 'color'] : ['position', 'rotation', 'scale', 'asset', 'size', 'prefabId'];
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new Error('Unexpected scene value field');
  if (fog) {
    if ((value.enabled !== undefined && typeof value.enabled !== 'boolean')
      || (value.revealEnabled !== undefined && typeof value.revealEnabled !== 'boolean')
      || !Number.isFinite(value.start) || !Number.isFinite(value.end) || value.start < -20 || value.end > 60 || value.end - value.start < .1
      || !/^#[0-9a-f]{6}$/i.test(value.color) || !Number.isFinite(value.tint) || value.tint < 0 || value.tint > 1
      || !Number.isFinite(value.curve) || value.curve < .2 || value.curve > 4
      || (value.revealInnerRadius !== undefined && (!Number.isFinite(value.revealInnerRadius) || value.revealInnerRadius < 0 || value.revealInnerRadius > 480))
      || (value.revealOuterRadius !== undefined && (!Number.isFinite(value.revealOuterRadius) || value.revealOuterRadius < 1 || value.revealOuterRadius > 640))
      || (value.revealNoiseSize !== undefined && (!Number.isFinite(value.revealNoiseSize) || value.revealNoiseSize < 2 || value.revealNoiseSize > 160))
      || (value.revealNoiseEnabled !== undefined && typeof value.revealNoiseEnabled !== 'boolean')
      || (value.revealNoiseType !== undefined && !['voronoi', 'gaussian'].includes(value.revealNoiseType))
      || (value.revealNoiseShift !== undefined && (!Number.isFinite(value.revealNoiseShift) || value.revealNoiseShift < -1 || value.revealNoiseShift > 1))
      || (value.revealNoiseMultiply !== undefined && (!Number.isFinite(value.revealNoiseMultiply) || value.revealNoiseMultiply < 0 || value.revealNoiseMultiply > 2))
      || (value.revealNoiseSpeedX !== undefined && (!Number.isFinite(value.revealNoiseSpeedX) || value.revealNoiseSpeedX < -2 || value.revealNoiseSpeedX > 2))
      || (value.revealNoiseSpeedY !== undefined && (!Number.isFinite(value.revealNoiseSpeedY) || value.revealNoiseSpeedY < -2 || value.revealNoiseSpeedY > 2))
      || (value.revealCheckerSize !== undefined && (!Number.isFinite(value.revealCheckerSize) || value.revealCheckerSize < 1 || value.revealCheckerSize > 16))
      || (value.revealDepthFadeAdd !== undefined && (!Number.isFinite(value.revealDepthFadeAdd) || value.revealDepthFadeAdd < 0 || value.revealDepthFadeAdd > 4))
      || (value.revealDepthFadeMultiply !== undefined && (!Number.isFinite(value.revealDepthFadeMultiply) || value.revealDepthFadeMultiply < .05 || value.revealDepthFadeMultiply > 4))
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
    if ('asset' in value && (!catalogAsset(value.asset) || ('size' in value && (!Number.isFinite(value.size) || value.size < .1 || value.size > 30))
      || ('prefabId' in value && (!catalogPrefab(value.prefabId) || catalogPrefab(value.prefabId).asset !== value.asset))))
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
    restore(diff) {
      this.commit();
      if (diff?.format !== SCENE_DIFF_FORMAT || diff.baseBuild !== SCENE_BUILD || !Array.isArray(diff.changes) || diff.changes.length > 5000)
        throw new Error('Incompatible saved scene diff');
      const restored = [], seen = new Set();
      for (const change of diff.changes) {
        if (!change || typeof change.object !== 'string') throw new Error('Invalid saved scene change');
        const { location, object, before, after } = change;
        const key = id(location, object);
        if (records.has(key) || seen.has(key)) throw new Error(`Duplicate saved scene change: ${object}`);
        seen.add(key);
        const prefabId = object.startsWith('prefab:') ? object.slice(7) : null;
        const fog = object === 'fog', fogPaths = object === 'fog-paths', graph = object === 'campaign-graph',
          lighting = object === 'lighting', terrain = object === 'terrain', globalTerrainStyle = object === 'terrain-style',
          unitPuckColors = object === 'unit-puck-colors', screenEffects = object === 'screen-effects', itemMagnet = object === 'item-magnet';
        validateSceneValue(before, fog, fogPaths, graph, lighting, terrain, globalTerrainStyle, unitPuckColors, prefabId, screenEffects, itemMagnet);
        validateSceneValue(after, fog, fogPaths, graph, lighting, terrain, globalTerrainStyle, unitPuckColors, prefabId, screenEffects, itemMagnet);
        restored.push({ location, object, before: clone(before), after: clone(after) });
      }
      for (const entry of restored) records.set(id(entry.location, entry.object), entry);
      return restored.length;
    },
    replace(diff) {
      this.commit();
      if (diff?.format !== SCENE_DIFF_FORMAT || diff.baseBuild !== SCENE_BUILD || !Array.isArray(diff.changes) || diff.changes.length > 5000)
        throw new Error('Incompatible shared scene diff');
      const replacement = [], seen = new Set();
      for (const change of diff.changes) {
        if (!change || typeof change.object !== 'string') throw new Error('Invalid shared scene change');
        const { location, object, before, after } = change, key = id(location, object);
        if (seen.has(key)) throw new Error(`Duplicate shared scene change: ${object}`);
        seen.add(key);
        const prefabId = object.startsWith('prefab:') ? object.slice(7) : null;
        const fog = object === 'fog', fogPaths = object === 'fog-paths', graph = object === 'campaign-graph',
          lighting = object === 'lighting', terrain = object === 'terrain', globalTerrainStyle = object === 'terrain-style',
          unitPuckColors = object === 'unit-puck-colors', screenEffects = object === 'screen-effects', itemMagnet = object === 'item-magnet';
        validateSceneValue(before, fog, fogPaths, graph, lighting, terrain, globalTerrainStyle, unitPuckColors, prefabId, screenEffects, itemMagnet);
        validateSceneValue(after, fog, fogPaths, graph, lighting, terrain, globalTerrainStyle, unitPuckColors, prefabId, screenEffects, itemMagnet);
        const current = records.get(key);
        if (current && !equal(current.before, before)) throw new Error(`Shared scene baseline mismatch: ${object}`);
        replacement.push({ key, change: { location, object, before: clone(before), after: clone(after) } });
      }
      for (const entry of records.values()) entry.after = clone(entry.before);
      undo.length = 0; redo.length = 0;
      for (const { key, change } of replacement) {
        const current = records.get(key);
        if (current) current.after = clone(change.after);
        else records.set(key, change);
      }
      return replacement.length;
    },
    has(location, object) { return records.has(id(location, object)); },
    get(location, object) { const entry = records.get(id(location, object)); return entry ? clone(entry.after) : null; },
    begin() { if (!transaction) transaction = new Map(); },
    set(location, object, value) {
      validateSceneValue(value, object === 'fog', object === 'fog-paths', object === 'campaign-graph', object === 'lighting', object === 'terrain', object === 'terrain-style', object === 'unit-puck-colors', object.startsWith('prefab:') ? object.slice(7) : null, object === 'screen-effects', object === 'item-magnet');
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
    const prefabId = object.startsWith('prefab:') ? object.slice(7) : null;
    const fog = object === 'fog', fogPaths = object === 'fog-paths', graph = object === 'campaign-graph',
      lighting = object === 'lighting', terrain = object === 'terrain', globalTerrainStyle = object === 'terrain-style',
      unitPuckColors = object === 'unit-puck-colors', screenEffects = object === 'screen-effects', itemMagnet = object === 'item-magnet';
    if (fog ? location !== null && (typeof location !== 'string' || !/^[a-z0-9-]+$/.test(location))
      : graph || lighting || globalTerrainStyle || unitPuckColors || screenEffects || itemMagnet || prefabId ? location !== null : typeof location !== 'string' || !/^[a-z0-9-]+$/.test(location)
      || ['constructor', 'prototype'].includes(location)) throw new Error('Invalid scene location');
    validateSceneValue(before, fog, fogPaths, graph, lighting, terrain, globalTerrainStyle, unitPuckColors, prefabId, screenEffects, itemMagnet);
    validateSceneValue(after, fog, fogPaths, graph, lighting, terrain, globalTerrainStyle, unitPuckColors, prefabId, screenEffects, itemMagnet);
    if (before === null && after === null) throw new Error('An empty edit has no effect');
    if (before === null && (!object.startsWith('placed:') || !after.asset)) throw new Error('New objects must come from the asset library');
    const current = fog ? { ...FOG_DEFAULTS, ...result.fog, ...(location === null ? {} : result.locations[location]?.fog) } : lighting ? { ...LIGHTING_DEFAULTS, ...result.lighting }
      : globalTerrainStyle ? { ...TERRAIN_STYLE_DEFAULTS, ...result.terrainStyle }
      : unitPuckColors ? { ...UNIT_PUCK_COLOR_DEFAULTS, ...result.unitPuckColors }
      : screenEffects ? { ...DEFAULT_SCREEN_EFFECTS, ...result.screenEffects }
      : itemMagnet ? normalizeItemMagnetSettings(result.itemMagnet ?? ITEM_MAGNET_DEFAULTS)
        : prefabId ? result.prefabs?.[prefabId] ?? { size: catalogPrefab(prefabId)?.size }
      : graph ? result.graph ?? before : terrain ? result.locations[location]?.terrain ?? { strokes: [] }
        : result.locations[location]?.[object];
    const matches = (value, expected) => fog
      ? Object.keys(expected).every(key => equal(value?.[key], expected[key]))
      : equal(value, expected);
    if ((fog || lighting || graph || terrain || globalTerrainStyle || unitPuckColors || screenEffects || itemMagnet || prefabId || Object.hasOwn(result.locations[location] ?? {}, object)) && !matches(current, before) && !matches(current, after))
      throw new Error(`Scene edit conflict: ${location}/${object}`);
    if (fog && location === null) result.fog = { ...current, ...clone(after) };
    else if (fog) { result.locations[location] ??= {}; result.locations[location].fog = { ...current, ...clone(after) }; }
    else if (lighting) result.lighting = clone(after);
    else if (globalTerrainStyle) result.terrainStyle = clone(after);
    else if (unitPuckColors) result.unitPuckColors = clone(after);
    else if (screenEffects) result.screenEffects = clone(after);
    else if (itemMagnet) result.itemMagnet = clone(after);
    else if (prefabId) { result.prefabs ??= {}; result.prefabs[prefabId] = clone(after); }
    else if (graph) result.graph = clone(after);
    else { result.locations[location] ??= {}; result.locations[location][object] = clone(after); }
  }
  return result;
}
