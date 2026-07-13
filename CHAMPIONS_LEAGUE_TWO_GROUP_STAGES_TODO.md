# Future Todo: Champions League — Two Group Stages (UCL 2000–01 Style)

Goal: add a Champions League variant inspired by the **1999–2000 through 2002–03 UEFA Champions League** format — two consecutive round-robin group phases before knockouts — while keeping the current single-group Champions League format unchanged.

Reference format (2000–01 season):

1. **First group stage** — 32 teams, 8 groups of 4, top 2 advance (16 teams)
2. **Second group stage** — 16 teams, 4 groups of 4, top 2 advance (8 teams)
3. **Knockouts** — quarter-finals → semi-finals → final (no round of 16)

This should be a **separate tournament option** or an explicit sub-mode, not a silent change to existing `champions-league` tournaments already in Firebase.

---

## Current State (What Exists Today)

The app already implements **single group stage → knockout**:

| Area | Current behavior |
| --- | --- |
| Tournament type | `champions-league` in `ModalAddTournament.js` |
| Player counts | 8, 16, or 32 (`CHAMPIONS_LEAGUE_SIZES`) |
| Group structure | `maxPlayers / 4` groups, top 2 per group advance |
| Core logic | `src/components/tournaments/homm3/championsLeagueUtils.js` |
| Phase tracking | Firebase `championsLeaguePhase`: `'group'` \| `'knockout'` |
| Bracket storage | `bracket/playoffPairs[0]` = all group matches; `[1..n]` = knockout rounds |
| Group rosters | Firebase `groups.json` |
| Start flow | `Tournaments.js` → `handleStartChampionsLeague` / wheel draw |
| Transition | `tournamentsBracket.js` → `handleStartChampionsKnockout` (admin button when group complete) |
| Knockout seeding | `pairKnockoutQualifiers` — winner vs runner-up from different first-stage groups |
| Schedule UI | `LeagueBracket` schedule view while `championsLeaguePhase !== 'knockout'` |
| Tests | `src/__tests__/tournamentFormats.e2e.test.js` (Champions League section) |

Key functions to extend (do not break existing exports):

- `prepareChampionsLeagueGroupStage`
- `generateChampionsLeagueGroupPairs`
- `computeGroupStandings` / `getQualifiedPlayers`
- `isChampionsLeagueGroupStageComplete`
- `generateKnockoutBracketStages` / `pairKnockoutQualifiers`
- `handleStartChampionsKnockout` in `tournamentsBracket.js`

---

## Target Format Summary

### Recommended UI label

`Champions League (Two Group Stages)`

Alternative: keep one `champions-league` type and add a checkbox `Two group stages (classic UCL)`. Pick one approach in **Decision 1** below and stick to it everywhere.

### Scaled player counts

Authentic UCL used **32 → 16 → 8**. Map to existing size options:

| `maxPlayers` | 1st group stage | 2nd group stage | Knockout entrants | First knockout round |
| --- | --- | --- | --- | --- |
| **32** | 8 groups × 4 → **16** | 4 groups × 4 → **8** | 8 | Quarter-final |
| **16** | 4 groups × 4 → **8** | 2 groups × 4 → **4** | 4 | Semi-final |
| **8** | 2 groups × 4 → **4** | 1 group × 4 → **2** | 2 | Final only (no SF/QF) |

**Recommendation:** Support **32 and 16** for v1. Treat **8 players** as out of scope unless product explicitly wants a single final decider after one mini-group — document as Decision 2.

### Second-group draw rules (UCL-style)

When first group stage completes, build second groups from qualifiers:

- Each second-group contains **2 first-stage group winners + 2 first-stage group runners-up**
- **Constraint:** no two players from the **same first-stage group** in the same second-stage group
- Optional future constraint: “country” / clan — not needed for HOMM3 v1

Seeding pots (recommended):

1. **Pot 1** — four best first-stage group winners (by points, then tiebreakers)
2. **Pot 2** — remaining four first-stage group winners
3. **Pot 3** — four best first-stage runners-up
4. **Pot 4** — remaining four first-stage runners-up

Draw procedure (32-player case):

- One team from each pot per second-group (A, B, C, D)
- After each pick, exclude candidates that violate the same-first-group constraint
- If stuck, backtrack or fall back to deterministic assignment (see tests)

