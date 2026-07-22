const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');
const Stripe = require('stripe');

admin.initializeApp({
    databaseURL: 'https://test-prod-app-81915-default-rtdb.firebaseio.com'
});
const db = admin.database();
const DA_CLIENT_ID = '17904';
const OAUTH_CALLBACK_URL = 'https://us-central1-test-prod-app-81915.cloudfunctions.net/oauthCallback';
const UAH_TO_USD = 1 / 41;
const PUBLIC_DONATION_POOL_SHARE = 0.9;
const HOST_SEED_POOL_SHARE = 0.95;
const MIN_STRIPE_DONATION_USD = 5;

function normalizeDonationToUsd(amount, currency = 'USD') {
    const value = parseFloat(amount || 0);
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
}

const FUNDABLE_TOURNAMENT_STATUSES = new Set(['Registration', 'Registration Started', 'Started!']);

function hasSecuredPoolFunding(tournament) {
    if (tournament?.poolFunded === true) {
        return true;
    }
    const collected = Number(tournament?.communityFundingUsd) || 0;
    return collected > 0;
}

function isFundableTournament(tournament) {
    return (
        tournament?.isPublic !== false &&
        FUNDABLE_TOURNAMENT_STATUSES.has(tournament?.status) &&
        hasSecuredPoolFunding(tournament)
    );
}

async function recordPlatformShare(amountUsd) {
    const share = Number(amountUsd) || 0;
    if (share <= 0) {
        return;
    }
    await db.ref('prizePoolFunding/platform').transaction((current) => (current || 0) + share);
}

function parseTargetTournamentIds(raw) {
    if (!raw) {
        return null;
    }

    if (Array.isArray(raw)) {
        const ids = raw.map(String).map((id) => id.trim()).filter(Boolean);
        return ids.length > 0 ? ids : null;
    }

    if (typeof raw === 'string') {
        const ids = raw
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean);
        return ids.length > 0 ? ids : null;
    }

    return null;
}

async function allocateDonationToLivePrizePools(amount, currency, targetTournamentIds = null) {
    const usdAmount = normalizeDonationToUsd(amount, currency);
    const prizeShare = usdAmount * PUBLIC_DONATION_POOL_SHARE;
    const platformShare = usdAmount - prizeShare;
    if (prizeShare <= 0) {
        return;
    }

    const tournamentsSnap = await db.ref('tournaments/heroes3').once('value');
    const tournaments = tournamentsSnap.val() || {};
    let liveIds = Object.entries(tournaments)
        .filter(([, tournament]) => isFundableTournament(tournament))
        .map(([id]) => id);

    let usedExplicitTargets = false;
    if (Array.isArray(targetTournamentIds)) {
        usedExplicitTargets = true;
        if (targetTournamentIds.length === 0) {
            liveIds = [];
        } else {
            const targetSet = new Set(targetTournamentIds.map(String));
            liveIds = liveIds.filter((id) => targetSet.has(id));
        }
    } else {
        const parsedTargets = parseTargetTournamentIds(targetTournamentIds);
        if (parsedTargets) {
            usedExplicitTargets = true;
            const targetSet = new Set(parsedTargets);
            liveIds = liveIds.filter((id) => targetSet.has(id));
        }
    }

    if (liveIds.length === 0) {
        await db.ref('prizePoolFunding/unallocated').transaction((current) => (current || 0) + prizeShare);
        await recordPlatformShare(platformShare);
        console.log(
            usedExplicitTargets
                ? `No matching selected cups — stored $${prizeShare.toFixed(2)} in unallocated prize pool funding; platform $${platformShare.toFixed(2)}`
                : `No open cups — stored $${prizeShare.toFixed(2)} in unallocated prize pool funding; platform $${platformShare.toFixed(2)}`
        );
        return;
    }

    const sharePerTournament = prizeShare / liveIds.length;
    const updates = {};
    for (const id of liveIds) {
        updates[`tournaments/heroes3/${id}/communityFundingUsd`] = admin.database.ServerValue.increment(
            sharePerTournament
        );
    }
    await db.ref().update(updates);
    await recordPlatformShare(platformShare);
    console.log(
        usedExplicitTargets
            ? `Allocated $${prizeShare.toFixed(2)} across ${liveIds.length} selected cup(s) ($${sharePerTournament.toFixed(2)} each); platform $${platformShare.toFixed(2)}`
            : `Allocated $${prizeShare.toFixed(2)} across ${liveIds.length} live cup(s) ($${sharePerTournament.toFixed(2)} each); platform $${platformShare.toFixed(2)}`
    );
}

const OPEN_REGISTRATION_STATUSES = new Set(['Registration', 'Registration Started']);

function isRegistrationOpenStatus(status) {
    return OPEN_REGISTRATION_STATUSES.has(status);
}

function isPlayerRegisteredInTournament(tournament, nickname) {
    const normalized = String(nickname || '').trim().toLowerCase();
    if (!normalized) {
        return false;
    }

    return Object.values(tournament?.players || {}).some(
        (player) => player?.name && String(player.name).trim().toLowerCase() === normalized
    );
}

async function findDbUserIdByNickname(nickname) {
    const usersSnap = await db.ref('users').once('value');
    const usersData = usersSnap.val() || {};
    const normalized = String(nickname || '').trim().toLowerCase();
    const matchedEntry = Object.entries(usersData).find(
        ([, user]) => user?.enteredNickname && String(user.enteredNickname).trim().toLowerCase() === normalized
    );
    return matchedEntry ? matchedEntry[0] : null;
}

