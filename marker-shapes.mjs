const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function quadratic(start, control, end, steps) {
  const points = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps, oneMinus = 1 - t;
    points.push({
      x: oneMinus * oneMinus * start.x + 2 * oneMinus * t * control.x + t * t * end.x,
      y: oneMinus * oneMinus * start.y + 2 * oneMinus * t * control.y + t * t * end.y,
    });
  }
  return points;
}

function contour(radius, extension, segments) {
  if (extension <= 0) return Array.from({ length: segments }, (_, i) => {
    const angle = Math.PI * 2 * i / segments;
    return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
  });

  const points = [];
  for (let i = 0; i <= segments / 2; i++) {
    const angle = Math.PI + Math.PI * i / (segments / 2);
    points.push({ x: radius * Math.cos(angle), y: radius * Math.sin(angle) });
  }
  const right = { x: radius, y: 0 };
  const shoulderY = Math.max(radius * .58, radius + extension - radius * .82);
  points.push(...quadratic(right, { x: radius, y: radius * .3 }, { x: radius, y: radius * .58 }, Math.max(3, Math.round(segments / 12))));
  if (shoulderY > radius * .58) points.push({ x: radius, y: shoulderY });
  points.push({ x: 0, y: radius + extension }, { x: -radius, y: shoulderY });
  if (shoulderY > radius * .58) points.push({ x: -radius, y: radius * .58 });
  points.push(...quadratic({ x: -radius, y: radius * .58 }, { x: -radius, y: radius * .3 }, { x: -radius, y: 0 }, Math.max(3, Math.round(segments / 12))));
  return points;
}

export function createMarkerContours(radius = 1.13, extension = 0, border = .26, segments = 48) {
  if (!(radius > border && border > 0) || !Number.isFinite(extension) || extension < 0 || segments < 12) {
    throw new RangeError('Marker dimensions are invalid');
  }
  const outer = contour(radius, extension, segments);
  const innerRadius = radius - border;
  const innerExtension = Math.max(0, extension - border * .55);
  const inner = contour(innerRadius, innerExtension, segments);
  return { outer, inner };
}

export function markerFillTransform(progress, backEdge) {
  const amount = clamp(progress, 0, 1);
  return { scaleY: amount, offsetY: amount === 1 ? 0 : backEdge * (1 - amount) };
}
