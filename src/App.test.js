import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import AuthContext from './store/auth-context';

jest.mock('./utils/appBasePath', () => ({
    shouldHandleTwitchOAuth: () => false
}));

jest.mock('./components/StartingPage/StartingPageContent', () => () => <div>Konoplay home</div>);

const authValue = {
    token: '',
    isLogged: false,
    login: jest.fn(),
    logout: jest.fn(),
    updateUserNickName: jest.fn(),
    notificationShown: false,
    message: '',
    notificationStatus: '',
    countdown: 0,
    setNotificationShown: jest.fn(),
    setNotificationMessage: jest.fn(),
    isAdmin: false,
    setIsAdmin: jest.fn()
};

test('renders app shell on home route', () => {
    render(
        <AuthContext.Provider value={authValue}>
            <MemoryRouter initialEntries={['/']}>
                <App />
            </MemoryRouter>
        </AuthContext.Provider>
    );

    expect(screen.getByText('Konoplay home')).toBeInTheDocument();
});
