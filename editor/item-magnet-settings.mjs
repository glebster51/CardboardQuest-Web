import { normalizeItemMagnetSettings } from '../game/item-magnet.mjs?v=1';

const CONTROL_INFO = {
  radius: { label: 'Радиус подбора', aria: 'Радиус магнита предметов', min: 0, max: 14, step: '.1' },
  worldDuration: { label: 'Полёт к игроку', aria: 'Длительность полёта предмета к игроку', min: .15, max: 1.5, step: '.01' },
  worldArc: { label: 'Высота дуги к игроку', aria: 'Высота дуги предмета к игроку', min: .5, max: 8, step: '.1' },
  iconDuration: { label: 'Полёт иконки в рюкзак', aria: 'Длительность полёта иконки в рюкзак', min: .2, max: 2, step: '.01' },
  iconArc: { label: 'Размах экранной дуги', aria: 'Размах дуги иконки до рюкзака', min: 20, max: 600, step: '1' },
};
function itemValue(key, value) {
  if (key === 'radius' || key === 'worldArc') return `${value.toFixed(1)} м`;
  if (key === 'iconArc') return `${Math.round(value)} px`;
  return `${value.toFixed(2)} с`;
}
export function createItemMagnetSettingsMarkup(settings) {
  const normalized = normalizeItemMagnetSettings(settings);
  const controls = Object.entries(CONTROL_INFO).map(([key, info]) => `<div class="se-magnet-control" data-magnet-control="${key}">
    <label><span>${info.label} <output>${itemValue(key, normalized[key])}</output></span><input data-item-magnet="${key}" aria-label="${info.aria}" type="range" min="${info.min}" max="${info.max}" step="${info.step}" value="${normalized[key]}"></label>
  </div>`).join('');
  return `<details class="se-module" data-editor-state="item-magnet"><summary>Магнит предметов</summary><div class="se-module-content se-item-magnet" role="group" aria-label="Настройки автоматического подбора предметов">
    ${controls}
    <small>Наведи на ползунок: круг и дуги подбора появятся вокруг игрока в сцене, экранные траектории — от игрока до рюкзака.</small>
    <small>Движущиеся маркеры показывают настоящее время полёта; разброс экранных дуг совпадает с игровой формулой.</small>
  </div></details>`;
}
export function bindItemMagnetSettings({ panel, getSettings, onChange, onPreviewChange = () => {} }) {
  let hovered = null, dragged = null, focused = null;
  const module = panel.querySelector('.se-item-magnet').closest('details');
  const preview = () => onPreviewChange(module.open
    ? dragged ?? hovered ?? (focused?.matches(':focus-visible') ? focused.dataset.itemMagnet : null) : null);
  const refresh = () => {
    const settings = normalizeItemMagnetSettings(getSettings());
    for (const input of panel.querySelectorAll('[data-item-magnet]')) {
      const key = input.dataset.itemMagnet;
      input.value = settings[key];
      input.closest('label').querySelector('output').value = itemValue(key, settings[key]);
    }
  };
  for (const input of panel.querySelectorAll('[data-item-magnet]')) {
    const wrapper = input.closest('[data-magnet-control]'), key = input.dataset.itemMagnet;
    wrapper.addEventListener('pointerenter', () => { hovered = key; preview(); });
    wrapper.addEventListener('pointerleave', () => { hovered = null; preview(); });
    input.addEventListener('focus', () => { focused = input; preview(); });
    input.addEventListener('blur', () => { focused = null; preview(); });
    input.addEventListener('pointerdown', () => { dragged = key; preview(); });
    input.addEventListener('input', () => {
      onChange({ ...getSettings(), [key]: Number(input.value) });
      refresh(); preview();
    });
  }
  for (const event of ['pointerup', 'pointercancel']) window.addEventListener(event, () => { dragged = null; preview(); });
  module.addEventListener('toggle', () => { if (!module.open) hovered = dragged = focused = null; preview(); });
  refresh();
  return refresh;
}
