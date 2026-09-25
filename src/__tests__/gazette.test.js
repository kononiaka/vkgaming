import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Gazette from '../components/Gazette/Gazette';
import AuthContext from '../store/auth-context';
import {
    buildGazetteFacts,
    composeGazetteIssue,
    describeGazetteEvent,
    isGazetteTickerCopy,
    listGazetteIssues,
    gazetteArchiveIdsForIssue,
    nextPublishedGazetteIssue,
    orientGazetteScoreline,
    preferMatchingGazetteDraft,
    previewGazetteIssue,
    resolveGazetteIssue,
    sanitizeGazetteIssue,
    selectGazetteFacts,
    unpublishedGazetteEvents
} from '../utils/gazette';
import * as gazetteApi from '../api/gazette';

jest.mock('../api/gazette', () => ({
    fetchGazetteCurrent: jest.fn(),
    fetchGazetteDraft: jest.fn(),
    fetchGazetteFacts: jest.fn(),
    fetchGazetteIssues: jest.fn(),
    generateGazetteDraft: jest.fn(),
    publishGazetteIssue: jest.fn(),
    discardGazetteDraft: jest.fn(),
    deleteGazetteIssue: jest.fn()
}));

jest.mock('../api/api', () => ({
    lookForUserId: () => Promise.resolve(null),
    getAvatar: () => Promise.resolve(null)
}));

const quietCup = {
    name: 'Heroes Cup',
    status: 'Started!',
    isPublic: true,
    maxPlayers: 8,
    communityFundingUsd: 250,
    players: {
        a: { name: 'Alice', stars: 3, ratings: 1500 },
        b: { name: 'Bob', stars: 3, ratings: 1500 }
    },
    bracket: {
        playoffPairs: [
            [
                {
                    team1: 'Alice',
                    team2: 'Bob',
                    stage: 'Quarterfinal',
                    stars1: 3,
                    stars2: 3,
                    ratings1: 1500,
                    ratings2: 1500,
                    winner: 'Alice',
                    games: [{ gameWinner: 'Alice' }]
                }
            ]
        ]
    }
};

const underdogCup = {
    ...quietCup,
    bracket: {
        playoffPairs: [
            [
                {
                    team1: 'Alice',
                    team2: 'Bob',
                    stage: 'Quarterfinal',
                    stars1: 2,
                    stars2: 5,
                    ratings1: 1400,
                    ratings2: 1800,
                    winner: 'Alice',
                    games: [
                        {
                            gameWinner: 'Alice',
                            castle1: 'Castle',
                            castle2: 'Rampart',
                            color1: 'red',
                            color2: 'blue',
                            gold1: 1200,
                            gold2: -400,
                            restart1_111: 1,
                            restart1_112: 0,
                            restart2_111: 0,
                            restart2_112: 0
                        }
                    ]
                }
            ]
        ]
    }
};

const donationCup = {
    ...quietCup,
    prizePoolHistory: {
        gift1: {
            type: 'donation',
            donorUsername: 'Patron',
            amountUsd: 120,
            at: '2026-08-24T10:00:00.000Z'
        },
        seed1: {
            type: 'host_seed',
            donorUsername: 'Host',
            amountUsd: 500,
            at: '2026-08-24T09:00:00.000Z'
        }
    }
};

const newsroomCup = {
    ...underdogCup,
    prizePoolHistory: donationCup.prizePoolHistory
};

const finalsCup = {
    ...quietCup,
    bracket: {
        playoffPairs: [
            [
                {
                    team1: 'Alice',
                    team2: 'Bob',
                    stage: 'Final',
                    games: [{ gameWinner: 'Alice' }]
                }
            ]
        ]
    }
};

