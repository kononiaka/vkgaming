# Tournament H2H + pressure profile

**Status:** v1 implemented in code  
**Goal:** Differentiate from HotA Meta / lobby ranked by showing how two players actually play **in official cups**, plus each player’s signature castles under tournament pressure.

Examples:
- “Player A vs Player B in tournaments (2026): **3–1 by series**. A most often bans Citadel against them.”
- “Tournament profile: Castle X is A’s signature town in official matches (not lobby HotA).”

---

## Done in code

- [x] Aggregation: [`src/utils/tournamentHeadToHead.js`](src/utils/tournamentHeadToHead.js)
  - Series W–L from `/games/heroes3` + finished bracket pairs
  - Wide cup detection: `tournamentId` **or** `tournamentName` **or** legacy stage+castles
  - Year filter (current year + all-time)
  - Ban frequency from nested `games[].bannedCastles1/2`
  - Per-player tournament castle W/L (official maps only)
- [x] Wired into H2H fetch: [`src/utils/headToHeadStats.js`](src/utils/headToHeadStats.js) + hook
- [x] UI: tournament section in [`StatsPopup`](src/components/StatsPopup/StatsPopup.js) (series, bans, recent series)
- [x] Player profile: tournament signature castles in [`Players.js`](src/components/Players/Players.js)

---

## Data notes

- Cup matches come from `/games/heroes3` **plus** finished pairs in `/tournaments/heroes3` brackets (so older cups without `tournamentId` on the game log still count).
- A game-log row counts as a cup match if it has `tournamentId`, **or** `tournamentName`, **or** stage metadata with nested castles.
- Series winner = top-level `winner` / `score` (not map W–L).
- Ban insights only appear when reports stored `bannedCastles1/2` on maps; older matches may have none.
- Nickname matching uses the same candidates as existing H2H (`(demo)` strip).
- Game-log and bracket sources are deduped so the same series/map is not double-counted.

---

## Follow-ups (not done)

- [ ] Persist bans at match root if BO1 bans only live in progress and never land on game log
- [ ] Filter by specific cup / championship season (beyond calendar year)
- [ ] “Always bans X” confidence (e.g. ≥3 bans and ≥50% of series)
- [ ] Cache merged `/games/heroes3` + brackets scan (shared with Tournament Meta) for large DBs

---

## Manual QA

1. Open H2H on a bracket pair that has prior cup meetings → **Tournaments** block shows series score.
2. Pair with ban data in reports → ban line appears for one or both players.
3. Player profile with cup history → **Tournament castles** section + popup differs from ALL TIME when they also have non-cup games.
4. Players with only HotA / no cups → tournament block empty / soft message, ranked H2H still works.
