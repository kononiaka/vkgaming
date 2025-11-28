import { useContext, useEffect, useState } from 'react';
import classes from './Notification.module.css';
import AuthContext from '../../store/auth-context';

const Notification = () => {
    const authCtx = useContext(AuthContext);
    const { notificationShown, message, status, countdown, setNotificationShown } = authCtx;
    const [show, setShow] = useState(notificationShown);

    useEffect(() => {
        setShow(notificationShown);
    }, [notificationShown]);

    const handleClose = () => {
        setShow(false);
        setNotificationShown(false, '', '', 0);
    };

    if (!show || !message) return null;

    return (
        <div className={`${classes['notification-box']} ${classes[status]}`}>
            <div className={classes.iconWrapper}>
                {status === 'success' && <span className={classes.icon}>✔️</span>}
                {status === 'error' && <span className={classes.icon}>❌</span>}
                {status === 'warning' && <span className={classes.icon}>⚠️</span>}
            </div>
            <div className={classes.content}>
                <span className={classes.message}>{message}</span>
                {countdown > 0 && <span className={classes.countdown}>(closing in {countdown}s)</span>}
            </div>
            <button className={classes['notification-close']} onClick={handleClose}>
                ✖
            </button>
        </div>
    );
};

export default Notification;
