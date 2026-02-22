# Restart Coefficient Calculation Guide

## Overview
The restart average calculation has been implemented to show statistics for restarts used during tournament games. This displays the weighted average of restarts per game for each player.

## How It Works

### Restart Types
In tournament games, there are two types of restarts available:

1. **111 Restarts** - Standard restart (max 2 per player)
   - Coefficient: **1.1**

2. **112 Restarts** - Special restart (max 1 per player)  
   - Coefficient: **1.2**

### Calculation Formula
```
Restart Average = (restart_111 × 1.1 + restart_112 × 1.2) / number_of_games
```

**Example:**
- Player A used: 2 × restart_111 and 1 × restart_112 across 3 games
- Player A's restart average = (2 × 1.1 + 1 × 1.2) / 3 = (2.2 + 1.2) / 3 = 1.13

## Where It Displays

The restart statistics are displayed in the **Stats Popup** when you click the `?` button (show stats) on any tournament matchup.

### Stats Popup Contents
- Total games between players
- Wins/Losses
- Win percentage
- **РЕСТАРТЫ (Restarts)** - Section showing:
  - Player A's restart average
  - Player B's restart average

## Implementation Details

### Modified Files

1. **src/components/StatsPopup/StatsPopup.js**
   - Added restart statistics section
   - Displays both players' restart averages with Russian label "РЕСТАРТЫ"
   - Only shows if restart data exists

2. **src/components/tournaments/homm3/tournamentsBracket.js**
   - Enhanced `handleShowStats` function
   - Iterates through tournament playoff pairs
   - Collects restart data from `pair.games` array
   - Calculates weighted average using coefficients
   - Passes `restartAvgA` and `restartAvgB` to stats state

### Data Structure
Restart data is stored in each game object within a tournament pair:
```javascript
{
  restart1_111: number,  // 111 restarts for team1
  restart1_112: number,  // 112 restarts for team1
  restart2_111: number,  // 111 restarts for team2
  restart2_112: number   // 112 restarts for team2
}
```

## Display Format

**РЕСТАРТЫ (Restarts)**
- Player A: 1.30
- Player B: 1.70

Each player's restart coefficient is displayed to 2 decimal places for clear comparison.

## Notes

- The calculation only considers tournament games between the two players
- If no games are found, the values default to 0.00
- The coefficient system (1.1 and 1.2) reflects the different "costs" of each restart type
- This gives a numerical representation of aggressive playstyle (higher coefficient = more restarts used)
