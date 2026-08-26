import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Gazette from '../components/Gazette/Gazette';
import AuthContext from '../store/auth-context';
import { buildGazetteFacts, composeGazetteIssue, sanitizeGazetteIssue } from '../utils/gazette';
import * as gazetteApi from '../api/gazette';

jest.mock('../api/gazette', () => ({
    fetchGazetteCurrent: jest.fn(),
    fetchGazetteDraft: jest.fn(),
    generateGazetteDraft: jest.fn(),
    publishGazetteIssue: jest.fn(),
    discardGazetteDraft: jest.fn()
}));

const liveCup = {
    name: 'Heroes Cup',
    status: 'Started!',
    isPublic: true,
    maxPlayers: 8,
    communityFundingUsd: 250,
    players: {
        a: { name: 'Alice' },
        b: { name: 'Bob' },
        c: { name: 'TBD' }
    },
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
    test('features the live public cup and skips TBD seats', () => {
        const facts = buildGazetteFacts({
            hidden: { name: 'Secret', status: 'Started!', isPublic: false, players: { a: { name: 'Zed' } } },
            cup1: liveCup
        });

        expect(facts.story).toBe('finals');
        expect(facts.cup).toMatchObject({
            name: 'Heroes Cup',
            playerCount: 2,
            mapsPlayed: 1,
            finalsTeam1: 'Alice',
            finalsTeam2: 'Bob',
            prizeLabel: '$250'
        });
    });

    test('composes a finals issue from facts only', () => {
        const issue = composeGazetteIssue(buildGazetteFacts({ cup1: liveCup }), new Date('2026-08-24T12:00:00.000Z'));
        expect(issue.headline).toMatch(/Finals set in Heroes Cup/i);
        expect(issue.body).toContain('Alice');
        expect(issue.body).toContain('Bob');
        expect(issue.body).toContain('$250');
        expect(issue.body).not.toMatch(/score/i);
        expect(issue.artKey).toBe('finals');
        expect(issue.dateLabel).toBe('24-AUG-2026');
        expect(issue.href).toBe('/tournaments/homm3/cup1?status=started');
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
});

describe('Gazette', () => {
    beforeEach(() => {
        gazetteApi.fetchGazetteCurrent.mockResolvedValue(null);
        gazetteApi.fetchGazetteDraft.mockResolvedValue(null);
        gazetteApi.generateGazetteDraft.mockResolvedValue({
            headline: 'Finals set in Heroes Cup',
            body: 'Alice meets Bob for the title.',
            artKey: 'finals',
            dateLabel: '24-AUG-2026',
            href: '/tournaments/homm3/cup1?status=started',
            source: 'template'
        });
        gazetteApi.publishGazetteIssue.mockImplementation(async (issue) => issue);
        gazetteApi.discardGazetteDraft.mockResolvedValue();
    });

    const renderGazette = (isAdmin) =>
        render(
            <MemoryRouter>
                <AuthContext.Provider value={{ isAdmin, isLogged: isAdmin }}>
                    <Gazette />
                </AuthContext.Provider>
            </MemoryRouter>
        );

    test('hides the paper for visitors when nothing is published', async () => {
        const { container } = renderGazette(false);
        await waitFor(() => {
            expect(container).toBeEmptyDOMElement();
        });
    });

    test('shows a published issue to visitors', async () => {
        gazetteApi.fetchGazetteCurrent.mockResolvedValue({
            headline: 'Heroes Cup is underway',
            body: 'Seven maps have been reported.',
            artKey: 'castle',
            dateLabel: '24-AUG-2026',
            href: '/tournaments/homm3/cup1?status=started'
        });

        renderGazette(false);
        expect(await screen.findByText('Heroes Cup is underway')).toBeVisible();
        expect(screen.getByText('Konoplay Gazette')).toBeVisible();
        expect(screen.queryByRole('button', { name: 'Generate new' })).not.toBeInTheDocument();
    });

    test('lets an admin generate and publish a draft', async () => {
        renderGazette(true);
        expect(await screen.findByRole('button', { name: 'Generate new' })).toBeVisible();

        fireEvent.click(screen.getByRole('button', { name: 'Generate new' }));
        expect(await screen.findByDisplayValue('Finals set in Heroes Cup')).toBeVisible();

        fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
        await waitFor(() => {
            expect(gazetteApi.publishGazetteIssue).toHaveBeenCalled();
        });
        expect(await screen.findByText('Gazette published.')).toBeVisible();
    });
});
