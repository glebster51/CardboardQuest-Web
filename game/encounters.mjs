// Place units on authored dry ground, with different silhouettes and tactics.
export const STORY_ENCOUNTERS = [
  { location: 'broken-bridge', units: [
    { id: 'goblin-1', type: 'goblin', x: -3.2, z: -1.6 },
    { id: 'goblin-2', type: 'slinger', x: 3.5, z: -2.2 },
  ] },
  { location: 'ash-road', units: [{ id: 'boar-1', type: 'boar', x: 0, z: 3.9 }] },
  { location: 'goblin-watch', units: [
    { id: 'slinger-1', type: 'slinger', x: -2.8, z: -.6 },
    { id: 'slinger-2', type: 'slinger', x: 3.4, z: -2.3 },
  ] },
  { location: 'quarry', units: [
    { id: 'goblin-1', type: 'goblin', x: -3.5, z: .2 },
    { id: 'goblin-2', type: 'slinger', x: 4.8, z: -2.6 },
  ] },
  { location: 'peat-marsh', units: [{ id: 'slinger-1', type: 'slinger', x: 1, z: 4.7 }] },
  { location: 'bone-gate', units: [
    { id: 'goblin-1', type: 'goblin', x: 0, z: -2.7 },
    { id: 'slinger-1', type: 'slinger', x: 3.8, z: -3.8 },
  ] },
  { location: 'hollow-tree', units: [{ id: 'boar-1', type: 'boar', x: 3.7, z: 1.7 }] },
];

export const ENEMY_STATS = {
  goblin: { health: 32, maxHealth: 32, damageQuarters: 4 },
  slinger: { health: 24, maxHealth: 24, damageQuarters: 2 },
  boar: { health: 24, maxHealth: 24, damageQuarters: 6 },
};
