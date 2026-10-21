import { INVENTORY_CAPACITY, inventoryEntries, inventoryItemAction } from '../game/inventory-items.mjs';
import { heartHealthLevels } from '../heart-health.mjs';

/** Inventory owns only presentation; consuming and saving remain game actions. */
export function createInventoryPanel({ root, trigger, getState, getHealth, onOpen, onUse }) {
  const grid = root.querySelector('#inventory-items'), sheet = root.querySelector('.inventory-sheet');
  const tooltip = root.querySelector('#inventory-tooltip'), close = root.querySelector('#inventory-close');
  const use = root.querySelector('#inventory-use'), notice = root.querySelector('#inventory-notice');
  let selected = null, entries = [], page = 0, allEntries = [], previousFocus = null, warm = false, positioning = false;
  const cells = Array.from({ length: INVENTORY_CAPACITY }, (_, index) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'inventory-slot';
    button.innerHTML = '<span class="inventory-item-icon" aria-hidden="true"></span>';
    button.addEventListener('click', () => {
      const item = entries[index];
      selected = item?.key === selected ? null : item?.key ?? null;
      notice.textContent = ''; renderTooltip();
    });
    grid.append(button); return button;
  });
  function warmArt() {
    if (warm) return; warm = true;
    root.style.setProperty('--inventory-frame', 'url("assets/ui-inventory-frame.webp")');
    root.style.setProperty('--inventory-slot', 'url("assets/ui-inventory-slot.webp")');
    root.style.setProperty('--inventory-hearts', 'url("assets/ui-health-hearts.webp")');
    root.querySelector('#inventory-backpack').src = 'assets/ui-inventory-backpack.webp';
  }
  function hideTooltip() {
    selected = null; tooltip.hidden = true;
    for (const cell of cells) { cell.setAttribute('aria-expanded', 'false'); cell.classList.remove('is-selected'); }
  }
  function positionTooltip() {
    if (tooltip.hidden || root.hidden) return;
    const index = entries.findIndex(item => item?.key === selected), cell = cells[index];
    if (!cell) return;
    const anchor = cell.getBoundingClientRect(), box = tooltip.getBoundingClientRect();
    const viewport = window.visualViewport;
    const insetX = viewport?.offsetLeft ?? 0, insetY = viewport?.offsetTop ?? 0;
    const width = viewport?.width ?? innerWidth, height = viewport?.height ?? innerHeight;
    const left = Math.max(insetX + 10, Math.min(insetX + width - box.width - 10, anchor.x + anchor.width / 2 - box.width / 2));
    const above = anchor.top - box.height - 13;
    const below = above < insetY + 10;
    const top = below ? Math.min(insetY + height - box.height - 10, anchor.bottom + 13) : above;
    tooltip.style.left = `${left}px`; tooltip.style.top = `${Math.max(insetY + 10, top)}px`;
    tooltip.style.setProperty('--tooltip-tip', `${Math.max(22, Math.min(box.width - 22, anchor.x + anchor.width / 2 - left))}px`);
    tooltip.classList.toggle('is-below', below);
  }
  function schedulePosition() {
    if (positioning || tooltip.hidden) return;
    positioning = true;
    requestAnimationFrame(() => { positioning = false; positionTooltip(); });
  }
  function renderTooltip() {
    const item = entries.find(item => item?.key === selected);
    for (let index = 0; index < cells.length; index++) {
      const active = entries[index]?.key === selected && Boolean(item);
      cells[index].classList.toggle('is-selected', active);
      cells[index].setAttribute('aria-expanded', String(active));
    }
    if (!item) { hideTooltip(); return; }
    const { health, maxHealth } = getHealth(), action = inventoryItemAction(item, health, maxHealth);
    tooltip.querySelector('#inventory-item-name').textContent = item.name;
    tooltip.querySelector('#inventory-item-description').textContent = item.description;
    tooltip.querySelector('#inventory-item-effect').textContent = action.hint;
    use.hidden = !action.usable; use.textContent = item.action ?? 'Использовать';
    tooltip.hidden = false; positionTooltip();
  }
  function render() {
    const state = getState(); allEntries = inventoryEntries(state);
    const pages = allEntries.length / INVENTORY_CAPACITY;
    page = Math.min(page, pages - 1); entries = allEntries.slice(page * INVENTORY_CAPACITY, (page + 1) * INVENTORY_CAPACITY);
    for (let index = 0; index < cells.length; index++) {
      const cell = cells[index], item = entries[index];
      cell.dataset.itemId = item?.id ?? '';
      cell.disabled = !item; cell.classList.toggle('is-empty', !item);
      cell.setAttribute('aria-label', item ? item.name : `Пустая ячейка ${index + 1}`);
      const icon = cell.querySelector('.inventory-item-icon'); icon.hidden = !item;
      if (item) { icon.style.setProperty('--item-x', `${item.frame % 4 * 100 / 3}%`); icon.style.setProperty('--item-y', `${Math.floor(item.frame / 4) * 100}%`); }
    }
    root.querySelector('#inventory-capacity').textContent = 'В дорогу';
    root.querySelector('#inventory-empty').hidden = allEntries.some(Boolean);
    root.querySelector('#inventory-pages').hidden = pages === 1;
    root.querySelector('#inventory-page-label').textContent = `${page + 1} / ${pages}`;
    root.querySelector('#inventory-previous').disabled = page === 0;
    root.querySelector('#inventory-next').disabled = page === pages - 1;
    root.querySelector('#inventory-equipment').textContent = [state.defenseBonus > 0 ? `Защита +${state.defenseBonus}` : '',
      state.damageBonus > 0 ? `Урон +${state.damageBonus}` : ''].filter(Boolean).join(' · ');
    const { health, maxHealth } = getHealth();
    const healthBar = root.querySelector('#inventory-health');
    healthBar.setAttribute('aria-label', `Здоровье: ${health / 4} из ${maxHealth / 4} сердец`);
    const levels = heartHealthLevels(health, maxHealth);
    while (healthBar.children.length > levels.length) healthBar.lastElementChild.remove();
    levels.forEach((level, index) => {
      let heart = healthBar.children[index];
      if (!heart) { heart = document.createElement('span'); heart.className = 'inventory-heart'; heart.setAttribute('aria-hidden', 'true'); healthBar.append(heart); }
      heart.dataset.level = String(level);
      heart.style.backgroundPosition = `${level * 25}% 50%`;
    });
    const carried = Object.values(state.items).reduce((total, count) => total + Math.max(0, Math.trunc(Number(count) || 0)), 0);
    const badge = trigger.querySelector('#inventory-count'); badge.hidden = carried === 0;
    badge.textContent = carried > 99 ? '99+' : String(carried);
    trigger.setAttribute('aria-label', carried ? `Рюкзак, предметов: ${carried}` : 'Рюкзак');
    if (!root.hidden) renderTooltip();
  }
  function open() {
    if (!root.hidden) return;
    onOpen?.(); previousFocus = document.activeElement; warmArt(); hideTooltip(); notice.textContent = '';
    root.hidden = false; trigger.setAttribute('aria-expanded', 'true'); render(); close.focus({ preventScroll: true });
  }
  function hide() {
    if (root.hidden) return;
    root.hidden = true; hideTooltip(); trigger.setAttribute('aria-expanded', 'false');
    (previousFocus?.isConnected ? previousFocus : trigger)?.focus({ preventScroll: true });
  }
  use.addEventListener('click', () => {
    const item = entries.find(item => item?.key === selected);
    if (!item || !inventoryItemAction(item, getHealth().health, getHealth().maxHealth).usable) return;
    const result = onUse(item.id, item.slotIndex);
    if (!result?.consumed) return;
    render();
    notice.textContent = `Восстановлено ${String(result.healed / 4).replace('.', ',')} ♥`;
    if (tooltip.hidden) cells.find(cell => !cell.disabled)?.focus({ preventScroll: true });
    else if (use.hidden) cells[entries.findIndex(entry => entry?.key === selected)]?.focus({ preventScroll: true });
  });
  close.addEventListener('click', hide);
  root.querySelector('#inventory-previous').addEventListener('click', () => { page = Math.max(0, page - 1); hideTooltip(); render(); });
  root.querySelector('#inventory-next').addEventListener('click', () => { page++; hideTooltip(); render(); });
  root.querySelector('#inventory-tooltip-close').addEventListener('click', hideTooltip);
  root.addEventListener('click', event => {
    if (event.target === root) hide();
    else if (!tooltip.contains(event.target) && !grid.contains(event.target)) hideTooltip();
  });
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); if (!tooltip.hidden) hideTooltip(); else hide(); }
    if (event.key === 'Tab') {
      const focusable = [...root.querySelectorAll('button:not([disabled])')].filter(button => button.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  addEventListener('resize', schedulePosition); window.visualViewport?.addEventListener('resize', schedulePosition);
  root.addEventListener('scroll', schedulePosition, true);
  new ResizeObserver(schedulePosition).observe(sheet);
  return { open, hide, render, isOpen: () => !root.hidden };
}
