/**
 * Short end-to-end tests for new tournament formats.
 * Chains real utility functions through create → play → advance flows.
 * No Firebase or React rendering required.
 */

import {
    computeCsSwissStandings,
    CS_SWISS_SIZES,
    generateCsSwissPlayoffStages,
    generateNextCsSwissRoundPairings,
    isCsSwissSize,
    MIN_SWISS_PLAYERS,
    MIN_CS_SWISS_PLAYERS,
    calculateSwissTotalRounds,
    generateSwissRound1Pairings,
    generateNextSwissRoundPairings,
    isSwissRoundComplete
} from '../components/tournaments/homm3/swissUtils';
import {
    CHAMPIONS_LEAGUE_GROUP_SIZE,
    assignPlayersToGroups,
    computeGroupStandings,
    generateChampionsLeagueGroupPairs,
    generateKnockoutBracketStages,
    getKnockoutPlayerCount,
    getQualifiedPlayers,
    isChampionsLeagueGroupStageComplete,
    isChampionsLeagueSize,
    pairKnockoutQualifiers,
    validateChampionsLeagueRegistration,
    orderPlayersFromWheelPairs,
    prepareChampionsLeagueFromDrawGrid,
    prepareChampionsLeagueGroupStage,
    createEmptyGroupDrawGrid,
    mapSnakeDrawIndexToSlot
} from '../components/tournaments/homm3/championsLeagueUtils';
import {
    DOUBLE_ELIM_SIZES,
    createDoubleElimPlayoffPairs,
    dropLoserToBracket,
    getDoubleElimStageLabels,
    isDoubleElimSize,
    promoteLoserBracketWinner
} from '../components/tournaments/homm3/loserBracketUtils';

const makePlayer = (name, ratings = '1500') => ({ name, ratings, stars: 0 });

/** Lower name index in group = stronger; ensures predictable top-2 qualification. */
const completeGroupStage = (pairs, groups) => {
    Object.entries(groups).forEach(([groupLabel, groupPlayers]) => {
        const rank = new Map(groupPlayers.map((player, index) => [player.name, index]));
        pairs
            .filter((pair) => pair.group === groupLabel)
            .forEach((pair) => {
                pair.winner = rank.get(pair.team1) < rank.get(pair.team2) ? pair.team1 : pair.team2;
            });
    });
    return pairs;
};

const markRoundWinners = (pairs, round, pickTeam = 'team1') =>
    pairs.map((pair) => (Number(pair.round) === Number(round) ? { ...pair, winner: pair[pickTeam] } : pair));