async function processTournamentAttendancePayment(session, metadata) {
    const processedRef = db.ref(`processedStripe/${session.id}`);
    if ((await processedRef.once('value')).exists()) {
        return;
    }

    const { userId, nickname, amount, tournamentId } = metadata;
    if (!userId || !nickname || !tournamentId) {
        console.error('Missing attendance payment metadata');
        await processedRef.set({
            reason: 'missing_metadata',
            processedAt: new Date().toISOString()
        });
        return;
    }

    const tournamentSnap = await db.ref(`tournaments/heroes3/${tournamentId}`).once('value');
    const tournament = tournamentSnap.val();
    if (!tournament) {
        console.error(`Attendance payment for missing tournament ${tournamentId}`);
        await processedRef.set({
            reason: 'tournament_not_found',
            tournamentId,
            processedAt: new Date().toISOString()
        });
        return;
    }

    const configuredFee = Number(tournament.attendanceFeeUsd) || 0;
    const paidAmount = parseFloat(amount || 0);
    if (configuredFee <= 0 || Math.abs(paidAmount - configuredFee) > 0.001) {
        console.error(`Attendance amount mismatch for tournament ${tournamentId}`);
        await processedRef.set({
            reason: 'amount_mismatch',
            tournamentId,
            paidAmount,
            configuredFee,
            processedAt: new Date().toISOString()
        });
        return;
    }

    if (!isRegistrationOpenStatus(tournament.status)) {
        console.error(`Attendance payment after registration closed for ${tournamentId}`);
        await processedRef.set({
            reason: 'registration_closed',
            tournamentId,
            processedAt: new Date().toISOString()
        });
        return;
    }

    if (isPlayerRegisteredInTournament(tournament, nickname)) {
        await processedRef.set({
            reason: 'already_registered',
            tournamentId,
            nickname,
            processedAt: new Date().toISOString()
        });
        return;
    }

    const paidRef = db.ref(`tournaments/heroes3/${tournamentId}/attendancePaid/${userId}`);
    if ((await paidRef.once('value')).exists()) {
        await processedRef.set({
            reason: 'already_paid',
            tournamentId,
            userId,
            processedAt: new Date().toISOString()
        });
        return;
    }

    await db.ref(`tournaments/heroes3/${tournamentId}`).update({
        communityFundingUsd: admin.database.ServerValue.increment(paidAmount)
    });

    await paidRef.set({
        nickname,
        amount: paidAmount,
        stripeSessionId: session.id,
        paidAt: new Date().toISOString()
    });

    try {
        const dbUserId = await findDbUserIdByNickname(nickname);
        if (dbUserId) {
            await recordDonorContribution(dbUserId, paidAmount, 'USD');
        }
    } catch (statsError) {
        console.error(`Attendance donor stats update failed for session ${session.id}:`, statsError.message);
    }

    await processedRef.set({
        purpose: 'tournament_attendance',
        tournamentId,
        userId,
        nickname,
        amount: paidAmount,
        processedAt: new Date().toISOString()
    });

    console.log(`Attendance fee $${paidAmount} recorded for ${nickname} in tournament ${tournamentId}`);
}

async function processTournamentHostSeedPayment(session, metadata) {
    const processedRef = db.ref(`processedStripe/${session.id}`);
    if ((await processedRef.once('value')).exists()) {
        return;
    }

    const { userId, nickname, amount, tournamentId } = metadata;
    if (!userId || !nickname || !tournamentId) {
        console.error('Missing host seed payment metadata');
        await processedRef.set({
            reason: 'missing_metadata',
            processedAt: new Date().toISOString()
        });
        return;
    }

    const tournamentSnap = await db.ref(`tournaments/heroes3/${tournamentId}`).once('value');
    const tournament = tournamentSnap.val();
    if (!tournament) {
        console.error(`Host seed payment for missing tournament ${tournamentId}`);
        await processedRef.set({
            reason: 'tournament_not_found',
            tournamentId,
            processedAt: new Date().toISOString()
        });
        return;
    }

    if (tournament.poolFunded) {
        await processedRef.set({
            reason: 'already_funded',
            tournamentId,
            processedAt: new Date().toISOString()
        });
        return;
    }

    if (tournament.status !== 'Pending funding') {
        console.error(`Host seed payment for tournament ${tournamentId} in status ${tournament.status}`);
        await processedRef.set({
            reason: 'invalid_status',
            tournamentId,
            status: tournament.status,
            processedAt: new Date().toISOString()
        });
        return;
    }

    const goalUsd = Number(tournament.fundingGoalUsd) || 0;
    const paidAmount = parseFloat(amount || 0);
    if (goalUsd <= 0 || Math.abs(paidAmount - goalUsd) > 0.001) {
        console.error(`Host seed amount mismatch for tournament ${tournamentId}`);
        await processedRef.set({
            reason: 'amount_mismatch',
            tournamentId,
            paidAmount,
            goalUsd,
            processedAt: new Date().toISOString()
        });
        return;
    }

    const poolUsd = Math.round(paidAmount * HOST_SEED_POOL_SHARE * 100) / 100;
    const platformUsd = Math.round((paidAmount - poolUsd) * 100) / 100;

    await db.ref(`tournaments/heroes3/${tournamentId}`).update({
        communityFundingUsd: poolUsd,
        poolFunded: true,
        poolFundedAt: new Date().toISOString(),
        hostSeedPaidUsd: paidAmount,
        status: tournament.isPublic !== false ? 'Registration Started' : 'Draft'
    });
    await recordPlatformShare(platformUsd);

    await processedRef.set({
        purpose: 'tournament_host_seed',
        tournamentId,
        userId,
        nickname,
        amount: paidAmount,
        poolUsd,
        platformUsd,
        processedAt: new Date().toISOString()
    });

    console.log(
        `Host seed $${paidAmount} for ${tournamentId}: $${poolUsd} to pool, $${platformUsd} platform`
    );
}

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

async function getValidAccessToken() {
    const clientSecret = functions.config().donationalerts.client_secret;
    const tokenData = (await db.ref('daTokens').once('value')).val();

    if (!tokenData) {
        throw new Error('No tokens stored. Complete OAuth authorization first.');
    }

    // Still valid (5-minute buffer)
    if (tokenData.expires_at && Date.now() < tokenData.expires_at - 300000) {
        return tokenData.access_token;
    }

    // Refresh
    const resp = await fetch('https://www.donationalerts.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: tokenData.refresh_token,
            client_id: DA_CLIENT_ID,
            client_secret: clientSecret
        }).toString()
    });
    const refreshed = await resp.json();

    if (!refreshed.access_token) {
        throw new Error('Failed to refresh token: ' + JSON.stringify(refreshed));
    }

    await db.ref('daTokens').set({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token || tokenData.refresh_token,
        expires_at: Date.now() + refreshed.expires_in * 1000
    });

    return refreshed.access_token;
}

async function recordDonorContribution(userId, amount, currency) {
    const usdAmount = normalizeDonationToUsd(amount, currency);
    if (usdAmount <= 0) {
        return;
    }

    await db.ref(`users/${userId}`).update({
        totalDonatedUsd: admin.database.ServerValue.increment(usdAmount),
        donationCount: admin.database.ServerValue.increment(1),
        lastDonationAt: new Date().toISOString()
    });
}

/**
 * Match a tip to a profile username field, allocate prize pools, and credit donor stats.
 * Used by Donation Alerts (poll) and Buy Me a Coffee (webhook).
 */
