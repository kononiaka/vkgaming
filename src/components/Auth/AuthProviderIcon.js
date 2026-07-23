import { resolveAuthProvider } from '../../utils/authProvider';
import classes from './AuthProviderIcon.module.css';

const TWITCH_PATH =
    'M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z';

const YOUTUBE_PATH =
    'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z';

const AuthProviderIcon = ({ provider, user, size = 14, className = '' }) => {
    const resolved = provider || resolveAuthProvider(user);

    if (resolved !== 'twitch' && resolved !== 'youtube') {
        return null;
    }

    const isTwitch = resolved === 'twitch';
    const label = isTwitch ? 'Signed up with Twitch' : 'Signed up with YouTube';

    return (
        <span
            className={`${classes.icon} ${isTwitch ? classes.twitch : classes.youtube} ${className}`.trim()}
            title={label}
            aria-label={label}
            role="img"
        >
            <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
                <path d={isTwitch ? TWITCH_PATH : YOUTUBE_PATH} fill="currentColor" />
            </svg>
        </span>
    );
};

export default AuthProviderIcon;
