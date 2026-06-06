import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import 'flag-icons/css/flag-icons.min.css';
import './index.css';
import { AuthContextProvider } from './store/auth-context';

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
    <AuthContextProvider>
        <HashRouter>
            <App />
        </HashRouter>
    </AuthContextProvider>
);
