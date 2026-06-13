import { FIREBASE_DATABASE_URL } from '../config/firebase';
import { isPlayerVisibleTournament } from './tournamentVisibility';

export const PUBLIC_DONATION_POOL_SHARE = 0.9;
export const HOST_SEED_POOL_SHARE = 0.95;
/** @deprecated use PUBLIC_DONATION_POOL_SHARE */
export const PRIZE_POOL_DONATION_SHARE = PUBLIC_DONATION_POOL_SHARE;
export const DEFAULT_FUNDING_GOAL_USD = 500;
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
export const isActivePrizePoolTournament = (tournament) =>
    Boolean(tournament && isPlayerVisibleTournament(tournament));

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
    const safeGoal = Number(goal) || 0;
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