async function processMatchedDonation(
    {
        provider,
        externalId,
        donorUsername,
        amount,
        currency,
        usernameField,
        processedCollection,
        unmatchedReason
    },
    usersData
) {
    const donationId = String(externalId);
    const processedRef = db.ref(`${processedCollection}/${donationId}`);
    if ((await processedRef.once('value')).exists()) {
        return { status: 'already_processed' };
    }

    const parsedAmount = parseFloat(amount || 0);
    const trimmedUsername = (donorUsername || '').trim();
    const donationCurrency = currency || 'USD';

    if (parsedAmount <= 0) {
        await processedRef.set({
            provider,
            donorUsername: trimmedUsername,
            amount: parsedAmount,
            reason: 'invalid_amount',
            processedAt: new Date().toISOString()
        });
        return { status: 'invalid_amount' };
    }

    const normalisedUsername = trimmedUsername.toLowerCase();
    const matchedEntry = Object.entries(usersData || {}).find(([, user]) => {
        const linked = user?.[usernameField];
        return linked && String(linked).trim().toLowerCase() === normalisedUsername;
    });

    let targetTournamentIds = null;
    if (matchedEntry) {
        const [, userPreview] = matchedEntry;
        if (Array.isArray(userPreview.donationTargetTournamentIds)) {
            targetTournamentIds = userPreview.donationTargetTournamentIds;
        }
    }

    try {
        await allocateDonationToLivePrizePools(parsedAmount, donationCurrency, targetTournamentIds);
    } catch (allocationError) {
        console.error(
            `Prize pool allocation failed for ${provider} donation ${donationId}:`,
            allocationError.message
        );
    }

    if (!matchedEntry) {
        console.log(
            `${provider} donation ${donationId}: no player linked ${usernameField} "${trimmedUsername}"`
        );
        await processedRef.set({
            provider,
            donorUsername: trimmedUsername,
            amount: parsedAmount,
            currency: donationCurrency,
            reason: unmatchedReason,
            processedAt: new Date().toISOString()
        });
        return { status: 'unmatched' };
    }

    const [userId] = matchedEntry;

    try {
        await recordDonorContribution(userId, parsedAmount, donationCurrency);
    } catch (statsError) {
        console.error(
            `Donor stats update failed for ${provider} donation ${donationId}:`,
            statsError.message
        );
    }

    await processedRef.set({
        provider,
        donorUsername: trimmedUsername,
        amount: parsedAmount,
        currency: donationCurrency,
        userId,
        processedAt: new Date().toISOString()
    });
    console.log(`Processed ${provider} donation ${donationId} by "${trimmedUsername}"`);
    return { status: 'matched', userId };
}

async function processDonation(donation, usersData) {
    return processMatchedDonation(
        {
            provider: 'donation_alerts',
            externalId: donation.id,
            donorUsername: donation.username,
            amount: donation.amount,
            currency: donation.currency || 'UAH',
            usernameField: 'daUsername',
            processedCollection: 'processedDonations',
            unmatchedReason: 'da_username_not_linked'
        },
        usersData
    );
}

function verifyBmcWebhookSignature(rawBody, secret, signature) {
    if (!secret || !signature || !rawBody) {
        return false;
    }

    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const expectedBuf = Buffer.from(expected, 'utf8');
    const signatureBuf = Buffer.from(String(signature), 'utf8');
    if (expectedBuf.length !== signatureBuf.length) {
        return false;
    }
    return crypto.timingSafeEqual(expectedBuf, signatureBuf);
}

// ---------------------------------------------------------------------------
// oauthCallback — one-time HTTP function to complete OAuth authorization.
//
// 1. In the DA OAuth app settings, set redirect URI to this function's URL.
// 2. Visit the auth URL (see README / deploy output) to authorize.
// 3. DA redirects here; tokens are stored in Firebase and polling begins.
// ---------------------------------------------------------------------------
exports.oauthCallback = functions.https.onRequest(async (req, res) => {
    const code = req.query.code;
    if (!code) return res.status(400).send('Missing code parameter');

    const clientSecret = functions.config().donationalerts.client_secret;

    const resp = await fetch('https://www.donationalerts.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: DA_CLIENT_ID,
            client_secret: clientSecret,
            redirect_uri: OAUTH_CALLBACK_URL,
            code
        }).toString()
    });
    const tokenResponse = await resp.json();

    if (!tokenResponse.access_token) {
        return res.status(500).send('Failed to get token: ' + JSON.stringify(tokenResponse));
    }

    await db.ref('daTokens').set({
        access_token: tokenResponse.access_token,
        refresh_token: tokenResponse.refresh_token,
        expires_at: Date.now() + tokenResponse.expires_in * 1000
    });

    res.send(
        '✅ Authorization successful! Tokens stored. You can close this tab — donations will now be checked every 5 minutes automatically.'
    );
});

// ---------------------------------------------------------------------------
// bmcWebhook — Buy Me a Coffee donation.created → match by bmcUsername.
// Register URL: https://us-central1-<PROJECT>.cloudfunctions.net/bmcWebhook
// Config: firebase functions:config:set bmc.webhook_secret="..."
// ---------------------------------------------------------------------------
exports.bmcWebhook = functions.https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    const webhookSecret = functions.config().bmc?.webhook_secret;
    if (!webhookSecret) {
        console.error('BMC webhook secret not configured (functions.config().bmc.webhook_secret)');
        return res.status(500).send('Webhook not configured');
    }

    const signature = req.get('x-signature-sha256') || req.headers['x-signature-sha256'];
    const rawBody = req.rawBody;
    if (!verifyBmcWebhookSignature(rawBody, webhookSecret, signature)) {
        console.error('BMC webhook signature verification failed');
        return res.status(401).send('Invalid signature');
    }

    const event = req.body || {};
    const eventType = event.type;
    if (eventType !== 'donation.created') {
        return res.status(200).send('ok');
    }

    const data = event.data || {};
    const externalId = event.event_id != null ? event.event_id : data.id;
    if (externalId == null) {
        console.error('BMC webhook missing event_id / data.id');
        return res.status(400).send('Missing event id');
    }

    const usersSnapshot = await db.ref('users').once('value');
    const usersData = usersSnapshot.val() || {};

    await processMatchedDonation(
        {
            provider: 'buy_me_a_coffee',
            externalId,
            donorUsername: data.supporter_name,
            amount: data.amount != null ? data.amount : data.total_amount_charged,
            currency: data.currency || 'USD',
            usernameField: 'bmcUsername',
            processedCollection: 'processedBmcDonations',
            unmatchedReason: 'bmc_username_not_linked'
        },
        usersData
    );

    return res.status(200).send('ok');
});

