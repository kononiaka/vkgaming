import { useContext, useState } from 'react';
import Modal from '../Modal/Modal';
import AuthContext from '../../store/auth-context';

import classes from './modalDonate.module.css';

const STRIPE_FUNCTION_URL = 'https://us-central1-test-prod-app-81915.cloudfunctions.net/createStripeCheckout';

const ModalDonate = (props) => {
    const authCtx = useContext(AuthContext);
    const [stripeLoading, setStripeLoading] = useState(null); // stores the tier amount being processed
    const [loginPrompt, setLoginPrompt] = useState(false);

    const donationTiers = [
        { amount: 1, coins: 2, label: 'Supporter', color: '#4CAF50' },
        { amount: 3, coins: 5, label: 'Contributor', color: '#2196F3' },
        { amount: 5, coins: 10, label: 'Champion', color: '#FF9800' },
        { amount: 10, coins: 25, label: 'Legend', color: '#E91E63' }
    ];

    const handleStripe = async (amount) => {
        if (!authCtx.isLogged) {
            setLoginPrompt(true);
            return;
        }
        // Extract userId from the Firebase ID token (sub claim)
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
        // Open blank window immediately in the click handler to avoid popup blocker
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

    return (
        <Modal onClick={props.onClose} donate={props.donate}>
            <div className={classes.donate_block}>
                <p>
                    <b>Support the Project & Earn Coins! 💎🎮</b>
                </p>
                <p>
                    • 80% of donations go to tournament prize pools 🏆
                    <br />• 20% supports platform development ⚡
                </p>
            </div>

            {/* How coins are credited */}
            <div className={classes.nicknameInstruction}>
                <p>
                    🪙 <strong>Coins are credited automatically</strong> after payment via both providers.
                </p>
                {authCtx.isLogged && authCtx.userNickName && (
                    <p className={classes.yourNickname}>
                        Your account: <strong>{authCtx.userNickName}</strong>
                    </p>
                )}
                {!authCtx.isLogged && (
                    <p className={classes.loginPromptInline}>🔐 Log in first so we know which account to credit.</p>
                )}
            </div>

            {/* Donation Alerts — note + button only */}
            <p className={classes.donate_title}>🎯 via Donation Alerts</p>
            <p className={classes.customNote}>
                Donate any amount — coins are matched by your DA username set in your Profile.
            </p>
            <p className={classes.coinConversionHint}>
                💡 Coin conversion: $1 = 2 coins (Supporter) • $3 = 5 coins • $5 = 10 coins • $10 = 25 coins
            </p>
            <div className={classes.donate_logo_block}>
                <a
                    href="https://www.donationalerts.com/r/konoplay"
                    target="_blank"
                    rel="noreferrer"
                    onClick={!authCtx.isLogged ? () => setLoginPrompt(true) : undefined}
                >
                    🎯 Open Donation Alerts →
                </a>
            </div>

            {/* Stripe — clickable tier cards, $5 minimum */}
            <p className={classes.donate_title}>
                💳 via Card (Stripe — Visa / Mastercard / Apple Pay / Google Pay / BLIK)
            </p>
            <div className={classes.donationTiers}>
                {donationTiers
                    .filter((t) => t.amount >= 5)
                    .map((tier, index) => (
                        <button
                            key={index}
                            className={classes.tierLink}
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                            onClick={() => handleStripe(tier.amount)}
                            disabled={stripeLoading !== null}
                        >
                            <div className={classes.tierCard} style={{ borderColor: tier.color }}>
                                <div className={classes.tierHeader} style={{ backgroundColor: tier.color }}>
                                    <h3>{tier.label}</h3>
                                    <span className={classes.tierAmount}>${tier.amount}</span>
                                </div>
                                <div className={classes.tierBody}>
                                    <div className={classes.coinReward}>
                                        <span className={classes.coinIcon}>🪙</span>
                                        <span>
                                            {stripeLoading === tier.amount ? '⏳ Opening...' : `+${tier.coins} coins`}
                                        </span>
                                    </div>
                                    <div className={classes.payNowLabel}>
                                        {stripeLoading === tier.amount ? '' : '💳 Pay →'}
                                    </div>
                                </div>
                            </div>
                        </button>
                    ))}
            </div>

            <p className={classes.customNote}>Minimum $5 via card. For smaller amounts use Donation Alerts.</p>

            {loginPrompt && (
                <div className={classes.loginPromptBanner}>
                    <span>🔐 Please log in first to donate and receive coins.</span>
                    <button className={classes.loginPromptClose} onClick={() => setLoginPrompt(false)}>
                        ✕
                    </button>
                </div>
            )}

            {/* MonoBank fallback */}
            <p className={classes.donate_title}>📱 Other</p>
            <div className={classes.donate_logo_block}>
                <a href="https://send.monobank.ua/jar/834ApdUfdC" target="_blank" rel="noreferrer">
                    💰 Donate via MonoBank (no coins)
                </a>
            </div>
        </Modal>
    );
};

export default ModalDonate;
