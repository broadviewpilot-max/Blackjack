# Blackjack

Browser blackjack built on the free [Deck of Cards API](https://deckofcardsapi.com/). Static site, no build step.

## Rules
- 6-deck shoe from the API (`/deck/new/shuffle/?deck_count=6`, `/deck/<id>/draw/`); reshuffles when under 78 cards remain
- Blackjack pays 3:2, dealer stands on all 17s, double down on first two cards
- No split or insurance (yet). Bankroll persists in `localStorage`
- If the API is unreachable, the game falls back to a locally shuffled shoe (same card images)

## Run locally
    python3 -m http.server 8000     # then open http://localhost:8000

## Test
    node tests/game.test.js

## Deploy (Netlify)
Deploy the repo root as-is; `netlify.toml` sets publish dir to `.` with no build command.

## Accounts & profiles
Google sign-in via Supabase Auth. Signed-in users get a **My Profile** tab backed by `public.profiles`
(display name, location, bio, favorite card). Row-level security: signed-in users can read profiles;
each user can create/update/delete only their own row.

## Play tracking & Stats
Every hand and every decision is saved to Supabase for the signed-in user (tables `play_sessions`, `hands`,
`hand_actions`; row-level security keeps each user's data private). Saves are queued locally and retried if offline.

- **Strategy label:** type the strategy you're testing above the table; results are grouped by it.
- **Recorded per hand:** cards, dealer upcard, bet, result, bankroll before/after, Hi-Lo running count and decks remaining at the deal.
- **Recorded per decision:** action, hand state, what basic strategy recommends, whether you matched it, decision time.
- **Stats tab:** KPIs, bankroll chart, breakdowns by strategy / dealer upcard / starting hand / count, deviations from basic strategy, auto-generated insights (sample-size guarded), and CSV export of hands and decisions for modelling.
- Basic strategy here = multi-deck, dealer stands on 17, hit/stand/double only (no split or insurance).

## Test
    for t in game strategy analytics; do node tests/$t.test.js; done
