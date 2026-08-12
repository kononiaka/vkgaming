# Konoplay HoMM3 — Product positioning

**Updated:** August 4, 2026  
**Competitor:** [h3ladder.ru](https://h3ladder.ru) (season ladder)  
**Wedge:** Open cups + deep stats + community funding — not “clone their league” on day one.

Domain / OAuth / hosting: **`LAUNCH_KONOPLAY_COM.md`** (cutover **DONE**).

---

## Positioning

| h3ladder owns | Konoplay launches with |
|---|---|
| Season tiers, tours, round-robin culture | **Cups + formats** (kick-off, league, Swiss, CS Swiss, Champions League, double-elim) |
| Official RU ladder narrative | **Open cups + stats hub** |
| Match schedule culture | Site scheduling + Discord/Telegram |

**Ahead on:** visual brackets, player analytics (castles, opponents, gold, restarts, stars), donations / prize pools, multi-format tooling.

---

## Shipped (do not re-plan)

- Knockout + league + Swiss + CS Swiss to playoffs + Champions League + double-elim
- Match reporting, BO series, ratings / stars
- League schedule with round/day navigation (+ castle / gold / restarts on rows)
- Tournament-specific Meta tab; tournament H2H + profile castles
- `/support`, `/rules`, donations (DA + BMC + Stripe host seed / attendance)
- Admin prize-pool **funding history** (new tips logged under `prizePoolHistory`)
- Player profiles, leaderboard, Live Arena / match hub
- Production on **konoplay.com**

---

## Open product tickets

| Doc | Status |
|---|---|
| [`TELEGRAM_DYNAMIC_IMAGES_TODO.md`](TELEGRAM_DYNAMIC_IMAGES_TODO.md) | **Open** — per-match Telegram image cards |

---

## Future plans (not launch blockers)

### vs h3ladder (large bets)

| Gap | Notes |
|---|---|
| **Season ladder tiers** (Top / A / B) + promotion/relegation | New data model |
| **Season entity** wrapping cups | e.g. `seasons/2026-s1` |
| **Formal warnings / discipline** | Rules + admin log |
| **Streaming enforcement** | Twitch/VOD requirements |
| **Application workflow** | Apply → admin approve |
| **i18n EN/RU** | Optional later |
| **Multi-organizer SaaS** | Out of scope near-term |

### Feature follow-ups (from shipped v1)

**Tournament Meta**

- [x] Hard min-sample gate (hide Cup WR / Δ until N≥5 per castle)
- Persist castle counters under `/statistic/heroes3/tournaments/{id}/castles` on report
- Pick/ban or template filters for special cup rules
- Highlight meta outliers on Match Center / announcements

**Tournament H2H / profile**

- [x] Persist bans on report into durable `games[]` / game log (series + BO1)
- [x] Ban insight confidence (≥3 bans and ≥50% of maps → “often bans X”)
- Filter by specific cup / championship season
- Shared cache for `/games/heroes3` + brackets scan (with Meta)

**Prize pool / donations**

- Funding history only covers tips **after** the history deploy; older totals stay aggregate-only
- Optional: backfill or admin note when ledger sum ≠ `communityFundingUsd`

---

## Event template (public cup)

| Field | Typical value |
|---|---|
| Format | 16-player kick-off (or CS Swiss / CL) |
| Reporting | Players report; admin resolves disputes |
| Marketing | “Deep stats + fair brackets” |

---

*Keep this file short. Deploy reference → `LAUNCH_KONOPLAY_COM.md`. Active feature work → `TELEGRAM_DYNAMIC_IMAGES_TODO.md`.*
