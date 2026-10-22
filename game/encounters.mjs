// Place units on authored dry ground, with different silhouettes and tactics.
export const STORY_ENCOUNTERS = [
  { location: 'broken-bridge', units: [
    { id: 'goblin-1', type: 'goblin', x: -2, z: 5 },
    { id: 'goblin-2', type: 'slinger', x: 3.5, z: 5.2 },
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
  goblin: { health: 32, maxHealth: 32, damageQuarters: 4, radius: .62 },
  slinger: { health: 24, maxHealth: 24, damageQuarters: 2, radius: .58 },
  boar: { health: 24, maxHealth: 24, damageQuarters: 6, radius: .74 },
  ogre: { health: 64, maxHealth: 64, damageQuarters: 8, radius: 1.02 },
  'acid-spitter': { health: 20, maxHealth: 20, damageQuarters: 1, radius: .72 },
  shellguard: { health: 40, maxHealth: 40, damageQuarters: 5, radius: .9 },
  burrower: { health: 24, maxHealth: 24, damageQuarters: 4, radius: .7 },
  flanker: { health: 28, maxHealth: 28, damageQuarters: 4, radius: .72 },
  'ember-moth': { health: 16, maxHealth: 16, damageQuarters: 3, radius: .58 },
  hexer: { health: 18, maxHealth: 18, damageQuarters: 2, radius: .68 },
};
