import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TournamentHub from '../components/tournaments/homm3/TournamentHub/TournamentHub';
import {
    buildHubCupMechanics,
    buildHubRestartStats,
    buildTournamentHubSummary,
    classifyRestartUsage,
    collectHubMatches,
    collectHubParticipants,
    countHubRegisteredPlayers,
    DEFAULT_TOURNAMENT_HUB_TAB,
    parseTournamentHubTab,
    restartCoefficient,
    setTournamentHubTabParam
} from '../utils/tournamentHub';

const startedCup = {
    id: 'cup-1',
    name: 'Heroes Cup',
    date: '2030-06-04T16:00:00.000Z',
    maxPlayers: 8,
    communityFundingUsd: 250,
    type: 'kick-off',
    players: {
        a: { name: 'Alice', siteUserId: 'u1' },
        b: { name: 'Bob', siteUserId: 'u2' },
        c: { name: 'TBD' }
    },
    bracket: {
        playoffPairs: [
            [
                {
                    team1: 'Alice',
                    team2: 'Bob',
                    winner: 'Alice',
                    score1: 2,
                    score2: 1,
                    stage: 'Semifinal',
                    games: [
                        {
                            gameWinner: 'Alice',
                            castle1: 'Castle',
                            castle2: 'Rampart',
                            color1: 'red',
                            color2: 'blue',
                            gold1: 500,
                            gold2: -500,
                            restart1_111: 1,
                            restart1_112: 0,
                            restart2_111: 0,
                            restart2_112: 0
                        },
                        {
                            gameWinner: 'Bob',
                            castle1: 'Inferno',
                            castle2: 'Dungeon',
                            color1: 'red',
                            color2: 'blue',
                            gold1: -200,
                            gold2: 200,
                            restart1_111: 2,
                            restart1_112: 0,
                            restart2_111: 0,
                            restart2_112: 1
                        },
                        {
                            gameWinner: 'Alice',
                            castle1: 'Castle',
                            castle2: 'Tower',
                            color1: 'red',
                            color2: 'blue',
                            gold1: 100,
                            gold2: -100,
                            restart1_111: 0,
                            restart1_112: 0,
                            restart2_111: 1,
                            restart2_112: 0
                        }
                    ]
                }
            ]
        ]
    }
};

const mockHubFetches = () => {
    global.fetch = jest.fn((url) => {
        if (String(url).includes('heroes3')) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ result: { factions: [] } }) });
    });
};

const renderHub = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('tournamentHub utils', () => {
    test('parses known tabs and falls back to overview', () => {
        expect(parseTournamentHubTab('matches')).toBe('matches');
        expect(parseTournamentHubTab('Participants')).toBe('participants');
        expect(parseTournamentHubTab('bogus')).toBe(DEFAULT_TOURNAMENT_HUB_TAB);
        expect(parseTournamentHubTab('')).toBe(DEFAULT_TOURNAMENT_HUB_TAB);
    });

    test('stores non-overview tabs in search params and drops overview', () => {
        const withStatus = new URLSearchParams('status=started&stage=0');
        expect(setTournamentHubTabParam(withStatus, 'statistics').toString()).toBe(
            'status=started&stage=0&tab=statistics'
        );

        const withTab = new URLSearchParams('status=started&tab=matches');
        expect(setTournamentHubTabParam(withTab, 'overview').toString()).toBe('status=started');
    });

    test('counts registered players and skips TBD seats', () => {
        expect(
            countHubRegisteredPlayers({
                players: {
                    a: { name: 'Alice' },
                    b: { name: 'TBD' },
                    c: { name: '  ' },
                    d: { name: 'Bob' }
                }
            })
        ).toBe(2);
    });

    test('builds overview summary from cup fields', () => {
        const items = buildTournamentHubSummary({
            date: '2030-06-04T16:00:00.000Z',
            maxPlayers: 16,
            communityFundingUsd: 750,
            players: { a: { name: 'Alice' }, b: { name: 'Bob' } },
            commentators: {
                u1: { name: 'Caster', isCommentating: true }
            }
        });

        expect(items.map((item) => item.label)).toEqual(['Date', 'Players', 'Prize pool', 'Stream']);
        expect(items.find((item) => item.label === 'Players').value).toBe('2 / 16');
        expect(items.find((item) => item.label === 'Prize pool').value).toBe('$750');
        expect(items.find((item) => item.label === 'Stream').value).toBe('On air');
    });

    test('collects finished matches from existing bracket data', () => {
        const matches = collectHubMatches(startedCup);
        expect(matches).toHaveLength(1);
        expect(matches[0]).toMatchObject({
            team1: 'Alice',
            team2: 'Bob',
            winner: 'Alice',
            score1: 2,
            score2: 1,
            maps: 3,
            status: 'finished'
        });
        expect(matches[0].href).toContain('/tournaments/homm3/cup-1');
    });

    test('builds participant records from finished series on existing cups', () => {
        const participants = collectHubParticipants(startedCup);
        expect(participants.map((player) => player.name)).toEqual(['Alice', 'Bob']);
        expect(participants[0]).toMatchObject({ name: 'Alice', wins: 1, losses: 0, mapsWon: 2, mapsLost: 1 });
        expect(participants[1]).toMatchObject({ name: 'Bob', wins: 0, losses: 1, mapsWon: 1, mapsLost: 2 });
    });

    test('classifies restart usage with the same coefficient as player profiles', () => {
        expect(classifyRestartUsage(0, 0)).toBe('none');
        expect(classifyRestartUsage(1, 0)).toBe('111x1');
        expect(classifyRestartUsage(2, 0)).toBe('111x2');
        expect(classifyRestartUsage(1, 1)).toBe('112');
        expect(restartCoefficient(1, 0)).toBe(1.5);
        expect(restartCoefficient(2, 0)).toBe(2);
        expect(restartCoefficient(0, 1)).toBe(2);
    });

    test('rolls up gold trades and flag win rates from existing maps', () => {
        const mechanics = buildHubCupMechanics(startedCup);
        expect(mechanics.maps).toBe(3);
        expect(mechanics.averageGold).toBeCloseTo(266.666, 2);
        expect(mechanics.redWinRate).toBeCloseTo(66.666, 2);
        expect(mechanics.blueWinRate).toBeCloseTo(33.333, 2);
    });

    test('builds cup restart buckets and per-player ranking from existing maps', () => {
        const { cup, players } = buildHubRestartStats(startedCup);
        expect(cup).toMatchObject({
            maps: 6,
            mapsNone: 2,
            maps111x1: 2,
            maps111x2: 1,
            maps112: 1,
            averageCoefficient: '1.50'
        });
        expect(players.map((player) => player.name)).toEqual(['Alice', 'Bob']);
        expect(players[0]).toMatchObject({
            name: 'Alice',
            maps: 3,
            total111: 3,
            total112: 0,
            averageCoefficient: '1.50',
            siteUserId: 'u1'
        });
        expect(players[1]).toMatchObject({
            name: 'Bob',
            maps: 3,
            total111: 1,
            total112: 1,
            averageCoefficient: '1.50',
            siteUserId: 'u2'
        });
    });
});

