# Buy Me a Coffee — nickname matching (parity with Donation Alerts)

**Status:** Not started  
**Goal:** Credit BMC supporters to KonoPlay accounts (supporters bar, donation stats, prize-pool allocation) the same way Donation Alerts does via `daUsername`.  
**Blocked / context:** Stripe live is unavailable (PL NIP). Support stack = DA (primary) + BMC (international) + Mono jar (optional). BMC link can ship first; this doc is for **auto-matching** later.

---

## Product behavior (must match DA)

1. Player sets a **BMC display name / supporter name** on Profile (same idea as DA username).
2. When they tip on Buy Me a Coffee, they must use that **exact** name (case-insensitive).
3. Backend matches tip → `users/{uid}` → updates:
   - `totalDonatedUsd`, `donationCount`, `lastDonationAt`
   - prize-pool allocation using `donationTargetTournamentIds` (same as DA)
4. `DonatorsBar` / leaderboards already read `totalDonatedUsd` + nickname — no UI change needed once stats are written.

If no profile match: still allocate to prize pools if product wants that (DA currently allocates even when unmatched, then skips donor stats — see `processDonation`). Prefer **same behavior** for BMC.

---

## Current DA reference (do not reinvent)

| Piece | Location |
|---|---|
| Profile field `daUsername` | `src/components/Profile/ProfileForm.js` |
| Poll + match | `functions/index.js` → `pollDonations`, `processDonation` |
| Match key | `user.daUsername` ↔ donation `username` (trim, lower-case) |
| Idempotency | `processedDonations/{donationId}` |
| Donor stats | `recordDonorContribution` |
| Prize pools | `allocateDonationToLivePrizePools` |
| Supporters bar | `src/components/DonatorsBar/DonatorsBar.js` (reads `totalDonatedUsd`) |
| Support page links | `src/components/Support/Support.js`, `src/UI/modalDonate/modalDonate.js` |

Mirror this pattern; do **not** scrape the BMC page.

---

## Proposed design

### 1. Profile

- Add `bmcUsername` (or `bmcSupporterName`) on `users/{uid}`.
- Profile UI: panel next to Donation Alerts — label, input, save button.
- Copy: “Use this exact name when tipping on Buy Me a Coffee so we can credit your KonoPlay account.”
- Validate: trim; optional uniqueness warning (nice-to-have, not required for v1).

### 2. Ingest path (prefer webhooks over polling)

BMC supports webhooks (`donation.created`, etc.):

- https://help.buymeacoffee.com/en/articles/15743173-how-to-setup-and-use-buy-me-a-coffee-webhooks

Implement Firebase HTTPS function e.g. `bmcWebhook`:

1. Verify webhook signature/secret (store in `functions.config().bmc.webhook_secret` or Secret Manager).
2. Parse supporter name + amount + currency + event id from payload (`donation.created`).
3. Idempotency: `processedBmcDonations/{eventId}` (separate from DA `processedDonations`).
4. Reuse shared helper extracted from `processDonation` (match field configurable: `daUsername` vs `bmcUsername`).
5. Call `allocateDonationToLivePrizePools` + `recordDonorContribution` on match.

**Fallback:** BMC API polling only if webhooks unavailable for the account tier — document which BMC plan is required.

### 3. Support / donate UI

- Add BMC button/link (env or constant: `REACT_APP_BMC_URL` or hardcoded `https://www.buymeacoffee.com/<slug>`).
- Keep Stripe “Coming soon” until live Stripe exists.
- Mention in Help/Support copy that BMC matching needs Profile `bmcUsername`.

### 4. Config / secrets

```text
firebase functions:config:set \
  bmc.webhook_secret="..." \
  bmc.page_slug="..."   # optional
```

Register webhook URL:

`https://us-central1-<PROJECT>.cloudfunctions.net/bmcWebhook`

### 5. Database rules

- `users/{uid}/bmcUsername` — owner write, same as `daUsername`.
- `processedBmcDonations` — server-only (deny client write), same pattern as `processedDonations` / `processedStripe`.

---

## Acceptance criteria

- [ ] Profile can save `bmcUsername`.
- [ ] Test BMC tip with matching name → user `totalDonatedUsd` increases; name appears on DonatorsBar.
- [ ] Tip with unknown name → no user credit; prize-pool behavior matches DA.
- [ ] Duplicate webhook delivery does not double-credit.
- [ ] Support page shows BMC link; DA + Mono still work.
- [ ] No secrets in frontend; webhook secret only on Functions.

---

## Out of scope / non-goals

- Replacing DA (keep DA as primary).
- Auto-matching MonoBank jar (manual / no nickname API).
- Stripe live / NIP.
- Tournament attendance / host seed via BMC.

---

## Implementation checklist for next agent

1. Confirm BMC page exists and webhook access (Studio → Webhooks).
2. Capture one real `donation.created` payload (supporter name field name may differ — verify against BMC OpenAPI/docs).
3. Extract shared `processMatchedDonation({ provider, externalId, donorUsername, amount, currency, usernameField })` from DA code.
4. Add `bmcWebhook` + `processedBmcDonations`.
5. Profile field + save path.
6. Support/modal links + short help text.
7. Update `database.rules.json` / recommended rules.
8. Manual test plan + optional unit tests for match helper.
9. Deploy functions; register webhook; smoke-test with $1 tip.

---

## Open questions (resolve before coding)

1. Exact JSON path for supporter display name on current BMC webhook schema?
2. Does BMC allow anonymous tips with empty name? (skip credit, still allocate?)
3. Currency: always USD on BMC page, or multi-currency? Reuse `normalizeDonationToUsd`.
4. Should unmatched BMC tips still fund selected cups / live pools like DA?

---

## Related product note

Ship BMC as a **plain link** anytime. This ticket is only for **DA-parity nickname matching** so BMC tips show on the sliding supporters bar and count toward pools/stats.
