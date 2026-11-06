/* Persists every hand and every decision to Supabase.
   Each hand is written to a local queue first, then flushed; inserts are idempotent
   (client-generated UUIDs + ignore-duplicates), so a failed save is retried safely. */
(function () {
  const KEY = 'bj_pending_v1';
  let sb = null, user = null, session = null, handNo = 0, flushing = null;

  const uuid = () => crypto.randomUUID();
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } };
  const store = (q) => { try { localStorage.setItem(KEY, JSON.stringify(q)); } catch (e) {} };
  const status = (text, ok) => window.dispatchEvent(new CustomEvent('tracker:status', { detail: { text, ok } }));

  async function push(item) {
    const opt = { onConflict: 'id', ignoreDuplicates: true };
    let r = await sb.from('play_sessions').upsert(item.session, opt); if (r.error) throw r.error;
    r = await sb.from('hands').upsert(item.hand, opt); if (r.error) throw r.error;
    if (item.actions.length) { r = await sb.from('hand_actions').upsert(item.actions, opt); if (r.error) throw r.error; }
  }

  // Drain the queue one item at a time, re-reading it each pass so hands that finish mid-flush are picked up.
  async function run() {
    let saved = 0;
    try {
      for (;;) {
        const next = load().find((i) => i.hand.user_id === user.id);
        if (!next) break;
        await push(next);
        store(load().filter((i) => i.hand.id !== next.hand.id));
        saved++;
      }
      status('Saved ✔', true);
      if (saved) window.dispatchEvent(new CustomEvent('tracker:saved'));
    } catch (e) {
      console.warn('Save failed, will retry:', e);
      status('Offline — will retry', false);
    }
  }

  function flush() {
    if (!sb || !user) return Promise.resolve();
    if (!flushing) flushing = run().finally(() => { flushing = null; }); // finally always runs after assignment
    return flushing;
  }

  function record({ strategy, bankrollBefore, hand, actions }) {
    if (!user) return Promise.resolve();
    if (!session || session.strategy !== strategy) {
      session = { id: uuid(), user_id: user.id, strategy, bankroll_start: bankrollBefore, deck_count: 6, started_at: new Date().toISOString() };
      handNo = 0;
    }
    handNo++;
    const handRow = { ...hand, id: uuid(), user_id: user.id, session_id: session.id, strategy, hand_number: handNo, played_at: new Date().toISOString() };
    const actionRows = actions.map((a, i) => ({ ...a, id: uuid(), hand_id: handRow.id, user_id: user.id, seq: i + 1 }));
    store([...load(), { session, hand: handRow, actions: actionRows }]);
    status('Saving…', true);
    return flush();
  }

  window.addEventListener('auth', (e) => {
    const u = e.detail.user;
    if (u && user && u.id === user.id) { sb = e.detail.sb; return; }
    sb = e.detail.sb; user = u; session = null; handNo = 0;
    if (u) flush();
  });
  window.addEventListener('online', flush);

  window.Tracker = { record, flush };
})();
