import Modal from '../Modal/Modal';

import classes from './modalHelp.module.css';

const ModalHelp = (props) => {
    return (
        <Modal onClick={props.onClose}>
            <p><b>Need Help?</b> Reach or Email Now:</p>
            <div>
                <div className={classes.email_logo}>
                    <a href="mailto:kononiaka.vladimir@gmail.com">kononiaka.vladimir@gmail.com</a>
                </div>
            </div>
            <div className={classes.tg_logo_block}>
                <div className={classes.tg_logo}></div>
                <a href="https://t.me/vkgamingplay" target="_blank">Concact us in Telegram</a>
            </div>
            <div className={classes.youtube_logo_block}>
                <div className={classes.youtube_logo}></div>
                <a href="https://www.youtube.com/channel/UCtATty8dW9ryDyrICQ63aqQ" target="_blank">Follow us on YouTube</a>
            </div>
        </Modal>
    );
};

export default ModalHelp;