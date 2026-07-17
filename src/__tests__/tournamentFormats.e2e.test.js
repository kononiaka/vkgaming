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
    computeScheduleStandings,
    generateSwissRound1Pairings,
    generateNextSwissRoundPairings,
    isSwissRoundComplete,
    repairSwissByePairs
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
    assignQualifiersToSecondGroups,
    CHAMPIONS_LEAGUE_TWO_GROUP_TYPE,
    getKnockoutPlayerCountForType,
    getKnockoutPlayerCountTwoGroup,
    isChampionsLeagueTwoGroupSize,
    prepareChampionsLeagueSecondGroupStage,
    validateChampionsLeagueRegistration,
    orderPlayersFromWheelPairs,
    prepareChampionsLeagueFromDrawGrid,
    prepareChampionsLeagueGroupStage,
    createEmptyGroupDrawGrid,
    mapSnakeDrawIndexToSlot,
    normalizeChampionsLeagueKnockoutGameType
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

        test('standings exclude BYE placeholder for odd player counts', () => {
            const fivePlayers = ['A', 'B', 'C', 'D', 'E'].map((name) => makePlayer(name));
            const round1 = generateSwissRound1Pairings(fivePlayers, 'bo-1');
            const standings = computeScheduleStandings(round1, fivePlayers.map((player) => player.name));

            expect(standings).toHaveLength(5);
            expect(standings.some((entry) => entry.name === 'BYE')).toBe(false);
            expect(standings.find((entry) => entry.name === round1.find((pair) => pair.isBye)?.team1)?.wins).toBe(1);
        });

        test('round 2 floats one player instead of creating byes for odd score groups', () => {
            const sixPlayers = ['A', 'B', 'C', 'D', 'E', 'F'].map((name) => makePlayer(name));
            const round1 = generateSwissRound1Pairings(sixPlayers, 'bo-1');
            const afterRound1 = markRoundWinners(round1, 1);

            const winners = new Set(afterRound1.map((pair) => pair.winner).filter((name) => name && name !== 'BYE'));
            const losers = new Set(
                afterRound1.flatMap((pair) => {
                    if (pair.isBye || !pair.winner) {
                        return [];
                    }
                    return [pair.team1, pair.team2].filter((name) => name !== pair.winner);
                })
            );

            const round2 = generateNextSwissRoundPairings(sixPlayers, afterRound1, 2, 'bo-1');
            const matchPairs = round2.filter((pair) => pair.team2 !== 'BYE');
            const crossScorePairs = matchPairs.filter(
                (pair) =>
                    (winners.has(pair.team1) && losers.has(pair.team2)) ||
                    (losers.has(pair.team1) && winners.has(pair.team2))
            );

            expect(round2).toHaveLength(3);
            expect(round2.filter((pair) => pair.isBye)).toHaveLength(0);
            expect(crossScorePairs).toHaveLength(1);
        });

        test('ignores stale BYE player records when real Swiss player count is even', () => {
            const eightPlayersWithStaleBye = [
                ...Array.from({ length: 8 }, (_, index) => makePlayer(`P${index + 1}`)),
                makePlayer('BYE')
            ];
            const round1 = generateSwissRound1Pairings(eightPlayersWithStaleBye, 'bo-1');
            const afterRound1 = markRoundWinners(round1, 1);
            const round2 = generateNextSwissRoundPairings(eightPlayersWithStaleBye, afterRound1, 2, 'bo-1');

            expect(round1).toHaveLength(4);
            expect(round1.filter((pair) => pair.isBye)).toHaveLength(0);
            expect(round2).toHaveLength(4);
            expect(round2.filter((pair) => pair.isBye)).toHaveLength(0);
        });

        test('repairs persisted invalid BYE pairs for even Swiss player counts', () => {
            const eightPlayers = Array.from({ length: 8 }, (_, index) => makePlayer(`P${index + 1}`));
            const round1 = generateSwissRound1Pairings(eightPlayers, 'bo-1');
            const invalidRound2 = [
                {
                    ...round1[0],
                    round: 2,
                    team1: 'P1',
                    team2: 'BYE',
                    winner: 'P1',
                    isBye: true,
                    gameStatus: 'Processed'
                },
                {
                    ...round1[1],
                    round: 2,
                    team1: 'P2',
                    team2: 'BYE',
                    winner: 'P2',
                    isBye: true,
                    gameStatus: 'Processed'
                }
            ];

            const repaired = repairSwissByePairs([...round1, ...invalidRound2], eightPlayers, 'bo-1');
            const repairedRound2 = repaired.pairs.filter((pair) => Number(pair.round) === 2);

            expect(repaired.repaired).toBe(true);
            expect(repairedRound2).toHaveLength(1);
            expect(repairedRound2[0].team1).toBe('P1');
            expect(repairedRound2[0].team2).toBe('P2');
            expect(repairedRound2[0].winner).toBeNull();
            expect(repairedRound2[0].isBye).toBeUndefined();
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

        test('group standings use head-to-head before wins/name for tied points', () => {
            const tiedPlayers = ['Alpha', 'Bravo', 'Charlie', 'Delta'].map((name) => makePlayer(name));
            const groups = { A: tiedPlayers };
            const groupPairs = generateChampionsLeagueGroupPairs(groups, 'bo-1');
            const winnersByMatch = {
                'Alpha|Bravo': 'Bravo',
                'Alpha|Charlie': 'Alpha',
                'Alpha|Delta': 'Alpha',
                'Bravo|Charlie': 'Bravo',
                'Bravo|Delta': 'Delta',
                'Charlie|Delta': 'Charlie'
            };

            groupPairs.forEach((pair) => {
                const key = [pair.team1, pair.team2].sort().join('|');
                pair.winner = winnersByMatch[key];
            });

            const standings = computeGroupStandings(groupPairs, 'A', tiedPlayers);

            expect(standings[0].name).toBe('Bravo');
            expect(standings[1].name).toBe('Alpha');
            expect(standings[0].points).toBe(standings[1].points);
        });

        test('knockout formats do not inherit BO-2 from Champions League group stage', () => {
            expect(normalizeChampionsLeagueKnockoutGameType(undefined)).toBe('bo-1');
            expect(normalizeChampionsLeagueKnockoutGameType('bo-2')).toBe('bo-1');
            expect(normalizeChampionsLeagueKnockoutGameType('bo-3')).toBe('bo-3');
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

    describe('Champions League (two group stages)', () => {
        const makeSixteen = () => Array.from({ length: 16 }, (_, index) => makePlayer(`P${index + 1}`));

        test('validates 16 and 32 player counts only', () => {
            expect(isChampionsLeagueTwoGroupSize(16)).toBe(true);
            expect(isChampionsLeagueTwoGroupSize(32)).toBe(true);
            expect(isChampionsLeagueTwoGroupSize(8)).toBe(false);

            expect(validateChampionsLeagueRegistration(16, 16, CHAMPIONS_LEAGUE_TWO_GROUP_TYPE).valid).toBe(true);
            expect(validateChampionsLeagueRegistration(8, 8, CHAMPIONS_LEAGUE_TWO_GROUP_TYPE).valid).toBe(false);
        });

        test('16-player path: group1 → group2 → semi-final knockout', () => {
            const players = makeSixteen();
            const tournamentData = {
                type: CHAMPIONS_LEAGUE_TWO_GROUP_TYPE,
                maxPlayers: 16,
                tournamentPlayoffGames: 'bo-1'
            };

            const preparedGroup1 = prepareChampionsLeagueGroupStage(players, tournamentData, { shuffle: false });
            expect(preparedGroup1.validation.valid).toBe(true);
            expect(preparedGroup1.groupPairs.every((pair) => pair.groupPhase === 1)).toBe(true);
            expect(Object.keys(preparedGroup1.groups)).toHaveLength(4);

            completeGroupStage(preparedGroup1.groupPairs, preparedGroup1.groups);
            expect(isChampionsLeagueGroupStageComplete(preparedGroup1.groupPairs, 1)).toBe(true);

            const preparedGroup2 = prepareChampionsLeagueSecondGroupStage(
                preparedGroup1.groups,
                preparedGroup1.groupPairs,
                tournamentData
            );
            expect(preparedGroup2.validation.valid).toBe(true);
            expect(Object.keys(preparedGroup2.groups2)).toHaveLength(2);
            expect(preparedGroup2.group2Pairs.every((pair) => pair.groupPhase === 2)).toBe(true);

            Object.values(preparedGroup2.groups2).forEach((groupPlayers) => {
                const firstGroups = groupPlayers.map((player) => {
                    const qualifier = preparedGroup2.qualifiers.find((entry) => entry.name === player.name);
                    return qualifier?.group;
                });
                expect(new Set(firstGroups).size).toBe(firstGroups.length);
            });

            completeGroupStage(preparedGroup2.group2Pairs, preparedGroup2.groups2);
            const group2Qualifiers = getQualifiedPlayers(
                preparedGroup2.groups2,
                preparedGroup2.group2Pairs,
                'restart',
                2
            );
            expect(group2Qualifiers).toHaveLength(4);
            expect(getKnockoutPlayerCountTwoGroup(16)).toBe(4);
            expect(getKnockoutPlayerCountForType(CHAMPIONS_LEAGUE_TWO_GROUP_TYPE, 16)).toBe(4);

            const knockoutStages = generateKnockoutBracketStages(
                group2Qualifiers,
                getKnockoutPlayerCountTwoGroup(16),
                'bo-1',
                'bo-1',
                'bo-1'
            );
            expect(knockoutStages[0]).toHaveLength(2);
            expect(knockoutStages[0][0].stage).toBe('Semi-final');

            const storedBracket = [preparedGroup1.groupPairs, preparedGroup2.group2Pairs, ...knockoutStages];
            expect(storedBracket[0]).toHaveLength(24);
            expect(storedBracket[1]).toHaveLength(12);
        });

        test('assignQualifiersToSecondGroups avoids same first-group teammates', () => {
            const qualifiers = [
                { name: 'W1', group: 'A', place: 1, points: 9 },
                { name: 'W2', group: 'B', place: 1, points: 8 },
                { name: 'W3', group: 'C', place: 1, points: 7 },
                { name: 'W4', group: 'D', place: 1, points: 6 },
                { name: 'R1', group: 'A', place: 2, points: 5 },
                { name: 'R2', group: 'B', place: 2, points: 4 },
                { name: 'R3', group: 'C', place: 2, points: 3 },
                { name: 'R4', group: 'D', place: 2, points: 2 }
            ];

            const assignment = assignQualifiersToSecondGroups(qualifiers, { shuffle: false });
            expect(assignment.valid).toBe(true);
            Object.values(assignment.groups2).forEach((groupPlayers) => {
                const firstGroups = groupPlayers.map((player) => player.group);
                expect(new Set(firstGroups).size).toBe(firstGroups.length);
            });
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

        test('WB Final and Grand Final use tournamentPlayoffGamesFinal for type and game count', () => {
            const stages = createDoubleElimPlayoffPairs('3', '5', players, 8);
            const labels = getDoubleElimStageLabels(8);
            const quarter = stages[labels.indexOf('Quarter-final')][0];
            const wbFinal = stages[labels.indexOf('WB Final')][0];
            const grandFinal = stages[labels.indexOf('Grand Final')][0];
            const lbFinal = stages[labels.indexOf('LB Final')][0];

            expect(quarter.type).toBe('bo-3');
            expect(quarter.games).toHaveLength(3);
            expect(quarter.bracketSide).toBe('winners');
            expect(lbFinal.type).toBe('bo-3');
            expect(lbFinal.games).toHaveLength(3);
            expect(lbFinal.bracketSide).toBe('losers');
            expect(wbFinal.type).toBe('bo-5');
            expect(wbFinal.games).toHaveLength(5);
            expect(wbFinal.bracketSide).toBe('winners');
            expect(grandFinal.type).toBe('bo-5');
            expect(grandFinal.games).toHaveLength(5);
            expect(grandFinal.bracketSide).toBe('grand_final');
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

        test('bracket structure has correct pair counts for every supported size', () => {
            const expectedCounts = {
                4: { 'Semi-final': 2, 'WB Final': 1, 'LB R1': 1, 'LB Final': 1, 'Grand Final': 1 },
                8: {
                    'Quarter-final': 4,
                    'Semi-final': 2,
                    'WB Final': 1,
                    'LB R1': 2,
                    'LB R2': 2,
                    'LB R3': 1,
                    'LB Final': 1,
                    'Grand Final': 1
                },
                16: {
                    '1/8 Final': 8,
                    'Quarter-final': 4,
                    'Semi-final': 2,
                    'WB Final': 1,
                    'LB R1': 4,
                    'LB R2': 4,
                    'LB R3': 2,
                    'LB R4': 2,
                    'LB R5': 1,
                    'LB Final': 1,
                    'Grand Final': 1
                },
                32: {
                    '1/16 Final': 16,
                    '1/8 Final': 8,
                    'Quarter-final': 4,
                    'Semi-final': 2,
                    'WB Final': 1,
                    'LB R1': 8,
                    'LB R2': 8,
                    'LB R3': 4,
                    'LB R4': 4,
                    'LB R5': 2,
                    'LB R6': 2,
                    'LB R7': 1,
                    'LB Final': 1,
                    'Grand Final': 1
                }
            };

            DOUBLE_ELIM_SIZES.forEach((size) => {
                const labels = getDoubleElimStageLabels(size);
                const stages = createDoubleElimPlayoffPairs('1', '1', null, size);
                expect(stages).toHaveLength(labels.length);
                labels.forEach((label, index) => {
                    expect({ size, label, count: stages[index].length }).toEqual({
                        size,
                        label,
                        count: expectedCounts[size][label]
                    });
                });
            });
        });

        test('LB consolidation round keeps pair index (LB R1 pair 1 winner → LB R2 pair 1 team1)', () => {
            const stages = createDoubleElimPlayoffPairs('1', '1', players, 8);
            const labels = getDoubleElimStageLabels(8);
            const updatedPairs = stages.map((stage) => stage.map((pair) => ({ ...pair })));

            const promoted = promoteLoserBracketWinner({
                updatedPairs,
                stageLabels: labels,
                currentStage: 'LB R1',
                pairIndex: 1,
                winner: 'LoserC',
                winnerRating: '1400',
                winnerStars: 0
            });

            expect(promoted).toBe(true);

            const lbR2Index = labels.indexOf('LB R2');
            expect(updatedPairs[lbR2Index][1].team1).toBe('LoserC');
            expect(updatedPairs[lbR2Index][0].team1).toBe('TBD');
            expect(updatedPairs[lbR2Index][0].team2).toBe('TBD');
        });

        test('32-player winner bracket losers drop into the correct LB rounds', () => {
            const size = 32;
            const labels = getDoubleElimStageLabels(size);
            const stages = createDoubleElimPlayoffPairs('1', '1', null, size);
            const updatedPairs = stages.map((stage) => stage.map((pair) => ({ ...pair })));

            const drop = (currentStage, pairIndex, loser) =>
                dropLoserToBracket({
                    updatedPairs,
                    stageLabels: labels,
                    currentStage,
                    pairIndex,
                    loser,
                    loserRating: '1500',
                    loserStars: 0,
                    maxPlayers: size
                });

            // First round (1/16): losers pair up in LB R1
            expect(drop('1/16 Final', 0, 'P1')).toBe(true);
            expect(drop('1/16 Final', 5, 'P2')).toBe(true);
            const lbR1 = updatedPairs[labels.indexOf('LB R1')];
            expect(lbR1[0].team1).toBe('P1');
            expect(lbR1[2].team2).toBe('P2');

            // 1/8 losers → LB R2, Quarter-final losers → LB R4, Semi-final losers → LB R6
            expect(drop('1/8 Final', 3, 'P3')).toBe(true);
            expect(updatedPairs[labels.indexOf('LB R2')][3].team2).toBe('P3');

            expect(drop('Quarter-final', 1, 'P4')).toBe(true);
            expect(updatedPairs[labels.indexOf('LB R4')][1].team2).toBe('P4');

            expect(drop('Semi-final', 0, 'P5')).toBe(true);
            expect(updatedPairs[labels.indexOf('LB R6')][0].team2).toBe('P5');

            expect(drop('WB Final', 0, 'P6')).toBe(true);
            expect(updatedPairs[labels.indexOf('LB Final')][0].team2).toBe('P6');
        });

        test('full 8-player double elimination flow fills every stage through the Grand Final', () => {
            const size = 8;
            const labels = getDoubleElimStageLabels(size);
            const stages = createDoubleElimPlayoffPairs('1', '1', players, size);
            const updatedPairs = stages.map((stage) => stage.map((pair) => ({ ...pair })));

            const stageIdx = (label) => labels.indexOf(label);
            const drop = (currentStage, pairIndex, loser) =>
                dropLoserToBracket({
                    updatedPairs,
                    stageLabels: labels,
                    currentStage,
                    pairIndex,
                    loser,
                    loserRating: '1500',
                    loserStars: 0,
                    maxPlayers: size
                });
            const promoteLb = (currentStage, pairIndex, winner) =>
                promoteLoserBracketWinner({
                    updatedPairs,
                    stageLabels: labels,
                    currentStage,
                    pairIndex,
                    winner,
                    winnerRating: '1500',
                    winnerStars: 0
                });
            // Mirrors the winner-side slot mapping used by tournamentsBracket.js
            const promoteWb = (nextLabel, fromPairIndex, winner, mergePairs = true) => {
                const target = updatedPairs[stageIdx(nextLabel)][mergePairs ? Math.floor(fromPairIndex / 2) : 0];
                const slot = mergePairs
                    ? fromPairIndex % 2 === 0
                        ? 'team1'
                        : 'team2'
                    : fromPairIndex === 0
                      ? 'team1'
                      : 'team2';
                target[slot] = winner;
            };

            // Quarter-finals: A,C,E,G win; B,D,F,H drop to LB R1
            const qfWinners = ['A', 'C', 'E', 'G'];
            const qfLosers = ['B', 'D', 'F', 'H'];
            qfWinners.forEach((winner, index) => promoteWb('Semi-final', index, winner));
            qfLosers.forEach((loser, index) => expect(drop('Quarter-final', index, loser)).toBe(true));

            const lbR1 = updatedPairs[stageIdx('LB R1')];
            expect([lbR1[0].team1, lbR1[0].team2]).toEqual(['B', 'D']);
            expect([lbR1[1].team1, lbR1[1].team2]).toEqual(['F', 'H']);

            // Semi-finals: A and E win; C and G drop to LB R2 team2
            promoteWb('WB Final', 0, 'A', false);
            promoteWb('WB Final', 1, 'E', false);
            expect(drop('Semi-final', 0, 'C')).toBe(true);
            expect(drop('Semi-final', 1, 'G')).toBe(true);

            // LB R1: B and F win, each keeps their pair index into LB R2 team1
            expect(promoteLb('LB R1', 0, 'B')).toBe(true);
            expect(promoteLb('LB R1', 1, 'F')).toBe(true);

            const lbR2 = updatedPairs[stageIdx('LB R2')];
            expect([lbR2[0].team1, lbR2[0].team2]).toEqual(['B', 'C']);
            expect([lbR2[1].team1, lbR2[1].team2]).toEqual(['F', 'G']);

            // LB R2: B and F win and merge into LB R3
            expect(promoteLb('LB R2', 0, 'B')).toBe(true);
            expect(promoteLb('LB R2', 1, 'F')).toBe(true);

            const lbR3 = updatedPairs[stageIdx('LB R3')];
            expect([lbR3[0].team1, lbR3[0].team2]).toEqual(['B', 'F']);

            // LB R3: B wins and takes team1 of LB Final
            expect(promoteLb('LB R3', 0, 'B')).toBe(true);
            expect(updatedPairs[stageIdx('LB Final')][0].team1).toBe('B');

            // WB Final: A wins and takes team1 of Grand Final; E drops to LB Final team2
            promoteWb('Grand Final', 0, 'A', false);
            expect(drop('WB Final', 0, 'E')).toBe(true);

            const lbFinal = updatedPairs[stageIdx('LB Final')];
            expect([lbFinal[0].team1, lbFinal[0].team2]).toEqual(['B', 'E']);

            // LB Final: B wins and joins the Grand Final; E finishes 3rd
            expect(promoteLb('LB Final', 0, 'B')).toBe(true);

            const grandFinal = updatedPairs[stageIdx('Grand Final')];
            expect([grandFinal[0].team1, grandFinal[0].team2]).toEqual(['A', 'B']);

            // No stage should be left with an unfilled competitive slot
            labels.forEach((label, index) => {
                updatedPairs[index].forEach((pair) => {
                    expect(pair.team1).not.toBe('TBD');
                    expect(pair.team2).not.toBe('TBD');
                });
            });
        });
    });
});
