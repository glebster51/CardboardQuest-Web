const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

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

function smoothClosed(points) {
  const smooth = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    smooth.push({ x: a.x * .75 + b.x * .25, y: a.y * .75 + b.y * .25 });
    smooth.push({ x: a.x * .25 + b.x * .75, y: a.y * .25 + b.y * .75 });
  }
  return smooth;
}

function resampleClosed(points, spacing) {
  const lengths = points.map((p, i) => {
    const q = points[(i + 1) % points.length];
    return Math.hypot(q.x - p.x, q.y - p.y);
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
    mask[y * gridWidth + x] = alpha[sy * width + sx] >= (options.threshold ?? 81) ? 1 : 0;
  }
  const raw = traceLoops(mask, gridWidth, gridHeight);
  const normalized = raw.map(points => points.map(p => ({
    x: (p.x / gridWidth - .5) * worldWidth,
    y: (.5 - p.y / gridHeight) * worldHeight,
  })));
  const simplifyTolerance = Math.max(worldWidth, worldHeight) / 256;
  const smooth = normalized.map(loop => {
    let result = simplifyClosed(loop, simplifyTolerance);
    result = smoothClosed(result);
    result = smoothClosed(result);
    return result;
  });
  const spacing = Math.max(worldWidth, worldHeight) / 96;
  let contours = smooth.map(loop => resampleClosed(loop, spacing));
  const total = contours.reduce((sum, loop) => sum + loop.length, 0);
  if (total > 256) {
    const factor = total / 256;
    contours = smooth.map(loop => resampleClosed(loop, spacing * factor));
  }
  const sorted = contours.map(points => ({ points, area: Math.abs(signedArea(points)) }))
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

