// Artwork-space coordinates (top-left origin), including the flipped front idle print.
// Each pose and side has its own grip, free hand and head; these follow the art, not the camera.
const pose = (head, weapon, shield) => ({ helmet: { ...head, width: 1.26 },
  weapon: { ...weapon, height: .83, pivotY: -.58 }, shield: { ...shield, height: .66 } });
const point = (x, y, angle = 0) => ({ x, y, angle });
export const EQUIPMENT_POSES = Object.freeze({
  idle: {
    front: pose(point(.415, .275), point(.20, .815, 2.2), point(.63, .805, -.08)),
    back: pose(point(.50, .29), point(.695, .82, -2.16), point(.30, .81, .08)),
  },
  aiming: {
    front: pose(point(.54, .29, -.06), point(.245, .615, -.10), point(.57, .70, -.2)),
    back: pose(point(.49, .305, .06), point(.765, .59, .08), point(.33, .70, .2)),
  },
  attack: {
    front: pose(point(.465, .255, .06), point(.36, .64, .93), point(.83, .605, -.35)),
    back: pose(point(.455, .275, -.06), point(.715, .575, -1.0), point(.26, .63, .35)),
  },
  'deal-damage': {
    front: pose(point(.48, .255), point(.59, .69, -2.01), point(.43, .68, -.2)),
    back: pose(point(.48, .27), point(.66, .64, -.95), point(.27, .76, .2)),
  },
  'on-hit': {
    front: pose(point(.52, .125, -.08), point(.35, .47, .41), point(.78, .65, -.3)),
    back: pose(point(.48, .155, .08), point(.67, .49, -.55), point(.29, .56, .3)),
  },
  dead: {
    front: pose(point(.45, .28, .12), point(.86, .525, 2.53), point(.12, .62, -.7)),
    back: pose(point(.445, .445, -.12), point(.086, .57, -2.57), point(.83, .635, .7)),
  },
});
export function equipmentMount(poseName, side, slot, width, height) {
  const anchor = EQUIPMENT_POSES[poseName]?.[side]?.[slot];
  if (!anchor) throw new Error(`Missing equipment anchor: ${poseName}/${side}/${slot}`);
  return { ...anchor, x: (anchor.x - .5) * 2.05 * width / height, y: (.5 - anchor.y) * 2.05, z: .112 };
}
