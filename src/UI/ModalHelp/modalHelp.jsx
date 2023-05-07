import Modal from '../Modal/Modal';

import classes from './modalHelp.module.css';

const ModalHelp = (props) => {
    return (
        <Modal onClick={props.onClose}>
            <p><b >Need Help?</b> </p>
            <p style={{ marginBottom: '15px' }}>Reach or Email Now:</p>
            <div className={classes.discord_logo_block}>
                <div className={classes.discord_logo}></div>
                <a href="https://discord.gg/9edXZJZZ" target="_blank">Contact us in Discord</a>

            </div>
            <div className={classes.tg_logo_block}>
                <div className={classes.tg_logo}></div>
                <a href="https://t.me/vkgamingplay" target="_blank">Contact us in Telegram</a>
            </div>
            <div className={classes.youtube_logo_block}>
                <div className={classes.youtube_logo}></div>
                <a href="https://www.youtube.com/channel/UCtATty8dW9ryDyrICQ63aqQ" target="_blank">Follow us on YouTube</a>
            </div>
        </Modal>
    );
};

export default ModalHelp;