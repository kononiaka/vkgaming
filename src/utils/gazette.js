export const GAZETTE_ART_KEYS = ['crest', 'castle', 'gold', 'finals', 'registration'];

const PLACEHOLDER_NAMES = new Set(['', 'tbd', 'bye', 'null']);

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const isRealName = (name) => {
    const value = String(name || '').trim();
    return Boolean(value) && !PLACEHOLDER_NAMES.has(value.toLowerCase());
};

const flattenPairs = (playoffPairs) => {
    const stages = Array.isArray(playoffPairs) ? playoffPairs : [];
    const entries = [];
    stages.forEach((stage, stageIndex) => {
        const pairs = Array.isArray(stage) ? stage : stage ? [stage] : [];
        pairs.forEach((pair, pairIndex) => {
            if (pair) {
                entries.push({ pair, stageIndex, pairIndex });
            }
        });
    });
    return entries;
};

export const formatGazetteDate = (value = new Date()) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return formatGazetteDate(new Date());
    }
    return `${date.getUTCDate()}-${MONTHS[date.getUTCMonth()]}-${date.getUTCFullYear()}`;
};

const countRegisteredPlayers = (tournament) =>
    Object.values(tournament?.players && typeof tournament.players === 'object' ? tournament.players : {}).filter(
        (player) => isRealName(player?.name)
    ).length;

const countFinishedMaps = (tournament) =>
    flattenPairs(tournament?.bracket?.playoffPairs).reduce((total, { pair }) => {
        const games = Array.isArray(pair.games) ? pair.games : [];
        return total + games.filter((game) => game?.gameWinner || game?.winner).length;
    }, 0);

const findFinals = (tournament) => {
    const entries = flattenPairs(tournament?.bracket?.playoffPairs);
    const labeled = [...entries].reverse().find(({ pair }) => {
        const stage = String(pair.stage || pair.stageLabel || '').toLowerCase();
        return stage.includes('final') && !stage.includes('third') && isRealName(pair.team1) && isRealName(pair.team2);
    });
    if (labeled) {
        return {
            team1: labeled.pair.team1,
            team2: labeled.pair.team2,
            winner: isRealName(labeled.pair.winner) ? labeled.pair.winner : null
        };
    }
    return { team1: null, team2: null, winner: null };
};

const prizeLabel = (tournament) => {
    const collected = Number(tournament?.communityFundingUsd) || 0;
    if (collected > 0) {
        return `$${collected.toLocaleString('en-US')}`;
    }
    if (tournament?.prizeType === 'money' && tournament.totalPrizeUsd) {
        return `$${Number(tournament.totalPrizeUsd).toLocaleString('en-US')}`;
    }
    return null;
};

const isPublicCup = (tournament) =>
    tournament &&
    tournament.isPublic !== false &&
    ['Registration', 'Registration Started', 'Started!'].includes(tournament.status);

const cupHref = (tournament) => {
    const status = tournament.status === 'Started!' ? 'started' : 'registration';
    return `/tournaments/homm3/${tournament.id}?status=${status}`;
};

const storyForCup = (cup) => {
    if (!cup) {
        return 'idle';
    }
    if (cup.finalsWinner && cup.finalsTeam1 && cup.finalsTeam2) {
        return 'champion';
    }
    if (cup.finalsTeam1 && cup.finalsTeam2) {
        return 'finals';
    }
    if (cup.status === 'Started!' && cup.mapsPlayed > 0) {
        return 'live';
    }
    if (cup.status === 'Started!') {
        return 'live';
    }
    return 'registration';
};

