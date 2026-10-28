const CHECKPOINT_VERSION = 1;

/** Create the initial-location fallback checkpoint when a campaign has no prior exit snapshot. */
export function createLocationStartCheckpoint(campaignState, locationId = campaignState?.currentLocationId) {
  if (!campaignState || campaignState.version !== 1 || typeof locationId !== 'string') return null;
  const state = structuredClone(campaignState);
  delete state.entryCheckpoint;
  return { version: CHECKPOINT_VERSION, locationId, destinationId: null, state };
}

/** Save a compact snapshot just inside the exit before entering a new location. */
export function createEntryCheckpoint(campaignState, location, destinationId, isSafe = () => true) {
  if (!campaignState || !location?.id || typeof destinationId !== 'string') return null;
  const exit = location.exits?.find(item => item.to === destinationId);
  if (!exit) return null;
  const length = Math.hypot(exit.dirX ?? exit.x, exit.dirZ ?? exit.z) || 1;
  const direction = { x: exit.dirX ?? exit.x / length, z: exit.dirZ ?? exit.z / length };
  const retreat = Math.max(3, (exit.halfDepth ?? 1.3) + 2.5);
  let position = null;
  for (let extra = 0; extra <= 8; extra += .5) {
    const distance = retreat + extra;
    const candidate = { x: exit.x - direction.x * distance, z: exit.z - direction.z * distance };
    if (isSafe(candidate)) { position = candidate; break; }
  }
  if (!position) return null;

  const state = structuredClone(campaignState);
  delete state.entryCheckpoint;
  state.currentLocationId = location.id;
  state.playerPosition = position;
  state.lastSafePosition = { ...position };
  return { version: CHECKPOINT_VERSION, locationId: location.id, destinationId, state };
}

/** If the last autosave recorded death, resume at the preceding location checkpoint. */
export function restoreCampaignCheckpointAfterDeath(savedCampaign) {
  const checkpoint = savedCampaign?.entryCheckpoint, state = checkpoint?.state;
  if (savedCampaign?.version !== 1 || !(Number(savedCampaign.playerHealth) <= 0)
    || checkpoint?.version !== CHECKPOINT_VERSION || !state || state.version !== 1
    || checkpoint.locationId !== state.currentLocationId
    || !Number.isFinite(state.playerHealth) || state.playerHealth <= 0
    || !Number.isFinite(state.playerPosition?.x) || !Number.isFinite(state.playerPosition?.z)) return null;
  const restored = structuredClone(state);
  delete restored.entryCheckpoint;
  return restored;
}
