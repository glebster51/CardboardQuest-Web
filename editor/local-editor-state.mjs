export const LOCAL_EDITOR_DRAFT_KEY = 'cardboardquest-local-editor-draft-v1';
export const LOCAL_EDITOR_PANEL_KEY = 'cardboardquest-local-editor-panel-v1';

export function isLocalEditorOrigin(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

export function readLocalEditorDraft(storage, enabled) {
  if (!enabled || !storage) return null;
  try {
    const value = JSON.parse(storage.getItem(LOCAL_EDITOR_DRAFT_KEY)
      || storage.getItem('cardboardquest-editor-last-diff') || 'null');
    return value?.format === 'cardboardquest.scene-diff.v1' && Array.isArray(value.changes) ? value : null;
  } catch { return null; }
}

export function writeLocalEditorDraft(storage, enabled, diff) {
  if (!enabled || !storage || diff?.format !== 'cardboardquest.scene-diff.v1' || !Array.isArray(diff.changes)) return;
  try {
    storage.setItem(LOCAL_EDITOR_DRAFT_KEY, JSON.stringify(diff));
    storage.removeItem('cardboardquest-editor-last-diff');
  } catch { /* Clipboard remains available if storage is full. */ }
}

export function clearLocalEditorDraft(storage, enabled) {
  if (!enabled || !storage) return;
  try {
    storage.removeItem(LOCAL_EDITOR_DRAFT_KEY);
    storage.removeItem('cardboardquest-editor-last-diff');
  } catch { /* The saved draft expires with browser storage. */ }
}

export function readLocalEditorPanelState(storage, enabled) {
  if (!enabled || !storage) return {};
  try {
    const value = JSON.parse(storage.getItem(LOCAL_EDITOR_PANEL_KEY) || 'null');
    if (value?.version !== 1 || !value.modules || typeof value.modules !== 'object' || Array.isArray(value.modules)) return {};
    return Object.fromEntries(Object.entries(value.modules).filter(([key, open]) => /^[a-z0-9-]{1,48}$/.test(key) && typeof open === 'boolean'));
  } catch { return {}; }
}

export function writeLocalEditorPanelState(storage, enabled, modules) {
  if (!enabled || !storage) return;
  try { storage.setItem(LOCAL_EDITOR_PANEL_KEY, JSON.stringify({ version: 1, modules })); } catch { /* Panel defaults still work for this session. */ }
}
