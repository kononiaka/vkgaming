# Future Todo: Dynamic Telegram Images

Goal: generate a unique Telegram image for each notification, with tournament data rendered into the image itself instead of using one static announcement image.

## Current Behavior

- Telegram channel notifications can attach an image from Firebase Functions config:
  `telegram.announcement_image_url`.
- That image is static.
- The caption is already dynamic and includes tournament name, stage, players, score, winner, and links.
- If no image URL is configured, notifications fall back to plain text.

## Desired Future Behavior

Create dynamic image cards similar to ladder-style match cards:

- Tournament name
- Stage, round, or matchday
- Player names, avatars, flags, and stars
- Score, live map, winner, or scheduled time
- Konoplay branding

## Proposed Implementation

1. Add a public Cloud Function endpoint, for example:
   `/telegramMatchCard?tournamentId=...&stageIdx=...&pairIdx=...&type=result`

2. Fetch tournament and pair data from Firebase Realtime Database inside the function.

3. Generate a PNG server-side using one of:
   - `satori` + `resvg`
   - `sharp`
   - `canvas`

4. Return the PNG directly from the endpoint, or save generated PNGs to Cloud Storage and return a public URL.

5. Update Telegram notification builders to pass the dynamic URL as `photoUrl`.

6. Keep the current caption text as fallback/context.

7. Add fallback behavior:
   - If image generation fails, send the normal text message.
   - If Telegram rejects `sendPhoto`, retry with `sendMessage`.

## Suggested Rollout

Start with match result cards first because they have stable data:

1. Match result card
2. Live match card
3. Schedule card
4. Tournament finished card with winners and prizes

## Test Cases

- Completed match with normal player names
- Long player names
- Missing avatar or flag
- Players with no stars
- BO1, BO2, BO3 scores
- Swiss round
- League matchday
- Champions League group and knockout stages
- Tournament finished with first, second, and third place prizes
