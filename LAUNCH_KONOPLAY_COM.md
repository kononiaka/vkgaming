# Launch handoff: konoplay.com

**Status:** DONE (ops cutover complete)  
**Created:** 2026-06-14 · **Closed:** 2026-08-04  
**Read this** for domain / OAuth / hosting reference — not an open checklist.

---

## Decision log

| Item | Choice |
|------|--------|
| Production domain | **`konoplay.com`** |
| Rejected | `konoplay.gg` |
| Staging (optional) | `https://kononiaka.github.io` |
| Brand | **Konoplay** |
| Firebase project | `test-prod-app-81915` |
| Hosting | **Firebase Hosting** (+ Auth / RTDB / Functions) |

---

## Production URLs

```
https://konoplay.com/
https://konoplay.com/#/auth
https://konoplay.com/auth/twitch/callback
```

OAuth callback is a **real path** (not hash-only). Post-build / Hosting rewrites must serve `index.html` at `/auth/twitch/callback`.

---

## Completed checklist

### Phase 0 — Pre-launch (github.io)

- [x] Google Cloud API key → Application restrictions → **None** (not Website referrers)
- [x] Twitch login end-to-end on github.io

### Phase 1 — Domain & hosting

- [x] Domain **konoplay.com** purchased; auto-renew on
- [x] Firebase Hosting for the React build
- [x] DNS: apex + `www` → hosting
- [x] HTTPS on `konoplay.com`
- [x] SPA rewrites including `/auth/twitch/callback`

### Phase 2 — App config & env

- [x] `REACT_APP_SITE_URL` / Twitch redirect for `konoplay.com`
- [x] Production homepage / asset paths for konoplay.com
- [x] `appBasePath.js` production defaults → `konoplay.com`
- [x] Fallbacks updated (Functions Telegram `site_url`, Stripe `baseUrl`, tests, `.env.example` as needed)

### Phase 3 — External services

- [x] Twitch OAuth Redirect URL: `https://konoplay.com/auth/twitch/callback`
- [x] Firebase Authorized domains: `konoplay.com`, `www.konoplay.com`
- [x] Functions config `telegram.site_url` (and related) for production links
- [x] Optional static Telegram image via `telegram.announcement_image_url` (dynamic cards → `TELEGRAM_DYNAMIC_IMAGES_TODO.md`)

### Phase 4 — Deploy

- [x] Hosting / deploy path for production
- [x] `firebase.json` hosting + database + functions
- [x] OAuth callback static fallback where required

### Phase 5 — Smoke test on konoplay.com

- [x] Auth URL shows `konoplay.com`
- [x] Twitch `redirect_uri` → konoplay.com callback
- [x] `signInWithCustomToken` OK
- [x] Session / token refresh OK
- [x] Live Arena, tournaments, profile against prod Firebase

### Phase 6 — Cutover

- [x] Public links / cutover as needed
- [x] Staging github.io retained optionally

---

## Ops notes (keep)

### API key

**Do not use Website (HTTP referrer) restrictions** on the browser Firebase API key.

| Referer | Who | Website restriction |
|---|---|---|
| Site origin | Browser login | Easy to misconfigure |
| `<empty>` | Cloud Function server-side | **Always blocked** |

Prefer Application restrictions → **None**; keep **API restrictions** (Identity Toolkit, etc.).

### Auth flow

```
User clicks "Continue with Twitch" (AuthForm.js)
  → id.twitch.tv with redirect_uri
Twitch → /auth/twitch/callback?code=...
  → TwitchCallback.js
  → POST twitchAuth (code → customToken)
  → signInWithCustomToken  ← API key restrictions matter here
  → authCtx.login → /#/
```

### Key files

| File | Role |
|------|------|
| `src/components/Auth/AuthForm.js` | Starts Twitch OAuth |
| `src/components/Auth/TwitchCallback.js` | Code exchange + Firebase sign-in |
| `src/utils/appBasePath.js` | Site URL, OAuth redirect, post-login redirects |
| `scripts/postbuild-ghpages.js` | SPA + OAuth callback fallbacks (static hosting) |
| `src/config/firebase.js` | Firebase / Functions base |
| `.env.example` | `REACT_APP_*` docs |

### Staging deploy (optional)

`npm run deploy` still pushes a build to github.io staging when needed. Production is **konoplay.com**.
