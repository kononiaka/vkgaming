import { FIREBASE_DATABASE_URL } from '../../config/firebase';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import classes from './DonationLeaderboard.module.css';

const DonationLeaderboard = ({
    title = 'Top supporters',
    limit = 10,
    variant = 'embedded',
    showFooter = true,
    supportLink = false
}) => {
    const [donors, setDonors] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDonationData = async () => {
            try {
                // Fetch all users and their coin transactions
                const usersResponse = await fetch(`${FIREBASE_DATABASE_URL}/users.json`);
                const users = await usersResponse.json();

                if (!users) {
                    return;
                }

                const donorStats = [];

                for (const [userId, userData] of Object.entries(users)) {
                    if (userData.coinTransactions) {
                        const donationTransactions = Object.values(userData.coinTransactions)
                            .filter((transaction) => transaction.type === 'donation_reward')
                            .map((transaction) => ({
                                amount: transaction.metadata?.donationAmount || 0,
                                coins: transaction.amount,
                                timestamp: transaction.timestamp
                            }));

                        if (donationTransactions.length > 0) {
                            const totalDonated = donationTransactions.reduce((sum, t) => sum + t.amount, 0);
                            const totalCoinsEarned = donationTransactions.reduce((sum, t) => sum + t.coins, 0);

                            const nickname = userData.enteredNickname || userData.name;
                            if (!nickname) {
                                continue;
                            }

                            donorStats.push({
                                nickname,
                                totalDonated,
                                totalCoinsEarned,
                                donationCount: donationTransactions.length,
                                lastDonation: Math.max(...donationTransactions.map((t) => new Date(t.timestamp)))
                            });
                        }
                    }
                }

                // Sort by total donated (descending)
                donorStats.sort((a, b) => b.totalDonated - a.totalDonated);
                setDonors(donorStats.slice(0, limit));
            } catch (error) {
                console.error('Error fetching donation data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchDonationData();
    }, [limit]);

    const rootClass =
        variant === 'panel' ? `${classes.leaderboard} ${classes.leaderboardPanel}` : classes.leaderboard;

    if (loading) {
        return (
            <div className={rootClass}>
                <h3 className={classes.title}>{title}</h3>
                <div className={classes.loading}>Loading supporters…</div>
            </div>
        );
    }

    return (
        <div className={rootClass}>
            <h3 className={classes.title}>{title}</h3>
            {donors.length === 0 ? (
                <p className={classes.noDonors}>No donations yet. Be the first to support.</p>
            ) : (
                <div className={classes.donorList}>
                    {donors.map((donor, index) => (
                        <div key={donor.nickname} className={classes.donorItem}>
                            <div className={classes.rank}>
                                {index === 0 && '🥇'}
                                {index === 1 && '🥈'}
                                {index === 2 && '🥉'}
                                {index > 2 && `#${index + 1}`}
                            </div>
                            <div className={classes.donorInfo}>
                                <span className={classes.nickname}>{donor.nickname}</span>
                                <span className={classes.amount}>{donor.totalDonated} UAH donated</span>
                                <span className={classes.coins}>+{donor.totalCoinsEarned} coins earned</span>
                            </div>
                            <div className={classes.donationCount}>
                                {donor.donationCount} {donor.donationCount === 1 ? 'donation' : 'donations'}
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {showFooter && (
                <div className={classes.footer}>
                    {supportLink ? (
                        <p>
                            <Link to="/support" className={classes.footerLink}>
                                Support the platform and see all ways to donate →
                            </Link>
                        </p>
                    ) : (
                        <p>Thank you for backing the cups and prize pools.</p>
                    )}
                </div>
            )}
        </div>
    );
};

export default DonationLeaderboard;
