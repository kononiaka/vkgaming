# Future Todo: CS-Style Swiss To Playoffs

Goal: add a second Swiss tournament mode inspired by CS:GO / Counter-Strike Swiss events. Players do not play a fixed number of rounds. Instead, the Swiss phase continues until each player either qualifies with 3 wins or is eliminated with 3 losses, then qualified players enter a playoff bracket.

This should be a new format option, not a replacement for the current fixed-round Swiss mode.

## Format Summary

Recommended UI label:

`CS Swiss to Playoffs`

Core rules:

- A player qualifies after reaching `3 wins`.
- A player is eliminated after reaching `3 losses`.
- Active players are paired only while their record is between those limits.
- Swiss rounds continue until there are enough qualified players for playoffs and no undecided active players remain.
- Existing fixed-round Swiss should continue to work unchanged.

Suggested qualification model for 8 players:

| Final Swiss Record | Outcome |
| --- | --- |
| `3-0` | Directly seeded into semi-final |
| `3-1` | Seeded into quarter-final |
| `3-2` | Seeded into quarter-final |
| `0-3`, `1-3`, `2-3` | Eliminated |

Expected 8-player playoff shape:

- Two `3-0` players receive semi-final slots.
- Four `3-1` / `3-2` players play quarter-finals.
- Quarter-final winners face the `3-0` players in semi-finals.
- Final and third-place match reuse the current knockout flow.

For 16 players, use the same principle but define the playoff size explicitly before implementation:

- Option A: top 8 qualify, with `3-0` and best `3-1` players seeded highest.
- Option B: top 6 qualify, with `3-0` players receiving byes.

Pick one 16-player model before coding to avoid ambiguous bracket generation.

## Swiss Pairing Rules

Pair active players by current record bucket:

- `2-0` vs `2-0`
- `1-1` vs `1-1`
- `0-2` vs `0-2`
- `2-1` vs `2-1`
- `1-2` vs `1-2`

Additional rules:

- Avoid rematches whenever possible.
- If a record bucket has an odd number of players, float one player to the nearest compatible bucket.
- Do not pair already-qualified players.
- Do not pair already-eliminated players.
- Do not create BYE rows for even real-player fields.
- BYE should only exist if the real active-player count is odd and no valid opponent exists.

Recommended pairing priority:

1. Same record and no rematch.
2. Same record with rematch only if unavoidable.
3. Adjacent record bucket with no rematch.
4. Adjacent record bucket with rematch only as a last resort.
5. BYE only for odd active-player count.

## State Model

Add explicit Swiss progression data instead of inferring everything from round count:

```js
{
  swissMode: 'fixed-rounds' | 'cs-to-playoffs',
  swissWinTarget: 3,
  swissLossLimit: 3,
  swissPhase: 'swiss' | 'playoffs' | 'finished',
  playoffQualifierRules: {
    directSemiFinalRecords: ['3-0'],
    quarterFinalRecords: ['3-1', '3-2']
  }
}
```

Each standings row should be able to expose:

```js
{
  name,
  wins,
  losses,
  record: '2-1',
  swissStatus: 'active' | 'qualified' | 'eliminated',
  qualificationRecord: '3-0' | '3-1' | '3-2' | null
}
```

## Playoff Generation

When the Swiss phase is complete:

1. Collect all players with `3 wins`.
2. Split them by final Swiss record.
3. Seed `3-0` players directly into semi-final slots.
4. Seed `3-1` and `3-2` players into quarter-final slots.
5. Generate normal knockout match objects using the existing match shape:
   - `team1`
   - `team2`
   - `stage`
   - `games`
   - `type`
   - ratings/stars fields
6. Save playoff stages into `bracket/playoffPairs`.
7. Switch the tournament view from Swiss schedule to knockout bracket.

For 8 players, a likely bracket structure is:

```text
Quarter-final
  QF1: 3-1 seed vs 3-2 seed
  QF2: 3-1 seed vs 3-2 seed

Semi-final
  SF1: 3-0 seed vs QF winner
  SF2: 3-0 seed vs QF winner

Third Place
  SF losers

Final
  SF winners
```

