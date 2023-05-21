import { useState } from 'react';
import classes from './Notification.module.css';

const Notification = ({ message, type }) => {
    const [show, setShow] = useState(true);

    const handleClose = () => {
        setShow(false);
    };

    // useEffect(() => {
    //     return () => {
    //         console.log('Notification unmounted', show);
    //     };
    // }, [show]);

    if (show) {
        return (
            <div className={`${classes['custom-notification']} ${classes[`custom-notification-${type}`]}`}>
                <span>{message}</span>
                <button className={classes['close-button']} onClick={handleClose}>
                    X
                </button>
            </div>
        );
    } else {
        return null;
    }
};

export default Notification;