// ---------------------------------------------------------------------------
// pollDonations — scheduled every 5 minutes. Matches by daUsername.
// ---------------------------------------------------------------------------
exports.pollDonations = functions.pubsub.schedule('every 5 minutes').onRun(async () => {
    let accessToken;
    try {
        accessToken = await getValidAccessToken();
    } catch (e) {
        console.error('Cannot get access token:', e.message);
        return null;
    }

    const resp = await fetch('https://www.donationalerts.com/api/v1/alerts/donations?page=1', {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await resp.json();

    if (!data.data) {
        console.error('Unexpected DA API response:', JSON.stringify(data));
        return null;
    }

    const usersSnapshot = await db.ref('users').once('value');
    const usersData = usersSnapshot.val();
    if (!usersData) return null;

    for (const donation of data.data) {
        await processDonation(donation, usersData);
    }

    return null;
});

exports.debugDonations = functions.https.onRequest(async (req, res) => {
    let accessToken;
    try {
        accessToken = await getValidAccessToken();
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }

    const daResp = await fetch('https://www.donationalerts.com/api/v1/alerts/donations?page=1', {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await daResp.json();

    // Also show what nicknames are in the DB
    const usersSnapshot = await db.ref('users').once('value');
    const usersData = usersSnapshot.val() || {};
    const nicknames = Object.values(usersData)
        .map((u) => u.enteredNickname)
        .filter(Boolean);

    const processedSnap = await db.ref('processedDonations').once('value');
    const processed = Object.keys(processedSnap.val() || {});

    return res.json({
        latestDonations: (data.data || []).slice(0, 5).map((d) => ({
            id: d.id,
            amount: d.amount,
            currency: d.currency,
            message: d.message,
            username: d.username,
            alreadyProcessed: processed.includes(String(d.id))
        })),
        dbNicknames: nicknames
    });
});

// ---------------------------------------------------------------------------
// LiqPay helpers
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// createStripeCheckout — called by React frontend.
// Creates a Stripe Checkout Session and returns the session URL.
// ---------------------------------------------------------------------------
exports.createStripeCheckout = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(204).send('');

    const { amount, userId, nickname, origin, purpose, tournamentId, tournamentName, targetTournamentIds } =
        req.body;
    if (!userId || !nickname) {
        return res.status(400).json({ error: 'userId and nickname are required' });
    }

    const stripe = Stripe(functions.config().stripe.secret_key);
    const baseUrl = origin || 'https://kononiaka.github.io';

    if (purpose === 'tournament_host_seed') {
        if (!tournamentId) {
            return res.status(400).json({ error: 'tournamentId is required' });
        }

        const tournamentSnap = await db.ref(`tournaments/heroes3/${tournamentId}`).once('value');
        const tournament = tournamentSnap.val();
        if (!tournament) {
            return res.status(404).json({ error: 'Tournament not found' });
        }

        if (tournament.poolFunded) {
            return res.status(400).json({ error: 'Prize pool already funded' });
        }

        if (tournament.status !== 'Pending funding') {
            return res.status(400).json({ error: 'This tournament is not awaiting host funding' });
        }

        const goalUsd = Number(tournament.fundingGoalUsd) || 0;
        if (goalUsd < MIN_STRIPE_DONATION_USD) {
            return res.status(400).json({ error: `Minimum prize pool seed is $${MIN_STRIPE_DONATION_USD}` });
        }

        if (Math.abs(Number(amount) - goalUsd) > 0.001) {
            return res.status(400).json({ error: 'Amount must match the prize pool goal' });
        }

        if (tournament.createdByUid && tournament.createdByUid !== userId) {
            return res.status(403).json({ error: 'Only the tournament host can fund this pool' });
        }

        const cupName = tournament.name || tournamentName || 'Tournament';
        const poolPreview = Math.round(goalUsd * HOST_SEED_POOL_SHARE * 100) / 100;
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: `${cupName} — prize pool seed`,
                            description: `$${poolPreview} goes to the cup prize pool (95% of $${goalUsd})`
                        },
                        unit_amount: Math.round(goalUsd * 100)
                    },
                    quantity: 1
                }
            ],
            mode: 'payment',
            success_url: `${baseUrl}/tournaments/homm3/${tournamentId}?funding=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${baseUrl}/tournaments/homm3/${tournamentId}?funding=cancelled`,
            metadata: {
                userId,
                nickname,
                amount: String(goalUsd),
                purpose: 'tournament_host_seed',
                tournamentId
            }
        });

        return res.json({ url: session.url });
    }

    if (purpose === 'tournament_attendance') {
        if (!tournamentId) {
            return res.status(400).json({ error: 'tournamentId is required' });
        }

        const tournamentSnap = await db.ref(`tournaments/heroes3/${tournamentId}`).once('value');
        const tournament = tournamentSnap.val();
        if (!tournament) {
            return res.status(404).json({ error: 'Tournament not found' });
        }

        const feeUsd = Number(tournament.attendanceFeeUsd) || 0;
        if (feeUsd <= 0) {
            return res.status(400).json({ error: 'This tournament has no attendance fee' });
        }

        if (!isRegistrationOpenStatus(tournament.status)) {
            return res.status(400).json({ error: 'Registration is closed for this tournament' });
        }

        if (Math.abs(Number(amount) - feeUsd) > 0.001) {
            return res.status(400).json({ error: 'Invalid attendance amount' });
        }

        if (isPlayerRegisteredInTournament(tournament, nickname)) {
            return res.status(400).json({ error: 'You are already registered for this tournament' });
        }

        const paidSnap = await db.ref(`tournaments/heroes3/${tournamentId}/attendancePaid/${userId}`).once('value');
        if (paidSnap.exists()) {
            return res.status(400).json({ error: 'Attendance fee already paid' });
        }

        const cupName = tournament.name || tournamentName || 'Tournament';
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: `${cupName} — attendance fee`,
                            description: `$${feeUsd} added to this cup's prize pool`
                        },
                        unit_amount: Math.round(feeUsd * 100)
                    },
                    quantity: 1
                }
            ],
            mode: 'payment',
            success_url: `${baseUrl}/tournaments/homm3/${tournamentId}?attendance=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${baseUrl}/tournaments/homm3/${tournamentId}?attendance=cancelled`,
            metadata: {
                userId,
                nickname,
                amount: String(feeUsd),
                purpose: 'tournament_attendance',
                tournamentId
            }
        });

        return res.json({ url: session.url });
    }

    if (!amount) {
        return res.status(400).json({ error: 'amount, userId and nickname are required' });
    }

    const donationAmount = Number(amount);
    if (!Number.isFinite(donationAmount) || donationAmount < MIN_STRIPE_DONATION_USD) {
        return res.status(400).json({ error: `Minimum card donation is $${MIN_STRIPE_DONATION_USD}` });
    }

    const parsedTargets = parseTargetTournamentIds(targetTournamentIds);
    if (parsedTargets) {
        const tournamentsSnap = await db.ref('tournaments/heroes3').once('value');
        const tournaments = tournamentsSnap.val() || {};
        const validTargetIds = parsedTargets.filter((id) => isFundableTournament(tournaments[id]));
        if (validTargetIds.length === 0) {
            return res.status(400).json({ error: 'Select at least one eligible cup to support.' });
        }
    }

    const metadataTargets = parsedTargets ? parsedTargets.join(',') : '';

    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
            {
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: `VKGaming Donation — ${nickname}`,
                        description: parsedTargets
                            ? `90% split across ${parsedTargets.length} selected cup(s)`
                            : '90% funds live tournament prize pools'
                    },
                    unit_amount: Math.round(donationAmount * 100) // cents
                },
                quantity: 1
            }
        ],
        mode: 'payment',
        success_url: `${baseUrl}?donation=success`,
        cancel_url: `${baseUrl}?donation=cancelled`,
        metadata: {
            userId,
            nickname,
            amount: String(donationAmount),
            purpose: 'donation',
            targetTournamentIds: metadataTargets
        }
    });

    return res.json({ url: session.url });
});

