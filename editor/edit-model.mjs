export const SCENE_DIFF_FORMAT = 'cardboardquest.scene-diff.v1';
export const SCENE_BUILD = '124';
import { FOG_DEFAULTS } from '../fog-settings.mjs';
import { catalogAsset } from './asset-catalog.mjs';
export { FOG_DEFAULTS };
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
export function validateSceneValue(value, fog = false) {
  if (value === null && !fog) return value;
  if (!value || typeof value !== 'object') throw new Error('Scene value must be an object');
  const allowed = fog ? ['start', 'end', 'color', 'tint', 'curve'] : ['position', 'rotation', 'scale', 'asset', 'size'];
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new Error('Unexpected scene value field');
  if (fog) {
    if (!Number.isFinite(value.start) || !Number.isFinite(value.end) || value.start < -20 || value.end > 60 || value.end - value.start < .1
      || !/^#[0-9a-f]{6}$/i.test(value.color) || !Number.isFinite(value.tint) || value.tint < 0 || value.tint > 1
      || !Number.isFinite(value.curve) || value.curve < .2 || value.curve > 4) throw new Error('Invalid fog settings');
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
    get(location, object) { const entry = records.get(id(location, object)); return entry ? clone(entry.after) : null; },
    begin() { if (!transaction) transaction = new Map(); },
    set(location, object, value) {
      validateSceneValue(value, object === 'fog');
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
    const fog = object === 'fog';
    if (fog ? location !== null : typeof location !== 'string' || !/^[a-z0-9-]+$/.test(location)
      || ['constructor', 'prototype'].includes(location)) throw new Error('Invalid scene location');
    validateSceneValue(before, fog); validateSceneValue(after, fog);
    if (before === null && after === null) throw new Error('An empty edit has no effect');
    if (before === null && (!object.startsWith('placed:') || !after.asset)) throw new Error('New objects must come from the asset library');
    const current = fog ? { ...FOG_DEFAULTS, ...result.fog } : result.locations[location]?.[object];
    if ((fog || Object.hasOwn(result.locations[location] ?? {}, object)) && !equal(current, before) && !equal(current, after))
      throw new Error(`Scene edit conflict: ${location}/${object}`);
    if (fog) result.fog = clone(after);
    else { result.locations[location] ??= {}; result.locations[location][object] = clone(after); }
  }
  return result;
}
