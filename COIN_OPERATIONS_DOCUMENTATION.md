# Coin Operations Documentation

This document lists all places in the codebase where coins are awarded, deducted, or modified, and confirms they use the new coinTransactions module.

## Coin Operations Summary

### 1. **Daily Login Reward** ✅ USES TRANSACTION MODULE
- **Location:** `src/components/Auth/AuthForm.js` (Lines 166-193)
- **Amount:** +1 coin
- **When:** Once per day when player logs in
- **Transaction Type:** `daily_login`
- **Description:** "Daily login reward"
- **Status:** ✅ Using `addCoins()` from coinTransactions module

### 2. **Registration Reward** ✅ USES TRANSACTION MODULE
- **Location:** `src/components/Auth/AuthForm.js` (Line 37)
- **Amount:** +1 coin
- **When:** When new user registers
- **Transaction Type:** `registration`
- **Description:** "Registration bonus"
- **Status:** ✅ Using `addCoins()` from coinTransactions module

### 3. **Avatar Upload Reward** ✅ USES TRANSACTION MODULE
- **Location:** `src/components/Profile/ProfileForm.js` (Line 79)
- **Amount:** +1 coin
- **When:** First time user uploads an avatar
- **Transaction Type:** `avatar_upload`
- **Description:** "First avatar upload bonus"
- **Status:** ✅ Using `addCoins()` from coinTransactions module

### 4. **Tournament Creation Cost** ✅ USES TRANSACTION MODULE
- **Location:** `src/UI/modalAddTournament/ModalAddTournament.js` (Lines 108-137)
- **Amount:** -5 coins
- **When:** Player creates a new tournament
- **Transaction Type:** `tournament_creation`
- **Description:** "Tournament creation fee"
- **Metadata:** Includes tournament name, ID, maxPlayers, prizePool
- **Status:** ✅ Using `deductCoins()` from coinTransactions module

### 5. **Tournament Registration Reward** ✅ USES TRANSACTION MODULE
- **Location:** `src/components/tournaments/homm3/Tournaments.js` (Lines 124-153)
- **Amount:** +2 coins
- **When:** Player successfully registers for a tournament
- **Transaction Type:** `tournament_registration`
- **Description:** "Registered for tournament: {tournamentName}"
- **Metadata:** Includes tournamentId, tournamentName
- **Status:** ✅ Using `addCoins()` from coinTransactions module

### 6. **Tournament Prize Awards** ❌ NO COIN REWARDS (ONLY MONEY PRIZES)
- **Location:** `src/components/tournaments/homm3/tournamentsBracket.js`
  - 3rd Place: Lines 2145-2200
  - 1st Place: Lines 2235-2300
  - 2nd Place: Lines 2300-2370
- **Current Implementation:** Awards money prizes (totalPrize field), NOT coins
- **Prize Distribution:**
  - 1st Place: 60% of prize pool
  - 2nd Place: 30% of prize pool
  - 3rd Place: 10% of prize pool
- **Status:** These are MONEY prizes stored in `user.prizes` array and `user.totalPrize`, not coins
- **Note:** If you want winners to also receive coins, this needs to be added

## Summary Table

| Operation | Amount | Uses Transaction Module | Status |
|-----------|--------|------------------------|--------|
| Daily Login | +1 coin | ✅ Yes | ✅ Done |
| Registration | +1 coin | ✅ Yes | ✅ Done |
| Avatar Upload | +1 coin | ✅ Yes | ✅ Done |
| Tournament Creation | -5 coins | ✅ Yes | ✅ Done |
| Tournament Registration | +2 coins | ✅ Yes | ✅ Done |
| Tournament Prizes | $$ money | N/A | Optional |

## Actions Required

### ✅ All Core Operations Updated!

All coin operations now use the new coinTransactions module and properly log to transaction history:

1. ✅ **Daily Login Reward** - Using `addCoins()` with type `daily_login`
2. ✅ **Registration Reward** - Using `addCoins()` with type `registration`
3. ✅ **Avatar Upload Reward** - Using `addCoins()` with type `avatar_upload`
4. ✅ **Tournament Creation** - Using `deductCoins()` with type `tournament_creation`
5. ✅ **Tournament Registration** - Using `addCoins()` with type `tournament_registration`

### Optional Enhancement:

3. **Add Coin Rewards for Tournament Winners** (if desired)
   - Could award bonus coins in addition to money prizes
   - Examples:
     - 1st Place: +10 coins
     - 2nd Place: +5 coins
     - 3rd Place: +2 coins
   - Would use `addCoins()` with type `tournament_prize`

## Old Function Status

The old `addCoinsToUser()` function in `src/api/api.js` (Line 153):
- Still exists in codebase
- Does NOT log transactions
- Should be replaced in all locations with `addCoins()` from coinTransactions module
- Consider deprecating or removing after migration complete

## New Transaction Module

Located at: `src/api/coinTransactions.js`

**Available Functions:**
- `logCoinTransaction(userId, amount, type, description, metadata)` - Log transaction
- `addCoins(userId, amount, type, description, metadata)` - Add coins with logging
- `deductCoins(userId, amount, type, description, metadata)` - Deduct coins with logging
- `getCoinTransactionHistory(userId)` - Get transaction history
- `getCoinBalance(userId)` - Get current balance

**All coin operations should use these functions for proper audit trail.**

Potential Coin Reward Ideas for Your Gaming Platform:
Tournament & Competitive Activities:
1. Tournament Registration (+2 coins) - Reward players for joining tournaments to boost participation
2. Tournament Completion (+3 coins) - For finishing a tournament (even if you don't win)
3. Winning Tournament Matches (+1-2 coins per match win) - Incentivize competitive play
4. Tournament Winner Bonus (+10/5/3 coins for 1st/2nd/3rd place) - On top of prize money
Game Activity:
1. Playing Games (+1 coin per game) - Encourage active gameplay
2. Win Streak Bonuses (+5 coins for 3 wins, +10 for 5 wins, etc.)
3. First Game of the Day (+1 coin) - Similar to daily login
4. Milestone Games (+5 coins for 10/25/50/100 games played)
Community & Social:
1. Profile Completion (+3 coins) - For filling out profile details
2. Referral Bonus (+5 coins) - When a referred friend plays their first game
3. Reporting Games (+1 coin) - Reward tournament organizers for reporting results
4. Accurate Game Reporting (bonus +1 coin) - If both players confirm the same result
Skill & Achievement:
1. Rating Milestones (+5 coins) - Reaching 1200, 1400, 1600, etc. rating
2. Star Rating Milestones (+3 coins) - Reaching 1, 2, 3 stars
3. Leaderboard Position (+10 coins for top 3, +5 for top 10)
4. Castle Mastery (+3 coins) - Win 10 games with each castle type
Seasonal/Special:
1. Weekly Active Bonus (+5 coins) - Play at least 3 games in a week
2. Monthly Active Bonus (+20 coins) - Play at least 10 games in a month
3. Tournament Host Reward (+3 coins refund) - If your tournament fills up and completes successfully