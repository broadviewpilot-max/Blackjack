const assert = require('assert');
const BJ = require('../game.js');
const h = (...v) => v.map((value) => ({ value }));
const S = (cards, up, dbl = true) => BJ.basicStrategy(cards, up, dbl);

assert.strictEqual(S(h('10', '6'), 10), 'hit');      // hard 16 vs 10
assert.strictEqual(S(h('10', '6'), 6), 'stand');     // hard 16 vs 6
assert.strictEqual(S(h('10', '2'), 3), 'hit');       // hard 12 vs 3
assert.strictEqual(S(h('10', '2'), 4), 'stand');     // hard 12 vs 4
assert.strictEqual(S(h('6', '5'), 10), 'double');    // 11 vs 10
assert.strictEqual(S(h('6', '5'), 11), 'hit');       // 11 vs A (S17 multi-deck)
assert.strictEqual(S(h('6', '5'), 10, false), 'hit'); // cannot double
assert.strictEqual(S(h('5', '5'), 9), 'double');     // 10 vs 9
assert.strictEqual(S(h('5', '5'), 10), 'hit');       // 10 vs 10
assert.strictEqual(S(h('ACE', '7'), 6), 'double');   // soft 18 vs 6
assert.strictEqual(S(h('ACE', '7'), 6, false), 'stand');
assert.strictEqual(S(h('ACE', '7'), 9), 'hit');      // soft 18 vs 9
assert.strictEqual(S(h('ACE', '7'), 7), 'stand');
assert.strictEqual(S(h('ACE', '8'), 6), 'stand');    // soft 19
assert.strictEqual(S(h('ACE', '5'), 4), 'double');   // soft 16 vs 4
assert.strictEqual(S(h('ACE', '5'), 3), 'hit');
assert.strictEqual(S(h('9', '8'), 11), 'stand');     // hard 17
assert.strictEqual(S(h('ACE', '6', '10'), 5), 'stand'); // 3-card hard 17
assert.strictEqual(S(h('2', '3'), 5), 'hit');
assert.strictEqual(BJ.hiLo({ value: '5' }), 1);
assert.strictEqual(BJ.hiLo({ value: '8' }), 0);
assert.strictEqual(BJ.hiLo({ value: 'KING' }), -1);
assert.strictEqual(BJ.hiLo({ value: 'ACE' }), -1);
console.log('strategy.test.js: all tests passed');
