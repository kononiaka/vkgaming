/**
 * End-to-end tests for Live Arena (match hub + Twitch broadcasting).
 * Chains Firebase mock data → match extraction → live status → UI actions.
 */

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { fetchMatchCenterMatches } from '../utils/matchCenterData';
import { fetchTwitchLiveLogins } from '../api/twitchStreams';
import { extractTwitchLogin, getTwitchEmbedUrl, getTwitchWatchUrl, pickMatchStreamLogin } from '../utils/twitchUtils';
import LiveArenaMatchRow from '../components/LiveArena/LiveArenaMatchRow';

// Mirrors functions/telegram.js matchCenterLink (not imported — firebase-functions breaks Jest)
const matchCenterLink = (siteUrl) => `${siteUrl.replace(/\/$/, '')}/live`;

const TOURNAMENT_ID = 'cup-1';
const SCHEDULED_AT = '2026-06-04T14:00:00.000Z';

const mockUsers = {
    u1: {
        enteredNickname: 'Alice',
        ratings: '1500',
        twitch: 'https://www.twitch.tv/alice_streams',
        countryCode: 'PL'
    },
    u2: {
        enteredNickname: 'Bob',
        ratings: '1480',
        twitch: 'https://www.twitch.tv/bobcasts',
        countryCode: 'UA'
    }
};

const mockTournaments = {
    [TOURNAMENT_ID]: {
        name: 'Summer Cup',
        status: 'Started!',
        isPublic: true,
        date: SCHEDULED_AT,
        players: {
            p1: { name: 'Alice', ratings: '1500', stars: 1 },
            p2: { name: 'Bob', ratings: '1480', stars: 0 }
        },
        bracket: {
            playoffPairs: [
                [
                    {
                        stage: 'Semi-final',
                        team1: 'Alice',
                        team2: 'Bob',
                        type: 'bo-3',
                        score1: 0,
                        score2: 0,
                        scheduledAt: SCHEDULED_AT,
                        games: [
                            {
                                gameId: 0,
                                castle1: 'Castle',
                                castle2: 'Rampart',
                                castleWinner: '',
                                gameStatus: 'Not Started'
                            }
                        ]
                    },
                    {
                        stage: 'Final',
                        team1: 'TBD',
                        team2: 'TBD',
                        type: 'bo-3',
                        games: [{ gameId: 0, castle1: '', castle2: '' }]
                    }
                ]
            ]
        }
    },
    privateCup: {
        name: 'Private',
        status: 'Started!',
        isPublic: false,
        bracket: {
            playoffPairs: [[{ team1: 'X', team2: 'Y', games: [] }]]
        }
    }
};

const selectFeaturedMatch = (liveGames, liveLogins) => {
    const onAirLive = liveGames.find((match) => {
        const login = pickMatchStreamLogin(match, liveLogins);
        return login && liveLogins.has(login);
    });
    return onAirLive || liveGames[0] || null;
};

const filterOnAirMatches = (matches, liveLogins) =>
    matches.filter((match) => {
        const login = pickMatchStreamLogin(match, liveLogins);
        return login && liveLogins.has(login);
    });

