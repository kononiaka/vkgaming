const functions = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.database();
const ART_KEYS = ['crest', 'castle', 'gold', 'finals', 'registration'];
const PLACEHOLDER_NAMES = new Set(['', 'tbd', 'bye', 'null']);
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const BIG_DONATION_USD = 50;
const UNDERDOG_STAR_GAP = 1;
const UNDERDOG_RATING_GAP = 150;

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

const formatGazetteDate = (value = new Date()) => {
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
        return (
            /\bfinals?\b/.test(stage) &&
            !stage.includes('semi') &&
            !stage.includes('quarter') &&
            !stage.includes('third') &&
            isRealName(pair.team1) &&
            isRealName(pair.team2)
        );
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

const parseEntryStars = (value) => {
    if (value == null || value === '') {
        return 0;
    }
    const raw = String(value);
    const first = raw.includes(',') ? raw.split(',')[0].trim() : raw.trim();
    const amount = Number(first);
    return Number.isFinite(amount) ? amount : 0;
};

const parseStat = (value) => {
    if (typeof value === 'string' && value.includes(',')) {
        return Number(value.split(',').at(-1).trim()) || 0;
    }
    return Number(value) || 0;
};

const lookupPlayer = (tournament, name) =>
    Object.values(tournament?.players && typeof tournament.players === 'object' ? tournament.players : {}).find(
        (player) => player?.name === name
    ) || {};

const sideStats = (tournament, pair, side) => {
    const name = side === 1 ? pair.team1 : pair.team2;
    const player = lookupPlayer(tournament, name);
    return {
        name,
        stars: parseEntryStars(side === 1 ? pair.stars1 ?? player.stars : pair.stars2 ?? player.stars),
        rating: parseStat(side === 1 ? pair.ratings1 ?? player.ratings : pair.ratings2 ?? player.ratings)
    };
};

const isTrueFinalStage = (pair) => {
    const stage = String(pair?.stage || pair?.stageLabel || '').toLowerCase();
    return (
        /\bfinals?\b/.test(stage) &&
        !stage.includes('semi') &&
        !stage.includes('quarter') &&
        !stage.includes('third')
    );
};

const eventTime = (value) => {
    const ms = value ? new Date(value).getTime() : 0;
    return Number.isFinite(ms) ? ms : 0;
};

const oppositeColor = (color) => {
    if (color === 'red') {
        return 'blue';
    }
    if (color === 'blue') {
        return 'red';
    }
    return '';
};

const formatColor = (color) => {
    const value = String(color || '').toLowerCase();
    return value === 'red' || value === 'blue' ? value : '';
};

const formatGoldAmount = (value) => {
    if (value == null || value === '') {
        return '';
    }
    const amount = Number(value);
    return Number.isFinite(amount) ? amount.toLocaleString('en-US') : '';
};

const formatRestartCounts = (count111, count112) => {
    const first = Number(count111) || 0;
    const second = Number(count112) || 0;
    if (first <= 0 && second <= 0) {
        return '';
    }
    const parts = [];
    if (first > 0) {
        parts.push(`${first}×1.11`);
    }
    if (second > 0) {
        parts.push(`${second}×1.12`);
    }
    return parts.join(', ');
};

const summarizeMatchDetails = (pair, winnerSide) => {
    const games = Array.isArray(pair?.games) ? pair.games : [];
    const finished = games.filter((game) => isRealName(game.gameWinner || game.winner));
    const winnerName = winnerSide === 1 ? pair.team1 : pair.team2;
    const deciding =
        [...finished].reverse().find((game) => (game.gameWinner || game.winner) === winnerName) ||
        finished.at(-1) ||
        null;
    const score1 = Number(pair.score1) || finished.filter((game) => (game.gameWinner || game.winner) === pair.team1).length;
    const score2 = Number(pair.score2) || finished.filter((game) => (game.gameWinner || game.winner) === pair.team2).length;
    const winnerScore = winnerSide === 1 ? score1 : score2;
    const loserScore = winnerSide === 1 ? score2 : score1;
    const scoreline = winnerScore || loserScore ? `${winnerScore}–${loserScore}` : '';

    if (!deciding) {
        return {
            scoreline,
            winnerCastle: '',
            loserCastle: '',
            winnerColor: '',
            loserColor: '',
            winnerGold: '',
            loserGold: '',
            winnerRestarts: '',
            loserRestarts: '',
            matchDetails: scoreline ? ` The series closed ${scoreline}.` : ''
        };
    }

    const winnerIs1 = winnerSide === 1;
    const castle1 = deciding.castle1 || pair.castle1;
    const castle2 = deciding.castle2 || pair.castle2;
    const winnerCastle = winnerIs1 ? castle1 : castle2;
    const loserCastle = winnerIs1 ? castle2 : castle1;
    const rawWinnerColor = winnerIs1 ? deciding.color1 || pair.color1 : deciding.color2 || pair.color2;
    const rawLoserColor = winnerIs1 ? deciding.color2 || pair.color2 : deciding.color1 || pair.color1;
    const winnerColor = formatColor(rawWinnerColor) || oppositeColor(formatColor(rawLoserColor));
    const loserColor = formatColor(rawLoserColor) || oppositeColor(winnerColor);
    const winnerGoldRaw = winnerIs1 ? deciding.gold1 ?? pair.gold1 : deciding.gold2 ?? pair.gold2;
    const loserGoldRaw = winnerIs1 ? deciding.gold2 ?? pair.gold2 : deciding.gold1 ?? pair.gold1;
    const winnerGold = formatGoldAmount(winnerGoldRaw);
    const loserGold = formatGoldAmount(loserGoldRaw);
    const showGold =
        (winnerGold !== '' || loserGold !== '') && !(Number(winnerGoldRaw) === 0 && Number(loserGoldRaw) === 0);
    const winnerRestarts = formatRestartCounts(
        winnerIs1 ? deciding.restart1_111 ?? pair.restart1_111 : deciding.restart2_111 ?? pair.restart2_111,
        winnerIs1 ? deciding.restart1_112 ?? pair.restart1_112 : deciding.restart2_112 ?? pair.restart2_112
    );
    const loserRestarts = formatRestartCounts(
        winnerIs1 ? deciding.restart2_111 ?? pair.restart2_111 : deciding.restart1_111 ?? pair.restart1_111,
        winnerIs1 ? deciding.restart2_112 ?? pair.restart2_112 : deciding.restart1_112 ?? pair.restart1_112
    );

    const clauses = [];
    if (scoreline) {
        clauses.push(`The series closed ${scoreline}`);
    }
    if (isRealName(winnerCastle) && isRealName(loserCastle)) {
        clauses.push(
            winnerColor ? `${winnerCastle} as ${winnerColor} against ${loserCastle}` : `${winnerCastle} against ${loserCastle}`
        );
    }
    if (showGold && winnerGold !== '' && loserGold !== '') {
        clauses.push(`gold ${winnerGold} to ${loserGold}`);
    } else if (showGold && winnerGold !== '') {
        clauses.push(`gold ${winnerGold}`);
    }
    if (winnerRestarts && loserRestarts) {
        clauses.push(`restarts ${winnerRestarts} vs ${loserRestarts}`);
    } else if (winnerRestarts) {
        clauses.push(`restarts ${winnerRestarts}`);
    } else if (loserRestarts) {
        clauses.push(`opponent restarts ${loserRestarts}`);
    }

    return {
        scoreline,
        winnerCastle: isRealName(winnerCastle) ? winnerCastle : '',
        loserCastle: isRealName(loserCastle) ? loserCastle : '',
        winnerColor,
        loserColor,
        winnerGold,
        loserGold,
        winnerRestarts,
        loserRestarts,
        matchDetails: clauses.length ? ` ${clauses.join('; ')}.` : ''
    };
};

const collectCupEvents = (tournament, cup) => {
    const events = [];
    const history =
        tournament?.prizePoolHistory && typeof tournament.prizePoolHistory === 'object'
            ? Object.entries(tournament.prizePoolHistory)
            : [];

    history.forEach(([id, entry]) => {
        if (entry?.type && entry.type !== 'donation') {
            return;
        }
        const amountUsd = Number(entry?.amountUsd) || 0;
        if (amountUsd < BIG_DONATION_USD) {
            return;
        }
        events.push({
            kind: 'donation',
            eventId: `donation:${cup.id}:${id}`,
            at: eventTime(entry.at),
            score: 70 + Math.min(amountUsd / 20, 25),
            cup,
            donor: entry.donorUsername || 'A patron',
            giftAmount: `$${amountUsd.toLocaleString('en-US')}`
        });
    });

    flattenPairs(tournament?.bracket?.playoffPairs).forEach(({ pair, stageIndex, pairIndex }) => {
        if (pair.winner === 'draw' || !isRealName(pair.team1) || !isRealName(pair.team2) || !isRealName(pair.winner)) {
            return;
        }
        const winnerSide = pair.winner === pair.team1 ? 1 : pair.winner === pair.team2 ? 2 : 0;
        if (!winnerSide) {
            return;
        }
        const winner = sideStats(tournament, pair, winnerSide);
        const loser = sideStats(tournament, pair, winnerSide === 1 ? 2 : 1);
        const starGap = loser.stars - winner.stars;
        const ratingGap = loser.rating - winner.rating;
        const underdog = starGap >= UNDERDOG_STAR_GAP || ratingGap >= UNDERDOG_RATING_GAP;
        const games = Array.isArray(pair.games) ? pair.games : [];
        const lastGameAt = games.reduce(
            (latest, game) => Math.max(latest, eventTime(game.at || game.reportedAt || game.finishedAt)),
            0
        );
        const at = lastGameAt || eventTime(pair.updatedAt || pair.scheduledAt);
        const match = summarizeMatchDetails(pair, winnerSide);

        if (isTrueFinalStage(pair)) {
            events.push({
                kind: 'champion',
                eventId: `champion:${cup.id}`,
                at,
                score: underdog ? 110 : 100,
                cup,
                underdog: underdog ? winner.name : '',
                favorite: underdog ? loser.name : '',
                finalsWinner: winner.name,
                finalsOpponent: loser.name,
                winnerName: winner.name,
                loserName: loser.name,
                winnerStars: winner.stars,
                loserStars: loser.stars,
                ...match
            });
            return;
        }

        if (underdog) {
            events.push({
                kind: 'underdog',
                eventId: `underdog:${cup.id}:${stageIndex}:${pairIndex}`,
                at,
                score: 85 + Math.min(Math.max(starGap, ratingGap / 150), 10),
                cup,
                underdog: winner.name,
                favorite: loser.name,
                winnerName: winner.name,
                loserName: loser.name,
                winnerStars: winner.stars,
                loserStars: loser.stars,
                ...match
            });
        }
    });

    if (cup.finalsTeam1 && cup.finalsTeam2 && !cup.finalsWinner) {
        events.push({
            kind: 'finals',
            eventId: `finals:${cup.id}`,
            at: 0,
            score: 40,
            cup
        });
    }

    return events;
};

const sortGazetteEvents = (events) =>
    [...(events || [])].sort((a, b) => b.score - a.score || b.at - a.at);

const findGazetteEvent = (facts, eventId) =>
    (facts?.events || []).find((event) => event.eventId === eventId) || null;

const selectGazetteFacts = (facts, eventId) => {
    const event = eventId ? findGazetteEvent(facts, eventId) : sortGazetteEvents(facts?.events)[0] || null;
    return {
        ...facts,
        event,
        story: event?.kind || 'idle',
        cup: event?.cup || null
    };
};

const buildGazetteFacts = (tournamentsById) => {
    const publicTournaments = Object.entries(tournamentsById || {})
        .map(([id, tournament]) => ({ ...tournament, id: tournament?.id || id }))
        .filter(isPublicCup);

    const cups = publicTournaments.map((tournament) => {
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
    });

    const cupById = new Map(cups.map((cup) => [String(cup.id), cup]));
    const events = sortGazetteEvents(
        publicTournaments.flatMap((tournament) => collectCupEvents(tournament, cupById.get(String(tournament.id))))
    );
    const event = events[0] || null;

    return {
        generatedAt: new Date().toISOString(),
        story: event?.kind || 'idle',
        cup: event?.cup || cups[0] || null,
        event,
        events,
        cups,
        cupCount: cups.length
    };
};

const tokenValues = (facts) => {
    const cup = facts?.cup;
    const event = facts?.event || {};
    return {
        cupName: cup?.name || '',
        mapsPlayed: String(cup?.mapsPlayed ?? 0),
        mapsWord: cup?.mapsPlayed === 1 ? 'map' : 'maps',
        playerCount: String(cup?.playerCount ?? 0),
        maxPlayers: String(cup?.maxPlayers || 0),
        roster:
            cup?.maxPlayers > 0 ? `${cup.playerCount} of ${cup.maxPlayers} players` : `${cup?.playerCount ?? 0} players`,
        prizeLabel: cup?.prizeLabel || '',
        prizeSentence: cup?.prizeLabel ? ` The purse stands at ${cup.prizeLabel}.` : '',
        finalsTeam1: cup?.finalsTeam1 || '',
        finalsTeam2: cup?.finalsTeam2 || '',
        finalsWinner: event.finalsWinner || cup?.finalsWinner || '',
        finalsOpponent: event.finalsOpponent || '',
        underdog: event.underdog || '',
        favorite: event.favorite || '',
        donor: event.donor || '',
        giftAmount: event.giftAmount || '',
        scoreline: event.scoreline || '',
        winnerCastle: event.winnerCastle || '',
        loserCastle: event.loserCastle || '',
        winnerColor: event.winnerColor || '',
        loserColor: event.loserColor || '',
        winnerGold: event.winnerGold || '',
        loserGold: event.loserGold || '',
        winnerRestarts: event.winnerRestarts || '',
        loserRestarts: event.loserRestarts || '',
        matchDetails: event.matchDetails || ''
    };
};

const fillGazetteText = (text, facts) => {
    const values = tokenValues(facts);
    return String(text || '').replace(/\{([a-zA-Z]+)\}/g, (match, key) =>
        Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match
    );
};

const townsFromEvent = (event) => ({
    winnerCastle: event?.winnerCastle || '',
    loserCastle: event?.loserCastle || '',
    winnerColor: event?.winnerColor || '',
    loserColor: event?.loserColor || '',
    winnerName: event?.winnerName || event?.underdog || event?.finalsWinner || '',
    loserName: event?.loserName || event?.favorite || event?.finalsOpponent || '',
    winnerStars: Number(event?.winnerStars) || 0,
    loserStars: Number(event?.loserStars) || 0,
    scoreline: event?.scoreline || ''
});

const composeGazetteIssue = (facts, now = new Date()) => {
    const dateLabel = formatGazetteDate(now);
    const cup = facts?.cup;
    const story = facts?.story || 'idle';
    const eventId = facts?.event?.eventId || null;

    if (!cup || story === 'idle') {
        return {
            headline: 'The arena is quiet',
            body: 'The Gazette prints when something happens: an upset, a heavy gift to the purse, or a new champion. Ordinary maps stay on the cup page.',
            artKey: 'crest',
            dateLabel,
            href: '/tournaments/homm3',
            story: 'idle',
            eventId,
            tournamentId: null,
            source: 'template',
            ...townsFromEvent(null)
        };
    }

    if (story === 'donation') {
        return {
            headline: '{donor} fills the {cupName} purse',
            body: '{donor} put {giftAmount} into {cupName}.{prizeSentence} The field takes notice.',
            artKey: 'gold',
            dateLabel,
            href: cup.href,
            story,
            eventId,
            tournamentId: cup.id,
            source: 'template',
            ...townsFromEvent(null)
        };
    }

    if (story === 'underdog') {
        return {
            headline: '{underdog} upsets {favorite}',
            body: '{underdog} beat the favorite {favorite} in {cupName}.{matchDetails} The form book did not see it coming.',
            artKey: 'castle',
            dateLabel,
            href: cup.href,
            story,
            eventId,
            tournamentId: cup.id,
            source: 'template',
            ...townsFromEvent(facts.event)
        };
    }

    if (story === 'champion') {
        return {
            headline: facts.event?.underdog ? '{underdog} takes {cupName}' : '{finalsWinner} takes {cupName}',
            body: facts.event?.underdog
                ? '{underdog} toppled favorite {favorite} in the final of {cupName}.{matchDetails}{prizeSentence}'
                : '{finalsWinner} defeated {finalsOpponent} in the final of {cupName}.{matchDetails}{prizeSentence} The Gazette records it so.',
            artKey: 'finals',
            dateLabel,
            href: cup.href,
            story,
            eventId,
            tournamentId: cup.id,
            source: 'template',
            ...townsFromEvent(facts.event)
        };
    }

    if (story === 'finals') {
        return {
            headline: 'Finals set in {cupName}',
            body: '{finalsTeam1} meets {finalsTeam2} for the title.{prizeSentence} One match remains between the field and the crown.',
            artKey: 'finals',
            dateLabel,
            href: cup.href,
            story,
            eventId,
            tournamentId: cup.id,
            source: 'template',
            ...townsFromEvent(null)
        };
    }

    return {
        headline: 'The arena is quiet',
        body: 'The Gazette prints when something happens: an upset, a heavy gift to the purse, or a new champion.',
        artKey: 'crest',
        dateLabel,
        href: cup.href || '/tournaments/homm3',
        story: 'idle',
        eventId,
        tournamentId: cup.id,
        source: 'template',
        ...townsFromEvent(null)
    };
};

const clampText = (value, max) =>
    String(value || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, max);

const clampStars = (value) => {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) {
        return 0;
    }
    return Math.min(5, Math.round(amount * 2) / 2);
};

