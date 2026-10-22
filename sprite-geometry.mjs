const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function flipSpriteRgbaX(rgba, width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 || rgba.length !== width * height * 4) {
    throw new RangeError('Sprite pixels must match their dimensions');
  }
  const flipped = new Uint8ClampedArray(rgba.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const source = (y * width + x) * 4, target = (y * width + width - 1 - x) * 4;
    flipped.set(rgba.subarray(source, source + 4), target);
  }
  return flipped;
}

function signedArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

function simplifyOpen(points, tolerance) {
  if (points.length <= 2) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]], toleranceSq = tolerance * tolerance;
  while (stack.length) {
    const [first, last] = stack.pop();
    const a = points[first], b = points[last], dx = b.x - a.x, dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;
    let greatest = toleranceSq, greatestIndex = -1;
    for (let i = first + 1; i < last; i++) {
      const p = points[i];
      const t = lengthSq ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq, 0, 1) : 0;
      const distanceSq = (p.x - a.x - dx * t) ** 2 + (p.y - a.y - dy * t) ** 2;
      if (distanceSq > greatest) { greatest = distanceSq; greatestIndex = i; }
    }
    if (greatestIndex >= 0) {
      keep[greatestIndex] = 1;
      stack.push([first, greatestIndex], [greatestIndex, last]);
    }
  }
  return points.filter((_point, i) => keep[i]);
}

function simplifyClosed(points, tolerance) {
  if (points.length <= 8) return points;
  let start = 0, farthest = 0;
  for (let i = 0; i < points.length; i++) {
    const distanceSq = (points[i].x - points[0].x) ** 2 + (points[i].y - points[0].y) ** 2;
    if (distanceSq > farthest) { farthest = distanceSq; start = i; }
  }
  let end = start, diameterSq = 0;
  for (let i = 0; i < points.length; i++) {
    const distanceSq = (points[i].x - points[start].x) ** 2 + (points[i].y - points[start].y) ** 2;
    if (distanceSq > diameterSq) { diameterSq = distanceSq; end = i; }
  }
  const arc = (from, to) => {
    const result = [];
    for (let i = from; ; i = (i + 1) % points.length) {
      result.push(points[i]);
      if (i === to) return result;
    }
  };
  const a = simplifyOpen(arc(start, end), tolerance);
  const b = simplifyOpen(arc(end, start), tolerance);
  const result = [...a.slice(0, -1), ...b.slice(0, -1)];
  return result.length >= 3 ? result : points;
}

