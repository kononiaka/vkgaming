import { parseNumericValue } from './matchCenterData';

export const getHeadToHeadPrediction = (team1, team2, gamesHistory, playerContext = {}) => {
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const getDeterministicValue = (key, min, max) => {
        let hash = 0;
        for (let i = 0; i < key.length; i++) {
            hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
        }

        const normalized = (hash % 10000) / 10000;
        return min + normalized * (max - min);
    };

    const team1Rating = parseNumericValue(playerContext.team1Rating);
    const team2Rating = parseNumericValue(playerContext.team2Rating);
    const team1Stars = parseNumericValue(playerContext.team1Stars);
    const team2Stars = parseNumericValue(playerContext.team2Stars);

    const parsePlace = (value) => {
        const num = Number(value);
        return Number.isFinite(num) && num > 0 ? num : null;
    };

    const team1Place = parsePlace(playerContext.team1Place);
    const team2Place = parsePlace(playerContext.team2Place);

    const relevantGames = Object.values(gamesHistory || {}).filter((historyGame) => {
        const o1 = historyGame?.opponent1;
        const o2 = historyGame?.opponent2;

        return (o1 === team1 && o2 === team2) || (o1 === team2 && o2 === team1);
    });

    const placeAdvantage = team1Place && team2Place ? clamp((team2Place - team1Place) * 1.8, -12, 12) : 0;
    const ratingAdvantage = clamp((team1Rating - team2Rating) * 0.04, -12, 12);
    const starsAdvantage = clamp((team1Stars - team2Stars) * 0.8, -4, 4);
    const leaderboardPrediction = clamp(50 + placeAdvantage + ratingAdvantage + starsAdvantage, 15, 85);

    if (relevantGames.length === 0) {
        const matchupKey = `${team1}|${team2}`;
        const tinyAdjustment = getDeterministicValue(matchupKey, -1.25, 1.25);
        const team1Prediction = clamp(leaderboardPrediction + tinyAdjustment, 15, 85);
        return { team1: team1Prediction.toFixed(1), team2: (100 - team1Prediction).toFixed(1) };
    }

    const team1Wins = relevantGames.filter((historyGame) => historyGame?.winner === team1).length;
    let headToHeadPrediction = (team1Wins / relevantGames.length) * 100;

    const h2hWeight = clamp(0.35 + relevantGames.length * 0.08, 0.35, 0.8);
    let team1Prediction = headToHeadPrediction * h2hWeight + leaderboardPrediction * (1 - h2hWeight);
    const matchupKey = `${team1}|${team2}`;

    if (team1Prediction >= 99.95) {
        team1Prediction = getDeterministicValue(matchupKey, 80, 85);
    } else if (team1Prediction <= 0.05) {
        team1Prediction = getDeterministicValue(matchupKey, 15, 20);
    }

    const team2Prediction = 100 - team1Prediction;

    return {
        team1: team1Prediction.toFixed(1),
        team2: team2Prediction.toFixed(1)
    };
};

export const enrichMatchWithPrediction = (match, gamesHistory) => {
    const prediction = getHeadToHeadPrediction(match.team1, match.team2, gamesHistory, {
        team1Stars: match.team1Stars,
        team2Stars: match.team2Stars
    });

    return {
        ...match,
        team1Prediction: prediction.team1,
        team2Prediction: prediction.team2
    };
};
