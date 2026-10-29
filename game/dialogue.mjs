/** One line at a time; choices are available only after the final line. */
export function createDialogueSession(card) {
  const lines = (card.lines?.length ? card.lines : [{ speaker: 'narrator', text: card.text ?? '' }])
    .map(line => ({ ...line, speaker: line.speaker ?? 'narrator', text: String(line.text) }));
  return { card, lines, index: 0, closed: false };
}

/** Split dialogue into measured pages while keeping useful sentence and clause endings. */
export function paginateDialogueLines(lines, fitsPage) {
  if (typeof fitsPage !== 'function') return lines.map(line => ({ ...line }));
  const pages = [];
  for (let sourceLineIndex = 0; sourceLineIndex < lines.length; sourceLineIndex++) {
    const line = lines[sourceLineIndex];
    for (const text of splitDialogueText(line.text, fitsPage)) pages.push({ ...line, text, sourceLineIndex });
  }
  return pages;
}

function splitDialogueText(value, fitsPage) {
  const text = String(value).trim().replace(/\s+/gu, ' ');
  if (!text) return [{ text: '', start: 0 }];
  const remaining = text.split(' '), pages = [];
  while (remaining.length) {
    let fitCount = 0;
    for (let end = 1; end <= remaining.length; end++) {
      if (!fitsPage(remaining.slice(0, end).join(' '))) break;
      fitCount = end;
    }
    if (!fitCount) fitCount = 1;
    else if (fitCount < remaining.length) {
      const preferredStart = Math.max(1, Math.ceil(fitCount * .55));
      const ending = index => /[.!?…][»”"')]*$/u.test(remaining[index - 1]);
      const clauseEnding = index => /[,;:—][»”"')]*$/u.test(remaining[index - 1]);
      let preferred = 0;
      for (let index = fitCount; index >= preferredStart; index--) if (ending(index)) { preferred = index; break; }
      if (!preferred) for (let index = fitCount; index >= preferredStart; index--) if (clauseEnding(index)) { preferred = index; break; }
      if (preferred) fitCount = preferred;
    }
    pages.push(remaining.splice(0, fitCount).join(' '));
  }
  return pages;
}

export function dialogueFrame(session) {
  if (!session || session.closed) return null;
  const last = session.index === session.lines.length - 1;
  return { ...session.lines[session.index], title: session.card.title, index: session.index,
    total: session.lines.length, last, options: last ? session.card.options ?? [] : [] };
}

export function advanceDialogue(session) {
  if (!session || session.closed) return false;
  if (session.index < session.lines.length - 1) session.index++;
  else if (!session.card.options?.length) session.closed = true;
  return !session.closed;
}

export function canChooseDialogueOption(session, id) {
  return Boolean(dialogueFrame(session)?.options.some(option => option.id === id));
}
