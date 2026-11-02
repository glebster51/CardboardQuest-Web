import { hideUIWindow, indicateUIChange, showUIWindow } from '../render/ui-window-motion.mjs?v=f484ba7b7b13e7f6';

/** Game settings panel; settings are independent of campaign saves and restart. */
export function createAudioControls({ audio, root, trigger, onOpen }) {
  root.dataset.uiAnchor ??= 'top';
  const overlay = document.querySelector('#audio-overlay');
  const close = root.querySelector('#audio-close'), mute = root.querySelector('#audio-mute');
  const fullscreen = root.querySelector('#audio-fullscreen');
  const sliders = [...root.querySelectorAll('input[data-audio-setting]')];
  let overlayTransition = 0;
  let overlayFrame = 0;
  let overlayHideTimer = 0;
  function showOverlay() {
    clearTimeout(overlayHideTimer);
    cancelAnimationFrame(overlayFrame);
    overlay.hidden = false;
    overlayFrame = requestAnimationFrame(() => overlay.classList.add('is-visible'));
  }
  function hideOverlay() {
    cancelAnimationFrame(overlayFrame);
    overlay.classList.remove('is-visible');
    clearTimeout(overlayHideTimer);
    overlayHideTimer = window.setTimeout(() => {
      if (root.hidden && !overlay.classList.contains('is-visible')) overlay.hidden = true;
    }, 220);
  }
  function render(settings) {
    trigger.setAttribute('aria-label', 'Настройки');
    mute.textContent = settings.muted ? 'Включить звук' : 'Выключить звук';
    mute.setAttribute('aria-pressed', String(settings.muted));
    for (const slider of sliders) {
      const output = root.querySelector(`#${slider.id}-value`), previousValue = output.textContent;
      slider.value = String(Math.round(settings[slider.dataset.audioSetting] * 100));
      output.textContent = `${slider.value}%`;
      if (previousValue !== output.textContent) indicateUIChange(output, 'value');
    }
  }
  function hide() {
    if (root.hidden) return;
    const transition = ++overlayTransition;
    const closing = hideUIWindow(root);
    trigger.setAttribute('aria-expanded', 'false'); trigger.focus();
    void closing.then(() => { if (transition === overlayTransition && root.hidden) hideOverlay(); });
  }
  function show() {
    if (!root.hidden && root.dataset.uiMotionState !== 'closing') { hide(); return; }
    overlayTransition++; showOverlay();
    onOpen?.(); void showUIWindow(root); trigger.setAttribute('aria-expanded', 'true'); close.focus();
  }
  trigger.addEventListener('click', show); close.addEventListener('click', hide);
  mute.addEventListener('click', () => audio.setSettings({ muted: !audio.getSettings().muted }));
  function renderFullscreen() {
    const previousText = fullscreen.textContent;
    const active = Boolean(document.fullscreenElement);
    fullscreen.textContent = active ? 'Выйти из полного экрана' : 'Во весь экран';
    fullscreen.setAttribute('aria-pressed', String(active));
    fullscreen.disabled = !active && !document.fullscreenEnabled;
    if (fullscreen.disabled) fullscreen.textContent = 'Полный экран недоступен';
    if (fullscreen.textContent !== previousText) indicateUIChange(fullscreen, 'status');
  }
  fullscreen.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { /* Keep the current state when the browser denies fullscreen. */ }
    renderFullscreen();
  });
  document.addEventListener('fullscreenchange', renderFullscreen);
  for (const slider of sliders) slider.addEventListener('input', () => audio.setSettings({ [slider.dataset.audioSetting]: Number(slider.value) / 100 }));
  document.addEventListener('keydown', event => {
    if (root.hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); hide(); }
    if (event.key === 'Tab') {
      const targets = [...root.querySelectorAll('button:not(:disabled), input, a[href]')], first = targets[0], last = targets.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }, true);
  document.addEventListener('pointerdown', event => {
    if (!root.hidden && !root.contains(event.target) && !trigger.contains(event.target)) hide();
  });
  document.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button || button.disabled) return;
    const names = { 'inventory-toggle': 'bagOpen', 'inventory-close': 'bagClose', 'location-info': 'mapOpen',
      'world-map-close': 'mapClose', 'story-close': 'dialogue', 'inventory-previous': 'mapClose', 'inventory-next': 'mapOpen' };
    if (button.id === 'inventory-use') return;
    audio.play(names[button.id] ?? (button.classList.contains('inventory-slot') ? 'select'
      : button.closest('#story-options') ? 'choice' : 'click'));
  }, true);
  audio.subscribe(render); render(audio.getSettings()); renderFullscreen();
  return { hide, isOpen: () => !root.hidden };
}
