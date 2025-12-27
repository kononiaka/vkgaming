import { useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAvatar, updateAvatar } from '../../api/api';
import { addCoins } from '../../api/coinTransactions';
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
    const [isGenerating, setIsGenerating] = useState(false);

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
                    await addCoins(userId, 1, 'avatar_upload', 'First avatar upload bonus');
                    authCtx.setNotificationShown(
                        true,
                        'Congrats! You received 1 coin for avatar upload!',
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

    const handleGenerateAvatar = async () => {
        setIsGenerating(true);
        try {
            // Map character classes to pixel art styles with different colors
            const avatarStyles = {
                knight: { style: 'pixel-art', backgroundColor: 'b6e3f4' },
                elf: { style: 'pixel-art', backgroundColor: 'c0aede' },
                dwarf: { style: 'pixel-art-neutral', backgroundColor: 'd1d4f9' },
                wizard: { style: 'pixel-art', backgroundColor: '8b5cf6' },
                necromancer: { style: 'pixel-art-neutral', backgroundColor: '1e293b' },
                barbarian: { style: 'pixel-art', backgroundColor: 'ff6b6b' },
                sorceress: { style: 'pixel-art-neutral', backgroundColor: 'fbbf24' },
                warlock: { style: 'pixel-art', backgroundColor: '7c3aed' },
                cleric: { style: 'pixel-art-neutral', backgroundColor: 'fde047' },
                demon: { style: 'pixel-art-neutral', backgroundColor: 'dc2626' }
            };

            // Pick random character class
            const characterClasses = Object.keys(avatarStyles);
            const randomClass = characterClasses[Math.floor(Math.random() * characterClasses.length)];
            const config = avatarStyles[randomClass];

            // Generate random seed based on character class and timestamp for uniqueness
            const seed = `${randomClass}-${Date.now()}-${Math.random().toString(36).substring(7)}`;

            // Use DiceBear free API - no API key required!
            const imageUrl = `https://api.dicebear.com/7.x/${config.style}/svg?seed=${seed}&backgroundColor=${config.backgroundColor}&size=256`;

            // Fetch and convert to base64
            const imageResponse = await fetch(imageUrl);
            const svgText = await imageResponse.text();

            // Convert SVG to data URI (UTF-8 safe, no need for base64)
            const base64 = `data:image/svg+xml,${encodeURIComponent(svgText)}`;
            setAvatarBase64(base64);

            // Check if first avatar and save
            const userRes = await fetch(`https://test-prod-app-81915-default-rtdb.firebaseio.com/users/${userId}.json`);
            const userData = await userRes.json();
            const hadNoAvatar = !userData.avatar;

            await updateAvatar(userId, base64);

            if (hadNoAvatar) {
                await addCoins(userId, 1, 'avatar_upload', 'First avatar (generated) bonus');
                authCtx.setNotificationShown(
                    true,
                    'Congrats! You received 1 coin for your first avatar!',
                    'success',
                    5
                );
            } else {
                authCtx.setNotificationShown(true, 'Avatar generated successfully!', 'success', 3);
            }
        } catch (error) {
            console.error('Generation error:', error);
            authCtx.setNotificationShown(true, 'Avatar generation failed. Please try again.', 'error', 5);
        } finally {
            setIsGenerating(false);
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
        <div className={classes.profileContainer}>
            {avatarBase64 && (
                <div className={classes.avatarSection}>
                    <img src={avatarBase64} alt="Selected Avatar" className={classes.avatar} />
                </div>
            )}
            <div className={classes.uploadSection}>
                <label htmlFor="avatar" className={classes.uploadLabel}>
                    📸 Avatar (max 200KB)
                </label>
                <input
                    type="file"
                    id="avatar"
                    accept="image/*"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                    ref={avatarInputRef}
                />
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button type="button" onClick={handleUploadClick} className={classes.uploadBtn}>
                        📤 Upload Avatar
                    </button>
                    <button
                        type="button"
                        onClick={handleGenerateAvatar}
                        disabled={isGenerating}
                        className={classes.generateBtn}
                        style={{
                            background: 'linear-gradient(135deg, #9b59b6, #8e44ad)',
                            border: '2px solid #9b59b6',
                            color: 'white',
                            padding: '0.75rem 1.5rem',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            fontWeight: 'bold',
                            transition: 'all 0.3s ease',
                            boxShadow: '0 4px 12px rgba(155, 89, 182, 0.3)'
                        }}
                        onMouseEnter={(e) => {
                            e.target.style.transform = 'translateY(-2px)';
                            e.target.style.boxShadow = '0 6px 16px rgba(155, 89, 182, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                            e.target.style.transform = 'translateY(0)';
                            e.target.style.boxShadow = '0 4px 12px rgba(155, 89, 182, 0.3)';
                        }}
                    >
                        {isGenerating ? '⏳ Generating...' : '🎨 Generate AI Avatar'}
                    </button>
                </div>
            </div>

            <div className={classes.quickStats}>
                <div className={classes.statBox}>
                    <span className={classes.statLabel}>
                        <span className={classes.coinIcon}></span>
                        Coins
                    </span>
                    <span className={classes.statValue}>{playerObj.coins || 'N/A'}</span>
                </div>
                <div className={classes.statBox}>
                    <span className={classes.statLabel}>⭐ Score</span>
                    <span className={classes.statValue}>{playerObj.score}</span>
                </div>
            </div>

            {isLoading && (
                <div className={classes.statsSection}>
                    <h3 className={classes.sectionTitle}>📊 Statistics</h3>
                    <div className={classes.statsGrid}>
                        <div className={classes.statItem}>
                            <span className={classes.label}>🏆 Wins:</span>
                            <span className={classes.value}>
                                {playerObj.gamesPlayed.heroes3.total - playerObj.gamesPlayed.heroes3.lose}
                            </span>
                        </div>
                        <div className={classes.statItem}>
                            <span className={classes.label}>❌ Losses:</span>
                            <span className={classes.value}>{playerObj.gamesPlayed.heroes3.lose}</span>
                        </div>
                        <div className={classes.statItem}>
                            <span className={classes.label}>🎮 Total Games:</span>
                            <span className={classes.value}>{playerObj.gamesPlayed.heroes3.total}</span>
                        </div>
                        <div className={classes.statItem}>
                            <span className={classes.label}>📈 Rating:</span>
                            <span className={classes.value}>
                                {playerObj.ratings
                                    ? Number(
                                          playerObj.ratings
                                              .split(',')
                                              .map((r) => r.trim())
                                              .filter(Boolean)
                                              .pop()
                                      ).toFixed(2)
                                    : 'N/A'}
                            </span>
                        </div>
                        <div className={classes.statItem}>
                            <span className={classes.label}>⭐ Stars:</span>
                            <span className={classes.value}>{playerObj.stars}</span>
                        </div>
                        <div className={classes.statItem}>
                            <span className={classes.label}>💰 Total Winnings:</span>
                            <span className={classes.value}>${playerObj.totalPrize || '0'}</span>
                        </div>
                    </div>

                    <div className={classes.prizesSection}>
                        <h3 className={classes.sectionTitle}>🏆 Tournament Prizes</h3>
                        {Array.isArray(playerObj.prizes) && playerObj.prizes.length > 0 ? (
                            <ul className={classes.prizesList}>
                                {[...playerObj.prizes].reverse().map((prize, idx) => (
                                    <li key={idx} className={classes.prizeItem}>
                                        <span className={classes.tournamentName}>{prize.tournamentName}</span>
                                        <span className={classes.prizePlace}>{prize.place} place</span>
                                        <span className={classes.prizeAmount}>${prize.prizeAmount}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className={classes.noPrizes}>No prizes yet</p>
                        )}
                    </div>

                    <div className={classes.socialSection}>
                        <h3 className={classes.sectionTitle}>🌐 Social Links</h3>
                        <div className={classes.socialGrid}>
                            <div className={classes.socialItem}>
                                <span className={classes.socialLabel}>📺 Twitch:</span>
                                <span className={classes.socialValue}>{playerObj.twitch || 'N/A'}</span>
                            </div>
                            <div className={classes.socialItem}>
                                <span className={classes.socialLabel}>🎥 Youtube:</span>
                                <span className={classes.socialValue}>{playerObj.youtube || 'N/A'}</span>
                            </div>
                            <div className={classes.socialItem}>
                                <span className={classes.socialLabel}>💬 Telegram:</span>
                                <span className={classes.socialValue}>{playerObj.telegram || 'N/A'}</span>
                            </div>
                            <div className={classes.socialItem}>
                                <span className={classes.socialLabel}>🎮 Discord:</span>
                                <span className={classes.socialValue}>{playerObj.discord || 'N/A'}</span>
                            </div>
                        </div>
                    </div>

                    <div className={classes.infoSection}>
                        <p className={classes.infoItem}>
                            <span className={classes.infoLabel}>📅 Last login:</span>
                            <span className={classes.infoValue}>{playerObj.lastLoginDate || 'N/A'}</span>
                        </p>
                    </div>
                </div>
            )}

            <form className={classes.passwordForm} onSubmit={submitHandler}>
                <h3 className={classes.formTitle}>🔒 Change Password</h3>
                <div className={classes.formControl}>
                    <label htmlFor="new-password">🔑 New Password</label>
                    <input
                        type="password"
                        id="new-password"
                        ref={newPasswordInsertedRef}
                        placeholder="Enter new password"
                    />
                </div>
                <div className={classes.formAction}>
                    <button type="submit" className={classes.submitBtn}>
                        🔄 Change Password
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ProfileForm;
