/** Shared motion and feedback rules for diegetic HTML UI windows. */
export const UI_IN_EASING = 'cubic-bezier(.22,1,.36,1)';

const windowMotion = new WeakMap();
const SQUASH_FRAMES = [
  { transform: 'scale(1,1)' },
  { transform: 'scale(1.08,.84)', offset: .28 },
  { transform: 'scale(.94,1.08)', offset: .52 },
  { transform: 'scale(1.025,.98)', offset: .74 },
  { transform: 'scale(1,1)' },
];

function reducedMotion(root) {
  return root.ownerDocument?.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
}

function surface(root) {
  if (root.matches?.('[data-ui-motion-surface]')) return root;
  return root.querySelector?.('[data-ui-motion-surface]') ?? root.firstElementChild ?? root;
}

function enteringFrames(anchor) {
  if (anchor === 'left') return [{ opacity: 0, translate: '-110% 0' }, { opacity: 1, translate: '0 0' }];
  if (anchor === 'right') return [{ opacity: 0, translate: '110% 0' }, { opacity: 1, translate: '0 0' }];
  if (anchor === 'top') return [{ opacity: 0, translate: '0 -110%' }, { opacity: 1, translate: '0 0' }];
  if (anchor === 'bottom') return [{ opacity: 0, translate: '0 110%' }, { opacity: 1, translate: '0 0' }];
  return [
    { opacity: 0, scale: '.76' },
    { opacity: 1, scale: '1.075', offset: .66 },
    { opacity: 1, scale: '.97', offset: .84 },
    { opacity: 1, scale: '1' },
  ];
}

function leavingFrames(anchor) {
  if (anchor === 'left') return [{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: '-18% 0' }];
  if (anchor === 'right') return [{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: '18% 0' }];
  if (anchor === 'top') return [{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: '0 -18%' }];
  if (anchor === 'bottom') return [{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: '0 18%' }];
  return [{ opacity: 1, scale: '1' }, { opacity: 0, scale: '.94' }];
}

function settle(root, token, state) {
  if (windowMotion.get(root) !== token) return false;
  windowMotion.delete(root);
  token.animation.cancel();
  root.dataset.uiMotionState = state;
  return true;
}

/** Show a hidden panel with an edge slide or a center bounce, based on data-ui-anchor. */
export function showUIWindow(root) {
  if (!root) return Promise.resolve(false);
  const running = windowMotion.get(root);
  if (!root.hidden && root.dataset.uiMotionState === 'open' && !running) return Promise.resolve(false);
  running?.animation?.cancel();
  root.hidden = false;
  root.inert = false; root.removeAttribute('aria-hidden');
  const target = surface(root), anchor = root.dataset.uiAnchor ?? 'center';
  if (reducedMotion(root) || typeof target.animate !== 'function') {
    windowMotion.delete(root); root.dataset.uiMotionState = 'open'; return Promise.resolve(true);
  }
  root.dataset.uiMotionState = 'opening';
  const animation = target.animate(enteringFrames(anchor), {
    duration: anchor === 'center' ? 430 : 380, easing: UI_IN_EASING, fill: 'both',
  });
  const token = { animation, promise: null };
  token.promise = animation.finished.then(() => settle(root, token, 'open')).catch(() => false);
  windowMotion.set(root, token);
  return token.promise;
}

/** Close a panel only after its short anchor-aware exit, preserving the hidden contract. */
export function hideUIWindow(root) {
  if (!root || root.hidden) return Promise.resolve(false);
  const running = windowMotion.get(root);
  if (root.dataset.uiMotionState === 'closing' && running) return running.promise;
  running?.animation?.cancel();
  root.inert = true; root.setAttribute('aria-hidden', 'true');
  const target = surface(root), anchor = root.dataset.uiAnchor ?? 'center';
  if (reducedMotion(root) || typeof target.animate !== 'function') {
    root.hidden = true; delete root.dataset.uiMotionState; windowMotion.delete(root); return Promise.resolve(true);
  }
  root.dataset.uiMotionState = 'closing';
  const animation = target.animate(leavingFrames(anchor), { duration: 170, easing: UI_IN_EASING, fill: 'both' });
  const token = { animation, promise: null };
  token.promise = animation.finished.then(() => {
    if (!settle(root, token, 'closed')) return false;
    root.hidden = true; delete root.dataset.uiMotionState; return true;
  }).catch(() => false);
  windowMotion.set(root, token);
  return token.promise;
}

/** Animate a small state update (count, value, portrait, notice) without replacing its art. */
export function indicateUIChange(element, kind = 'change') {
  if (!element) return false;
  element.dataset.uiChanged = kind;
  if (reducedMotion(element)) return false;
  if (typeof element.animate !== 'function') return false;
  element.animate([
    { transform: 'scale(1)', filter: 'brightness(1)' },
    { transform: 'scale(.96,1.04)', filter: 'brightness(1.22)' },
    { transform: 'scale(1.025,.985)', filter: 'brightness(1.08)' },
    { transform: 'scale(1)', filter: 'brightness(1)' },
  ], { duration: 300, easing: UI_IN_EASING });
  return true;
}

/** Give every activated control the same light paper/cardboard squash response. */
export function squashUIControl(element) {
  if (!element || element.disabled || element.dataset.uiNoSquash === 'true' || reducedMotion(element)) return false;
  if (typeof element.animate !== 'function') return false;
  element.animate(SQUASH_FRAMES, { duration: 330, easing: UI_IN_EASING });
  return true;
}

/** Install once at the app root; individual views call indicateUIChange for programmatic updates. */
export function installUIFeedback(root = document) {
  const onClick = event => {
    const control = event.target?.closest?.('button, [role="button"], [data-ui-interactive]');
    if (control && root.contains(control)) squashUIControl(control);
  };
  const onValueChange = event => {
    const control = event.target;
    if (!control?.matches?.('input, select, textarea, [contenteditable="true"]')) return;
    indicateUIChange(control, event.type);
    const output = control.id && root.querySelector?.(`output[for="${control.id}"]`);
    if (output) indicateUIChange(output, 'value');
  };
  root.addEventListener('click', onClick, true);
  root.addEventListener('input', onValueChange, true);
  root.addEventListener('change', onValueChange, true);
  return () => {
    root.removeEventListener('click', onClick, true);
    root.removeEventListener('input', onValueChange, true);
    root.removeEventListener('change', onValueChange, true);
  };
}
