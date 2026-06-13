/**
 * Seeds fundingGoalUsd / communityFundingUsd on live public tournaments.
 *
 * Usage:
 *   node scripts/seed-prize-pool-funding.js
 *   node scripts/seed-prize-pool-funding.js --goal 70000 --collected 250
 *
 * Requires FIREBASE_DATABASE_URL (defaults to project RTDB).
 * Writes need an admin token or open rules — run from an authenticated admin session
 * or use Firebase console if PATCH fails.
 */

const DEFAULT_DATABASE_URL = 'https://test-prod-app-81915-default-rtdb.firebaseio.com';

const databaseUrl = (process.env.FIREBASE_DATABASE_URL || DEFAULT_DATABASE_URL).replace(/\/$/, '');

const parseArgs = () => {
    const args = process.argv.slice(2);
    const get = (flag, fallback) => {
        const index = args.indexOf(flag);
        if (index === -1 || index === args.length - 1) {
            return fallback;
        }
        return args[index + 1];
    };

    return {
        goalUsd: Number(get('--goal', '70000')),
        collectedUsd: Number(get('--collected', '250'))
    };
};

const FUNDABLE_TOURNAMENT_STATUSES = new Set(['Registration', 'Registration Started', 'Started!']);

const isLiveFundable = (tournament) =>
    Boolean(
        tournament && tournament.isPublic !== false && FUNDABLE_TOURNAMENT_STATUSES.has(tournament.status)
    );

async function main() {
    const { goalUsd, collectedUsd } = parseArgs();

    if (!Number.isFinite(goalUsd) || goalUsd <= 0) {
        throw new Error('Invalid --goal value');
    }
    if (!Number.isFinite(collectedUsd) || collectedUsd < 0) {
        throw new Error('Invalid --collected value');
    }

    const response = await fetch(`${databaseUrl}/tournaments/heroes3.json`);
    if (!response.ok) {
        throw new Error(`Failed to load tournaments: ${response.status}`);
    }

    const tournaments = await response.json();
    if (!tournaments) {
        console.log('No tournaments found.');
        return;
    }

    const live = Object.entries(tournaments).filter(([, tournament]) => isLiveFundable(tournament));
    if (live.length === 0) {
        console.log('No open public cups (registration or in progress). Nothing to seed.');
        return;
    }

    for (const [id, tournament] of live) {
        const updates = {
            fundingGoalUsd: goalUsd,
            communityFundingUsd: collectedUsd
        };

        const patch = await fetch(`${databaseUrl}/tournaments/heroes3/${id}.json`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });

        if (!patch.ok) {
            const body = await patch.text();
            throw new Error(`Failed to update ${id} (${tournament.name}): ${patch.status} ${body}`);
        }

        console.log(
            `Updated ${tournament.name} (${id}): fundingGoalUsd=${goalUsd}, communityFundingUsd=${collectedUsd}`
        );
    }
}

main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
});
