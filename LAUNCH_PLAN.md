# Konoplay HoMM3 — Product positioning (slim)

**Updated:** July 23, 2026  
**Competitor:** [h3ladder.ru](https://h3ladder.ru) (season ladder)  
**Wedge:** Open cups + deep stats + community funding — not “clone their league” on day one.

For domain / OAuth / hosting deploy work, use **`LAUNCH_KONOPLAY_COM.md`** instead.

---

## Positioning

| h3ladder owns | Konoplay launches with |
|---|---|
| Season tiers, tours, round-robin culture | **Cups + formats** (kick-off, league, Swiss, CS Swiss, Champions League, double-elim) |
| Official RU ladder narrative | **Open cups + stats hub** — honest subtitle, not “#1 ladder” |
| Match schedule culture | Site scheduling where built; Discord/Telegram for disputes |

**You’re ahead on:** visual brackets, player analytics (castles, opponents, gold, restarts, stars), coins/gamification, multi-format tournament tooling.

---

## Shipped (do not re-plan)

- Knockout + league + Swiss + CS Swiss to playoffs + Champions League (single + two group stages) + double-elim
- Match reporting, BO series, ratings / stars
- `/support`, `/rules`, donations (DA + Mono; Stripe “coming soon”)
- Player profiles, leaderboard, home match hub pieces

Remaining feature tickets:

- `LEAGUE_MATCH_TABS_TODO.md` — Upcoming / Last Games on league schedule
- `TELEGRAM_DYNAMIC_IMAGES_TODO.md` — per-match Telegram image cards
- `BMC_NICKNAME_MATCHING_TODO.md` — Buy Me a Coffee auto-credit (match Profile donation name, same as DA)

---

## Still open vs h3ladder (product gaps)

| Gap | Notes |
|---|---|
| **Season ladder tiers** (Top / A / B) + promotion/relegation | New data model — not a tournament-type tweak |
| **Season entity** wrapping cups | e.g. `seasons/2026-s1` |
| **Formal warnings / discipline** | Rules + admin log |
| **Streaming enforcement** | Twitch/VOD requirements in Top League style |
| **Application workflow** | User applies → admin approves (vs add/register flows you have) |
| **i18n EN/RU** | Optional later |
| **Multi-organizer SaaS** (h3.gg-style) | Out of scope near-term |

---

## Event template (when running a public cup)

| Field | Typical value |
|---|---|
| Format | 16-player kick-off (or CS Swiss / CL as preferred) |
| Reporting | Players report; admin resolves disputes |
| Marketing angle | “Deep stats + fair brackets” vs “join the official league” |

---

*Keep this file short. Put deploy checklists in `LAUNCH_KONOPLAY_COM.md` and feature work in the TODO files above.*
