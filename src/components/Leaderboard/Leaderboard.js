import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { calculateStarsFromRating, getAvatar } from '../../api/api';
import StarsComponent from '../Stars/Stars';
import classes from './Leaderboard.module.css';

const Leaderboard = () => {
    // const [playerScores, setPlayerScores] = useState([]);
    const [playerRating, setPlayerRating] = useState([]);
    const [avatars, setAvatars] = useState({});
    const [lastRankSnapshot, setLastRankSnapshot] = useState(null);

    useEffect(() => {
        const fetchPlayerScores = async () => {
            try {
                const response = await fetch('https://test-prod-app-81915-default-rtdb.firebaseio.com/users.json');
                if (!response.ok) {
                    throw new Error('Unable to fetch data from the server.');
                }
                const data = await response.json();
                // const scores = Object.entries(data).map(([id, player]) => ({
                //     id,
                //     enteredNickname: player.enteredNickname,
                //     score: player.score,
                //     games: player.gamesPlayed.heroes3.total
                // }));

                // scores.sort((a, b) => b.score - a.score);

                // setPlayerScores(scores);

                const playerObj = Object.entries(data)
                    .map(([id, player]) => {
                        let ratings = player.ratings;
                        if (typeof ratings === 'string' && ratings.includes(',')) {
                            ratings = parseFloat(parseFloat(ratings.split(',').at(-1)).toFixed(2));
                        } else {
                            ratings = ratings ? parseFloat(Number(ratings).toFixed(2)) : 0;
                        }

                        const games = player.gamesPlayed ? player.gamesPlayed.heroes3.total : 0;

                        return {
                            id,
                            enteredNickname: player.enteredNickname,
                            score: player.score,
                            ratings,
                            games,
                            stars: player.stars,
                            previousRank: player.previousRank || null,
                            previousRankTimestamp: player.previousRankTimestamp || null
                        };
                    })
                    .sort((a, b) => b.ratings - a.ratings);

                // Fetch last rank snapshot timestamp
                try {
                    const metaResponse = await fetch(
                        'https://test-prod-app-81915-default-rtdb.firebaseio.com/meta/lastRankSnapshot.json'
                    );
                    if (metaResponse.ok) {
                        const metaData = await metaResponse.json();
                        setLastRankSnapshot(metaData);
                    }
                } catch (error) {
                    console.error('Error fetching last rank snapshot:', error);
                }

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

                // Update each player's stars property
                const playerObjWithStars =
                    playerObj.length > 0
                        ? playerObj.map((player) => ({
                              ...player,
                              stars: player.stars
                                  ? player.stars
                                  : calculateStarsFromRating(player.ratings, highestRating, lowestRating)
                          }))
                        : [];

                setPlayerRating(playerObjWithStars);
                // Fetch avatars for top 10 players
                const avatarPromises = playerObjWithStars.slice(0, 10).map(async (player) => {
                    try {
                        const avatar = await getAvatar(player.id);
                        return { id: player.id, avatar };
                    } catch (error) {
                        console.error(`Error fetching avatar for ${player.enteredNickname}:`, error);
                        return { id: player.id, avatar: null };
                    }
                });

                const avatarResults = await Promise.all(avatarPromises);
                const avatarMap = {};
                avatarResults.forEach(({ id, avatar }) => {
                    avatarMap[id] = avatar;
                });
                setAvatars(avatarMap);
            } catch (error) {
                console.error(error);
            }
        };
        fetchPlayerScores();
    }, []);

    const recalculateStars = async () => {
        // Only recalculate for players with rating > 0 and at least 1 game
        const playersWithRating = playerRating.filter((player) => player.ratings > 0 && player.games > 0);

        if (playersWithRating.length === 0) {
            alert('No players with games played to recalculate.');
            return;
        }

        const highestRating = playersWithRating[0].ratings;
        console.log('highestRating', highestRating);

        const lowestRating = Math.min(...playersWithRating.map((player) => player.ratings));

        console.log('lowestRating', lowestRating);

        const updatedPlayerRating = playersWithRating.map((player) => {
            const newStars = calculateStarsFromRating(player.ratings, highestRating, lowestRating);
            console.log(
                `${player.enteredNickname}: ${player.ratings} rating, ${player.games} games → ${newStars} stars (old: ${player.stars})`
            );
            return {
                ...player,
                stars: newStars
            };
        });

        setPlayerRating(updatedPlayerRating);

        // Single confirmation for all players
        const confirmRecalculate = confirm(
            `Recalculate stars for ${updatedPlayerRating.length} players?\n\nHighest Rating: ${highestRating}\nLowest Rating: ${lowestRating}\n\nThis will update all player stars.`
        );

        if (!confirmRecalculate) {
            console.log('Star recalculation cancelled by user');
            return;
        }

        try {
            let successCount = 0;
            let errorCount = 0;

            for (const player of updatedPlayerRating) {
                const userId = player.id;
                const newStars = player.stars;

                console.log(`Updating ${player.enteredNickname}: ${player.ratings} rating → ${newStars} stars`);

                try {
                    const userResponse = await fetch(
                        `https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${userId}.json`,
                        {
                            method: 'PATCH',
                            body: JSON.stringify({
                                stars: newStars
                            }),
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        }
                    );

                    if (userResponse.ok) {
                        console.log(`Stars updated successfully for ${player.enteredNickname}`);
                        successCount++;
                    } else {
                        console.error(`Failed to update stars for ${player.enteredNickname}`);
                        errorCount++;
                    }
                } catch (error) {
                    console.error(`Error updating stars for ${player.enteredNickname}:`, error);
                    errorCount++;
                }
            }

            alert(`Star recalculation complete!\n\nSuccessful: ${successCount}\nErrors: ${errorCount}`);
        } catch (error) {
            console.error('Error during star recalculation:', error);
            alert('Error recalculating stars: ' + error.message);
        }
    };

    const snapshotCurrentRanks = async () => {
        const timestamp = new Date().toISOString();
        const confirmSnapshot = confirm(
            `Snapshot current leaderboard rankings?\n\nThis will save each player's current rank to compare against future rankings.\n\nProceed?`
        );

        if (!confirmSnapshot) {
            console.log('Rank snapshot cancelled by user');
            return;
        }

        try {
            let successCount = 0;
            let errorCount = 0;

            // Update each player with their current rank and timestamp
            for (let i = 0; i < playerRating.length; i++) {
                const player = playerRating[i];
                const currentRank = i + 1;

                try {
                    const userResponse = await fetch(
                        `https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${player.id}.json`,
                        {
                            method: 'PATCH',
                            body: JSON.stringify({
                                previousRank: currentRank,
                                previousRankTimestamp: timestamp
                            }),
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        }
                    );

                    if (userResponse.ok) {
                        console.log(`Rank snapshot saved for ${player.enteredNickname}: Rank ${currentRank}`);
                        successCount++;
                    } else {
                        console.error(`Failed to save rank snapshot for ${player.enteredNickname}`);
                        errorCount++;
                    }
                } catch (error) {
                    console.error(`Error saving rank snapshot for ${player.enteredNickname}:`, error);
                    errorCount++;
                }
            }

            // Save the snapshot timestamp in meta
            try {
                await fetch('https://test-prod-app-81915-default-rtdb.firebaseio.com/meta/lastRankSnapshot.json', {
                    method: 'PUT',
                    body: JSON.stringify(timestamp),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
            } catch (error) {
                console.error('Error saving meta timestamp:', error);
            }

            setLastRankSnapshot(timestamp);

            // Update player rating with new previous rank values
            const updatedPlayerRating = playerRating.map((player, index) => ({
                ...player,
                previousRank: index + 1,
                previousRankTimestamp: timestamp
            }));
            setPlayerRating(updatedPlayerRating);

            alert(`Rank snapshot complete!\n\nSuccessful: ${successCount}\nErrors: ${errorCount}`);
        } catch (error) {
            console.error('Error during rank snapshot:', error);
            alert('Error snapshotting ranks: ' + error.message);
        }
    };

    const getRankClass = (index) => {
        if (index === 0) {
            return classes.gold;
        } else if (index === 1) {
            return classes.silver;
        } else if (index === 2) {
            return classes.bronze;
        } else {
            return '';
        }
    };

    const getRankChangeIndicator = (currentRank, previousRank) => {
        if (!previousRank) {
            return '—';
        }

        const rankChange = previousRank - currentRank; // Positive means moved up (lower rank number)

        if (rankChange > 0) {
            return `🟢 ↑ ${rankChange}`;
        } else if (rankChange < 0) {
            return `🔴 ↓ ${Math.abs(rankChange)}`;
        } else {
            return '➡️';
        }
    };

    const formatTimestamp = (timestamp) => {
        if (!timestamp) {
            return 'Never';
        }
        const date = new Date(timestamp);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getRows = () => {
        const rows = [];
        for (let i = 0; i < 10; i++) {
            // const player = playerScores[i];
            // console.log('playerScores[i]', playerScores[i]);
            const player = playerRating[i];
            // console.log('player', player);
            const enteredNickname = player ? player.enteredNickname : '-';
            // console.log('enteredNickname', enteredNickname);
            const score = player ? player.score : '-';
            const games = player ? player.games : '-';
            const rating = player ? player.ratings : '-';
            const stars = player ? player.stars : '-';
            const playerId = player ? player.id : '-';
            const currentRank = i + 1;
            const previousRank = player ? player.previousRank : null;
            // console.log('getStarImageFilename', getStarImageFilename(stars));
            rows.push(
                <tr key={i} className={getRankClass(i)}>
                    <td>{i + 1}</td>
                    {/* <td>{enteredNickname}</td> */}
                    <td>
                        {/* Wrap the content in a Link component */}
                        <NavLink
                            to={`/players/${playerId}`}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            {avatars[playerId] && (
                                <img
                                    src={avatars[playerId]}
                                    alt={enteredNickname}
                                    style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '50%',
                                        border: i < 3 ? '2px solid #ffd700' : '2px solid #00ffff',
                                        objectFit: 'cover',
                                        boxShadow: '0 2px 4px rgba(0, 255, 255, 0.3)'
                                    }}
                                />
                            )}
                            {enteredNickname}
                        </NavLink>
                    </td>
                    <td>{score}</td>
                    <td>{games}</td>
                    <td>{rating}</td>
                    <td>{getRankChangeIndicator(currentRank, previousRank)}</td>
                    {/* <td>{stars}</td> */}
                    <td>{<StarsComponent stars={stars} />}</td>
                </tr>
            );
        }
        return rows;
    };

    return (
        <div className={classes.leaderboard}>
            <h2>🏆 Leaderboard</h2>
            <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}
            >
                <div>
                    <button onClick={recalculateStars}>⭐ Recalculate Stars</button>
                    <button onClick={snapshotCurrentRanks} style={{ marginLeft: '10px' }}>
                        📸 Snapshot Current Ranks
                    </button>
                </div>
                <div style={{ fontSize: '0.9em', color: '#00ffff' }}>
                    Last rank update: <strong>{formatTimestamp(lastRankSnapshot)}</strong>
                </div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Rank</th>
                        <th>Player</th>
                        <th>Score</th>
                        <th>Games</th>
                        <th>Rate</th>
                        <th>Rank Change</th>
                        {/* <th>Stars</th> */}
                        <th>Stars Img</th>
                    </tr>
                </thead>
                <tbody>{getRows()}</tbody>
            </table>
        </div>
    );
};

export default Leaderboard;
