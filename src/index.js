import React from 'react';
import ReactDOM from 'react-dom';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { AuthContextProvider } from './store/auth-context';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <AuthContextProvider>
    <HashRouter >
      <App />
    </HashRouter>
  </AuthContextProvider>,
  document.getElementById('root')
);