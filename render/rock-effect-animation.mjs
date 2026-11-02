import { loadBakedParticleAssets } from './baked-particle-effect.mjs?v=9c7aef8cf303e523';
export { BAKED_PARTICLE_STRIDE as ROCK_EFFECT_SAMPLE_STRIDE, sampleBakedParticleTrack as sampleRockEffectTrack } from './baked-particle-effect.mjs?v=9c7aef8cf303e523';

export function loadRockEffectAssets(THREE) {
  return loadBakedParticleAssets(THREE, new URL('../bosses/ogre/effects/rocks/animation.json?v=3', import.meta.url));
}