function findDeepConcavities(points, minArmLength, minDepth) {
  const orientation = Math.sign(signedArea(points)) || 1;
  const candidates = [];
  const probe = Math.max(2, Math.round(minArmLength));
  for (let i = 0; i < points.length; i++) {
    const previous = points[(i - probe + points.length) % points.length];
    const current = points[i];
    const next = points[(i + probe) % points.length];
    const incomingX = current.x - previous.x, incomingY = current.y - previous.y;
    const outgoingX = next.x - current.x, outgoingY = next.y - current.y;
    const incomingLength = Math.hypot(incomingX, incomingY);
    const outgoingLength = Math.hypot(outgoingX, outgoingY);
    if (Math.min(incomingLength, outgoingLength) < minArmLength) continue;
    const cross = incomingX * outgoingY - incomingY * outgoingX;
    const turn = Math.abs(Math.atan2(cross, incomingX * outgoingX + incomingY * outgoingY));
    if (cross * orientation >= 0 || turn < .12) continue;
    const chordDepth = Math.hypot(current.x - (previous.x + next.x) / 2,
      current.y - (previous.y + next.y) / 2);
    if (chordDepth < minDepth) continue;
    candidates.push({ index: i, score: chordDepth * turn, concave: true });
  }
  // Keep sharp outer tips too, so simplifying a nearby notch cannot shave off a
  // narrow printed point from a character pose or scenery silhouette.
  for (const [axis, direction] of [['x', 1], ['x', -1], ['y', 1], ['y', -1]]) {
    let index = -1, extreme = direction > 0 ? -Infinity : Infinity;
    for (let i = 0; i < points.length; i++) {
      const value = points[i][axis];
      if ((direction > 0 && value > extreme) || (direction < 0 && value < extreme)) { extreme = value; index = i; }
    }
    if (index < 0 || candidates.some(feature => feature.index === index)) continue;
    const previous = points[(index + points.length - 1) % points.length], current = points[index], next = points[(index + 1) % points.length];
    const ax = current.x - previous.x, ay = current.y - previous.y, bx = next.x - current.x, by = next.y - current.y;
    const turn = Math.abs(Math.atan2(ax * by - ay * bx, ax * bx + ay * by));
    if (turn >= .2) candidates.push({ index, score: turn * Math.max(minArmLength, 1), concave: false });
  }
  // Pixel contours may report several neighboring corners for one shallow
  // valley. Collapse each short run to its deepest representative, retaining
  // separate nearby valleys when the raw contour contains a real gap between.
  candidates.sort((a, b) => a.index - b.index);
  const separation = Math.max(5, probe * 2);
  const merged = [];
  for (const candidate of candidates) {
    const last = merged.at(-1);
    if (last && candidate.index - last.index <= separation) {
      if ((candidate.concave && !last.concave) || (candidate.concave === last.concave && candidate.score > last.score))
        merged[merged.length - 1] = candidate;
    } else merged.push({ ...candidate });
  }
  if (merged.length > 1 && merged[0].index + points.length - merged.at(-1).index <= separation) {
    const first = merged[0], last = merged.at(-1);
    if ((last.concave && !first.concave) || (last.concave === first.concave && last.score > first.score)) merged[0] = last;
    merged.pop();
  }
  return merged;
}

function simplifyClosedKeepingFeatures(points, tolerance, features) {
  if (!features.length) return { points: simplifyClosed(points, tolerance), featurePositions: [] };
  const anchors = [...new Set(features.map(feature => feature.index))].sort((a, b) => a - b);
  const output = [], featurePositions = [], concaveIndices = new Set(features.filter(feature => feature.concave).map(feature => feature.index));
  for (let i = 0; i < anchors.length; i++) {
    const start = anchors[i], end = anchors[(i + 1) % anchors.length], arc = [];
    for (let index = start; ; index = (index + 1) % points.length) {
      arc.push(points[index]);
      if (index === end) break;
    }
    if (concaveIndices.has(start)) featurePositions.push(output.length);
    output.push(...simplifyOpen(arc, tolerance).slice(0, -1));
  }
  return { points: output.length >= 3 ? output : points, featurePositions };
}