describe('gazette utils', () => {
    test('stays quiet when maps are reported without an upset or gift', () => {
        const facts = buildGazetteFacts({
            hidden: { name: 'Secret', status: 'Started!', isPublic: false, players: { a: { name: 'Zed' } } },
            cup1: quietCup
        });

        expect(facts.story).toBe('idle');
        expect(facts.events).toEqual([]);
        const issue = composeGazetteIssue(facts);
        expect(issue.headline).toBe('The arena is quiet');
        expect(issue.body).not.toMatch(/maps have been reported/i);
    });

    test('lists underdog and donation topics for the newsroom', () => {
        const facts = buildGazetteFacts({ cup1: newsroomCup });
        expect(facts.events.map((event) => event.kind)).toEqual(['underdog', 'donation']);
        expect(describeGazetteEvent(facts.events[0])).toContain('Upset · Alice over Bob · Castle vs Rampart');
        expect(describeGazetteEvent(facts.events[1])).toContain('Gift · Patron $120');

        const donationFacts = selectGazetteFacts(facts, facts.events[1].eventId);
        const issue = composeGazetteIssue(donationFacts);
        expect(issue.headline).toBe('{donor} fills the {cupName} purse');
        expect(unpublishedGazetteEvents(facts, facts.events[0].eventId)).toHaveLength(1);
        expect(previewGazetteIssue(facts, facts.events[0].eventId).headline).toBe('Alice upsets Bob');
        expect(previewGazetteIssue(facts, facts.events[0].eventId).body).toContain(
            'The series closed 1–0; Castle as red against Rampart; gold 1,200 to -400; restarts 1×1.11.'
        );
        expect(previewGazetteIssue(facts, facts.events[0].eventId).winnerCastle).toBe('Castle');
        expect(previewGazetteIssue(facts, facts.events[0].eventId).loserCastle).toBe('Rampart');
        expect(previewGazetteIssue(facts, facts.events[0].eventId).winnerColor).toBe('red');
        expect(previewGazetteIssue(facts, facts.events[0].eventId).winnerName).toBe('Alice');
        expect(previewGazetteIssue(facts, facts.events[0].eventId).loserName).toBe('Bob');
        expect(previewGazetteIssue(facts, facts.events[0].eventId).winnerStars).toBe(2);
        expect(previewGazetteIssue(facts, facts.events[0].eventId).loserStars).toBe(5);
        expect(isGazetteTickerCopy({ story: 'live', body: '9 maps have been reported.' })).toBe(true);
        expect(
            preferMatchingGazetteDraft(issue, { headline: '8 maps have been reported', story: 'live' }, facts.events[1].eventId)
                .headline
        ).toBe('{donor} fills the {cupName} purse');
    });

    test('lists archived issues newest first and keeps current if it is missing', () => {
        const issues = listGazetteIssues(
            {
                old: {
                    headline: 'Old gift',
                    body: 'A patron gave gold.',
                    dateLabel: '20-AUG-2026',
                    publishedAt: '2026-08-20T10:00:00.000Z'
                },
                newer: {
                    headline: 'Alice upsets Bob',
                    body: 'The form book is ash.',
                    dateLabel: '24-AUG-2026',
                    publishedAt: '2026-08-24T10:00:00.000Z'
                }
            },
            {
                headline: 'Finals set in Heroes Cup',
                body: 'One match remains.',
                dateLabel: '25-AUG-2026',
                publishedAt: '2026-08-25T10:00:00.000Z'
            }
        );

        expect(issues.map((issue) => issue.headline)).toEqual([
            'Finals set in Heroes Cup',
            'Alice upsets Bob',
            'Old gift'
        ]);
    });

    test('does not auto-print an unpublished event', () => {
        const facts = buildGazetteFacts({ cup1: underdogCup });
        expect(resolveGazetteIssue(null, facts)).toBeNull();

        const polished = {
            headline: '{underdog} shocks {favorite}',
            body: 'The form book is ash in {cupName}.',
            story: 'underdog',
            eventId: facts.event.eventId,
            tournamentId: 'cup1',
            href: '/tournaments/homm3/cup1?status=started'
        };
        const same = resolveGazetteIssue(polished, facts);
        expect(same.headline).toBe('Alice shocks Bob');
        expect(same.body).toContain('Heroes Cup');

        const staleMaps = {
            headline: 'Heroes Cup is underway',
            body: '8 maps have been reported. The purse stands at $12.213.',
            story: 'live',
            tournamentId: 'cup1'
        };
        const kept = resolveGazetteIssue(staleMaps, facts);
        expect(kept.headline).toBe('Heroes Cup is underway');
        expect(kept.body).toContain('maps have been reported');
    });

    test('omits map details when a reported game has no towns, gold, or restarts', () => {
        const facts = buildGazetteFacts({
            cup1: {
                ...quietCup,
                bracket: {
                    playoffPairs: [
                        [
                            {
                                team1: 'Alice',
                                team2: 'Bob',
                                stage: 'Quarterfinal',
                                stars1: 2,
                                stars2: 5,
                                ratings1: 1400,
                                ratings2: 1800,
                                winner: 'Alice',
                                games: [{ gameWinner: 'Alice' }]
                            }
                        ]
                    ]
                }
            }
        });
        expect(previewGazetteIssue(facts, facts.event.eventId).body).toBe(
            'Alice beat the favorite Bob in Heroes Cup. The series closed 1–0. The form book did not see it coming.'
        );
    });

    test('prints the winner score first when the underdog is team2', () => {
        const facts = buildGazetteFacts({
            cup1: {
                ...quietCup,
                name: 'Pre-release tournament',
                bracket: {
                    playoffPairs: [
                        [
                            {
                                team1: 'Chester (demo)',
                                team2: 'Condor_Awful (demo)',
                                stage: 'Quarterfinal',
                                stars1: 5,
                                stars2: 2,
                                ratings1: 1800,
                                ratings2: 1400,
                                winner: 'Condor_Awful (demo)',
                                score1: 0,
                                score2: 1,
                                games: [
                                    {
                                        gameWinner: 'Condor_Awful (demo)',
                                        castle1: 'Cove',
                                        castle2: 'Kronverk',
                                        color1: 'red',
                                        color2: 'blue',
                                        gold1: -2100,
                                        gold2: 2100,
                                        restart1_111: 1,
                                        restart1_112: 0,
                                        restart2_111: 2,
                                        restart2_112: 0
                                    }
                                ]
                            }
                        ]
                    ]
                }
            }
        });
        const issue = previewGazetteIssue(facts, facts.event.eventId);
        expect(issue.headline).toBe('Condor_Awful (demo) upsets Chester (demo)');
        expect(issue.winnerName).toBe('Condor_Awful (demo)');
        expect(issue.loserName).toBe('Chester (demo)');
        expect(issue.scoreline).toBe('1–0');
        expect(issue.body).toContain('The series closed 1–0');
        expect(issue.winnerColor).toBe('blue');
        expect(issue.loserColor).toBe('red');
        expect(orientGazetteScoreline('0–1')).toBe('1–0');
        expect(
            resolveGazetteIssue(
                {
                    headline: 'Condor_Awful (demo) upsets Chester (demo)',
                    body: 'The series closed 0–1; Kronverk as blue against Cove.',
                    scoreline: '0–1',
                    winnerName: 'Condor_Awful (demo)',
                    loserName: 'Chester (demo)'
                },
                null
            )
        ).toEqual(
            expect.objectContaining({
                scoreline: '1–0',
                body: 'The series closed 1–0; Kronverk as blue against Cove.'
            })
        );
    });

    test('composes a finals issue from selected facts', () => {
        const facts = buildGazetteFacts({ cup1: finalsCup });
        expect(facts.story).toBe('finals');
        const issue = composeGazetteIssue(facts, new Date('2026-08-24T12:00:00.000Z'));
        expect(issue.headline).toBe('Finals set in {cupName}');
        expect(issue.artKey).toBe('finals');
        expect(issue.dateLabel).toBe('24-AUG-2026');
    });

    test('rejects external links and unknown art', () => {
        const issue = sanitizeGazetteIssue({
            headline: '  Extra   spaces  ',
            body: 'Printed.',
            artKey: 'spaceship',
            href: 'https://evil.example'
        });
        expect(issue.headline).toBe('Extra spaces');
        expect(issue.artKey).toBe('crest');
        expect(issue.href).toBe('/tournaments/homm3');
    });

    test('picks the next published issue after a delete, skipping ticker copy', () => {
        const remaining = [
            {
                id: 'ticker',
                headline: 'Heroes Cup is underway',
                body: '8 maps have been reported.',
                story: 'live'
            },
            {
                id: 'gift',
                headline: 'Patron fills the purse',
                body: 'Gold changed the field.'
            }
        ];
        expect(nextPublishedGazetteIssue(remaining, { id: 'old' }).id).toBe('gift');
        expect(nextPublishedGazetteIssue([], { id: 'old' })).toBeNull();
    });

    test('resolves the Firebase archive key even when the listed issue id is stale', () => {
        const stored = {
            id: 'current',
            headline: 'Alice upsets Bob',
            body: 'The form book is ash.',
            dateLabel: '24-AUG-2026'
        };
        expect(
            gazetteArchiveIdsForIssue(
                { '-Nabc123': stored },
                { id: 'current', headline: stored.headline, body: stored.body, dateLabel: stored.dateLabel }
            )
        ).toEqual(['-Nabc123']);
        expect(gazetteArchiveIdsForIssue({ '-Nabc123': stored }, { ...stored, id: 'local-1' })).toEqual(['-Nabc123']);
    });
});

