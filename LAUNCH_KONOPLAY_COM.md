# Launch handoff: konoplay.com

**Created:** 2026-06-14  
**Target:** End-of-week production launch on custom domain  
**Read this first** when picking up deploy, domain, OAuth, or hosting work.

---

## Decision log

| Item | Choice |
|------|--------|
| Production domain | **`konoplay.com`** (~$6/yr) |
| Rejected | `konoplay.gg` (~$50/yr) — same brand, not worth the premium at v1 |
| Staging (keep for now) | `https://kononiaka.github.io` (root — not `/vkgaming`) |
| Brand | **Konoplay** (already in UI, manifest, Twitch app name KONOPLAY) |
| Firebase project | `test-prod-app-81915` |
| Hosting recommendation | **Firebase Hosting** (Auth + RTDB + Functions already there) |

---

## Production URLs (target — no `/vkgaming` subpath)

```
https://konoplay.com/
https://konoplay.com/#/auth
https://konoplay.com/auth/twitch/callback
```

OAuth callback must be a **real path** (not hash-only). `scripts/postbuild-ghpages.js` already copies `index.html` to `auth/twitch/callback/` — replicate for Firebase Hosting rewrites.

---

## Current state (as of 2026-06-14)

### Working / in progress on github.io

- Twitch OAuth **request** sends correct production `redirect_uri` when opened from `kononiaka.github.io`
- Twitch Developer app **KONOPLAY** has redirect URL configured
- Firebase **Authorized domains** includes `kononiaka.github.io` and `localhost`
- Deploy: `npm run deploy` → `npm run build && gh-pages -d build`
- Live bundle example: `main.a85569d7.js` (hash changes each deploy)

### Known blocker — Firebase Web API key (`AIzaSyAzjGuv...`)

**Do not use Website (HTTP referrer) restrictions** on the browser API key used by this app.

| Referer sent | Who sends it | Website restriction result |
|---|---|---|
| `https://kononiaka.github.io/` | Browser login | Blocked if not in list (even when listed, can misconfigure) |
| `<empty>` | Cloud Function server-side call | **Always blocked** with Website restrictions |

**Fix:** Google Cloud → Credentials → `AIzaSyAzjGuv...` → Application restrictions → **None** → Save.

Keep **API restrictions** (Identity Toolkit API, etc.) — that is enough for Firebase web keys (they are public in the client bundle).

Sign-in runs in the **browser** after `twitchAuth` returns a custom token.

### Lessons from OAuth debugging

1. **Stale JS cache** can bake in `localhost` redirect URIs — incognito vs normal browser behaved differently.
2. **`getSiteBaseUrl()` / `getTwitchRedirectUri()`** in `src/utils/appBasePath.js` now prefer runtime hostname on `github.io` over baked env vars.
3. Login from **`localhost:3000`** uses different Twitch callback than production — don't test prod flow on localhost without dev URIs registered.
4. **Service accounts** in Google Cloud are unrelated to browser login — edit **API keys**, not service accounts.

---

## Launch checklist (agent TODO)

### Phase 0 — Pre-launch (github.io stable)

- [ ] Google Cloud API key `AIzaSyAzjGuv...` → Application restrictions → **None** (not Websites)
- [ ] Confirm Twitch login end-to-end on github.io (Twitch → callback → home)

### Phase 1 — Domain & hosting

- [ ] Domain **konoplay.com** purchased; auto-renew on
- [ ] Set up **Firebase Hosting** (or chosen host) for the React build
- [ ] DNS: apex + `www` → hosting (Firebase or Cloudflare)
- [ ] HTTPS active on `konoplay.com`
- [ ] SPA rewrites: all routes + `/auth/twitch/callback` → `index.html`

### Phase 2 — App config & env

Update `.env` (and CI secrets if any) before production build:

```env
REACT_APP_SITE_URL=https://konoplay.com
REACT_APP_TWITCH_REDIRECT_URI=https://konoplay.com/auth/twitch/callback
```

