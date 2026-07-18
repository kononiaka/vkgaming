import {
    buildDonatablePrizePoolEntries,
    buildPrizePoolEntry,
    buildPrizePoolEntries,
    filterDonationTargetIds,
    getFundingProgress,
    getTournamentCollectedUsd,
    getTournamentFundingGoalUsd,
    hasSecuredPoolFunding,
    HOST_SEED_POOL_SHARE,
    isLiveFundableTournament,
    normalizeDonationToUsd,
    PUBLIC_DONATION_POOL_SHARE,
    PRIZE_POOL_DONATION_SHARE,
    resolveDonationTargetIds,
    splitHostSeedPayment,
    splitPublicDonation
} from '../utils/prizePoolData';

describe('prizePoolData', () => {
    test('detects live fundable tournaments with secured pool funding', () => {
        expect(
            isLiveFundableTournament({
                status: 'Started!',

                isPublic: true,

                poolFunded: true
            })
        ).toBe(true);

        expect(
            isLiveFundableTournament({
                status: 'Registration Started',

                isPublic: true,

                communityFundingUsd: 50
            })
        ).toBe(true);

        expect(
            isLiveFundableTournament({
                status: 'Registration Started',

                isPublic: true,

                communityFundingUsd: 0
            })
        ).toBe(false);

        expect(
            isLiveFundableTournament({
                status: 'Tournament Finished',

                isPublic: true,

                poolFunded: true
            })
        ).toBe(false);
    });

    test('hasSecuredPoolFunding accepts poolFunded flag or collected balance', () => {
        expect(hasSecuredPoolFunding({ poolFunded: true })).toBe(true);

        expect(hasSecuredPoolFunding({ communityFundingUsd: 10 })).toBe(true);

        expect(hasSecuredPoolFunding({ communityFundingUsd: 0 })).toBe(false);
    });

    test('normalizes UAH donations to USD', () => {
        expect(normalizeDonationToUsd(410, 'UAH')).toBeCloseTo(10, 2);
    });

    test('builds prize pool entries for all open and live public cups', () => {
        const entries = buildPrizePoolEntries({
            cup1: {
                name: 'Top League',

                status: 'Started!',

                isPublic: true,

                totalPrizeUsd: 1000,

                communityFundingUsd: 250
            },

            cup2: {
                name: 'League A',

                status: 'Started!',

                isPublic: true,

                fundingGoalUsd: 500,

                poolFunded: true
            },

            cup3: {
                name: 'Unfunded Cup',

                status: 'Registration Started',

                isPublic: true,

                totalPrizeUsd: 300
            }
        });

        expect(entries).toHaveLength(3);

        expect(entries[0].name).toBe('Top League');

        expect(entries[0].collected).toBe(250);

        expect(entries[0].collectedLabel).toBe('$250');

        // 250 vs expected pool from $1000 (95% = $950) → 26%
        expect(entries[0].progressPct).toBe(26);

        expect(entries[0].statusLabel).toBe('In progress');

        const leagueA = entries.find((entry) => entry.name === 'League A');

        expect(leagueA.collectedLabel).toBe('$0');

        expect(leagueA.progressPct).toBe(0);

        const unfunded = entries.find((entry) => entry.name === 'Unfunded Cup');

        expect(unfunded.statusLabel).toBe('Registration open');

        expect(unfunded.progressPct).toBe(0);
    });

    test('uses collected amount in prize pool entry', () => {
        const entry = buildPrizePoolEntry(
            {
                name: 'Summer Cup',

                status: 'Started!',

                fundingGoalUsd: 2000,

                communityFundingUsd: 700
            },

            'summer'
        );

        expect(entry.collected).toBe(700);

        expect(entry.collectedLabel).toBe('$700');

        // 700 vs expected pool from $2000 seed (95% = $1900) → 37%
        expect(
            getFundingProgress(
                getTournamentCollectedUsd({ communityFundingUsd: 700 }),
                getTournamentFundingGoalUsd({ fundingGoalUsd: 2000 })
            )
        ).toBe(37);
    });

    test('full host seed fills the progress bar to 100%', () => {
        const goalUsd = 5;
        const { poolUsd } = splitHostSeedPayment(goalUsd);
        expect(getFundingProgress(poolUsd, goalUsd)).toBe(100);
    });

    test('uses 90/10 public donation split and 95/5 host seed split', () => {
        expect(PUBLIC_DONATION_POOL_SHARE).toBe(0.9);

        expect(PRIZE_POOL_DONATION_SHARE).toBe(0.9);

        expect(HOST_SEED_POOL_SHARE).toBe(0.95);

        expect(splitPublicDonation(100)).toEqual({ poolUsd: 90, platformUsd: 10 });

        expect(splitHostSeedPayment(100)).toEqual({ poolUsd: 95, platformUsd: 5 });
    });

    test('buildDonatablePrizePoolEntries only includes funded live public cups', () => {
        const entries = buildDonatablePrizePoolEntries({
            funded: {
                name: 'Top League',

                status: 'Started!',

                isPublic: true,

                communityFundingUsd: 100
            },

            unfunded: {
                name: 'Open Cup',

                status: 'Registration Started',

                isPublic: true
            }
        });

        expect(entries).toHaveLength(1);

        expect(entries[0].name).toBe('Top League');
    });

    test('resolveDonationTargetIds keeps valid saved ids or falls back to all donatable cups', () => {
        expect(filterDonationTargetIds(['cup1', 'cup2'], ['cup1', 'cup3'])).toEqual(['cup1']);

        expect(resolveDonationTargetIds(['missing'], ['cup1', 'cup2'])).toEqual(['cup1', 'cup2']);

        expect(resolveDonationTargetIds(['cup2'], ['cup1', 'cup2'])).toEqual(['cup2']);
    });
});
