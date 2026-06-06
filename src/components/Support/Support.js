import { useContext, useState } from 'react';
import { Link } from 'react-router-dom';
import AuthContext from '../../store/auth-context';

import DonationLeaderboard from '../DonationLeaderboard/DonationLeaderboard';
import classes from './Support.module.css';

import { FIREBASE_FUNCTIONS_BASE } from '../../config/firebase';

const STRIPE_FUNCTION_URL = `${FIREBASE_FUNCTIONS_BASE}/createStripeCheckout`;

const donationTiers = [
    { amount: 5, coins: 10, label: 'Champion', tierClass: 'tierChampion' },
    { amount: 10, coins: 25, label: 'Legend', tierClass: 'tierLegend' }
];

const Support = () => {
    const authCtx = useContext(AuthContext);
    const [stripeLoading, setStripeLoading] = useState(null);
    const [loginPrompt, setLoginPrompt] = useState(false);

    const handleStripe = async (amount) => {
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

        setStripeLoading(amount);
        const stripeWindow = window.open('', '_blank');
        try {
            const res = await fetch(STRIPE_FUNCTION_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount,
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
            setStripeLoading(null);
        }
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
                        Back the project, fund prize pools, and earn coins for your account.
                    </p>
                </div>
            </header>

            <section className={classes.infoPanel}>
                <p className={classes.infoLead}>
                    <strong>80%</strong> of donations go to tournament prize pools.{' '}
                    <strong>20%</strong> supports platform development.
                </p>
                <p className={classes.infoDetail}>
                    Coins are credited automatically after payment via both providers.
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
                        Please <Link to="/auth">log in</Link> first to donate and receive coins.
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
                    Donate any amount — coins are matched by your Donation Alerts username set in your{' '}
                    <Link to="/profile">Profile</Link>.
                </p>
                <p className={classes.coinTable}>
                    Coin conversion: $1 = 2 coins · $3 = 5 coins · $5 = 10 coins · $10 = 25 coins
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
                    Visa, Mastercard, Apple Pay, Google Pay, and BLIK. Minimum $5 via card.
                </p>
                <div className={classes.tierGrid}>
                    {donationTiers.map((tier) => (
                        <button
                            key={tier.amount}
                            type="button"
                            className={classes.tierBtn}
                            onClick={() => handleStripe(tier.amount)}
                            disabled={stripeLoading !== null}
                        >
                            <div className={`${classes.tierCard} ${classes[tier.tierClass]}`}>
                                <div className={classes.tierHeader}>
                                    <span className={classes.tierLabel}>{tier.label}</span>
                                    <span className={classes.tierAmount}>${tier.amount}</span>
                                </div>
                                <div className={classes.tierBody}>
                                    <span className={classes.tierCoins}>
                                        {stripeLoading === tier.amount
                                            ? 'Opening checkout…'
                                            : `+${tier.coins} coins`}
                                    </span>
                                    {stripeLoading !== tier.amount && (
                                        <span className={classes.tierPay}>Pay with card</span>
                                    )}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
                <p className={classes.footnote}>For smaller amounts, use Donation Alerts.</p>
            </section>

            <section className={classes.section}>
                <h2 className={classes.sectionTitle}>Other</h2>
                <p className={classes.sectionNote}>Direct transfer — no coins are awarded.</p>
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
