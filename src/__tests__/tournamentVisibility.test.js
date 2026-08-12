import {
    canManageTournamentSwiss,
    isTournamentCreator
} from '../utils/tournamentVisibility';

jest.mock('../api/authFetch', () => ({
    getFirebaseUid: () => 'uid-owner'
}));

describe('canManageTournamentSwiss', () => {
    const cup = { createdBy: 'HostNick', createdByUid: 'uid-owner' };

    test('allows admins', () => {
        expect(
            canManageTournamentSwiss(cup, { isAdmin: true, userNickName: 'SomeoneElse', firebaseUid: 'other' })
        ).toBe(true);
    });

    test('allows tournament owner by uid', () => {
        expect(
            canManageTournamentSwiss(cup, { isAdmin: false, userNickName: 'HostNick', firebaseUid: 'uid-owner' })
        ).toBe(true);
    });

    test('allows tournament owner by nickname when uid missing', () => {
        expect(
            canManageTournamentSwiss(
                { createdBy: 'HostNick' },
                { isAdmin: false, userNickName: 'HostNick', firebaseUid: null }
            )
        ).toBe(true);
    });

    test('denies other players', () => {
        expect(
            canManageTournamentSwiss(cup, { isAdmin: false, userNickName: 'Player', firebaseUid: 'uid-player' })
        ).toBe(false);
    });

    test('isTournamentCreator still matches owner', () => {
        expect(isTournamentCreator(cup, 'HostNick', 'uid-owner')).toBe(true);
    });
});
