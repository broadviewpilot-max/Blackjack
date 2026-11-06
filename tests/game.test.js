const assert = require('assert');
const BJ = require('../game.js');
const c = (value) => ({ value });

assert.deepStrictEqual(BJ.handTotal([c('ACE'), c('KING')]), { total: 21, soft: true });
assert.strictEqual(BJ.handTotal([c('ACE'), c('ACE'), c('9')]).total, 21);
assert.strictEqual(BJ.handTotal([c('ACE'), c('ACE'), c('ACE')]).total, 13);
assert.strictEqual(BJ.handTotal([c('KING'), c('QUEEN'), c('5')]).total, 25);
assert.strictEqual(BJ.handTotal([c('ACE'), c('6'), c('10')]).soft, false);
assert.ok(BJ.isBlackjack([c('ACE'), c('JACK')]));
assert.ok(!BJ.isBlackjack([c('7'), c('7'), c('7')]));
assert.ok(BJ.dealerShouldHit([c('10'), c('6')]));
assert.ok(!BJ.dealerShouldHit([c('ACE'), c('6')])); // soft 17 stands

assert.deepStrictEqual(BJ.settle([c('ACE'), c('KING')], [c('9'), c('8')], 10), { result: 'blackjack', payout: 25 });
assert.deepStrictEqual(BJ.settle([c('ACE'), c('KING')], [c('ACE'), c('QUEEN')], 10), { result: 'push', payout: 10 });
assert.deepStrictEqual(BJ.settle([c('10'), c('5'), c('9')], [c('ACE'), c('QUEEN')], 10), { result: 'lose', payout: 0 });
assert.deepStrictEqual(BJ.settle([c('10'), c('9')], [c('10'), c('6'), c('9')], 10), { result: 'win', payout: 20 });
assert.deepStrictEqual(BJ.settle([c('10'), c('8')], [c('10'), c('8')], 10), { result: 'push', payout: 10 });
assert.deepStrictEqual(BJ.settle([c('10'), c('7')], [c('10'), c('8')], 10), { result: 'lose', payout: 0 });
assert.deepStrictEqual(BJ.settle([c('5'), c('6'), c('10')], [c('ACE'), c('KING')], 10), { result: 'lose', payout: 0 }); // dealer BJ beats 21
console.log('game.js: all tests passed');
