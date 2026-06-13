import {
    collectPlayerTournaments,
    getPlayerTournamentResultLabel,
    getTournamentProfileLink,
    isPlayerRegisteredInTournament
} from '../utils/playerTournaments';

describe('playerTournaments', () => {
    const player = {
        id: 'user-1',
        enteredNickname: 'Alice'
    };

    test('collects public tournaments where the player is registered', () => {
        const tournamentsData = {
            cup1: {
                name: 'Spring Cup',
                status: 'Started!',
                type: 'league',
                date: '2026-05-01',
                isPublic: true,
                communityFundingUsd: 750,
                players: {
                    p1: { name: 'Alice', siteUserId: 'user-1' }
                }
            },
            cup2: {
                name: 'Hidden Cup',
                status: 'Started!',
                isPublic: false,
                players: {
                    p1: { name: 'Alice', siteUserId: 'user-1' }
                }
            },
            cup3: {
                name: 'Other Cup',
                status: 'Started!',
                isPublic: true,
                players: {
                    p1: { name: 'Bob', siteUserId: 'user-2' }
                }
            }
        };

        const publicOnly = collectPlayerTournaments(tournamentsData, player);
        expect(publicOnly).toHaveLength(1);
        expect(publicOnly[0]).toMatchObject({
            id: 'cup1',
            name: 'Spring Cup',
            statusLabel: 'In progress',
            typeLabel: 'League',
            prizePoolLabel: '$750 prize pool',
            link: getTournamentProfileLink('cup1', 'Started!')
        });

        const includePrivate = collectPlayerTournaments(tournamentsData, player, {
            includePrivateTournaments: true
        });
        expect(includePrivate).toHaveLength(2);
    });

    test('returns placement label for finished tournaments', () => {
        const tournament = {
            winners: {
                1: 'Alice',
                2: 'Bob'
            }
        };

        expect(getPlayerTournamentResultLabel(tournament, 'Alice')).toBe('1st place');
        expect(getPlayerTournamentResultLabel(tournament, 'Bob')).toBe('2nd place');
        expect(getPlayerTournamentResultLabel(tournament, 'Carol')).toBeNull();
    });

    test('matches players by nickname when siteUserId is missing', () => {
        const tournament = {
            players: {
                p1: { name: 'Alice' }
            }
        };

        expect(isPlayerRegisteredInTournament(tournament, player)).toBe(true);
    });
});
