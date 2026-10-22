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

function glyphs() {
  return {
    player: '<circle cx="68" cy="57" r="7" fill="#f1bd6d" stroke="#fff1ce" stroke-width="2"/><path d="M63 58h10m-5-5v9" stroke="#33271f" stroke-width="1.5"/>',
    item: '<path d="m0-7 7 7-7 7-7-7z" fill="#8ecb85" stroke="#e4f3d0" stroke-width="1.5"/>',
    bag: '<path d="M218 48v-5c0-8 16-8 16 0v5m-18 1h20l3 27h-26z" fill="#bc8247" stroke="#f1d29c" stroke-width="2"/><path d="M222 62h8v8h-8z" fill="#f1d29c"/>',
  };
}

export function itemMagnetGizmoMarkup(key, value) {
  const amount = Number(value), label = itemValue(key, amount), shapes = glyphs();
  let drawing = '';
  if (key === 'radius') {
    const radius = 8 + amount / 14 * 42;
    drawing = `<circle cx="68" cy="57" r="${radius.toFixed(1)}" fill="#e9ad5830" stroke="#f1bd6d" stroke-width="2" stroke-dasharray="4 3"/><path d="M68 57h${radius.toFixed(1)}" stroke="#fff0ca" stroke-width="1.5" stroke-dasharray="3 3"/>${shapes.player}<path d="m${(68 + radius).toFixed(1)} 50 7 7-7 7-7-7z" fill="#8ecb85" stroke="#e4f3d0" stroke-width="1.5"/>`;
  } else if (key === 'worldDuration') {
    const fill = amount / 1.5 * 138;
    drawing = `<path d="M35 59h190" stroke="#79684f" stroke-width="4" stroke-linecap="round"/><path d="M35 59h${(35 + fill).toFixed(1)}" stroke="#f1bd6d" stroke-width="4" stroke-linecap="round"/><path d="M35 53 29 59l6 6m190-12 6 6-6 6" fill="none" stroke="#c5b08e" stroke-width="1.5"/><circle cx="43" cy="35" r="13" fill="#302b30" stroke="#edc27d" stroke-width="2"/><path d="M43 27v9l6 3" fill="none" stroke="#fff0ca" stroke-width="2" stroke-linecap="round"/><text x="68" y="39" class="se-gizmo-note">ВРЕМЯ ПОЛЁТА</text><circle cx="35" cy="59" r="5" fill="#8ecb85" stroke="#e4f3d0"/><circle cx="225" cy="59" r="6" fill="#f1bd6d" stroke="#fff1ce" stroke-width="2"/>`;
  } else if (key === 'worldArc') {
    const peakY = 76 - amount / 8 * 55;
    drawing = `<path d="M28 79h204" stroke="#85745a" stroke-width="1.5" stroke-dasharray="4 4"/><path d="M30 78Q130 ${peakY.toFixed(1)} 230 78" fill="none" stroke="#f1bd6d" stroke-width="3" stroke-linecap="round"/><circle cx="130" cy="${peakY.toFixed(1)}" r="4" fill="#fff0ca"/><circle cx="30" cy="78" r="5" fill="#8ecb85" stroke="#e4f3d0"/><circle cx="230" cy="78" r="6" fill="#f1bd6d" stroke="#fff1ce" stroke-width="2"/><path d="M126 79v${(peakY - 79).toFixed(1)}" stroke="#c5b08e" stroke-dasharray="3 3"/><text x="98" y="22" class="se-gizmo-note">ВЫСОТА ДУГИ</text>`;
  } else if (key === 'iconDuration') {
    const fill = amount / 2 * 140;
    drawing = `<path d="M37 66Q122 20 221 53" fill="none" stroke="#8b795e" stroke-width="2" stroke-dasharray="4 4"/><path d="M37 66Q122 20 ${(37 + fill).toFixed(1)} ${(66 - 13 * fill / 140).toFixed(1)}" fill="none" stroke="#f1bd6d" stroke-width="3"/><circle cx="37" cy="66" r="6" fill="#8ecb85" stroke="#e4f3d0"/>${shapes.bag}<rect x="38" y="83" width="180" height="5" rx="2.5" fill="#554a3b"/><rect x="38" y="83" width="${fill.toFixed(1)}" height="5" rx="2.5" fill="#f1bd6d"/><text x="38" y="36" class="se-gizmo-note">ДОСТАВКА В РЮКЗАК</text>`;
  } else {
    const bend = 12 + amount / 600 * 52;
    drawing = `<path d="M34 75Q128 ${(75 - bend).toFixed(1)} 224 48" fill="none" stroke="#f1bd6d" stroke-width="3" stroke-linecap="round"/><path d="M34 75Q128 ${(75 + bend * .55).toFixed(1)} 224 48" fill="none" stroke="#d5a96c" stroke-width="1.5" stroke-dasharray="4 4" opacity=".65"/><circle cx="34" cy="75" r="6" fill="#8ecb85" stroke="#e4f3d0"/>${shapes.bag}<path d="M126 75v${(-bend).toFixed(1)}" stroke="#c5b08e" stroke-dasharray="3 3"/><text x="68" y="28" class="se-gizmo-note">СЛУЧАЙНАЯ ДУГА ИКОНКИ</text>`;
  }
  return `<svg viewBox="0 0 260 104" aria-hidden="true" focusable="false"><defs><pattern id="magnet-grid-${key}" width="13" height="13" patternUnits="userSpaceOnUse"><path d="M13 0H0V13" fill="none" stroke="#ffffff0b" stroke-width="1"/></pattern></defs><rect x=".5" y=".5" width="259" height="103" rx="9" fill="#252830" stroke="#746552"/><rect x="1" y="1" width="258" height="102" rx="8" fill="url(#magnet-grid-${key})"/>${drawing}<text x="220" y="97" text-anchor="end" class="se-gizmo-value">${label}</text></svg>`;
}