// Fallback when Stripe webhook is delayed or missing — client calls after redirect.
exports.confirmTournamentHostSeed = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    const { sessionId, userId } = req.body || {};
    if (!sessionId || !userId) {
        return res.status(400).json({ error: 'sessionId and userId are required' });
    }

    const stripe = Stripe(functions.config().stripe.secret_key);

    try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.payment_status !== 'paid') {
            return res.status(400).json({ error: 'Payment not completed yet' });
        }

        if (session.metadata?.purpose !== 'tournament_host_seed') {
            return res.status(400).json({ error: 'Not a tournament host seed payment' });
        }

        if (session.metadata?.userId !== userId) {
            return res.status(403).json({ error: 'Payment belongs to another user' });
        }

        await processTournamentHostSeedPayment(session, session.metadata);

        const tournamentId = session.metadata.tournamentId;
        const tournamentSnap = await db.ref(`tournaments/heroes3/${tournamentId}`).once('value');

        return res.json({
            ok: true,
            tournamentId,
            status: tournamentSnap.val()?.status || null,
            poolFunded: tournamentSnap.val()?.poolFunded === true
        });
    } catch (error) {
        console.error(`confirmTournamentHostSeed failed for ${sessionId}:`, error.message);
        return res.status(500).json({ error: 'Could not confirm host seed payment' });
    }
});

exports.confirmTournamentAttendance = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    const { sessionId, userId } = req.body || {};
    if (!sessionId || !userId) {
        return res.status(400).json({ error: 'sessionId and userId are required' });
    }

    const stripe = Stripe(functions.config().stripe.secret_key);

    try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.payment_status !== 'paid') {
            return res.status(400).json({ error: 'Payment not completed yet' });
        }

        if (session.metadata?.purpose !== 'tournament_attendance') {
            return res.status(400).json({ error: 'Not a tournament attendance payment' });
        }

        if (session.metadata?.userId !== userId) {
            return res.status(403).json({ error: 'Payment belongs to another user' });
        }

        await processTournamentAttendancePayment(session, session.metadata);

        return res.json({
            ok: true,
            tournamentId: session.metadata.tournamentId,
            paid: true
        });
    } catch (error) {
        console.error(`confirmTournamentAttendance failed for ${sessionId}:`, error.message);
        return res.status(500).json({ error: 'Could not confirm attendance payment' });
    }
});

// ---------------------------------------------------------------------------
// stripeWebhook — Stripe POSTs here after payment completes.
// Verifies signature, then allocates to prize pools and records donor stats.
// ---------------------------------------------------------------------------
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = functions.config().stripe.webhook_secret;
    const stripe = Stripe(functions.config().stripe.secret_key);

    let event;
    try {
        // Firebase provides req.rawBody for signature verification
        event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    } catch (err) {
        console.error('Stripe webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type !== 'checkout.session.completed') {
        return res.status(200).send('ok');
    }

    const session = event.data.object;
    const { userId, nickname, amount, purpose, tournamentId } = session.metadata;

    if (purpose === 'tournament_host_seed') {
        try {
            await processTournamentHostSeedPayment(session, {
                userId,
                nickname,
                amount,
                tournamentId
            });
        } catch (hostSeedError) {
            console.error(`Host seed payment failed for Stripe session ${session.id}:`, hostSeedError.message);
            return res.status(500).send('host seed processing failed');
        }
        return res.status(200).send('ok');
    }

    if (purpose === 'tournament_attendance') {
        try {
            await processTournamentAttendancePayment(session, {
                userId,
                nickname,
                amount,
                tournamentId
            });
        } catch (attendanceError) {
            console.error(`Attendance payment failed for Stripe session ${session.id}:`, attendanceError.message);
            return res.status(500).send('attendance processing failed');
        }
        return res.status(200).send('ok');
    }

    if (!nickname) {
        console.error('No nickname in Stripe session metadata');
        return res.status(400).send('No nickname');
    }

    // Idempotency — skip if already processed
    const processedRef = db.ref(`processedStripe/${session.id}`);
    if ((await processedRef.once('value')).exists()) {
        return res.status(200).send('already processed');
    }

    // Look up user by nickname (DB uses push keys, not Auth UIDs)
    const usersSnap = await db.ref('users').once('value');
    const usersData = usersSnap.val();
    if (!usersData) {
        console.error('No users data in DB');
        return res.status(500).send('No users data');
    }
    const matchedEntry = Object.entries(usersData).find(
        ([, user]) => user.enteredNickname && user.enteredNickname === nickname
    );
    if (!matchedEntry) {
        console.error(`No user found with nickname "${nickname}"`);
        await processedRef.set({
            userId,
            nickname,
            amount: parseFloat(amount || 0),
            reason: 'nickname_not_found',
            processedAt: new Date().toISOString()
        });
        return res.status(200).send('ok');
    }
    const [dbUserId] = matchedEntry;

    const donationAmount = parseFloat(amount || 0);
    const currency = (session.currency || 'usd').toUpperCase();

    if (donationAmount <= 0) {
        await processedRef.set({
            userId: dbUserId,
            amount: donationAmount,
            reason: 'amount_too_small',
            processedAt: new Date().toISOString()
        });
        return res.status(200).send('ok');
    }

    try {
        const stripeTargets = parseTargetTournamentIds(session.metadata?.targetTournamentIds);
        let targetTournamentIds = stripeTargets;
        if (targetTournamentIds === null) {
            const userSnap = await db.ref(`users/${dbUserId}/donationTargetTournamentIds`).once('value');
            if (userSnap.exists() && Array.isArray(userSnap.val())) {
                targetTournamentIds = userSnap.val();
            }
        }

        await allocateDonationToLivePrizePools(donationAmount, currency, targetTournamentIds);
    } catch (allocationError) {
        console.error(`Prize pool allocation failed for Stripe session ${session.id}:`, allocationError.message);
    }

    try {
        await recordDonorContribution(dbUserId, donationAmount, currency);
    } catch (statsError) {
        console.error(`Donor stats update failed for Stripe session ${session.id}:`, statsError.message);
    }

    await processedRef.set({
        userId: dbUserId,
        nickname,
        amount: donationAmount,
        currency,
        processedAt: new Date().toISOString()
    });

    console.log(`Stripe: processed donation from ${nickname} for session ${session.id}`);
    return res.status(200).send('ok');
});

