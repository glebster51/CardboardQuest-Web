import { FOURIER_PARTICLE_CODEC, sampleFourierParticleTrack, validateFourierParticleData } from './baked-particle-curves.mjs?v=7c14a71de3a9af87';
// Unity owns simulation; the game evaluates a compact Fourier curve bake.
export const BAKED_PARTICLE_STRIDE = 28;

export function sampleBakedParticleTrack(assets, track, seconds, out) {
  const { data, fps, frameCount, stride = BAKED_PARTICLE_STRIDE } = assets;
  if (seconds < 0 || seconds > (frameCount - 1) / fps) { out.fill(0); return false; }
  const frame = Math.min(frameCount - 1, seconds * fps);
  if (assets.codec === FOURIER_PARTICLE_CODEC) return sampleFourierParticleTrack(assets, track, frame, out);
  const first = Math.floor(frame), blend = frame - first;
  const a = track.offset + first * stride, b = track.offset + Math.min(first + 1, frameCount - 1) * stride;
  if (!data[a]) { out.fill(0); return false; }
  out[0] = 1;
  for (let index = 1; index < stride; index++) {
    // Atlas frames switch discretely; dying particles keep their last position.
    const next = data[b] ? data[b + index] : index === 27 ? 0 : data[a + index];
    out[index] = index >= 16 && index < 24 ? data[a + index]
      : data[a + index] + (next - data[a + index]) * blend;
  }
  return true;
}

