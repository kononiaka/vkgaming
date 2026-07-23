import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import 'flag-icons/css/flag-icons.min.css';
import './index.css';
import { AuthContextProvider } from './store/auth-context';
import { shouldHandleOAuthCallback } from './utils/appBasePath';

const ensureHashRoute = () => {
    if (shouldHandleOAuthCallback()) {
        return;
    }

    if (!window.location.hash || window.location.hash === '#') {
        window.location.replace(`${window.location.pathname}${window.location.search}#/`);
    }
};

ensureHashRoute();

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
    <AuthContextProvider>
        <HashRouter>
            <App />
        </HashRouter>
    </AuthContextProvider>
);
