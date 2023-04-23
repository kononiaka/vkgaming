import React, { Fragment } from 'react';

// import { useMediaQuery } from 'react-responsive';

import classes from "./Modal.module.css";

const Modal = (props) => {

    const Backdrop = () => {
        return <div className={classes.backdrop} onClick={props.onClick}></div >;
    };
    const ModalOverlay = (props) => {
        if (props.onSubmit && props.onEnroll && !props.onCongrats) {
            return <div className={classes.submitModalEnroll}>{props.children}</div>;
        }
        if (props.onSubmit && !props.onEnroll) {
            return <div className={classes.submitModal}>{props.children}</div>;
        }
        if (props.graf) {
            return <div className={classes.modal_graf}>{props.children}</div>;
        }
        return <div className={classes.modal}>{props.children}</div>;
    };


    return (
        <Fragment>
            <Backdrop />
            <ModalOverlay onSubmit={props.onSubmit} onEnroll={props.onEnroll} graf={props.graf} onCongrats={props.onCongrats}>{props.children}</ModalOverlay>
        </Fragment>
    );
};

export default Modal;