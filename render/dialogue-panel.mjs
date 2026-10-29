import { advanceDialogue, canChooseDialogueOption, createDialogueSession, dialogueFrame, paginateDialogueLines } from '../game/dialogue.mjs?v=ab782efa5048549c';
import { SPEAKERS } from '../game/story-dialogue.mjs?v=ab782efa5048549c';
import { hideUIWindow, indicateUIChange, showUIWindow } from './ui-window-motion.mjs?v=ab782efa5048549c';

const expressions = Object.freeze({ calm: 'спокойствие', bold: 'решимость', worried: 'тревога' });
const graphemeSegmenter = typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter('ru', { granularity: 'grapheme' }) : null;

function setSpokenText(element, text, animate) {
  const value = String(text ?? '');
  element.setAttribute('aria-label', value);
  if (!animate || !value) { element.textContent = value; return; }
  const glyphs = graphemeSegmenter
    ? Array.from(graphemeSegmenter.segment(value), part => part.segment)
    : Array.from(value);
  const spans = glyphs.map((glyph, index) => {
    const span = element.ownerDocument.createElement('span');
    span.className = 'story-glyph story-glyph-pending';
    span.setAttribute('aria-hidden', 'true');
    span.style.setProperty('--story-glyph-index', index);
    span.textContent = glyph;
    return span;
  });
  element.replaceChildren(...spans);
  element.ownerDocument.defaultView.requestAnimationFrame(() => {
    if (!element.isConnected) return;
    for (const span of spans) span.classList.replace('story-glyph-pending', 'story-glyph-typing');
  });
}

function portraitMood(text = '') {
  if (/(прости|вернись|страш|не знаю|потерял|погиб|болит|тревог|не видно|не слыш|один\b|плак|слёз|пусто)/iu.test(text)) return 'worried';
  if ((/[!！]/u.test(text) || /(стой|хватит|держись|беги|не трогай|да пошёл|сейчас же|я справлюсь|готов)/iu.test(text))) return 'bold';
  if ((/[?？]/u.test(text) && /(почему|зачем|куда|кто|что|как|где|правда)/iu.test(text))) return 'worried';
  return 'calm';
}

function pageFitter(textElement) {
  const width = textElement.clientWidth;
  if (!width) return () => true;
  const style = getComputedStyle(textElement);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return text => text.length <= Math.floor(width / 8);
  context.font = style.font;
  const spacing = Number.parseFloat(style.letterSpacing) || 0;
  return text => {
    let rows = 1, rowWidth = 0;
    for (const word of String(text).split(/\s+/u)) {
      const wordWidth = context.measureText(word).width + Math.max(0, word.length - 1) * spacing;
      const spaceWidth = rowWidth ? context.measureText(' ').width + spacing : 0;
      if (rowWidth && rowWidth + spaceWidth + wordWidth > width) { rows++; rowWidth = wordWidth; }
      else rowWidth += spaceWidth + wordWidth;
      if (rows > 3) return false;
    }
    return rows <= 3;
  };
}

/** DOM view of a dialogue session; gameplay owns the pause and reward callbacks. */
export function createDialoguePanel({ root, onOpen, onClose, onChoose }) {
  let session = null;
  let lastSpeaker = null;
  const element = id => root.querySelector(`#${id}`);
  const panelSurface = root.querySelector('article');
  const next = element('story-close');
  const render = ({ animateText = true, trackSpeaker = true, animateSpeaker = true } = {}) => {
    const frame = dialogueFrame(session);
    if (!frame) { next.hidden = true;
      lastSpeaker = null;
      const wasOpen = !root.hidden && root.dataset.uiMotionState !== 'closing';
      void hideUIWindow(root).then(closed => { if (wasOpen && closed) onClose?.(); }); return; }
    const speaker = SPEAKERS[frame.speaker] ?? SPEAKERS.narrator;
    const speakerChanged = lastSpeaker !== null && lastSpeaker !== frame.speaker;
    const mood = portraitMood(frame.text);
    element('story-title').textContent = frame.title ?? '';
    element('story-speaker').textContent = speaker.name;
    setSpokenText(element('story-text'), frame.text, animateText);
    const progress = element('story-progress');
    const pageTotal = frame.total;
    const pageIndex = frame.index;
    progress.replaceChildren(...Array.from({ length: pageTotal }, (_, index) => {
      const dot = document.createElement('span');
      dot.className = 'story-page-dot';
      dot.dataset.filled = String(index <= pageIndex);
      return dot;
    }));
    progress.setAttribute('role', 'img');
    progress.setAttribute('aria-label', `Фраза ${pageIndex + 1} из ${pageTotal}`);
    const portrait = element('story-portrait');
    portrait.hidden = !speaker.portraits;
    if (speaker.portraits) {
      portrait.src = speaker.portraits[mood] ?? speaker.portraits.calm;
      portrait.alt = `${speaker.name} — ${expressions[mood]}`;
    }
    else { portrait.removeAttribute('src'); portrait.alt = ''; }
    root.dataset.speaker = frame.speaker;
    root.dataset.expression = mood;
    if (trackSpeaker) lastSpeaker = frame.speaker;
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
    if (speakerChanged && animateSpeaker) indicateUIChange(panelSurface, 'speaker');
    if (root.hidden || root.dataset.uiMotionState === 'closing') void showUIWindow(root);
  };
  function show(card) {
    onOpen?.();
    const wasHidden = root.hidden;
    if (wasHidden) lastSpeaker = null;
    const previousVisibility = root.style.visibility;
    root.style.visibility = 'hidden';
    session = createDialogueSession(card);
    const opening = showUIWindow(root);
    render({ animateText: false, trackSpeaker: false, animateSpeaker: false }); // Measure the real text width without starting effects.
    const lines = paginateDialogueLines(session.lines, pageFitter(element('story-text')));
    session = createDialogueSession({ ...card, lines });
    render();
    root.style.visibility = previousVisibility;
    if (!wasHidden && root.dataset.uiMotionState !== 'closing') void opening;
  }
  function close() {
    const wasOpen = !root.hidden && root.dataset.uiMotionState !== 'closing';
    if (session) session.closed = true;
    lastSpeaker = null;
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
