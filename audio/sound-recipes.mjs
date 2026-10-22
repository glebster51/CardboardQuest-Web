// Original short effects, made from oscillators and filtered noise. No sample libraries.
const tone = (at, duration, frequency, endFrequency, volume = .16, type = 'sine') =>
  ({ at, duration, frequency, endFrequency, volume, type });
const noise = (at, duration, frequency, endFrequency, volume = .14, filter = 'bandpass') =>
  ({ at, duration, frequency, endFrequency, volume, type: 'noise', filter });
const chime = (notes, step = .065, volume = .12) => notes.map((note, index) => tone(index * step, .28, note, note, volume));
export const SOUND_RECIPES = Object.freeze({
  click: [tone(0, .045, 680, 370, .09, 'triangle'), noise(0, .035, 2100, 1000, .045)],
  select: [tone(0, .09, 740, 930, .08, 'triangle')],
  bagOpen: [noise(0, .19, 800, 1600, .1), tone(.04, .12, 210, 280, .07, 'triangle')],
  bagClose: [noise(0, .13, 1500, 450, .09), tone(.06, .07, 190, 110, .08, 'triangle')],
  mapOpen: [noise(0, .13, 2300, 4000, .08, 'highpass'), noise(.1, .18, 3300, 1800, .065, 'highpass')],
  mapClose: [noise(0, .14, 2900, 1100, .07, 'highpass')],
  dialogue: [tone(0, .06, 470, 520, .065, 'triangle'), noise(0, .05, 1700, 1200, .025)],
  choice: chime([392, 523.25], .07, .09),
  pickup: [...chime([783.99, 1046.5], .06, .11), noise(0, .06, 1400, 2100, .035)],
  clue: chime([523.25, 659.25, 783.99, 1046.5], .085, .11),
  eat: [noise(0, .065, 1800, 650, .14), noise(.1, .07, 2200, 850, .11), noise(.19, .055, 1600, 700, .08),
    ...chime([523.25, 659.25, 783.99], .09, .065).map(note => ({ ...note, at: note.at + .24 }))],
  bandage: [noise(0, .22, 3200, 1500, .08, 'highpass'), noise(.15, .2, 2100, 3700, .05, 'highpass'),
    ...chime([523.25, 783.99, 1046.5], .09, .07).map(note => ({ ...note, at: note.at + .22 }))],
  chest: [noise(0, .35, 300, 1500, .15), tone(0, .22, 95, 180, .1, 'sawtooth'),
    ...chime([523.25, 659.25, 783.99, 1046.5], .09, .13).map(note => ({ ...note, at: note.at + .18 }))],
  aim: [noise(0, .09, 600, 1600, .035), tone(0, .11, 165, 215, .045, 'triangle')],
  ready: chime([880, 1174.66], .07, .1),
  readyPeace: chime([392, 523.25], .09, .045).map(note => ({ ...note, filterFrequency: 1050 })),
  dash: [noise(0, .25, 2500, 400, .19), tone(0, .12, 130, 55, .12, 'triangle')],
  enemyDash: [noise(0, .2, 1300, 350, .095)],
  projectile: [noise(0, .16, 3000, 900, .07), tone(0, .07, 390, 180, .045, 'triangle')],
  impact: [tone(0, .09, 145, 65, .17, 'triangle'), noise(0, .09, 1100, 400, .13)],
  hit: [noise(0, .12, 1700, 450, .18), tone(0, .11, 180, 70, .15, 'triangle')],
  hurt: [tone(0, .22, 170, 70, .21, 'triangle'), noise(0, .16, 600, 240, .12)],
  enemyDeath: [noise(0, .23, 1500, 400, .12), tone(0, .2, 220, 90, .11, 'triangle')],
  fall: [noise(0, .55, 2500, 200, .13), tone(0, .48, 420, 65, .09, 'triangle')],
  transition: [noise(0, .26, 800, 2600, .05), ...chime([293.66, 440], .1, .07)],
  victory: chime([392, 493.88, 587.33, 783.99, 987.77, 1174.66], .1, .12),
  defeat: [tone(0, .6, 220, 196, .13, 'triangle'), tone(.25, .65, 164.81, 146.83, .13, 'triangle'), tone(.55, 1, 110, 98, .14)],
  bird: [tone(0, .09, 2100, 2900, .025), tone(.13, .12, 2600, 1900, .02)],
});
