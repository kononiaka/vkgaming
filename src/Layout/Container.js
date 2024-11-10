import React from 'react';
import PropTypes from 'prop-types';

import classes from './Container.module.css';

const Container = ({ children }) => <div className={classes.container}>{children}</div>;

Container.propTypes = {
    children: PropTypes.node.isRequired
};

export default Container;
