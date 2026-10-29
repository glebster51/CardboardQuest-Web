import { hideUIWindow, indicateUIChange, showUIWindow } from './ui-window-motion.mjs?v=ab782efa5048549c';

/** Visible recovery and save failures; exporting always uses the current in-memory snapshot. */
export function createSaveStatus(root, getRepository) {
  let failure = false;
  root.dataset.uiAnchor ??= 'left'; root.dataset.uiMotionSurface = '';
  root.querySelector('[data-save-retry]').addEventListener('click', () => getRepository().retry());
  root.querySelector('[data-save-dismiss]').addEventListener('click', () => { void hideUIWindow(root); });
  root.querySelector('[data-save-export]').addEventListener('click', () => {
    const text = getRepository().exportText(); if (!text) return;
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'cardboardquest-save.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  return status => {
    if (status.kind === 'saved') { if (failure) void hideUIWindow(root); failure = false; return; }
    failure = status.kind === 'error'; root.dataset.state = status.kind;
    const message = root.querySelector('[data-save-message]');
    if (message.textContent !== status.message) { message.textContent = status.message; indicateUIChange(message, 'save-status'); }
    for (const button of root.querySelectorAll('[data-save-retry], [data-save-export]')) button.hidden = !failure;
    root.querySelector('[data-save-dismiss]').hidden = failure;
    if (root.hidden || root.dataset.uiMotionState === 'closing') void showUIWindow(root);
  };
}
