# Buy Me a Coffee — nickname matching (parity with Donation Alerts)

**Status:** In progress (Phase 1 UI + Phase 2 matching scaffolded)  
**Goal:** Credit BMC supporters to KonoPlay accounts (supporters bar, donation stats, prize-pool allocation) the same way Donation Alerts does via `daUsername`.  
**Blocked / context:** Stripe live is unavailable (PL NIP). Support stack = DA (primary) + BMC (international) + Mono jar (optional).  
**BMC page:** https://www.buymeacoffee.com/konoplay

---

## Product behavior (must match DA)

1. Player sets a **BMC display name / supporter name** on Profile (same idea as DA username).
2. When they tip on Buy Me a Coffee, they must use that **exact** name (case-insensitive).
3. Backend matches tip → `users/{uid}` → updates:
   - `totalDonatedUsd`, `donationCount`, `lastDonationAt`
   - prize-pool allocation using `donationTargetTournamentIds` (same as DA)
4. `DonatorsBar` / leaderboards already read `totalDonatedUsd` + nickname — no UI change needed once stats are written.

If no profile match: still allocate to prize pools (DA currently allocates even when unmatched, then skips donor stats — see `processMatchedDonation`). Same behavior for BMC. Empty/anonymous `supporter_name` → no credit; still allocate without cup targets.

---

## Current DA / BMC reference

| Piece | Location |
|---|---|
| Profile field `daUsername` | `src/components/Profile/ProfileForm.js` |
| Profile field `bmcUsername` | `src/components/Profile/ProfileForm.js` |
| Shared match helper | `functions/index.js` → `processMatchedDonation` |
| DA poll | `functions/index.js` → `pollDonations` → `processDonation` |
| BMC webhook | `functions/index.js` → `bmcWebhook` |
| Match keys | `user.daUsername` / `user.bmcUsername` ↔ tip name (trim, lower-case) |
| Idempotency | `processedDonations/{id}`, `processedBmcDonations/{eventId}` |
| Donor stats | `recordDonorContribution` |
| Prize pools | `allocateDonationToLivePrizePools` |
| Supporters bar | `src/components/DonatorsBar/DonatorsBar.js` |
| Support / modal links | `src/components/Support/Support.js`, `src/UI/modalDonate/modalDonate.js` |

Do **not** scrape the BMC page.

---

## Webhook payload (verified from BMC OpenAPI)

`donation.created` envelope:

- `event_id` — idempotency key
- `type`: `"donation.created"`
- `data.supporter_name` — match against `bmcUsername`
- `data.amount` / `data.currency` (often USD)
- Signature header: `x-signature-sha256` = HMAC-SHA256 hex of raw body with webhook signing secret

OpenAPI: https://cdn.buymeacoffee.com/assets/integrations/bmc-webhooks-openapi.json

---

## Done in this branch

- [x] Support page + donate modal: BMC link (`https://www.buymeacoffee.com/konoplay`)
- [x] Profile can save `bmcUsername`
- [x] Shared `processMatchedDonation` extracted from DA `processDonation`
- [x] `bmcWebhook` HTTPS function + `processedBmcDonations` rules
- [ ] Deploy functions; set `bmc.webhook_secret`; register webhook in BMC Studio
- [ ] Test BMC tip with matching name → `totalDonatedUsd` + DonatorsBar
- [ ] Tip with unknown name → no user credit; prize-pool behavior matches DA
- [ ] Duplicate webhook delivery does not double-credit

---

## Config / deploy (ops)

```text
firebase functions:config:set bmc.webhook_secret="..." bmc.page_slug="konoplay"
firebase deploy --only functions:bmcWebhook,database
```

Register webhook URL:

`https://us-central1-test-prod-app-81915.cloudfunctions.net/bmcWebhook`

Select event: **donation.created**. Copy signing secret into `bmc.webhook_secret`.

---

## Out of scope / non-goals

- Replacing DA (keep DA as primary).
- Auto-matching MonoBank jar.
- Stripe live / NIP.
- Tournament attendance / host seed via BMC.
- `recurring_donation.*` / membership events (v1 = one-time `donation.created` only).

---

## Open questions (mostly resolved)

1. Supporter name path: `data.supporter_name` (confirmed via OpenAPI example).
2. Anonymous / empty name: skip credit, still allocate (same as unmatched DA).
3. Currency: reuse `normalizeDonationToUsd` (BMC typically USD).
4. Unmatched BMC tips: still fund selected cups only when matched user has targets; unmatched → live-pool / unallocated like DA.