describe('tournament format E2E flows', () => {
    describe('Swiss system', () => {
        const players = ['Alice', 'Bob', 'Carol', 'Dave'].map((name) => makePlayer(name));

        test('round 1 → results → round 2 advances full Swiss pipeline', () => {
            expect(MIN_SWISS_PLAYERS).toBe(4);
            expect(calculateSwissTotalRounds(players.length)).toBe(2);

            const round1 = generateSwissRound1Pairings(players, 'bo-1');
            expect(round1).toHaveLength(2);
            expect(round1.every((pair) => pair.round === 1 && pair.stage === 'Swiss')).toBe(true);

            expect(isSwissRoundComplete(round1, 1)).toBe(false);

            const afterRound1 = markRoundWinners(round1, 1);
            expect(isSwissRoundComplete(afterRound1, 1)).toBe(true);

            const round2 = generateNextSwissRoundPairings(players, afterRound1, 2, 'bo-1');
            expect(round2).toHaveLength(2);
            expect(round2.every((pair) => pair.round === 2)).toBe(true);

            const allPairs = [...afterRound1, ...round2];
            const playerNames = new Set(
                round2.flatMap((pair) => [pair.team1, pair.team2]).filter((name) => name !== 'BYE')
            );
            expect(playerNames.size).toBe(4);
            expect(allPairs.filter((pair) => pair.round === 2).length).toBe(2);
        });
    });

    describe('CS Swiss to playoffs', () => {
        const players = Array.from({ length: 16 }, (_, index) => makePlayer(`P${index + 1}`));

        const buildPairsFromRecords = (records) => {
            const winners = [];
            const losers = [];
            Object.entries(records).forEach(([name, record]) => {
                const [wins, losses] = record.split('-').map(Number);
                for (let i = 0; i < wins; i++) {
                    winners.push(name);
                }
                for (let i = 0; i < losses; i++) {
                    losers.push(name);
                }
            });

            return winners.map((winner, index) => {
                let loserIndex = losers.findIndex((name) => name !== winner);
                if (loserIndex === -1) {
                    loserIndex = 0;
                }
                const [loser] = losers.splice(loserIndex, 1);
                return {
                    team1: winner,
                    team2: loser,
                    winner,
                    round: Math.floor(index / 8) + 1,
                    stage: 'CS Swiss',
                    type: 'bo-1',
                    score1: 1,
                    score2: 0
                };
            });
        };

        test('supports 8 and 16 player field sizes', () => {
            expect(MIN_CS_SWISS_PLAYERS).toBe(8);
            expect(CS_SWISS_SIZES).toEqual([8, 16]);
            expect(isCsSwissSize(8)).toBe(true);
            expect(isCsSwissSize(16)).toBe(true);
            expect(isCsSwissSize(12)).toBe(false);
        });

        test('excludes qualified and eliminated players from next-round pairings', () => {
            const pairs = [
                ...['P2', 'P3', 'P4'].map((loser) => ({ team1: 'P1', team2: loser, winner: 'P1', round: 1 })),
                ...['P5', 'P6', 'P7'].map((winner) => ({ team1: winner, team2: 'P16', winner, round: 1 }))
            ];
            const nextRound = generateNextCsSwissRoundPairings(players, pairs, 4, 'bo-1');
            const names = nextRound.flatMap((pair) => [pair.team1, pair.team2]);

            expect(names).not.toContain('P1');
            expect(names).not.toContain('P16');
        });

        test('generates quarter-finals for 8 qualified players', () => {
            const records = {
                P1: '3-0',
                P2: '3-0',
                P3: '3-1',
                P4: '3-1',
                P5: '3-1',
                P6: '3-2',
                P7: '3-2',
                P8: '3-2',
                P9: '2-3',
                P10: '2-3',
                P11: '2-3',
                P12: '1-3',
                P13: '1-3',
                P14: '1-3',
                P15: '0-3',
                P16: '0-3'
            };
            const pairs = buildPairsFromRecords(records);
            const standings = computeCsSwissStandings(pairs, players);
            const generated = generateCsSwissPlayoffStages(pairs, players, 'bo-1');

            expect(standings.filter((entry) => entry.swissStatus === 'qualified')).toHaveLength(8);
            expect(generated.valid).toBe(true);
            expect(generated.stageLabels).toEqual(['Quarter-final', 'Semi-final', 'Third Place', 'Final']);
            expect(generated.stages[0]).toHaveLength(4);
            expect(generated.stages[0].some((pair) => pair.team1 === 'P1' || pair.team2 === 'P1')).toBe(true);
            expect(generated.stages[0].some((pair) => pair.team1 === 'P2' || pair.team2 === 'P2')).toBe(true);
        });

        test('generates semi-finals for 4 qualified players from 8-player CS Swiss', () => {
            const eightPlayers = players.slice(0, 8);
            const records = {
                P1: '3-0',
                P2: '3-1',
                P3: '3-1',
                P4: '3-2',
                P5: '2-3',
                P6: '1-3',
                P7: '1-3',
                P8: '0-3'
            };
            const pairs = buildPairsFromRecords(records);
            const standings = computeCsSwissStandings(pairs, eightPlayers);
            const generated = generateCsSwissPlayoffStages(pairs, eightPlayers, 'bo-1');

            expect(standings.filter((entry) => entry.swissStatus === 'qualified')).toHaveLength(4);
            expect(generated.valid).toBe(true);
            expect(generated.stageLabels).toEqual(['Semi-final', 'Third Place', 'Final']);
            expect(generated.stages[0]).toHaveLength(2);
            expect(generated.stages[0].some((pair) => pair.team1 === 'P1' || pair.team2 === 'P1')).toBe(true);
        });
    });

    describe('Champions League (groups + knockout)', () => {
        const players = Array.from({ length: 8 }, (_, index) => makePlayer(`P${index + 1}`));

        test('rejects invalid registration counts', () => {
            expect(isChampionsLeagueSize(8)).toBe(true);
            expect(isChampionsLeagueSize(12)).toBe(false);

            expect(validateChampionsLeagueRegistration(7, 8).valid).toBe(false);
            expect(validateChampionsLeagueRegistration(8, 8).valid).toBe(true);
            expect(validateChampionsLeagueRegistration(9, 8).valid).toBe(false);
        });

        test('group stage → qualifiers → knockout with cross-group seeding', () => {
            const groups = {
                A: players.slice(0, CHAMPIONS_LEAGUE_GROUP_SIZE),
                B: players.slice(CHAMPIONS_LEAGUE_GROUP_SIZE)
            };

            const groupPairs = generateChampionsLeagueGroupPairs(groups, 'bo-1');
            expect(groupPairs).toHaveLength(12);
            expect(new Set(groupPairs.map((pair) => pair.group))).toEqual(new Set(['A', 'B']));

            completeGroupStage(groupPairs, groups);
            expect(isChampionsLeagueGroupStageComplete(groupPairs)).toBe(true);

            const standingsA = computeGroupStandings(groupPairs, 'A', groups.A);
            const standingsB = computeGroupStandings(groupPairs, 'B', groups.B);
            expect(standingsA[0].name).toBe('P1');
            expect(standingsA[1].name).toBe('P2');
            expect(standingsB[0].name).toBe('P5');
            expect(standingsB[1].name).toBe('P6');

            const qualifiers = getQualifiedPlayers(groups, groupPairs);
            expect(qualifiers).toHaveLength(4);
            expect(getKnockoutPlayerCount(8)).toBe(4);

            const seeded = pairKnockoutQualifiers(qualifiers);
            expect(seeded).toHaveLength(qualifiers.length);
            for (let index = 0; index < seeded.length; index += 2) {
                expect(seeded[index].group).not.toBe(seeded[index + 1].group);
            }

            const knockoutStages = generateKnockoutBracketStages(
                qualifiers,
                getKnockoutPlayerCount(8),
                'bo-1',
                'bo-1',
                'bo-1'
            );
            expect(knockoutStages.length).toBeGreaterThan(0);

            const firstKnockoutRound = knockoutStages[0];
            expect(firstKnockoutRound).toHaveLength(2);
            firstKnockoutRound.forEach((pair) => {
                const q1 = qualifiers.find((entry) => entry.name === pair.team1);
                const q2 = qualifiers.find((entry) => entry.name === pair.team2);
                expect(q1).toBeDefined();
                expect(q2).toBeDefined();
                expect(q1.group).not.toBe(q2.group);
            });

            const storedBracket = [groupPairs, ...knockoutStages];
            expect(storedBracket[0]).toHaveLength(12);
            expect(storedBracket[1][0].team1).not.toBe('TBD');
        });

        test('random group draw produces valid structure for 16 players', () => {
            const sixteen = Array.from({ length: 16 }, (_, index) => makePlayer(`Player${index + 1}`));
            const validation = validateChampionsLeagueRegistration(16, 16);
            expect(validation.valid).toBe(true);

            const groups = assignPlayersToGroups(sixteen);
            expect(Object.keys(groups)).toHaveLength(4);
            Object.values(groups).forEach((groupPlayers) => {
                expect(groupPlayers).toHaveLength(CHAMPIONS_LEAGUE_GROUP_SIZE);
            });

            const groupPairs = generateChampionsLeagueGroupPairs(groups, 'bo-1');
            expect(groupPairs).toHaveLength(24);
        });

        test('spinning wheel draw order assigns groups without reshuffling', () => {
            const eight = Array.from({ length: 8 }, (_, index) => makePlayer(`P${index + 1}`));
            const wheelPairs = [
                ['P1', 'P2'],
                ['P3', 'P4'],
                ['P5', 'P6'],
                ['P7', 'P8']
            ];
            const ordered = orderPlayersFromWheelPairs(wheelPairs, eight);
            expect(ordered.map((player) => player.name)).toEqual(['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8']);

            const prepared = prepareChampionsLeagueGroupStage(
                ordered,
                {
                    maxPlayers: 8,
                    tournamentPlayoffGames: 'bo-1'
                },
                { shuffle: false }
            );

            expect(prepared.validation.valid).toBe(true);
            expect(prepared.groups.A.map((player) => player.name)).toEqual(['P1', 'P2', 'P3', 'P4']);
            expect(prepared.groups.B.map((player) => player.name)).toEqual(['P5', 'P6', 'P7', 'P8']);
            expect(prepared.groupPairs).toHaveLength(12);
        });

        test('snake draw fills Table A seat 1, Table B seat 1, then seat 2 across tables', () => {
            const eight = Array.from({ length: 8 }, (_, index) => makePlayer(`P${index + 1}`));
            const grid = createEmptyGroupDrawGrid(8);
            const drawOrder = eight.map((player) => player.name);

            drawOrder.forEach((name, drawIndex) => {
                const { groupIndex, seatIndex } = mapSnakeDrawIndexToSlot(drawIndex, grid.length);
                grid[groupIndex][seatIndex] = name;
            });

            expect(grid[0]).toEqual(['P1', 'P3', 'P5', 'P7']);
            expect(grid[1]).toEqual(['P2', 'P4', 'P6', 'P8']);

            const prepared = prepareChampionsLeagueFromDrawGrid(
                grid,
                { maxPlayers: 8, tournamentPlayoffGames: 'bo-1' },
                eight
            );

            expect(prepared.validation.valid).toBe(true);
            expect(prepared.groups.A.map((player) => player.name)).toEqual(['P1', 'P3', 'P5', 'P7']);
            expect(prepared.groups.B.map((player) => player.name)).toEqual(['P2', 'P4', 'P6', 'P8']);
        });

        test('prepareChampionsLeagueGroupStage auto-shuffles when wheel is disabled', () => {
            const eight = Array.from({ length: 8 }, (_, index) => makePlayer(`P${index + 1}`));
            const prepared = prepareChampionsLeagueGroupStage(
                eight,
                { maxPlayers: 8, tournamentPlayoffGames: 'bo-3' },
                { shuffle: true }
            );

            expect(prepared.validation.valid).toBe(true);
            expect(prepared.gameType).toBe('bo-3');
            expect(Object.keys(prepared.groups)).toHaveLength(2);
            expect(prepared.groupPairs.every((pair) => pair.type === 'bo-3')).toBe(true);
        });
    });

    describe('Double elimination (loser bracket)', () => {
        const players = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((name) => makePlayer(name));

        test('creates winner + loser bracket stages for 8 players', () => {
            expect(isDoubleElimSize(8)).toBe(true);
            expect(DOUBLE_ELIM_SIZES).toContain(8);

            const labels = getDoubleElimStageLabels(8);
            expect(labels).toContain('Quarter-final');
            expect(labels).toContain('WB Final');
            expect(labels).toContain('LB R1');
            expect(labels).toContain('Grand Final');

            const stages = createDoubleElimPlayoffPairs('1', '1', players, 8);
            expect(stages).toHaveLength(labels.length);
            expect(stages[0]).toHaveLength(4);
            expect(stages[0][0].team1).toBe('A');
            expect(stages[0][0].team2).toBe('B');
        });

        test('quarter-final loser drops into loser bracket', () => {
            const stages = createDoubleElimPlayoffPairs('1', '1', players, 8);
            const labels = getDoubleElimStageLabels(8);
            const updatedPairs = stages.map((stage) => stage.map((pair) => ({ ...pair })));

            const dropped = dropLoserToBracket({
                updatedPairs,
                stageLabels: labels,
                currentStage: 'Quarter-final',
                pairIndex: 0,
                loser: 'A',
                loserRating: '1500',
                loserStars: 0,
                maxPlayers: 8
            });

            expect(dropped).toBe(true);

            const lbR1Index = labels.indexOf('LB R1');
            expect(updatedPairs[lbR1Index][0].team1).toBe('A');
        });

        test('loser bracket winner promotes toward grand final', () => {
            const stages = createDoubleElimPlayoffPairs('1', '1', players, 8);
            const labels = getDoubleElimStageLabels(8);
            const updatedPairs = stages.map((stage) => stage.map((pair) => ({ ...pair })));

            const lbR1Index = labels.indexOf('LB R1');
            updatedPairs[lbR1Index][0].team1 = 'LoserA';
            updatedPairs[lbR1Index][0].team2 = 'LoserB';
            updatedPairs[lbR1Index][0].winner = 'LoserA';

            const promoted = promoteLoserBracketWinner({
                updatedPairs,
                stageLabels: labels,
                currentStage: 'LB R1',
                pairIndex: 0,
                winner: 'LoserA',
                winnerRating: '1400',
                winnerStars: 0,
                maxPlayers: 8
            });

            expect(promoted).toBe(true);

            const lbR2Index = labels.indexOf('LB R2');
            expect(updatedPairs[lbR2Index][0].team1).toBe('LoserA');
        });
    });
});