const sanitizeGazetteIssue = (issue, facts = null) => {
    const fallback = composeGazetteIssue(facts || { story: 'idle', cup: null, event: null });
    const artKey = ART_KEYS.includes(issue?.artKey) ? issue.artKey : fallback.artKey;
    const href = String(issue?.href || fallback.href || '/tournaments/homm3');
    const safeHref = href.startsWith('/') ? href.slice(0, 200) : fallback.href;

    return {
        headline: clampText(issue?.headline, 90) || fallback.headline,
        body: clampText(issue?.body, 700) || fallback.body,
        artKey,
        dateLabel: clampText(issue?.dateLabel, 24) || fallback.dateLabel,
        href: safeHref,
        story: issue?.story || fallback.story,
        eventId: issue?.eventId || fallback.eventId || null,
        tournamentId: issue?.tournamentId || fallback.tournamentId || null,
        source: issue?.source === 'ai' ? 'ai' : 'template',
        generatedAt: issue?.generatedAt || new Date().toISOString(),
        winnerCastle: clampText(issue?.winnerCastle || facts?.event?.winnerCastle, 32),
        loserCastle: clampText(issue?.loserCastle || facts?.event?.loserCastle, 32),
        winnerColor: ['red', 'blue'].includes(issue?.winnerColor || facts?.event?.winnerColor)
            ? issue?.winnerColor || facts?.event?.winnerColor
            : '',
        loserColor: ['red', 'blue'].includes(issue?.loserColor || facts?.event?.loserColor)
            ? issue?.loserColor || facts?.event?.loserColor
            : '',
        winnerName: clampText(issue?.winnerName || facts?.event?.winnerName, 40),
        loserName: clampText(issue?.loserName || facts?.event?.loserName, 40),
        winnerStars: clampStars(issue?.winnerStars ?? facts?.event?.winnerStars),
        loserStars: clampStars(issue?.loserStars ?? facts?.event?.loserStars),
        scoreline: clampText(issue?.scoreline || facts?.event?.scoreline, 12)
    };
};

