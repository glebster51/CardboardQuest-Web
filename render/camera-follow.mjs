/** Smoothly rotate the camera to trail the current XZ motion direction. */
export function followMotion(theta, vx, vz, dt, response = 2.4, minSpeed = .25) {
  if (dt <= 0 || Math.hypot(vx, vz) < minSpeed) return theta;
  const target = Math.atan2(vx, vz) + Math.PI;
  const delta = Math.atan2(Math.sin(target - theta), Math.cos(target - theta));
  return theta + delta * (1 - Math.exp(-response * dt));
}
