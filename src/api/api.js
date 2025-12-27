export const fetchLeaderboard = async (player) => {
    try {
        const response = await fetch(`https://test-prod-app-81915-default-rtdb.firebaseio.com/users.json`);
        if (!response.ok) {
            throw new Error('Unable to fetch leaderboard.');
        }
        const data = await response.json();
        if (!data || !player) {
            return null;
        }

        // Convert users object to array and sort by totalPrize descending
        const usersArray = Object.values(data).filter((u) => u && u.totalPrize !== undefined);
        usersArray.sort((a, b) => (b.totalPrize || 0) - (a.totalPrize || 0));

        // Find the index of the current player
        const place = usersArray.findIndex((u) => u.enteredNickname === player.enteredNickname) + 1;
        return place;
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        return null;
    }
};

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
                                ratings: updatedRatings
                                // NOTE: Stars are NOT updated here - only at tournament end
                                // This preserves tournament entry stars throughout the tournament
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

export async function addCoinsToUser(userId, coinsToAdd = 1) {
    // Fetch the current user data
    const userRes = await fetch(`https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${userId}.json`);
    const userData = await userRes.json();

    // Calculate new coins value
    const newCoins = (userData.coins || 0) + coinsToAdd;

    // Update the user with the new coins value
    await fetch(`https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${userId}.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coins: newCoins })
    });
}

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

export const fetchCastlesList = async () => {
    try {
        const response = await fetch(
            'https://test-prod-app-81915-default-rtdb.firebaseio.com/statistic/heroes3/castles.json'
        );
        const data = await response.json();

        let castles = Object.entries(data).map(([id, castle]) => ({
            id: id,
            name: id,
            win: castle.win,
            lose: castle.lose,
            total: castle.total,
            rate: castle.total !== 0 ? (castle.win / castle.total) * 100 : 0
        }));

        castles.sort((a, b) => b.rate - a.rate);

        return castles;
    } catch (error) {
        console.error(error);
    }
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

    return newRating;
};

export const calculateStarsFromRating = (rating, highestRating, lowestRating, minStars = 0.5) => {
    let cappedStars;
    if (rating > 0) {
        const totalStars = 5;
        const range = highestRating - lowestRating;

        // Linear distribution from 0.5 to 5.0 stars
        const normalized = range === 0 ? 1 : (rating - lowestRating) / range;
        const rawStars = normalized * (totalStars - minStars) + minStars;

        console.log(
            `calculateStarsFromRating: rating=${rating}, highest=${highestRating}, lowest=${lowestRating}, minStars=${minStars}, normalized=${normalized}, rawStars=${rawStars}`
        );

        cappedStars = Math.round(rawStars * 2) / 2; // Round to nearest 0.5
        cappedStars = Math.min(cappedStars, totalStars); // Cap stars at 5

        console.log(`Final capped stars: ${cappedStars}`);
    } else {
        cappedStars = minStars;
    }

    if (+cappedStars < minStars) {
        cappedStars = minStars;
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

export async function fetchLastGamesForPlayer(playerName, count = 5) {
    const response = await fetch('https://test-prod-app-81915-default-rtdb.firebaseio.com/games/heroes3.json');
    if (!response.ok) return [];
    const data = await response.json();
    if (!data) return [];

    // Flatten and filter games where the player participated
    const games = Object.values(data).filter((g) => g.opponent1 === playerName || g.opponent2 === playerName);

    // Sort by date descending and take last N
    return games
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, count)
        .map((g) => ({
            date: g.date,
            opponent: g.opponent1 === playerName ? g.opponent2 : g.opponent1,
            result: g.winner === playerName ? 'Win' : 'Loss'
        }));
}

/**
 * Returns the best and worst castles for a player based on win/loss count.
 * @param {string} playerName
 * @returns {Promise<{ best: { castle: string, wins: number }, worst: { castle: string, loses: number } }>}
 */
export async function fetchBestAndWorstCastleForPlayer(playerName) {
    const response = await fetch('https://test-prod-app-81915-default-rtdb.firebaseio.com/games/heroes3.json');
    if (!response.ok) return { best: null, worst: null };
    const data = await response.json();
    if (!data) return { best: null, worst: null };

    // Collect all games where the player participated
    const games = Object.values(data).filter((g) => g.opponent1 === playerName || g.opponent2 === playerName);

    // Count wins and loses by castle
    const castleStats = {};

    games.forEach((g) => {
        let playerCastle, isWin;

        if (g.opponent1 === playerName) {
            playerCastle = g.opponent1Castle;
            isWin = g.winner === playerName;
        } else {
            playerCastle = g.opponent2Castle;
            isWin = g.winner === playerName;
        }

        // Handle nested games if castle is missing
        if (!playerCastle) {
            if (g.gameType && g.games && Array.isArray(g.games)) {
                g.games.forEach((subGame) => {
                    let subCastle, subIsWin;

                    if (g.opponent1 === playerName) {
                        subCastle = subGame.castle1;
                        subIsWin = subGame.gameWinner === playerName;
                    } else {
                        subCastle = subGame.castle2;
                        subIsWin = subGame.gameWinner === playerName;
                    }

                    if (!subCastle) {
                        console.error(`[${playerName}] Sub-game not counted due to missing castle:`, subGame);
                        return;
                    }

                    if (!castleStats[subCastle]) {
                        castleStats[subCastle] = { wins: 0, loses: 0 };
                    }

                    if (subIsWin) {
                        castleStats[subCastle].wins += 1;
                    } else {
                        castleStats[subCastle].loses += 1;
                    }
                });
                return; // Skip the rest since we handled it with subgames
            }

            // Log error for games that weren't calculated due to missing castle info
            console.error(`[${playerName}] Game not counted due to missing castle:`, g);
            return;
        }

        // Handle normal games
        if (!castleStats[playerCastle]) {
            castleStats[playerCastle] = { wins: 0, loses: 0 };
        }

        if (isWin) {
            castleStats[playerCastle].wins += 1;
        } else {
            castleStats[playerCastle].loses += 1;
        }
    });

    // Find best (most wins) and worst (most loses) castles, including both wins and loses
    let best = null,
        worst = null;
    for (const [castle, stats] of Object.entries(castleStats)) {
        if (!best || stats.wins > best.wins) best = { castle, wins: stats.wins, loses: stats.loses };
        if (!worst || stats.loses > worst.loses) worst = { castle, wins: stats.wins, loses: stats.loses };
    }

    // Log summary of wins and loses
    const totalWins = Object.values(castleStats).reduce((sum, s) => sum + s.wins, 0);
    const totalLoses = Object.values(castleStats).reduce((sum, s) => sum + s.loses, 0);
    const totalGames = games.length;
    console.log(
        `[${playerName}] Total games: ${totalGames}, Wins: ${totalWins}, Loses: ${totalLoses}, Wins+Loses: ${totalWins + totalLoses}`
    );
    if (totalWins + totalLoses !== totalGames) {
        console.warn(
            `[${playerName}] Warning: Wins + Loses != Total games. Possible missing castle info or data inconsistency.`
        );
    }

    return { best, worst };
}

/**
 * Returns full castle statistics for a player: wins and loses for each castle.
 * @param {string} playerName
 * @returns {Promise<Object>} An object like { [castleName]: { wins: number, loses: number } }
 */
export async function fetchFullCastleStatsForPlayer(playerName) {
    const response = await fetch('https://test-prod-app-81915-default-rtdb.firebaseio.com/games/heroes3.json');
    if (!response.ok) return {};
    const data = await response.json();
    if (!data) return {};

    // Collect all games where the player participated
    const games = Object.values(data).filter((g) => g.opponent1 === playerName || g.opponent2 === playerName);

    // Count wins and loses by castle
    const castleStats = {};

    games.forEach((g) => {
        let playerCastle, isWin;

        if (g.opponent1 === playerName) {
            playerCastle = g.opponent1Castle;
            isWin = g.winner === playerName;
        } else {
            playerCastle = g.opponent2Castle;
            isWin = g.winner === playerName;
        }
        console.log('g', g);

        // Handle nested games if castle is missing
        if (!playerCastle) {
            console.log('g.gameType', g.gameType);

            if (g.gameType && g.games && Array.isArray(g.games)) {
                g.games.forEach((subGame) => {
                    console.log('subGame', subGame);
                    let subCastle, subIsWin;

                    if (g.opponent1 === playerName) {
                        subCastle = subGame.castle1;
                        subIsWin = subGame.gameWinner === playerName;
                    } else {
                        subCastle = subGame.castle2;
                        subIsWin = subGame.gameWinner === playerName;
                    }

                    if (!subCastle) {
                        console.error(`[${playerName}] Sub-game not counted due to missing castle:`, subGame);
                        return;
                    }

                    if (!castleStats[subCastle]) {
                        castleStats[subCastle] = { wins: 0, loses: 0 };
                    }

                    if (subIsWin) {
                        castleStats[subCastle].wins += 1;
                    } else {
                        castleStats[subCastle].loses += 1;
                    }
                });
                return; // Skip the rest since we handled it with subgames
            }

            // Log error for games that weren't calculated due to missing castle info
            console.error(`[${playerName}] Game not counted due to missing castle:`, g);
            return;
        }

        // Handle normal games
        if (!castleStats[playerCastle]) {
            castleStats[playerCastle] = { wins: 0, loses: 0 };
        }

        if (isWin) {
            castleStats[playerCastle].wins += 1;
        } else {
            castleStats[playerCastle].loses += 1;
        }
    });

    return castleStats;
}

/**
 * Returns the best and worst opponents for a player based on win/loss record.
 * @param {string} playerName
 * @returns {Promise<{ best: { opponent: string, wins: number, loses: number }, worst: { opponent: string, wins: number, loses: number } }>}
 */
export async function fetchBestAndWorstOpponentForPlayer(playerName) {
    const response = await fetch('https://test-prod-app-81915-default-rtdb.firebaseio.com/games/heroes3.json');
    if (!response.ok) return { best: null, worst: null };
    const data = await response.json();
    if (!data) return { best: null, worst: null };

    // Collect all games where the player participated
    const games = Object.values(data).filter((g) => g.opponent1 === playerName || g.opponent2 === playerName);

    // Count wins and loses by opponent
    const opponentStats = {};

    games.forEach((g) => {
        const opponent = g.opponent1 === playerName ? g.opponent2 : g.opponent1;
        const isWin = g.winner === playerName;

        if (!opponent) return; // Skip if opponent is missing

        if (!opponentStats[opponent]) {
            opponentStats[opponent] = { wins: 0, loses: 0 };
        }

        if (isWin) {
            opponentStats[opponent].wins += 1;
        } else {
            opponentStats[opponent].loses += 1;
        }
    });

    // Find best (most wins) and worst (most loses) opponents
    let best = null,
        worst = null;
    for (const [opponent, stats] of Object.entries(opponentStats)) {
        if (!best || stats.wins > best.wins) {
            best = { opponent, wins: stats.wins, loses: stats.loses };
        }
        if (!worst || stats.loses > worst.loses) {
            worst = { opponent, wins: stats.wins, loses: stats.loses };
        }
    }

    return { best, worst };
}
