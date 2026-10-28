export const DAY_NIGHT_STATES = Object.freeze([
  { id: 'dawn', label: 'Рассвет', period: 'day' },
  { id: 'morning', label: 'Утро', period: 'day' },
  { id: 'day', label: 'День', period: 'day' },
  { id: 'dusk', label: 'Сумерки', period: 'night' },
  { id: 'evening', label: 'Вечер', period: 'night' },
  { id: 'night', label: 'Ночь', period: 'night' },
]);

export function advanceDayNightClock(state = {}) {
  const previous = Math.max(0, Math.min(5, Math.trunc(Number(state.timeState) || 0)));
  const timeState = (previous + 1) % DAY_NIGHT_STATES.length;
  const newDay = previous === DAY_NIGHT_STATES.length - 1;
  return { timeState, dayNumber: Math.max(1, Math.trunc(Number(state.dayNumber) || 1)) + Number(newDay), newDay,
    state: DAY_NIGHT_STATES[timeState] };
}

export function resetEncounterSnapshot(snapshot = {}, { camp = false } = {}) {
  return { ...snapshot, enemies: [],
    spawners: Object.fromEntries(Object.keys(snapshot.spawners ?? {}).map(id => [id, { spawned: 0, timer: 0 }])),
    defeats: 0, ...(camp ? { goblinsSpawned: 0, reinforcementQueue: [], bossSpawned: false,
      initialized: false, combatTriggered: false } : {}) };
}
