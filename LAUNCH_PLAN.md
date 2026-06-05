# Konoplay HoMM3 — Launch Plan & h3ladder.ru Parity

**Created:** June 4, 2026  
**Competitor:** [h3ladder.ru](https://h3ladder.ru) (live season ladder, ~62 players)  
**Your wedge:** Open knockout cups + deep stats + community funding (not “clone their league” on day one)

---

## 1. Feature parity: h3ladder.ru vs your codebase

Legend: **✅** you have it (usable) · **⚠️** partial / needs work · **❌** missing · **🟢** you’re ahead

| Area | h3ladder.ru | Your project | Status | Your files |
|------|-------------|--------------|--------|------------|
| **Positioning** | “Heroes 3 Ladder” — one seasonal championship | “konoplay” multi-feature platform | ⚠️ | `MainHeader.js`, `StartingPageContent.js` |
| **Home / match hub** | Live matches, league, round, start time, “Watch” | Live in-progress games, castles, win % prediction | ⚠️ | `StartingPageContent.js`, `.module.css` |
| **League tiers** | Top League, League A, League B (~18 players/league) | Single knockout tournaments only | ❌ | — (v2: new data model) |
| **Round-robin season** | Everyone plays everyone in league; points table | Knockout brackets (kick-off) | ❌ | `ModalAddTournament.js` (`kick-off` only) |
| **Promotion / relegation** | Documented in rules | Not implemented | ❌ | — (v2) |
| **Season schedule** | Tours (~5 days), match times on site | Tournament start date only | ❌ | `Tournaments.js`, bracket pairs |
| **Match time booking** | Players agree time; update on site; rules for disputes | No per-match datetime field | ❌ | v2: `playoffPairs[]` + UI |
| **Standings / points** | League tables by tour | Leaderboard by Elo-style rating | ⚠️ different model | `Leaderboard.js` |
| **Player directory** | `/players`, search, league badge | `/players/:id` only; nav link hidden | ⚠️ | `Players.js`, `App.js`, `MainHeader.js` |
| **Player profile** | League, place, win %, season matches | Rich: charts, castles, opponents, gold, restarts, stars | 🟢 | `Players.js`, `api.js` |
| **Match reporting** | Results in match card; default reporter rules | `ReportGameModal.js`, bracket submit | ✅ | `ReportGameModal.js`, `tournamentsBracket.js` |
| **BO series** | Multi-map series, carry score, reschedule rules | BO-1/3/5 in bracket | ✅ | `tournamentsBracket.js`, `Tournaments.js` |
| **Tournament brackets** | Season fixture list (not KO tree) | Full SVG/visual bracket, stages, 3rd place | 🟢 | `tournamentsBracket.js`, `PlayerBracket.js` |
| **Registration** | Application via account (lobby nick + Telegram) | In-tournament player add + auth nickname | ⚠️ | `Tournaments.js`, `ProfileForm.js` |
| **Organizer approval** | Can reject applications | Admin adds players manually | ⚠️ | `Tournaments.js`, `AdminPanel.js` |
| **Rules page** | Long published rules (RU) | No public rules route | ❌ | v1: static page or MD section |
| **Prize pool display** | `/support` — $1000 sponsor, crypto, Sber | Donations + coins; USD in tournament create | ⚠️ | `modalDonate.js`, `DonatorsBar.js`, `ModalAddTournament.js` |
| **Support / donate** | Dedicated page, contact email/Telegram | Modal donate in layout | ⚠️ | `Layout.js`, `modalDonate.js` |
| **Streaming rules** | Twitch required, VOD, camera in Top League | Videos section (content list) | ❌ | `Videos.js` — not enforcement |
| **Warnings / discipline** | Formal warning system in rules | None | ❌ | v3+ |
| **Auth / account** | Personal cabinet | Firebase auth + profile | ✅ | `AuthForm.js`, `auth-context.js`, `ProfileForm.js` |
| **Rating** | Lobby rating considered for placement | `ratings`, stars, rank snapshots | 🟢 | `Leaderboard.js`, `api.js`, bracket rating updates |
| **Game history** | Per-player season matches | Global HoMM3 game log + filters | 🟢 | `Heroes3.js` |
| **Castle / meta stats** | Not prominent on public pages | Castle win rates, in-progress highlight | 🟢 | `Heroes3Stats.jsx` |
| **Videos / VOD** | Stream links on matches (implied) | `Videos.js` YouTube-style list | ⚠️ | `Videos.js` |
| **Coins / gamification** | None visible | Coins, registration bonus, wheel | 🟢 | `coinTransactions.js`, `SpinningWheel.js`, `CartButton.js` |
| **Create tournament** | Organizer-run championship | Modal: kick-off, prizes, BO settings | ✅ | `ModalAddTournament.js`, `tournament_api.js` |
| **Production infra** | Custom domain, live data | `test-prod-app-81915` hardcoded in ~25+ files | ❌ blocker | `base.js`, `api.js`, all fetch sites |

### Parity score (rough)

| | h3ladder | You (today) |
|--|---------|-------------|
| **Season ladder UX** | Strong | Weak |
| **Tournament / bracket tooling** | Weak | Strong |
| **Player analytics** | Weak | Strong |
| **Community / funding** | Medium | Medium (coins > crypto clarity) |
| **Trust / production** | Strong | Weak (bugs + test Firebase) |

---

## 2. Recommended positioning (avoid head-on fight)

| h3ladder owns | You launch with |
|---------------|-----------------|
| Season 1, leagues, round-robin | **“Konoplay Cup”** — 16-player BO-3 KO, 2–4 weeks |
| Match schedule culture | **Discord/Telegram** for scheduling in v1; site shows “next matches” only |
| Official RU ladder narrative | **“Open cups + stats hub”** — honest subtitle, not “#1 ladder” |

---

## 3. V1 scope (ship in ~2–3 weeks)

**Goal:** One trustworthy public event + homepage that feels alive + prod backend.

### 3.1 Blockers (must do before any marketing)

| # | Task | Est. | Files |
|---|------|------|-------|
| B1 | Fix critical bracket bugs #1–#7 | ~2 h | `tournamentsBracket.js`, `ReportGameModal.js` — see `TOURNAMENT_ISSUES_ANALYSIS.md` |
| B2 | Centralize Firebase URL + env | ~3 h | **Create** `src/config/firebase.js`; update `base.js`, `api.js`, replace hardcoded URLs in components (grep `test-prod-app`) |
| B3 | Prod Firebase project OR rename rules on current project | ~2 h | Firebase console, `firebase.json`, `database.rules.json` |
| B4 | One brand everywhere | ~1 h | Pick **konoplay** OR **VK Gaming**; `MainHeader.js`, `StartingPageContent.js`, `public/manifest.json`, meta title |
| B5 | Security rules audit | ~2 h | `database.rules.json` — no public write on `users`, tournaments |

### 3.2 V1 features (in scope)

| Feature | Action | Files |
|---------|--------|-------|
| **Flagship cup** | Create “Konoplay Cup #1” via admin; 16 slots; BO-3 | `ModalAddTournament.js`, Firebase `tournaments/heroes3` |
| **Home = match center** | Top section: next 5 live/upcoming from active tournament; link to bracket | `StartingPageContent.js`, `.module.css` |
| **Tournaments page** | Default filter `started`; prominent registration cup | `Tournaments.js`, `Tournaments.module.css` |
| **Leaderboard** | Public, linked from home | `Leaderboard.js` |
| **Player profiles** | Re-enable nav “Players” → list or search → `/players/:id` | `App.js`, `MainHeader.js`, optional thin `PlayersList.js` or extend `Leaderboard.js` |
| **Report results** | Smoke-test BO-1 and BO-3 full tournament | `ReportGameModal.js`, `tournamentsBracket.js` |
| **Auth + profile** | Lobby nick field visible (like h3ladder); optional Telegram in profile | `ProfileForm.js` |
| **Donate / prize** | Show cup prize pool on home + tournament card | `DonatorsBar.js`, `modalDonate.js`, tournament `prize` fields |
| **Rules (minimal)** | One static “Cup rules” page (5–10 bullets, RU) | **New** `src/pages/RulesPage.js` + route in `App.js` |
| **Help / contact** | Telegram link visible | `modalHelp.jsx`, footer or header |

### 3.3 V1 — hide or defer (do not polish pre-launch)

| Feature | Why defer | Files (leave in repo, hide UI) |
|---------|-----------|--------------------------------|
| Spinning wheel | Nice for draws, not launch-critical | `SpinningWheel.js`, `Tournaments.js` |
| Multiple tournament types | Only kick-off works | `ModalAddTournament.js` |
| Videos | Empty hurts trust | Hide nav: `MainHeader.js`, `Videos.js` |
| Coin economy marketing | Confusing before cup prize story | Keep coins working; don’t homepage them |
| Admin panel extras | Use only internally | `AdminPanel.js` |
| graf_banner / graf_help | Non-HoMM3 | `graf_banner.jsx`, `graf_help.jsx` |
| Sensible World / Civ routes | Commented already | `App.js` |

### 3.4 V1 file checklist (edit order)

```
Week 1 — Trust
├── tournamentsBracket.js      # fixes #1–#7
├── ReportGameModal.js         # fix #4
├── src/config/firebase.js     # NEW — single DATABASE_URL
├── base.js                    # import config
├── api.js                     # replace hardcoded base URL
└── grep + replace in all components using firebaseio.com

Week 2 — Launch surface
├── StartingPageContent.js     # match hub hero
├── MainHeader.js              # brand, nav (Players, hide Videos)
├── App.js                     # /rules route
├── Tournaments.js             # registration CTA
├── ProfileForm.js             # telegram + lobby nick labels
└── public/index.html, manifest.json  # title, description

Week 3 — Event
├── Run Konoplay Cup #1 (manual organizer workflow)
├── Leaderboard.js             # verify after games
├── Players.js                 # verify links from bracket
└── DONATION_SYSTEM_README.md  # align prize story with UI
```

---

## 4. V2 scope (weeks 4–10, compete on ladder features)

| Feature | Purpose | New / touched files |
|---------|---------|---------------------|
| **Player list + search** | Parity with h3ladder `/players` | New `PlayersList.js`, `App.js` route `/players` |
| **Per-match schedule** | `scheduledAt`, `reportedBy` on pair | `tournamentsBracket.js` data shape, `PlayerBracket.js`, home feed |
| **Round-robin “league” phase** | Optional phase before playoffs | `tournament_api.js`, `ModalAddTournament.js`, new `leaguePhase.js` |
| **Points table** | Wins/draws/losses per league group | New component `LeagueStandings.js` |
| **Season entity** | `seasons/2026-s1` wrapping tournaments | Firebase schema + `Tournaments.js` |
| **Application workflow** | User applies; admin approves | `ProfileForm.js`, `Tournaments.js`, status `pending` |
| **Prize pool page** | Public `/support` like h3ladder | New `SupportPage.js` from `modalDonate` content |
| **Automated rating snapshots** | Weekly rank history | `api.js` `snapshotLeaderboardRanks` (already exists) |
| **Stream link on match** | Twitch URL field | `ReportGameModal.js` or pair object |
| **Email / Telegram bot reminders** | Optional | `functions/` Cloud Functions |

---

## 5. V3+ (only if V1 cup retains players)

- Full **season ladder** (Top / A / B) with promotion rules  
- **Warnings / discipline** log for admins  
- **Double elimination** bracket type  
- **h3.gg-style** multi-organizer SaaS  
- i18n EN/RU  

---

## 6. Week-by-week timeline

| Week | Focus | Success metric |
|------|--------|----------------|
| **1** | B1–B5 blockers | One test tournament completes with correct winner + ratings |
| **2** | V1 UI + `/rules` + prod deploy | Site on real domain, no `test-prod` in URL bar |
| **3** | **Konoplay Cup #1** registration | ≥12 players registered |
| **4** | Cup runs; fix bugs live | ≥8 matches reported on site |
| **5–6** | V2 player list + match times | Viewers can see upcoming times on home |
| **7–10** | V2 league phase OR monthly cup #2 | 30+ registered users total |

---

## 7. Konoplay Cup #1 — concrete spec (V1 event)

Use existing kick-off tournament; don’t build new format code.

| Field | Value |
|-------|--------|
| Name | `Konoplay Cup #1` |
| Format | 16 players, single elimination, BO-3 |
| Registration | 7 days, status `Registration` |
| Prizes | Display USD and/or coins in tournament + donate bar |
| Scheduling | Players arrange in Telegram; organizer posts times in Discord |
| Reporting | Both players can report; admin resolves disputes |
| Marketing | “Deep stats + fair brackets” vs “join the official league” |

**Firebase path:** `tournaments/heroes3/{cupId}`  
**Public URL:** `/tournaments/homm3/{cupId}`

---

## 8. h3ladder rules you can copy in spirit (not text) for your `/rules`

Short v1 rules page — link from header:

1. Register on site; profile nick = in-game lobby nick.  
2. Report results within 24h on the match card.  
3. BO-3: first to 2 map wins; castles/colors as recorded on site.  
4. Disputes: contact organizer on Telegram (link).  
5. No forfeits without notifying opponent + admin.  
6. Streams encouraged; VOD link optional in v2.  

(Full fair-play / anti-cheat text can wait for v2 season.)

---

## 9. Risk register

| Risk | Mitigation |
|------|------------|
| Wrong bracket results | Do not launch until B1 done + one full test cup |
| Players stay on h3ladder | Invite streamers to **cup**; cross-promote stats profiles |
| Test DB leaked / wiped | B2 + B3 before public URL |
| Scope creep | V1 nav max 5 items: Home, Cup, Games, Leaderboard, Profile |
| Empty videos page | Hide in v1 |

---

## 10. Quick reference — file → responsibility

| File | Role in launch |
|------|----------------|
| `App.js` | Routes: enable `/players`, add `/rules`, hide `/videos` |
| `MainHeader.js` | Nav, logo, brand |
| `StartingPageContent.js` | V1 homepage / match hub |
| `Tournaments.js` | Cup list, registration, admin add player |
| `tournamentsBracket.js` | Bracket render, ratings, game history — **critical path** |
| `ReportGameModal.js` | Player reporting |
| `PlayerBracket.js` | Per-match UI in bracket |
| `Leaderboard.js` | Public rankings |
| `Players.js` | Profile depth — marketing differentiator |
| `Heroes3.js` | Global match history |
| `Heroes3Stats.jsx` | Castle meta — differentiator |
| `AuthForm.js` / `ProfileForm.js` | Accounts |
| `ModalAddTournament.js` | Create cup |
| `api.js` | All server logic — centralize URL here first |
| `base.js` | Firebase init |
| `modalDonate.js` / `DonatorsBar.js` | Funding story |
| `TOURNAMENT_ISSUES_ANALYSIS.md` | Pre-launch bug list |
| `database.rules.json` | Security before prod |

---

*Update this doc after Cup #1 with real retention numbers and parity gaps discovered in production.*
