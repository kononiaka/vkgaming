const { escapeHtml, formatSchedule, matchCenterLink } = require('./telegram');

const KYIV_TZ = 'Europe/Kyiv';

const MORNING_DIGEST_HOUR = 9;

function getKyivDateKey(date = new Date()) {
    return date.toLocaleDateString('en-CA', { timeZone: KYIV_TZ });
}

function getKyivTimeParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: KYIV_TZ,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).formatToParts(date);

    const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0);
    const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0);
    return { hour, minute };
}

function isAfterKyivTime(hour, minute = 0, date = new Date()) {
    const current = getKyivTimeParts(date);
    return current.hour > hour || (current.hour === hour && current.minute >= minute);
}

function isSameKyivDay(iso, dateKey) {
    const when = new Date(iso);
    if (Number.isNaN(when.getTime())) {
        return false;
    }
    return when.toLocaleDateString('en-CA', { timeZone: KYIV_TZ }) === dateKey;
}

function formatTimeKyiv(iso) {
    const when = new Date(iso);
    if (Number.isNaN(when.getTime())) {
        return '—';
    }

    return when.toLocaleTimeString('ru-UA', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: KYIV_TZ
    });
}

function isActivePair(pair) {
    if (!pair?.team1 || !pair?.team2) {
        return false;
    }
    if (pair.team1 === 'TBD' || pair.team2 === 'TBD' || pair.team1 === 'null' || pair.team2 === 'null') {
        return false;
    }
    if (pair.winner || pair.gameStatus === 'Processed') {
        return false;
    }
    return true;
}

function collectTodayScheduledMatches(tournamentsData, dateKey = getKyivDateKey()) {
    const rows = [];

    for (const [tournamentId, tournament] of Object.entries(tournamentsData || {})) {
        if (!tournament || tournament.isPublic === false || tournament.status !== 'Started!') {
            continue;
        }

        const pairs = tournament.bracket?.playoffPairs;
        if (!Array.isArray(pairs)) {
            continue;
        }

        pairs.forEach((stage, stageIdx) => {
            if (!Array.isArray(stage)) {
                return;
            }

            stage.forEach((pair, pairIdx) => {
                if (!isActivePair(pair) || !pair.scheduledAt) {
                    return;
                }
                if (!isSameKyivDay(pair.scheduledAt, dateKey)) {
                    return;
                }

                rows.push({
                    tournamentId,
                    tournamentName: tournament.name || 'Турнир',
                    stageLabel: pair.stage || `Стадия ${stageIdx + 1}`,
                    team1: pair.team1,
                    team2: pair.team2,
                    scheduledAt: pair.scheduledAt,
                    timeLabel: formatTimeKyiv(pair.scheduledAt),
                    stageIdx,
                    pairIdx
                });
            });
        });
    }

    return rows.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
}

function groupMatchRows(rows) {
    const groups = new Map();

    for (const row of rows) {
        const key = `${row.tournamentId}::${row.stageLabel}`;
        if (!groups.has(key)) {
            groups.set(key, {
                tournamentName: row.tournamentName,
                stageLabel: row.stageLabel,
                matches: []
            });
        }
        groups.get(key).matches.push(row);
    }

    return Array.from(groups.values());
}

function formatMatchLine(row) {
    const left = escapeHtml(row.team1);
    const right = escapeHtml(row.team2);
    const time = escapeHtml(row.timeLabel);
    return `${left}  <b>${time}</b>  ${right}`;
}

function buildDailyDigestMessage(rows, slot, siteUrl) {
    if (!rows.length) {
        return null;
    }

    const dateLabel = new Date().toLocaleDateString('ru-UA', {
        day: 'numeric',
        month: 'long',
        timeZone: KYIV_TZ
    });
    const matchCenter = matchCenterLink(siteUrl);
    const groups = groupMatchRows(rows);

    const intro =
        slot === 'evening'
            ? 'Продублирую матчи на сегодня — многие уже договорились о времени. Смотрите всех в <a href="' +
              matchCenter +
              '">Матч-центре</a> на konoplay.'
            : 'Матчи на сегодня. Следите за live и расписанием в <a href="' +
              matchCenter +
              '">Матч-центре</a> на konoplay.';

    const groupBlocks = groups.map((group) => {
        const header = `<b>${escapeHtml(group.tournamentName)} · ${escapeHtml(group.stageLabel)}</b>`;
        const lines = group.matches.map(formatMatchLine).join('\n');
        return `${header}\n${lines}`;
    });

    return (
        `<b>konoplay · анонс матчей</b>\n` +
        `<i>${escapeHtml(dateLabel)}</i>\n\n` +
        `${intro}\n\n` +
        groupBlocks.join('\n\n')
    );
}

function buildScheduleInstantMessage(tournamentName, pair, scheduledAt, tournamentId, siteUrl) {
    const team1 = escapeHtml(pair.team1 || 'TBD');
    const team2 = escapeHtml(pair.team2 || 'TBD');
    const when = escapeHtml(formatSchedule(scheduledAt));
    const time = escapeHtml(formatTimeKyiv(scheduledAt));
    const scheduledBy = pair.scheduledBy ? escapeHtml(pair.scheduledBy) : null;
    const matchCenter = matchCenterLink(siteUrl);

    let text =
        `📅 <b>Назначено время матча</b>\n` +
        `${escapeHtml(tournamentName)}\n\n` +
        `${team1}  <b>${time}</b>  ${team2}\n` +
        `(${when})`;

    if (scheduledBy) {
        text += `\nУказал: ${scheduledBy}`;
    }

    text += `\n\n<a href="${matchCenter}">Матч-центр</a>`;
    return text;
}

module.exports = {
    KYIV_TZ,
    MORNING_DIGEST_HOUR,
    getKyivDateKey,
    getKyivTimeParts,
    isAfterKyivTime,
    isSameKyivDay,
    collectTodayScheduledMatches,
    buildDailyDigestMessage,
    buildScheduleInstantMessage,
    formatTimeKyiv
};
