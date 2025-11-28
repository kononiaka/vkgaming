import Modal from '../Modal/Modal';

import classes from './modalDonate.module.css';

const ModalDonate = (props) => (
    <Modal onClick={props.onClose} donate={props.donate}>
        <div className={classes.donate_block}>
            <p>
                <b>Would you like to support the project? 💎</b>
            </p>
            <div className={classes.question}>
                <span className={classes.tooltip}>
                    <p>
                        Get ready to take your gaming experience to the next level! 🎮
                        <br />
                        <br />
                        When you donate 💰 <strong>80%</strong> of your contribution will go towards the prize pool for
                        our gaming tournaments, making the competition even more exciting and rewarding for our players.
                        🏆
                        <br />
                        <br />
                        Your support is greatly appreciated and will help us continue to provide an unforgettable gaming
                        experience. Thank you in advance for your generosity!
                    </p>
                </span>
            </div>
        </div>
        <p className={classes.donate_title}>Scan QR code 📱</p>
        <div className={classes.donate_logo_block}>
            <div className={classes.donate_logo}></div>
        </div>
        <div className={classes.donate_logo_block}>
            <a href="https://send.monobank.ua/jar/834ApdUfdC" target="_blank" rel="noreferrer">
                💰 Donate Now
            </a>
        </div>
    </Modal>
);

export default ModalDonate;
