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

    console.log('data', data);
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
