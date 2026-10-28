import { CAMPAIGN_SAVE_KEY, createCampaignState } from './story-campaign.mjs?v=7c14a71de3a9af87';
import { isRecord } from './campaign-state-validation.mjs?v=7c14a71de3a9af87';

export const CAMPAIGN_BACKUP_KEY = `${CAMPAIGN_SAVE_KEY}-backup`;
export const CAMPAIGN_RECOVERY_KEY = `${CAMPAIGN_SAVE_KEY}-recovery`;

/** Own durable saves, recovery copies and the latest in-memory export independently of the scene. */
export function createCampaignSaveRepository({ storage, getStorage = () => storage, onStatus = () => {} } = {}) {
  let lastGood = null, latest = null;
  const parse = text => {
    const raw = JSON.parse(text);
    if (!isRecord(raw) || raw.version !== 1) throw new Error('Unsupported campaign save');
    return { raw, state: createCampaignState(raw) };
  };
  function preserve(text) { try { getStorage()?.setItem(CAMPAIGN_RECOVERY_KEY, text); } catch { /* Keep the original key until a new save succeeds. */ } }
  function write(text) {
    latest = text;
    try {
      const storage = getStorage();
      if (!storage) throw new Error('Browser storage is unavailable');
      storage.setItem(CAMPAIGN_SAVE_KEY, text);
      if (lastGood && lastGood !== text) {
        try { storage.setItem(CAMPAIGN_BACKUP_KEY, lastGood); } catch { /* A full backup must not undo a successful primary write. */ }
      }
      lastGood = text; onStatus({ kind: 'saved' }); return { ok: true };
    } catch (error) {
      onStatus({ kind: 'error', message: 'Прогресс не сохранён. Разреши хранение данных в браузере и повтори сохранение. Можно скачать текущий поход.', error });
      return { ok: false, error };
    }
  }
  return {
    load() {
      let text;
      try {
        const storage = getStorage();
        if (!storage) throw new Error('Browser storage is unavailable');
        text = storage.getItem(CAMPAIGN_SAVE_KEY);
      } catch (error) {
        onStatus({ kind: 'error', message: 'Браузер не даёт читать и сохранять прогресс. Текущий поход можно будет скачать.', error });
        return null;
      }
      if (text === null) return null;
      try {
        const { raw, state } = parse(text);
        lastGood = latest = JSON.stringify(state);
        if (JSON.stringify(raw) !== latest) {
          preserve(text); onStatus({ kind: 'recovered', message: 'Сохранение восстановлено: повреждённые или устаревшие поля приведены к текущему формату.' });
        }
        return state;
      } catch {
        preserve(text);
        try {
          const backup = getStorage().getItem(CAMPAIGN_BACKUP_KEY), { state } = parse(backup);
          lastGood = latest = JSON.stringify(state);
          onStatus({ kind: 'recovered', message: 'Основное сохранение повреждено. Загружена предыдущая сохранённая копия похода.' });
          return state;
        } catch {
          onStatus({ kind: 'recovered', message: 'Сохранение повреждено. Начат новый поход; исходные данные сохранены для восстановления, если браузер разрешает запись.' });
          return null;
        }
      }
    },
    save(state) {
      try { return write(JSON.stringify(createCampaignState(state))); }
      catch (error) { onStatus({ kind: 'error', message: 'Не удалось сохранить поход. Скачай последнюю подготовленную копию и повтори попытку.', error }); return { ok: false, error }; }
    },
    retry() { return latest === null ? { ok: false } : write(latest); },
    exportText() { return latest; },
    hasDeathCheckpoint(restore) { try { return Boolean(restore(latest ? JSON.parse(latest) : null)); } catch { return false; } },
    clear() {
      lastGood = latest = null;
      try { const storage = getStorage(); storage?.removeItem(CAMPAIGN_SAVE_KEY); storage?.removeItem(CAMPAIGN_BACKUP_KEY); } catch { /* The reload reports an unavailable store. */ }
    },
  };
}