// ---------------------------------------------------------------------------
// Country detection from login IP (ISO 3166-1 alpha-2 only; IP is not stored)
// ---------------------------------------------------------------------------

function getRequestIp(context) {
    const req = context?.rawRequest;
    if (!req) {
        return null;
    }

    const forwarded = req.headers?.['x-forwarded-for'];
    if (forwarded) {
        return String(forwarded).split(',')[0].trim();
    }

    return req.socket?.remoteAddress || req.connection?.remoteAddress || null;
}

function isPrivateIp(ip) {
    if (!ip) {
        return true;
    }

    if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') {
        return true;
    }

    if (ip.startsWith('10.') || ip.startsWith('192.168.')) {
        return true;
    }

    const match = /^172\.(\d+)\./.exec(ip);
    if (match) {
        const secondOctet = Number(match[1]);
        if (secondOctet >= 16 && secondOctet <= 31) {
            return true;
        }
    }

    return false;
}

async function resolveCountryFromIp(ip) {
    if (isPrivateIp(ip)) {
        return null;
    }

    try {
        const response = await fetch(
            `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,countryCode`,
            { signal: AbortSignal.timeout(4000) }
        );
        const data = await response.json();

        if (data.status === 'success' && data.countryCode) {
            return String(data.countryCode).toUpperCase();
        }
    } catch (error) {
        console.warn('Country lookup failed:', error.message);
    }

    return null;
}

async function applyCountryFromLogin(dbUserId, existingUser, context) {
    if (existingUser?.countryCodeSource === 'manual') {
        return;
    }

    const detected = await resolveCountryFromIp(getRequestIp(context));
    if (!detected) {
        return;
    }

    await db.ref(`users/${dbUserId}`).update({
        countryCode: detected,
        countryCodeSource: 'ip',
        countryCodeUpdatedAt: new Date().toISOString()
    });
}

// ---------------------------------------------------------------------------
// twitchAuth — exchanges a Twitch OAuth authorization code for a Firebase
// custom token. Called from the React frontend after Twitch redirects back.
// ---------------------------------------------------------------------------
// hotameta.com proxies (no CORS on their API)
// ---------------------------------------------------------------------------
const https = require('https');

function fetchHotametaJson(path) {
    const url = `https://hotameta.com/api/${path}`;
    return new Promise((resolve, reject) => {
        https
            .get(url, (res) => {
                let body = '';
                res.on('data', (chunk) => {
                    body += chunk;
                });
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(body));
                    } catch (e) {
                        reject(
                            new functions.https.HttpsError('internal', 'Failed to parse hotameta response')
                        );
                    }
                });
            })
            .on('error', (err) => {
                reject(new functions.https.HttpsError('internal', err.message));
            });
    });
}

exports.hotaSearch = functions.https.onCall(async (data) => {
    const { query } = data;
    if (!query || typeof query !== 'string' || query.trim().length < 2) {
        throw new functions.https.HttpsError('invalid-argument', 'query must be at least 2 characters');
    }
    const results = await fetchHotametaJson(`search?q=${encodeURIComponent(query.trim())}`);
    return { results };
});

exports.hotaSummary = functions.https.onCall(async () => {
    const summary = await fetchHotametaJson('summary');
    return { summary };
});

exports.hotaFactions = functions.https.onCall(async () => {
    const factions = await Promise.all(
        Array.from({ length: 12 }, (_, id) => fetchHotametaJson(`faction/${id}`))
    );
    return { factions };
});

exports.hotaPlayer = functions.https.onCall(async (data) => {
    const playerId = Number(data?.playerId);
    if (!Number.isInteger(playerId) || playerId <= 0) {
        throw new functions.https.HttpsError('invalid-argument', 'playerId must be a positive integer');
    }
    const player = await fetchHotametaJson(`player/${playerId}`);
    return { player };
});

exports.hotaPlayerMatches = functions.https.onCall(async (data) => {
    const playerId = Number(data?.playerId);
    if (!Number.isInteger(playerId) || playerId <= 0) {
        throw new functions.https.HttpsError('invalid-argument', 'playerId must be a positive integer');
    }

    const limit = Math.min(Math.max(Number(data?.limit) || 50, 1), 100);
    let path = `player/${playerId}/matches?limit=${limit}`;

    if (data?.heroId != null && Number.isInteger(Number(data.heroId))) {
        path += `&hero_id=${Number(data.heroId)}`;
    }

    const matches = await fetchHotametaJson(path);
    return { matches: Array.isArray(matches) ? matches : [] };
});

exports.hotaLeaderboard = functions.https.onCall(async (data) => {
    const limit = Math.min(Math.max(Number(data?.limit) || 100, 1), 500);
    const leaderboard = await fetchHotametaJson(`leaderboard?limit=${limit}`);
    return { leaderboard: Array.isArray(leaderboard) ? leaderboard : [] };
});

const { GoogleAuth } = require('google-auth-library');

const FIREBASE_PROJECT_ID = process.env.GCLOUD_PROJECT || 'test-prod-app-81915';

async function getGoogleAccessToken(scopes) {
    const auth = new GoogleAuth({ scopes });
    const client = await auth.getClient();
    const accessTokenResponse = await client.getAccessToken();
    const token = accessTokenResponse.token;

    if (!token) {
        throw new Error('Failed to obtain Google access token');
    }

    return token;
}

function getUidFromIdToken(idToken) {
    if (!idToken) {
        return null;
    }

    try {
        const payload = idToken.split('.')[1];
        const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
        const decoded = JSON.parse(Buffer.from(normalized, 'base64').toString('utf8'));
        return decoded.user_id || decoded.sub || null;
    } catch {
        return null;
    }
}

async function exchangeCustomTokenForSession(customToken) {
    const accessToken = await getGoogleAccessToken(['https://www.googleapis.com/auth/identitytoolkit']);
    const response = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            'X-Goog-User-Project': FIREBASE_PROJECT_ID
        },
        body: JSON.stringify({ token: customToken, returnSecureToken: true })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = payload?.error?.message || `Firebase sign-in failed (${response.status})`;
        throw new Error(message);
    }

    return {
        idToken: payload.idToken,
        refreshToken: payload.refreshToken,
        localId: payload.localId || getUidFromIdToken(payload.idToken)
    };
}

async function refreshFirebaseSession(refreshToken) {
    const accessToken = await getGoogleAccessToken(['https://www.googleapis.com/auth/securetoken']);

    const response = await fetch('https://securetoken.googleapis.com/v1/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Bearer ${accessToken}`,
            'X-Goog-User-Project': FIREBASE_PROJECT_ID
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken
        })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = payload?.error?.message || 'Token refresh failed';
        throw new Error(message);
    }

    return {
        idToken: payload.id_token,
        refreshToken: payload.refresh_token || refreshToken
    };
}

