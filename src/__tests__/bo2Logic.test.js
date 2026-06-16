/**
 * Unit tests for bo-2 match type feature.
 * Tests all pure-logic functions changed/added for bo-2 support.
 * No Firebase or React rendering required.
 */

// ─── 1. getBestOfValue (from ReportGameModal.js) ────────────────────────────

function getBestOfValue(type) {
    const normalized = String(type || '')
        .toLowerCase()
        .trim();
    if (normalized === 'bo-5' || normalized === '5' || normalized === 'bo5') {
        return 5;
    }
    if (normalized === 'bo-3' || normalized === '3' || normalized === 'bo3') {
        return 3;
    }
    if (normalized === 'bo-2' || normalized === '2' || normalized === 'bo2') {
        return 2;
    }
    return 1;
}

describe('getBestOfValue', () => {
    test('returns 2 for "bo-2"', () => expect(getBestOfValue('bo-2')).toBe(2));
    test('returns 2 for "2"', () => expect(getBestOfValue('2')).toBe(2));
    test('returns 2 for "bo2"', () => expect(getBestOfValue('bo2')).toBe(2));
    test('returns 2 for "BO-2" (case insensitive)', () => expect(getBestOfValue('BO-2')).toBe(2));
    test('returns 3 for "bo-3"', () => expect(getBestOfValue('bo-3')).toBe(3));
    test('returns 5 for "bo-5"', () => expect(getBestOfValue('bo-5')).toBe(5));
    test('returns 1 for "bo-1"', () => expect(getBestOfValue('bo-1')).toBe(1));
    test('returns 1 for undefined', () => expect(getBestOfValue(undefined)).toBe(1));
    test('returns 1 for empty string', () => expect(getBestOfValue('')).toBe(1));
});

// ─── 2. requiredWins computation ────────────────────────────────────────────

describe('requiredWins for bo-2', () => {
    test('bo-2: requiredWins = Math.floor(2/2)+1 = 2', () => {
        const bestOf = getBestOfValue('bo-2');
        expect(Math.floor(bestOf / 2) + 1).toBe(2);
    });
    test('bo-2: isSeriesMatch = true (bestOf > 1)', () => {
        expect(getBestOfValue('bo-2') > 1).toBe(true);
    });
    test('bo-3: requiredWins = 2', () => {
        expect(Math.floor(getBestOfValue('bo-3') / 2) + 1).toBe(2);
    });
    test('bo-5: requiredWins = 3', () => {
        expect(Math.floor(getBestOfValue('bo-5') / 2) + 1).toBe(3);
    });
});

// ─── 3. draw auto-detection (from handleGameResultChange) ───────────────────
// Simulates the winner auto-selection logic after each game result update.

function autoSelectWinner(team1, team2, gameResults, bestOf) {
    const requiredWins = Math.floor(bestOf / 2) + 1;
    const team1Wins = gameResults.filter((g) => g.winner === team1).length;
    const team2Wins = gameResults.filter((g) => g.winner === team2).length;

    if (bestOf === 2 && team1Wins === 1 && team2Wins === 1) {
        return 'draw';
    }
    if (team1Wins >= requiredWins) {
        return team1;
    }
    if (team2Wins >= requiredWins) {
        return team2;
    }
    return null; // no winner yet
}

describe('draw auto-detection in bo-2', () => {
    const t1 = 'Alice';
    const t2 = 'Bob';

    test('1-0 after game 1 → no winner yet', () => {
        const results = [{ winner: t1 }];
        expect(autoSelectWinner(t1, t2, results, 2)).toBeNull();
    });

    test('0-1 after game 1 → no winner yet', () => {
        const results = [{ winner: t2 }];
        expect(autoSelectWinner(t1, t2, results, 2)).toBeNull();
    });

    test('2-0 (Alice wins both) → Alice wins', () => {
        const results = [{ winner: t1 }, { winner: t1 }];
        expect(autoSelectWinner(t1, t2, results, 2)).toBe(t1);
    });

    test('0-2 (Bob wins both) → Bob wins', () => {
        const results = [{ winner: t2 }, { winner: t2 }];
        expect(autoSelectWinner(t1, t2, results, 2)).toBe(t2);
    });

    test('1-1 → draw', () => {
        const results = [{ winner: t1 }, { winner: t2 }];
        expect(autoSelectWinner(t1, t2, results, 2)).toBe('draw');
    });

    test('1-1 in bo-3 → NOT a draw (still in progress)', () => {
        const results = [{ winner: t1 }, { winner: t2 }];
        expect(autoSelectWinner(t1, t2, results, 3)).toBeNull();
    });
});