function resampleClosed(points, spacing) {
  const lengths = points.map((point, i) => {
    const next = points[(i + 1) % points.length];
    return Math.hypot(next.x - point.x, next.y - point.y);
  });
  const perimeter = lengths.reduce((sum, length) => sum + length, 0);
  const count = clamp(Math.round(perimeter / spacing), 12, 224);
  const result = [];
  let segment = 0, traversed = 0;
  for (let i = 0; i < count; i++) {
    const distance = perimeter * i / count;
    while (segment < lengths.length - 1 && traversed + lengths[segment] < distance) traversed += lengths[segment++];
    const a = points[segment], b = points[(segment + 1) % points.length];
    const t = lengths[segment] > 0 ? (distance - traversed) / lengths[segment] : 0;
    result.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return result;
}

function resampleClosedKeepingFeatures(points, spacing, pinnedIndices) {
  if (pinnedIndices.length < 2) return resampleClosed(points, spacing);
  const lengths = points.map((point, i) => {
    const next = points[(i + 1) % points.length];
    return Math.hypot(next.x - point.x, next.y - point.y);
  });
  const perimeter = lengths.reduce((sum, length) => sum + length, 0);
  const count = clamp(Math.round(perimeter / spacing), 12, 224);
  const anchors = [...new Set(pinnedIndices)].sort((a, b) => a - b);
  if (anchors.length >= count) return resampleClosed(points, spacing);
  const arcs = anchors.map((start, anchorIndex) => {
    const end = anchors[(anchorIndex + 1) % anchors.length], segments = [];
    let index = start;
    while (index !== end) { segments.push(index); index = (index + 1) % points.length; }
    return { start, segments, length: segments.reduce((sum, segment) => sum + lengths[segment], 0) };
  });
  const remaining = count - arcs.length;
  const shares = arcs.map(arc => {
    const ideal = perimeter > 0 ? arc.length / perimeter * remaining : 0;
    return { intervals: 1 + Math.floor(ideal), fraction: ideal - Math.floor(ideal) };
  });
  let assigned = shares.reduce((sum, share) => sum + share.intervals, 0);
  while (assigned < count) {
    const target = shares.reduce((best, share, index) => share.fraction > shares[best].fraction ? index : best, 0);
    shares[target].intervals++; shares[target].fraction = -1; assigned++;
  }
  while (assigned > count) {
    let target = -1;
    for (let i = 0; i < shares.length; i++) if (shares[i].intervals > 1 && (target < 0 || shares[i].fraction < shares[target].fraction)) target = i;
    if (target < 0) return resampleClosed(points, spacing);
    shares[target].intervals--; assigned--;
  }
  const sampleArc = (arc, distance) => {
    let traversed = 0;
    for (const segment of arc.segments) {
      const length = lengths[segment];
      if (distance <= traversed + length || segment === arc.segments.at(-1)) {
        const a = points[segment], b = points[(segment + 1) % points.length];
        const t = length > 0 ? clamp((distance - traversed) / length, 0, 1) : 0;
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      }
      traversed += length;
    }
    return points[arc.start];
  };
  return arcs.flatMap((arc, i) => Array.from({ length: shares[i].intervals }, (_unused, step) =>
    sampleArc(arc, arc.length * step / shares[i].intervals)));
}

function traceLoops(mask, width, height) {
  const edges = [], starts = new Map();
  const filled = (x, y) => x >= 0 && y >= 0 && x < width && y < height && mask[y * width + x] !== 0;
  const add = (ax, ay, bx, by) => edges.push({ ax, ay, bx, by, used: false });
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (filled(x, y)) {
    if (!filled(x, y - 1)) add(x, y, x + 1, y);
    if (!filled(x + 1, y)) add(x + 1, y, x + 1, y + 1);
    if (!filled(x, y + 1)) add(x + 1, y + 1, x, y + 1);
    if (!filled(x - 1, y)) add(x, y + 1, x, y);
  }
  edges.forEach((edge, i) => {
    const key = `${edge.ax},${edge.ay}`;
    if (!starts.has(key)) starts.set(key, []);
    starts.get(key).push(i);
  });
  const loops = [];
  for (let first = 0; first < edges.length; first++) {
    if (edges[first].used) continue;
    const points = [];
    let index = first;
    for (let guard = 0; guard <= edges.length; guard++) {
      const edge = edges[index];
      if (edge.used) break;
      edge.used = true;
      points.push({ x: edge.ax, y: edge.ay });
      const key = `${edge.bx},${edge.by}`;
      if (key === `${edges[first].ax},${edges[first].ay}`) break;
      const choices = (starts.get(key) || []).filter(candidate => !edges[candidate].used);
      if (!choices.length) break;
      const dx = edge.bx - edge.ax, dy = edge.by - edge.ay;
      choices.sort((left, right) => {
        const rank = candidate => {
          const next = edges[candidate];
          const cross = dx * (next.by - next.ay) - dy * (next.bx - next.ax);
          const dot = dx * (next.bx - next.ax) + dy * (next.by - next.ay);
          const angle = (Math.atan2(cross, dot) + Math.PI * 2) % (Math.PI * 2);
          return angle < .01 ? 1 : angle < Math.PI ? 0 : 2;
        };
        return rank(left) - rank(right);
      });
      index = choices[0];
    }
    if (points.length >= 3) loops.push(points);
  }
  return loops;
}

function insetOpaqueMask(mask, width, height, insetPixels) {
  if (!(insetPixels > 0)) return mask;
  const radius = Math.ceil(insetPixels), inset = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const index = y * width + x;
    if (!mask[index]) continue;
    let nearestTransparentSq = Infinity;
    for (let oy = -radius; oy <= radius; oy++) for (let ox = -radius; ox <= radius; ox++) {
      const distanceSq = ox * ox + oy * oy;
      if (distanceSq > insetPixels * insetPixels) continue;
      const nx = x + ox, ny = y + oy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height || !mask[ny * width + nx])
        nearestTransparentSq = Math.min(nearestTransparentSq, distanceSq);
    }
    if (nearestTransparentSq > insetPixels * insetPixels) inset[index] = 1;
  }
  return inset;
}