## Optional Loser Bracket

Loser bracket should not be part of the Swiss phase by default.

Reason:

- The Swiss phase already has an elimination rule: `3 losses = eliminated`.
- Adding a loser bracket during Swiss would conflict with record buckets and make qualification unclear.
- CS-style Swiss normally uses Swiss as the elimination stage, then playoffs as a separate phase.

If loser bracket is enabled, define it as a playoff-only variant after Swiss qualification:

- Swiss phase remains unchanged.
- Qualified players enter a double-elimination playoff bracket.
- Players eliminated during Swiss do not enter the loser bracket.
- Reuse existing loser bracket helpers where possible.

Recommended option label:

`CS Swiss to Double-Elim Playoffs`

Implementation note:

- Reuse `src/components/tournaments/homm3/loserBracketUtils.js` for playoff bracket generation and promotion.
- Keep Swiss qualification logic independent from loser bracket logic.
- Do not mix Swiss record status with loser-bracket status.

## UI Requirements

Tournament creation:

- Add a tournament format option for `CS Swiss to Playoffs`.
- Keep current `Swiss` as fixed-round Swiss.
- Add optional playoff type:
  - `Single elimination playoffs`
  - `Double elimination playoffs`

Tournament page:

- Show Swiss phase progress as active records, not only `round X of Y`.
- Show each player status:
  - Active
  - Qualified
  - Eliminated
- Show record buckets, for example:
  - `2-0`
  - `1-1`
  - `0-2`
- Replace `Finish Swiss` with `Start Playoffs` when all qualification decisions are complete.

Standings:

- Continue showing W/L form badges.
- Add status badge or text for qualified/eliminated players.
- Sort by:
  1. Qualified before active before eliminated.
  2. Wins descending.
  3. Losses ascending.
  4. Head-to-head if applicable.
  5. Name fallback.

## Implementation Checklist

Core utilities:

- Add CS Swiss helpers to `src/components/tournaments/homm3/swissUtils.js`.
- Add `computeCsSwissStandings`.
- Add `getCsSwissPlayerStatus`.
- Add `isCsSwissComplete`.
- Add `generateNextCsSwissRoundPairings`.
- Add `generateCsSwissPlayoffStages`.

Tournament orchestration:

- Update `src/components/tournaments/homm3/tournamentsBracket.js`.
- Track `swissMode`, `swissWinTarget`, `swissLossLimit`, and `swissPhase`.
- Generate next Swiss round only from active players.
- Add `Start Playoffs` action when CS Swiss is complete.
- Save playoff stages into existing bracket data shape.

Creation UI:

- Update `src/UI/modalAddTournament/ModalAddTournament.js`.
- Add a format option for CS Swiss.
- Add optional playoff mode selection if loser bracket is supported.

Display:

- Update `src/components/tournaments/homm3/LeagueBracket.js`.
- Add player status display for CS Swiss standings.
- Ensure schedule view hides or separates qualified/eliminated players.

Tests:

- Extend `src/__tests__/tournamentFormats.e2e.test.js`.
- Add 8-player CS Swiss flow.
- Add 16-player CS Swiss flow after choosing the exact qualifier model.
- Add rematch avoidance tests.
- Add odd active-player bucket tests.
- Add playoff generation tests.
- Add double-elimination playoff variant tests if enabled.

## Edge Cases

- A player reaches `3-0` before other players finish.
- Multiple odd record buckets in the same round.
- Rematch is unavoidable.
- A stale `BYE` exists in Firebase data.
- Existing fixed-round Swiss tournaments must not change behavior.
- Admin re-reports a match and changes a player from qualified back to active.
- Tournament has more or fewer qualifiers than the selected playoff bracket expects.

## Suggested Rollout

1. Implement CS Swiss standings/status calculation only.
2. Add next-round generation for active players.
3. Add UI labels for active/qualified/eliminated.
4. Add `Start Playoffs` for 8-player single-elimination playoffs.
5. Add 16-player model after 8-player flow is stable.
6. Add optional double-elimination playoffs.