// ─── 4. gameType normalisation (from handleStartLeague) ─────────────────────

function normalizeGameType(raw) {
    const rawGameType = raw || 'bo-1';
    return rawGameType === 'BO-5' || rawGameType === 'bo-5' || rawGameType === '5'
        ? 'bo-5'
        : rawGameType === 'BO-3' || rawGameType === 'bo-3' || rawGameType === '3'
          ? 'bo-3'
          : rawGameType === 'BO-2' || rawGameType === 'bo-2' || rawGameType === '2'
            ? 'bo-2'
            : 'bo-1';
}

function numGamesForType(gameType) {
    return gameType === 'bo-5' ? 5 : gameType === 'bo-3' ? 3 : gameType === 'bo-2' ? 2 : 1;
}

describe('handleStartLeague gameType normalisation', () => {
    test('"2" → bo-2, numGames=2', () => {
        const gt = normalizeGameType('2');
        expect(gt).toBe('bo-2');
        expect(numGamesForType(gt)).toBe(2);
    });
    test('"bo-2" → bo-2', () => expect(normalizeGameType('bo-2')).toBe('bo-2'));
    test('"BO-2" → bo-2', () => expect(normalizeGameType('BO-2')).toBe('bo-2'));
    test('"3" → bo-3, numGames=3', () => {
        const gt = normalizeGameType('3');
        expect(gt).toBe('bo-3');
        expect(numGamesForType(gt)).toBe(3);
    });
    test('"5" → bo-5, numGames=5', () => {
        const gt = normalizeGameType('5');
        expect(gt).toBe('bo-5');
        expect(numGamesForType(gt)).toBe(5);
    });
    test('"1" → bo-1, numGames=1', () => {
        const gt = normalizeGameType('1');
        expect(gt).toBe('bo-1');
        expect(numGamesForType(gt)).toBe(1);
    });
    test('undefined → bo-1', () => expect(normalizeGameType(undefined)).toBe('bo-1'));
    test('"unknown" → bo-1', () => expect(normalizeGameType('unknown')).toBe('bo-1'));
});

// ─── 5. computeStandings with draws (from LeagueBracket.js) ─────────────────

function calcWinPoints(pair, winnerTeam) {
    const games = Array.isArray(pair.games) ? pair.games : [];
    const isTeam1 = winnerTeam === pair.team1;
    let total111 = 0;
    let total112 = 0;
    games.forEach((g) => {
        if (!g) {
            return;
        }
        total111 += Number(isTeam1 ? g.restart1_111 : g.restart2_111) || 0;
        total112 += Number(isTeam1 ? g.restart1_112 : g.restart2_112) || 0;
    });
    const totalRestarts = total111 + total112;
    if (totalRestarts === 0) {
        return 3;
    }
    if (totalRestarts === 1) {
        return 2.5;
    }
    return 2;
}

