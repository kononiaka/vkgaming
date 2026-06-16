import { useContext, useState } from 'react';
import Modal from '../Modal/Modal';
import AuthContext from '../../store/auth-context';

import classes from './modalDonate.module.css';

const STRIPE_FUNCTION_URL = 'https://us-central1-test-prod-app-81915.cloudfunctions.net/createStripeCheckout';
const MIN_STRIPE_DONATION_USD = 5;

const ModalDonate = (props) => {
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

    return (
        <Modal onClick={props.onClose} donate={props.donate}>
            <div className={classes.donate_block}>
                <p>
                    <b>Support the Project 🏆</b>
                </p>
                <p>
                    • 90% of donations go to tournament prize pools
                    <br />• 10% supports platform development
                </p>
            </div>

            <div className={classes.nicknameInstruction}>
                <p>Donations are tracked on your account after payment via both providers.</p>
                {authCtx.isLogged && authCtx.userNickName && (
                    <p className={classes.yourNickname}>
                        Your account: <strong>{authCtx.userNickName}</strong>
                    </p>
                )}
                {!authCtx.isLogged && (
                    <p className={classes.loginPromptInline}>Log in first so we know which account to credit.</p>
                )}
            </div>

            <p className={classes.donate_title}>via Donation Alerts</p>
            <p className={classes.customNote}>
                Donate any amount — matched by your Donation Alerts username set in your Profile.
            </p>
            <div className={classes.donate_logo_block}>
                <a
                    href="https://www.donationalerts.com/r/konoplay"
                    target="_blank"
                    rel="noreferrer"
                    onClick={!authCtx.isLogged ? () => setLoginPrompt(true) : undefined}
                >
                    Open Donation Alerts →
                </a>
            </div>

            <p className={classes.donate_title}>
                via Card (Stripe — Visa / Mastercard / Apple Pay / Google Pay / BLIK)
            </p>
            <p className={classes.customNote}>Enter any amount — minimum ${MIN_STRIPE_DONATION_USD} via card.</p>
            <form className={classes.stripeForm} onSubmit={handleStripeSubmit}>
                <div className={classes.stripeRow}>
                    <div className={classes.amountField}>
                        <span className={classes.amountPrefix}>$</span>
                        <input
                            className={classes.amountInput}
                            type="number"
                            min={MIN_STRIPE_DONATION_USD}
                            step="1"
                            value={stripeAmount}
                            onChange={(event) => setStripeAmount(event.target.value)}
                            disabled={stripeLoading}
                            aria-label="Donation amount in USD"
                        />
                    </div>
                    <button type="submit" className={classes.stripePayBtn} disabled={stripeLoading}>
                        {stripeLoading ? 'Opening checkout…' : 'Pay with card'}
                    </button>
                </div>
            </form>

            <p className={classes.customNote}>For smaller amounts, use Donation Alerts.</p>

            {loginPrompt && (
                <div className={classes.loginPromptBanner}>
                    <span>Please log in first to donate.</span>
                    <button className={classes.loginPromptClose} onClick={() => setLoginPrompt(false)}>
                        ✕
                    </button>
                </div>
            )}

            <p className={classes.donate_title}>Other</p>
            <div className={classes.donate_logo_block}>
                <a href="https://send.monobank.ua/jar/834ApdUfdC" target="_blank" rel="noreferrer">
                    Donate via MonoBank
                </a>
            </div>
        </Modal>
    );
};

export default ModalDonate;
