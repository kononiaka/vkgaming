export const fetchTournaments = async (param) => {
    try {
        const response = await fetch(
            'https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3.json'
        );

        const data = await response.json();

        if (response.ok) {
            const tournamentNames = Object.keys(data)
                .map((key) => {
                    if (param !== 'full') {
                        const tournament = data[key];
                        return tournament ? tournament.name : null;
                    } else {
                        const tournament = data[key];
                        return tournament;
                    }
                })
                .filter(Boolean);
            return tournamentNames; // Return the processed data
        } else {
            console.error('Failed to fetch tournaments:', data);
            return []; // Return an empty array in case of an error
        }
    } catch (error) {
        console.error('Error fetching tournaments:', error);
        return []; // Return an empty array in case of an error
    }
};

export const fetchTournamentGames = async (tournamentId) => {
    let data;
    const response = await fetch(
        `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/bracket/.json`
    );
    console.log('response', response);

    if (response.ok) {
        data = await response.json();
        if (data === null) {
            return false;
        }
        const keys = Object.keys(data);

        const objectsWithoutWinner = [];
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const innerArray = data[key];

            for (const outerArray of innerArray) {
                // Check if it's an array
                if (Array.isArray(outerArray)) {
                    // Loop through the inner arrays
                    for (const someinnerArray of outerArray) {
                        // Check if it's an array of objects
                        console.log('someinnerArray', someinnerArray);

                        if (!Object.prototype.hasOwnProperty.call(someinnerArray, 'winner')) {
                            // Add it to the result array
                            objectsWithoutWinner.push(someinnerArray);
                        }
                    }
                }
            }
        }

        return objectsWithoutWinner;
    }
};

// export const getTournamentWinner = async (stages, tournamentId) => {
//     const finalIndex = stages.indexOf('Final');

//     const tournamentData = await fetch(
//         `https://test-prod-app-81915-default-rtdb.firebaseio.com/tournaments/heroes3/${tournamentId}/bracket/playoffPairs/0.json`,
//         {
//             method: 'GET'
//         }
//     );

//     if (tournamentData.ok) {
//         console.log('Pairs posted to Firebase successfully');

//         // retrieveWinnersFromDatabase();
//     } else {
//         console.log('Failed to post pairs to Firebase');
//     }

//     const tournamentWinner = tournamentData[finalIndex - 1].winner;

//     console.log('Tournament Winner:', tournamentWinner);
// };
