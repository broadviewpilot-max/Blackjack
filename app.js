(function () {
  const START_BANK = 1000, MIN_BET = 5, RESHUFFLE_AT = 78; // reshuffle when < 1.5 decks remain
  const STORE = 'bj_bankroll_v1', STRAT_STORE = 'bj_strategy_v1';
  const $ = (id) => document.getElementById(id);

  const shoe = new Shoe();
  let bank = START_BANK, bet = 0, lastBet = 25;
  let player = [], dealer = [], phase = 'betting', busy = false;
  let count = 0, countGen = -1; // Hi-Lo running count over cards seen in the current shoe
  let hand = null;              // telemetry for the hand in progress

  try { const s = parseInt(localStorage.getItem(STORE), 10); if (s > 0) bank = s; } catch (e) {}
  const save = () => { try { localStorage.setItem(STORE, bank); } catch (e) {} };

  const strategyInput = $('strategy');
  try { strategyInput.value = localStorage.getItem(STRAT_STORE) || 'Manual'; } catch (e) { strategyInput.value = 'Manual'; }
  const strategy = () => strategyInput.value.trim().slice(0, 40) || 'Manual';
  strategyInput.addEventListener('change', () => { try { localStorage.setItem(STRAT_STORE, strategy()); } catch (e) {} });

  window.addEventListener('tracker:status', (e) => {
    const s = $('save-status'); s.textContent = e.detail.text; s.className = 'small ' + (e.detail.ok ? '' : 'lose');
  });

  const codes = (cs) => cs.map((c) => c.code);

  function cardEl(card, faceDown) {
    const d = document.createElement('div');
    d.className = 'card' + (faceDown ? ' down' : '');
    const img = document.createElement('img');
    img.alt = faceDown ? 'Face-down card' : `${card.value} of ${card.suit}`;
    img.src = faceDown ? DECK_BACK : card.image;
    img.onerror = () => { // image host unreachable: draw a text card
      d.classList.add('text');
      d.textContent = faceDown ? '?' : card.code.replace('0', '10');
      img.remove();
    };
    d.appendChild(img);
    return d;
  }

  function render(hideHole) {
    $('dealer-cards').replaceChildren(...dealer.map((c, i) => cardEl(c, hideHole && i === 1)));
    $('player-cards').replaceChildren(...player.map((c) => cardEl(c, false)));
    $('dealer-total').textContent = dealer.length ? (hideHole ? BJ.handTotal([dealer[0]]).total : label(dealer)) : '';
    $('player-total').textContent = player.length ? label(player) : '';
    $('bank').textContent = bank.toLocaleString();
    $('bet').textContent = bet.toLocaleString();
    $('shoe').textContent = `${shoe.remaining} cards · ${shoe.source === 'api' ? 'Deck of Cards API' : 'local fallback'}`;
  }

  function label(cards) {
    const t = BJ.handTotal(cards);
    return t.total > 21 ? `${t.total} (bust)` : (t.soft && t.total < 21 ? `${t.total - 10}/${t.total}` : t.total);
  }

  function setPhase(p) {
    phase = p;
    $('betting').hidden = p !== 'betting';
    $('actions').hidden = p !== 'playing';
    $('again').hidden = p !== 'done';
    strategyInput.disabled = p === 'playing';
  }

  function message(text, cls) { const m = $('message'); m.textContent = text; m.className = cls || ''; }

  function updateControls() {
    const isPlay = phase === 'playing';
    $('hit').disabled = busy || !isPlay;
    $('stand').disabled = busy || !isPlay;
    $('double').disabled = busy || !isPlay || player.length !== 2 || bank < bet;
    $('deal').disabled = busy || bet < MIN_BET;
    document.querySelectorAll('.chip').forEach((b) => { b.disabled = busy || +b.dataset.v > bank - bet; });
    $('clear').disabled = busy || bet === 0;
    $('rebuy').hidden = !(bank < MIN_BET && phase !== 'playing' && bet === 0);
  }

  function addBet(v) { if (phase === 'betting' && v <= bank - bet) { bet += v; render(false); updateControls(); } }

  async function deal() {
    if (bet < MIN_BET || bet > bank) return;
    busy = true; updateControls(); message('Dealing…');
    try {
      if (!shoe.deckId && !shoe.local) await shoe.shuffle();
      else if (shoe.remaining < RESHUFFLE_AT) { message('Shuffling new shoe…'); await shoe.shuffle(); }
      if (countGen !== shoe.gen) { count = 0; countGen = shoe.gen; } // fresh shoe => count resets
      hand = { strategy: strategy(), bankBefore: bank, bet, startCount: count, decksRemaining: shoe.remaining / 52, actions: [], promptAt: 0 };
      bank -= bet; save();
      lastBet = bet;
      const cards = await shoe.draw(4);
      player = [cards[0], cards[2]]; dealer = [cards[1], cards[3]];
      hand.initial = codes(player); hand.shoeSource = shoe.source;
      const t = BJ.handTotal(player); hand.initialTotal = t.total; hand.initialSoft = t.soft;
      // Visible cards only: both player cards and the dealer upcard (hole card counted on reveal).
      count += BJ.hiLo(player[0]) + BJ.hiLo(player[1]) + BJ.hiLo(dealer[0]);
      setPhase('playing'); render(true); message('');
      hand.promptAt = performance.now();
      if (BJ.isBlackjack(player) || BJ.isBlackjack(dealer)) return finish();
    } catch (e) {
      console.error(e);
      if (hand) bank = hand.bankBefore; save(); hand = null;
      message('Could not deal. Please try again.', 'lose'); setPhase('betting');
    } finally { busy = false; updateControls(); }
  }

  // One player decision: records what was on the table, what was chosen, and what basic strategy says.
  async function act(action) {
    busy = true; updateControls();
    const ms = Math.round(performance.now() - hand.promptAt);
    const before = player.slice(), t = BJ.handTotal(before), up = BJ.cardValue(dealer[0]);
    const basic = BJ.basicStrategy(before, up, before.length === 2 && bank >= bet);
    const countNow = count;
    let received = null;
    if (action === 'double') { bank -= bet; bet *= 2; save(); }
    if (action !== 'stand') {
      received = (await shoe.draw(1))[0]; player.push(received); count += BJ.hiLo(received);
    }
    hand.actions.push({
      action, cards_before: codes(before), total_before: t.total, soft_before: t.soft,
      dealer_upcard: dealer[0].code, dealer_upcard_value: up,
      card_received: received ? received.code : null, total_after: BJ.handTotal(player).total,
      basic_action: basic, followed_basic: basic === action, decision_ms: ms, running_count: countNow,
    });
    render(true);
    if (action === 'hit' && !BJ.isBust(player) && BJ.handTotal(player).total < 21) {
      hand.promptAt = performance.now(); busy = false; updateControls();
    } else await finish();
  }

  async function finish() {
    busy = true; updateControls();
    count += BJ.hiLo(dealer[1]); // hole card is revealed
    render(false);
    if (!BJ.isBust(player) && !BJ.isBlackjack(player) && !BJ.isBlackjack(dealer)) {
      while (BJ.dealerShouldHit(dealer)) {
        await new Promise((r) => setTimeout(r, 600));
        const c = (await shoe.draw(1))[0]; dealer.push(c); count += BJ.hiLo(c);
        render(false);
      }
    }
    const { result, payout } = BJ.settle(player, dealer, bet);
    bank += payout; save();
    const net = payout - bet;
    const texts = {
      blackjack: [`Blackjack! +${net}`, 'win'], win: [`You win +${net}`, 'win'],
      push: ['Push — bet returned', 'push'],
      lose: [BJ.isBust(player) ? 'Bust — you lose' : 'Dealer wins', 'lose'],
    };
    message(...texts[result]);
    setPhase('done'); busy = false; render(false); updateControls();

    window.Tracker.record({
      strategy: hand.strategy, bankrollBefore: hand.bankBefore, actions: hand.actions,
      hand: {
        bet: hand.bet, total_wagered: bet, doubled: hand.actions.some((a) => a.action === 'double'),
        initial_cards: hand.initial, player_cards: codes(player), dealer_cards: codes(dealer),
        dealer_upcard: dealer[0].code, dealer_upcard_value: BJ.cardValue(dealer[0]),
        initial_total: hand.initialTotal, initial_soft: hand.initialSoft,
        player_total: BJ.handTotal(player).total, dealer_total: BJ.handTotal(dealer).total,
        player_blackjack: BJ.isBlackjack(player), dealer_blackjack: BJ.isBlackjack(dealer),
        busted: BJ.isBust(player), dealer_busted: BJ.isBust(dealer),
        result, payout, net, bankroll_before: hand.bankBefore, bankroll_after: bank,
        running_count_start: hand.startCount, decks_remaining: Math.round(hand.decksRemaining * 100) / 100,
        shoe_source: hand.shoeSource, decisions: hand.actions.length,
        deviations: hand.actions.filter((a) => !a.followed_basic).length,
      },
    });
    hand = null;
  }

  function again() {
    player = []; dealer = []; bet = Math.min(lastBet, bank);
    setPhase('betting'); message('Place your bet'); render(false); updateControls();
  }

  document.querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => addBet(+b.dataset.v)));
  $('clear').onclick = () => { bet = 0; render(false); updateControls(); };
  $('deal').onclick = deal; $('hit').onclick = () => act('hit'); $('stand').onclick = () => act('stand');
  $('double').onclick = () => act('double'); $('next').onclick = again;
  $('rebuy').onclick = () => { bank = START_BANK; save(); bet = 0; render(false); updateControls(); };
  document.addEventListener('keydown', (e) => {
    if (busy || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if ($('game').hidden) return;
    const k = e.key.toLowerCase();
    if (phase === 'playing') { if (k === 'h') act('hit'); else if (k === 's') act('stand'); else if (k === 'd' && !$('double').disabled) act('double'); }
    else if (k === 'enter') { if (phase === 'betting' && !$('deal').disabled) deal(); else if (phase === 'done') again(); }
  });

  setPhase('betting'); message('Place your bet'); render(false); updateControls();
})();