exports.refreshAuthToken = functions.https.onCall(async (data) => {
    const refreshToken = String(data?.refreshToken || '').trim();
    if (!refreshToken) {
        throw new functions.https.HttpsError('invalid-argument', 'refreshToken is required');
    }

    try {
        return await refreshFirebaseSession(refreshToken);
    } catch (error) {
        console.error('refreshAuthToken failed:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Token refresh failed');
    }
});

//
// Required Firebase config:
//   firebase functions:config:set twitch.client_id="..." twitch.client_secret="..."
//
// Request body: { "data": { "code": "...", "redirectUri": "..." } }
// Response:     { "result": { "idToken", "refreshToken", "localId", "displayName", "profileImageUrl", "dbUserId" } }
// ---------------------------------------------------------------------------
exports.twitchAuth = functions.https.onCall(async (data, context) => {
    try {
        const { code, redirectUri } = data;

        if (!code || !redirectUri) {
            throw new functions.https.HttpsError('invalid-argument', 'code and redirectUri are required');
        }

        const twitchConfig = functions.config().twitch || {};
        const clientId = twitchConfig.client_id;
        const clientSecret = twitchConfig.client_secret;

        if (!clientId || !clientSecret) {
            console.error(
                'Twitch OAuth config is missing. Set functions config twitch.client_id and twitch.client_secret.'
            );
            throw new functions.https.HttpsError(
                'failed-precondition',
                'Twitch OAuth is not configured on the server.'
            );
        }

        // 1. Exchange authorization code for Twitch access token
        const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                code,
                grant_type: 'authorization_code',
                redirect_uri: redirectUri
            }).toString()
        });
        const tokenData = await tokenRes.json();

        if (!tokenData.access_token) {
            console.error('Twitch token exchange failed:', JSON.stringify(tokenData));
            throw new functions.https.HttpsError('unauthenticated', 'Failed to exchange Twitch code for token');
        }

        // 2. Fetch Twitch user profile
        const userRes = await fetch('https://api.twitch.tv/helix/users', {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
                'Client-Id': clientId
            }
        });
        const userData = await userRes.json();

        if (!userData.data || userData.data.length === 0) {
            throw new functions.https.HttpsError('unauthenticated', 'Failed to retrieve Twitch user info');
        }

        const twitchUser = userData.data[0];
        const twitchId = twitchUser.id;
        const displayName = twitchUser.display_name;
        const profileImageUrl = twitchUser.profile_image_url || '';
        const email = twitchUser.email || '';

        // 3. Find or create user record in Firebase Realtime DB
        const usersSnap = await db.ref('users').once('value');
        const usersData = usersSnap.val() || {};

        let dbUserId = null;
        for (const [id, user] of Object.entries(usersData)) {
            if (user.twitchId === twitchId) {
                dbUserId = id;
                break;
            }
        }
        const existingUser = dbUserId ? usersData[dbUserId] || null : null;

        const twitchProfileUrl = `https://twitch.tv/${twitchUser.login}`;

        if (!dbUserId) {
            // New user — check that display name is not already taken by email/password account
            const nameTaken = Object.values(usersData).some(
                (u) => u.enteredNickname && u.enteredNickname.toLowerCase() === displayName.toLowerCase()
            );
            const nickname = nameTaken ? `${displayName}_twitch` : displayName;

            const now = new Date();
            const detectedCountry = await resolveCountryFromIp(getRequestIp(context));
            const newUserRef = db.ref('users').push();
            dbUserId = newUserRef.key;
            const newUser = {
                enteredNickname: nickname,
                enteredEmail: email,
                twitchId,
                twitchDisplayName: displayName,
                twitch: twitchProfileUrl,
                profileImageUrl,
                authProvider: 'twitch',
                gamesPlayed: { heroes3: { loses: 0, wins: 0 } },
                prizes: [],
                ratings: 0,
                stars: 0.5,
                avatar: profileImageUrl || null,
                totalPrize: 0,
                totalDonatedUsd: 0,
                donationCount: 0,
                registeredAt: now.toISOString()
            };

            if (detectedCountry) {
                newUser.countryCode = detectedCountry;
                newUser.countryCodeSource = 'ip';
                newUser.countryCodeUpdatedAt = now.toISOString();
            }

            await newUserRef.set(newUser);
        } else {
            // Existing user — refresh their Twitch profile info
            const updates = {
                twitchDisplayName: displayName,
                twitch: twitchProfileUrl,
                profileImageUrl,
                lastTwitchLogin: new Date().toISOString()
            };
            if ((!existingUser || !existingUser.avatar) && profileImageUrl) {
                updates.avatar = profileImageUrl;
            }
            await db.ref(`users/${dbUserId}`).update(updates);
            await applyCountryFromLogin(dbUserId, existingUser, context);
        }

        // Fetch the stored nickname (may differ from displayName for existing users)
        const storedNicknameSnap = await db.ref(`users/${dbUserId}/enteredNickname`).once('value');
        const storedNickname = storedNicknameSnap.val() || displayName;

        // 4. Create Firebase custom token — UID is "twitch:<twitchId>"
        const firebaseUid = `twitch:${twitchId}`;
        const customToken = await admin.auth().createCustomToken(firebaseUid, {
            twitchId,
            displayName,
            dbUserId
        });

        const session = await exchangeCustomTokenForSession(customToken);

        return {
            idToken: session.idToken,
            refreshToken: session.refreshToken,
            localId: session.localId,
            displayName: storedNickname,
            profileImageUrl,
            dbUserId
        };
    } catch (err) {
        console.error('twitchAuth failed:', err);
        if (err instanceof functions.https.HttpsError) {
            throw err;
        }
        throw new functions.https.HttpsError('internal', err.message || 'Twitch auth failed');
    }
});

async function getTwitchAppAccessToken() {
    const twitchConfig = functions.config().twitch || {};
    const clientId = twitchConfig.client_id;
    const clientSecret = twitchConfig.client_secret;

    if (!clientId || !clientSecret) {
        return null;
    }

    const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'client_credentials'
        }).toString()
    });
    const tokenData = await tokenRes.json();
    return tokenData.access_token || null;
}