export function traceSpriteContours(alpha, width, height, worldWidth, worldHeight, options = {}) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || alpha.length !== width * height) {
    throw new RangeError('Sprite alpha mask must match its dimensions');
  }
  const maxDimension = options.maxDimension ?? 256;
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const gridWidth = Math.max(2, Math.round(width * scale));
  const gridHeight = Math.max(2, Math.round(height * scale));
  const mask = new Uint8Array(gridWidth * gridHeight);
  for (let y = 0; y < gridHeight; y++) for (let x = 0; x < gridWidth; x++) {
    const sx = Math.min(width - 1, Math.floor((x + .5) * width / gridWidth));
    const sy = Math.min(height - 1, Math.floor((y + .5) * height / gridHeight));
    // Keep the mesh edge on the same alpha boundary as the printed cap
    // (MeshStandardMaterial.alphaTest is .5, i.e. 128/255).
    mask[y * gridWidth + x] = alpha[sy * width + sx] >= (options.threshold ?? 128) ? 1 : 0;
  }
  // Let the printed cap cover the outer cardboard edge. Perspective exposes
  // the sidewall, while the alpha artwork remains the visual silhouette.
  // This deliberate inset is measured in contour pixels; set it to zero for
  // diagnostics. Euclidean erosion rounds corners without moving valley tips.
  const extrusionMask = insetOpaqueMask(mask, gridWidth, gridHeight, options.insetPixels ?? 2);
  const raw = traceLoops(extrusionMask, gridWidth, gridHeight);
  const normalized = raw.map(points => points.map(p => ({
    x: (p.x / gridWidth - .5) * worldWidth,
    y: (.5 - p.y / gridHeight) * worldHeight,
  })));
  // Simplify in the source-mask's pixel scale. The old world-size / 64
  // tolerance was several pixels wide and cubic handles then overshot the
  // printed silhouette, leaving a visible halo/gap between art and cardboard.
  const pixelSize = Math.max(worldWidth / gridWidth, worldHeight / gridHeight);
  const simplifyTolerance = pixelSize * .35;
  const contours = normalized.map((loop, index) => {
    // Detect valleys on the untouched pixel contour, before simplification can
    // erase shallow concave corners. The pixel-scale thresholds are deliberately
    // lower than the old post-simplification test to catch narrow character folds.
    const rawFeatures = findDeepConcavities(raw[index], 2, .45);
    const simplified = simplifyClosedKeepingFeatures(loop, simplifyTolerance, rawFeatures);
    return { points: simplified.points, features: simplified.featurePositions };
  });
  // Sample the faithful, simplified polyline evenly. Do not spline across the
  // alpha boundary. Concavities remain pinned through resampling.
  const spacing = pixelSize * 1.25;
  let sampled = contours.map(contour => resampleClosedKeepingFeatures(contour.points, spacing, contour.features));
  const total = sampled.reduce((sum, loop) => sum + loop.length, 0);
  if (total > 256) {
    const factor = total / 256;
    sampled = contours.map(contour => resampleClosedKeepingFeatures(contour.points, spacing * factor, contour.features));
  }
  const sorted = sampled.map(points => ({ points, area: Math.abs(signedArea(points)) }))
    .sort((a, b) => b.area - a.area);
  const contains = (p, polygon) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i], b = polygon[j];
      if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  };
  for (let i = 0; i < sorted.length; i++) {
    sorted[i].depth = 0;
    for (let j = 0; j < i; j++) if (contains(sorted[i].points[0], sorted[j].points)) {
      sorted[i].depth = sorted[j].depth + 1;
      break;
    }
  }
  return sorted.map(({ points, depth }) => ({ points, depth, clockwise: signedArea(points) < 0 }));
}

