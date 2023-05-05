import Modal from '../Modal/Modal';

import classes from './modalHelp.module.css';

const ModalHelp = (props) => {
    return (
        <Modal onClick={props.onClose}>
            <p><b>Need Help?</b> Call or Email Now:</p>
            <div>
                <div className={classes.email_logo}>
                    <a href="mailto:kononiaka.vladimir@gmail.com">kononiaka.vladimir@gmail.com</a>
                </div>
            </div>
            {/* <div className={classes.phone_logo_block}>
                <div className={classes.phone_logo}>
                    <a href="tel:+380734940031">+380734940031</a>
                </div>
            </div> */}
            <div className={classes.tg_logo_block}>
                <div className={classes.tg_logo}></div>
                <a href="https://t.me/+STA5EJb4W6M5ZDcy" target="_blank">Concact us in Telegram</a>
            </div>
            {/* <div className={classes.viber_logo_block}>
                <div className={classes.viber_logo}></div>
                <a href="viber://chat?number=%2B380734940031" target="_blank">Concact us in Viber</a>
            </div>
            <div className={classes.whatsapp_logo_block}>
                <div className={classes.whatsapp_logo}></div>
                <a href="https://wa.me/80734940031" target="_blank">Concact us in WhatsApp</a>
            </div> */}
        </Modal>
    );
};

export default ModalHelp;