const assetPromises = new Map();
export function loadBakedParticleAssets(THREE, manifestUrl) {
  const url = new URL(manifestUrl, import.meta.url).href;
  if (assetPromises.has(url)) return assetPromises.get(url);
  const pending = (async () => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Baked effect manifest: HTTP ${response.status}`);
    const metadata = await response.json();
    const binary = await fetch(new URL(`animation.bin?v=${metadata.contentHash ?? metadata.sourceHash}`, url));
    if (!binary.ok) throw new Error(`Baked effect frames: HTTP ${binary.status}`);
    const data = new Float32Array(await binary.arrayBuffer());
    if (metadata.stride !== BAKED_PARTICLE_STRIDE || !(metadata.fps > 0) || !metadata.variants?.length
      || !data.every(Number.isFinite)) throw new Error('Invalid baked particle data');
    if (metadata.codec) validateFourierParticleData(metadata, data);
    const textures = Object.fromEntries(await Promise.all(Object.entries(metadata.textures).map(async ([name, file]) => {
      const texture = await new THREE.TextureLoader().loadAsync(new URL(`${file}?v=${metadata.contentHash ?? metadata.sourceHash}`, url).href);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
      return [name, texture];
    })));
    return { ...metadata, data, textures };
  })();
  assetPromises.set(url, pending); pending.catch(() => assetPromises.delete(url));
  return pending;
}

/** Expose root and named systems for optional game-specific transform hooks. */
export function createBakedParticleEffect(THREE, assets, { variant = 0, holdSystems = [], onUpdate } = {}) {
  const group = new THREE.Group(); group.name = 'baked-particle-effect';
  const systems = new Map(), batches = [], held = new Set(holdSystems);
  const selected = assets.variants[((variant % assets.variants.length) + assets.variants.length) % assets.variants.length];
  for (const system of selected.systems) {
    const holder = new THREE.Group(); holder.name = system.name;
    const anchor = system.position ?? [0, 0, 0];
    holder.position.set(...anchor); group.add(holder); systems.set(system.name, holder);
    const positions = new Float32Array(system.tracks.length * 12), colors = new Float32Array(system.tracks.length * 16);
    const uv = new Float32Array(system.tracks.length * 8), indices = new Uint16Array(system.tracks.length * 6);
    for (let q = 0; q < system.tracks.length; q++) indices.set([q*4,q*4+1,q*4+2,q*4,q*4+2,q*4+3],q*6);
    const geometry = new THREE.BufferGeometry();
    for (const [name, array, size] of [['position', positions, 3], ['color', colors, 4], ['uv', uv, 2]])
      geometry.setAttribute(name, new THREE.BufferAttribute(array, size).setUsage(THREE.DynamicDrawUsage));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1).setUsage(THREE.DynamicDrawUsage));
    const material = new THREE.MeshBasicMaterial({ map: assets.textures[system.texture], color: 0xffffff,
      vertexColors: true, transparent: !system.cutout,
      // Unity serializes _Cutoff even when the transparent shader ignores it.
      alphaTest: system.cutout ? system.cutoff : 0,
      side: THREE.DoubleSide, depthTest: true, depthWrite: system.cutout, toneMapped: false,
      ...(system.blend === 'additive' ? { blending: THREE.AdditiveBlending } : {}) });
    const mesh = new THREE.Mesh(geometry, material); mesh.name = `unity-particles:${system.name}`;
    mesh.frustumCulled = false; holder.add(mesh);
    const samples = system.tracks.map(() => new Float32Array(BAKED_PARTICLE_STRIDE));
    batches.push({ system, holder, mesh, geometry, material, positions, colors, uv, indices, samples, anchor,
      hold: held.has(system.name), sortOrder: system.tracks.map((_, index) => index), distances: new Float64Array(system.tracks.length) });
  }
  const right = new THREE.Vector3(), up = new THREE.Vector3(), center = new THREE.Vector3(), cameraPosition = new THREE.Vector3();
  const cameraRotation = new THREE.Quaternion(), inverseHolder = new THREE.Quaternion();
  function writePositions(batch, billboard) {
    const { system, positions, anchor, samples, geometry } = batch;
    for (let q=0;q<samples.length;q++) for(let v=0;v<4;v++) {
      const sample=samples[q], offset=q*12+v*3, source=4+v*3;
      if (system.billboard && billboard) {
        const x=sample[source]-sample[1], y=sample[source+1]-sample[2];
        positions[offset]=sample[1]-anchor[0]+right.x*x+up.x*y;
        positions[offset+1]=sample[2]-anchor[1]+right.y*x+up.y*y;
        positions[offset+2]=sample[3]-anchor[2]+right.z*x+up.z*y;
      } else for (let axis=0;axis<3;axis++) positions[offset+axis]=sample[source+axis]-anchor[axis];
    }
    geometry.attributes.position.needsUpdate=true;
  }
  const effect = { group, systems, batches, time: 0,
    sample(seconds) {
      this.time = Math.max(0, seconds);
      for (const batch of batches) {
        const { system, samples, colors, uv, geometry } = batch;
        let any=false;
        for(let q=0;q<samples.length;q++) {
          const alive=sampleBakedParticleTrack(assets,system.tracks[q],batch.hold?Math.min(this.time,system.tracks[q].holdTime):this.time,samples[q]);
          any ||= alive; const current=samples[q];
          for(let v=0;v<4;v++) {
            const ci=q*16+v*4,ui=q*8+v*2;
            colors[ci]=current[24]; colors[ci+1]=current[25]; colors[ci+2]=current[26]; colors[ci+3]=alive?current[27]:0;
            uv[ui]=current[16+v*2];uv[ui+1]=current[17+v*2];
          }
        }
        batch.mesh.visible=any; geometry.attributes.color.needsUpdate=true; geometry.attributes.uv.needsUpdate=true;
        writePositions(batch,false);
      }
    },
    update(dt) {
      const delta=Math.max(0,dt), next=this.time+delta;
      if(this.time<=assets.duration)this.sample(next);else this.time=next;
      onUpdate?.({ time:this.time, delta, group, systems, effect:this });
      return this.time>=assets.duration;
    },
    faceCamera(camera) {
      if(!camera)return;
      group.updateMatrixWorld(true);camera.getWorldQuaternion(cameraRotation);camera.getWorldPosition(cameraPosition);
      for(const batch of batches)if(batch.system.billboard && batch.mesh.visible) {
        batch.holder.getWorldQuaternion(inverseHolder).invert();
        right.set(1,0,0).applyQuaternion(cameraRotation).applyQuaternion(inverseHolder);
        up.set(0,1,0).applyQuaternion(cameraRotation).applyQuaternion(inverseHolder);
        writePositions(batch,true);
        if(!batch.system.cutout) {
          for(let index=0;index<batch.samples.length;index++) {
            const current=batch.samples[index];
            center.set(current[1]-batch.anchor[0],current[2]-batch.anchor[1],current[3]-batch.anchor[2]).applyMatrix4(batch.holder.matrixWorld);
            batch.distances[index]=center.distanceToSquared(cameraPosition);
          }
          batch.sortOrder.sort((a,b)=>batch.distances[b]-batch.distances[a]);
          for(let q=0;q<batch.sortOrder.length;q++){const v=batch.sortOrder[q]*4,i=q*6;
            batch.indices.set([v,v+1,v+2,v,v+2,v+3],i);}
          batch.geometry.index.needsUpdate=true;
        }
      }
    },
    dispose(){group.removeFromParent?.();for(const batch of batches){batch.geometry.dispose();batch.material.dispose();}},
  };
  effect.sample(0);return effect;
}
