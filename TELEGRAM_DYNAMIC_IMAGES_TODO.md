# Future Todo: Dynamic Telegram Images

**Status:** All channel card types deployed (branch `feature/telegram-dynamic-match-cards`)  
**Goal:** Generate a unique Telegram image for each notification, with tournament data rendered into the image instead of one static announcement image.

**Live endpoint:**  
`https://us-central1-test-prod-app-81915.cloudfunctions.net/telegramMatchCard?type=...`

## Current Behavior

- Channel posts use dynamic PNGs from `telegramMatchCard` when possible:
  - `type=result` — match finished / winner set
  - `type=live` — map went live
  - `type=schedule` — match time set/changed
  - `type=status` — registration open/closed / tournament finished
  - `type=digest` — morning/evening digest
- Match-related DMs also attach the same dynamic card when available.
- Captions remain dynamic HTML.
- If `sendPhoto` fails, senders fall back to plain text (`sendMessage`).
- Static `telegram.announcement_image_url` remains fallback when no dynamic URL is built.

## Card query examples

```
/telegramMatchCard?type=result&tournamentId=...&stageIdx=0&pairIdx=0
/telegramMatchCard?type=live&tournamentId=...&stageIdx=0&pairIdx=0&gameIdx=0
/telegramMatchCard?type=schedule&tournamentId=...&stageIdx=0&pairIdx=0
/telegramMatchCard?type=status&tournamentId=...&status=Registration%20Started
/telegramMatchCard?type=digest&slot=morning&dateKey=2026-08-14
```

## Suggested Rollout

1. [x] Match result card
2. [x] Live match card
3. [x] Schedule card
4. [x] Tournament status / finished card
5. [x] Daily digest card

## Key files

| File | Role |
|---|---|
| `functions/telegramMatchCard.js` | HTTPS PNG endpoint + data loaders |
| `functions/telegramMatchCardRender.js` | Satori layouts for all card types |
| `functions/telegramNotifications.js` | photoUrl wiring for channel + match DMs |
| `functions/telegram.js` | Photo → text fallback |
| `functions/assets/fonts/*` | Inter fonts for cards |
| `functions/assets/images/konoplay-crest.png` | Brand crest |

See also: future product list in [`LAUNCH_PLAN.md`](LAUNCH_PLAN.md).
