/** One line at a time; choices are available only after the final line. */
export function createDialogueSession(card) {
  const lines = (card.lines?.length ? card.lines : [{ speaker: 'narrator', text: card.text ?? '' }])
    .map(line => ({ speaker: line.speaker ?? 'narrator', text: String(line.text) }));
  return { card, lines, index: 0, closed: false };
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
