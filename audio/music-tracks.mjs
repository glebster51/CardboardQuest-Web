// Local downloads: the game never calls a music-generation service at runtime.
export const MUSIC_TRACKS = Object.freeze({
  peace: { url: 'assets/audio/paperwood-suno.mp3', title: 'Paperwood Paths', source: 'Suno',
    origin: 'https://suno.com/song/49f11576-aab3-47df-85a9-2865fef954db' },
  battle: { url: 'assets/audio/skirmish-suno.mp3', title: 'Cardboard Skirmish', source: 'Suno',
    origin: 'https://suno.com/song/30d27ee2-0e8b-4dba-94a1-b5c63c89cd6d' },
  mystery: { url: 'assets/audio/forgotten-bell-suno.mp3', title: 'The Forgotten Bell', source: 'Suno',
    origin: 'https://suno.com/song/74cf423a-0dcb-4ac4-92b5-2a8a86284f31' },
  boss: { url: 'assets/audio/goblin-drum-original.mp3', title: 'The Goblin Drum', source: 'original-synthesis' },
});
