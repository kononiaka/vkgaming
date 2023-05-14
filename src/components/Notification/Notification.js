import { useState, useEffect } from 'react';
import classes from './Notification.module.css';

const Notification = ({ message, type }) => {
    const [show, setShow] = useState(true);

    console.log('Notification mounted', show);

    const handleClose = () => {
        setShow(false);
    };

    useEffect(() => {
        return () => {
            console.log('Notification unmounted', show);
        };
    }, []);


    return (
        show && (
            <div className={`${classes['custom-notification']} ${classes[`custom-notification-${type}`]}`}>
                <span>{message}</span>
                <button className={classes['close-button']} onClick={handleClose}>
                    X
                </button>
            </div>
        )
    );
};

export default Notification;