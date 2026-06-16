// Circle-method round-robin: map of "team1|team2" -> round number (1-indexed)
export const buildLeagueRoundMap = (names) => {
    const list = names.length % 2 !== 0 ? [...names, null] : [...names];
    const size = list.length;
    const map = {};

    for (let r = 0; r < size - 1; r++) {
        const rotation = [list[0]];
        for (let i = 0; i < size - 1; i++) {
            rotation.push(list[1 + ((i + r) % (size - 1))]);
        }
        for (let i = 0; i < size / 2; i++) {
            const p1 = rotation[i];
            const p2 = rotation[size - 1 - i];
            if (p1 !== null && p2 !== null) {
                map[`${p1}|${p2}`] = r + 1;
                map[`${p2}|${p1}`] = r + 1;
            }
        }
    }

    return map;
};

export const resolveLeagueRound = (tournament, pair) => {
    const round = pair?.round;
    if (round != null && round !== '') {
        return round;
    }

    const stagePairs = tournament?.bracket?.playoffPairs?.[0];
    if (!Array.isArray(stagePairs) || !pair?.team1 || !pair?.team2) {
        return null;
    }

    const playerNames = [
        ...new Set(
            stagePairs
                .flatMap((stagePair) => [stagePair.team1, stagePair.team2])
                .filter((name) => name && name !== 'TBD' && name !== 'null')
        )
    ];
    const roundMap = buildLeagueRoundMap(playerNames);

    return roundMap[`${pair.team1}|${pair.team2}`] ?? roundMap[`${pair.team2}|${pair.team1}`] ?? null;
};

export const formatTournamentTypeLabel = (tournamentType) => {
    switch (tournamentType) {
        case 'league':
            return 'League';
        case 'kick-off':
            return 'Kick-off';
        case 'swiss':
            return 'Swiss';
        case 'champions-league':
            return 'Champions League';
        default:
            if (!tournamentType) {
                return null;
            }
            return String(tournamentType)
                .split('-')
                .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                .join(' ');
    }
};

export const buildMatchStageLabel = (tournament, pair, stageIndex = 0) => {
    const tournamentType = tournament?.type;
    const group = pair?.group;
    const stage = pair?.stage;

    if (tournamentType === 'league') {
        const round = resolveLeagueRound(tournament, pair);
        if (round != null && round !== '') {
            return `Leg ${round}`;
        }
        return /^league$/i.test(stage) ? null : stage || null;
    }

    const round = pair?.round;

    if (tournamentType === 'champions-league') {
        if (group) {
            return `Group ${group}`;
        }
        return stage || `Stage ${stageIndex + 1}`;
    }

    if (tournamentType === 'swiss') {
        if (round != null && round !== '') {
            return `Round ${round}`;
        }
        return stage || 'Swiss';
    }

    return stage || `Stage ${stageIndex + 1}`;
};

export const buildMatchBannerLabel = ({
    tournamentName,
    tournamentType,
    stageLabel,
    tournament = null,
    pair = null
}) => {
    const typeLabel = formatTournamentTypeLabel(tournamentType);
    let resolvedStageLabel = stageLabel;

    if (tournamentType === 'league') {
        const round = resolveLeagueRound(tournament, pair);
        if (round != null && round !== '') {
            resolvedStageLabel = `Leg ${round}`;
        } else if (!resolvedStageLabel || /^league$/i.test(resolvedStageLabel)) {
            resolvedStageLabel = null;
        }
    }

    const parts = [tournamentName, typeLabel, resolvedStageLabel].filter(Boolean);
    const deduped = parts.filter((part, index) => index === 0 || part.toLowerCase() !== parts[index - 1].toLowerCase());

    return deduped.join(' · ');
};

export const buildMatchScheduleBadge = (tournament, pair, stageIndex = 0) => {
    const label = buildMatchStageLabel(tournament, pair, stageIndex);
    return label ? label.toUpperCase() : '';
};
