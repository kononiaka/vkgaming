import React, { Fragment } from 'react';

// import { useMediaQuery } from 'react-responsive';

import classes from './Modal.module.css';

const Modal = (props) => {
    const Backdrop = () => <div className={classes.backdrop} onClick={props.onClick}></div>;

    const ModalOverlay = (propsOverlay) => {
        if (propsOverlay.graf) {
            return <div className={classes.modal_graf}>{propsOverlay.children}</div>;
        }
        if (propsOverlay.donate) {
            return <div className={classes.modal_donate}>{propsOverlay.children}</div>;
        }
        if (propsOverlay.addGame || propsOverlay.addTournament) {
            return <div className={classes.modal_addGame}>{propsOverlay.children}</div>;
        }
        return <div className={classes.modal}>{propsOverlay.children}</div>;
    };

    return (
        <Fragment>
            <Backdrop />
            <ModalOverlay
                // onSubmit={props.onSubmit} onEnroll={props.onEnroll}
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
};

export default Modal;
