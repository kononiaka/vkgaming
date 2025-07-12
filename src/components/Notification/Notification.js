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
            <span>{message}</span>
            {countdown > 0 && (
                <span style={{ marginLeft: 10, fontSize: '0.9em', color: '#fff' }}>(closing in {countdown}s)</span>
            )}
            <button className={classes['notification-close']} onClick={handleClose}>
                ×
            </button>
        </div>
    );
};

export default Notification;
