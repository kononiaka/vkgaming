# Future Todo: Dynamic Telegram Images

**Status:** Open (next product ticket)  
**Goal:** Generate a unique Telegram image for each notification, with tournament data rendered into the image instead of one static announcement image.

## Current Behavior

- Telegram channel notifications can attach an image from Firebase Functions config:
  `telegram.announcement_image_url`.
- That image is static.
- The caption is already dynamic (tournament, stage, players, score, winner, links).
- If no image URL is configured, notifications fall back to plain text.

## Desired Future Behavior

Dynamic image cards similar to ladder-style match cards:

- Tournament name
- Stage, round, or matchday
- Player names, avatars, flags, and stars
- Score, live map, winner, or scheduled time
- Konoplay branding

## Proposed Implementation

1. Public Cloud Function endpoint, e.g.  
   `/telegramMatchCard?tournamentId=...&stageIdx=...&pairIdx=...&type=result`
2. Fetch tournament + pair data from Realtime Database in the function.
3. Generate PNG server-side (`satori` + `resvg`, `sharp`, or `canvas`).
4. Return PNG directly, or store in Cloud Storage and use a public URL.
5. Telegram builders pass the dynamic URL as `photoUrl`.
6. Keep caption text as context / fallback.
7. Fallbacks: generation failure → text message; `sendPhoto` reject → `sendMessage`.

## Suggested Rollout

1. Match result card (stable data)
2. Live match card
3. Schedule card
4. Tournament finished card (winners + prizes)

## Test Cases

- Completed match with normal player names
- Long player names
- Missing avatar or flag
- Players with no stars
- BO1, BO2, BO3 scores
- Swiss round / league matchday
- Champions League group and knockout
- Tournament finished with 1st / 2nd / 3rd prizes

See also: future product list in [`LAUNCH_PLAN.md`](LAUNCH_PLAN.md).
