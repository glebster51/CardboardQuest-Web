export const STATUS_EFFECTS = Object.freeze({
  regeneration: { label: 'Регенерация', kind: 'buff', locations: 2, tickEvery: 6, heal: 1 },
  fortified: { label: 'Крепость', kind: 'buff', locations: 2, defense: 1 },
  might: { label: 'Сила', kind: 'buff', locations: 2, damage: 1 },
  poison: { label: 'Отравление', kind: 'debuff', tickEvery: 2, damage: 1, ticks: 4 },
  burn: { label: 'Горение', kind: 'debuff', tickEvery: 1.5, damage: 1, ticks: 4 },
});

// Values are duration multipliers for enemy debuffs: 0 = immune, below 1 =
// resistant, above 1 = vulnerable. Unknown/future archetypes remain neutral.
export const ENEMY_STATUS_AFFINITIES = Object.freeze({
  goblin: Object.freeze({ poison: 1, burn: 1 }),
  slinger: Object.freeze({ poison: 1, burn: 1.5 }),
  boar: Object.freeze({ poison: 1.5, burn: .5 }),
  ogre: Object.freeze({ poison: .5, burn: .5 }),
  'acid-spitter': Object.freeze({ poison: 0, burn: 1.5 }),
  shellguard: Object.freeze({ poison: .5, burn: 1 }),
  burrower: Object.freeze({ poison: 1, burn: 1.5 }),
  flanker: Object.freeze({ poison: .5, burn: 1 }),
  'ember-moth': Object.freeze({ poison: 1.5, burn: 0 }),
  hexer: Object.freeze({ poison: .5, burn: 1.5 }),
});

export function enemyStatusAffinity(target, effectId) {
  if (target?.team !== 'enemy') return 1;
  return ENEMY_STATUS_AFFINITIES[target.archetype]?.[effectId] ?? 1;
}

const CONSUMABLE_EFFECT = Object.freeze({
  berries: 'regeneration', hardtack: 'fortified', jerky: 'might', bandage: 'regeneration',
});

export function normalizeStatusEffects(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap(effect => {
    const definition = STATUS_EFFECTS[effect?.id];
    if (!definition) return [];
    if (definition.kind === 'buff') {
      const remainingLocations = Math.max(0, Math.min(2, Math.trunc(Number(effect.remainingLocations) || 0)));
      return remainingLocations ? [{ id: effect.id, remainingLocations,
        tickIn: Math.max(0, Math.min(definition.tickEvery || 0, Number(effect.tickIn) || 0)) }] : [];
    }
    const remainingTicks = Math.max(0, Math.min(16, Math.trunc(Number(effect.remainingTicks) || 0)));
    return remainingTicks ? [{ id: effect.id, remainingTicks,
      tickIn: Math.max(0, Math.min(definition.tickEvery, Number(effect.tickIn) || 0)) }] : [];
  });
}

export function applyStatusEffect(target, id) {
  const definition = STATUS_EFFECTS[id];
  if (!definition) return false;
  const affinity = definition.kind === 'debuff' ? enemyStatusAffinity(target, id) : 1;
  if (affinity === 0) return false;
  const effects = normalizeStatusEffects(target.statusEffects);
  const previous = effects.find(effect => effect.id === id);
  if (definition.kind === 'buff') {
    if (previous) previous.remainingLocations = definition.locations;
    else effects.push({ id, remainingLocations: definition.locations, tickIn: 0 });
  } else {
    const durationTicks = Math.max(1, Math.round(definition.ticks * affinity));
    if (previous) previous.remainingTicks = durationTicks;
    else effects.push({ id, remainingTicks: durationTicks, tickIn: 0 });
  }
  target.statusEffects = effects;
  return true;
}

export function applyConsumableEffect(state, item) {
  if (item === 'bandage') state.statusEffects = (state.statusEffects ?? []).filter(effect => !['poison', 'burn'].includes(effect.id));
  const id = CONSUMABLE_EFFECT[item];
  if (!id) return null;
  applyStatusEffect(state, id);
  return STATUS_EFFECTS[id].label;
}

export function advanceStatusEffects(target, dt) {
  const effects = normalizeStatusEffects(target.statusEffects);
  let healing = 0, damage = 0;
  for (const effect of effects) {
    const definition = STATUS_EFFECTS[effect.id];
    if (!definition.tickEvery) continue;
    effect.tickIn += Math.max(0, dt);
    while (effect.tickIn >= definition.tickEvery && (effect.remainingTicks === undefined || effect.remainingTicks > 0)) {
      effect.tickIn -= definition.tickEvery;
      if (definition.heal) healing += definition.heal;
      else damage += definition.damage;
      if (effect.remainingTicks !== undefined) effect.remainingTicks--;
    }
  }
  target.statusEffects = effects.filter(effect => effect.remainingLocations > 0 || effect.remainingTicks > 0);
  return { healing, damage };
}

export function advanceStatusLocations(state) {
  state.statusEffects = normalizeStatusEffects(state.statusEffects).flatMap(effect => {
    if (effect.remainingLocations === undefined) return [effect];
    effect.remainingLocations--;
    return effect.remainingLocations > 0 ? [effect] : [];
  });
}

export function statusCombatBonuses(state) {
  return normalizeStatusEffects(state?.statusEffects).reduce((bonus, effect) => {
    const definition = STATUS_EFFECTS[effect.id];
    if (definition.kind !== 'buff') return bonus;
    bonus.damage += definition.damage ?? 0;
    bonus.defense += definition.defense ?? 0;
    return bonus;
  }, { damage: 0, defense: 0 });
}

export function statusEffectLabels(effects) {
  return normalizeStatusEffects(effects).map(effect => {
    const definition = STATUS_EFFECTS[effect.id];
    const duration = effect.remainingLocations !== undefined ? ` · ${effect.remainingLocations} локац.`
      : ` · ${Math.ceil(effect.remainingTicks * definition.tickEvery)}с`;
    return { id: effect.id, label: definition.label, kind: definition.kind, duration };
  });
}
