function clone(value) {
  return structuredClone(value);
}

function restoreObject(target, source) {
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, clone(source));
}

/** Capture the living world immediately before the defeat presentation mutates it. */
export function captureDeathResumeSnapshot({ campaignState, activeLocationId, heroBody, figures }) {
  if (!campaignState || !heroBody || !Array.isArray(figures)) return null;
  return {
    campaignState: clone(campaignState),
    activeLocationId,
    figures: figures.map(figure => ({
      figure,
      body: figure.body,
      bodyState: clone(figure.body),
      visualState: figure.visualState,
      victoryAnimation: figure.victoryAnimation,
      victoryBaseYaw: figure.victoryBaseYaw,
      spawnAnimation: figure.spawnAnimation,
      viewBack: figure.viewBack,
      groupVisible: figure.group?.visible,
      groupPosition: figure.group?.position?.toArray(),
      groupRotation: figure.group?.rotation?.toArray(),
      healthHudVisible: figure.healthHUD?.visible,
      enemyMarkerVisible: figure.enemyMarker?.group?.visible,
    })),
  };
}

/** Restore the snapshot in-place so systems retaining campaign/body references remain valid. */
export function restoreDeathResumeSnapshot(snapshot, { campaignState, figures, heroBody, health = null }) {
  if (!snapshot || !campaignState || !Array.isArray(figures) || !heroBody) return null;
  restoreObject(campaignState, snapshot.campaignState);
  for (const saved of snapshot.figures) {
    const figure = saved.figure;
    if (!figures.includes(figure)) continue;
    if (figure.body !== saved.body) figure.body = saved.body;
    restoreObject(saved.body, saved.bodyState);
    figure.group.userData.figure = figure;
    figure.visualState = saved.visualState;
    figure.victoryAnimation = saved.victoryAnimation;
    figure.victoryBaseYaw = saved.victoryBaseYaw;
    figure.spawnAnimation = saved.spawnAnimation;
    figure.viewBack = saved.viewBack;
    if (figure.group && saved.groupPosition) figure.group.position.fromArray(saved.groupPosition);
    if (figure.group && saved.groupRotation) figure.group.rotation.fromArray(saved.groupRotation);
    if (figure.group && saved.groupVisible !== undefined) figure.group.visible = saved.groupVisible;
    if (figure.healthHUD && saved.healthHudVisible !== undefined) figure.healthHUD.visible = saved.healthHudVisible;
    if (figure.enemyMarker?.group && saved.enemyMarkerVisible !== undefined)
      figure.enemyMarker.group.visible = saved.enemyMarkerVisible;
  }
  if (Number.isFinite(health)) heroBody.health = Math.min(heroBody.maxHealth, Math.max(1, health));
  return { activeLocationId: snapshot.activeLocationId, figures: snapshot.figures.map(saved => saved.figure) };
}
