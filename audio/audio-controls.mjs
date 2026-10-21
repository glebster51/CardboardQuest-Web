/** Game settings panel; settings are independent of campaign saves and restart. */
export function createAudioControls({ audio, root, trigger, onOpen }) {
  const close = root.querySelector('#audio-close'), mute = root.querySelector('#audio-mute');
  const sliders = [...root.querySelectorAll('input[data-audio-setting]')];
  function render(settings) {
    trigger.setAttribute('aria-label', 'Настройки');
    mute.textContent = settings.muted ? 'Включить звук' : 'Выключить звук';
    mute.setAttribute('aria-pressed', String(settings.muted));
    for (const slider of sliders) {
      slider.value = String(Math.round(settings[slider.dataset.audioSetting] * 100));
      root.querySelector(`#${slider.id}-value`).textContent = `${slider.value}%`;
    }
  }
  function hide() { if (root.hidden) return; root.hidden = true; trigger.setAttribute('aria-expanded', 'false'); trigger.focus(); }
  function show() {
    if (!root.hidden) { hide(); return; }
    onOpen?.(); root.hidden = false; trigger.setAttribute('aria-expanded', 'true'); close.focus();
  }
  trigger.addEventListener('click', show); close.addEventListener('click', hide);
  mute.addEventListener('click', () => audio.setSettings({ muted: !audio.getSettings().muted }));
  for (const slider of sliders) slider.addEventListener('input', () => audio.setSettings({ [slider.dataset.audioSetting]: Number(slider.value) / 100 }));
  document.addEventListener('keydown', event => {
    if (root.hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); hide(); }
    if (event.key === 'Tab') {
      const targets = [...root.querySelectorAll('button, input, a[href]')], first = targets[0], last = targets.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }, true);
  document.addEventListener('pointerdown', event => {
    if (!root.hidden && !root.contains(event.target) && !trigger.contains(event.target)) hide();
  });
  document.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button || button.disabled) return;
    const names = { 'inventory-toggle': 'bagOpen', 'inventory-close': 'bagClose', 'map-toggle': 'mapOpen',
      'world-map-close': 'mapClose', 'story-close': 'dialogue', 'inventory-previous': 'mapClose', 'inventory-next': 'mapOpen' };
    if (button.id === 'inventory-use') return;
    audio.play(names[button.id] ?? (button.classList.contains('inventory-slot') ? 'select'
      : button.closest('#story-options') ? 'choice' : 'click'));
  }, true);
  audio.subscribe(render); render(audio.getSettings());
  return { hide, isOpen: () => !root.hidden };
}
