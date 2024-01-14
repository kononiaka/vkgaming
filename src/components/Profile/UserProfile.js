import ProfileForm from './ProfileForm';
import classes from './UserProfile.module.css';

const UserProfile = () => (
    <section className={classes.profile}>
        <h1>Your User Profile</h1>
        <ProfileForm />
    </section>
);

export default UserProfile;