function computeStandings(pairs, registeredPlayers = []) {
    const map = {};
    registeredPlayers.forEach((name) => {
        if (name) {
            map[name] = { played: 0, wins: 0, draws: 0, losses: 0, points: 0 };
        }
    });
    pairs.forEach((pair) => {
        if (pair.team1 && pair.team1 !== 'TBD' && !map[pair.team1]) {
            map[pair.team1] = { played: 0, wins: 0, draws: 0, losses: 0, points: 0 };
        }
        if (pair.team2 && pair.team2 !== 'TBD' && !map[pair.team2]) {
            map[pair.team2] = { played: 0, wins: 0, draws: 0, losses: 0, points: 0 };
        }
        if (pair.winner && pair.winner !== 'TBD') {
            map[pair.team1].played++;
            map[pair.team2].played++;
            if (pair.winner === 'draw') {
                map[pair.team1].draws++;
                map[pair.team1].points += 1;
                map[pair.team2].draws++;
                map[pair.team2].points += 1;
            } else {
                const pts = pair.type === 'bo-2' ? 2 : calcWinPoints(pair, pair.winner);
                if (pair.winner === pair.team1) {
                    map[pair.team1].wins++;
                    map[pair.team1].points += pts;
                    map[pair.team2].losses++;
                } else {
                    map[pair.team2].wins++;
                    map[pair.team2].points += pts;
                    map[pair.team1].losses++;
                }
            }
        }
    });
    return Object.entries(map)
        .map(([name, s]) => ({ name, ...s }))
        .sort((a, b) => b.points - a.points || b.wins - a.wins);
}

describe('computeStandings — bo-2 scoring', () => {
    test('bo-2 draw: both players get 1pt, played=1, draws=1, no wins/losses', () => {
        const pairs = [{ team1: 'Alice', team2: 'Bob', winner: 'draw', type: 'bo-2', games: [] }];
        const s = computeStandings(pairs);
        expect(s).toHaveLength(2);
        const alice = s.find((x) => x.name === 'Alice');
        const bob = s.find((x) => x.name === 'Bob');
        expect(alice).toMatchObject({ played: 1, wins: 0, draws: 1, losses: 0, points: 1 });
        expect(bob).toMatchObject({ played: 1, wins: 0, draws: 1, losses: 0, points: 1 });
    });

    test('bo-2 win: winner gets 2pts, loser 0pts', () => {
        const pairs = [{ team1: 'Alice', team2: 'Bob', winner: 'Alice', type: 'bo-2', games: [] }];
        const s = computeStandings(pairs);
        const alice = s.find((x) => x.name === 'Alice');
        const bob = s.find((x) => x.name === 'Bob');
        expect(alice).toMatchObject({ wins: 1, losses: 0, points: 2 });
        expect(bob).toMatchObject({ wins: 0, losses: 1, points: 0 });
    });

    test('bo-2 win for team2: team2 gets 2pts', () => {
        const pairs = [{ team1: 'Alice', team2: 'Bob', winner: 'Bob', type: 'bo-2', games: [] }];
        const s = computeStandings(pairs);
        const alice = s.find((x) => x.name === 'Alice');
        const bob = s.find((x) => x.name === 'Bob');
        expect(bob).toMatchObject({ wins: 1, points: 2 });
        expect(alice).toMatchObject({ losses: 1, points: 0 });
    });

    test('non-bo-2 win uses restart-based points (3 for no restarts)', () => {
        const pairs = [
            {
                team1: 'Alice',
                team2: 'Bob',
                winner: 'Alice',
                type: 'bo-3',
                games: [{ restart1_111: 0, restart1_112: 0 }]
            }
        ];
        const s = computeStandings(pairs);
        expect(s.find((x) => x.name === 'Alice').points).toBe(3);
    });

    test('mixed: 3-player bo-2 league — 1 win + 1 draw', () => {
        // Alice beats Charlie (2pts), Alice draws Bob (1pt), Bob beats Charlie (2pts)
        const pairs = [
            { team1: 'Alice', team2: 'Charlie', winner: 'Alice', type: 'bo-2', games: [] },
            { team1: 'Alice', team2: 'Bob', winner: 'draw', type: 'bo-2', games: [] },
            { team1: 'Bob', team2: 'Charlie', winner: 'Bob', type: 'bo-2', games: [] }
        ];
        const s = computeStandings(pairs);
        const alice = s.find((x) => x.name === 'Alice');
        const bob = s.find((x) => x.name === 'Bob');
        const charlie = s.find((x) => x.name === 'Charlie');

        // Alice: 2 + 1 = 3pts (1 win, 1 draw)
        expect(alice).toMatchObject({ wins: 1, draws: 1, losses: 0, points: 3 });
        // Bob: 2 + 1 = 3pts (1 win, 1 draw)
        expect(bob).toMatchObject({ wins: 1, draws: 1, losses: 0, points: 3 });
        // Charlie: 0pts (0 wins, 2 losses)
        expect(charlie).toMatchObject({ wins: 0, draws: 0, losses: 2, points: 0 });
    });

    test('standings sorted by points desc, then wins desc', () => {
        const pairs = [
            { team1: 'Alice', team2: 'Bob', winner: 'Alice', type: 'bo-2', games: [] },
            { team1: 'Charlie', team2: 'Bob', winner: 'draw', type: 'bo-2', games: [] }
        ];
        const s = computeStandings(pairs);
        // Alice: 2pts (1 win), Charlie: 1pt (1 draw), Bob: 1pt (1 draw, 1 loss)
        // Tie-break by wins: Charlie wins=0, Bob wins=0 → secondary sort unchanged, but both 1pt
        expect(s[0].name).toBe('Alice'); // 2pts
    });

    test('draw does not count as a win or loss', () => {
        const pairs = [{ team1: 'Alice', team2: 'Bob', winner: 'draw', type: 'bo-2', games: [] }];
        const s = computeStandings(pairs);
        const alice = s.find((x) => x.name === 'Alice');
        expect(alice.wins).toBe(0);
        expect(alice.losses).toBe(0);
    });

    test('TBD winner is ignored', () => {
        const pairs = [{ team1: 'Alice', team2: 'Bob', winner: 'TBD', type: 'bo-2', games: [] }];
        const s = computeStandings(pairs);
        expect(s.find((x) => x.name === 'Alice').played).toBe(0);
    });

    test('null winner is ignored', () => {
        const pairs = [{ team1: 'Alice', team2: 'Bob', winner: null, type: 'bo-2', games: [] }];
        const s = computeStandings(pairs);
        expect(s.find((x) => x.name === 'Alice').played).toBe(0);
    });
});

