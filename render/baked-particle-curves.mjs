// Fourier sine residuals over a linear trend. Non-periodic endpoints stay pinned.
export const FOURIER_PARTICLE_CODEC = 'fourier-linear-v1';
export const PARTICLE_CURVE_CHANNELS = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,24,25,26,27];
const caches = new WeakMap();

export function evaluateParticleCurve(data, offset, frame) {
  let cursor = offset + 1;
  for (let segment = 0; segment < data[offset]; segment++) {
    const start = data[cursor], end = data[cursor+1], base = data[cursor+2], slope = data[cursor+3];
    const terms = data[cursor+4]; cursor += 5;
    if (frame <= end || segment === data[offset]-1) {
      const t = end > start ? Math.max(0, Math.min(1, (frame-start)/(end-start))) : 0;
      let value = base + slope*t;
      // sin(k*pi) should be exactly zero at the authored endpoints.
      if (t > 0 && t < 1) for (let term=0; term<terms; term++)
        value += data[cursor+term*2+1]*Math.sin(data[cursor+term*2]*Math.PI*t);
      return value;
    }
    cursor += terms*2;
  }
  return 0;
}

export function sampleFourierParticleTrack(assets, track, frame, out) {
  const { data } = assets, offset = track.offset;
  const presenceCount = data[offset], uvCount = data[offset+1], first = Math.floor(frame+1e-7);
  let cursor = offset+2+PARTICLE_CURVE_CHANNELS.length, alive = false;
  for (let run=0; run<presenceCount; run++, cursor+=2)
    if (first >= data[cursor] && first < data[cursor+1]) alive = true;
  if (!alive) { out.fill(0); return false; }
  let cache = caches.get(assets);
  if (!cache) { cache = new Map(); caches.set(assets, cache); }
  out[0] = 1;
  for (let channel=0; channel<PARTICLE_CURVE_CHANNELS.length; channel++) {
    const curve = data[offset+2+channel];
    let entry = cache.get(curve);
    if (!entry) { entry = { frame:NaN, value:0 }; cache.set(curve, entry); }
    if (entry.frame !== frame) { entry.value = evaluateParticleCurve(data, curve, frame); entry.frame = frame; }
    const index = PARTICLE_CURVE_CHANNELS[channel];
    out[index] = index >= 24 ? Math.max(0, Math.min(1, entry.value)) : entry.value;
  }
  // Sprite-sheet UVs and particle births/deaths are discrete events, never Fourier-filtered.
  let selected = cursor;
  for (let run=0; run<uvCount; run++, cursor+=9) if (data[cursor] <= first) selected = cursor;
  for (let channel=0; channel<8; channel++) out[16+channel] = data[selected+1+channel];
  return true;
}

export function validateFourierParticleData(metadata, data) {
  if (metadata.codec !== FOURIER_PARTICLE_CODEC || !data.every(Number.isFinite)) throw Error('Invalid Fourier particle data');
  const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
  const checked = new Set();
  for (const variant of metadata.variants) for (const system of variant.systems) for (const track of system.tracks) {
    const offset = track.offset;
    if (!integer(offset,0,data.length-21)) throw Error('Invalid particle track offset');
    const runs = data[offset], uvs = data[offset+1];
    if (!integer(runs,1,metadata.frameCount) || !integer(uvs,1,metadata.frameCount)
      || offset+21+runs*2+uvs*9 > data.length) throw Error('Invalid particle event directory');
    let previous = -1;
    for (let run=0; run<runs; run++) {
      const start = data[offset+21+run*2], end = data[offset+22+run*2];
      if (!integer(start,0,metadata.frameCount-1) || !integer(end,start+1,metadata.frameCount) || start <= previous)
        throw Error('Invalid particle lifetime');
      previous = end-1;
    }
    previous = -1;
    for (let uv=0; uv<uvs; uv++) {
      const frame = data[offset+21+runs*2+uv*9];
      if (!integer(frame,0,metadata.frameCount-1) || frame <= previous) throw Error('Invalid particle UV event');
      previous = frame;
    }
    for (let channel=0; channel<PARTICLE_CURVE_CHANNELS.length; channel++) {
      const curve = data[offset+2+channel];
      if (!integer(curve,0,data.length-6)) throw Error('Invalid Fourier curve offset');
      if (checked.has(curve)) continue;
      checked.add(curve);
      const count = data[curve]; let cursor = curve+1, previousEnd = -1;
      if (!integer(count,1,metadata.frameCount)) throw Error('Invalid Fourier segment count');
      for (let segment=0; segment<count; segment++) {
        const start = data[cursor], end = data[cursor+1], terms = data[cursor+4];
        if (cursor+5 > data.length || !integer(start,0,metadata.frameCount-1) || !integer(end,start,metadata.frameCount-1)
          || (segment && start !== previousEnd) || !integer(terms,0,metadata.frameCount) || cursor+5+terms*2 > data.length)
          throw Error('Invalid Fourier segment');
        cursor += 5;
        for (let term=0; term<terms; term++) if (!integer(data[cursor+term*2],1,metadata.frameCount)) throw Error('Invalid Fourier harmonic');
        cursor += terms*2; previousEnd = end;
      }
    }
  }
}
