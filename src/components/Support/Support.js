import { useContext, useState } from 'react';
import { Link } from 'react-router-dom';
import AuthContext from '../../store/auth-context';

import DonationLeaderboard from '../DonationLeaderboard/DonationLeaderboard';
import classes from './Support.module.css';

import { FIREBASE_FUNCTIONS_BASE } from '../../config/firebase';

const STRIPE_FUNCTION_URL = `${FIREBASE_FUNCTIONS_BASE}/createStripeCheckout`;
const MIN_STRIPE_DONATION_USD = 5;

const Support = () => {
    const authCtx = useContext(AuthContext);
    const [stripeAmount, setStripeAmount] = useState('10');
    const [stripeLoading, setStripeLoading] = useState(false);
    const [loginPrompt, setLoginPrompt] = useState(false);

    const handleStripe = async (amount) => {
        const parsedAmount = Number(amount);
        if (!Number.isFinite(parsedAmount) || parsedAmount < MIN_STRIPE_DONATION_USD) {
            authCtx.setNotificationShown(
                true,
                `Minimum card donation is $${MIN_STRIPE_DONATION_USD}. Use Donation Alerts for smaller amounts.`,
                'warning',
                5
            );
            return;
        }

        if (!authCtx.isLogged) {
            setLoginPrompt(true);
            return;
        }

        const token = localStorage.getItem('token');
        let userId;
        try {
            userId = JSON.parse(atob(token.split('.')[1])).user_id;
        } catch {
            alert('Session error. Please log out and log in again.');
            return;
        }
        if (!userId) {
            alert('Could not identify your account. Please log out and log in again.');
            return;
        }

        setStripeLoading(true);
        const stripeWindow = window.open('', '_blank');
        try {
            const res = await fetch(STRIPE_FUNCTION_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: parsedAmount,
                    userId,
                    nickname: authCtx.userNickName,
                    origin: window.location.origin
                })
            });
            const data = await res.json();
            if (!res.ok || !data.url) {
                stripeWindow.close();
                console.error('Stripe function error:', data);
                alert('Payment error: ' + (data.error || 'Unknown error. Check console.'));
                return;
            }
            stripeWindow.location.href = data.url;
        } catch (err) {
            stripeWindow.close();
            console.error('Stripe error:', err);
            alert('Failed to open payment. Please try again.');
        } finally {
            setStripeLoading(false);
        }
    };

    const handleStripeSubmit = (event) => {
        event.preventDefault();
        handleStripe(stripeAmount);
    };

    const requireLogin = (event) => {
        if (!authCtx.isLogged) {
            event.preventDefault();
            setLoginPrompt(true);
        }
    };

    return (
        <div className={`${classes.wrapper} data-page`}>
            <header className={classes.pageHeader}>
                <div>
                    <h1 className={classes.pageTitle}>Support</h1>
                    <p className={classes.pageSubtitle}>
                        Back the project and fund live tournament prize pools.
                    </p>
                </div>
            </header>

            <section className={classes.infoPanel}>
                <p className={classes.infoLead}>
                    <strong>90%</strong> of donations go to tournament prize pools.{' '}
                    <strong>10%</strong> supports platform development.
                </p>
                <p className={classes.infoDetail}>
                    Donations are tracked on your account after payment via both providers.
                </p>
                {authCtx.isLogged && authCtx.userNickName && (
                    <p className={classes.accountLine}>
                        Your account: <strong>{authCtx.userNickName}</strong>
                    </p>
                )}
                {!authCtx.isLogged && (
                    <p className={classes.loginHint}>
                        <Link to="/auth">Log in</Link> first so we know which account to credit.
                    </p>
                )}
            </section>

            {loginPrompt && (
                <div className={classes.loginBanner} role="alert">
                    <span>
                        Please <Link to="/auth">log in</Link> first to donate.
                    </span>
                    <button
                        type="button"
                        className={classes.loginBannerClose}
                        onClick={() => setLoginPrompt(false)}
                        aria-label="Dismiss"
                    >
                        ×
                    </button>
                </div>
            )}

            <section className={classes.section}>
                <DonationLeaderboard variant="panel" limit={10} showFooter={false} />
            </section>

            <section className={classes.section}>
                <h2 className={classes.sectionTitle}>Donation Alerts</h2>
                <p className={classes.sectionNote}>
                    Donate any amount — matched by your Donation Alerts username set in your{' '}
                    <Link to="/profile">Profile</Link>.
                </p>
                <div className={classes.actionRow}>
                    <a
                        href="https://www.donationalerts.com/r/konoplay"
                        target="_blank"
                        rel="noreferrer"
                        className={classes.primaryBtn}
                        onClick={requireLogin}
                    >
                        Open Donation Alerts
                    </a>
                </div>
            </section>

            <section className={classes.section}>
                <h2 className={classes.sectionTitle}>Card (Stripe)</h2>
                <p className={classes.sectionNote}>
                    Visa, Mastercard, Apple Pay, Google Pay, and BLIK. Enter any amount — minimum $
                    {MIN_STRIPE_DONATION_USD} via card.
                </p>
                <form className={classes.stripeForm} onSubmit={handleStripeSubmit}>
                    <label className={classes.amountLabel} htmlFor="stripeDonationAmount">
                        Amount (USD)
                    </label>
                    <div className={classes.stripeRow}>
                        <div className={classes.amountField}>
                            <span className={classes.amountPrefix}>$</span>
                            <input
                                id="stripeDonationAmount"
                                className={classes.amountInput}
                                type="number"
                                min={MIN_STRIPE_DONATION_USD}
                                step="1"
                                value={stripeAmount}
                                onChange={(event) => setStripeAmount(event.target.value)}
                                disabled={stripeLoading}
                            />
                        </div>
                        <button type="submit" className={classes.primaryBtn} disabled={stripeLoading}>
                            {stripeLoading ? 'Opening checkout…' : 'Pay with card'}
                        </button>
                    </div>
                </form>
                <p className={classes.footnote}>For smaller amounts, use Donation Alerts.</p>
            </section>

            <section className={classes.section}>
                <h2 className={classes.sectionTitle}>Other</h2>
                <p className={classes.sectionNote}>Direct transfer via MonoBank.</p>
                <div className={classes.actionRow}>
                    <a
                        href="https://send.monobank.ua/jar/834ApdUfdC"
                        target="_blank"
                        rel="noreferrer"
                        className={classes.secondaryBtn}
                    >
                        Donate via MonoBank
                    </a>
                </div>
            </section>

            <p className={classes.studioCredit}>
                Ideas or feedback? Email{' '}
                <a href="mailto:kononiaka.vladimir@gmail.com">kononiaka.vladimir@gmail.com</a>
                {' '}or visit{' '}
                <a
                    href="https://www.facebook.com/groups/grafwebstudio"
                    target="_blank"
                    rel="noreferrer"
                >
                    Graf Studio
                </a>
                .
            </p>
        </div>
    );
};

export default Support;
