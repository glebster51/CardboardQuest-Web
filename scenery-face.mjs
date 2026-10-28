/** Keep camera-facing artwork selection stable after a cardboard prop falls. */
export function sceneryFaceForCamera(cameraOnFront, fallenFace = null) {
  if (fallenFace === 'front' || fallenFace === 'back') return fallenFace;
  return cameraOnFront ? 'front' : 'back';
}
