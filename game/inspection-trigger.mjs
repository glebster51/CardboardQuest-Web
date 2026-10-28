export function createInspectionTrigger() {
  let markerId = null;
  let inside = false;
  return {
    update(player, trigger, onEnter) {
      if (!player || !trigger || trigger.active === false) {
        markerId = null;
        inside = false;
        return false;
      }
      const radius = (player.radius ?? .8) + (trigger.radius ?? 0);
      const overlaps = Math.hypot(player.x - trigger.x, player.z - trigger.z) < radius;
      if (markerId !== trigger.id) {
        markerId = trigger.id;
        inside = overlaps;
        return false;
      }
      const entered = overlaps && !inside;
      inside = overlaps;
      if (entered) onEnter?.();
      return entered;
    },
  };
}
