/* Stats tab: loads the user's hands + decisions and renders KPIs, chart, and pattern tables. */
(function () {
  const A = window.Analytics;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let sb = null, user = null, allHands = [], allActions = [], stale = true, loading = false;

  const money = (v) => (v == null ? '—' : A.money(v));
  const pct = A.pct;
  const cls = (v) => (v > 0 ? 'pos' : v < 0 ? 'neg' : '');

  async function fetchAll(table, orders) {
    const rows = [];
    for (let page = 0; page < 40; page++) {
      let q = sb.from(table).select('*');
      for (const [col, asc] of orders) q = q.order(col, { ascending: asc });
      const { data, error } = await q.range(page * 1000, page * 1000 + 999);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 1000) break;
    }
    return rows;
  }

  async function load() {
    if (!sb || !user || loading) return;
    loading = true; $('stats-status').textContent = 'Loading your play history…';
    try {
      await (window.Tracker && window.Tracker.flush());
      [allHands, allActions] = await Promise.all([
        fetchAll('hands', [['played_at', true]]),
        fetchAll('hand_actions', [['hand_id', true], ['seq', true]]),
      ]);
      stale = false; fillFilter(); render();
    } catch (e) {
      console.error(e); $('stats-status').textContent = 'Could not load stats: ' + (e.message || e);
    } finally { loading = false; }
  }

  function fillFilter() {
    const sel = $('stats-filter'), cur = sel.value;
    const strategies = [...new Set(allHands.map((h) => h.strategy))].sort();
    sel.replaceChildren(new Option('All strategies', ''), ...strategies.map((s) => new Option(s, s)));
    sel.value = strategies.includes(cur) ? cur : '';
  }

  // Diverging scale: two hues + neutral midpoint (blue = gain, orange = loss), never red/green.
  function heat(roi, n) {
    if (n === 0 || roi == null) return '';
    const t = Math.max(-1, Math.min(1, roi / 0.5));
    const mid = [61, 72, 82], pos = [47, 111, 181], neg = [184, 90, 27];
    const end = t >= 0 ? pos : neg, k = Math.abs(t);
    const c = mid.map((m, i) => Math.round(m + (end[i] - m) * k));
    return `style="background:rgb(${c.join(',')});color:#fff"`;
  }

  function table(cols, rows, opts = {}) {
    if (!rows.length) return '<p class="small">No data yet.</p>';
    const head = cols.map((c) => `<th scope="col"${c.num ? ' class="num"' : ''}>${esc(c.h)}</th>`).join('');
    const body = rows.map((r) => `<tr>${cols.map((c, i) => {
      const v = c.v(r);
      const extra = c.cell ? c.cell(r) : '';
      return i === 0 ? `<th scope="row">${v}</th>` : `<td class="num ${c.cls ? c.cls(r) : ''}" ${extra}>${v}</td>`;
    }).join('')}</tr>`).join('');
    return `<div class="tablewrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  const sumCols = (first, firstKey) => [
    { h: first, v: (r) => esc(r[firstKey]) },
    { h: 'Hands', num: 1, v: (r) => r.n },
    { h: 'Win %', num: 1, v: (r) => pct(r.winRate) },
    { h: 'Net', num: 1, v: (r) => (r.n ? money(r.net) : '—'), cls: (r) => cls(r.net) },
    { h: 'ROI', num: 1, v: (r) => (r.n ? pct(r.roi) : '—'), cell: (r) => heat(r.roi, r.n) },
    { h: 'Avg bet', num: 1, v: (r) => (r.n ? '$' + r.avgBet.toFixed(0) : '—') },
  ];

  function tile(label, value, sub, c) {
    return `<div class="tile"><div class="tl">${esc(label)}</div><div class="tv ${c || ''}">${value}</div>${sub ? `<div class="ts">${sub}</div>` : ''}</div>`;
  }

  function render() {
    const f = $('stats-filter').value;
    const hands = f ? allHands.filter((h) => h.strategy === f) : allHands;
    const ids = new Set(hands.map((h) => h.id));
    const actions = allActions.filter((a) => ids.has(a.hand_id));
    $('stats-body').hidden = hands.length === 0;
    $('stats-status').textContent = hands.length ? `${hands.length.toLocaleString()} hands · ${actions.length.toLocaleString()} decisions` : 'No hands recorded yet — play a few hands on the Play tab and they will appear here.';
    if (!hands.length) return;

    const k = A.kpis(hands, actions);
    $('kpis').innerHTML = [
      tile('Hands played', k.n.toLocaleString(), `${k.wins}W · ${k.losses}L · ${k.pushes}P`),
      tile('Win rate', pct(k.winRate), 'pushes count as not-won'),
      tile('Net result', money(k.net), `${money(k.evPerHand)} per hand`, cls(k.net)),
      tile('ROI', pct(k.roi), `on $${k.wagered.toLocaleString()} wagered`, cls(k.roi)),
      tile('Basic-strategy match', pct(k.adherence), `${k.decisions.toLocaleString()} decisions`),
      tile('Bust rate', pct(k.bustRate), `dealer busts ${pct(k.dealerBustRate)}`),
      tile('Blackjacks', k.blackjacks, `${pct(k.blackjacks / k.n)} of hands`),
      tile('Doubles', k.doubles, k.doubles ? `${pct(k.doubleWinRate)} won` : ''),
      tile('Longest win / loss streak', `${k.maxWin} / ${k.maxLoss}`, k.current ? `current: ${k.current.n} ${k.current.type}${k.current.n > 1 ? (k.current.type === 'win' ? 's' : 'es') : ''}` : ''),
      tile('Max drawdown', '$' + Math.round(k.maxDrawdown).toLocaleString(), 'peak to trough'),
      tile('Avg decision time', k.avgDecisionMs == null ? '—' : (k.avgDecisionMs / 1000).toFixed(1) + 's'),
      tile('Avg bet', '$' + (k.avgBet || 0).toFixed(0)),
    ].join('');

    $('insights').innerHTML = A.insights(hands, actions).map((i) => `<li class="${i.kind}">${esc(i.text)}</li>`).join('') || '<li>Not enough data yet.</li>';
    chart(hands);

    $('t-strategy').innerHTML = table([...sumCols('Strategy', 'strategy'), { h: 'Basic match', num: 1, v: (r) => pct(r.adherence) }], A.byStrategy(hands, actions));
    $('t-upcard').innerHTML = table(sumCols('Dealer shows', 'label'), A.byUpcard(hands));
    $('t-start').innerHTML = table(sumCols('Your first two cards', 'label'), A.byStart(hands));
    $('t-count').innerHTML = table(sumCols('Count at deal', 'label'), A.byCount(hands));
    $('t-action').innerHTML = table([
      { h: 'Action', v: (r) => r.action },
      { h: 'Times', num: 1, v: (r) => r.count },
      { h: 'Hand win %', num: 1, v: (r) => pct(r.winRate) },
      { h: 'Avg net / hand', num: 1, v: (r) => (r.count ? money(r.evPerHand) : '—'), cls: (r) => cls(r.evPerHand) },
      { h: 'Matched basic', num: 1, v: (r) => pct(r.followed) },
      { h: 'Avg time', num: 1, v: (r) => (r.avgMs == null ? '—' : (r.avgMs / 1000).toFixed(1) + 's') },
    ], A.byAction(hands, actions).filter((r) => r.count));
    $('t-dev').innerHTML = table([
      { h: 'Situation', v: (r) => esc(r.situation) },
      { h: 'You did', v: (r) => r.did }, { h: 'Basic says', v: (r) => r.should },
      { h: 'Times', num: 1, v: (r) => r.n },
      { h: 'Avg net / hand', num: 1, v: (r) => money(r.evPerHand), cls: (r) => cls(r.evPerHand) },
    ], A.deviations(hands, actions).slice(0, 10));
    $('t-recent').innerHTML = table([
      { h: 'When', v: (r) => new Date(r.played_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) },
      { h: 'Strategy', v: (r) => esc(r.strategy) },
      { h: 'You', v: (r) => `${r.player_cards.join(' ').replace(/0/g, '10')} (${r.player_total})` },
      { h: 'Dealer', v: (r) => `${r.dealer_cards.join(' ').replace(/0/g, '10')} (${r.dealer_total})` },
      { h: 'Result', v: (r) => r.result },
      { h: 'Net', num: 1, v: (r) => money(r.net), cls: (r) => cls(r.net) },
    ], hands.slice(-25).reverse());
  }

  // Single-series line chart: one gold line, recessive grid, crosshair + tooltip on hover/touch.
  function chart(hands) {
    const pts = [{ x: 0, y: hands[0].bankroll_before, label: 'Start' }, ...hands.map((h, i) => ({ x: i + 1, y: h.bankroll_after, label: `Hand ${i + 1}`, h }))];
    const W = 680, H = 240, L = 56, R = 12, T = 12, B = 28;
    const ys = pts.map((p) => p.y), lo = Math.min(...ys), hi = Math.max(...ys), pad = Math.max((hi - lo) * 0.1, 10);
    const y0 = lo - pad, y1 = hi + pad, xMax = Math.max(pts.length - 1, 1);
    const sx = (x) => L + (x / xMax) * (W - L - R), sy = (y) => T + (1 - (y - y0) / (y1 - y0)) * (H - T - B);
    const ticks = [0, 1, 2, 3].map((i) => y0 + ((y1 - y0) * i) / 3);
    const grid = ticks.map((t) => `<line x1="${L}" x2="${W - R}" y1="${sy(t)}" y2="${sy(t)}" class="grid"/><text x="${L - 8}" y="${sy(t) + 4}" class="axis" text-anchor="end">$${Math.round(t).toLocaleString()}</text>`).join('');
    const line = pts.map((p) => `${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
    $('chart').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Bankroll after each hand, from $${pts[0].y} to $${pts[pts.length - 1].y}. A table of recent hands is below.">
      ${grid}
      <line x1="${L}" x2="${W - R}" y1="${sy(pts[0].y)}" y2="${sy(pts[0].y)}" class="base"/>
      <polyline points="${line}" class="series"/>
      <text x="${L}" y="${H - 6}" class="axis">Start</text><text x="${W - R}" y="${H - 6}" class="axis" text-anchor="end">Hand ${pts.length - 1}</text>
      <line id="cx" y1="${T}" y2="${H - B}" class="cross" hidden/><circle id="cd" r="5" class="dot" hidden/>
      <rect x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent" id="hit"/>
    </svg><div id="tip" class="tip" hidden></div>`;
    const svg = $('chart').querySelector('svg'), tip = $('tip'), cx = $('cx'), cd = $('cd');
    const move = (ev) => {
      const r = svg.getBoundingClientRect(), cxp = (ev.touches ? ev.touches[0].clientX : ev.clientX);
      const vx = ((cxp - r.left) / r.width) * W;
      const i = Math.max(0, Math.min(pts.length - 1, Math.round(((vx - L) / (W - L - R)) * xMax)));
      const p = pts[i], px = sx(p.x), py = sy(p.y);
      cx.setAttribute('x1', px); cx.setAttribute('x2', px); cd.setAttribute('cx', px); cd.setAttribute('cy', py);
      cx.removeAttribute('hidden'); cd.removeAttribute('hidden');
      tip.hidden = false;
      tip.innerHTML = `<strong>${esc(p.label)}</strong><br>Bankroll $${Math.round(p.y).toLocaleString()}` + (p.h ? `<br>${esc(p.h.result)} · ${money(p.h.net)}<br>${esc(p.h.strategy)}` : '');
      tip.style.left = Math.min(Math.max((px / W) * r.width + 12, 0), r.width - 150) + 'px';
      tip.style.top = Math.max((py / H) * r.height - 60, 0) + 'px';
    };
    const leave = () => { cx.setAttribute('hidden', ''); cd.setAttribute('hidden', ''); tip.hidden = true; };
    const hit = $('hit');
    hit.addEventListener('mousemove', move); hit.addEventListener('touchmove', move, { passive: true }); hit.addEventListener('touchstart', move, { passive: true });
    hit.addEventListener('mouseleave', leave); hit.addEventListener('touchend', leave);
  }

  function download(name, rows, cols) {
    const blob = new Blob([A.toCSV(rows, cols)], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const HAND_COLS = ['id', 'session_id', 'strategy', 'hand_number', 'played_at', 'bet', 'total_wagered', 'doubled', 'initial_cards', 'player_cards', 'dealer_cards', 'dealer_upcard', 'dealer_upcard_value', 'initial_total', 'initial_soft', 'player_total', 'dealer_total', 'player_blackjack', 'dealer_blackjack', 'busted', 'dealer_busted', 'result', 'payout', 'net', 'bankroll_before', 'bankroll_after', 'running_count_start', 'decks_remaining', 'shoe_source', 'decisions', 'deviations'];
  const ACT_COLS = ['id', 'hand_id', 'seq', 'action', 'cards_before', 'total_before', 'soft_before', 'dealer_upcard', 'dealer_upcard_value', 'card_received', 'total_after', 'basic_action', 'followed_basic', 'decision_ms', 'running_count'];
  const filtered = () => { const f = $('stats-filter').value; return f ? allHands.filter((h) => h.strategy === f) : allHands; };
  $('export-hands').onclick = () => download('blackjack-hands.csv', filtered(), HAND_COLS);
  $('export-actions').onclick = () => { const ids = new Set(filtered().map((h) => h.id)); download('blackjack-decisions.csv', allActions.filter((a) => ids.has(a.hand_id)), ACT_COLS); };
  $('stats-filter').onchange = render;
  $('stats-refresh').onclick = load;

  window.addEventListener('auth', (e) => {
    const u = e.detail.user;
    if (u && user && u.id === user.id) { sb = e.detail.sb; return; }
    sb = e.detail.sb; user = u; allHands = []; allActions = []; stale = true;
    $('stats-body').hidden = true; $('stats-status').textContent = '';
  });
  window.addEventListener('tab', (e) => { if (e.detail === 'stats') load(); });
  window.addEventListener('tracker:saved', () => { stale = true; });
})();
