const API = 'https://deckofcardsapi.com/api/deck';
const BACK = 'https://deckofcardsapi.com/static/img/back.png';
const $ = id => document.getElementById(id);

let deckId = null, bankroll = 1000, bet = 0, inRound = false;
let player = [], dealer = [], holeHidden = true;

async function api(path) {
  const r = await fetch(`${API}/${path}`);
  if (!r.ok) throw new Error('API error ' + r.status);
  return r.json();
}

async function shuffle() {
  const d = await api(deckId ? `${deckId}/shuffle/` : 'new/shuffle/?deck_count=6');
  deckId = d.deck_id;
}

async function draw(n) {
  let d = await api(`${deckId}/draw/?count=${n}`);
  if (!d.success || d.cards.length < n) { await shuffle(); d = await api(`${deckId}/draw/?count=${n}`); }
  return d.cards;
}

function value(hand) {
  let total = 0, aces = 0;
  for (const c of hand) {
    if (c.value === 'ACE') { aces++; total += 11; }
    else if (['KING', 'QUEEN', 'JACK'].includes(c.value)) total += 10;
    else total += parseInt(c.value, 10);
  }
  while (total > 21 && aces--) total -= 10;
  return total;
}

function render() {
  $('bankroll').textContent = bankroll;
  $('bet').textContent = bet;
  const show = (el, hand, hide) => {
    el.innerHTML = '';
    hand.forEach((c, i) => {
      const img = document.createElement('img');
      img.src = hide && i === 1 ? BACK : c.image;
      img.alt = hide && i === 1 ? 'Hidden card' : `${c.value} of ${c.suit}`;
      el.appendChild(img);
    });
  };
  show($('dealer-hand'), dealer, holeHidden);
  show($('player-hand'), player, false);
  $('player-score').textContent = player.length ? value(player) : '';
  $('dealer-score').textContent = dealer.length ? (holeHidden ? value([dealer[0]]) : value(dealer)) : '';
  $('bet-panel').classList.toggle('hidden', inRound);
  $('play-panel').classList.toggle('hidden', !inRound);
  $('deal').disabled = bet <= 0;
  $('double').disabled = !(inRound && player.length === 2 && bankroll >= bet);
  document.querySelectorAll('.chip').forEach(b => b.disabled = +b.dataset.v > bankroll - bet);
}

function msg(t) { $('message').textContent = t; }

async function deal() {
  if (bet <= 0 || inRound) return;
  $('deal').disabled = true;
  msg('Dealing…');
  try {
    if (!deckId) await shuffle();
    const cards = await draw(4);
    player = [cards[0], cards[2]];
    dealer = [cards[1], cards[3]];
  } catch (e) { msg('Could not reach the card API. Try again.'); render(); return; }
  bankroll -= bet; holeHidden = true; inRound = true;
  msg('Hit, stand, or double?');
  render();
  if (value(player) === 21) await finish();
}

async function hit() {
  try { player.push((await draw(1))[0]); } catch { msg('API error. Try again.'); return; }
  render();
  if (value(player) >= 21) await finish();
}

async function doubleDown() {
  bankroll -= bet; bet *= 2;
  try { player.push((await draw(1))[0]); } catch { bankroll += bet / 2; bet /= 2; msg('API error.'); return; }
  render();
  await finish();
}

async function finish() {
  holeHidden = false;
  const p = value(player);
  const natural = p === 21 && player.length === 2;
  if (p <= 21 && !natural) {
    try { while (value(dealer) < 17) dealer.push((await draw(1))[0]); }
    catch { msg('API error while dealer drew.'); }
  }
  const d = value(dealer), dNat = d === 21 && dealer.length === 2;
  let result, payout = 0;
  if (p > 21) result = 'Bust! You lose.';
  else if (natural && !dNat) { result = 'Blackjack! Pays 3:2.'; payout = bet * 2.5; }
  else if (dNat && !natural) result = 'Dealer blackjack. You lose.';
  else if (d > 21) { result = 'Dealer busts. You win!'; payout = bet * 2; }
  else if (p > d) { result = 'You win!'; payout = bet * 2; }
  else if (p === d) { result = 'Push.'; payout = bet; }
  else result = 'Dealer wins.';
  bankroll += payout;
  inRound = false;
  const lastBet = bet;
  bet = Math.min(lastBet, bankroll);
  if (bankroll <= 0) { result += ' Out of chips — bankroll reset to $1000.'; bankroll = 1000; bet = 0; }
  msg(result);
  render();
}

document.querySelectorAll('.chip').forEach(b => b.onclick = () => {
  if (bet + +b.dataset.v <= bankroll) { bet += +b.dataset.v; render(); }
});
$('clear').onclick = () => { bet = 0; render(); };
$('deal').onclick = deal;
$('hit').onclick = hit;
$('stand').onclick = finish;
$('double').onclick = doubleDown;
render();