For **16-player** case (2 second groups): each group gets 1 winner + 1 winner + 1 runner-up + 1 runner-up from four distinct first-stage groups.

---

## Design Decisions (Resolve Before Coding)

### Decision 1 — Tournament type identity

**Option A (recommended):** New type value `champions-league-2gs`  
- Clear separation in Firebase, tests, and UI  
- Existing `champions-league` tournaments untouched  

**Option B:** Flag on existing type: `championsLeagueFormat: 'single' | 'two-group'`  
- One type in dropdown, more branching everywhere  

### Decision 2 — Minimum player count

- **Option A:** Only 32 (full UCL fidelity)
- **Option B:** 32 + 16 (recommended)
- **Option C:** 8 + 16 + 32 (8-player path is awkward — see table above)

### Decision 3 — Second group draw UX

- **Option A:** Automatic draw on admin “Start second group stage” (with confirm summary)
- **Option B:** Spinning wheel for second stage (like first stage) — more work, nicer ceremony
- **Option C:** Manual admin assignment UI — defer

**Recommendation:** Option A for v1; reuse wheel in v2 if desired.

### Decision 4 — Group label strategy

First and second stages both use letters A–H / A–D. Avoid collisions:

- Store `groupPhase: 1 | 2` on each match pair **or**
- Use composite labels in `pair.stage`: `Group A (Stage 1)` / `Group A (Stage 2)` **or**
- Second-stage groups in Firebase as `groups2.json` with labels A–D independent of first stage

**Recommendation:** `groupPhase` field on pairs + separate `groups` / `groups2` Firebase objects.

### Decision 5 — Knockout seeding after second group

Current `pairKnockoutQualifiers` pairs first-stage winners vs other groups’ runners-up. After **two** group stages, knockouts should seed from **second-stage** standings only:

- Collect top 2 from each **second-stage** group
- Pair for first knockout round using the same cross-group logic (winner vs runner-up from different second-stage groups)
- **Do not** use first-stage group identity in knockout seeding

### Decision 6 — Third place in group stages

UCL had no third-place playoff from groups (3rd went to UEFA Cup). For HOMM3:

- **Option A:** 3rd/4th in groups are simply eliminated (recommended)
- **Option B:** Consolation bracket — out of scope

---

## State Model

### Firebase fields (new / extended)

```js
{
  type: 'champions-league-2gs',           // or champions-league + format flag
  championsLeagueFormat: 'two-group',       // if using Decision 1B
  championsLeaguePhase: 'group1' | 'group2' | 'knockout',
  groupSize: 4,
  qualifiersPerGroup: 2,
  groups: { A: [...], B: [...], ... },    // first-stage rosters
  groups2: { A: [...], B: [...], ... },   // second-stage rosters (after transition)
  firstStageQualifiers: [                 // optional cache for UI / draw audit
    { name, group, place, points, groupPhase: 1 }
  ],
  bracket: {
    playoffPairs: [
      /* [0] first group stage matches */,
      /* [1] second group stage matches */,
      /* [2..] knockout rounds */
    ]
  },
  stageLabels: ['Quarter-final', 'Semi-final', 'Third Place', 'Final']  // after group2, size 8
}
```

### Phase transitions

```text
Registration finished
    → admin starts tournament
    → championsLeaguePhase = 'group1'
    → playoffPairs = [ group1Matches ]

group1 complete + admin confirms
    → run second-group draw
    → championsLeaguePhase = 'group2'
    → playoffPairs = [ group1Matches, group2Matches ]
    → persist groups2

group2 complete + admin confirms
    → championsLeaguePhase = 'knockout'
    → playoffPairs = [ group1Matches, group2Matches, ...knockoutStages ]
    → stageLabels = setStageLabels(knockoutSize)  // 8 for 32-player, 4 for 16-player
```

### Backwards compatibility

Existing tournaments use `championsLeaguePhase: 'group'`. Treat `'group'` as `'group1'` for single-stage format only. New two-group tournaments must never write bare `'group'`.

---

## Bracket Storage Layout

### Two-group format (32 players)

