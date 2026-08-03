# Tournament-Specific Meta

**Status:** v1 implemented in code  
**Goal:** Show castle win rates scoped to one tournament, compared with global HotA Meta — a differentiator vs hh.gg / HotAMeta / Challonge / h3ladder.

Example: “On Streamers Tournament #3 Castle X is 80% WR, HotA Meta shows 48%.”

---

## Done in code

- [x] Aggregation util: [`src/utils/tournamentMetaStats.js`](src/utils/tournamentMetaStats.js)
  - Normalize bilingual castle names (`Castle-Замок` → `Castle`, Bulwark → Kronverk)
  - Collect maps from live bracket pairs (flat or staged) + `/games/heroes3` filtered by `tournamentId`
  - Deduplicate, skip draws / incomplete castles
  - Merge with HotA faction win rates (`Δ` vs cup WR)
- [x] UI: [`src/components/tournaments/homm3/TournamentMeta/TournamentMeta.js`](src/components/tournaments/homm3/TournamentMeta/TournamentMeta.js)
  - Cup WR / HotA WR / delta table, sample-size note
- [x] League / Swiss / CL groups: **Meta** tab next to Schedule / Standings in [`LeagueBracket.js`](src/components/tournaments/homm3/LeagueBracket.js)
- [x] Knockout cups: **Bracket | Meta** switch in [`tournamentsBracket.js`](src/components/tournaments/homm3/tournamentsBracket.js)

---

## How it works (v1)

1. Prefer live `playoffPairs` games (updates as soon as a map is reported).
2. Also load `/games/heroes3` and keep rows with matching `tournamentId`.
3. Merge + dedupe; compare each castle to HotA Meta via `fetchHotaFactions`.

No new Firebase schema. `isTournamentMetaLoading` in the bracket shell is still **tournament config** loading (format flags), not this feature.

---

## Follow-ups (not done)

- [ ] Phase 2: persist counters under `/statistic/heroes3/tournaments/{id}/castles` on report (avoid full game-log scan on large DBs)
- [ ] Pick/ban or template filters when cup has special rules (e.g. banned Conflux, template-only)
- [ ] Highlight “meta outliers” (large Δ with enough games) on Match Center / announcements
- [ ] Min-sample gate (e.g. hide WR until N≥5) as a hard filter instead of soft note

---

## Manual QA

1. Open a league/Swiss cup → **Meta** tab → empty state if no maps yet.
2. Report a finished map with castles → Meta updates (bracket + game log).
3. Confirm HotA WR column fills when HotA Meta API is up; notice when it fails.
4. Open a classic knockout cup → **Meta** next to Bracket; rates include all stages.
5. Champions League: Meta uses all `playoffPairs` stages, not only the active group filter.
