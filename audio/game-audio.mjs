import { AUDIO_SETTINGS_KEY, normalizeAudioSettings } from './audio-rules.mjs?v=ab782efa5048549c';
import { MUSIC_TRACKS } from './music-tracks.mjs?v=ab782efa5048549c';
import { SOUND_RECIPES } from './sound-recipes.mjs?v=ab782efa5048549c';
import { getBrowserStorage } from '../storage.mjs?v=ab782efa5048549c';

/** Lazy audio: no context, music requests or decoded music before a user gesture. */
export function createGameAudio({ windowRef = window, documentRef = document, storage = getBrowserStorage(windowRef),
  tracks = MUSIC_TRACKS, AudioClass = windowRef.Audio, ContextClass = windowRef.AudioContext ?? windowRef.webkitAudioContext } = {}) {
  let stored; try { stored = JSON.parse(storage.getItem(AUDIO_SETTINGS_KEY) || 'null'); } catch { /* Defaults work without storage. */ }
  let settings = normalizeAudioSettings(stored), context = null, master, effects, music, ambient, noiseBuffer, meter;
  const meterData = new Float32Array(256);
  let ambienceSource, ambienceFilter, ambienceGain, rollSource, rollGain;
  let mood = 'peace', ambience = 'forest', ducked = false, unlocked = false, desired = null, request = 0;
  let slots = [], currentSlot = -1, lastError = null, disposed = false, timer = null, nextBird = 0, lastRoll = -1;
  const listeners = new Set(), activeVoices = new Set(), recent = new Map(), counts = {};
  const ramp = (parameter, value, seconds = .08) => parameter.setTargetAtTime(value, context.currentTime, seconds);
  const visible = () => !documentRef.hidden;
  function mix() {
    if (!context) return;
    ramp(master.gain, settings.muted || !visible() ? 0 : settings.master);
    ramp(effects.gain, settings.effects);
    ramp(music.gain, settings.music * (ducked ? .38 : 1), .18);
    ramp(ambient.gain, settings.ambience * (ducked ? .25 : 1), .2);
    ramp(ambienceGain.gain, ambience === 'water' ? .028 : ambience === 'cave' ? .009 : .012, .8);
    ramp(ambienceFilter.frequency, ambience === 'water' ? 1100 : ambience === 'cave' ? 320 : 650, .8);
  }
  function makeNoiseLoop(destination, cutoff) {
    const source = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain();
    source.buffer = noiseBuffer; source.loop = true; filter.type = 'lowpass'; filter.frequency.value = cutoff;
    gain.gain.value = 0; source.connect(filter); filter.connect(gain); gain.connect(destination); source.start();
    return { source, filter, gain };
  }
  function initialize() {
    if (context || !ContextClass || disposed) return;
    context = new ContextClass();
    master = context.createGain(); effects = context.createGain(); music = context.createGain(); ambient = context.createGain();
    const limiter = context.createDynamicsCompressor(); limiter.threshold.value = -14; limiter.knee.value = 12;
    limiter.ratio.value = 6; limiter.attack.value = .003; limiter.release.value = .16;
    effects.connect(master); music.connect(master); ambient.connect(master); master.connect(limiter);
    meter = context.createAnalyser?.();
    if (meter) { meter.fftSize = 256; limiter.connect(meter); meter.connect(context.destination); }
    else limiter.connect(context.destination);
    noiseBuffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
    const data = noiseBuffer.getChannelData(0); for (let index = 0; index < data.length; index++) data[index] = Math.random() * 2 - 1;
    const bed = makeNoiseLoop(ambient, 650); ambienceSource = bed.source; ambienceFilter = bed.filter; ambienceGain = bed.gain;
    const roll = makeNoiseLoop(effects, 380); rollSource = roll.source; rollGain = roll.gain;
    slots = [0, 1].map(() => {
      const element = new AudioClass(); element.loop = true; element.preload = 'none';
      const source = context.createMediaElementSource(element), gain = context.createGain(); gain.gain.value = 0;
      source.connect(gain); gain.connect(music);
      return { element, source, gain, key: null, revision: 0 };
    });
    mix();
    timer = windowRef.setInterval(() => {
      if (!unlocked || !visible() || ducked || settings.muted || settings.ambience === 0 || ambience !== 'forest' || /battle|boss/.test(mood)) return;
      if (context.currentTime >= nextBird) { play('bird'); nextBird = context.currentTime + 9 + Math.random() * 11; }
    }, 1000);
  }
  async function syncMusic() {
    if (!unlocked || !visible() || !slots.length || settings.muted || settings.music === 0 || settings.master === 0) {
      for (const slot of slots) slot.element.pause();
      return;
    }
    if (desired === mood) {
      const slot = slots[currentSlot];
      if (slot?.element.paused && slot.key === mood) void slot.element.play().catch(() => {});
      return;
    }
    const track = tracks[mood] ?? tracks.peace;
    if (!track) return;
    desired = mood; const version = ++request, next = currentSlot === 0 ? 1 : 0, slot = slots[next];
    slot.element.pause(); slot.key = mood; slot.revision++; slot.gain.gain.cancelScheduledValues(context.currentTime); slot.gain.gain.value = 0;
    slot.element.src = new URL(track.url, new URL('../', import.meta.url)).href;
    try {
      await slot.element.play();
      if (version !== request || disposed || settings.muted || !visible()) { if (slot.key !== desired || settings.muted || !visible()) slot.element.pause(); return; }
      const previous = currentSlot; currentSlot = next;
      ramp(slot.gain.gain, 1, .45);
      if (previous >= 0) {
        const old = slots[previous], revision = old.revision; ramp(old.gain.gain, 0, .4);
        windowRef.setTimeout(() => { if (currentSlot !== previous && old.revision === revision) { old.element.pause(); old.element.removeAttribute('src'); old.element.load(); old.key = null; } }, 2200);
      }
    } catch (error) { if (version === request) { desired = null; lastError = `music:${error.name}`; } }
  }
  async function unlock() {
    if (disposed) return;
    try {
      initialize(); if (!context) return;
      await context.resume(); unlocked = context.state === 'running';
      mix(); void syncMusic();
    } catch (error) { lastError = `unlock:${error.name}`; }
  }
  function play(name, { strength = 1, pan = 0 } = {}) {
    if (!context || !visible() || settings.muted || (name === 'bird' ? settings.ambience : settings.effects) === 0 || settings.master === 0 || disposed) return false;
    const recipe = SOUND_RECIPES[name]; if (!recipe || activeVoices.size >= 40) return false;
    const now = context.currentTime;
    if (now - (recent.get(name) ?? -Infinity) < (name === 'impact' ? .095 : name === 'pickup' ? .055 : .035)) return false;
    recent.set(name, now); counts[name] = (counts[name] ?? 0) + 1;
    for (const note of recipe) {
      if (activeVoices.size >= 48) break;
      const start = now + note.at, end = start + note.duration;
      const source = note.type === 'noise' ? context.createBufferSource() : context.createOscillator();
      const filter = context.createBiquadFilter(), gain = context.createGain(), panner = context.createStereoPanner();
      filter.type = note.filter ?? 'lowpass'; filter.Q.value = note.type === 'noise' ? .7 : .4;
      filter.frequency.setValueAtTime(note.type === 'noise' ? note.frequency : note.filterFrequency ?? 3200, start);
      if (note.type === 'noise') {
        source.buffer = noiseBuffer;
        filter.frequency.exponentialRampToValueAtTime(Math.max(30, note.endFrequency), end);
      } else {
        source.type = note.type; source.frequency.setValueAtTime(note.frequency, start);
        source.frequency.exponentialRampToValueAtTime(Math.max(30, note.endFrequency), end);
      }
      const volume = note.volume * Math.max(.1, Math.min(1.4, strength));
      gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(volume, start + Math.min(.008, note.duration * .15));
      gain.gain.exponentialRampToValueAtTime(.0001, end);
      panner.pan.value = Math.max(-.8, Math.min(.8, pan));
      source.connect(filter); filter.connect(gain); gain.connect(panner); panner.connect(name === 'bird' ? ambient : effects);
      activeVoices.add(source);
      source.onended = () => { activeVoices.delete(source); source.disconnect(); filter.disconnect(); gain.disconnect(); panner.disconnect(); };
      if (note.type === 'noise') source.start(start, Math.random()); else source.start(start);
      source.stop(end + .015);
    }
    return true;
  }
  function setScene({ nextMood = mood, nextAmbience = ambience, paused = false, speed = 0 } = {}) {
    const changed = nextMood !== mood, mixChanged = nextAmbience !== ambience || ducked !== paused;
    mood = nextMood; ambience = nextAmbience; ducked = paused;
    if (context) {
      if (mixChanged) mix();
      const amount = paused ? 0 : Math.min(.035, Math.max(0, speed - .3) * .003);
      if (Math.abs(amount - lastRoll) > .001 || amount === 0 && lastRoll !== 0) { ramp(rollGain.gain, amount); lastRoll = amount; }
    }
    if (changed && unlocked) void syncMusic();
  }
  function setSettings(patch) {
    settings = normalizeAudioSettings({ ...settings, ...patch });
    try { storage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(settings)); } catch { /* Audio remains usable without persistence. */ }
    mix(); void syncMusic(); for (const listener of listeners) listener({ ...settings });
  }
  const gesture = () => { void unlock(); };
  const visibility = () => {
    if (!context) return;
    if (!visible()) { for (const slot of slots) slot.element.pause(); void context.suspend(); }
    else if (unlocked) void unlock();
    mix();
  };
  documentRef.addEventListener('pointerdown', gesture, { capture: true, passive: true });
  documentRef.addEventListener('keydown', gesture, { capture: true });
  documentRef.addEventListener('visibilitychange', visibility);
  return { unlock, play, setScene, setSettings, getSettings: () => ({ ...settings }),
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    snapshot: () => {
      meter?.getFloatTimeDomainData(meterData);
      const rms = Math.sqrt(meterData.reduce((sum, value) => sum + value * value, 0) / meterData.length);
      return { unlocked, state: context?.state ?? 'locked', mood, ambience, ducked, rms, settings: { ...settings },
      voices: activeVoices.size, musicPlayers: slots.length, currentTrack: currentSlot < 0 ? null : slots[currentSlot].key,
      players: slots.map(slot => ({ key: slot.key, paused: slot.element.paused, ready: slot.element.readyState, time: slot.element.currentTime })),
      lastError, counts: { ...counts } };
    },
    dispose() {
      disposed = true; request++; if (timer) windowRef.clearInterval(timer);
      documentRef.removeEventListener('pointerdown', gesture, true); documentRef.removeEventListener('keydown', gesture, true);
      documentRef.removeEventListener('visibilitychange', visibility);
      for (const slot of slots) { slot.element.pause(); slot.element.removeAttribute('src'); slot.element.load(); slot.source.disconnect(); slot.gain.disconnect(); }
      for (const voice of activeVoices) { try { voice.stop(); } catch { /* Already finished. */ } }
      ambienceSource?.stop(); rollSource?.stop(); listeners.clear(); void context?.close();
    },
  };
}
