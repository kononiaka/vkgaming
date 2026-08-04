import { FIREBASE_DATABASE_URL } from '../config/firebase';
import { isPlayerVisibleTournament } from './tournamentVisibility';

export const PUBLIC_DONATION_POOL_SHARE = 0.9;
export const HOST_SEED_POOL_SHARE = 0.95;
/** @deprecated use PUBLIC_DONATION_POOL_SHARE */
export const PRIZE_POOL_DONATION_SHARE = PUBLIC_DONATION_POOL_SHARE;
export const DEFAULT_FUNDING_GOAL_USD = 5;
export const MIN_HOST_SEED_USD = 5;
export const UAH_TO_USD = 1 / 41;

export const FUNDABLE_TOURNAMENT_STATUSES = new Set(['Registration', 'Registration Started', 'Started!']);

export const splitHostSeedPayment = (paidUsd) => {
    const paid = Number(paidUsd) || 0;
    const poolUsd = Math.round(paid * HOST_SEED_POOL_SHARE * 100) / 100;
    return {
        poolUsd,
        platformUsd: Math.round((paid - poolUsd) * 100) / 100
    };
};

export const splitPublicDonation = (paidUsd) => {
    const paid = Number(paidUsd) || 0;
    const poolUsd = Math.round(paid * PUBLIC_DONATION_POOL_SHARE * 100) / 100;
    return {
        poolUsd,
        platformUsd: Math.round((paid - poolUsd) * 100) / 100
    };
};

export const getHostSeedPoolPreview = (goalUsd) => {
    const goal = Number(goalUsd) || 0;
    return Math.round(goal * HOST_SEED_POOL_SHARE * 100) / 100;
};

export const hasSecuredPoolFunding = (tournament) => {
    if (tournament?.poolFunded === true) {
        return true;
    }
    const collected = Number(tournament?.communityFundingUsd);
    return Number.isFinite(collected) && collected > 0;
};

export const isLiveFundableTournament = (tournament) =>
    Boolean(
        tournament &&
            isPlayerVisibleTournament(tournament) &&
            FUNDABLE_TOURNAMENT_STATUSES.has(tournament.status) &&
            hasSecuredPoolFunding(tournament)
    );

/** Public tournaments in registration or live — shown in prize pool widgets. */
export const isActivePrizePoolTournament = (tournament) => Boolean(tournament && isPlayerVisibleTournament(tournament));

export const getTournamentPrizePoolLink = (tournament) => {
    if (tournament?.status === 'Registration' || tournament?.status === 'Registration Started') {
        return `/tournaments/homm3/${tournament.id || ''}?status=registration`;
    }

    return `/tournaments/homm3/${tournament.id || ''}?status=started`;
};

export const normalizeDonationToUsd = (amount, currency = 'USD') => {
    const value = Number(amount) || 0;
    if (value <= 0) {
        return 0;
    }

    const code = String(currency || 'USD').toUpperCase();
    if (code === 'UAH') {
        return value * UAH_TO_USD;
    }
    if (code === 'RUB') {
        return value / 90;
    }
    return value;
};

export const getTournamentFundingGoalUsd = (tournament) => {
    if (!tournament) {
        return DEFAULT_FUNDING_GOAL_USD;
    }

    const explicitGoal = Number(tournament.fundingGoalUsd);
    if (Number.isFinite(explicitGoal) && explicitGoal > 0) {
        return explicitGoal;
    }

    const totalPrizeUsd = Number(tournament.totalPrizeUsd);
    if (Number.isFinite(totalPrizeUsd) && totalPrizeUsd > 0) {
        return totalPrizeUsd;
    }

    if (tournament.pricePull && typeof tournament.pricePull === 'object') {
        const total = Object.values(tournament.pricePull).reduce((sum, entry) => sum + Number(entry || 0), 0);
        if (total > 0) {
            return total;
        }
    }

    return DEFAULT_FUNDING_GOAL_USD;
};

export const getTournamentCollectedUsd = (tournament) => {
    const collected = Number(tournament?.communityFundingUsd);
    return Number.isFinite(collected) && collected > 0 ? collected : 0;
};

export const getFundingProgress = (collected, goal) => {
    // Host seed deposits 95% into the pool; progress is vs that expected pool amount
    // so a fully paid seed shows 100% (not ~95% with a truncated bar).
    const safeGoal = getHostSeedPoolPreview(goal) || Number(goal) || 0;
    const safeCollected = Number(collected) || 0;
    if (safeGoal <= 0) {
        return 0;
    }
    return Math.min(100, Math.round((safeCollected / safeGoal) * 100));
};

