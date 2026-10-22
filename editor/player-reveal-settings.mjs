export function createPlayerRevealSettingsMarkup() {
  return `<details class="se-module" open><summary>Просвет сквозь окружение</summary>
    <div class="se-module-content se-player-reveal" role="group" aria-label="Настройки просвета сквозь окружение">
      <label class="se-reveal-toggle"><input data-reveal-setting="revealEnabled" aria-label="Включить просвет игрока сквозь окружение" type="checkbox"> Просвет сквозь окружение</label>
      <label>Внутренний радиус <output></output><input data-reveal-setting="revealInnerRadius" aria-label="Внутренний радиус просвета игрока" type="range" min="0" max="480" step="1"></label>
      <label>Внешний радиус <output></output><input data-reveal-setting="revealOuterRadius" aria-label="Внешний радиус просвета игрока" type="range" min="1" max="640" step="1"></label>
      <label>Плавность глубины Add <output></output><input data-reveal-setting="revealDepthFadeAdd" aria-label="Добавка плавности просвета по глубине" type="range" min="0" max="4" step=".01"></label>
      <label>Плавность глубины Multiply <output></output><input data-reveal-setting="revealDepthFadeMultiply" aria-label="Множитель плавности просвета по глубине" type="range" min=".05" max="4" step=".01"></label>
      <label class="se-reveal-toggle"><input data-reveal-setting="revealNoiseEnabled" aria-label="Включить шум просвета" type="checkbox"> Шум просвета</label>
      <div class="se-reveal-noise-mode" role="group" aria-label="Тип шума просвета">
        <span>Тип шума</span><div><button type="button" data-reveal-noise-type="voronoi" aria-pressed="true">Voronoi</button>
        <button type="button" data-reveal-noise-type="gaussian" aria-pressed="false">Gaussian</button></div>
      </div>
      <label>Масштаб шума <output></output><input data-reveal-setting="revealNoiseSize" aria-label="Размер ячеек шума просвета" type="range" min="2" max="160" step="1"></label>
      <label>Сдвиг шума <output></output><input data-reveal-setting="revealNoiseShift" aria-label="Сдвиг шума просвета" type="range" min="-1" max="1" step=".01"></label>
      <label>Умножение шума <output></output><input data-reveal-setting="revealNoiseMultiply" aria-label="Множитель шума до формулы просвета" type="range" min="0" max="2" step=".01"></label>
      <label>Скорость шума X <output></output><input data-reveal-setting="revealNoiseSpeedX" aria-label="Скорость прокрутки шума по X" type="range" min="-2" max="2" step=".01"></label>
      <label>Скорость шума Y <output></output><input data-reveal-setting="revealNoiseSpeedY" aria-label="Скорость прокрутки шума по Y" type="range" min="-2" max="2" step=".01"></label>
      <label>Размер шахматки <output></output><input data-reveal-setting="revealCheckerSize" aria-label="Размер пиксельной шахматки просвета" type="range" min="1" max="16" step="0.5"></label>
    </div></details>`;
}

function formatOutput(input) {
  const value = Number(input.value), key = input.dataset.revealSetting;
  if (key === 'revealCheckerSize' || key === 'revealNoiseSize') return `${value.toFixed(1)} px`;
  if (key === 'revealNoiseShift' || key === 'revealNoiseMultiply'
    || key === 'revealDepthFadeAdd' || key === 'revealDepthFadeMultiply') return value.toFixed(2);
  if (key.startsWith('revealNoiseSpeed')) return `${value.toFixed(2)} яч/с`;
  return `${value.toFixed(0)} px`;
}

export function refreshPlayerRevealSettings(panel, settings) {
  for (const input of panel.querySelectorAll('[data-reveal-setting]')) {
    const value = settings[input.dataset.revealSetting];
    if (input.type === 'checkbox') input.checked = Boolean(value);
    else input.value = value;
    const output = input.closest('label').querySelector('output');
    if (output) output.value = formatOutput(input);
  }
  for (const button of panel.querySelectorAll('[data-reveal-noise-type]'))
    button.setAttribute('aria-pressed', String(button.dataset.revealNoiseType === settings.revealNoiseType));
}

export function bindPlayerRevealSettings({ panel, registry, model, changed }) {
  const refresh = () => refreshPlayerRevealSettings(panel, registry.fog);
  function apply(key, value) {
    const settings = { ...registry.fog, [key]: value };
    if (settings.revealOuterRadius <= settings.revealInnerRadius) {
      if (key === 'revealInnerRadius') settings.revealOuterRadius = settings.revealInnerRadius + 1;
      else settings.revealInnerRadius = Math.max(0, settings.revealOuterRadius - 1);
    }
    registry.changeFog(settings);
    refresh();
    changed();
  }
  for (const input of panel.querySelectorAll('[data-reveal-setting]')) {
    input.addEventListener('pointerdown', () => model.begin());
    input.addEventListener('change', () => model.commit());
    input.addEventListener('input', () => apply(input.dataset.revealSetting,
      input.type === 'checkbox' ? input.checked : Number(input.value)));
  }
  for (const button of panel.querySelectorAll('[data-reveal-noise-type]')) button.addEventListener('click', () => {
    if (registry.fog.revealNoiseType === button.dataset.revealNoiseType) return;
    model.begin();
    apply('revealNoiseType', button.dataset.revealNoiseType);
    model.commit();
  });
  refresh();
  return refresh;
}
