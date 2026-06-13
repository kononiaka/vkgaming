import {
    canManageCommentatorRequests,
    canRequestTournamentCommentator,
    canToggleTournamentCommentating,
    getActiveCommentatorLogins,
    getApprovedCommentator,
    getCommentatorRequestForUser,
    getPendingCommentatorRequests
} from '../utils/tournamentCommentators';

describe('tournamentCommentators utils', () => {
    const tournament = {
        status: 'Started!',
        createdByUid: 'host-uid',
        commentatorRequests: {
            'user-1': { name: 'Caster', status: 'pending', twitchLogin: 'caster1' }
        },
        commentators: {
            'user-2': { name: 'LiveCaster', twitchLogin: 'livecaster', isCommentating: true }
        }
    };

    test('allows commentator requests while cup is open or live', () => {
        expect(canRequestTournamentCommentator({ status: 'Registration' })).toBe(true);
        expect(canRequestTournamentCommentator({ status: 'Registration finished!' })).toBe(true);
        expect(canRequestTournamentCommentator({ status: 'Started!' })).toBe(true);
        expect(canRequestTournamentCommentator({ status: 'Finished!' })).toBe(false);
    });

    test('reads pending request and approved commentator for user', () => {
        expect(getCommentatorRequestForUser(tournament, 'user-1')?.name).toBe('Caster');
        expect(getApprovedCommentator(tournament, 'user-2')?.name).toBe('LiveCaster');
    });

    test('lists pending requests and active commentator streams', () => {
        expect(getPendingCommentatorRequests(tournament)).toHaveLength(1);
        expect(getActiveCommentatorLogins(tournament)).toEqual(['livecaster']);
    });

    test('host and admin can manage requests', () => {
        expect(
            canManageCommentatorRequests(tournament, {
                isAdmin: false,
                userNickName: 'Host',
                firebaseUid: 'host-uid'
            })
        ).toBe(true);
        expect(
            canManageCommentatorRequests(tournament, {
                isAdmin: true,
                userNickName: 'Admin',
                firebaseUid: 'admin-uid'
            })
        ).toBe(true);
    });

    test('approved commentator can toggle only while tournament is live', () => {
        expect(canToggleTournamentCommentating(tournament, 'user-2')).toBe(true);
        expect(canToggleTournamentCommentating({ ...tournament, status: 'Registration' }, 'user-2')).toBe(false);
        expect(canToggleTournamentCommentating(tournament, 'user-1')).toBe(false);
    });
});