```text
playoffPairs[0]  → 96 matches (8 groups × 6 round-robin pairs)
playoffPairs[1]  → 24 matches (4 groups × 6 round-robin pairs)
playoffPairs[2]  → 4 quarter-final pairs
playoffPairs[3]  → 2 semi-final pairs
playoffPairs[4]  → 1 third-place pair
playoffPairs[5]  → 1 final pair
```

Each group match object should include:

```js
{
  group: 'B',
  groupPhase: 1,              // NEW — 1 or 2
  stage: 'Group B',           // or 'Group B (Stage 2)' if no groupPhase in UI
  round: 1,                   // matchday within group
  team1, team2, games, winner, type, ...
}
```

### `getScheduleStageOffset` / navigation

Today (`tournamentsBracket.js`):

- When `championsLeaguePhase === 'knockout'`, offset = 1 (skip `playoffPairs[0]` for knockout stage label indexing)

For two-group format:

- `'group1'` → schedule view shows `playoffPairs[0]`
- `'group2'` → schedule view shows `playoffPairs[1]` (optionally allow tabs/back to group1 results)
- `'knockout'` → offset = **2** (skip both group arrays)

Update:

- `getScheduleStageOffset` in `tournamentsBracket.js`
- `inferScheduleView` in `src/utils/tournamentBracketNavigation.js`
- Knockout “← back to groups” nav — may need two-step back: knockout → group2 → group1 (mirror CS Swiss → standings pattern)

---

## Core Logic — `championsLeagueUtils.js`

Add new exports (keep all existing exports working for single-stage CL):

### Constants

```js
export const CHAMPIONS_LEAGUE_TWO_GROUP_SIZES = [16, 32]; // per Decision 2
export const isChampionsLeagueTwoGroupSize = (n) => ...
export const getSecondGroupCount = (maxPlayers) => getChampionsLeagueGroupCount(maxPlayers) / 2;
export const getKnockoutPlayerCountTwoGroup = (maxPlayers) =>
    getSecondGroupCount(maxPlayers) * CHAMPIONS_LEAGUE_QUALIFIERS_PER_GROUP;
```

For 32 players: `getKnockoutPlayerCountTwoGroup(32) === 8` (not 16).

### First stage

Reuse as-is:

- `prepareChampionsLeagueGroupStage`
- `generateChampionsLeagueGroupPairs` — add optional `{ groupPhase: 1 }` on generated pairs

### Second stage draw

New functions:

```js
export const buildSecondGroupDrawPots = (qualifiers) => { ... }
export const assignQualifiersToSecondGroups = (qualifiers, options = { shuffle: true }) => { ... }
export const validateSecondGroupAssignment = (groups2, qualifiers) => { ... }
export const prepareChampionsLeagueSecondGroupStage = (firstStageQualifiers, tournamentData, options) => { ... }
```

`assignQualifiersToSecondGroups` algorithm sketch:

1. Split qualifiers into winners (`place === 1`) and runners-up (`place === 2`), each tagged with `firstGroup`
2. Sort winners and runners into pots by points / tiebreakers
3. For each second-group slot (0..groupCount-1):
   - Pick one from each pot such that no two share the same `firstGroup`
4. Return `{ groups2, validation }`

### Completion checks

```js
export const isChampionsLeagueFirstGroupStageComplete = (pairs) =>
    pairs.filter(p => p.groupPhase === 1 || !p.groupPhase).every(p => p.winner);

export const isChampionsLeagueSecondGroupStageComplete = (pairs) =>
    pairs.filter(p => p.groupPhase === 2).every(p => p.winner);
```

For backwards compat, pairs without `groupPhase` count as phase 1.

### Qualifiers from second stage

```js
export const getQualifiedPlayersFromSecondStage = (groups2, allPairs, scoringMode) => {
    const group2Pairs = allPairs.filter(p => p.groupPhase === 2);
    // reuse computeGroupStandings per group2 label
};
```

### Knockout generation

Either:

- Add parameter to `generateKnockoutBracketStages(qualifiers, knockoutSize, ...)` — already generic; pass second-stage qualifiers + `getKnockoutPlayerCountTwoGroup(maxPlayers)`
- Or new wrapper `generateTwoGroupKnockoutBracketStages(...)`