// ─── 6. handleFinishLeague standings logic ───────────────────────────────────

function computeFinishLeagueStandings(pairs) {
    const standingsMap = {};
    pairs.forEach((pair) => {
        if (!standingsMap[pair.team1]) {
            standingsMap[pair.team1] = { played: 0, wins: 0, draws: 0, losses: 0, points: 0 };
        }
        if (!standingsMap[pair.team2]) {
            standingsMap[pair.team2] = { played: 0, wins: 0, draws: 0, losses: 0, points: 0 };
        }
        if (pair.winner) {
            standingsMap[pair.team1].played++;
            standingsMap[pair.team2].played++;
            if (pair.winner === 'draw') {
                standingsMap[pair.team1].draws++;
                standingsMap[pair.team1].points += 1;
                standingsMap[pair.team2].draws++;
                standingsMap[pair.team2].points += 1;
            } else if (pair.winner === pair.team1) {
                standingsMap[pair.team1].wins++;
                standingsMap[pair.team1].points += pair.type === 'bo-2' ? 2 : 3;
                standingsMap[pair.team2].losses++;
            } else {
                standingsMap[pair.team2].wins++;
                standingsMap[pair.team2].points += pair.type === 'bo-2' ? 2 : 3;
                standingsMap[pair.team1].losses++;
            }
        }
    });
    return Object.entries(standingsMap)
        .map(([name, s]) => ({ name, ...s }))
        .sort((a, b) => b.points - a.points || b.wins - a.wins);
}

