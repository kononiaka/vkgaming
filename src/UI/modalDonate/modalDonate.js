import { useContext } from 'react';
import Modal from '../Modal/Modal';
import AuthContext from '../../store/auth-context';

import classes from './modalDonate.module.css';

const ModalDonate = (props) => {
    const authCtx = useContext(AuthContext);

    // Purely informational — coins are awarded automatically by the server
    // after Donation Alerts confirms a real payment.
    const donationTiers = [
        { amount: 1, coins: 2, label: 'Supporter', color: '#4CAF50' },
        { amount: 3, coins: 5, label: 'Contributor', color: '#2196F3' },
        { amount: 5, coins: 10, label: 'Champion', color: '#FF9800' },
        { amount: 10, coins: 25, label: 'Legend', color: '#E91E63' }
    ];

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
                    🪙 <strong>To receive coins automatically:</strong>
                </p>
                <ol>
                    <li>
                        Write your <strong>exact in-game nickname</strong> in the donation message on Donation Alerts.
                    </li>
                    <li>Complete the payment.</li>
                    <li>Coins will appear in your account within seconds.</li>
                </ol>
                {authCtx.isLogged && authCtx.userNickName && (
                    <p className={classes.yourNickname}>
                        Your nickname: <strong>{authCtx.userNickName}</strong>
                    </p>
                )}
                {!authCtx.isLogged && (
                    <p className={classes.loginPromptInline}>🔐 Log in first so we know which account to credit.</p>
                )}
            </div>

            {/* Coin tiers reference table */}
            <div className={classes.donationTiers}>
                {donationTiers.map((tier, index) => {
                    const nickname = authCtx.isLogged && authCtx.userNickName ? authCtx.userNickName : '';
                    const daUrl = `https://www.donationalerts.com/r/konoplay${nickname ? `?message=${encodeURIComponent(nickname)}` : ''}`;
                    return (
                        <a key={index} href={daUrl} target="_blank" rel="noreferrer" className={classes.tierLink}>
                            <div className={classes.tierCard} style={{ borderColor: tier.color }}>
                                <div className={classes.tierHeader} style={{ backgroundColor: tier.color }}>
                                    <h3>{tier.label}</h3>
                                    <span className={classes.tierAmount}>${tier.amount}</span>
                                </div>
                                <div className={classes.tierBody}>
                                    <div className={classes.coinReward}>
                                        <span className={classes.coinIcon}>🪙</span>
                                        <span>+{tier.coins} coins</span>
                                    </div>
                                </div>
                            </div>
                        </a>
                    );
                })}
            </div>
            <p className={classes.customNote}>Any amount below $1 earns 1 coin per $0.50.</p>

            {/* Payment links */}
            <p className={classes.donate_title}>Donate via 📱</p>
            <div className={classes.donate_logo_block}>
                <a
                    href={`https://www.donationalerts.com/r/konoplay${authCtx.isLogged && authCtx.userNickName ? `?message=${encodeURIComponent(authCtx.userNickName)}` : ''}`}
                    target="_blank"
                    rel="noreferrer"
                    className={classes.daButton}
                >
                    🎯 Donate via Donation Alerts (coins авто-credited!)
                </a>
            </div>
            <div className={classes.donate_logo_block}>
                <a href="https://send.monobank.ua/jar/834ApdUfdC" target="_blank" rel="noreferrer">
                    💰 Donate via MonoBank (no coins)
                </a>
            </div>
        </Modal>
    );
};

export default ModalDonate;
