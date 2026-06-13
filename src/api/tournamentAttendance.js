import { FIREBASE_FUNCTIONS_BASE, FIREBASE_DATABASE_URL } from '../config/firebase';
import { authFetch, getFirebaseUid } from './authFetch';

const STRIPE_FUNCTION_URL = `${FIREBASE_FUNCTIONS_BASE}/createStripeCheckout`;
const CONFIRM_ATTENDANCE_URL = `${FIREBASE_FUNCTIONS_BASE}/confirmTournamentAttendance`;

export const fetchAttendancePayment = async (tournamentId, firebaseUid = getFirebaseUid()) => {
    if (!tournamentId || !firebaseUid) {
        return null;
    }

    const response = await authFetch(
        `${FIREBASE_DATABASE_URL}/tournaments/heroes3/${tournamentId}/attendancePaid/${encodeURIComponent(firebaseUid)}.json`
    );
    if (!response.ok) {
        return null;
    }

    const data = await response.json();
    return data && typeof data === 'object' ? data : null;
};

export const waitForAttendancePayment = async (
    tournamentId,
    { attempts = 8, delayMs = 1500, firebaseUid = getFirebaseUid() } = {}
) => {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        if (await hasPaidAttendance(tournamentId, firebaseUid)) {
            return true;
        }
        if (attempt < attempts - 1) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }
    return false;
};

export const confirmAttendancePayment = async (sessionId) => {
    const firebaseUid = getFirebaseUid();
    if (!firebaseUid || !sessionId) {
        throw new Error('Missing payment session.');
    }

    const response = await fetch(CONFIRM_ATTENDANCE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sessionId,
            userId: firebaseUid
        })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Could not confirm attendance payment.');
    }

    return data;
};

export const hasPaidAttendance = async (tournamentId, firebaseUid = getFirebaseUid()) => {
    const payment = await fetchAttendancePayment(tournamentId, firebaseUid);
    return Boolean(payment?.paidAt);
};

export const startAttendanceCheckout = async ({
    tournamentId,
    tournamentName,
    feeUsd,
    nickname,
    origin = window.location.origin
}) => {
    const firebaseUid = getFirebaseUid();
    if (!firebaseUid || !nickname) {
        throw new Error('Log in to pay the attendance fee.');
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
                purpose: 'tournament_attendance',
                tournamentId,
                tournamentName,
                amount: feeUsd,
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
