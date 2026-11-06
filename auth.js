/* Google sign-in via Supabase Auth. The publishable key is designed to be public in browser code. */
(function () {
  const SUPABASE_URL = 'https://sonsuwtxwxnfpqmunino.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_0PsBeF3aaT-QKZ0qAV3auw_k5VhP-Re';
  const $ = (id) => document.getElementById(id);

  if (!window.supabase) { $('auth-error').textContent = 'Could not load sign-in library. Check your connection.'; return; }
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  function show(user) {
    const signedIn = !!user;
    window.dispatchEvent(new CustomEvent('auth', { detail: { user, sb } }));
    $('login').hidden = signedIn;
    $('app').hidden = !signedIn;
    $('userbar').hidden = !signedIn;
    if (!signedIn) return;
    const m = user.user_metadata || {};
    const name = m.full_name || m.name || (user.email || 'Player').split('@')[0];
    const pic = m.avatar_url || m.picture;
    $('greeting').textContent = `Welcome, ${name}!`;
    const img = $('avatar');
    if (pic) { img.src = pic; img.alt = name; img.referrerPolicy = 'no-referrer'; img.hidden = false; }
    else img.hidden = true;
  }

  $('google-login').onclick = async () => {
    $('auth-error').textContent = '';
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
    if (error) $('auth-error').textContent = error.message;
  };
  $('logout').onclick = async () => { await sb.auth.signOut(); show(null); };

  sb.auth.onAuthStateChange((_event, session) => show(session && session.user));
  sb.auth.getSession().then(({ data }) => show(data.session && data.session.user));
})();
