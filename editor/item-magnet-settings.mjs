import { normalizeItemMagnetSettings } from '../game/item-magnet.mjs?v=1';

export function createItemMagnetSettingsMarkup(settings) {
  return `<details class="se-module"><summary>Магнит предметов</summary><div class="se-module-content se-item-magnet" role="group" aria-label="Настройки автоматического подбора предметов">
    <label>Радиус подбора <output>${settings.radius.toFixed(1)} м</output><input data-item-magnet="radius" aria-label="Радиус магнита предметов" type="range" min="0" max="14" step=".1" value="${settings.radius}"></label>
    <label>Полёт к игроку <output>${settings.worldDuration.toFixed(2)} с</output><input data-item-magnet="worldDuration" aria-label="Длительность полёта предмета к игроку" type="range" min=".15" max="1.5" step=".01" value="${settings.worldDuration}"></label>
    <label>Высота дуги к игроку <output>${settings.worldArc.toFixed(1)} м</output><input data-item-magnet="worldArc" aria-label="Высота дуги предмета к игроку" type="range" min=".5" max="8" step=".1" value="${settings.worldArc}"></label>
    <label>Полёт иконки в рюкзак <output>${settings.iconDuration.toFixed(2)} с</output><input data-item-magnet="iconDuration" aria-label="Длительность полёта иконки в рюкзак" type="range" min=".2" max="2" step=".01" value="${settings.iconDuration}"></label>
    <label>Размах экранной дуги <output>${Math.round(settings.iconArc)} px</output><input data-item-magnet="iconArc" aria-label="Размах дуги иконки до рюкзака" type="range" min="20" max="600" step="1" value="${settings.iconArc}"></label>
    <small>Каждый предмет летит по собственной случайной дуге; несколько иконок могут лететь одновременно.</small>
  </div></details>`;
}

function format(input) {
  const value = Number(input.value);
  if (input.dataset.itemMagnet === 'radius' || input.dataset.itemMagnet === 'worldArc') return `${value.toFixed(1)} м`;
  if (input.dataset.itemMagnet === 'iconArc') return `${Math.round(value)} px`;
  return `${value.toFixed(2)} с`;
}

export function bindItemMagnetSettings({ panel, getSettings, onChange }) {
  const refresh = () => {
    const settings = normalizeItemMagnetSettings(getSettings());
    for (const input of panel.querySelectorAll('[data-item-magnet]')) {
      input.value = settings[input.dataset.itemMagnet];
      input.closest('label').querySelector('output').value = format(input);
    }
  };
  for (const input of panel.querySelectorAll('[data-item-magnet]')) {
    input.addEventListener('input', () => {
      onChange({ ...getSettings(), [input.dataset.itemMagnet]: Number(input.value) });
      refresh();
    });
  }
  refresh();
  return refresh;
}
