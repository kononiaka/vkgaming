import { FIREBASE_FUNCTIONS_BASE, FIREBASE_DATABASE_URL } from '../config/firebase';
import { authFetch, getFirebaseUid } from './authFetch';
import {
    MIN_HOST_SEED_USD,
    splitHostSeedPayment
} from '../utils/prizePoolData';

const STRIPE_FUNCTION_URL = `${FIREBASE_FUNCTIONS_BASE}/createStripeCheckout`;
const CONFIRM_HOST_SEED_URL = `${FIREBASE_FUNCTIONS_BASE}/confirmTournamentHostSeed`;

export const activateFundedTournament = async (tournamentId, goalUsd, { isPublic = true } = {}) => {
    const { poolUsd, platformUsd } = splitHostSeedPayment(goalUsd);

    await authFetch(`${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tournamentId}.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            communityFundingUsd: poolUsd,
            poolFunded: true,
            poolFundedAt: new Date().toISOString(),
            hostSeedPaidUsd: goalUsd,
            status: isPublic ? 'Registration Started' : 'Draft'
        })
    });

    return { poolUsd, platformUsd };
};

export const fundTournamentFromHostBalance = async (userId, tournamentId, goalUsd, { isPublic = true } = {}) => {
    const userRes = await authFetch(`${FIREBASE_DATABASE_URL}/users/${userId}.json`);
    const userData = await userRes.json();
    const balance = Number(userData?.hostPrizeBalanceUsd) || 0;

    if (balance < goalUsd) {
        return { ok: false, reason: 'insufficient_balance', balance };
    }

    await authFetch(`${FIREBASE_DATABASE_URL}/users/${userId}.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            hostPrizeBalanceUsd: Math.round((balance - goalUsd) * 100) / 100
        })
    });

    const { poolUsd } = await activateFundedTournament(tournamentId, goalUsd, { isPublic });
    return { ok: true, poolUsd, paidFrom: 'balance' };
};

export const startHostSeedCheckout = async ({
    tournamentId,
    tournamentName,
    goalUsd,
    nickname,
    origin = window.location.origin
}) => {
    const firebaseUid = getFirebaseUid();
    if (!firebaseUid || !nickname) {
        throw new Error('Log in to fund the prize pool.');
    }

    const amount = Number(goalUsd);
    if (!Number.isFinite(amount) || amount < MIN_HOST_SEED_USD) {
        throw new Error(`Minimum prize pool seed is $${MIN_HOST_SEED_USD}.`);
    }

    const stripeWindow = window.open('', '_blank');
    if (!stripeWindow) {
        throw new Error('Allow pop-ups to open the payment page.');
    }

    try {
        const response = await fetch(STRIPE_FUNCTION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                purpose: 'tournament_host_seed',
                tournamentId,
                tournamentName,
                amount,
                userId: firebaseUid,
                nickname,
                origin
            })
        });
        const data = await response.json();
        if (!response.ok || !data.url) {
            stripeWindow.close();
            throw new Error(data.error || 'Could not start checkout.');
        }
        stripeWindow.location.href = data.url;
    } catch (error) {
        stripeWindow.close();
        throw error;
    }
};

export const confirmHostSeedPayment = async (sessionId) => {
    const firebaseUid = getFirebaseUid();
    if (!firebaseUid || !sessionId) {
        throw new Error('Missing payment session.');
    }

    const response = await fetch(CONFIRM_HOST_SEED_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sessionId,
            userId: firebaseUid
        })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Could not confirm prize pool payment.');
    }

    return data;
};
