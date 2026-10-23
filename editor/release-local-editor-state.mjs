// Release build: local editor drafts are intentionally unavailable.
export function isLocalEditorOrigin() { return false; }
export function readLocalEditorDraft() { return null; }
export function writeLocalEditorDraft() {}
export function clearLocalEditorDraft() {}
export function readLocalEditorPanelState() { return {}; }
export function writeLocalEditorPanelState() {}
