import { advanceDialogue, canChooseDialogueOption, createDialogueSession, dialogueFrame } from '../game/dialogue.mjs';
import { SPEAKERS } from '../game/story-dialogue.mjs';

/** DOM view of a dialogue session; gameplay owns the pause and reward callbacks. */
export function createDialoguePanel({ root, onOpen, onClose, onChoose }) {
  let session = null;
  const element = id => root.querySelector(`#${id}`);
  const next = element('story-close');
  const render = () => {
    const frame = dialogueFrame(session);
    if (!frame) { const wasOpen = !root.hidden; root.hidden = true; if (wasOpen) onClose?.(); return; }
    const speaker = SPEAKERS[frame.speaker] ?? SPEAKERS.narrator;
    element('story-title').textContent = frame.title ?? '';
    element('story-speaker').textContent = speaker.name;
    element('story-text').textContent = frame.text;
    element('story-progress').textContent = `${frame.index + 1} / ${frame.total}`;
    const portrait = element('story-portrait');
    portrait.hidden = !speaker.sprite;
    if (speaker.sprite) { portrait.src = speaker.sprite; portrait.alt = speaker.name; }
    else { portrait.removeAttribute('src'); portrait.alt = ''; }
    root.dataset.speaker = frame.speaker;
    const options = element('story-options'); options.replaceChildren();
    for (const option of frame.options) {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = option.label;
      button.addEventListener('click', () => {
        if (!canChooseDialogueOption(session, option.id)) return;
        const selected = session;
        selected.closed = true; // double taps cannot grant a reward twice
        const result = onChoose?.(option, selected.card);
        if (result) show(result); else render();
      });
      options.append(button);
    }
    next.hidden = frame.options.length > 0;
    next.textContent = frame.last ? 'Вернуться в игру' : 'Дальше →';
    root.hidden = false;
  };
  function show(card) { session = createDialogueSession(card); onOpen?.(); render(); }
  function close() {
    const wasOpen = !root.hidden;
    if (session) session.closed = true;
    root.hidden = true;
    if (wasOpen) onClose?.();
  }
  next.addEventListener('click', () => { advanceDialogue(session); render(); });
  root.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target === root && !next.hidden) {
      event.preventDefault(); next.click();
    }
  });
  return { show, close, isOpen: () => !root.hidden, frame: () => dialogueFrame(session) };
}
