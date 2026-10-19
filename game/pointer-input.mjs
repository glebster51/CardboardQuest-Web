import { clampPull, facingAngle, MAX_PULL } from '../physics.mjs';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** Bind the tabletop pointer, drag-to-aim, orbit, and zoom gestures. */
export function createPointerInput({ THREE, host, inputElement = host, camera, orbit, playerMarker, windowRef = window,
  getBody, getActiveFigure, hitFigure, choose, stopAim, onLaunch,
  groundUiY, aimDragSensitivity = 1 / 3, maxAimMarkerExtension }) {
  const pointers = new Map();
  let gesture = null;

  function cancel() {
    stopAim();
    gesture = null;
    pointers.clear();
  }

  function release(event, cancelled) {
    if (!pointers.has(event.pointerId)) return;
    if (gesture?.pointer === event.pointerId) {
      if (gesture.mode === 'aim') {
        const body = getBody();
        if (!cancelled && gesture.moved && body.team === 'player' && body.health > 0 && body.charges > 0) {
          onLaunch(body, gesture.pull);
        } else if (!cancelled) choose(gesture.hit);
        stopAim();
      }
      gesture = null;
    }
    if (gesture?.mode === 'touchOrbit') gesture = null;
    pointers.delete(event.pointerId);
    if (pointers.size === 0) gesture = null;
  }

  inputElement.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button !== 0 && event.button !== 2) return;
    event.preventDefault();
    try { event.target.setPointerCapture(event.pointerId); } catch { /* Window listeners still track the drag. */ }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size > 1) {
      stopAim();
      const points = [...pointers.values()];
      gesture = { mode: 'touchOrbit', pinchStart: Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y),
        zoomStart: orbit.distance, lastX: (points[0].x + points[1].x) / 2, lastY: (points[0].y + points[1].y) / 2 };
      return;
    }
    if (event.button === 2 || event.altKey) {
      gesture = { mode: 'orbit', pointer: event.pointerId, startX: event.clientX, startY: event.clientY,
        lastX: event.clientX, lastY: event.clientY, moved: false };
      return;
    }

    const hit = hitFigure(event.clientX, event.clientY);
    if (hit?.body.team === 'player') choose(hit);
    if (hit?.body.team === 'enemy') {
      gesture = { mode: 'blocked', pointer: event.pointerId };
    } else if (hit) {
      const body = getBody();
      gesture = body.charges > 0 && body.health > 0
        ? { mode: 'aim', pointer: event.pointerId, pull: { x: 0, z: 0 }, hit,
          startX: event.clientX, startY: event.clientY, moved: false }
        : { mode: 'blocked', pointer: event.pointerId };
    } else {
      gesture = { mode: 'orbit', pointer: event.pointerId, startX: event.clientX, startY: event.clientY,
        lastX: event.clientX, lastY: event.clientY, moved: false };
    }
  });

  windowRef.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId) || !gesture) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (gesture.mode === 'touchOrbit') {
      if (pointers.size >= 2) {
        const points = [...pointers.values()];
        const x = (points[0].x + points[1].x) / 2, y = (points[0].y + points[1].y) / 2;
        const pinch = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
        orbit.distance = clamp(gesture.zoomStart * gesture.pinchStart / Math.max(1, pinch), 4.5, 27);
        orbit.theta -= (x - gesture.lastX) * .007;
        orbit.phi = clamp(orbit.phi - (y - gesture.lastY) * .005, .35, 1.3);
        gesture.lastX = x; gesture.lastY = y;
      }
      return;
    }
    if (event.pointerId !== gesture.pointer || gesture.mode === 'blocked') return;
    if (Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > 7) gesture.moved = true;
    if (gesture.mode === 'aim') {
      if (!gesture.moved) return;
      const body = getBody();
      const figure = getActiveFigure();
      if (!gesture.aimStarted) {
        body.vx = 0; body.vz = 0;
        gesture.aimStarted = true;
        host.classList.add('aiming');
      }
      choose(figure);
      const scale = 2 * orbit.distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / windowRef.innerHeight;
      const dx = (event.clientX - gesture.startX) * scale;
      const dz = (event.clientY - gesture.startY) * scale / Math.cos(orbit.phi);
      gesture.pull = clampPull((Math.cos(orbit.theta) * dx + Math.sin(orbit.theta) * dz) * aimDragSensitivity,
        (-Math.sin(orbit.theta) * dx + Math.cos(orbit.theta) * dz) * aimDragSensitivity);
      const direction = new THREE.Vector3(-gesture.pull.x, 0, -gesture.pull.z);
      const length = direction.length();
      playerMarker.setExtension(length > .02 ? length / MAX_PULL * maxAimMarkerExtension : 0);
      if (length > .06) {
        figure.facing = facingAngle(direction.x, direction.z, figure.facing);
        playerMarker.group.position.set(body.x, groundUiY, body.z);
        playerMarker.group.rotation.y = figure.facing;
      }
    } else {
      const dx = event.clientX - gesture.lastX, dy = event.clientY - gesture.lastY;
      orbit.theta -= dx * .007;
      orbit.phi = clamp(orbit.phi - dy * .005, .35, 1.3);
      gesture.lastX = event.clientX; gesture.lastY = event.clientY;
    }
  });

  windowRef.addEventListener('pointerup', event => release(event, false));
  windowRef.addEventListener('pointercancel', event => release(event, true));
  windowRef.addEventListener('lostpointercapture', event => release(event, true));
  inputElement.addEventListener('contextmenu', event => event.preventDefault());
  inputElement.addEventListener('wheel', event => {
    event.preventDefault();
    const pixels = event.deltaY * (event.deltaMode === windowRef.WheelEvent.DOM_DELTA_LINE ? 16
      : event.deltaMode === windowRef.WheelEvent.DOM_DELTA_PAGE ? windowRef.innerHeight : 1);
    if (Number.isFinite(pixels)) orbit.distance = clamp(orbit.distance * Math.exp(clamp(pixels, -240, 240) * .0012), 4.5, 27);
  }, { passive: false });
  windowRef.addEventListener('blur', cancel);

  return { cancel, getHeldBody: () => gesture?.mode === 'aim' ? getBody() : null };
}
