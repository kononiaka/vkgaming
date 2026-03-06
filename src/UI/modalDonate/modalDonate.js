import { useState, useContext } from 'react';
import Modal from '../Modal/Modal';
import AuthContext from '../../store/auth-context';
import { addCoins } from '../../api/coinTransactions';

import classes from './modalDonate.module.css';

const ModalDonate = (props) => {
    const [selectedAmount, setSelectedAmount] = useState(null);
    const [customAmount, setCustomAmount] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const authCtx = useContext(AuthContext);

    const donationTiers = [
        {
            amount: 10,
            coins: 2,
            label: 'Supporter',
            description: 'Basic support + 2 coins',
            color: '#4CAF50'
        },
        {
            amount: 25,
            coins: 5,
            label: 'Contributor',
            description: 'Great support + 5 coins',
            color: '#2196F3'
        },
        {
            amount: 50,
            coins: 10,
            label: 'Champion',
            description: 'Amazing support + 10 coins',
            color: '#FF9800'
        },
        {
            amount: 100,
            coins: 25,
            label: 'Legend',
            description: 'Legendary support + 25 coins',
            color: '#E91E63'
        }
    ];

    const handleDonationClick = async (tier) => {
        if (!authCtx.isLogged || !authCtx.userNickName) {
            authCtx.setNotificationShown(true, 'Please log in to donate and receive coin rewards!', 'error', 5);
            return;
        }

        setSelectedAmount(tier.amount);
        setIsProcessing(true);

        try {
            // Award coins for donation
            const userId = await fetch(`https://test-prod-app-81915-default-rtdb.firebaseio.com/users.json`)
                .then((res) => res.json())
                .then((data) => {
                    const user = Object.values(data).find((u) => u.enteredNickname === authCtx.userNickName);
                    return user ? Object.keys(data).find((key) => data[key] === user) : null;
                });

            if (userId) {
                await addCoins(
                    userId,
                    tier.coins,
                    'donation_reward',
                    `Donation reward: ${tier.label} tier (${tier.amount} UAH)`,
                    {
                        donationAmount: tier.amount,
                        tier: tier.label,
                        rewardCoins: tier.coins,
                        timestamp: new Date().toISOString()
                    }
                );

                authCtx.setNotificationShown(
                    true,
                    `Thank you for your ${tier.amount} UAH donation! You received ${tier.coins} coins as a reward! 🎉`,
                    'success',
                    8
                );
            }
        } catch (error) {
            console.error('Error processing donation reward:', error);
            authCtx.setNotificationShown(true, 'Donation recorded! Thank you for your support! 🙏', 'success', 5);
        }

        setIsProcessing(false);
        setSelectedAmount(null);
    };

    const handleCustomDonation = async () => {
        const amount = parseFloat(customAmount);
        if (!amount || amount < 1) {
            authCtx.setNotificationShown(true, 'Please enter a valid donation amount (minimum 1 UAH)', 'error', 3);
            return;
        }

        if (!authCtx.isLogged || !authCtx.userNickName) {
            authCtx.setNotificationShown(true, 'Please log in to donate and receive coin rewards!', 'error', 5);
            return;
        }

        setIsProcessing(true);

        try {
            // Calculate coins based on custom amount (1 coin per 5 UAH)
            const coinsEarned = Math.floor(amount / 5);

            if (coinsEarned > 0) {
                const userId = await fetch(`https://test-prod-app-81915-default-rtdb.firebaseio.com/users.json`)
                    .then((res) => res.json())
                    .then((data) => {
                        const user = Object.values(data).find((u) => u.enteredNickname === authCtx.userNickName);
                        return user ? Object.keys(data).find((key) => data[key] === user) : null;
                    });

                if (userId) {
                    await addCoins(userId, coinsEarned, 'donation_reward', `Custom donation reward: ${amount} UAH`, {
                        donationAmount: amount,
                        rewardCoins: coinsEarned,
                        timestamp: new Date().toISOString()
                    });

                    authCtx.setNotificationShown(
                        true,
                        `Thank you for your ${amount} UAH donation! You received ${coinsEarned} coins as a reward! 🎉`,
                        'success',
                        8
                    );
                }
            } else {
                authCtx.setNotificationShown(
                    true,
                    `Thank you for your ${amount} UAH donation! Every contribution helps! 🙏`,
                    'success',
                    5
                );
            }
        } catch (error) {
            console.error('Error processing custom donation:', error);
            authCtx.setNotificationShown(true, 'Donation recorded! Thank you for your support! 🙏', 'success', 5);
        }

        setIsProcessing(false);
        setCustomAmount('');
    };

    return (
        <Modal onClick={props.onClose} donate={props.donate}>
            <div className={classes.donate_block}>
                <p>
                    <b>Support the Project & Earn Coins! 💎🎮</b>
                </p>
                <div className={classes.question}>
                    <span className={classes.tooltip}>
                        <p>
                            <strong>Donation Rewards System:</strong>
                            <br />
                            • 80% of donations go to tournament prize pools 🏆
                            <br />
                            • 20% supports platform development ⚡
                            <br />
                            • Earn coins for every donation! 🪙
                            <br />
                            • Higher donations = More coins! 🚀
                            <br />
                            <br />
                            <em>Your support makes competitive gaming possible!</em>
                        </p>
                    </span>
                </div>
            </div>

            {/* Donation Tiers */}
            <div className={classes.donationTiers}>
                {donationTiers.map((tier, index) => (
                    <div
                        key={index}
                        className={`${classes.tierCard} ${selectedAmount === tier.amount ? classes.selected : ''}`}
                        onClick={() => !isProcessing && handleDonationClick(tier)}
                        style={{ borderColor: tier.color }}
                    >
                        <div className={classes.tierHeader} style={{ backgroundColor: tier.color }}>
                            <h3>{tier.label}</h3>
                            <span className={classes.tierAmount}>{tier.amount} UAH</span>
                        </div>
                        <div className={classes.tierBody}>
                            <p className={classes.tierDescription}>{tier.description}</p>
                            <div className={classes.coinReward}>
                                <span className={classes.coinIcon}>🪙</span>
                                <span>+{tier.coins} coins</span>
                            </div>
                        </div>
                        {selectedAmount === tier.amount && isProcessing && (
                            <div className={classes.processing}>Processing... ⏳</div>
                        )}
                    </div>
                ))}
            </div>

            {/* Custom Donation */}
            <div className={classes.customDonation}>
                <h4>Custom Amount 💰</h4>
                <div className={classes.customInput}>
                    <input
                        type="number"
                        placeholder="Enter amount (UAH)"
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value)}
                        min="1"
                        step="0.01"
                        disabled={isProcessing}
                    />
                    <button
                        onClick={handleCustomDonation}
                        disabled={isProcessing || !customAmount}
                        className={classes.customButton}
                    >
                        {isProcessing ? 'Processing...' : 'Donate Custom'}
                    </button>
                </div>
                <p className={classes.customNote}>💡 Earn 1 coin for every 5 UAH donated!</p>
            </div>

            {/* Original QR Code Section */}
            <p className={classes.donate_title}>Or scan QR code 📱</p>
            <div className={classes.donate_logo_block}>
                <div className={classes.donate_logo}></div>
            </div>
            <div className={classes.donate_logo_block}>
                <a href="https://send.monobank.ua/jar/834ApdUfdC" target="_blank" rel="noreferrer">
                    💰 Donate via MonoBank
                </a>
            </div>

            {!authCtx.isLogged && (
                <div className={classes.loginPrompt}>
                    <p>
                        🔐 <strong>Log in to earn coins for your donations!</strong>
                    </p>
                    <p>Registered users get coin rewards for supporting the platform.</p>
                </div>
            )}
        </Modal>
    );
};

export default ModalDonate;
