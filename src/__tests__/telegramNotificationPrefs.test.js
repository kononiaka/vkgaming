import { collectFollowablePlayers, mergeTelegramNotificationPrefs } from '../utils/telegramNotificationPrefs';

describe('telegramNotificationPrefs', () => {
    test('mergeTelegramNotificationPrefs fills defaults', () => {
        expect(mergeTelegramNotificationPrefs(null)).toEqual({
            enabled: true,
            matchSchedule: true,
            matchReschedule: true,
            matchLive: true,
            matchResult: true,
            commentatorAssigned: true
        });
    });

    test('mergeTelegramNotificationPrefs keeps stored overrides', () => {
        expect(
            mergeTelegramNotificationPrefs({
                enabled: false,
                matchLive: false
            })
        ).toEqual({
            enabled: false,
            matchSchedule: true,
            matchReschedule: true,
            matchLive: false,
            matchResult: true,
            commentatorAssigned: true
        });
    });

    test('collectFollowablePlayers groups active public tournaments', () => {
        const groups = collectFollowablePlayers({
            cupA: {
                name: 'Winter Cup',
                status: 'Started!',
                isPublic: true,
                players: {
                    p1: { name: 'Zorro' },
                    p2: { name: 'Condor' },
                    p3: { name: 'TBD' }
                }
            },
            cupB: {
                name: 'Hidden Cup',
                status: 'Started!',
                isPublic: false,
                players: { p1: { name: 'Ghost' } }
            },
            cupC: {
                name: 'Finished Cup',
                status: 'Finished',
                isPublic: true,
                players: { p1: { name: 'Old' } }
            }
        });

        expect(groups).toEqual([
            {
                tournamentName: 'Winter Cup',
                tournamentId: 'cupA',
                players: ['Condor', 'Zorro']
            }
        ]);
    });
});
