/* Pure blackjack rules. No DOM, no network. Works in browser (window.BJ) and Node. */
(function (root) {
  const RANK = { ACE: 11, KING: 10, QUEEN: 10, JACK: 10, A: 11, K: 10, Q: 10, J: 10, '0': 10 };

  function cardValue(card) {
    const v = String(card.value).toUpperCase();
    return v in RANK ? RANK[v] : parseInt(v, 10);
  }

  // Best total <= 21 when possible; soft = an ace is still counted as 11.
  function handTotal(cards) {
    let total = 0, aces = 0;
    for (const c of cards) {
      total += cardValue(c);
      if (cardValue(c) === 11) aces++;
    }
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return { total, soft: aces > 0 };
  }

  const isBlackjack = (cards) => cards.length === 2 && handTotal(cards).total === 21;
  const isBust = (cards) => handTotal(cards).total > 21;

  // Dealer stands on all 17s (including soft 17).
  const dealerShouldHit = (cards) => handTotal(cards).total < 17;

  // Returns { result, payout } where payout is the total returned to the bankroll
  // (stake included). Blackjack pays 3:2.
  function settle(player, dealer, bet) {
    const pBJ = isBlackjack(player), dBJ = isBlackjack(dealer);
    const p = handTotal(player).total, d = handTotal(dealer).total;
    if (p > 21) return { result: 'lose', payout: 0 };
    if (pBJ && dBJ) return { result: 'push', payout: bet };
    if (pBJ) return { result: 'blackjack', payout: bet + Math.floor(bet * 1.5) };
    if (dBJ) return { result: 'lose', payout: 0 };
    if (d > 21 || p > d) return { result: 'win', payout: bet * 2 };
    if (p === d) return { result: 'push', payout: bet };
    return { result: 'lose', payout: 0 };
  }

  const api = { cardValue, handTotal, isBlackjack, isBust, dealerShouldHit, settle };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BJ = api;
})(typeof window !== 'undefined' ? window : globalThis);
