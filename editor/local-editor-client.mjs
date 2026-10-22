/** Public games never contact the bridge or load editor UI. No query flag grants editor access. */
export async function connectLocalEditor({ location = globalThis.location, fetch = globalThis.fetch } = {}) {
  if (location.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(location.hostname)) return null;
  try {
    const response = await fetch('/__cq_editor/session', { cache: 'no-store',
      headers: { 'X-CQ-Editor': '1' }, signal: AbortSignal.timeout(2000) });
    if (!response.ok) return null;
    const session = await response.json();
    if (session.protocol !== 1 || !/^[a-f0-9]{64}$/.test(session.token) || !/^[a-f0-9]{64}$/.test(session.revision)) return null;
    let pending;
    return {
      async apply(diff) {
        // A retry of the same diff retains its id, even if the first response was lost.
        const text = JSON.stringify(diff);
        if (!pending || pending.text !== text) pending = { text, request: { id: crypto.randomUUID(), revision: session.revision, diff } };
        const response = await fetch('/__cq_editor/apply', { method: 'POST', cache: 'no-store',
          headers: { 'X-CQ-Editor': '1', 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
          body: JSON.stringify(pending.request), signal: AbortSignal.timeout(15000) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `Apply: HTTP ${response.status}`);
        return result;
      },
    };
  } catch { return null; }
}

export async function loadLocalEditorUi() {
  const style = document.createElement('link'); style.rel = 'stylesheet'; style.href = 'editor/editor.css?v=153';
  document.head.append(style);
  const button = document.createElement('button'); button.id = 'scene-editor-toggle'; button.className = 'hud-icon scene-editor-toggle';
  button.type = 'button'; button.title = 'Редактор сцены — ~'; button.setAttribute('aria-label', 'Открыть редактор сцены');
  button.setAttribute('aria-pressed', 'false'); button.innerHTML = '<span aria-hidden="true">~</span>';
  document.body.append(button);
  return import('./scene-editor.mjs?v=178');
}