Verify `setStageLabels` in `tournament_api.js` supports knockout sizes **8 and 4** (already does).

---

## UI Requirements

### Tournament creation — `ModalAddTournament.js`

- [ ] Add format option (Decision 1)
- [ ] Player count dropdown text: e.g. `32 players (8→4 groups, top 2 each stage)`
- [ ] Persist `championsLeagueFormat` and initial `championsLeaguePhase: 'group1'`
- [ ] Reuse existing group match type + separate knockout match type fields
- [ ] Update validation messages in `validateChampionsLeagueRegistration` (or parallel validator)

### Tournament list — `Tournaments.js`

- [ ] Recognize new type for start buttons, wheel mode, registration lock
- [ ] `persistChampionsLeagueGroupStage` — set phase `'group1'` (not `'group'`)
- [ ] Alert copy: “8 groups of 4 — top 2 advance to second group stage”

### Bracket page — `tournamentsBracket.js`

- [ ] Load `groups2.json` when phase is `group2` or `knockout`
- [ ] Phase-aware banner text:
  - group1: “First group stage — top 2 per group advance”
  - group2: “Second group stage — top 2 per group advance to knockout”
  - knockout: “Knockout stage — second group results”
- [ ] Admin button when group1 complete: **“Start second group stage”** → `handleStartChampionsSecondGroup`
- [ ] Admin button when group2 complete: **“Start knockout stage”** → adapt `handleStartChampionsKnockout`
- [ ] Schedule view during group2 should show **second-stage** pairs (`playoffPairs[1]`), not first
- [ ] Optional: tab or toggle to view frozen first-stage standings while in group2/knockout
- [ ] Knockout nav “back to groups” — show group2 standings by default; link to group1 archive

### Spinning wheel — `SpinningWheel.js`

- [ ] v1: no change (first-stage draw only)
- [ ] v2 optional: second mode `champions-league-2gs-draw2` for ceremonial second draw

### Match labels — `matchFixtureLabels.js`

- [ ] When `groupPhase === 2`, label e.g. `Group B (II)` or `Group B · Stage 2`
- [ ] Update `buildMatchStageLabel` tests

### Stats / reporting

- [ ] Confirm `ReportGameModal` and game reporting paths use correct `stageIndex` when group2 matches live in `playoffPairs[1]`
- [ ] URL deep links (`?stage=&pair=`) — verify stage index 1 addresses group2 matches

---

## Implementation Checklist by File

### 1. `src/components/tournaments/homm3/championsLeagueUtils.js`

- [ ] Add two-group constants and size validators
- [ ] Add `groupPhase` to `generateChampionsLeagueGroupPairs`
- [ ] Implement second-group draw + validation
- [ ] Implement `prepareChampionsLeagueSecondGroupStage`
- [ ] Implement phase-specific completion helpers
- [ ] Implement `getQualifiedPlayersFromSecondStage`
- [ ] Add `getKnockoutPlayerCountTwoGroup` (or format-aware wrapper)
- [ ] Unit-test all new pure functions

### 2. `src/components/tournaments/homm3/tournamentsBracket.js`

- [ ] Extend `championsLeaguePhase` state: `'group1' | 'group2' | 'knockout'`
- [ ] Fetch `groups2.json` on load
- [ ] Implement `handleStartChampionsSecondGroup` (mirror `handleStartChampionsKnockout` structure)
- [ ] Update `handleStartChampionsKnockout` to branch on format (single vs two-group)
- [ ] Fix `getScheduleStageOffset` for two schedule arrays
- [ ] Update admin buttons (two transitions)
- [ ] Update schedule/knockout nav copy and back navigation
- [ ] Ensure game report / schedule save uses correct storage indices

### 3. `src/components/tournaments/homm3/Tournaments.js`

- [ ] Support new type in type checks (`isScheduleFormat`, wheel mode, etc.)
- [ ] Persist `'group1'` on initial start
- [ ] Update user-facing alerts

### 4. `src/UI/modalAddTournament/ModalAddTournament.js`

- [ ] New tournament type or format toggle
- [ ] Creation payload fields
- [ ] Player count options filtered by format

### 5. `src/utils/tournamentBracketNavigation.js`

- [ ] `inferScheduleView` — true for `group1` and `group2`, false for `knockout`
- [ ] Handle legacy `'group'` phase