describe('Gazette', () => {
    beforeEach(() => {
        gazetteApi.fetchGazetteCurrent.mockResolvedValue(null);
        gazetteApi.fetchGazetteDraft.mockResolvedValue(null);
        gazetteApi.fetchGazetteFacts.mockResolvedValue(buildGazetteFacts({ cup1: quietCup }));
        gazetteApi.fetchGazetteIssues.mockResolvedValue([]);
        gazetteApi.generateGazetteDraft.mockImplementation(async (eventId) => ({
            headline: '{underdog} upsets {favorite}',
            body: '{underdog} beat the favorite {favorite} in {cupName}.',
            artKey: 'castle',
            dateLabel: '24-AUG-2026',
            href: '/tournaments/homm3/cup1?status=started',
            story: 'underdog',
            eventId,
            source: 'template'
        }));
        gazetteApi.publishGazetteIssue.mockImplementation(async (issue) => issue);
        gazetteApi.discardGazetteDraft.mockResolvedValue();
        gazetteApi.deleteGazetteIssue.mockResolvedValue({ current: null });
        window.confirm = jest.fn(() => true);
    });

    const renderGazette = (isAdmin, { variant = 'home', path = '/' } = {}) =>
        render(
            <MemoryRouter initialEntries={[path]}>
                <AuthContext.Provider value={{ isAdmin, isLogged: isAdmin }}>
                    <Routes>
                        <Route path="/" element={<Gazette variant={variant} />} />
                        <Route path="/gazette" element={<Gazette variant={variant} />} />
                        <Route path="/gazette/:issueId" element={<Gazette variant={variant} />} />
                    </Routes>
                </AuthContext.Provider>
            </MemoryRouter>
        );

    test('hides the paper for visitors until an issue is published', async () => {
        gazetteApi.fetchGazetteFacts.mockResolvedValue(buildGazetteFacts({ cup1: underdogCup }));
        const { container } = renderGazette(false);
        await waitFor(() => {
            expect(container).toBeEmptyDOMElement();
        });
    });

    test('shows a published issue to visitors and hides the newsroom', async () => {
        const facts = buildGazetteFacts({ cup1: underdogCup });
        gazetteApi.fetchGazetteFacts.mockResolvedValue(facts);
        gazetteApi.fetchGazetteCurrent.mockResolvedValue({
            headline: 'Shock in the woods',
            body: 'The form book is ash.',
            artKey: 'castle',
            dateLabel: '24-AUG-2026',
            href: '/tournaments/homm3/cup1?status=started',
            story: 'underdog',
            eventId: facts.event.eventId
        });

        renderGazette(false);
        expect(await screen.findByText('Shock in the woods')).toBeVisible();
        expect(screen.getByText('The form book is ash.')).toBeVisible();
        expect(screen.getByRole('link', { name: 'Read past issues in the Gazette →' })).toHaveAttribute(
            'href',
            '/gazette'
        );
        expect(screen.queryByRole('button', { name: 'Generate this story' })).not.toBeInTheDocument();
        expect(screen.queryByText(/New news can be generated/)).not.toBeInTheDocument();
    });

    test('lets an admin pick a topic, generate, and publish on the Gazette page', async () => {
        const facts = buildGazetteFacts({ cup1: newsroomCup });
        gazetteApi.fetchGazetteFacts.mockResolvedValue(facts);
        renderGazette(true, { variant: 'page', path: '/gazette' });

        expect(await screen.findByDisplayValue('Alice upsets Bob')).toBeVisible();
        expect(screen.getByRole('img', { name: 'Castle against Rampart' })).toBeVisible();
        expect(screen.getByAltText('Red flag')).toBeVisible();
        expect(screen.getByAltText('Blue flag')).toBeVisible();
        expect(screen.getByAltText('Stars: 2')).toBeVisible();
        expect(screen.getByAltText('Stars: 5')).toBeVisible();
        expect(screen.getByText('Castle · red')).toBeVisible();
        expect(screen.getByText('Rampart · blue')).toBeVisible();
        expect(screen.getByRole('radio', { name: /Upset · Alice over Bob/ })).toBeChecked();
        expect(screen.getByText(/Draft ready/i)).toBeVisible();

        fireEvent.click(screen.getByRole('radio', { name: /Gift · Patron \$120/ }));
        expect(screen.getByDisplayValue('Patron fills the Heroes Cup purse')).toBeVisible();
        fireEvent.click(screen.getByRole('button', { name: 'Generate this story' }));

        await waitFor(() => {
            expect(gazetteApi.generateGazetteDraft).toHaveBeenCalledWith(facts.events[1].eventId);
        });
        expect(await screen.findByDisplayValue('{underdog} upsets {favorite}')).toBeVisible();

        fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
        await waitFor(() => {
            expect(gazetteApi.publishGazetteIssue).toHaveBeenCalled();
        });
        expect(await screen.findByText('Gazette published.')).toBeVisible();
    });

    test('lets visitors open a past issue from the archive', async () => {
        const current = {
            id: 'issue-new',
            headline: 'Alice upsets Bob',
            body: 'The form book is ash.',
            artKey: 'castle',
            dateLabel: '24-AUG-2026',
            href: '/tournaments/homm3/cup1?status=started'
        };
        const older = {
            id: 'issue-old',
            headline: 'Patron fills the purse',
            body: 'Gold changed the field.',
            artKey: 'gold',
            dateLabel: '20-AUG-2026',
            href: '/tournaments/homm3/cup1?status=started'
        };
        gazetteApi.fetchGazetteCurrent.mockResolvedValue(current);
        gazetteApi.fetchGazetteIssues.mockResolvedValue([current, older]);
        renderGazette(false, { variant: 'page', path: '/gazette/issue-old' });

        expect(await screen.findByRole('heading', { name: 'Patron fills the purse' })).toBeVisible();
        expect(screen.getByText('Gold changed the field.')).toBeVisible();
        expect(screen.getByRole('link', { name: /Alice upsets Bob/ })).toHaveAttribute('href', '/gazette');
        expect(screen.getByRole('link', { name: /Patron fills the purse/ })).toHaveAttribute(
            'href',
            '/gazette/issue-old'
        );
        expect(screen.queryByRole('button', { name: /Delete / })).not.toBeInTheDocument();
    });

    test('lets an admin open a past issue from the archive list', async () => {
        const current = {
            id: 'issue-new',
            headline: 'Alice upsets Bob',
            body: 'The form book is ash.',
            artKey: 'castle',
            dateLabel: '24-AUG-2026',
            href: '/tournaments/homm3/cup1?status=started',
            story: 'underdog'
        };
        const older = {
            id: 'issue-old',
            headline: 'Patron fills the purse',
            body: 'Gold changed the field.',
            artKey: 'gold',
            dateLabel: '20-AUG-2026',
            href: '/tournaments/homm3/cup1?status=started',
            story: 'donation'
        };
        gazetteApi.fetchGazetteCurrent.mockResolvedValue(current);
        gazetteApi.fetchGazetteFacts.mockResolvedValue(buildGazetteFacts({ cup1: newsroomCup }));
        gazetteApi.fetchGazetteIssues.mockResolvedValue([current, older]);
        renderGazette(true, { variant: 'page', path: '/gazette/issue-old' });

        expect(await screen.findByRole('heading', { name: 'Patron fills the purse' })).toBeVisible();
        expect(screen.getByText('Gold changed the field.')).toBeVisible();
        expect(screen.getByRole('link', { name: /On the stands$/ })).toHaveAttribute('href', '/gazette');
        expect(screen.getByRole('link', { name: /Viewing$/ })).toHaveAttribute('href', '/gazette/issue-old');
        expect(screen.getByText(/This is a past issue/i)).toBeVisible();
    });

    test('lets an admin delete a Gazette issue', async () => {
        const current = {
            id: 'issue-new',
            headline: 'Alice upsets Bob',
            body: 'The form book is ash.',
            artKey: 'castle',
            dateLabel: '24-AUG-2026',
            href: '/tournaments/homm3/cup1?status=started',
            story: 'underdog'
        };
        const older = {
            id: 'issue-old',
            headline: 'Patron fills the purse',
            body: 'Gold changed the field.',
            artKey: 'gold',
            dateLabel: '20-AUG-2026',
            href: '/tournaments/homm3/cup1?status=started',
            story: 'donation'
        };
        gazetteApi.fetchGazetteCurrent.mockResolvedValue(current);
        gazetteApi.fetchGazetteFacts.mockResolvedValue(buildGazetteFacts({ cup1: newsroomCup }));
        gazetteApi.fetchGazetteIssues.mockResolvedValueOnce([current, older]).mockResolvedValueOnce([current]);
        gazetteApi.deleteGazetteIssue.mockResolvedValue({ current });
        renderGazette(true, { variant: 'page', path: '/gazette' });

        fireEvent.click(await screen.findByRole('button', { name: 'Delete Patron fills the purse' }));
        expect(window.confirm).toHaveBeenCalled();
        expect(gazetteApi.deleteGazetteIssue).toHaveBeenCalledWith(expect.objectContaining({ id: 'issue-old' }));
        expect(await screen.findByText('Gazette issue deleted.')).toBeVisible();
        expect(screen.queryByRole('button', { name: 'Delete Patron fills the purse' })).not.toBeInTheDocument();
    });
});
