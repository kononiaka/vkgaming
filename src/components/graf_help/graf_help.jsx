import Modal from '../../UI/Modal/Modal';

import classes from './modalGraf.module.css';

const GrafHelp = (props) => (
    <Modal onClick={props.onClose} graf={props.graf}>
        <p>
            <b>Have any ideas how to make this website better?</b> <br /> Email Now:
        </p>
        <div>
            <div className={classes.email_logo}>
                <a href="mailto:kononiaka.vladimir@gmail.com">kononiaka.vladimir@gmail.com</a>
            </div>
        </div>
        <p>or visit our Facebook Group Page</p>
        <div className={classes.phone_logo_block}>
            <div className={classes.phone_logo}>
                <a target="_blank" href="https://www.facebook.com/groups/grafwebstudio">
                    Graf_Studio
                </a>
            </div>
        </div>
    </Modal>
);

export default GrafHelp;
