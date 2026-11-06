const assert = require('assert');
const A = require('../analytics.js');
let id = 0;
const mk = (o) => ({ id: 'h' + ++id, session_id: 's1', strategy: 'Manual', bet: 10, total_wagered: 10, doubled: false, result: 'win', net: 10,
  bankroll_before: 1000, bankroll_after: 1010, dealer_upcard_value: 10, initial_total: 15, initial_soft: false, initial_cards: ['5H', '0S'],
  player_blackjack: false, busted: false, dealer_busted: false, decisions: 1, deviations: 0, ...o });
const hands = [mk({}), mk({ result: 'lose', net: -10, bankroll_after: 990 }), mk({ result: 'push', net: 0 }), mk({ result: 'blackjack', net: 15, player_blackjack: true, initial_total: 21, initial_soft: true, initial_cards: ['AS', 'KH'] })];
const k = A.kpis(hands, []);
assert.strictEqual(k.n, 4); assert.strictEqual(k.wins, 2); assert.strictEqual(k.losses, 1); assert.strictEqual(k.pushes, 1);
assert.strictEqual(k.net, 15); assert.strictEqual(k.wagered, 40); assert.strictEqual(k.roi, 15 / 40);
assert.strictEqual(k.blackjacks, 1); assert.strictEqual(k.maxWin, 1); assert.strictEqual(k.maxLoss, 1);
assert.strictEqual(A.byStart(hands).find((r) => r.label === 'Blackjack').n, 1);
assert.strictEqual(A.byStart(hands).find((r) => r.label === 'Hard 15').n, 3);
assert.strictEqual(A.byUpcard(hands).find((r) => r.label === '10').n, 4);
assert.strictEqual(A.maxDrawdown([{ bankroll_after: 1100 }, { bankroll_after: 900 }, { bankroll_after: 1000 }]), 200);
// streaks: pushes don't break
assert.strictEqual(A.streaks([{ result: 'win' }, { result: 'push' }, { result: 'win' }, { result: 'lose' }]).maxWin, 2);
// deviations
const acts = [{ hand_id: hands[0].id, action: 'stand', basic_action: 'hit', followed_basic: false, soft_before: false, total_before: 15, dealer_upcard_value: 10 },
  { hand_id: hands[1].id, action: 'hit', basic_action: 'hit', followed_basic: true, soft_before: false, total_before: 15, dealer_upcard_value: 10 }];
const dev = A.deviations(hands, acts); assert.strictEqual(dev.length, 1); assert.strictEqual(dev[0].situation, 'Hard 15 vs 10');
assert.strictEqual(A.kpis(hands, acts).adherence, 0.5);
// CSV: arrays joined, quotes escaped, formula injection neutralised
assert.strictEqual(A.toCSV([{ a: ['AS', 'KH'], b: '=cmd', c: 'x,"y"' }], ['a', 'b', 'c']), `a,b,c\nAS;KH,'=cmd,"x,""y"""`);
// insights never crash on tiny data and warn about sample size
assert.ok(A.insights(hands, acts)[0].text.includes('Only 4 hands'));
assert.deepStrictEqual(A.insights([], []), []);
console.log('analytics.test.js: all tests passed');
