import {
    buildMatchLogMapRows,
    findBracketMatchForGame,
    normalizeMatchLogGame,
    resolveMatchLogRecordingLinks
} from '../utils/matchLogDetails';
import {
    extractTwitchVideoId,
    getTwitchRecordingEmbedUrl,
    getTwitchVideosUrl,
    isTwitchRecordingUrl
} from '../utils/twitchUtils';

describe('matchLogDetails', () => {
    test('normalizeMatchLogGame keeps nested map data and stream metadata', () => {
        const game = normalizeMatchLogGame(
            {
                opponent1: 'Alice',
                opponent2: 'Bob',
                tournamentName: 'Test Cup',
                tournamentId: 'cup1',
                streamUrl: 'https://www.twitch.tv/caster1',
                games: [{ gameId: 0, castle1: 'Castle', castle2: 'Rampart', gameWinner: 'Alice' }]
            },
            'match-1'
        );

        expect(game.games).toHaveLength(1);
        expect(game.streamUrl).toContain('twitch.tv/caster1');
    });

    test('findBracketMatchForGame resolves pair by tournament id and player names', () => {
        const tournaments = {
            cup1: {
                name: 'Test Cup',
                status: 'Started!',
                bracket: {
                    playoffPairs: [
                        [
                            {
                                team1: 'Alice',
                                team2: 'Bob',
                                stage: 'Semi-final',
                                streamLogin: 'caster1'
                            }
                        ]
                    ]
                }
            }
        };

        const context = findBracketMatchForGame(tournaments, {
            tournamentId: 'cup1',
            opponent1: 'Alice',
            opponent2: 'Bob'
        });

        expect(context).toMatchObject({
            tournamentId: 'cup1',
            stageLabel: 'Semi-final'
        });
        expect(context.pair.streamLogin).toBe('caster1');
    });

    test('resolveMatchLogRecordingLinks prefers direct vod urls and adds channel archives', () => {
        const links = resolveMatchLogRecordingLinks(
            {
                opponent1: 'Alice',
                opponent2: 'Bob',
                twitchRecording: 'https://www.twitch.tv/videos/123456789',
                streamLogin: 'caster1'
            },
            null,
            {
                u1: { enteredNickname: 'Alice', twitch: 'https://www.twitch.tv/alice_streams' }
            }
        );

        expect(links.some((link) => link.url.includes('/videos/123456789'))).toBe(true);
        expect(links.some((link) => link.url.includes('/alice_streams/videos'))).toBe(true);
        expect(links.some((link) => link.url.includes('/caster1/videos'))).toBe(true);
    });

    test('buildMatchLogMapRows falls back to top-level castles for legacy records', () => {
        const rows = buildMatchLogMapRows({
            opponent1: 'Alice',
            opponent2: 'Bob',
            opponent1Castle: 'Castle',
            opponent2Castle: 'Rampart',
            winner: 'Alice',
            games: []
        });

        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
            castle1: 'Castle',
            castle2: 'Rampart',
            winner: 'Alice'
        });
    });
});

describe('twitch recording helpers', () => {
    test('detects twitch vod urls', () => {
        expect(isTwitchRecordingUrl('https://www.twitch.tv/videos/123456789')).toBe(true);
        expect(isTwitchRecordingUrl('https://www.twitch.tv/caster1')).toBe(false);
    });

    test('builds embed url for twitch vod', () => {
        expect(getTwitchRecordingEmbedUrl('https://www.twitch.tv/videos/123456789')).toContain('video=123456789');
        expect(extractTwitchVideoId('https://www.twitch.tv/videos/123456789')).toBe('123456789');
    });

    test('builds channel vod archive url', () => {
        expect(getTwitchVideosUrl('caster1')).toBe('https://www.twitch.tv/caster1/videos');
    });
});
