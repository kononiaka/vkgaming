# Buy Me a Coffee — donation name matching

**Status:** Code landed on `chore/cleanup-todo-docs` — ops/setup still required  
**Goal:** Credit BMC tips via tip name → `users.donationNickname` (same as DA).

---

## Done in code

- [x] Shared `processMatchedExternalDonation` + `findUserEntryByDonationNickname`
- [x] `exports.bmcWebhook` (HMAC `x-signature-sha256`, `donation.created`)
- [x] Idempotency: `processedBmcDonations/{eventId}`
- [x] `database.rules.json` — deny client write on `processedBmcDonations`
- [x] Support page + donate modal BMC link (`REACT_APP_BMC_URL` or `https://www.buymeacoffee.com/konoplay`)
- [x] Profile **Donation name** field (separate from lobby nick)

---

## Your setup checklist (not done until you run these)

1. BMC page: https://buymeacoffee.com/konoplay (already set as default link).
2. Deploy functions + rules, then set signing secret (see below).
3. BMC Studio → Integrations → New webhook  
   URL: `https://us-central1-test-prod-app-81915.cloudfunctions.net/bmcWebhook`  
   Event: `donation.created`  
   Copy signing secret into `bmc.webhook_secret`.
4. Send BMC **test event**; check Functions logs. If name/amount fields miss, adjust `parseBmcDonationPayload` in `functions/index.js`.
5. Smoke-test real $1 tip using Profile donation name → `totalDonatedUsd` / DonatorsBar.

### Deploy + secret (step 2)

Do this in order from the repo root (Firebase CLI logged into project `test-prod-app-81915`):

```bash
# A) Deploy webhook code + DB rules first (URL must exist before BMC can call it)
firebase deploy --only functions:bmcWebhook,database

# B) In BMC dashboard: create webhook → paste URL above → save → copy Signing Secret

# C) Store the secret in Functions config
firebase functions:config:set bmc.webhook_secret="PASTE_SIGNING_SECRET_HERE"

# D) Redeploy so the function picks up the new config
firebase deploy --only functions:bmcWebhook
```

Until C+D are done, the webhook will return `401 Invalid signature`.

---

## Notes

- Payload field names are best-effort (`supporter_name`, `payer_name`, etc.). Confirm with one test delivery.
- Unmatched tips still fund pools; only skip personal credit (same as DA).
- Anonymous / empty name → unmatched.
