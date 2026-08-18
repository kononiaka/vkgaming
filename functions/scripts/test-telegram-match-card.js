/* eslint-disable no-console */
const assert = require('assert');
const { renderResultCard, formatSeriesScoreLabel, truncateName } = require('../telegramMatchCardRender');

async function main() {
    assert.deepStrictEqual(formatSeriesScoreLabel({ score1: 1, score2: 0, type: 'bo-1' }), {
        scoreText: '1 : 0',
        seriesType: 'BO1'
    });
    assert.deepStrictEqual(formatSeriesScoreLabel({ score1: 2, score2: 1, type: 'bo-3' }), {
        scoreText: '2 : 1',
        seriesType: 'BO3'
    });

    assert.strictEqual(truncateName('ShortName', 18), 'ShortName');
    assert.ok(truncateName('VeryLongPlayerNicknameHere', 18).endsWith('…'));
    assert.strictEqual(truncateName('VeryLongPlayerNicknameHere', 18).length, 18);

    const normalPng = await renderResultCard({
        tournamentName: 'Pre-release tournament',
        stageLabel: 'CS Swiss · Round 2',
        team1: 'Alice',
        team2: 'Bob',
        winner: 'Alice',
        pair: { score1: 1, score2: 0, type: 'bo-1' },
        team1Stars: 3,
        team2Stars: 2.5,
        team1HasTwitch: true,
        team2HasYoutube: true
    });
    assert.ok(Buffer.isBuffer(normalPng));
    assert.ok(normalPng.length > 5000);
    assert.strictEqual(normalPng.slice(0, 8).toString('hex'), '89504e470d0a1a0a');

    const longPng = await renderResultCard({
        tournamentName: 'Champions League Group Stage Mega Cup Name',
        stageLabel: 'Group A · Matchday 3',
        team1: 'SuperLongNicknamePlayerOneDemo',
        team2: 'AnotherExtremelyLongNicknameTwo',
        winner: 'AnotherExtremelyLongNicknameTwo',
        pair: { score1: 1, score2: 2, type: 'bo-3' },
        team1Stars: 4,
        team2Stars: 5,
        team1HasTwitch: true,
        team1HasYoutube: true,
        team2HasTwitch: true
    });
    assert.strictEqual(longPng.slice(0, 8).toString('hex'), '89504e470d0a1a0a');

    const bo2Png = await renderResultCard({
        tournamentName: 'Cup',
        stageLabel: 'Final',
        team1: 'Red',
        team2: 'Blue',
        winner: '',
        pair: { score1: 0, score2: 0, type: 'bo-2' }
    });
    assert.ok(bo2Png.length > 4000);

    const { renderTelegramCard } = require('../telegramMatchCardRender');

    const livePng = await renderTelegramCard({
        cardType: 'live',
        tournamentName: 'Live Cup',
        stageLabel: 'Semifinal',
        team1: 'Alpha',
        team2: 'Beta',
        pair: { score1: 0, score2: 0, type: 'bo-3' },
        castle1: 'Castle',
        castle2: 'Inferno',
        team1Stars: 2,
        team2Stars: 3
    });
    assert.strictEqual(livePng.slice(0, 8).toString('hex'), '89504e470d0a1a0a');

    const schedulePng = await renderTelegramCard({
        cardType: 'schedule',
        tournamentName: 'Upcoming Cup',
        stageLabel: 'Round 1',
        team1: 'One',
        team2: 'Two',
        pair: { score1: 0, score2: 0, type: 'bo-1', scheduledAt: '2026-08-20T15:00:00.000Z' },
        scheduledAt: '2026-08-20T15:00:00.000Z'
    });
    assert.ok(schedulePng.length > 4000);

    const statusPng = await renderTelegramCard({
        cardType: 'status',
        tournamentName: 'Open Cup',
        status: 'Registration Started',
        tournamentDate: 'Aug 2026'
    });
    assert.ok(statusPng.length > 4000);

    const finishedPng = await renderTelegramCard({
        cardType: 'status',
        tournamentName: 'Swiss CS GO',
        status: 'Tournament Finished',
        prizePoolUsd: 47.5,
        winners: [
            { label: 'Gold', place: '1st', color: '#f5c400', name: 'pOLTERGEISt (demo)', stars: 4 },
            { label: 'Silver', place: '2nd', color: '#c0c7d1', name: 'Imrael (demo)', stars: 3.5 },
            { label: 'Bronze', place: '3rd', color: '#cd7f32', name: 'Condor_Awful (demo)', stars: 3 }
        ]
    });
    assert.ok(finishedPng.length > 5000);

    const digestPng = await renderTelegramCard({
        cardType: 'digest',
        slot: 'morning',
        dateKey: '2026-08-14',
        matches: [
            {
                timeLabel: '12:00',
                team1: 'A',
                team2: 'B',
                tournamentName: 'Cup 1'
            },
            {
                timeLabel: '18:30',
                team1: 'C',
                team2: 'D',
                tournamentName: 'Cup 2'
            }
        ]
    });
    assert.ok(digestPng.length > 4000);

    console.log('telegramMatchCardRender: all checks passed');
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
