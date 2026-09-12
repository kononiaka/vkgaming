const isPlaceholder = (name) => !name || name === 'TBD' || name === 'BYE' || name === 'null';

export const hotaWinProbPairKey = (team1, team2) => {
    const a = String(team1 || '')
        .trim()
        .toLowerCase();
    const b = String(team2 || '')
        .trim()
        .toLowerCase();
    return `${a}|${b}`;
};

/** Strip common tournament suffixes so HotA Meta nickname lookup still works. */
export const hotaWinProbNameCandidates = (name) => {
    const raw = String(name || '').trim();
    if (!raw) {
        return [];
    }

    const candidates = [raw];
    const withoutDemo = raw.replace(/\s*\(demo\)\s*$/i, '').trim();
    if (withoutDemo && withoutDemo !== raw) {
        candidates.push(withoutDemo);
    }

    return candidates;
};

export const canFetchHotaWinProb = (team1, team2) =>
    !isPlaceholder(team1) && !isPlaceholder(team2) && team1 !== team2;

export const formatHotaWinProbPercents = (winprob) => {
    const pA = Number(winprob?.p_a);
    if (!Number.isFinite(pA)) {
        return null;
    }

    const team1Pct = Math.min(100, Math.max(0, pA * 100));
    return {
        team1: team1Pct.toFixed(1),
        team2: (100 - team1Pct).toFixed(1),
        withPicks: Boolean(winprob?.inputs?.with_picks)
    };
};
