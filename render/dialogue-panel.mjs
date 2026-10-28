import { advanceDialogue, canChooseDialogueOption, createDialogueSession, dialogueFrame } from '../game/dialogue.mjs?v=7c14a71de3a9af87';
import { SPEAKERS } from '../game/story-dialogue.mjs?v=7c14a71de3a9af87';
import { hideUIWindow, indicateUIChange, showUIWindow } from './ui-window-motion.mjs?v=7c14a71de3a9af87';

const expressions = Object.freeze({ calm: 'спокойствие', bold: 'решимость', worried: 'тревога' });
function portraitMood(text = '') {
  if (/(прости|вернись|страш|не знаю|потерял|погиб|болит|тревог|не видно|не слыш|один\b|плак|слёз|пусто)/iu.test(text)) return 'worried';
  if ((/[!！]/u.test(text) || /(стой|хватит|держись|беги|не трогай|да пошёл|сейчас же|я справлюсь|готов)/iu.test(text))) return 'bold';
  if ((/[?？]/u.test(text) && /(почему|зачем|куда|кто|что|как|где|правда)/iu.test(text))) return 'worried';
  return 'calm';
}

/** DOM view of a dialogue session; gameplay owns the pause and reward callbacks. */
export function createDialoguePanel({ root, onOpen, onClose, onChoose }) {
  let session = null;
  const element = id => root.querySelector(`#${id}`);
  const next = element('story-close');
  const render = () => {
    const frame = dialogueFrame(session);
    if (!frame) { const wasOpen = !root.hidden && root.dataset.uiMotionState !== 'closing';
      void hideUIWindow(root).then(closed => { if (wasOpen && closed) onClose?.(); }); return; }
    const speaker = SPEAKERS[frame.speaker] ?? SPEAKERS.narrator;
    const mood = portraitMood(frame.text);
    element('story-title').textContent = frame.title ?? '';
    element('story-speaker').textContent = speaker.name;
    element('story-text').textContent = frame.text;
    element('story-progress').textContent = `${frame.index + 1} / ${frame.total}`;
    const portrait = element('story-portrait');
    portrait.hidden = !speaker.portraits;
    if (speaker.portraits) {
      portrait.src = speaker.portraits[mood] ?? speaker.portraits.calm;
      portrait.alt = `${speaker.name} — ${expressions[mood]}`;
    }
    else { portrait.removeAttribute('src'); portrait.alt = ''; }
    root.dataset.speaker = frame.speaker;
    root.dataset.expression = mood;
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
    indicateUIChange(element('story-copy'), 'dialogue');
    if (root.hidden || root.dataset.uiMotionState === 'closing') void showUIWindow(root);
  };
  function show(card) { session = createDialogueSession(card); onOpen?.(); render(); }
  function close() {
    const wasOpen = !root.hidden && root.dataset.uiMotionState !== 'closing';
    if (session) session.closed = true;
    void hideUIWindow(root).then(closed => { if (wasOpen && closed) onClose?.(); });
  }
  next.addEventListener('click', () => { advanceDialogue(session); render(); });
  root.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target === root && !next.hidden) {
      event.preventDefault(); next.click();
    }
  });
  return { show, close, isOpen: () => !root.hidden, frame: () => dialogueFrame(session) };
}