export function createItemMagnetSettingsMarkup(settings) {
  const normalized = normalizeItemMagnetSettings(settings);
  const controls = Object.entries(CONTROL_INFO).map(([key, info]) => `<div class="se-magnet-control" data-magnet-control="${key}">
    <label><span>${info.label} <output>${itemValue(key, normalized[key])}</output></span><input data-item-magnet="${key}" aria-label="${info.aria}" type="range" min="${info.min}" max="${info.max}" step="${info.step}" value="${normalized[key]}"></label>
    <div class="se-magnet-gizmo" data-item-magnet-gizmo="${key}" role="img" aria-label="${info.aria}: ${itemValue(key, normalized[key])}">${itemMagnetGizmoMarkup(key, normalized[key])}</div>
  </div>`).join('');
  return `<details class="se-module"><summary>Магнит предметов</summary><div class="se-module-content se-item-magnet" role="group" aria-label="Настройки автоматического подбора предметов">
    ${controls}
    <small>Наведи на ползунок или переведи на него фокус, чтобы увидеть схему его значения.</small>
    <small>Каждый предмет летит по собственной случайной дуге; несколько иконок могут лететь одновременно.</small>
  </div></details>`;
}

function format(input) {
  return itemValue(input.dataset.itemMagnet, Number(input.value));
}

export function bindItemMagnetSettings({ panel, getSettings, onChange }) {
  const refresh = () => {
    const settings = normalizeItemMagnetSettings(getSettings());
    for (const input of panel.querySelectorAll('[data-item-magnet]')) {
      const key = input.dataset.itemMagnet, value = settings[key];
      input.value = value;
      input.closest('label').querySelector('output').value = format(input);
      const gizmo = panel.querySelector(`[data-item-magnet-gizmo="${key}"]`);
      gizmo.innerHTML = itemMagnetGizmoMarkup(key, value);
      gizmo.setAttribute('aria-label', `${CONTROL_INFO[key].aria}: ${itemValue(key, value)}`);
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
