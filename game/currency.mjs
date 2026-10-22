export const MAX_COINS = 999999999;
export const MAX_COIN_DROP = 999999;
export const COIN_SKINS = Object.freeze([
  { id: 'coin-single', frame: 0, amount: 3, label: 'Монеты' },
  { id: 'coin-stack', frame: 1, amount: 12, label: 'Стопка монет' },
  { id: 'coin-hoard', frame: 2, amount: 35, label: 'Россыпь монет' },
].map(Object.freeze));
export const normalizeCoins = value => Number.isFinite(value) ? Math.max(0, Math.min(MAX_COINS, Math.trunc(value))) : 0;
export const validCoinDrop = amount => Number.isInteger(amount) && amount > 0 && amount <= MAX_COIN_DROP;
export const coinSkin = amount => COIN_SKINS[amount >= 25 ? 2 : amount >= 6 ? 1 : 0];
export function creditCoins(state, amount) {
  if (!validCoinDrop(amount)) return 0;
  const previous = normalizeCoins(state.coins);
  state.coins = Math.min(MAX_COINS, previous + amount);
  return state.coins - previous;
}
export function rollCoins(kind, random = Math.random) {
  const [min, max] = kind === 'chest' ? [12, 35] : kind === 'boss' ? [25, 45] : kind === 'boar' ? [4, 11] : [2, 7];
  const value = Math.max(0, Math.min(.999999, Number(random()) || 0));
  return min + Math.floor(value * (max - min + 1));
}
