// Release build: local editor bridge is intentionally unavailable.
export async function connectLocalEditor() { return null; }
export async function loadLocalEditorUi() { throw new Error('Scene editor is excluded from release builds.'); }
