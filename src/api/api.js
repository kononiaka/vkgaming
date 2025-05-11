//testing

export const confirmWindow = (message) => {
    const response = window.confirm(message);
    if (response) {
        console.log('YES');
    } else {
        console.log('NO');
    }
    return response;
};

export const addScoreToUser = async (userId, data, scoreToAdd, winner, tournamentId, team) => {
    const { score, games, ratings, stars } = data;


    let updatedRatings = ratings + `, ${scoreToAdd}`;

    console.log('updatedRatings', updatedRatings);

    try {
        const tournamentPlayerResponse = await fetch(
            `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/players/.json`
        );

        const tournamentData = await tournamentPlayerResponse.json();

        console.log('tournamentData', tournamentData);

        const result = findByName(tournamentData, team, scoreToAdd);

        if (tournamentData.hasOwnProperty(result.id)) {
            let existingStars = tournamentData[result.id].stars;
            let existingRatings = tournamentData[result.id].ratings;
            tournamentData[result.id].stars = existingStars;
            tournamentData[result.id].ratings = existingRatings;

            try {
                const response = await fetch('https://test-prod-app-81915-default-rtdb.firebaseio.com/users.json');
                if (!response.ok) {
                    throw new Error('Unable to fetch data from the server.');
                }
                const userData = await response.json();

                const playerObj = Object.entries(userData)
                    .map(([id, player]) => ({
                        id,
                        enteredNickname: player.enteredNickname,
                        score: player.score,
                        ratings: player.ratings ? parseFloat(player.ratings).toFixed(2) : '0.00',
                        games: player.gamesPlayed ? player.gamesPlayed.heroes3.total : 0,
                        stars: player.stars
                    }))
                    .sort((a, b) => parseFloat(b.ratings) - parseFloat(a.ratings));


                //TODO: refactor this when the max score is 10 and the lowest score is 5 e.g.
                const highestRating = playerObj[0].ratings;
                const lowestRating = Math.min(
                    ...playerObj
                        .filter((player) => player.ratings > 0)
                        .map((player) => {
                            console.log(player.ratings);
                            return player.ratings;
                        })
                );
                let newStars = calculateStarsFromRating(scoreToAdd, highestRating, lowestRating);
                // console.log('tournamentData before', tournamentData);

                tournamentData[result.id].stars += `, ${newStars}`;
                tournamentData[result.id].ratings += `, ${scoreToAdd.toFixed(2)}`;
                // console.log('tournamentData after', tournamentData);
                // let updatedStars = typeof stars === 'number' ? [stars, newStars] : [newStars];

                // console.log('updatedStars:', updatedStars);
                // console.log('updateRatings:', updatedRatings);

                let updatePlayerScoreResponse = confirmWindow(
                    `Are you sure you want to update player ${userId} with a score of ${scoreToAdd}?`
                );
                if (updatePlayerScoreResponse) {
                    const userResponse = await fetch(
                        `https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${userId}.json`,
                        {
                            method: 'PATCH',
                            body: JSON.stringify({
                                gamesPlayed: {
                                    heroes3: {
                                        total: games.heroes3.total + 1,
                                        win: userId === winner ? games.heroes3.win + 1 : null,
                                        lose: userId === winner ? games.heroes3.lose : games.heroes3.lose + 1
                                    }
                                },
                                ratings: updatedRatings,
                                stars: newStars
                            }),
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        }
                    );
                    if (userResponse.ok) {
                        console.log('user response post is successful');
                    }
                }
            } catch (e) {
                //
                console.error('Error fetching user data:', e);
            }
        }

        // console.log('tournamentData', tournamentData);

        let userResponse = await fetch(
            `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/players/.json`,
            {
                method: 'PUT',
                body: JSON.stringify(tournamentData),
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        return await userResponse.json();
    } catch (error) {
        console.error(error);
    }
};

export const findByName = (data, nickname, newRating) => {
    for (let key in data) {
        if (data[key].name === nickname) {
            // data[key].ratings = newRating;
            return { id: key, ...data[key] };
        }
    }
    return null; // Return null if no match is found
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

    return data;
};

export const lookForUserPrevScore = async (userId) => {
    let results = {};
    const response = await fetch(`https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${userId}.json`, {
        method: 'GET'
    });

    const data = await response.json();

    if (data && !!data.ratings) {
        results.ratings = data.ratings; // Return the score of the user object
        results.games = data.gamesPlayed;
        results.stars = data.stars;
    } else {
        // Add score property with default value if it doesn't exist
        await fetch(`https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${userId}/ratings.json`, {
            method: 'PUT',
            body: JSON.stringify(0)
        });
    }
    if (data && data.gamesPlayed) {
        results.games = data.gamesPlayed;
    } else {
        // Add score property with default value if it doesn't exist
        await fetch(`https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${userId}/gamesPlayed.json`, {
            method: 'PUT',
            body: JSON.stringify({ heroes3: { total: 0, win: 0, lose: 0 } })
        });
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

        rating = winRatio * 5 + totalGames * 0.5;
    }

    return rating;
};

export const getNewRating = (playerRating, opponentRating, didWin, kFactor = 4) => {
    // Calculate the expected score
    const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 100));

    // Determine the actual score based on the match result
    const actualScore = didWin ? 0.7 : 0.3;

    // Calculate the rating change
    let ratingChange = kFactor * (actualScore - expectedScore);

    // Cap the rating change to be within the range of -1 to 1.5
    ratingChange = Math.max(-1, Math.min(ratingChange, 1.5));

    // Calculate the new rating
    const newRating = playerRating + ratingChange;

    console.log('newRating', newRating);

    return newRating;

};

export const calculateStarsFromRating = (rating, highestRating, lowestRating) => {
    let cappedStars;
    if (rating > 0) {
        const totalStars = 5;
        const range = highestRating - lowestRating;
        const interval = range / totalStars;

        // Adjust the stars calculation based on the relative difference
        const ratingDifference = highestRating - rating;
        const adjustmentFactor = ratingDifference > interval ? 0.5 : 1; // Reduce stars gain for lower-rated wins
        const unroundedStars = ((rating - lowestRating) / interval) * adjustmentFactor;

        const rawStars = Math.round(unroundedStars * 2) / 2 + 0.5; // Start from 0.5
        cappedStars = Math.min(rawStars, totalStars); // Cap stars at 5
    } else {
        cappedStars = 0.5;
    }

    if (+cappedStars < 0.5) {
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
export const updateAvatar = async (userId, avatar) => {
    const avatarResponse = await fetch(
        `https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${userId}/.json`,
        {
            method: 'PATCH',
            body: JSON.stringify({ avatar }),
            headers: {
                'Content-Type': 'application/json'
            }
        }
    );

    if (avatarResponse.ok) {
        console.log('avatar updated');
    }
};

export const getAvatar = async (userId) => {
    const response = await fetch(`https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${userId}/avatar.json`);

    if (response.ok) {
        const data = await response.json();
        // console.log(JSON.stringify(data));
        return data;
    } else {
        throw new Error('Failed to get avatar data');
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
        `https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${userId}/totalPrize.json`
        // {
        //     method: 'GET',
        //     origin: ['*']
        // }
    );
    if (userResponse.ok) {
        const userData = await userResponse.json();
        console.log('getPlayerPrizeTotal - to get user prize', userData);
        return userData;
    } else {
        console.log('Failed getPlayerPrizeTotal - to get user prize data');
    }
};
