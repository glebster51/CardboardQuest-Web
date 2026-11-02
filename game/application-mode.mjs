// @ts-check
/** @typedef {{editor?: boolean, transition?: boolean, cinematic?: boolean, dialogue?: boolean,
 * inventory?: boolean, map?: boolean, audio?: boolean, shop?: boolean, death?: boolean, manualPause?: boolean}} ModeState */
/** Central policy shared by pointer input, simulation and audio. @param {ModeState} state */
export function applicationMode(state) {
  const modal = Boolean(state.dialogue || state.inventory || state.map || state.audio || state.shop);
  const blocksInput = Boolean(state.editor || state.transition || state.cinematic || modal || state.death);
  return { modal, blocksInput, paused: blocksInput || Boolean(state.manualPause),
    renderOnly: Boolean(state.transition || modal), editor: Boolean(state.editor), death: Boolean(state.death) };
}
