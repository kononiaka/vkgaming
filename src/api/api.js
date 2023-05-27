export const addScoreToUser = async (userId, score, games) => {
    console.log('userId', userId);
    console.log('score', score);
    console.log('games', games);
    try {
        const response = await fetch(`https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${userId}.json`, {
            method: 'PATCH',
            body: JSON.stringify({ score, playedGames: { heroes3: games } }),
            headers: {
                'Content-Type': 'application/json'
            }
        });

        return await response.json();
    } catch (error) {
        console.error(error);
    }
};

export const lookForUserId = async (nickname) => {
    const response = await fetch('https://test-prod-app-81915-default-rtdb.firebaseio.com/users.json', {
        method: 'GET'
    });

    const data = await response.json();

    const userObj = Object.entries(data).find(([id, obj]) => obj.enteredNickname === nickname);

    // console.log('userObj upd', userObj);

    if (userObj) {
        return userObj[0]; // Return the ID of the matching user object
    } else {
        return null; // Return null if no matching user object is found
    }
};

export const lookForUserPrevScore = async (userId) => {
    let results = {};
    const response = await fetch(`https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${userId}.json`, {
        method: 'GET'
    });

    const data = await response.json();

    console.log('data', data);
    console.log('data gamesPlayed', data.gamesPlayed.heroes3);

    if (data && data.score) {
        results.score = data.score; // Return the score of the user object
        results.games = data.gamesPlayed.heroes3;
    }

    return results;
};
