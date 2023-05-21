export const addScoreToUser = async (userId, score) => {
    console.log('userId', userId);
    console.log('score', score);
    try {
        const response = await fetch(`https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${userId}.json`, {
            method: 'PATCH',
            body: JSON.stringify({ score }),
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
        method: 'GET',
    });

    const data = await response.json();

    const userObj = Object.entries(data).find(([id, obj]) => obj.enteredNickname === nickname);

    console.log('userObj upd', userObj);

    if (userObj) {
        return userObj[0]; // Return the ID of the matching user object
    } else {
        return null; // Return null if no matching user object is found
    }
};

export const lookForUserPrevScore = async (userId) => {
    const response = await fetch(`https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${userId}.json`, {
        method: 'GET',
    });

    const data = await response.json();

    console.log('data', data);

    if (data && data.score) {
        return data.score; // Return the score of the user object
    } else {
        return null; // Return null if no score is found
    }
};