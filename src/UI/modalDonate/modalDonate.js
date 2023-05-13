import Modal from '../Modal/Modal';

import classes from './modalDonate.module.css';

const ModalDonate = (props) => {
    return (
        <Modal onClick={props.onClose} donate={props.donate}>
            <p><b >Would you like to support the project?</b> </p>
            <p style={{ textAlign: 'center' }}><b >Scan QR code:</b> </p> <br />
            <div className={classes.donate_logo_block}>
                <div className={classes.donate_logo}></div>
            </div>
            <div className={classes.donate_logo_block} >
                <a href="https://send.monobank.ua/jar/834ApdUfdC" target="_blank">Donate</a>
            </div>
        </Modal>
    );
};

export default ModalDonate;