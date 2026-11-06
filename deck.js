/* Deck of Cards API client (https://deckofcardsapi.com) with a local fallback shuffle. */
(function (root) {
  const BASE = 'https://deckofcardsapi.com/api/deck';
  const IMG = 'https://deckofcardsapi.com/static/img';
  const DECK_COUNT = 6;

  const VALUES = [['A', 'ACE'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5'], ['6', '6'], ['7', '7'],
    ['8', '8'], ['9', '9'], ['0', '10'], ['J', 'JACK'], ['Q', 'QUEEN'], ['K', 'KING']];
  const SUITS = [['S', 'SPADES'], ['D', 'DIAMONDS'], ['C', 'CLUBS'], ['H', 'HEARTS']];

  async function getJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'API error');
    return data;
  }

  // Same shape as the API's card objects, so the rest of the app is agnostic.
  function localShoe(decks) {
    const cards = [];
    for (let d = 0; d < decks; d++)
      for (const [vc, vn] of VALUES)
        for (const [sc, sn] of SUITS)
          cards.push({ code: vc + sc, value: vn, suit: sn, image: `${IMG}/${vc}${sc}.png` });
    for (let i = cards.length - 1; i > 0; i--) {
      const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
  }

  class Shoe {
    constructor() { this.deckId = null; this.local = null; this.remaining = 0; this.source = 'api'; this.gen = 0; } // gen bumps whenever a fresh shoe starts

    async shuffle() {
      this.gen++;
      try {
        const d = await getJSON(`${BASE}/new/shuffle/?deck_count=${DECK_COUNT}`);
        this.deckId = d.deck_id; this.remaining = d.remaining; this.local = null; this.source = 'api';
      } catch (e) {
        console.warn('Deck API unavailable, using local shoe:', e);
        this.local = localShoe(DECK_COUNT); this.remaining = this.local.length; this.deckId = null; this.source = 'local';
      }
    }

    async draw(count = 1) {
      if (this.local) {
        const cards = this.local.splice(0, count);
        this.remaining = this.local.length;
        return cards;
      }
      try {
        const d = await getJSON(`${BASE}/${this.deckId}/draw/?count=${count}`);
        this.remaining = d.remaining;
        return d.cards;
      } catch (e) {
        // Mid-hand API failure: switch to a local shoe rather than strand the player.
        console.warn('Draw failed, switching to local shoe:', e);
        this.local = localShoe(DECK_COUNT); this.source = 'local'; this.deckId = null; this.gen++;
        return this.draw(count);
      }
    }
  }

  root.Shoe = Shoe;
  root.DECK_BACK = `${IMG}/back.png`;
})(window);
