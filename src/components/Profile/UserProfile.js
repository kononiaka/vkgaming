import { useContext, useEffect, useState } from 'react';
import { FIREBASE_DATABASE_URL } from '../../config/firebase';
import AuthContext from '../../store/auth-context';
import AdminPanel from '../AdminPanel/AdminPanel';
import { PlayerProfileContent } from '../Players/Players';
import ProfileCommentatorRequestsSection from './ProfileCommentatorRequestsSection';
import ProfileForm from './ProfileForm';

const UserProfile = () => {
    const authCtx = useContext(AuthContext);
    const userNickName = authCtx.userNickName || localStorage.getItem('userName') || '';
    const [playerId, setPlayerId] = useState(null);
    const [avatarRefreshKey, setAvatarRefreshKey] = useState(0);

    useEffect(() => {
        if (!userNickName) {
            setPlayerId(null);
            return;
        }

        const resolvePlayerId = async () => {
            try {
                const response = await fetch(`${FIREBASE_DATABASE_URL}/users.json`);
                if (!response.ok) {
                    throw new Error('Unable to fetch user data.');
                }
                const data = await response.json();
                const entry = Object.entries(data).find(([, user]) => user.enteredNickname === userNickName);
                setPlayerId(entry ? entry[0] : null);
            } catch (error) {
                console.error('Error resolving profile id:', error);
                setPlayerId(null);
            }
        };

        resolvePlayerId();
    }, [userNickName]);

    return (
        <>
            <PlayerProfileContent
                playerId={playerId}
                title="Your profile"
                subtitle="Stats, standings, avatar, and account settings."
                loadingMessage="Loading profile..."
                avatarRefreshKey={avatarRefreshKey}
                upcomingMatchesTitle="My upcoming matches"
                attendedTournamentsTitle="My tournaments"
                attendedTournamentsEmptyMessage="You have not joined any tournaments yet."
                settingsSlot={
                    <>
                        <ProfileCommentatorRequestsSection userId={playerId} />
                        <ProfileForm
                            userId={playerId}
                            embedded
                            onAvatarUpdated={() => setAvatarRefreshKey((key) => key + 1)}
                        />
                    </>
                }
            />
            {authCtx.isAdmin && <AdminPanel />}
        </>
    );
};

export default UserProfile;
