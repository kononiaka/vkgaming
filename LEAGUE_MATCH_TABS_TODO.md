# League Match Tabs Todo

## Goal

Add h3ladder-style match navigation to league-style tournament schedule pages.

The tournament page should let users switch between:

- Schedule by rounds/tours
- Upcoming matches
- Last games / finished matches

This should make league pages easier to use because players can quickly find what is next and review recently completed games without browsing every round manually.

## Current State

The app already has most of the data needed:

- League and Swiss schedule matches live in `bracket.playoffPairs`.
- Each match pair can include `scheduledAt`, `winner`, `score1`, `score2`, `type`, `round`, `games`, and player names.
- Shared live/upcoming helpers exist in `src/utils/matchCenterData.js`.
- `src/components/tournaments/homm3/LeagueBracket.js` currently shows matches grouped by round/day.
- Live Arena already separates live and upcoming fixtures, but tournament league pages do not yet have separate upcoming/finished tabs.

## Desired UX

In `LeagueBracket`, extend the schedule area with three match views:

- `Schedule`
  - Current round/day grouped schedule.
  - Preserve the existing day navigation.
- `Upcoming`
  - All unfinished matches that are not live.
  - Future scheduled matches should appear first.
  - Unscheduled matches can appear after scheduled matches.
- `Last Games`
  - Finished matches only.
  - Most recent finished games should appear first.

The existing `Schedule` and `Standings` top-level tabs can remain. This new control should live inside the `Schedule` tab.

## Match Classification

A match is finished when:

- `pair.winner` exists and is not `TBD`.

A match is live when:

- Use `isPairLive(pair)` from `src/utils/matchCenterData.js`.

A match is upcoming when:

- The match is not finished.
- The match is not live.
- The match has a future `scheduledAt`.

A match is unscheduled upcoming when:

- The match is not finished.
- The match is not live.
- The match has no valid `scheduledAt`.

## Sorting Rules

Upcoming matches:

1. Future scheduled matches sorted by nearest date first.
2. Unscheduled matches last.
3. Within the same date bucket, sort by round and then original pair index.

Last games:

1. If a completion timestamp exists later, sort by newest completion time first.
2. Otherwise sort by `scheduledAt` newest first.
3. If no schedule date exists, sort by round descending and then pair index descending.

## Implementation Notes

Primary file:

- `src/components/tournaments/homm3/LeagueBracket.js`

Likely CSS file:

- `src/components/tournaments/homm3/LeagueBracket.module.css`

Recommended approach:

1. Keep the existing round/day schedule behavior intact.
2. Add local schedule sub-tab state, for example `rounds`, `upcoming`, and `finished`.
3. Extract the match row render logic into a helper so all views reuse the same UI.
4. Build derived lists with `useMemo`:
   - `upcomingMatches`
   - `finishedMatches`
5. Preserve existing row features:
   - Report/Edit button
   - Schedule control
   - BO badge
   - Head-to-head `?` button
   - Live dot
   - Prediction block
   - Highlight/deep-link scrolling
6. Add empty states:
   - `No upcoming matches.`
   - `No finished matches yet.`

## Optional Data Improvement

Match reports currently may not have a reliable completion timestamp. If sorting last games by true completion time becomes important, add one of these fields when a match result is submitted:

- `completedAt`
- `reportedAt`
- `updatedAt`

This is not required for the first UI version. The first version can use `scheduledAt`, round, and pair index as fallback sorting.

## Acceptance Criteria

- League schedule pages have clear views for schedule by round, upcoming matches, and last games.
- Upcoming matches show scheduled future matches first.
- Finished matches are accessible without switching through every round.
- Existing report, schedule, BO type, prediction, live dot, and head-to-head controls still work.
- Mobile layout remains usable.
- No scoring or tournament progression logic changes are introduced by this UI task.
