import { FIREBASE_DATABASE_URL } from '../../config/firebase';
import { useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAvatar, updateAvatar } from '../../api/api';
import AuthContext from '../../store/auth-context';
import { authFetch } from '../../api/authFetch';
import { deleteAccount } from '../../api/deleteAccount';
import LobbyNicknameField from './LobbyNicknameField';
import CountryField from './CountryField';
import TelegramNotificationsSection from './TelegramNotificationsSection';

import classes from './ProfileForm.module.css';

const ProfileForm = ({ userId: userIdProp, embedded = false, onAvatarUpdated }) => {
    const avatarInputRef = useRef();

    const authCtx = useContext(AuthContext);
    const [userId, setUserId] = useState(userIdProp || '');
    const [player, setPlayer] = useState(null);
    const [avatarBase64, setAvatarBase64] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [daUsername, setDaUsername] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const userNickName = authCtx.userNickName || localStorage.getItem('userName');
    const isOwnProfile = !!player && userNickName === player.enteredNickname;

    useEffect(() => {
        if (userIdProp) {
            setUserId(userIdProp);
        }
    }, [userIdProp]);

    useEffect(() => {
        if (!userNickName && !userId) {
            return;
        }

        const fetchPlayer = async () => {
            try {
                let resolvedId = userIdProp || userId;
                let playerData = null;

                if (resolvedId) {
                    const response = await fetch(`${FIREBASE_DATABASE_URL}/users/${resolvedId}.json`);
                    if (response.ok) {
                        playerData = await response.json();
                    }
                } else {
                    const response = await fetch(`${FIREBASE_DATABASE_URL}/users.json`);
                    if (!response.ok) {
                        throw new Error('Unable to fetch data from the server.');
                    }
                    const data = await response.json();
                    const entry = Object.entries(data).find(([, p]) => p.enteredNickname === userNickName);
                    if (entry) {
                        resolvedId = entry[0];
                        playerData = entry[1];
                    }
                }

                if (!resolvedId || !playerData) {
                    setPlayer(null);
                    return;
                }

                setUserId(resolvedId);
                setPlayer(playerData);
                setDaUsername(playerData.daUsername || '');

                try {
                    const avatar = await getAvatar(resolvedId);
                    setAvatarBase64(avatar);
                } catch (_) {
                    setAvatarBase64('');
                }
            } catch (error) {
                console.error(error);
            }
        };

        fetchPlayer();
    }, [userNickName, userId, userIdProp]);

    const navigate = useNavigate();

    const handleFileChange = (event) => {
        const selectedFile = event.target.files[0];
        if (!selectedFile || selectedFile.size > 200 * 1024) {
            alert('File size exceeds the limit of 200KB. Please select a smaller file.');
            return;
        }

        const reader = new FileReader();
        reader.onload = async () => {
            const base64 = reader.result;
            setAvatarBase64(base64);

            const userRes = await fetch(`${FIREBASE_DATABASE_URL}/users/${userId}.json`);
            const userData = await userRes.json();
            const hadNoAvatar = !userData.avatar;

            await updateAvatar(userId, base64);
            onAvatarUpdated?.();

            if (hadNoAvatar) {
                authCtx.setNotificationShown(true, 'Avatar saved.', 'success', 4);
            }
        };
        reader.readAsDataURL(selectedFile);
    };

    const handleUploadClick = () => {
        avatarInputRef.current?.click();
    };

    const handleGenerateAvatar = async () => {
        setIsGenerating(true);
        try {
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

            const characterClasses = Object.keys(avatarStyles);
            const randomClass = characterClasses[Math.floor(Math.random() * characterClasses.length)];
            const config = avatarStyles[randomClass];
            const seed = `${randomClass}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const imageUrl = `https://api.dicebear.com/7.x/${config.style}/svg?seed=${seed}&backgroundColor=${config.backgroundColor}&size=256`;

            const imageResponse = await fetch(imageUrl);
            const svgText = await imageResponse.text();
            const base64 = `data:image/svg+xml,${encodeURIComponent(svgText)}`;
            setAvatarBase64(base64);

            const userRes = await fetch(`${FIREBASE_DATABASE_URL}/users/${userId}.json`);
            const userData = await userRes.json();
            const hadNoAvatar = !userData.avatar;

            await updateAvatar(userId, base64);
            onAvatarUpdated?.();

            if (hadNoAvatar) {
                authCtx.setNotificationShown(true, 'Avatar saved.', 'success', 4);
            } else {
                authCtx.setNotificationShown(true, 'Avatar updated.', 'success', 3);
            }
        } catch (error) {
            console.error('Generation error:', error);
            authCtx.setNotificationShown(true, 'Avatar generation failed. Please try again.', 'error', 5);
        } finally {
            setIsGenerating(false);
        }
    };

    const saveDaUsername = async () => {
        try {
            await authFetch(`${FIREBASE_DATABASE_URL}/users/${userId}.json`, {
                method: 'PATCH',
                body: JSON.stringify({ daUsername: daUsername.trim() }),
                headers: { 'Content-Type': 'application/json' }
            });
            authCtx.setNotificationShown(true, 'Donation Alerts username saved.', 'success', 3);
        } catch (err) {
            authCtx.setNotificationShown(true, 'Failed to save DA username.', 'error', 5);
        }
    };

    const handleDeleteAccount = async () => {
        if (!player?.enteredNickname) {
            return;
        }

        if (deleteConfirm !== player.enteredNickname) {
            authCtx.setNotificationShown(
                true,
                'Type your exact konoplay nickname to confirm deletion.',
                'error',
                5
            );
            return;
        }

        const confirmed = window.confirm(
            'Delete your account permanently? This removes your profile and sign-in. Tournament history may still show your past nickname. This cannot be undone.'
        );
        if (!confirmed) {
            return;
        }

        setIsDeleting(true);
        try {
            await deleteAccount(player.enteredNickname);
            authCtx.logout();
            authCtx.setNotificationShown(true, 'Your account has been deleted.', 'success', 5);
            navigate('/');
        } catch (error) {
            authCtx.setNotificationShown(true, error.message || 'Account deletion failed.', 'error', 7);
        } finally {
            setIsDeleting(false);
        }
    };

    if (!player) {
        return <p className={classes.loading}>Loading settings...</p>;
    }

    return (
        <div className={`${classes.formRoot} ${embedded ? classes.embedded : ''}`}>
            {!embedded && (
                <div className={classes.avatarRow}>
                    {avatarBase64 ? (
                        <img src={avatarBase64} alt="Your avatar" className={classes.avatar} />
                    ) : (
                        <div className={classes.avatarFallback}>
                            {player.enteredNickname?.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div className={classes.avatarActions}>
                        <p className={classes.avatarHint}>Avatar (max 200KB).</p>
                        <input
                            type="file"
                            id="avatar"
                            accept="image/*"
                            onChange={handleFileChange}
                            className={classes.hiddenInput}
                            ref={avatarInputRef}
                        />
                        <div className={classes.buttonRow}>
                            <button type="button" onClick={handleUploadClick} className={classes.secondaryBtn}>
                                Upload avatar
                            </button>
                            <button
                                type="button"
                                onClick={handleGenerateAvatar}
                                disabled={isGenerating}
                                className={classes.secondaryBtn}
                            >
                                {isGenerating ? 'Generating…' : 'Generate avatar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {embedded && (
                <div className={classes.embeddedAvatarActions}>
                    <p className={classes.avatarHint}>Avatar (max 200KB).</p>
                    <input
                        type="file"
                        id="avatar"
                        accept="image/*"
                        onChange={handleFileChange}
                        className={classes.hiddenInput}
                        ref={avatarInputRef}
                    />
                    <div className={classes.buttonRow}>
                        <button type="button" onClick={handleUploadClick} className={classes.secondaryBtn}>
                            Upload avatar
                        </button>
                        <button
                            type="button"
                            onClick={handleGenerateAvatar}
                            disabled={isGenerating}
                            className={classes.secondaryBtn}
                        >
                            {isGenerating ? 'Generating…' : 'Generate avatar'}
                        </button>
                    </div>
                </div>
            )}

            {isOwnProfile && !embedded && (
                <div className={classes.formPanel}>
                    <LobbyNicknameField
                        userId={userId}
                        nickname={player.enteredNickname}
                        onSaved={(nextNickname) =>
                            setPlayer((prev) => (prev ? { ...prev, enteredNickname: nextNickname } : prev))
                        }
                    />
                    <CountryField
                        userId={userId}
                        countryCode={player.countryCode}
                        countryCodeSource={player.countryCodeSource}
                        onSaved={(countryUpdate) =>
                            setPlayer((prev) => (prev ? { ...prev, ...countryUpdate } : prev))
                        }
                    />
                </div>
            )}

            {embedded && isOwnProfile && (
                <>
                    <p className={classes.lobbyNickHint}>
                        Edit your lobby nickname in the profile card above. It must match your in-game Heroes III lobby
                        name for cups and match reporting.
                    </p>
                    <div className={classes.formPanel}>
                        <CountryField
                            userId={userId}
                            countryCode={player.countryCode}
                            countryCodeSource={player.countryCodeSource}
                            onSaved={(countryUpdate) =>
                                setPlayer((prev) => (prev ? { ...prev, ...countryUpdate } : prev))
                            }
                        />
                    </div>
                </>
            )}

            {isOwnProfile && (
                <div className={classes.formPanel}>
                    <TelegramNotificationsSection userId={userId} authCtx={authCtx} />
                </div>
            )}

            <div className={classes.formPanel}>
                <h4 className={classes.panelTitle}>Donation Alerts</h4>
                <p className={classes.panelNote}>
                    Link your Donation Alerts username so donations are matched to your account.
                </p>
                <div className={classes.formControl}>
                    <label htmlFor="da-username">DA username</label>
                    <input
                        type="text"
                        id="da-username"
                        value={daUsername}
                        onChange={(e) => setDaUsername(e.target.value)}
                        placeholder="e.g. CondorAwful"
                    />
                </div>
                <button type="button" onClick={saveDaUsername} className={classes.primaryBtn}>
                    Save DA username
                </button>
            </div>

            {isOwnProfile && (
                <div className={classes.dangerPanel}>
                    <h4 className={classes.dangerTitle}>Delete account</h4>
                    <p className={classes.panelNote}>
                        Permanently delete your konoplay account and sign-in. You will be removed from
                        open tournaments. Finished cup results may still list your past nickname.
                    </p>
                    <div className={classes.formControl}>
                        <label htmlFor="delete-confirm">Type your nickname to confirm</label>
                        <input
                            type="text"
                            id="delete-confirm"
                            value={deleteConfirm}
                            onChange={(e) => setDeleteConfirm(e.target.value)}
                            placeholder={player.enteredNickname}
                            autoComplete="off"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={handleDeleteAccount}
                        disabled={isDeleting || deleteConfirm !== player.enteredNickname}
                        className={classes.dangerBtn}
                    >
                        {isDeleting ? 'Deleting…' : 'Delete my account'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default ProfileForm;