export function validateSpriteFrames(states, backFrame) {
  if (!states.length) throw new Error('Sprite set is empty');
  const { width, height } = states[0];
  if (states.some(frame => frame.width !== width || frame.height !== height)) {
    throw new Error('Visual states must share one canonical frame');
  }
  if (!backFrame || !Number.isFinite(backFrame.width / backFrame.height)) throw new Error('Back sprite has invalid dimensions');
  const backScale = Math.min(width / backFrame.width, height / backFrame.height);
  const backWidth = backFrame.width * backScale, backHeight = backFrame.height * backScale;
  return { width, height, backScale, backWidth, backHeight,
    backX: (width - backWidth) / 2, backY: (height - backHeight) / 2 };
}

export function spriteAlphaBounds(rgba, width, height, threshold = 128) {
  if (rgba.length !== width * height * 4) throw new RangeError('Sprite bounds dimensions must match the pixel data');
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (rgba[(y * width + x) * 4 + 3] < threshold) continue;
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  if (maxX < minX || maxY < minY) throw new RangeError('Sprite has no opaque pixels');
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

export function fitSpriteBounds(source, target) {
  if (!(source.width > 0 && source.height > 0 && target.width > 0 && target.height > 0)) throw new RangeError('Sprite bounds must have positive dimensions');
  const scale = Math.min(target.width / source.width, target.height / source.height);
  const width = source.width * scale, height = source.height * scale;
  return { x: target.x + (target.width - width) / 2, y: target.y + (target.height - height) / 2, width, height };
}

export function unionSpriteAlpha(frontRGBA, backRGBA, width, height, minimumIslandPixels = 12) {
  if (frontRGBA.length !== backRGBA.length || frontRGBA.length % 4 !== 0) throw new RangeError('Front and back textures must share a frame');
  const pixelCount = frontRGBA.length / 4;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width * height !== pixelCount) throw new RangeError('Sprite alpha union dimensions must match the pixel data');
  const mask = new Uint8Array(pixelCount);
  for (let i = 0; i < pixelCount; i++) mask[i] = frontRGBA[i * 4 + 3] >= 81 || backRGBA[i * 4 + 3] >= 81 ? 1 : 0;
  const visited = new Uint8Array(pixelCount), output = new Uint8Array(frontRGBA.length);
  const stack = [];
  for (let start = 0; start < pixelCount; start++) {
    if (!mask[start] || visited[start]) continue;
    stack.length = 0; stack.push(start); visited[start] = 1;
    const component = [];
    while (stack.length) {
      const index = stack.pop(); component.push(index);
      const x = index % width, y = (index / width) | 0;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        if (!ox && !oy) continue;
        const nx = x + ox, ny = y + oy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const neighbor = ny * width + nx;
        if (mask[neighbor] && !visited[neighbor]) { visited[neighbor] = 1; stack.push(neighbor); }
      }
    }
    if (component.length >= minimumIslandPixels) for (const index of component) output[index * 4 + 3] = 255;
  }
  return output;
}

export function clipSpriteToAlphaMask(pixels, mask) {
  if (pixels.length !== mask.length || pixels.length % 4 !== 0) throw new RangeError('Sprite and clipping mask must share a frame');
  const result = new Uint8ClampedArray(pixels);
  for (let i = 3; i < result.length; i += 4) result[i] = Math.round(result[i] * mask[i] / 255);
  return result;
}

