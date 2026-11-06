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
