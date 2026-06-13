export const TELEGRAM_BOT_USERNAME = 'konoplay_bot';

export const DEFAULT_TELEGRAM_NOTIFICATION_PREFS = {
    enabled: true,
    matchSchedule: true,
    matchReschedule: true,
    matchLive: true,
    matchResult: true,
    commentatorAssigned: true
};

export const TELEGRAM_NOTIFICATION_PREF_OPTIONS = [
    { key: 'matchSchedule', label: 'Match time confirmed' },
    { key: 'matchReschedule', label: 'Match rescheduled' },
    { key: 'matchLive', label: 'Match goes live' },
    { key: 'commentatorAssigned', label: 'Commentator approved' },
    { key: 'matchResult', label: 'Match result' }
];

export const mergeTelegramNotificationPrefs = (stored) => ({
    ...DEFAULT_TELEGRAM_NOTIFICATION_PREFS,
    ...(stored && typeof stored === 'object' ? stored : {})
});

export const ACTIVE_TOURNAMENT_STATUSES = new Set(['Registration', 'Registration Started', 'Started!']);

export const collectFollowablePlayers = (tournamentsById = {}) => {
    const groups = {};

    Object.entries(tournamentsById).forEach(([tournamentId, tournament]) => {
        if (!tournament || tournament.isPublic === false || !ACTIVE_TOURNAMENT_STATUSES.has(tournament.status)) {
            return;
        }

        const tournamentName = tournament.name || 'Tournament';
        const players = Object.values(tournament.players || {})
            .map((player) => player?.name)
            .filter((name) => name && name !== 'TBD' && name !== 'null');

        if (!players.length) {
            return;
        }

        groups[tournamentName] = {
            tournamentId,
            players: [...new Set(players)].sort((a, b) => a.localeCompare(b))
        };
    });

    return Object.entries(groups)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([tournamentName, value]) => ({ tournamentName, ...value }));
};
