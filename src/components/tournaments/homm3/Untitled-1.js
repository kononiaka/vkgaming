for (let currentStage = 0; currentStage < collectedPlayoffPairs.length - 1; currentStage++) {
    console.log('currentStage', currentStage);
    let currentStagePlayoffPairs = collectedPlayoffPairs[currentStage];
    const currentStagePlayoffWinners = currentStagePlayoffPairs.map((pair) => pair.winner);
    console.log('currentStagePlayoffWinners', currentStagePlayoffWinners);
    let nextStageIndex = 0;

    if (!currentStagePlayoffWinners.includes(undefined)) {
        nextStageIndex = currentStage + 1;
        console.log('nextStageIndex', nextStageIndex);
    }

    let nextStagePlayoffPairs = collectedPlayoffPairs[nextStageIndex];
    console.log('nextStagePlayoffPairs-402', nextStagePlayoffPairs);
    const nextStagePlayoffWinners = nextStagePlayoffPairs.map((pair) => pair.winner);
    console.log('nextStagePlayoffWinners-404', nextStagePlayoffWinners);

    if (nextStagePlayoffWinners.includes(undefined)) {
        if (nextStageIndex === 2) {
            const losers = currentStagePlayoffPairs.map((match) =>
                match.winner === match.team1 ? match.team2 : match.winner === match.team2 ? match.team1 : null
            );
            console.log('losers', losers);

            // Determine third-place winner from losers
            const thirdPlaceWinner = determineThirdPlaceWinner(losers);

            let thirdPlacePairing = determineNextStagePairings([thirdPlaceWinner]);
            console.log('thirdPlacePairing-417', thirdPlacePairing);

            // Set third-place winner in the bracket
            collectedPlayoffPairs[nextStageIndex + 1] = [{ winner: thirdPlaceWinner }];
            collectedPlayoffPairs[nextStageIndex] = thirdPlacePairing;
        } else {
            nextStagePairings = determineNextStagePairings(currentStagePlayoffWinners);
            collectedPlayoffPairs[nextStageIndex] = nextStagePairings;
            console.log('nextStagePairings-424', JSON.stringify(nextStagePairings));
            console.log('nextPairs-425', nextStageIndex);
        }
    }
}

function determineThirdPlaceWinner(losers) {
    // Your logic to determine the third-place winner from the list of losers
    // You might want to consider tiebreakers or additional rules here
    // For simplicity, let's say the first loser is the third-place winner
    return losers[0];
}
