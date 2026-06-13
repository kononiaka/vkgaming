import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { getAppBasePath } from './utils/appBasePath';
import 'flag-icons/css/flag-icons.min.css';
import './index.css';
import { AuthContextProvider } from './store/auth-context';

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
    <AuthContextProvider>
        <HashRouter basename={getAppBasePath() || undefined}>
            <App />
        </HashRouter>
    </AuthContextProvider>
);
