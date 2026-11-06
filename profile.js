/* Profile tab: create/edit a row in public.profiles (RLS restricts each user to their own row). */
(function () {
  const $ = (id) => document.getElementById(id);
  const RANKS = [['A', 'Ace'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5'], ['6', '6'], ['7', '7'], ['8', '8'], ['9', '9'], ['0', '10'], ['J', 'Jack'], ['Q', 'Queen'], ['K', 'King']];
  const SUITS = [['S', 'Spades ♠'], ['H', 'Hearts ♥'], ['D', 'Diamonds ♦'], ['C', 'Clubs ♣']];
  let sb = null, user = null, profile = null;

  const opt = (sel, list, blank) => {
    sel.replaceChildren(new Option(blank, ''), ...list.map(([v, t]) => new Option(t, v)));
  };
  opt($('p-rank'), RANKS, 'Rank…'); opt($('p-suit'), SUITS, 'Suit…');

  function googleInfo(u) {
    const m = u.user_metadata || {};
    return { name: m.full_name || m.name || (u.email || '').split('@')[0], pic: m.avatar_url || m.picture || null };
  }

  function setTab(name) {
    document.querySelectorAll('.tab').forEach((t) => {
      const on = t.dataset.tab === name; t.classList.toggle('active', on); t.setAttribute('aria-selected', on);
    });
    ['game', 'profile', 'stats'].forEach((n) => { $(n).hidden = n !== name; });
    window.dispatchEvent(new CustomEvent('tab', { detail: name }));
  }
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => setTab(t.dataset.tab)));

  function preview() {
    const r = $('p-rank').value, s = $('p-suit').value, img = $('p-card-preview');
    if (r && s) { img.src = `https://deckofcardsapi.com/static/img/${r}${s}.png`; img.hidden = false; } else img.hidden = true;
  }
  $('p-rank').onchange = $('p-suit').onchange = preview;
  $('p-bio').addEventListener('input', () => { $('bio-count').textContent = $('p-bio').value.length; });

  function fill() {
    const g = googleInfo(user);
    $('p-name').value = profile ? profile.display_name : g.name;
    $('p-location').value = (profile && profile.location) || '';
    $('p-bio').value = (profile && profile.bio) || '';
    $('bio-count').textContent = $('p-bio').value.length;
    const fc = (profile && profile.favorite_card) || '';
    $('p-rank').value = fc.slice(0, 1); $('p-suit').value = fc.slice(1, 2); preview();
    $('profile-title').textContent = profile ? 'Your profile' : 'Create your profile';
    $('profile-intro').textContent = profile ? 'Update your details any time.' : 'You haven’t set up a profile yet — add your details and save.';
  }

  function applyHeader() {
    const g = googleInfo(user);
    const name = profile ? profile.display_name : g.name;
    const pic = (profile && profile.avatar_url) || g.pic;
    $('greeting').textContent = `Welcome, ${name}!`;
    const img = $('avatar');
    if (pic) { img.src = pic; img.alt = name; img.hidden = false; } else img.hidden = true;
  }

  async function load() {
    const { data, error } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (error) { $('profile-msg').textContent = 'Could not load profile: ' + error.message; return; }
    profile = data; fill(); applyHeader();
    if (!profile) setTab('profile'); // first login: send them to create one
  }

  $('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('profile-msg'), btn = $('p-save');
    const r = $('p-rank').value, s = $('p-suit').value;
    if (!!r !== !!s) { msg.textContent = 'Pick both a rank and a suit, or neither.'; msg.className = 'lose'; return; }
    const row = {
      id: user.id,
      display_name: $('p-name').value.trim(),
      location: $('p-location').value.trim() || null,
      bio: $('p-bio').value.trim() || null,
      favorite_card: r && s ? r + s : null,
      avatar_url: (profile && profile.avatar_url) || googleInfo(user).pic,
    };
    if (!row.display_name) { msg.textContent = 'Display name is required.'; msg.className = 'lose'; return; }
    btn.disabled = true; msg.textContent = 'Saving…'; msg.className = '';
    const { data, error } = await sb.from('profiles').upsert(row).select().single();
    btn.disabled = false;
    if (error) { msg.textContent = 'Could not save: ' + error.message; msg.className = 'lose'; return; }
    profile = data; fill(); applyHeader();
    msg.textContent = 'Profile saved ✔'; msg.className = 'win';
  });

  window.addEventListener('auth', (e) => {
    const u = e.detail.user;
    if (u && user && u.id === user.id) return; // token refresh, not a new login
    sb = e.detail.sb; user = u; profile = null;
    if (!u) { setTab('game'); return; }
    setTab('game'); load();
  });
})();
