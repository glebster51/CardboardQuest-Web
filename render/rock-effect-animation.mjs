import { loadBakedParticleAssets } from './baked-particle-effect.mjs?v=f484ba7b7b13e7f6';
export { BAKED_PARTICLE_STRIDE as ROCK_EFFECT_SAMPLE_STRIDE, sampleBakedParticleTrack as sampleRockEffectTrack } from './baked-particle-effect.mjs?v=f484ba7b7b13e7f6';

export function loadRockEffectAssets(THREE) {
  return loadBakedParticleAssets(THREE, new URL('../bosses/ogre/effects/rocks/animation.json?v=3', import.meta.url));
}