- [ ] `package.json` → `"homepage": "https://konoplay.com"` (drops `/vkgaming` from asset paths)
- [ ] Rebuild and deploy to new host (not gh-pages for prod)
- [ ] Update `src/utils/appBasePath.js` — replace hardcoded `DEFAULT_PRODUCTION_SITE` github.io fallback with env-driven value or `konoplay.com`
- [ ] Grep repo for `kononiaka.github.io` and update fallbacks in:
  - `functions/telegram.js` (`site_url`)
  - `functions/index.js` (`baseUrl` fallback)
  - `.env.example`
  - Tests in `src/__tests__/appBasePath.test.js`

### Phase 3 — External services (all must match **exact** URLs)

- [ ] **Twitch Developer Console** → KONOPLAY → OAuth Redirect URLs:
  - `https://konoplay.com/auth/twitch/callback`
  - Keep github.io URI during transition; remove later
- [ ] **Google Cloud API key** `AIzaSyAzjGuv...` → add `https://konoplay.com/*` and `https://www.konoplay.com/*`
- [ ] **Firebase Console** → Authentication → Authorized domains → add `konoplay.com`, `www.konoplay.com`
- [ ] **Firebase Functions config** (Telegram links):
  ```bash
  firebase functions:config:set telegram.site_url="https://konoplay.com"
  ```
  Redeploy functions if changed.

### Phase 4 — Deploy scripts

- [ ] Split deploy targets:
  - `deploy:staging` → gh-pages (optional, current `npm run deploy`)
  - `deploy:prod` → Firebase Hosting (`firebase deploy --only hosting`)
- [ ] Add `firebase.json` hosting section if missing
- [ ] Post-build: ensure `auth/twitch/callback/index.html` exists (reuse or adapt `scripts/postbuild-ghpages.js`)

### Phase 5 — Smoke test on konoplay.com

- [ ] Open `https://konoplay.com/#/auth` — address bar must show `konoplay.com`
- [ ] Network → Twitch `authorize` → `redirect_uri=https://konoplay.com/auth/twitch/callback`
- [ ] Network → `signInWithCustomToken` → **200** (not 403)
- [ ] Logged-in state persists; token refresh works (`securetoken.googleapis.com` uses same API key)
- [ ] Live Arena, tournaments, profile load against prod Firebase

### Phase 6 — Cutover & cleanup

- [ ] Optional: 301 redirect `kononiaka.github.io/vkgaming` → `konoplay.com`
- [ ] Update any public links (Telegram, Twitch panel, Discord) to konoplay.com
- [ ] Remove localhost/github.io from Twitch OAuth when no longer needed

---

## Key files reference

| File | Role |
|------|------|
| `src/components/Auth/AuthForm.js` | Starts Twitch OAuth |
| `src/components/Auth/TwitchCallback.js` | Exchanges code; Firebase sign-in; shows "Twitch login failed: …" |
| `src/utils/appBasePath.js` | Site URL, OAuth redirect URI, post-login redirects |
| `scripts/postbuild-ghpages.js` | SPA + OAuth callback fallbacks for static hosting |
| `src/config/firebase.js` | Firebase URLs / Functions base |
| `.env.example` | Document all `REACT_APP_*` vars |

---

## Architecture (auth flow)

```
User clicks "Continue with Twitch" (AuthForm.js)
  → redirect to id.twitch.tv with redirect_uri
Twitch redirects to /auth/twitch/callback?code=...
  → TwitchCallback.js
  → POST Cloud Function twitchAuth (exchange code → customToken)
  → POST identitytoolkit.googleapis.com/.../signInWithCustomToken  ← API key referrers matter here
  → authCtx.login → redirect to /#/
```

---

## User intent

Move off `github.io` for a professional public launch. **konoplay.com** is the chosen production domain. GitHub Pages remains acceptable as staging until cutover is verified.
