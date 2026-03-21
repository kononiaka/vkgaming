import { useContext } from 'react';
import ProfileForm from './ProfileForm';
import AdminPanel from '../AdminPanel/AdminPanel';
import AuthContext from '../../store/auth-context';
import classes from './UserProfile.module.css';

const UserProfile = () => {
    const authCtx = useContext(AuthContext);

    return (
        <section className={classes.profile}>
            <h1 className={classes.header}>👤 Your User Profile</h1>
            {authCtx.userNickName && (
                <div className={classes.nicknameDisplay}>
                    <span className={classes.nicknameLabel}>Nickname:</span>
                    <span className={classes.nicknameName}>{authCtx.userNickName}</span>
                </div>
            )}
            <ProfileForm />
            {authCtx.isAdmin && <AdminPanel />}
        </section>
    );
};

export default UserProfile;
