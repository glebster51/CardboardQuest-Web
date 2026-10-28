import { inventoryEntries, INVENTORY_ITEMS } from './inventory-items.mjs?v=7c14a71de3a9af87';
import { MAX_COINS, normalizeCoins } from './currency.mjs?v=7c14a71de3a9af87';

const offer = (itemId, price, stock) => Object.freeze({ itemId, price, stock });
export const MERCHANTS = Object.freeze([
  { id: 'savva', name: 'Савва', title: 'Дорожная лавка', location: 'home', x: -3.4, z: 2.8,
    greeting: 'В дорогу лучше с запасом. Ягоды, сухари и кое-что покрепче.',
    offers: [offer('berries', 3, 8), offer('hardtack', 5, 6), offer('jerky', 8, 4), offer('bandage', 10, 4), offer('woodShield', 18, 1)] },
  { id: 'radomir', name: 'Радомир', title: 'Клинки и диковинки', location: 'cartographer', x: 2.5, z: 1.2,
    greeting: 'Крепкая картонка, верная рука — а остальное найдётся на полках.',
    offers: [offer('ironSword', 24, 1), offer('ironHelmet', 20, 1), offer('woodShield', 18, 1), offer('emberOrb', 40, 1), offer('stormOrb', 44, 1)] },
  { id: 'mila', name: 'Мила', title: 'Лесные припасы', location: 'herb-glen', x: 2.6, z: -1.8,
    greeting: 'Травы лечат раны, а лесной огонёк бережёт в пути.',
    offers: [offer('bandage', 9, 6), offer('berries', 2, 10), offer('jerky', 7, 4), offer('mossOrb', 38, 1)] },
].map(merchant => Object.freeze({ ...merchant, offers: Object.freeze(merchant.offers) })));
export const merchantDefinition = id => MERCHANTS.find(merchant => merchant.id === id) ?? null;
export const MERCHANT_RANGE = 3.2;
export const MERCHANT_BUYBACK_VALUES = Object.freeze({
  berries: 1, hardtack: 2, jerky: 3, bandage: 4, scrap: 1, nuts: 1, bladeShard: 2,
  ironSword: 12, ironHelmet: 10, woodShield: 9, emberOrb: 20, mossOrb: 19, stormOrb: 22,
});
export function normalizeMerchantPurchases(raw) {
  return Object.fromEntries(MERCHANTS.map(merchant => [merchant.id, Object.fromEntries(merchant.offers.map(item => {
    const value = raw?.[merchant.id]?.[item.itemId];
    return [item.itemId, Number.isFinite(value) ? Math.max(0, Math.min(item.stock, Math.trunc(value))) : 0];
  }))]));
}
export function merchantStock(state, merchantId, itemId) {
  const offer = merchantDefinition(merchantId)?.offers.find(item => item.itemId === itemId);
  if (!offer) return 0;
  const purchases = normalizeMerchantPurchases(state.merchantPurchases)[merchantId][itemId];
  const returned = Math.max(0, Math.min(offer?.stock ?? 0, Math.trunc(Number(state.merchantReturns?.[merchantId]?.[itemId]) || 0)));
  return offer ? Math.max(0, Math.min(offer.stock, offer.stock - purchases + returned)) : 0;
}
export function canReachMerchant(state, context) {
  return Boolean(context && context.enabled !== false && context.health > 0 && !context.inCombat
    && context.locationId === state.currentLocationId
    && [context.x, context.z, context.merchantX, context.merchantZ].every(Number.isFinite)
    && Math.hypot(context.x - context.merchantX, context.z - context.merchantZ) <= MERCHANT_RANGE);
}
/** Prices and stock come from the catalogue, never from the selected DOM card. All validation precedes mutation. */
export function buyMerchantItem(state, merchantId, itemId, context) {
  const result = executeMerchantTrade(state, merchantId, { buys: [{ itemId, quantity: 1 }], sells: [] }, context);
  return result.completed ? { bought: true, itemId, paid: result.paid, coins: result.coins } : { bought: false, error: result.error };
}

