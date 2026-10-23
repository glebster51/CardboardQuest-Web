import { INVENTORY_CAPACITY, inventoryEntries, inventoryItemAction } from '../game/inventory-items.mjs?v=4';
import { heartHealthLevels } from '../heart-health.mjs';
import { combatBonuses, equipmentItem, EQUIPMENT_SLOT_LABELS, normalizeEquipment } from '../game/equipment.mjs?v=1';
import { normalizeCoins } from '../game/currency.mjs?v=1';

/** Inventory owns only presentation; consuming and saving remain game actions. */
export function createInventoryPanel({ root, trigger, getState, getHealth, onOpen, onUse, onEquip, onUnequip, onDrop }) {
  const grid = root.querySelector('#inventory-items'), sheet = root.querySelector('.inventory-sheet');
  const tooltip = root.querySelector('#inventory-tooltip'), close = root.querySelector('#inventory-close');
  const use = root.querySelector('#inventory-use'), notice = root.querySelector('#inventory-notice');
  let selected = null, entries = [], page = 0, allEntries = [], previousFocus = null, warm = false, positioning = false;
  let itemDrag = null, suppressClick = false;
  const equipmentBar = document.createElement('section'); equipmentBar.id = 'inventory-worn';
  equipmentBar.setAttribute('aria-label', 'Экипировка персонажа');
  sheet.querySelector('.inventory-heading').after(equipmentBar);
  const wallet = document.createElement('span'); wallet.id = 'inventory-coins'; wallet.className = 'coin-balance';
  wallet.setAttribute('aria-live', 'polite'); sheet.querySelector('.inventory-heading>div').append(wallet);
  const equipmentSlots = ['weapon', 'helmet', 'shield', 'orb', 'orb', 'orb'].map((slot, index) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'inventory-worn-slot';
    button.dataset.equipmentSlot = slot; button.dataset.orbIndex = String(Math.max(0, index - 3));
    button.innerHTML = '<span class="inventory-worn-image"></span><small></small>';
    button.addEventListener('click', () => {
      const result = onUnequip?.(slot, Math.max(0, index - 3));
      render(); notice.textContent = result?.changed ? `${equipmentItem(result.unequipped).name} — в рюкзаке` : result?.error ?? '';
    });
    equipmentBar.append(button); return button;
  });
  const cells = Array.from({ length: INVENTORY_CAPACITY }, (_, index) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'inventory-slot';
    button.innerHTML = '<span class="inventory-item-icon" aria-hidden="true"><span class="inventory-healing" hidden></span></span>';
    button.addEventListener('click', event => {
      if (suppressClick) { suppressClick = false; event.preventDefault(); return; }
      const item = entries[index];
      selected = item?.key === selected ? null : item?.key ?? null;
      notice.textContent = ''; renderTooltip();
    });
    button.addEventListener('pointerdown', event => {
      const item = entries[index];
      if (!item || event.button !== 0) return;
      itemDrag = { pointerId: event.pointerId, itemId: item.id, slotIndex: item.slotIndex,
        startX: event.clientX, startY: event.clientY, moved: false, ghost: null, source: button };
      button.setPointerCapture?.(event.pointerId);
    });
    grid.append(button); return button;
  });
  function moveItemDrag(event) {
    if (!itemDrag || event.pointerId !== itemDrag.pointerId) return;
    if (!itemDrag.moved && Math.hypot(event.clientX - itemDrag.startX, event.clientY - itemDrag.startY) < 8) return;
    itemDrag.moved = true; event.preventDefault();
    if (!itemDrag.ghost) {
      const sourceIcon = itemDrag.source.querySelector('.inventory-item-icon');
      const ghost = sourceIcon.cloneNode(false), style = getComputedStyle(sourceIcon);
      ghost.classList.add('inventory-drag-ghost');
      Object.assign(ghost.style, { position: 'fixed', left: '0', top: '0', width: '58px', height: '58px',
        zIndex: '10001', pointerEvents: 'none', opacity: '.94', backgroundImage: style.backgroundImage,
        backgroundSize: style.backgroundSize, backgroundPosition: style.backgroundPosition,
        transform: 'translate(-50%, -50%) scale(1.08)', filter: 'drop-shadow(0 5px 7px #160e0acc)' });
      document.body.append(ghost); itemDrag.ghost = ghost;
      itemDrag.source.classList.add('is-dragging');
    }
    itemDrag.ghost.style.left = `${event.clientX}px`; itemDrag.ghost.style.top = `${event.clientY}px`;
  }
  function finishItemDrag(event, cancelled = false) {
    if (!itemDrag || event.pointerId !== itemDrag.pointerId) return;
    const drag = itemDrag; itemDrag = null;
    drag.ghost?.remove(); drag.source.classList.remove('is-dragging');
    if (!drag.moved) return;
    suppressClick = true; setTimeout(() => { suppressClick = false; }, 0);
    event.preventDefault();
    if (cancelled) return;
    const rect = sheet.getBoundingClientRect(), outside = event.clientX < rect.left || event.clientX > rect.right
      || event.clientY < rect.top || event.clientY > rect.bottom;
    if (!outside) return;
    const result = onDrop?.(drag.itemId, drag.slotIndex, { x: event.clientX, y: event.clientY });
    if (result?.dropped) { hideTooltip(); render(); notice.textContent = `Выброшено: ${result.name ?? 'предмет'}`; }
    else if (result?.error) notice.textContent = result.error;
  }
  window.addEventListener('pointermove', moveItemDrag, { passive: false });
  window.addEventListener('pointerup', event => finishItemDrag(event));
  window.addEventListener('pointercancel', event => finishItemDrag(event, true));
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
    const { health, maxHealth } = getHealth(), action = inventoryItemAction(item, health, maxHealth, getState());
    tooltip.querySelector('#inventory-item-name').textContent = item.name;
    tooltip.querySelector('#inventory-item-description').textContent = item.description;
    tooltip.querySelector('#inventory-item-effect').textContent = action.hint;
    use.hidden = !action.usable; use.textContent = item.action ?? 'Использовать';
    tooltip.hidden = false; positionTooltip();
  }
  function render() {
    const state = getState(); allEntries = inventoryEntries(state);
    wallet.textContent = `◈ ${normalizeCoins(state.coins).toLocaleString('ru-RU')} монет`;
    const pages = allEntries.length / INVENTORY_CAPACITY;
    page = Math.min(page, pages - 1); entries = allEntries.slice(page * INVENTORY_CAPACITY, (page + 1) * INVENTORY_CAPACITY);
    for (let index = 0; index < cells.length; index++) {
      const cell = cells[index], item = entries[index];
      cell.dataset.itemId = item?.id ?? '';
      cell.disabled = !item; cell.classList.toggle('is-empty', !item);
      const healingLabel = item?.healing ? `, восстановление здоровья: ${String(item.healing / 4).replace('.', ',')} ♥` : '';
      cell.setAttribute('aria-label', item ? item.name + healingLabel : `Пустая ячейка ${index + 1}`);
      const icon = cell.querySelector('.inventory-item-icon'); icon.hidden = !item;
      icon.classList.toggle('is-equipment', Boolean(item?.image));
      icon.style.backgroundImage = item?.image ? `url("${item.image}")` : '';
      if (item && !item.image) { icon.style.setProperty('--item-x', `${item.frame % 4 * 100 / 3}%`); icon.style.setProperty('--item-y', `${Math.floor(item.frame / 4) * 100}%`); }
      const healing = icon.querySelector('.inventory-healing');
      const healingLevels = item?.healing ? heartHealthLevels(item.healing, item.healing) : [];
      healing.hidden = healingLevels.length === 0;
      healing.style.setProperty('--healing-count', healingLevels.length);
      healing.replaceChildren(...healingLevels.map((level, index) => {
        const heart = document.createElement('span'); heart.className = 'inventory-healing-heart';
        heart.dataset.level = String(level); heart.style.backgroundPosition = `${level * 25}% 50%`;
        heart.style.setProperty('--healing-offset', index / Math.max(1, healingLevels.length - 1));
        heart.style.zIndex = String(index);
        return heart;
      }));
    }
    root.querySelector('#inventory-capacity').textContent = 'В дорогу';
    root.querySelector('#inventory-empty').hidden = allEntries.some(Boolean);
    root.querySelector('#inventory-pages').hidden = pages === 1;
    root.querySelector('#inventory-page-label').textContent = `${page + 1} / ${pages}`;
    root.querySelector('#inventory-previous').disabled = page === 0;
    root.querySelector('#inventory-next').disabled = page === pages - 1;
    const bonus = combatBonuses(state), gear = normalizeEquipment(state.equipment);
    root.querySelector('#inventory-equipment').textContent = `Урон +${bonus.damage} · Защита +${bonus.defense}`;
    equipmentSlots.forEach((button, index) => {
      const slot = button.dataset.equipmentSlot, id = slot === 'orb' ? gear.orbs[index - 3] : gear[slot];
      const item = equipmentItem(id), label = EQUIPMENT_SLOT_LABELS[slot] + (slot === 'orb' ? ` ${index - 2}` : '');
      button.disabled = !item; button.dataset.itemId = id ?? '';
      button.querySelector('small').textContent = label;
      button.querySelector('span').style.backgroundImage = item ? `url("${item.image}")` : '';
      button.setAttribute('aria-label', item ? `Снять: ${item.name}, ${item.hint}` : `${label}: пусто`);
      button.title = item ? `${item.name} · ${item.hint} · нажми, чтобы снять` : label;
    });
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
    if (!item || !inventoryItemAction(item, getHealth().health, getHealth().maxHealth, getState()).usable) return;
    if (item.slot) {
      const result = onEquip?.(item.id, item.slotIndex);
      if (result?.changed) { hideTooltip(); render(); notice.textContent = `Надето: ${item.name} · ${item.hint}`; }
      else notice.textContent = result?.error ?? 'Не удалось надеть предмет';
      return;
    }
    const result = onUse(item.id, item.slotIndex);
    if (!result?.consumed) return;
    render();
    notice.textContent = result.healed
      ? `Восстановлено ${String(result.healed / 4).replace('.', ',')} ♥${result.effectLabel ? ` · ${result.effectLabel} на 2 локации` : ''}`
      : `${result.effectLabel ?? 'Перевязь использована'}`;
    if (tooltip.hidden) cells.find(cell => !cell.disabled)?.focus({ preventScroll: true });
    else if (use.hidden) cells[entries.findIndex(entry => entry?.key === selected)]?.focus({ preventScroll: true });
  });
  close.addEventListener('click', hide);
  root.querySelector('#inventory-previous').addEventListener('click', () => { page = Math.max(0, page - 1); hideTooltip(); render(); });
  root.querySelector('#inventory-next').addEventListener('click', () => { page++; hideTooltip(); render(); });
  root.querySelector('#inventory-tooltip-close').addEventListener('click', hideTooltip);
  root.addEventListener('click', event => {
    if (suppressClick) { suppressClick = false; event.preventDefault(); event.stopPropagation(); return; }
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