### 6. `src/utils/matchFixtureLabels.js`

- [ ] Stage labels for `groupPhase`

### 7. `src/components/SpinningWheel/SpinningWheel.js`

- [ ] (Optional v2) second-stage draw support

### 8. Tests

- [ ] `src/__tests__/tournamentFormats.e2e.test.js` — new `describe('Champions League (two group stages)')` with:
  - 32-player: 8 groups → draw → 4 groups → 8 knockout qualifiers
  - Second-group constraint: no same first-group teammates
  - Pot ordering / deterministic draw with fixed RNG seed
  - 16-player scaled path
  - Bracket array shape `[group1, group2, ...knockout]`
  - Knockout first round size (QF for 32, SF for 16)
- [ ] `src/__tests__/tournamentBracketNavigation.test.js` — schedule view for `group1`, `group2`, `knockout`
- [ ] `src/__tests__/matchFixtureLabels.test.js` — second-stage group labels
- [ ] Regression: existing single-stage Champions League tests must still pass unchanged

### 9. Backend / Cloud Functions

- [ ] Search `functions/index.js` for `champions-league` or `championsLeaguePhase` — update if any server logic assumes single group
- [ ] Telegram notifications / match announcements — include stage number in labels if applicable

---

## Suggested Test Scenarios (Manual QA)

1. Create 32-player two-group CL, random draw, complete all group1 matches, start group2, verify 4 groups of 4 with no same-first-group conflicts
2. Complete group2, start knockout — verify 4 QF matchups cross second-stage groups
3. Deep-link to a group2 match (`stage=1`) — report result — verify standings update
4. Knockout view → “back to groups” → see group2 standings; optional view group1 archive
5. Open existing single-stage CL tournament — verify no regression
6. 16-player path: 4 → 2 → 2 groups → SF + Final

---

## Reference: Similar Pattern in Codebase

Use **CS Swiss → Playoffs** as the template for multi-phase transitions:

| CS Swiss | Two-group CL |
| --- | --- |
| `swissPhase: 'swiss' \| 'playoffs'` | `championsLeaguePhase: 'group1' \| 'group2' \| 'knockout'` |
| `handleStartCsSwissPlayoffs` | `handleStartChampionsSecondGroup` + `handleStartChampionsKnockout` |
| `playoffPairs[0]` = Swiss, `[1..]` = knockouts | `[0]` = group1, `[1]` = group2, `[2..]` = knockouts |
| Schedule view until playoffs | Schedule view until knockout |
| `getScheduleStageOffset` = 1 in playoffs | `getScheduleStageOffset` = 2 in knockout |

See: `CS_SWISS_TO_PLAYOFFS_TODO.md`, `handleStartCsSwissPlayoffs` in `tournamentsBracket.js` (~line 1650).

---

## Reference: Key Existing Code Locations

| File | Symbol / area |
| --- | --- |
| `championsLeagueUtils.js` | `prepareChampionsLeagueGroupStage`, `getQualifiedPlayers`, `generateKnockoutBracketStages` |
| `tournamentsBracket.js` | `handleStartChampionsKnockout` (~1708), admin button (~3916), schedule banner (~3823) |
| `Tournaments.js` | `persistChampionsLeagueGroupStage` (~1523), `handleStartChampionsLeague` (~1565) |
| `tournament_api.js` | `setStageLabels(maxPlayers)` — knockout round names |
| `ModalAddTournament.js` | tournament type options (~110), `championsLeaguePhase: 'group'` (~316) |

---

## Out of Scope (v1)

- Third-place match for group-stage eliminations
- Second-stage spinning wheel draw
- 8-player two-group format
- Double-elimination loser bracket
- Automatic phase advance without admin confirm
- UEFA Cup / consolation route for 3rd place in groups

---

## Implementation Order (Suggested)

1. Resolve Decision 1–4 in this doc (comment chosen options at top before coding)
2. Pure logic in `championsLeagueUtils.js` + unit tests
3. Firebase state + `tournamentsBracket.js` phase transitions
4. Tournament creation UI
5. Navigation, labels, reporting indices
6. Manual QA on 32- and 16-player paths
7. Optional: wheel draw for second stage