export const formatFundingUsd = (amount) => {
    const value = Number(amount) || 0;
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

export const buildUsdPrizesFromFunding = (tournament) => {
    const totalUsd = getTournamentCollectedUsd(tournament);
    if (totalUsd <= 0) {
        return null;
    }

    return {
        '1st Place': Math.round(totalUsd * 0.6),
        '2nd Place': Math.round(totalUsd * 0.3),
        '3rd Place': Math.round(totalUsd * 0.1)
    };
};

export const getTournamentPrizeBreakdown = (tournament) => {
    const fromFunding = buildUsdPrizesFromFunding(tournament);
    if (fromFunding) {
        return fromFunding;
    }

    if (tournament?.pricePull && typeof tournament.pricePull === 'object') {
        return tournament.pricePull;
    }

    return null;
};

export const getPrizeAmountForPlace = (breakdown, place) => {
    if (!breakdown || !place) {
        return null;
    }

    if (breakdown[place] != null && Number(breakdown[place]) > 0) {
        return Number(breakdown[place]);
    }

    const normalizedPlace = String(place).trim().toLowerCase();
    const matchedKey = Object.keys(breakdown).find((key) => key.trim().toLowerCase() === normalizedPlace);
    if (matchedKey && Number(breakdown[matchedKey]) > 0) {
        return Number(breakdown[matchedKey]);
    }

    return null;
};

const PROVIDER_LABELS = {
    donationalerts: 'Donation Alerts',
    bmc: 'Buy Me a Coffee',
    stripe: 'Stripe',
    host_balance: 'Host balance',
    donation: 'Donation'
};

const TYPE_LABELS = {
    donation: 'Donation',
    host_seed: 'Host seed',
    attendance_fee: 'Attendance fee'
};

export const formatPrizePoolAmount = (amount) => {
    const value = Number(amount) || 0;
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

export const getPrizePoolHistoryEntries = (tournament, { limit = 25 } = {}) => {
    const raw = tournament?.prizePoolHistory;
    const fromLedger = raw && typeof raw === 'object'
        ? Object.entries(raw).map(([id, entry]) => ({
              id,
              type: entry?.type || 'donation',
              provider: entry?.provider || null,
              donorUsername: entry?.donorUsername || null,
              amountUsd: Number(entry?.amountUsd) || 0,
              paidUsd: entry?.paidUsd != null ? Number(entry.paidUsd) : null,
              grossUsd: entry?.grossUsd != null ? Number(entry.grossUsd) : null,
              poolShareUsd: entry?.poolShareUsd != null ? Number(entry.poolShareUsd) : null,
              currency: entry?.currency || null,
              splitAcross: Number(entry?.splitAcross) || 1,
              targeted: Boolean(entry?.targeted),
              at: entry?.at || null
          }))
        : [];

    // Older cups only have totals — surface host seed as a synthetic row when present.
    if (
        fromLedger.length === 0 &&
        tournament?.poolFunded &&
        (Number(tournament.hostSeedPaidUsd) > 0 || Number(tournament.communityFundingUsd) > 0)
    ) {
        const paid = Number(tournament.hostSeedPaidUsd) || 0;
        const pool =
            paid > 0 ? Math.round(paid * HOST_SEED_POOL_SHARE * 100) / 100 : Number(tournament.communityFundingUsd) || 0;
        fromLedger.push({
            id: 'legacy-host-seed',
            type: 'host_seed',
            provider: 'stripe',
            donorUsername: tournament.createdBy || null,
            amountUsd: pool,
            paidUsd: paid || null,
            grossUsd: null,
            poolShareUsd: null,
            currency: 'USD',
            splitAcross: 1,
            targeted: false,
            at: tournament.poolFundedAt || null,
            legacy: true
        });
    }

    return fromLedger
        .filter((entry) => entry.amountUsd > 0)
        .sort((a, b) => {
            const aMs = a.at ? new Date(a.at).getTime() : 0;
            const bMs = b.at ? new Date(b.at).getTime() : 0;
            return bMs - aMs;
        })
        .slice(0, limit)
        .map((entry) => {
            const typeLabel = TYPE_LABELS[entry.type] || 'Funding';
            const providerLabel = entry.provider ? PROVIDER_LABELS[entry.provider] || entry.provider : null;
            const who = entry.donorUsername || 'Unknown';
            let detail = typeLabel;
            if (entry.type === 'donation') {
                detail = providerLabel ? `${providerLabel} · ${who}` : who;
                if (entry.splitAcross > 1) {
                    detail += entry.targeted
                        ? ` · split across ${entry.splitAcross} selected cups`
                        : ` · split across ${entry.splitAcross} live cups`;
                }
                if (entry.grossUsd != null && entry.grossUsd > 0) {
                    detail += ` · 90% of ${formatPrizePoolAmount(entry.grossUsd)}`;
                }
            } else if (entry.type === 'host_seed') {
                detail = providerLabel ? `${typeLabel} · ${providerLabel}` : typeLabel;
                if (who && who !== 'Unknown') {
                    detail += ` · ${who}`;
                }
                if (entry.paidUsd != null && entry.paidUsd > 0) {
                    detail += ` · paid ${formatPrizePoolAmount(entry.paidUsd)}`;
                }
                if (entry.legacy) {
                    detail += ' · estimated (pre-history)';
                }
            } else if (entry.type === 'attendance_fee') {
                detail = `${typeLabel} · ${who}`;
            }

            let whenLabel = '';
            if (entry.at) {
                const date = new Date(entry.at);
                if (!Number.isNaN(date.getTime())) {
                    whenLabel = date.toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                }
            }

            return {
                ...entry,
                typeLabel,
                providerLabel,
                detail,
                whenLabel,
                amountLabel: `+${formatPrizePoolAmount(entry.amountUsd)}`
            };
        });
};

export const buildPrizePoolEntry = (tournament, id) => {
    const collected = getTournamentCollectedUsd(tournament);
    const goalUsd = getTournamentFundingGoalUsd(tournament);
    const status = tournament?.status;

    return {
        id,
        name: tournament.name || 'Live tournament',
        collected,
        goalUsd,
        collectedLabel: formatFundingUsd(collected),
        goalLabel: formatFundingUsd(goalUsd),
        progressPct: getFundingProgress(collected, goalUsd),
        status,
        statusLabel: status === 'Started!' ? 'In progress' : 'Registration open',
        tournamentLink: getTournamentPrizePoolLink({ ...tournament, id })
    };
};

const prizePoolEntrySort = (a, b) => {
    const statusRank = (entry) => (entry.status === 'Started!' ? 0 : 1);
    const statusDiff = statusRank(a) - statusRank(b);
    if (statusDiff !== 0) {
        return statusDiff;
    }
    if (b.collected !== a.collected) {
        return b.collected - a.collected;
    }
    return a.name.localeCompare(b.name);
};

export const buildPrizePoolEntries = (tournamentsById = {}) =>
    Object.entries(tournamentsById)
        .filter(([, tournament]) => isActivePrizePoolTournament(tournament))
        .map(([id, tournament]) => buildPrizePoolEntry(tournament, id))
        .sort(prizePoolEntrySort);

export const buildDonatablePrizePoolEntries = (tournamentsById = {}) =>
    Object.entries(tournamentsById)
        .filter(([, tournament]) => isLiveFundableTournament(tournament))
        .map(([id, tournament]) => buildPrizePoolEntry(tournament, id))
        .sort(prizePoolEntrySort);

export const filterDonationTargetIds = (selectedIds = [], donatableIds = []) => {
    if (!Array.isArray(selectedIds) || selectedIds.length === 0) {
        return [];
    }

    const allowed = new Set(donatableIds);
    return selectedIds.map(String).filter((id) => allowed.has(id));
};

export const resolveDonationTargetIds = (selectedIds, donatableIds) => {
    const filtered = filterDonationTargetIds(selectedIds, donatableIds);
    if (filtered.length > 0) {
        return filtered;
    }

    return [...donatableIds];
};

export const fetchDonatableTournamentPools = async () => {
    const response = await fetch(`${FIREBASE_DATABASE_URL}/tournaments/heroes3.json`);
    if (!response.ok) {
        throw new Error('Failed to load donatable tournament prize pools');
    }

    const tournaments = await response.json();
    if (!tournaments) {
        return [];
    }

    return buildDonatablePrizePoolEntries(tournaments);
};

export const fetchLiveTournamentPrizePools = async () => {
    const response = await fetch(`${FIREBASE_DATABASE_URL}/tournaments/heroes3.json`);
    if (!response.ok) {
        throw new Error('Failed to load tournament prize pools');
    }

    const tournaments = await response.json();
    if (!tournaments) {
        return [];
    }

    return buildPrizePoolEntries(tournaments);
};
