export const addScoreToUser = async (userId, data, scoreToAdd, winner) => {
    const { score, games } = data;
    try {
        const response = await fetch(`https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${userId}.json`, {
            method: 'PATCH',
            body: JSON.stringify({
                score: Number(score) + Number(scoreToAdd),
                gamesPlayed: {
                    heroes3: {
                        total: games.heroes3.total + 1,
                        win: userId === winner ? games.heroes3.win + 1 : null,
                        lose: userId === winner ? games.heroes3.lose : games.heroes3.lose + 1
                    }
                }
            }),
            headers: {
                'Content-Type': 'application/json'
            }
        });

        return await response.json();
    } catch (error) {
        console.error(error);
    }
};

export const lookForUserId = async (nickname, full) => {
    const response = await fetch('https://test-prod-app-81915-default-rtdb.firebaseio.com/users.json', {
        method: 'GET'
    });

    const data = await response.json();

    const userObj = Object.entries(data).find(([, obj]) => obj.enteredNickname === nickname);

    if (full === 'full') {
        if (userObj) {
            return { name: userObj[1].enteredNickname };
        }
    }

    if (userObj) {
        return userObj[0]; // Return the ID of the matching user object
    } else {
        return null; // Return null if no matching user object is found
    }
};

export const loadUserById = async (userId) => {
    const response = await fetch(`https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${userId}.json`, {
        method: 'GET'
    });

    const data = await response.json();

    // console.log('data', data);
    return data;
};

export const lookForUserPrevScore = async (userId) => {
    let results = {};
    const response = await fetch(`https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${userId}.json`, {
        method: 'GET'
    });

    const data = await response.json();

    if (data && data.score) {
        results.score = data.score; // Return the score of the user object
        results.games = data.gamesPlayed;
    }

    return results;
};

export const lookForCastleStats = async (castle, action) => {
    let body;
    const response = await fetch(
        `https://test-prod-app-81915-default-rtdb.firebaseio.com/statistic/heroes3/castles/${castle}.json`,
        {
            method: 'GET'
        }
    );

    const castleData = await response.json();
    if (action === 'win') {
        body = JSON.stringify({
            total: castleData.total + 1,
            win: castleData.win + 1,
            lose: castleData.lose
        });
    } else {
        body = JSON.stringify({
            total: castleData.total + 1,
            win: castleData.win,
            lose: castleData.lose + 1
        });
    }

    try {
        const response = await fetch(
            `https://test-prod-app-81915-default-rtdb.firebaseio.com/statistic/heroes3/castles/${castle}.json`,
            {
                method: 'PATCH',
                body: body,
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        return await response.json();
    } catch (error) {
        console.error(error);
    }
};

export const getRating = async (opponentId) => {
    let rating;
    const response = await fetch(
        `https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${opponentId}/gamesPlayed/heroes3.json`,
        {
            method: 'GET'
        }
    );

    const data = await response.json();

    if (data) {
        const totalGames = data.total;
        const victories = data.total - data.lose;
        const winRatio = victories / totalGames;
        // console.log('winRatio', winRatio);

        rating = winRatio * 5 + totalGames * 0.5;
    }

    console.log('rating', rating);

    return rating;
};

function calculateEloRating(winnerRating, loserRating, kFactor = 32) {
    const expectedWinProbability = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));

    const winnerNewRating = winnerRating + kFactor * (1 - expectedWinProbability);
    const loserNewRating = loserRating + kFactor * (0 - (1 - expectedWinProbability));
    console.log('winnerNewRating', winnerNewRating);
    console.log('loserNewRating', loserNewRating);

    return { winner: winnerNewRating, loser: loserNewRating };
}

export const calculateStarsFromRating = (rating, highestRating, lowestRating) => {
    let cappedStars;
    if (rating > 0) {
        const totalStars = 5;
        const range = highestRating - lowestRating;
        const interval = range / totalStars;
        const unroundedStars = (rating - lowestRating) / interval;
        const rawStars = Math.round(unroundedStars * 2) / 2 + 0.5; // Start from 0.5
        cappedStars = Math.min(rawStars, totalStars); // Cap stars at 5
        // console.log('cappedStars', cappedStars);
    } else {
        cappedStars = 0.5;
    }
    return cappedStars;
};

export const getStarImageFilename = (stars) => {
    const imageName = '../../image/ratings/' + stars + '.png';
    return imageName;
};

export const updateRating = async (opponentId, rating, game) => {
    //TODO: make ratings by game
    const ratingResponse = await fetch(
        `https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${opponentId}/ratings.json`,
        {
            method: 'PUT',
            body: rating,
            headers: {
                'Content-Type': 'application/json'
            }
        }
    );

    if (ratingResponse.ok) {
        console.log('rate updated');
    }
};

export const updateStars = async (opponentId, stars) => {
    //TODO: make ratings by game
    const ratingResponse = await fetch(
        `https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${opponentId}/stars.json`,
        {
            method: 'PUT',
            body: stars,
            headers: {
                'Content-Type': 'application/json'
            }
        }
    );

    if (ratingResponse.ok) {
        console.log('rate updated');
    }
};

//IS NOT WORKING DUE TO CORS ISSUE
export const getAllUsers = async () => {
    const ratingResponse = await fetch(`https://test-prod-app-81915-default-rtdb.firebaseio.com/users/`, {
        method: 'GET',
        origin: ['*']
    });

    if (ratingResponse.ok) {
        return ratingResponse.json();
    }
};

export const lookForTournamentName = async (tournamentId) => {
    const tournamentResponse = await fetch(
        `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}.json`,
        {
            method: 'GET',
            origin: ['*']
        }
    );

    if (tournamentResponse.ok) {
        return tournamentResponse.json();
    }
};

export const determineTournamentPrizes = (total_prize) => {
    let prizes = {};
    // Calculate prize amounts for each place
    prizes['1st Place'] = (total_prize * 0.6).toFixed(2);
    prizes['2nd Place'] = (total_prize * 0.3).toFixed(2);
    prizes['3rd Place'] = (total_prize * 0.1).toFixed(2);
    return prizes;
};

export const pullTournamentPrizes = async (tournamentId) => {
    const tournamentResponse = await fetch(
        `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/pricePull.json`,
        {
            method: 'GET',
            origin: ['*']
        }
    );
    if (tournamentResponse.ok) {
        return tournamentResponse.json();
    }
};

export const getPlayerPrizeTotal = async (userId) => {
    const userResponse = await fetch(
        `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${userId}/totalPrize.json`,
        {
            method: 'GET',
            origin: ['*']
        }
    );
    if (userResponse.ok) {
        return userResponse.json();
    }
};
