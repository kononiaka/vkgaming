import React, { Fragment } from 'react';

import classes from './Modal.module.css';

const Backdrop = ({ onClick }) => <div className={classes.backdrop} onClick={onClick}></div>;

const ModalOverlay = ({ children, graf, donate, addTournament, addGame }) => {
    if (graf) {
        return <div className={classes.modal_graf}>{children}</div>;
    }
    if (donate) {
        return <div className={classes.modal_donate}>{children}</div>;
    }
    if (addTournament) {
        return <div className={classes.modal_addTournament}>{children}</div>;
    }
    if (addGame) {
        return <div className={classes.modal_addGame}>{children}</div>;
    }
    return <div className={classes.modal}>{children}</div>;
};

const Modal = (props) => (
    <Fragment>
        <Backdrop onClick={props.onClick} />
        <ModalOverlay
            graf={props.graf}
            onCongrats={props.onCongrats}
            donate={props.donate}
            addGame={props.addGame}
            addTournament={props.addTournament}
        >
            {props.children}
        </ModalOverlay>
    </Fragment>
);

export default Modal;