// ---------------------------------------------------------------------------
// twitchStreamStatus — returns Twitch logins that are currently live
// Request body: { "data": { "logins": ["player1", "player2"] } }
// Response:     { "result": { "liveLogins": ["player1"] } }
// ---------------------------------------------------------------------------
exports.twitchStreamStatus = functions.https.onCall(async (data) => {
    const logins = Array.isArray(data?.logins)
        ? [...new Set(data.logins.map((login) => String(login || '').trim().toLowerCase()).filter(Boolean))]
        : [];

    if (logins.length === 0) {
        return { liveLogins: [] };
    }

    const clientId = functions.config().twitch?.client_id;
    const accessToken = await getTwitchAppAccessToken();

    if (!clientId || !accessToken) {
        return { liveLogins: [] };
    }

    const liveLogins = [];

    for (let index = 0; index < logins.length; index += 100) {
        const chunk = logins.slice(index, index + 100);
        const params = new URLSearchParams();
        chunk.forEach((login) => params.append('user_login', login));

        const streamRes = await fetch(`https://api.twitch.tv/helix/streams?${params.toString()}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Client-Id': clientId
            }
        });
        const streamData = await streamRes.json();

        (streamData.data || []).forEach((stream) => {
            if (stream.user_login) {
                liveLogins.push(String(stream.user_login).toLowerCase());
            }
        });
    }

    return { liveLogins };
});

// ---------------------------------------------------------------------------
// deleteAccount — removes Firebase Auth user + RTDB profile (own account only)
// Callable with Authorization: Bearer <idToken>
// Request body: { "data": { "confirmNickname": "exact lobby nick" } }
// ---------------------------------------------------------------------------
async function resolveDbUserId(decodedToken) {
    if (decodedToken.dbUserId) {
        return decodedToken.dbUserId;
    }

    const usersSnap = await db.ref('users').once('value');
    const usersData = usersSnap.val() || {};
    const uid = decodedToken.uid;

    if (uid.startsWith('twitch:')) {
        const twitchId = uid.slice('twitch:'.length);
        for (const [id, user] of Object.entries(usersData)) {
            if (user?.twitchId === twitchId) {
                return id;
            }
        }
    }

    const email = decodedToken.email;
    if (email) {
        const normalised = email.toLowerCase();
        for (const [id, user] of Object.entries(usersData)) {
            if (user?.enteredEmail && user.enteredEmail.toLowerCase() === normalised) {
                return id;
            }
        }
    }

    return null;
}

async function removeUserFromOpenTournaments(nickname) {
    const snap = await db.ref('tournaments/heroes3').once('value');
    const tournaments = snap.val() || {};
    const updates = {};

    for (const [tourId, tour] of Object.entries(tournaments)) {
        const status = tour?.status;
        if (status === 'finished') {
            continue;
        }
        const players = tour?.players || {};
        for (const [playerKey, player] of Object.entries(players)) {
            if (player?.name === nickname) {
                updates[`tournaments/heroes3/${tourId}/players/${playerKey}`] = null;
            }
        }
    }

    if (Object.keys(updates).length > 0) {
        await db.ref().update(updates);
    }
}

exports.deleteAccount = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in.');
    }

    const confirmNickname = (data?.confirmNickname || '').trim();
    if (!confirmNickname) {
        throw new functions.https.HttpsError('invalid-argument', 'confirmNickname is required.');
    }

    const uid = context.auth.uid;
    const decodedToken = context.auth.token;
    const dbUserId = await resolveDbUserId(decodedToken);

    if (!dbUserId) {
        throw new functions.https.HttpsError('not-found', 'User profile not found.');
    }

    const userSnap = await db.ref(`users/${dbUserId}`).once('value');
    const userData = userSnap.val();

    if (!userData) {
        throw new functions.https.HttpsError('not-found', 'User profile not found.');
    }

    if (userData.enteredNickname !== confirmNickname) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'Nickname confirmation does not match your account.'
        );
    }

    try {
        await removeUserFromOpenTournaments(userData.enteredNickname);
        await db.ref(`users/${dbUserId}`).remove();
        await db.ref(`meta/admins/${uid}`).remove();
        await admin.auth().deleteUser(uid);
        return { deleted: true };
    } catch (err) {
        console.error('deleteAccount failed:', err);
        throw new functions.https.HttpsError('internal', err.message || 'Account deletion failed.');
    }
});

exports.reportBug = functions.https.onCall(async (data, context) => {
    const summary = String(data?.summary || '').trim();
    const description = String(data?.description || '').trim();
    const steps = String(data?.steps || '').trim();
    const pageUrl = String(data?.pageUrl || '').trim();
    const userAgent = String(data?.userAgent || '').trim();
    const screenSize = String(data?.screenSize || '').trim();
    const reporterNickname = String(data?.reporterNickname || '').trim();
    const reporterUid = String(data?.reporterUid || '').trim();
    const severity = String(data?.severity || 'normal').trim();

    const allowedSeverity = new Set(['low', 'normal', 'high']);
    if (!allowedSeverity.has(severity)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid severity value');
    }

    if (summary.length < 5 || summary.length > 160) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'Summary must be between 5 and 160 characters'
        );
    }

    if (description.length < 10 || description.length > 4000) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'Description must be between 10 and 4000 characters'
        );
    }

    if (steps.length > 2000) {
        throw new functions.https.HttpsError('invalid-argument', 'Steps to reproduce are too long');
    }

    if (pageUrl.length > 500) {
        throw new functions.https.HttpsError('invalid-argument', 'Page URL is too long');
    }

    const reportRef = db.ref('bugReports').push();
    const report = {
        summary,
        description,
        steps: steps || null,
        pageUrl: pageUrl || null,
        userAgent: userAgent || null,
        screenSize: screenSize || null,
        reporterNickname: reporterNickname || 'Anonymous',
        reporterUid: reporterUid || null,
        severity,
        status: 'open',
        source: 'web',
        createdAt: new Date().toISOString()
    };

    await reportRef.set(report);

    try {
        const { sendTelegramMessage, escapeHtml, getTelegramConfig } = require('./telegram');
        const siteUrl = getTelegramConfig().siteUrl;
        const adminLink = `${siteUrl}/#/report-bug`;
        const lines = [
            '🐛 <b>Bug report</b>',
            `<b>${escapeHtml(summary)}</b>`,
            escapeHtml(description.slice(0, 600)),
            pageUrl ? `Page: ${escapeHtml(pageUrl)}` : null,
            `Reporter: ${escapeHtml(reporterNickname || 'Anonymous')}`,
            `Severity: ${escapeHtml(severity)}`,
            `ID: ${reportRef.key}`,
            adminLink ? `Form: ${escapeHtml(adminLink)}` : null
        ].filter(Boolean);

        await sendTelegramMessage(lines.join('\n'), { parseMode: 'HTML' });
    } catch (notifyError) {
        console.error('reportBug telegram notification failed:', notifyError);
    }

    return { reportId: reportRef.key };
});

// Telegram channel notifications (@vkgamingplay) — see telegramNotifications.js
Object.assign(exports, require('./telegramNotifications'));
Object.assign(exports, require('./telegramBot'));