const allowedNamesFromFacts = (facts) => {
    const cup = facts?.cup;
    const event = facts?.event || {};
    if (!cup) {
        return [];
    }
    return [
        cup.name,
        cup.finalsTeam1,
        cup.finalsTeam2,
        cup.finalsWinner,
        cup.prizeLabel,
        event.underdog,
        event.favorite,
        event.donor,
        event.giftAmount,
        event.finalsWinner,
        event.finalsOpponent,
        event.winnerCastle,
        event.loserCastle,
        event.winnerColor,
        event.loserColor,
        event.winnerGold,
        event.loserGold,
        event.winnerRestarts,
        event.loserRestarts,
        event.scoreline,
        event.matchDetails
    ].filter(Boolean);
};

const rewriteWithOpenAI = async (facts, template) => {
    const apiKey = functions.config().openai?.api_key || process.env.OPENAI_API_KEY;
    if (!apiKey || facts?.story === 'idle') {
        return null;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            temperature: 0.6,
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content:
                        'You write one Konoplay Gazette issue in the dry voice of a 1994 business-sim newspaper. Print only a notable event: an upset, a large donation, a champion, or finals being set. Never write a maps-played or prize-ticker story. Return JSON with keys headline, body, artKey. artKey must be one of crest, castle, gold, finals, registration. Use placeholders {cupName} {underdog} {favorite} {donor} {giftAmount} {prizeSentence} {finalsTeam1} {finalsTeam2} {finalsWinner} {finalsOpponent} {matchDetails} {winnerCastle} {loserCastle} {winnerColor} {winnerGold} {loserGold} {winnerRestarts} {scoreline} for names, towns, gold, restarts, and amounts that can change. Do not invent players, scores, castles, colors, gold, restarts, or prize amounts. If {matchDetails} is empty, omit map details. Headline max 80 characters. Body 2-4 short sentences.'
                },
                {
                    role: 'user',
                    content: JSON.stringify({ facts, template })
                }
            ]
        })
    });

    if (!response.ok) {
        throw new Error(`OpenAI request failed (${response.status})`);
    }

    const payload = await response.json();
    const raw = payload?.choices?.[0]?.message?.content;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed?.headline || !parsed?.body) {
        return null;
    }
    return parsed;
};

