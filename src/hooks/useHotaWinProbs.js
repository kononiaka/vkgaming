import { useEffect, useMemo, useState } from 'react';
import { fetchHotaWinProb } from '../api/hotaMeta';
import {
    canFetchHotaWinProb,
    formatHotaWinProbPercents,
    hotaWinProbNameCandidates,
    hotaWinProbPairKey
} from '../utils/hotaWinProb';

const winProbCache = new Map();
const CONCURRENCY = 4;

const uniquePairList = (pairs) => {
    const seen = new Set();
    const list = [];

    (pairs || []).forEach((pair) => {
        const team1 = pair?.team1;
        const team2 = pair?.team2;
        if (!canFetchHotaWinProb(team1, team2)) {
            return;
        }
        const key = hotaWinProbPairKey(team1, team2);
        if (seen.has(key)) {
            return;
        }
        seen.add(key);
        list.push({ key, team1, team2 });
    });

    return list;
};

const resolveWinProb = async (team1, team2) => {
    const names1 = hotaWinProbNameCandidates(team1);
    const names2 = hotaWinProbNameCandidates(team2);

    for (const name1 of names1) {
        for (const name2 of names2) {
            try {
                const winprob = await fetchHotaWinProb(name1, name2);
                const formatted = formatHotaWinProbPercents(winprob);
                if (formatted) {
                    return formatted;
                }
            } catch {
                // Try next nickname candidate (player may not exist on HotA Meta).
            }
        }
    }

    return null;
};

/**
 * Loads HotA Meta ML win probabilities for matchup pairs.
 * Existing Konoplay "win odds" stay untouched; this map is additive only.
 */
export function useHotaWinProbs(pairs = []) {
    const pairList = useMemo(() => uniquePairList(pairs), [pairs]);
    const [byPairKey, setByPairKey] = useState({});

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            try {
                if (!pairList.length) {
                    setByPairKey({});
                    return;
                }

                const next = {};
                const pending = [];

                pairList.forEach((pair) => {
                    if (winProbCache.has(pair.key)) {
                        next[pair.key] = winProbCache.get(pair.key);
                    } else {
                        pending.push(pair);
                    }
                });

                if (!cancelled) {
                    setByPairKey({ ...next });
                }

                for (let i = 0; i < pending.length; i += CONCURRENCY) {
                    if (cancelled) {
                        return;
                    }

                    const batch = pending.slice(i, i + CONCURRENCY);
                    const results = await Promise.all(
                        batch.map(async (pair) => {
                            try {
                                const formatted = await resolveWinProb(pair.team1, pair.team2);
                                winProbCache.set(pair.key, formatted);
                                return [pair.key, formatted];
                            } catch {
                                winProbCache.set(pair.key, null);
                                return [pair.key, null];
                            }
                        })
                    );

                    results.forEach(([key, value]) => {
                        next[key] = value;
                    });

                    if (!cancelled) {
                        setByPairKey({ ...next });
                    }
                }
            } catch {
                // HotA predictions are optional; never break the page if they fail.
            }
        };

        run().catch(() => {});

        return () => {
            cancelled = true;
        };
    }, [pairList]);

    return byPairKey;
}