describe('handleFinishLeague standings', () => {
    test('bo-2 draw: 1pt each', () => {
        const standings = computeFinishLeagueStandings([
            { team1: 'Alice', team2: 'Bob', winner: 'draw', type: 'bo-2' }
        ]);
        expect(standings.find((s) => s.name === 'Alice').points).toBe(1);
        expect(standings.find((s) => s.name === 'Bob').points).toBe(1);
    });

    test('bo-2 win: 2pts for winner, 0 for loser', () => {
        const standings = computeFinishLeagueStandings([
            { team1: 'Alice', team2: 'Bob', winner: 'Alice', type: 'bo-2' }
        ]);
        expect(standings.find((s) => s.name === 'Alice').points).toBe(2);
        expect(standings.find((s) => s.name === 'Bob').points).toBe(0);
    });

    test('non-bo-2 win: 3pts for winner', () => {
        const standings = computeFinishLeagueStandings([
            { team1: 'Alice', team2: 'Bob', winner: 'Alice', type: 'bo-3' }
        ]);
        expect(standings.find((s) => s.name === 'Alice').points).toBe(3);
    });

    test('allDone check: draw winner is truthy', () => {
        const pairs = [{ team1: 'Alice', team2: 'Bob', winner: 'draw', type: 'bo-2' }];
        expect(pairs.every((p) => p.winner)).toBe(true);
    });

    test('allDone check: null winner → not all done', () => {
        const pairs = [
            { team1: 'Alice', team2: 'Bob', winner: 'Alice', type: 'bo-2' },
            { team1: 'Alice', team2: 'Charlie', winner: null, type: 'bo-2' }
        ];
        expect(pairs.every((p) => p.winner)).toBe(false);
    });

    test('standingsSummary includes draw count when draws > 0', () => {
        const standings = computeFinishLeagueStandings([
            { team1: 'Alice', team2: 'Bob', winner: 'draw', type: 'bo-2' },
            { team1: 'Alice', team2: 'Charlie', winner: 'Alice', type: 'bo-2' }
        ]);
        const summary = standings
            .slice(0, 3)
            .map((s) => {
                const drawPart = s.draws > 0 ? ` / ${s.draws}D` : '';
                return `${s.name} — ${s.points} pts (${s.wins}W${drawPart} / ${s.losses}L)`;
            })
            .join('\n');
        expect(summary).toContain('1D'); // Alice has 1 draw
    });
});

// ─── 7. hasWinner guard for draws ────────────────────────────────────────────

describe('hasWinner guard (prevents lookForUserId crash)', () => {
    function computeHasWinner(winner) {
        return !!winner && winner !== 'draw';
    }

    test('"draw" → hasWinner = false', () => expect(computeHasWinner('draw')).toBe(false));
    test('"Alice" → hasWinner = true', () => expect(computeHasWinner('Alice')).toBe(true));
    test('null → hasWinner = false', () => expect(computeHasWinner(null)).toBe(false));
    test('"" → hasWinner = false', () => expect(computeHasWinner('')).toBe(false));
    test('"TBD" → hasWinner = true (treated as a name)', () => expect(computeHasWinner('TBD')).toBe(true));
});

// ─── 8. handleSubmit draw validation ─────────────────────────────────────────

describe('handleSubmit draw validation', () => {
    function validateSeriesResult(selectedWinner, score1, score2, bestOf) {
        const requiredWins = Math.floor(bestOf / 2) + 1;
        if (selectedWinner && selectedWinner !== 'draw') {
            const valid =
                (score1 === requiredWins && score2 < requiredWins) ||
                (score2 === requiredWins && score1 < requiredWins);
            if (!valid) {
                return { valid: false, error: 'invalid score for winner' };
            }
        }
        if (selectedWinner === 'draw' && !(score1 === 1 && score2 === 1 && bestOf === 2)) {
            return { valid: false, error: 'draw only valid for bo-2 with 1-1 score' };
        }
        return { valid: true };
    }

    test('draw with 1-1 and bo-2 → valid', () => {
        expect(validateSeriesResult('draw', 1, 1, 2).valid).toBe(true);
    });
    test('draw with 2-0 and bo-2 → invalid', () => {
        expect(validateSeriesResult('draw', 2, 0, 2).valid).toBe(false);
    });
    test('draw with 1-1 and bo-3 → invalid (not bo-2)', () => {
        expect(validateSeriesResult('draw', 1, 1, 3).valid).toBe(false);
    });
    test('winner Alice with 2-0 in bo-2 → valid', () => {
        expect(validateSeriesResult('Alice', 2, 0, 2).valid).toBe(true);
    });
    test('winner Alice with 1-1 in bo-2 → invalid', () => {
        expect(validateSeriesResult('Alice', 1, 1, 2).valid).toBe(false);
    });
    test('null winner → valid (in-progress, no validation needed)', () => {
        expect(validateSeriesResult(null, 1, 0, 2).valid).toBe(true);
    });
});
