/** Live figures own their scene attachment and participation in global puck updates. */
export function createFigureRegistry(scene) {
  const pucks = new Set();
  return {
    attach(figure) {
      if (!figure || figure.sceneAttached) return figure;
      scene.add(figure.group, figure.healthHUD);
      if (figure.enemyMarker?.group) scene.add(figure.enemyMarker.group);
      pucks.add(figure.puckEntry); figure.sceneAttached = true;
      return figure;
    },
    detach(figure) {
      pucks.delete(figure.puckEntry); figure.sceneAttached = false;
      const roots = [figure.group, figure.healthHUD, figure.enemyMarker?.group].filter(Boolean);
      for (const root of roots) root.removeFromParent();
      return roots;
    },
    setColors(colors) {
      for (const { base, team } of pucks) for (const material of [base.material].flat()) material.color.set(colors[team]);
    },
  };
}
