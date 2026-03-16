const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');
const Stripe = require('stripe');

admin.initializeApp();
const db = admin.database();
const DA_CLIENT_ID = '17904';
const OAUTH_CALLBACK_URL = 'https://us-central1-test-prod-app-81915.cloudfunctions.net/oauthCallback';
// ---------------------------------------------------------------------------
// Coin tiers — must mirror the UI in modalDonate.js
// ---------------------------------------------------------------------------
const DONATION_TIERS = [
    { minAmount: 10, coins: 25, label: 'Legend' },
    { minAmount: 5, coins: 10, label: 'Champion' },
    { minAmount: 3, coins: 5, label: 'Contributor' },
    { minAmount: 1, coins: 2, label: 'Supporter' }
];

function coinsForAmount(amount) {
    for (const tier of DONATION_TIERS) {
        if (amount >= tier.minAmount) {
            return { coins: tier.coins, label: tier.label };
        }
    }
    const coins = Math.floor(amount / 0.5);
    return { coins, label: 'Custom' };
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

async function processDonation(donation, usersData) {
    const donationId = String(donation.id);
    const processedRef = db.ref(`processedDonations/${donationId}`);
    if ((await processedRef.once('value')).exists()) return;

    const amount = parseFloat(donation.amount || 0);
    const donorUsername = (donation.username || '').trim();
    const currency = donation.currency || 'UAH';

    if (amount <= 0) {
        await processedRef.set({
            donorUsername,
            amount,
            awardedCoins: 0,
            reason: 'invalid_amount',
            processedAt: new Date().toISOString()
        });
        return;
    }

    const normalisedUsername = donorUsername.toLowerCase();
    const matchedEntry = Object.entries(usersData).find(
        ([, user]) => user.daUsername && user.daUsername.toLowerCase() === normalisedUsername
    );

    if (!matchedEntry) {
        console.log(`Donation ${donationId}: no player linked DA username "${donorUsername}"`);
        await processedRef.set({
            donorUsername,
            amount,
            awardedCoins: 0,
            reason: 'da_username_not_linked',
            processedAt: new Date().toISOString()
        });
        return;
    }

    const [userId] = matchedEntry;
    const { coins, label } = coinsForAmount(amount);

    if (coins <= 0) {
        await processedRef.set({
            donorUsername,
            amount,
            userId,
            awardedCoins: 0,
            reason: 'amount_too_small',
            processedAt: new Date().toISOString()
        });
        return;
    }

    // Read current balance so we can store previousBalance/newBalance in the transaction
    const userSnap = await db.ref(`users/${userId}/coins`).once('value');
    const currentCoins = userSnap.val() || 0;
    const newBalance = currentCoins + coins;

    const now = new Date();
    const transactionKey = db.ref(`users/${userId}/coinTransactions`).push().key;
    const updates = {};
    updates[`users/${userId}/coinTransactions/${transactionKey}`] = {
        userId,
        amount: coins,
        type: 'donation_reward',
        description: `Donation reward: ${label} tier (${amount} ${currency})`,
        timestamp: now.toISOString(),
        date: now.toLocaleDateString(),
        time: now.toLocaleTimeString(),
        metadata: {
            donationId,
            donorUsername,
            donationAmount: amount,
            currency,
            tier: label,
            rewardCoins: coins,
            previousBalance: currentCoins,
            newBalance
        }
    };
    updates[`users/${userId}/coins`] = newBalance;
    await db.ref().update(updates);

    await processedRef.set({
        donorUsername,
        amount,
        currency,
        userId,
        awardedCoins: coins,
        tier: label,
        processedAt: new Date().toISOString()
    });
    console.log(`Awarded ${coins} coins to user ${userId} for donation ${donationId} by DA user "${donorUsername}"`);
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
// pollDonations — scheduled every 5 minutes. Matches by daUsername.
// Fetches the latest donations from DA API and awards coins for matched nicknames.
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

    const { amount, userId, nickname, origin } = req.body;
    if (!amount || !userId || !nickname) {
        return res.status(400).json({ error: 'amount, userId and nickname are required' });
    }

    const stripe = Stripe(functions.config().stripe.secret_key);

    const baseUrl = origin || 'https://vkgaming.com.ua';

    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
            {
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: `VKGaming Donation — ${nickname}`,
                        description: `Earns coins for your in-game account`
                    },
                    unit_amount: Math.round(Number(amount) * 100) // cents
                },
                quantity: 1
            }
        ],
        mode: 'payment',
        success_url: `${baseUrl}?donation=success`,
        cancel_url: `${baseUrl}?donation=cancelled`,
        metadata: { userId, nickname, amount: String(amount) }
    });

    return res.json({ url: session.url });
});

// ---------------------------------------------------------------------------
// stripeWebhook — Stripe POSTs here after payment completes.
// Verifies signature, then awards coins to the player.
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
    const { userId, nickname, amount } = session.metadata;

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
            awardedCoins: 0,
            reason: 'nickname_not_found',
            processedAt: new Date().toISOString()
        });
        return res.status(200).send('ok');
    }
    const [dbUserId] = matchedEntry;

    const donationAmount = parseFloat(amount || 0);
    const currency = (session.currency || 'usd').toUpperCase();
    const { coins, label } = coinsForAmount(donationAmount);

    if (coins <= 0) {
        await processedRef.set({
            userId: dbUserId,
            amount: donationAmount,
            awardedCoins: 0,
            reason: 'amount_too_small',
            processedAt: new Date().toISOString()
        });
        return res.status(200).send('ok');
    }

    const userSnap = await db.ref(`users/${dbUserId}/coins`).once('value');
    const currentCoins = userSnap.val() || 0;
    const newBalance = currentCoins + coins;

    const now = new Date();
    const transactionKey = db.ref(`users/${dbUserId}/coinTransactions`).push().key;
    const updates = {};
    updates[`users/${dbUserId}/coinTransactions/${transactionKey}`] = {
        userId: dbUserId,
        amount: coins,
        type: 'donation_reward',
        description: `Stripe donation: ${label} tier (${donationAmount} ${currency})`,
        timestamp: now.toISOString(),
        date: now.toLocaleDateString(),
        time: now.toLocaleTimeString(),
        metadata: {
            sessionId: session.id,
            donorNickname: nickname,
            donationAmount,
            currency,
            tier: label,
            rewardCoins: coins,
            previousBalance: currentCoins,
            newBalance,
            provider: 'stripe'
        }
    };
    updates[`users/${dbUserId}/coins`] = newBalance;
    await db.ref().update(updates);

    await processedRef.set({
        userId: dbUserId,
        nickname,
        amount: donationAmount,
        currency,
        awardedCoins: coins,
        tier: label,
        processedAt: now.toISOString()
    });

    console.log(`Stripe: awarded ${coins} coins to user ${dbUserId} (${nickname}) for session ${session.id}`);
    return res.status(200).send('ok');
});