/** Applies the complete reviewed offer in one synchronous mutation, or leaves the save untouched. */
export function executeMerchantTrade(state, merchantId, proposal, context) {
  const merchant = merchantDefinition(merchantId);
  if (!merchant) return { completed: false, error: 'Торговец не найден' };
  if (context?.merchantId !== merchantId || !canReachMerchant(state, context))
    return { completed: false, error: 'Подойди к торговцу вне боя' };
  const parseLines = (lines, label) => {
    if (!Array.isArray(lines)) throw new Error(`Состав ${label} сделки неверный`);
    const aggregated = new Map();
    for (const line of lines) {
      if (!line || typeof line.itemId !== 'string' || !Number.isInteger(line.quantity) || line.quantity < 1)
        throw new Error(`Количество ${label} указано неверно`);
      aggregated.set(line.itemId, (aggregated.get(line.itemId) ?? 0) + line.quantity);
    }
    return aggregated;
  };
  let buys, sells;
  try { buys = parseLines(proposal?.buys, 'покупаемых товаров'); sells = parseLines(proposal?.sells, 'предлагаемых предметов'); }
  catch (error) { return { completed: false, error: error.message }; }
  if (!buys.size && !sells.size) return { completed: false, error: 'Добавь предметы в обмен' };
  let cost = 0, proceeds = 0;
  for (const [itemId, quantity] of buys) {
    const offer = merchant.offers.find(item => item.itemId === itemId);
    if (!offer || !INVENTORY_ITEMS.some(item => item.id === itemId)) return { completed: false, error: 'Товар не продаётся здесь' };
    if (quantity > merchantStock(state, merchantId, itemId)) return { completed: false, error: `${offerLabel(itemId)} больше нет в наличии` };
    if ((Number(state.items?.[itemId]) || 0) - (sells.get(itemId) ?? 0) + quantity > 99)
      return { completed: false, error: 'В рюкзак помещается не более 99 одинаковых предметов' };
    cost += offer.price * quantity;
  }
  for (const [itemId, quantity] of sells) {
    if (!INVENTORY_ITEMS.some(item => item.id === itemId) || !MERCHANT_BUYBACK_VALUES[itemId])
      return { completed: false, error: 'Этот предмет нельзя продать' };
    if (quantity > (Number(state.items?.[itemId]) || 0)) return { completed: false, error: 'Предлагаемого предмета уже нет в рюкзаке' };
    proceeds += MERCHANT_BUYBACK_VALUES[itemId] * quantity;
  }
  const net = cost - proceeds, coins = normalizeCoins(state.coins);
  if (net > coins) return { completed: false, error: `Не хватает ещё ${net - coins} монет` };
  if (net < 0 && coins - net > MAX_COINS) return { completed: false, error: 'В кошельке уже нет места для выручки' };

  state.items ??= {};
  for (const [itemId, quantity] of sells) state.items[itemId] -= quantity;
  for (const [itemId, quantity] of buys) state.items[itemId] = (Number(state.items[itemId]) || 0) + quantity;
  state.coins = coins - net;
  state.merchantPurchases = normalizeMerchantPurchases(state.merchantPurchases);
  for (const [itemId, quantity] of buys) state.merchantPurchases[merchantId][itemId] += quantity;
  state.merchantReturns ??= {};
  state.merchantReturns[merchantId] ??= {};
  for (const [itemId, quantity] of sells) if (merchant.offers.some(item => item.itemId === itemId))
    state.merchantReturns[merchantId][itemId] = Math.min(merchant.offers.find(item => item.itemId === itemId).stock,
      (Number(state.merchantReturns[merchantId][itemId]) || 0) + quantity);
  inventoryEntries(state);
  return { completed: true, cost, proceeds, paid: Math.max(0, net), earned: Math.max(0, -net), coins: state.coins,
    bought: Object.fromEntries(buys), sold: Object.fromEntries(sells) };
}

function offerLabel(itemId) { return INVENTORY_ITEMS.find(item => item.id === itemId)?.name ?? itemId; }
