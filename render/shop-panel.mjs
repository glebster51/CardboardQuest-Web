import { merchantDefinition, merchantStock, MERCHANT_BUYBACK_VALUES } from '../game/merchants.mjs?v=ab782efa5048549c';
import { INVENTORY_ITEMS } from '../game/inventory-items.mjs?v=ab782efa5048549c';
import { normalizeCoins } from '../game/currency.mjs?v=ab782efa5048549c';
import { hideUIWindow, indicateUIChange, showUIWindow } from './ui-window-motion.mjs?v=ab782efa5048549c';

/** Two-sided trade proposal: the save changes only after the player confirms it. */
export function createShopPanel({ getState, onOpen, onTrade, onCommit }) {
  const root = document.createElement('section'); root.id = 'shop-panel'; root.hidden = true;
  root.dataset.uiAnchor = 'center';
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'shop-title');
  root.innerHTML = `<article class="shop-sheet shop-trade-sheet"><header class="shop-heading"><img class="shop-portrait" src="assets/economy/merchant.png" alt="">
    <div class="shop-heading-copy"><small id="shop-name"></small><h2 id="shop-title"></h2><span class="coin-balance">Твои монеты: <b id="shop-coins">0</b></span></div>
    <button id="shop-close" type="button" aria-label="Отменить обмен и закрыть магазин">×</button></header>
    <section class="trade-inventory trade-player" data-drop-side="player" aria-labelledby="trade-player-title">
      <div class="trade-pane-heading"><h3 id="trade-player-title">Твой рюкзак</h3><small>Перетащи предмет торговцу или нажми, чтобы предложить</small></div>
      <div id="trade-player-items" class="trade-items"></div>
    </section>
    <section class="trade-ledger" aria-live="polite"><div><small>Ты отдаёшь</small><strong id="trade-sell-total">Ничего</strong></div>
      <span class="trade-arrow" aria-hidden="true">⇅</span><div><small>Получаешь</small><strong id="trade-buy-total">Ничего</strong></div>
      <div class="trade-balance"><small>После сделки</small><strong id="trade-balance">0 ◈</strong></div></section>
    <section class="trade-inventory trade-merchant" data-drop-side="merchant" aria-labelledby="trade-merchant-title">
      <div class="trade-pane-heading"><h3 id="trade-merchant-title">Товары торговца</h3><small>Перетащи к себе или нажми, чтобы добавить в обмен</small></div>
      <div id="trade-merchant-items" class="trade-items"></div>
    </section>
    <p id="shop-notice" role="status" aria-live="polite"></p>
    <footer class="trade-actions"><button id="trade-cancel" type="button">Отменить обмен</button><button id="trade-confirm" type="button" disabled>Совершить обмен</button></footer>
    </article>`;
  document.body.append(root);
  const playerArea = root.querySelector('#trade-player-items'), merchantArea = root.querySelector('#trade-merchant-items');
  const close = root.querySelector('#shop-close'), cancel = root.querySelector('#trade-cancel'), confirm = root.querySelector('#trade-confirm');
  const notice = root.querySelector('#shop-notice'), playerPane = root.querySelector('.trade-player'), merchantPane = root.querySelector('.trade-merchant');
  let actor = null, previousFocus, buys = new Map(), sells = new Map();
  const asLines = values => [...values].filter(([, quantity]) => quantity > 0).map(([itemId, quantity]) => ({ itemId, quantity }));
  const itemInfo = id => INVENTORY_ITEMS.find(item => item.id === id);
  const valueOf = (side, id, merchant) => side === 'buy'
    ? merchant.offers.find(offer => offer.itemId === id)?.price ?? 0 : MERCHANT_BUYBACK_VALUES[id] ?? 0;

  function stage(side, itemId, quantity = 1) {
    if (!actor || !Number.isInteger(quantity) || quantity === 0) return;
    const returnFocus = document.activeElement?.closest?.('.trade-item')?.dataset;
    const state = getState(), target = side === 'buy' ? buys : sells;
    const item = itemInfo(itemId), current = target.get(itemId) ?? 0, next = current + quantity;
    if (!item) return;
    if (next <= 0) target.delete(itemId);
    else {
      const stock = side === 'buy' ? merchantStock(state, actor.merchantId, itemId) : Number(state.items?.[itemId]) || 0;
      const otherCount = side === 'buy' ? Math.max(0, (Number(state.items?.[itemId]) || 0) - (sells.get(itemId) ?? 0)) : 0;
      const limit = side === 'buy' ? Math.min(stock, Math.max(0, 99 - otherCount)) : stock;
      if (next > limit) {
        notice.textContent = side === 'buy' ? (stock <= current ? 'Этого товара больше нет в наличии.' : 'В рюкзаке не помещается ещё один такой предмет.')
          : 'В рюкзаке нет столько предметов для обмена.';
        return;
      }
      target.set(itemId, next);
    }
    notice.textContent = ''; render();
    indicateUIChange(root.querySelector('.trade-ledger'), 'trade');
    if (returnFocus) {
      const card = root.querySelector(`.trade-item[data-trade-side="${returnFocus.tradeSide}"][data-trade-item="${returnFocus.tradeItem}"]`);
      const preferred = target.get(itemId) ? card?.querySelector('.trade-adjust:not([hidden])') : card?.querySelector('.trade-select:not(:disabled)');
      (preferred ?? card?.querySelector('.trade-adjust:not([hidden])'))?.focus({ preventScroll: true });
    }
  }

  function iconFor(item, icon) {
    icon.className = 'inventory-item-icon';
    icon.setAttribute('aria-hidden', 'true');
    if (item.image) { icon.classList.add('is-equipment'); icon.style.backgroundImage = `url("${item.image}")`; }
    else {
      icon.style.backgroundImage = '';
      icon.style.setProperty('--item-x', `${item.frame % 4 * 100 / 3}%`);
      icon.style.setProperty('--item-y', `${Math.floor(item.frame / 4) * 100}%`);
    }
  }

  function makeCard(item, side, count, staged, value) {
    const card = document.createElement('article'); card.className = 'trade-item';
    card.dataset.tradeItem = item.id; card.dataset.tradeSide = side; card.draggable = count > staged;
    const icon = document.createElement('span'); iconFor(item, icon);
    const select = document.createElement('button'); select.type = 'button'; select.className = 'trade-select';
    const name = document.createElement('strong'); name.textContent = item.name;
    const amount = document.createElement('small');
    amount.textContent = side === 'buy' ? `Осталось: ${count} · ${value} ◈` : `${value} ◈ за штуку · у тебя ${count}`;
    select.append(name, amount); select.disabled = count <= staged;
    select.setAttribute('aria-label', `${item.name}, ${side === 'buy' ? `в наличии ${count - staged}, цена ${value} монет` : `в рюкзаке ${count - staged}, продать за ${value} монет`}`);
    const adjust = document.createElement('button'); adjust.type = 'button'; adjust.className = 'trade-adjust';
    adjust.textContent = '−'; adjust.hidden = !staged; adjust.setAttribute('aria-label', `Убрать одну штуку: ${item.name}`);
    adjust.addEventListener('click', () => stage(side, item.id, -1));
    card.append(icon, select, adjust);
    card.addEventListener('dragstart', event => {
      if (count <= staged) { event.preventDefault(); return; }
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('application/x-cq-trade', JSON.stringify({ side, itemId: item.id }));
      card.classList.add('is-dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('is-dragging'));
    select.addEventListener('click', () => stage(side, item.id));
    return card;
  }

  function renderPane(pane, area, side, merchant) {
    const state = getState();
    const items = side === 'buy'
      ? merchant.offers.map(offer => ({ item: itemInfo(offer.itemId), count: merchantStock(state, merchant.id, offer.itemId), value: offer.price }))
      : INVENTORY_ITEMS.filter(item => Number(state.items?.[item.id]) > 0).map(item => ({ item, count: Number(state.items[item.id]), value: MERCHANT_BUYBACK_VALUES[item.id] ?? 0 }));
    area.replaceChildren(...items.filter(entry => entry.item).map(({ item, count, value }) =>
      makeCard(item, side, count, (side === 'buy' ? buys : sells).get(item.id) ?? 0, value)));
    pane.classList.toggle('is-drop-target', false);
    area.classList.toggle('trade-items-empty', items.length === 0);
    if (!items.length) {
      const empty = document.createElement('p'); empty.className = 'trade-empty';
      empty.textContent = side === 'sell' ? 'Рюкзак пока пуст.' : 'У торговца всё распродано.'; area.append(empty);
    }
  }

  function render() {
    if (!actor) return;
    const merchant = merchantDefinition(actor.merchantId), state = getState();
    root.querySelector('#shop-name').textContent = merchant.name;
    root.querySelector('#shop-title').textContent = merchant.title;
    root.querySelector('#shop-coins').textContent = normalizeCoins(state.coins).toLocaleString('ru-RU');
    renderPane(playerPane, playerArea, 'sell', merchant);
    renderPane(merchantPane, merchantArea, 'buy', merchant);
    const sellTotal = [...sells].reduce((sum, [id, quantity]) => sum + (MERCHANT_BUYBACK_VALUES[id] ?? 0) * quantity, 0);
    const buyTotal = [...buys].reduce((sum, [id, quantity]) => sum + (merchant.offers.find(offer => offer.itemId === id)?.price ?? 0) * quantity, 0);
    const nextBalance = normalizeCoins(state.coins) + sellTotal - buyTotal;
    const describe = (lines, side) => lines.length ? lines.map(([id, count]) => `${itemInfo(id)?.name ?? id} × ${count} (${valueOf(side, id, merchant) * count} ◈)`).join(' · ') : 'Ничего';
    root.querySelector('#trade-sell-total').textContent = describe([...sells], 'sell');
    root.querySelector('#trade-buy-total').textContent = describe([...buys], 'buy');
    const balance = root.querySelector('#trade-balance');
    balance.textContent = `${nextBalance.toLocaleString('ru-RU')} ◈`;
    balance.classList.toggle('is-negative', nextBalance < 0);
    confirm.disabled = buys.size + sells.size === 0 || nextBalance < 0;
    confirm.textContent = nextBalance < 0 ? `Не хватает ${Math.abs(nextBalance)} ◈` : 'Совершить обмен';
    confirm.title = nextBalance < 0 ? 'Продай ещё предметов или убери часть покупок' : 'Подтвердить обмен';
  }

  for (const [pane, side] of [[playerPane, 'player'], [merchantPane, 'merchant']]) {
    pane.addEventListener('dragover', event => {
      if (event.dataTransfer.types.includes('application/x-cq-trade')) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; }
    });
    pane.addEventListener('dragenter', event => { if (event.dataTransfer.types.includes('application/x-cq-trade')) pane.classList.add('is-drop-target'); });
    pane.addEventListener('dragleave', event => { if (!pane.contains(event.relatedTarget)) pane.classList.remove('is-drop-target'); });
    pane.addEventListener('drop', event => {
      event.preventDefault(); pane.classList.remove('is-drop-target');
      try {
        const payload = JSON.parse(event.dataTransfer.getData('application/x-cq-trade'));
        if ((payload.side === 'sell' && side === 'merchant') || (payload.side === 'buy' && side === 'player')) stage(payload.side, payload.itemId);
      } catch { /* Ignore malformed external drag data. */ }
    });
  }

  function hide() {
    if (root.hidden) return;
    buys.clear(); sells.clear(); void hideUIWindow(root); actor = null;
    (previousFocus?.isConnected ? previousFocus : null)?.focus({ preventScroll: true });
  }
  function finish() {
    if (!actor) return;
    const result = onTrade(actor, { buys: asLines(buys), sells: asLines(sells) });
    if (!result.completed) { notice.textContent = result.error; return; }
    onCommit?.(result); hide();
  }

  close.addEventListener('click', hide); cancel.addEventListener('click', hide); confirm.addEventListener('click', finish);
  root.addEventListener('click', event => { if (event.target === root) hide(); });
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); hide(); }
    if (event.key === 'Tab') {
      const buttons = [...root.querySelectorAll('button:not([disabled])')], first = buttons[0], last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  return { render, hide, isOpen: () => !root.hidden,
    open(merchant) { buys.clear(); sells.clear(); previousFocus = document.activeElement; actor = merchant; onOpen?.(); void showUIWindow(root); notice.textContent = ''; render(); close.focus({ preventScroll: true }); } };
}