export const buildGazetteFacts = (tournamentsById) => {
    const cups = Object.entries(tournamentsById || {})
        .map(([id, tournament]) => ({ ...tournament, id: tournament?.id || id }))
        .filter(isPublicCup)
        .map((tournament) => {
            const finals = findFinals(tournament);
            return {
                id: tournament.id,
                name: String(tournament.name || 'Untitled cup').trim() || 'Untitled cup',
                status: tournament.status,
                prizeLabel: prizeLabel(tournament),
                playerCount: countRegisteredPlayers(tournament),
                maxPlayers: Number(tournament.maxPlayers) || 0,
                mapsPlayed: countFinishedMaps(tournament),
                finalsTeam1: finals.team1,
                finalsTeam2: finals.team2,
                finalsWinner: finals.winner,
                href: cupHref(tournament)
            };
        })
        .sort(
            (a, b) =>
                Number(b.status === 'Started!') - Number(a.status === 'Started!') ||
                b.mapsPlayed - a.mapsPlayed ||
                b.playerCount - a.playerCount
        );

    const featured = cups[0] || null;
    return {
        generatedAt: new Date().toISOString(),
        story: storyForCup(featured),
        cup: featured,
        cupCount: cups.length
    };
};

export const composeGazetteIssue = (facts, now = new Date()) => {
    const dateLabel = formatGazetteDate(now);
    const cup = facts?.cup;
    const story = facts?.story || 'idle';

    if (!cup || story === 'idle') {
        return {
            headline: 'The arena is quiet',
            body: 'No public cup is on the board. When registration opens or a match is reported, the Gazette will have something to print.',
            artKey: 'crest',
            dateLabel,
            href: '/tournaments/homm3',
            story,
            tournamentId: null,
            source: 'template'
        };
    }

    const prize = cup.prizeLabel ? ` The purse stands at ${cup.prizeLabel}.` : '';
    const roster =
        cup.maxPlayers > 0 ? `${cup.playerCount} of ${cup.maxPlayers} players` : `${cup.playerCount} players`;

    if (story === 'champion') {
        return {
            headline: `${cup.finalsWinner} takes ${cup.name}`,
            body: `${cup.finalsWinner} defeated ${
                cup.finalsWinner === cup.finalsTeam1 ? cup.finalsTeam2 : cup.finalsTeam1
            } in the final of ${cup.name}.${prize} The Gazette records it so.`,
            artKey: 'finals',
            dateLabel,
            href: cup.href,
            story,
            tournamentId: cup.id,
            source: 'template'
        };
    }

    if (story === 'finals') {
        return {
            headline: `Finals set in ${cup.name}`,
            body: `${cup.finalsTeam1} meets ${cup.finalsTeam2} for the title.${prize} One match remains between the field and the crown.`,
            artKey: 'finals',
            dateLabel,
            href: cup.href,
            story,
            tournamentId: cup.id,
            source: 'template'
        };
    }

    if (story === 'registration') {
        return {
            headline: `Warriors wanted for ${cup.name}`,
            body: `Registration is open. ${roster} have taken their seats.${prize} The bracket waits on the rest.`,
            artKey: 'registration',
            dateLabel,
            href: cup.href,
            story,
            tournamentId: cup.id,
            source: 'template'
        };
    }

    return {
        headline: `${cup.name} is underway`,
        body: `${cup.mapsPlayed} map${cup.mapsPlayed === 1 ? '' : 's'} have been reported. ${roster} remain in the field.${prize}`,
        artKey: cup.prizeLabel ? 'gold' : 'castle',
        dateLabel,
        href: cup.href,
        story,
        tournamentId: cup.id,
        source: 'template'
    };
};

const clampText = (value, max) =>
    String(value || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, max);

export const sanitizeGazetteIssue = (issue, facts = null) => {
    const fallback = composeGazetteIssue(facts || { story: 'idle', cup: null });
    const artKey = GAZETTE_ART_KEYS.includes(issue?.artKey) ? issue.artKey : fallback.artKey;
    const href = String(issue?.href || fallback.href || '/tournaments/homm3');
    const safeHref = href.startsWith('/') ? href.slice(0, 200) : fallback.href;

    return {
        headline: clampText(issue?.headline, 90) || fallback.headline,
        body: clampText(issue?.body, 700) || fallback.body,
        artKey,
        dateLabel: clampText(issue?.dateLabel, 24) || fallback.dateLabel,
        href: safeHref,
        story: issue?.story || fallback.story,
        tournamentId: issue?.tournamentId || fallback.tournamentId || null,
        source: issue?.source === 'ai' ? 'ai' : 'template',
        generatedAt: issue?.generatedAt || new Date().toISOString()
    };
};
