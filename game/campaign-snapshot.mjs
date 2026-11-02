/** Capture serializable location state independently of its Three.js presentation. */
export function captureLocationSnapshot(location, { campaignState, actors, elapsed }) {
  if (!location.runtimeReady) return campaignState.world?.[location.id] ?? {};
  return {
    actors: actors.filter(actor => actor.spec.location === location.id)
      .map(actor => ({ id: actor.spec.id, x: actor.body.x, z: actor.body.z })),
    enemies: location.enemies.map(enemy => structuredClone(enemy)),
    spawners: Object.fromEntries((location.spawners ?? []).map(spawner => [spawner.userData.sceneEditId,
      { spawned: spawner.userData.sceneSpawnerState?.spawned ?? 0, timer: spawner.userData.sceneSpawnerState?.timer ?? 0 }])),
    defeats: location.defeats, goblinsSpawned: location.goblinsSpawned,
    reinforcementQueue: (location.reinforcementQueue ?? []).map(due => Math.max(0, due - elapsed)), bossSpawned: location.bossSpawned,
    initialized: location.initialized, combatTriggered: location.combatTriggered,
    lastExitPositions: structuredClone(location.lastExitPositions),
    openedPlacedChests: [...(location.openedPlacedChests ?? [])],
    collectedPlacedItems: [...(location.collectedPlacedItems ?? [])],
    loot: location.loot.map(({ id, itemId, x, z, amount, pickupBlocked }) => ({ id, itemId, x, z,
      ...(itemId === 'coins' ? { amount } : {}), ...(pickupBlocked ? { pickupBlocked: true } : {}) })),
  };
}

/** Snapshot all residents without serializing or writing storage from the application loop. */
export function persistCampaignSnapshot({ campaignState, activeLocation, heroBody, elapsed, locations, actors, repository }) {
  campaignState.currentLocationId = activeLocation.id;
  campaignState.playerHealth = heroBody.health;
  campaignState.playerPosition = { x: heroBody.x, z: heroBody.z };
  campaignState.lastSafePosition = { ...heroBody.lastSafePosition };
  campaignState.elapsed = elapsed;
  campaignState.world = Object.fromEntries(Object.values(locations).map(location => [location.id,
    captureLocationSnapshot(location, { campaignState, actors, elapsed })]));
  return repository.save(campaignState);
}
