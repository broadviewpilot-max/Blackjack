(function () {
  const START_BANK = 1000, MIN_BET = 5, RESHUFFLE_AT = 78; // reshuffle when < 1.5 decks remain
  const STORE = 'bj_bankroll_v1';
  const $ = (id) => document.getElementById(id);

  const shoe = new Shoe();
  let bank = START_BANK, bet = 0, lastBet = 25;
  let player = [], dealer = [], phase = 'betting', busy = false;

  try { const s = parseInt(localStorage.getItem(STORE), 10); if (s > 0) bank = s; } catch (e) {}
  const save = () => { try { localStorage.setItem(STORE, bank); } catch (e) {} };

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
    const dEl = $('dealer-cards'), pEl = $('player-cards');
    dEl.replaceChildren(...dealer.map((c, i) => cardEl(c, hideHole && i === 1)));
    pEl.replaceChildren(...player.map((c) => cardEl(c, false)));
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
      bank -= bet; lastBet = bet; save();
      const cards = await shoe.draw(4);
      player = [cards[0], cards[2]]; dealer = [cards[1], cards[3]];
      setPhase('playing'); render(true); message('');
      if (BJ.isBlackjack(player) || BJ.isBlackjack(dealer)) return finish();
    } catch (e) {
      bank += bet; save(); message('Could not deal. Please try again.', 'lose'); setPhase('betting');
    } finally { busy = false; updateControls(); }
  }

  async function hit() {
    busy = true; updateControls();
    player.push(...(await shoe.draw(1)));
    render(true);
    if (BJ.isBust(player) || BJ.handTotal(player).total === 21) await finish(); else { busy = false; updateControls(); }
  }

  async function double() {
    busy = true; updateControls();
    bank -= bet; bet *= 2; save();
    player.push(...(await shoe.draw(1)));
    render(true);
    await finish();
  }

  async function finish() {
    busy = true; updateControls();
    render(false);
    if (!BJ.isBust(player) && !BJ.isBlackjack(player) && !BJ.isBlackjack(dealer)) {
      while (BJ.dealerShouldHit(dealer)) {
        await new Promise((r) => setTimeout(r, 600));
        dealer.push(...(await shoe.draw(1)));
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
  }

  function again() {
    player = []; dealer = []; bet = Math.min(lastBet, bank);
    setPhase('betting'); message('Place your bet'); render(false); updateControls();
  }

  document.querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => addBet(+b.dataset.v)));
  $('clear').onclick = () => { bet = 0; render(false); updateControls(); };
  $('deal').onclick = deal; $('hit').onclick = hit; $('stand').onclick = finish; $('double').onclick = double;
  $('next').onclick = again;
  $('rebuy').onclick = () => { bank = START_BANK; save(); bet = 0; render(false); updateControls(); };
  document.addEventListener('keydown', (e) => {
    if (busy || e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (phase === 'playing') { if (k === 'h') hit(); else if (k === 's') finish(); else if (k === 'd' && !$('double').disabled) double(); }
    else if (k === 'enter') { if (phase === 'betting' && !$('deal').disabled) deal(); else if (phase === 'done') again(); }
  });

  setPhase('betting'); message('Place your bet'); render(false); updateControls();
})();