describe('TournamentHub', () => {
    afterEach(() => {
        delete global.fetch;
    });

    test('renders cup section tabs and overview summary', () => {
        renderHub(
            <TournamentHub tournament={startedCup} activeTab="overview">
                <p>Bracket goes here</p>
            </TournamentHub>
        );

        expect(screen.getByRole('tablist', { name: 'Cup sections' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByText('Bracket goes here')).toBeInTheDocument();
        expect(screen.getByText('2 / 8')).toBeInTheDocument();
    });

    test('shows existing cup matches on the matches tab', () => {
        renderHub(
            <TournamentHub tournament={startedCup} activeTab="matches">
                <p>Bracket goes here</p>
            </TournamentHub>
        );

        const panel = document.getElementById('cup-hub-panel-matches');
        expect(screen.getByRole('tab', { name: 'Matches' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByText('Bracket goes here')).not.toBeVisible();
        expect(within(panel).getByText('Alice')).toBeVisible();
        expect(within(panel).getByText('2 : 1')).toBeVisible();
        expect(within(panel).getByText('3 maps')).toBeVisible();
    });

    test('shows existing cup roster on the participants tab', () => {
        renderHub(
            <TournamentHub tournament={startedCup} activeTab="participants">
                <p>Bracket goes here</p>
            </TournamentHub>
        );

        const panel = document.getElementById('cup-hub-panel-participants');
        expect(within(panel).getByText('Alice')).toBeVisible();
        expect(within(panel).getByText('1–0')).toBeVisible();
        expect(within(panel).queryByText('TBD')).not.toBeInTheDocument();
    });

    test('does not fetch tournament meta until the statistics tab is open', () => {
        mockHubFetches();

        renderHub(
            <TournamentHub tournament={startedCup} activeTab="overview">
                <p>Bracket goes here</p>
            </TournamentHub>
        );

        expect(screen.queryByText('Tournament Meta')).not.toBeInTheDocument();
        expect(screen.queryByText('Gold and flags')).not.toBeInTheDocument();
        expect(global.fetch).not.toHaveBeenCalled();
    });

    test('shows castle meta, gold, and flags on the statistics tab', async () => {
        mockHubFetches();

        renderHub(
            <TournamentHub tournament={startedCup} activeTab="statistics">
                <p>Bracket goes here</p>
            </TournamentHub>
        );

        const panel = document.getElementById('cup-hub-panel-statistics');
        expect(within(panel).getByText('Tournament Meta')).toBeVisible();
        expect(within(panel).getByText('Gold and flags')).toBeVisible();
        expect(within(panel).getByText('+267')).toBeVisible();
        expect(within(panel).getByText('66.7%')).toBeVisible();
        expect(within(panel).getByText('33.3%')).toBeVisible();
        await waitFor(() => {
            expect(within(panel).getByText('Rampart')).toBeVisible();
        });
        expect(global.fetch).toHaveBeenCalled();
    });

    test('shows restart breakdown on the restarts tab', () => {
        renderHub(
            <TournamentHub tournament={startedCup} activeTab="restarts">
                <p>Bracket goes here</p>
            </TournamentHub>
        );

        const panel = document.getElementById('cup-hub-panel-restarts');
        expect(within(panel).getByText('Avg coefficient')).toBeVisible();
        expect(within(panel).getAllByText('1.50').length).toBeGreaterThan(0);
        expect(within(panel).getByText('111 x1')).toBeVisible();
        expect(within(panel).getByRole('link', { name: 'Alice' })).toHaveAttribute('href', '/players/u1');
        expect(within(panel).getAllByText('3').length).toBeGreaterThan(0);
    });

    test('notifies parent when a tab is clicked', () => {
        const onTabChange = jest.fn();

        renderHub(
            <TournamentHub tournament={startedCup} activeTab="overview" onTabChange={onTabChange}>
                <p>Bracket goes here</p>
            </TournamentHub>
        );

        fireEvent.click(screen.getByRole('tab', { name: 'Restarts' }));
        expect(onTabChange).toHaveBeenCalledWith('restarts');
    });
});