const requireAdmin = async (context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in.');
    }
    const snap = await db.ref(`meta/admins/${context.auth.uid}`).once('value');
    if (snap.val() !== true) {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can generate the Gazette.');
    }
    return context.auth.uid;
};

exports.generateGazette = functions.https.onCall(async (data, context) => {
    const uid = await requireAdmin(context);
    const tournamentsSnap = await db.ref('tournaments/heroes3').once('value');
    const facts = selectGazetteFacts(buildGazetteFacts(tournamentsSnap.val() || {}), data?.eventId || null);
    const template = composeGazetteIssue(facts);
    const fillIssue = (issue, source) =>
        sanitizeGazetteIssue(
            {
                ...template,
                headline: fillGazetteText(issue.headline, facts),
                body: fillGazetteText(issue.body, facts),
                artKey: issue.artKey,
                source
            },
            facts
        );
    let issue = fillIssue(template, 'template');

    try {
        const rewritten = await rewriteWithOpenAI(facts, template);
        if (rewritten) {
            issue = fillIssue(rewritten, 'ai');
        }
    } catch (error) {
        console.error('generateGazette AI rewrite failed:', error);
    }

    issue.generatedAt = new Date().toISOString();
    issue.generatedBy = uid;
    await db.ref('gazette/draft').set(issue);

    return {
        issue,
        usedAI: issue.source === 'ai',
        allowedNames: allowedNamesFromFacts(facts)
    };
});
