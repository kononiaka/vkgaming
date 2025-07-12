import { useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAvatar, updateAvatar, addCoinsToUser } from '../../api/api';
import AuthContext from '../../store/auth-context';

import classes from './ProfileForm.module.css';

const ProfileForm = () => {
    const newPasswordInsertedRef = useRef();
    const avatarInputRef = useRef();

    const authCtx = useContext(AuthContext);
    const [userId, setUserId] = useState('');
    const [playerObj, setPlayerObj] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [avatarBase64, setAvatarBase64] = useState('');

    let { userNickName } = authCtx;
    userNickName = localStorage.getItem('userName');
    useEffect(() => {
        const fetchPlayerScore = async () => {
            try {
                const response = await fetch('https://test-prod-app-81915-default-rtdb.firebaseio.com/users.json');
                if (!response.ok) {
                    throw new Error('Unable to fetch data from the server.');
                }
                const data = await response.json();
                const playerFromDB = Object.entries(data)
                    .filter(([, player]) => player.enteredNickname === userNickName)
                    .map(([id, player]) => {
                        console.log('id', id);
                        console.log('player', player);
                        player.id = id;
                        setUserId(id);
                        return player;
                    });

                //TODO: redundunt???
                let avatar = await getAvatar(playerFromDB[0].id);
                setAvatarBase64(avatar);

                if (playerFromDB[0]) {
                    const playerScore = playerFromDB[0].score;
                    authCtx.score = playerScore;
                    setPlayerObj(playerFromDB[0]);
                    setIsLoading(true);
                } else {
                    setPlayerObj(null);
                }
            } catch (error) {
                console.error(error);
            }
        };
        fetchPlayerScore();
    }, [authCtx]);

    const navigate = useNavigate();

    const handleFileChange = (event) => {
        const selectedFile = event.target.files[0];

        // Check if file size is within the limit
        if (selectedFile.size <= 200 * 1024) {
            const reader = new FileReader();
            reader.onload = async () => {
                const base64 = reader.result;
                setAvatarBase64(base64);

                // Only give 1 coin if avatar was missing before
                const userRes = await fetch(
                    `https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${userId}.json`
                );
                const userData = await userRes.json();
                const hadNoAvatar = !userData.avatar;

                await updateAvatar(userId, base64);

                if (hadNoAvatar) {
                    await addCoinsToUser(userId, 1);
                    authCtx.setNotificationShown(
                        true,
                        'Congrats! You received 1 coin point for avatar upload!',
                        'success',
                        5
                    );
                } else {
                    alert('Avatar was already set. No coin!');
                }
            };
            reader.readAsDataURL(selectedFile);
        } else {
            // File size exceeds the limit, show an error message or handle accordingly
            alert('File size exceeds the limit of 200KB. Please select a smaller file.');
        }
    };

    const handleUploadClick = () => {
        // Trigger the file input click
        if (avatarInputRef.current) {
            avatarInputRef.current.click();
        }
    };

    const submitHandler = (event) => {
        event.preventDefault();
        const newPasswordValue = newPasswordInsertedRef.current.value;

        fetch('https://identitytoolkit.googleapis.com/v1/accounts:update?key=AIzaSyD0B7Cgft2m58MjUWhIzjykJwkvnXN1O2k', {
            method: 'POST',
            body: JSON.stringify({
                idToken: authCtx.token,
                password: newPasswordValue,
                returnSecureToken: false
            }),
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .then(async (res) => {
                if (res.ok) {
                    navigate.replace('/');
                    return res.json();
                } else {
                    const data = await res.json();
                    let errorMessage = 'Custom error';
                    if (data && data.error && data.error.message) {
                        errorMessage = data.error.message;
                    }
                    throw new Error(errorMessage);
                }
            })
            .catch((err) => {
                alert(err.message);
            });
        // setAvatar(null);
    };

    return (
        <>
            {avatarBase64 && (
                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                    <img src={avatarBase64} alt="Selected Avatar" style={{ width: '200px', height: '180px' }} />
                </div>
            )}
            <div className={classes.control}>
                <label htmlFor="avatar">Avatar (max 200KB)</label>
                <input
                    type="file"
                    id="avatar"
                    accept="image/*"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                    ref={avatarInputRef}
                />
                <button type="button" onClick={handleUploadClick}>
                    Upload Avatar
                </button>
            </div>
            <p>Coins: {playerObj.coins || 'N/A'}</p>
            <p>Your score: {playerObj.score}</p>
            {isLoading && (
                <ul>
                    Statistic:
                    <li>Win: {playerObj.gamesPlayed.heroes3.total - playerObj.gamesPlayed.heroes3.lose}</li>
                    <li>Lose: {playerObj.gamesPlayed.heroes3.lose}</li>
                    <li>Total: {playerObj.gamesPlayed.heroes3.total}</li>
                    <li>
                        Rating:
                        {playerObj.ratings
                            ? Number(
                                  playerObj.ratings
                                      .split(',')
                                      .map((r) => r.trim())
                                      .filter(Boolean)
                                      .pop()
                              ).toFixed(2)
                            : 'N/A'}
                    </li>
                    <li>Stars: {playerObj.stars}</li>
                    <li>Total win: {playerObj.totalPrize ? playerObj.totalPrize : '0$'}</li>
                    <li>Place in Leaderboard: {playerObj.totalPrize}</li>
                    <li>
                        Prizes:
                        <ul>
                            {Array.isArray(playerObj.prizes) && playerObj.prizes.length > 0 ? (
                                [...playerObj.prizes].reverse().map((prize, idx) => (
                                    <li key={idx}>
                                        {prize.tournamentName} — {prize.place} place — {prize.prizeAmount}
                                    </li>
                                ))
                            ) : (
                                <li>No prizes</li>
                            )}
                        </ul>
                    </li>
                    <li>Twitch: {playerObj.twitch || 'N/A'}</li>
                    <li>Youtube: {playerObj.youtube || 'N/A'}</li>
                    <li>Telegram: {playerObj.telegram || 'N/A'}</li>
                    <li>Discord: {playerObj.discord || 'N/A'}</li>
                    <li>Last login date: {playerObj.lastLoginDate || 'N/A'}</li>
                </ul>
            )}
            <form className={classes.form} onSubmit={submitHandler}>
                <div className={classes.control}>
                    <label htmlFor="new-password">New Password</label>
                    <input type="password" id="new-password" ref={newPasswordInsertedRef} />
                </div>
                <div className={classes.action}>
                    <button>Change Password</button>
                </div>
            </form>
        </>
    );
};

export default ProfileForm;