describe('Live Arena E2E flow', () => {
    beforeEach(() => {
        global.fetch = jest.fn((url) => {
            if (String(url).includes('/tournaments/heroes3.json')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockTournaments)
                });
            }
            if (String(url).includes('/users.json')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockUsers)
                });
            }
            if (String(url).includes('/twitchStreamStatus')) {
                return Promise.resolve({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            result: { liveLogins: ['alice_streams'] }
                        })
                });
            }
            return Promise.resolve({ ok: false, json: () => Promise.resolve(null) });
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('loads live map + twitch logins from tournament data', async () => {
        const { liveGames, upcomingMatches } = await fetchMatchCenterMatches();

        expect(liveGames).toHaveLength(1);
        expect(upcomingMatches).toHaveLength(0);

        const live = liveGames[0];
        expect(live.tournamentId).toBe(TOURNAMENT_ID);
        expect(live.team1).toBe('Alice');
        expect(live.team2).toBe('Bob');
        expect(live.variant).toBe('live');
        expect(live.team1TwitchLogin).toBe('alice_streams');
        expect(live.team2TwitchLogin).toBe('bobcasts');
        expect(live.streamLogin).toBe('alice_streams');
    });

    test('detects Twitch live channels and picks featured on-air stream', async () => {
        const { liveGames } = await fetchMatchCenterMatches();
        const liveLogins = await fetchTwitchLiveLogins(
            liveGames.flatMap((match) => [match.streamLogin, match.team1TwitchLogin, match.team2TwitchLogin])
        );

        expect(liveLogins.has('alice_streams')).toBe(true);
        expect(liveLogins.has('bobcasts')).toBe(false);

        const featured = selectFeaturedMatch(liveGames, liveLogins);
        const channel = pickMatchStreamLogin(featured, liveLogins);

        expect(channel).toBe('alice_streams');
        expect(getTwitchWatchUrl(channel)).toBe('https://www.twitch.tv/alice_streams');
        expect(getTwitchEmbedUrl(channel)).toContain('player.twitch.tv');
        expect(getTwitchEmbedUrl(channel)).toContain('channel=alice_streams');
    });

    test('upcoming fixture pipeline attaches watch links from player profiles', async () => {
        const upcomingOnlyTournaments = {
            cup2: {
                name: 'Evening League',
                status: 'Started!',
                isPublic: true,
                players: {
                    p1: { name: 'Alice', ratings: '1500' },
                    p2: { name: 'Bob', ratings: '1480' }
                },
                bracket: {
                    playoffPairs: [
                        [
                            {
                                stage: 'League A · Round 2',
                                team1: 'Alice',
                                team2: 'Bob',
                                type: 'bo-2',
                                score1: 0,
                                score2: 0,
                                scheduledAt: '2030-06-04T16:00:00.000Z',
                                games: [{ gameId: 0, castle1: '', castle2: '' }]
                            }
                        ]
                    ]
                }
            }
        };

        global.fetch = jest.fn((url) => {
            if (String(url).includes('/tournaments/heroes3.json')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve(upcomingOnlyTournaments) });
            }
            if (String(url).includes('/users.json')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve(mockUsers) });
            }
            return Promise.resolve({ ok: false, json: () => Promise.resolve(null) });
        });

        const { liveGames, upcomingMatches } = await fetchMatchCenterMatches();

        expect(liveGames).toHaveLength(0);
        expect(upcomingMatches).toHaveLength(1);

        const fixture = upcomingMatches[0];
        expect(fixture.variant).toBe('upcoming');
        expect(fixture.team1TwitchLogin).toBe('alice_streams');
        expect(getTwitchWatchUrl(fixture.streamLogin)).toBe('https://www.twitch.tv/alice_streams');
    });

    test('treats past scheduled time as live even without castles selected', async () => {
        const scheduledLiveTournaments = {
            cup3: {
                name: 'Morning Cup',
                status: 'Started!',
                isPublic: true,
                players: {
                    p1: { name: 'Alice', ratings: '1500' },
                    p2: { name: 'Bob', ratings: '1480' }
                },
                bracket: {
                    playoffPairs: [
                        [
                            {
                                stage: 'Round 1',
                                team1: 'Alice',
                                team2: 'Bob',
                                type: 'bo-1',
                                score1: 0,
                                score2: 0,
                                scheduledAt: '2020-01-01T12:00:00.000Z',
                                games: [{ gameId: 0, castle1: '', castle2: '', gameStatus: 'Not Started' }]
                            }
                        ]
                    ]
                }
            }
        };

        global.fetch = jest.fn((url) => {
            if (String(url).includes('/tournaments/heroes3.json')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve(scheduledLiveTournaments) });
            }
            if (String(url).includes('/users.json')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve(mockUsers) });
            }
            return Promise.resolve({ ok: false, json: () => Promise.resolve(null) });
        });

        const { liveGames, upcomingMatches } = await fetchMatchCenterMatches();

        expect(liveGames).toHaveLength(1);
        expect(upcomingMatches).toHaveLength(0);
        expect(liveGames[0].variant).toBe('live');
        expect(liveGames[0].castle1).toBeFalsy();
    });

    test('treats restart phase as live before castles are locked in', async () => {
        const restartTournaments = {
            cup4: {
                name: 'Jebus Cross Cup',
                status: 'Started!',
                isPublic: true,
                players: {
                    p1: { name: 'Alice', ratings: '1500' },
                    p2: { name: 'Bob', ratings: '1480' }
                },
                bracket: {
                    playoffPairs: [
                        [
                            {
                                stage: 'Semi-final',
                                team1: 'Alice',
                                team2: 'Bob',
                                type: 'bo-1',
                                score1: 0,
                                score2: 0,
                                scheduledAt: '2030-06-04T16:00:00.000Z',
                                games: [
                                    {
                                        gameId: 0,
                                        castle1: '',
                                        castle2: '',
                                        gameStatus: 'In Progress',
                                        restartsFinished: false,
                                        restart1_111: 1
                                    }
                                ]
                            }
                        ]
                    ]
                }
            }
        };

        global.fetch = jest.fn((url) => {
            if (String(url).includes('/tournaments/heroes3.json')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve(restartTournaments) });
            }
            if (String(url).includes('/users.json')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve(mockUsers) });
            }
            return Promise.resolve({ ok: false, json: () => Promise.resolve(null) });
        });

        const { liveGames, upcomingMatches } = await fetchMatchCenterMatches();

        expect(liveGames).toHaveLength(1);
        expect(upcomingMatches).toHaveLength(0);
        expect(liveGames[0].variant).toBe('live');
    });

    test('on-air match row renders Watch + Bracket actions', () => {
        const match = {
            tournamentId: TOURNAMENT_ID,
            tournamentName: 'Summer Cup',
            stageLabel: 'Semi-final',
            team1: 'Alice',
            team2: 'Bob',
            stageIndex: 0,
            pairIndex: 0,
            team1TwitchLogin: 'alice_streams',
            team2TwitchLogin: 'bobcasts',
            streamLogin: 'alice_streams',
            scheduledAt: SCHEDULED_AT,
            variant: 'live'
        };

        render(
            <MemoryRouter>
                <LiveArenaMatchRow match={match} liveLogins={new Set(['alice_streams'])} />
            </MemoryRouter>
        );

        expect(screen.getByText('ON AIR')).toBeInTheDocument();
        expect(screen.getByText('Summer Cup')).toBeInTheDocument();
        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.getByText('Bob')).toBeInTheDocument();

        const watch = screen.getByRole('link', { name: 'Watch' });
        expect(watch).toHaveAttribute('href', 'https://www.twitch.tv/alice_streams');
        expect(watch).toHaveAttribute('target', '_blank');

        const bracket = screen.getByRole('link', { name: 'Bracket' });
        expect(bracket.getAttribute('href')).toContain(`/tournaments/homm3/${TOURNAMENT_ID}`);
        expect(bracket.getAttribute('href')).toContain('stage=0');
        expect(bracket.getAttribute('href')).toContain('pair=0');
    });

    test('telegram match center links to Live Arena route', () => {
        expect(matchCenterLink('https://konoplay.com')).toBe('https://konoplay.com/live');
        expect(matchCenterLink('https://konoplay.com/')).toBe('https://konoplay.com/live');
    });

    test('ignores private tournaments in match hub data', async () => {
        const { liveGames } = await fetchMatchCenterMatches();
        expect(liveGames.every((match) => match.tournamentId !== 'privateCup')).toBe(true);
    });

    test('on-air filter only includes matches with live Twitch logins', async () => {
        const { liveGames } = await fetchMatchCenterMatches();
        const liveLogins = await fetchTwitchLiveLogins(['alice_streams', 'bobcasts']);

        const onAir = filterOnAirMatches(liveGames, liveLogins);
        expect(onAir).toHaveLength(1);
        expect(pickMatchStreamLogin(onAir[0], liveLogins)).toBe('alice_streams');
    });

    test('fetchTwitchLiveLogins returns empty set when API fails', async () => {
        global.fetch = jest.fn(() => Promise.resolve({ ok: false }));

        const liveLogins = await fetchTwitchLiveLogins(['alice_streams']);
        expect(liveLogins.size).toBe(0);
    });

    test('extractTwitchLogin handles @handle and bare login', () => {
        expect(extractTwitchLogin('@StreamerName')).toBe('streamername');
        expect(extractTwitchLogin('plain_login')).toBe('plain_login');
    });
});
