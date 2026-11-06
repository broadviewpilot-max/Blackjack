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

  // Hi-Lo card counting value: 2-6 => +1, 7-9 => 0, 10/J/Q/K/A => -1.
  function hiLo(card) {
    const v = cardValue(card);
    return v >= 2 && v <= 6 ? 1 : v >= 7 && v <= 9 ? 0 : -1;
  }

  // Multi-deck, dealer-stands-on-17 basic strategy for the actions this game offers
  // (hit / stand / double; no split or insurance). Returns 'hit' | 'stand' | 'double'.
  // When doubling isn't allowed, "double" falls back to hit (or stand for soft 18).
  function basicStrategy(cards, up, canDouble) {
    const { total, soft } = handTotal(cards);
    let a; // 'H','S','D' (double, else hit), 'Ds' (double, else stand)
    if (soft && total >= 13) {
      if (total <= 14) a = up >= 5 && up <= 6 ? 'D' : 'H';
      else if (total <= 16) a = up >= 4 && up <= 6 ? 'D' : 'H';
      else if (total === 17) a = up >= 3 && up <= 6 ? 'D' : 'H';
      else if (total === 18) a = up >= 3 && up <= 6 ? 'Ds' : (up === 2 || up === 7 || up === 8) ? 'S' : 'H';
      else a = 'S';
    } else if (total >= 17) a = 'S';
    else if (total >= 13) a = up <= 6 ? 'S' : 'H';
    else if (total === 12) a = up >= 4 && up <= 6 ? 'S' : 'H';
    else if (total === 11) a = up <= 10 ? 'D' : 'H';
    else if (total === 10) a = up <= 9 ? 'D' : 'H';
    else if (total === 9) a = up >= 3 && up <= 6 ? 'D' : 'H';
    else a = 'H';
    if (a === 'D') return canDouble ? 'double' : 'hit';
    if (a === 'Ds') return canDouble ? 'double' : 'stand';
    return a === 'S' ? 'stand' : 'hit';
  }

  const api = { cardValue, handTotal, isBlackjack, isBust, dealerShouldHit, settle, hiLo, basicStrategy };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BJ = api;
})(typeof window !== 'undefined' ? window : globalThis);
