/* Pure analytics over recorded hands/decisions. No DOM, no network. */
(function (root) {
  const isWin = (h) => h.result === 'win' || h.result === 'blackjack';
  const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
  const avg = (a, f) => (a.length ? sum(a, f) / a.length : null);
  const UP_LABEL = (v) => (v === 11 ? 'A' : String(v));

  function summarize(hs) {
    const n = hs.length, wins = hs.filter(isWin).length, losses = hs.filter((h) => h.result === 'lose').length;
    const net = sum(hs, (h) => h.net), wagered = sum(hs, (h) => h.total_wagered);
    return {
      n, wins, losses, pushes: n - wins - losses, net, wagered,
      winRate: n ? wins / n : null, roi: wagered ? net / wagered : null,
      evPerHand: n ? net / n : null, avgBet: avg(hs, (h) => h.bet),
    };
  }

  function groupBy(items, keyFn) {
    const m = new Map();
    for (const x of items) { const k = keyFn(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }
    return m;
  }

  function streaks(hands) { // pushes neither extend nor break a streak
    let curW = 0, curL = 0, maxW = 0, maxL = 0;
    for (const h of hands) {
      if (isWin(h)) { curW++; curL = 0; } else if (h.result === 'lose') { curL++; curW = 0; }
      maxW = Math.max(maxW, curW); maxL = Math.max(maxL, curL);
    }
    return { maxWin: maxW, maxLoss: maxL, current: curW ? { type: 'win', n: curW } : curL ? { type: 'loss', n: curL } : null };
  }

  function maxDrawdown(hands) {
    let peak = -Infinity, dd = 0;
    for (const h of hands) { peak = Math.max(peak, h.bankroll_after); dd = Math.max(dd, peak - h.bankroll_after); }
    return dd;
  }

  function kpis(hands, actions) {
    const s = summarize(hands);
    const acts = actions || [];
    const dbl = hands.filter((h) => h.doubled);
    return {
      ...s,
      blackjacks: hands.filter((h) => h.player_blackjack).length,
      bustRate: hands.length ? hands.filter((h) => h.busted).length / hands.length : null,
      dealerBustRate: hands.length ? hands.filter((h) => h.dealer_busted).length / hands.length : null,
      doubles: dbl.length, doubleWinRate: dbl.length ? dbl.filter(isWin).length / dbl.length : null,
      decisions: acts.length,
      adherence: acts.length ? acts.filter((a) => a.followed_basic).length / acts.length : null,
      avgDecisionMs: avg(acts.filter((a) => a.decision_ms != null), (a) => a.decision_ms),
      maxDrawdown: maxDrawdown(hands), ...streaks(hands),
    };
  }

  function byStrategy(hands, actions) {
    const handStrat = new Map(hands.map((h) => [h.id, h.strategy]));
    const actsBy = groupBy(actions, (a) => handStrat.get(a.hand_id));
    return [...groupBy(hands, (h) => h.strategy)].map(([strategy, hs]) => {
      const as = actsBy.get(strategy) || [];
      return { strategy, ...summarize(hs), adherence: as.length ? as.filter((a) => a.followed_basic).length / as.length : null };
    }).sort((a, b) => b.n - a.n);
  }

  function byUpcard(hands) {
    const m = groupBy(hands, (h) => h.dealer_upcard_value);
    const out = [];
    for (let v = 2; v <= 11; v++) out.push({ label: UP_LABEL(v), ...summarize(m.get(v) || []) });
    return out;
  }

  const START_ORDER = ['Hard ≤8', 'Hard 9', 'Hard 10', 'Hard 11', 'Hard 12', 'Hard 13', 'Hard 14', 'Hard 15', 'Hard 16', 'Hard 17+', 'Soft ≤17', 'Soft 18', 'Soft 19+', 'Blackjack'];
  function startLabel(h) {
    const t = h.initial_total;
    if (t === 21 && h.initial_cards.length === 2) return 'Blackjack';
    if (h.initial_soft) return t <= 17 ? 'Soft ≤17' : t === 18 ? 'Soft 18' : 'Soft 19+';
    return t <= 8 ? 'Hard ≤8' : t >= 17 ? 'Hard 17+' : 'Hard ' + t;
  }
  function byStart(hands) {
    const m = groupBy(hands, startLabel);
    return START_ORDER.map((label) => ({ label, ...summarize(m.get(label) || []) }));
  }

  function trueCount(h) {
    if (h.running_count_start == null || h.decks_remaining == null) return null;
    return h.running_count_start / Math.max(Number(h.decks_remaining), 0.5);
  }
  function byCount(hands) {
    const bucket = (h) => { const tc = trueCount(h); return tc == null ? null : tc <= -2 ? 'Cold (TC ≤ −2)' : tc >= 2 ? 'Hot (TC ≥ +2)' : 'Neutral (−2 to +2)'; };
    const m = groupBy(hands.filter((h) => bucket(h)), bucket);
    return ['Cold (TC ≤ −2)', 'Neutral (−2 to +2)', 'Hot (TC ≥ +2)'].map((label) => ({ label, ...summarize(m.get(label) || []) }));
  }

  function byAction(hands, actions) {
    const hm = new Map(hands.map((h) => [h.id, h]));
    return ['hit', 'stand', 'double'].map((action) => {
      const as = actions.filter((a) => a.action === action && hm.has(a.hand_id));
      const hs = as.map((a) => hm.get(a.hand_id));
      return { action, count: as.length, winRate: hs.length ? hs.filter(isWin).length / hs.length : null,
        evPerHand: avg(hs, (h) => h.net), followed: as.length ? as.filter((a) => a.followed_basic).length / as.length : null,
        avgMs: avg(as.filter((a) => a.decision_ms != null), (a) => a.decision_ms) };
    });
  }

  function deviations(hands, actions) {
    const hm = new Map(hands.map((h) => [h.id, h]));
    const bad = actions.filter((a) => !a.followed_basic && hm.has(a.hand_id));
    const m = groupBy(bad, (a) => `${a.soft_before ? 'Soft' : 'Hard'} ${a.total_before} vs ${UP_LABEL(a.dealer_upcard_value)}|${a.action}|${a.basic_action}`);
    return [...m].map(([k, as]) => {
      const [situation, did, should] = k.split('|');
      return { situation, did, should, n: as.length, evPerHand: avg(as, (a) => hm.get(a.hand_id).net) };
    }).sort((a, b) => b.n - a.n);
  }

  function tilt(hands) { // bet size after a win vs after a loss, within a session
    const afterWin = [], afterLoss = [];
    for (let i = 1; i < hands.length; i++) {
      const p = hands[i - 1], h = hands[i];
      if (p.session_id !== h.session_id) continue;
      if (isWin(p)) afterWin.push(h.bet); else if (p.result === 'lose') afterLoss.push(h.bet);
    }
    const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
    return { afterWin: mean(afterWin), nWin: afterWin.length, afterLoss: mean(afterLoss), nLoss: afterLoss.length };
  }

  const money = (v) => (Math.round(v) === 0 ? '$0' : (v < 0 ? '−$' : '+$') + Math.abs(Math.round(v)).toLocaleString());
  const pct = (v) => (v == null ? '—' : (v * 100).toFixed(1) + '%');

  // Plain-English observations. Every claim is guarded by a minimum sample size.
  function insights(hands, actions) {
    const out = [];
    const n = hands.length;
    if (n === 0) return out;
    if (n < 100) out.push({ kind: 'caution', text: `Only ${n} hand${n === 1 ? '' : 's'} recorded. Blackjack results are very noisy — treat everything below as anecdotal until you have several hundred hands per strategy.` });

    const k = kpis(hands, actions);
    if (k.adherence != null && k.decisions >= 30) out.push({ kind: 'info', text: `You matched basic strategy on ${pct(k.adherence)} of ${k.decisions} decisions.` });

    const withDev = hands.filter((h) => h.deviations > 0), noDev = hands.filter((h) => h.deviations === 0 && h.decisions > 0);
    if (withDev.length >= 20 && noDev.length >= 20)
      out.push({ kind: 'info', text: `Hands where you deviated from basic strategy averaged ${money(avg(withDev, (h) => h.net))} per hand (n=${withDev.length}) versus ${money(avg(noDev, (h) => h.net))} when you followed it (n=${noDev.length}).` });

    const ups = byUpcard(hands).filter((r) => r.n >= 20).sort((a, b) => a.evPerHand - b.evPerHand);
    if (ups.length >= 3) out.push({ kind: 'info', text: `Weakest dealer upcard: ${ups[0].label} (${money(ups[0].evPerHand)}/hand over ${ups[0].n} hands). Strongest: ${ups[ups.length - 1].label} (${money(ups[ups.length - 1].evPerHand)}/hand over ${ups[ups.length - 1].n}).` });

    const t = tilt(hands);
    if (t.nWin >= 20 && t.nLoss >= 20 && t.afterWin > 0) {
      const d = t.afterLoss / t.afterWin - 1;
      if (Math.abs(d) >= 0.15) out.push({ kind: 'pattern', text: `You bet ${Math.abs(d * 100).toFixed(0)}% ${d > 0 ? 'more' : 'less'} right after a loss than right after a win (${t.nLoss} vs ${t.nWin} hands)${d > 0 ? ' — a chasing-losses pattern worth watching' : ''}.` });
    }

    const c = byCount(hands), cold = c[0], hot = c[2];
    if (cold.n >= 20 && hot.n >= 20 && cold.avgBet > 0) {
      const r = hot.avgBet / cold.avgBet;
      out.push({ kind: 'pattern', text: r >= 1.5 ? `You bet ${r.toFixed(1)}× more at high counts than low counts — your bet spread follows the count.` : `Your average bet barely changes with the count (${r.toFixed(2)}× hot vs cold), so counting isn't yet shaping your bets.` });
    }

    if (k.doubles >= 10) out.push({ kind: 'info', text: `You won ${pct(k.doubleWinRate)} of ${k.doubles} doubled hands.` });

    const strats = byStrategy(hands, actions).filter((s) => s.n >= 30);
    if (strats.length >= 2) {
      const best = [...strats].sort((a, b) => b.roi - a.roi)[0], worst = [...strats].sort((a, b) => a.roi - b.roi)[0];
      out.push({ kind: 'info', text: `Strategy comparison: "${best.strategy}" has the best ROI (${pct(best.roi)}, ${best.n} hands) and "${worst.strategy}" the lowest (${pct(worst.roi)}, ${worst.n} hands). Differences this small are usually within noise.` });
    }
    return out;
  }

  function csvCell(v) {
    if (v == null) return '';
    let s = Array.isArray(v) ? v.join(';') : String(v);
    if (/^[=+\-@\t\r]/.test(s) && isNaN(Number(s))) s = "'" + s; // neutralise spreadsheet formulas
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function toCSV(rows, columns) {
    return [columns.join(','), ...rows.map((r) => columns.map((c) => csvCell(r[c])).join(','))].join('\n');
  }

  const api = { isWin, summarize, kpis, streaks, maxDrawdown, byStrategy, byUpcard, byStart, byCount, byAction, deviations, tilt, trueCount, insights, toCSV, money, pct, START_ORDER };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Analytics = api;
})(typeof window !== 'undefined' ? window : globalThis);
