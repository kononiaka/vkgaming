import { useEffect, useState } from 'react';
import classes from './DonationLeaderboard.module.css';

const DonationLeaderboard = () => {
    const [donors, setDonors] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDonationData = async () => {
            try {
                // Fetch all users and their coin transactions
                const usersResponse = await fetch('https://test-prod-app-81915-default-rtdb.firebaseio.com/users.json');
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

                            donorStats.push({
                                nickname: userData.enteredNickname,
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
                setDonors(donorStats.slice(0, 10)); // Top 10 donors
            } catch (error) {
                console.error('Error fetching donation data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchDonationData();
    }, []);

    if (loading) {
        return (
            <div className={classes.leaderboard}>
                <h3>🏆 Top Donors</h3>
                <div className={classes.loading}>Loading donation data... ⏳</div>
            </div>
        );
    }

    return (
        <div className={classes.leaderboard}>
            <h3>🏆 Top Donors</h3>
            {donors.length === 0 ? (
                <p className={classes.noDonors}>No donations yet. Be the first to support! 💝</p>
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
                                <span className={classes.amount}>💰 {donor.totalDonated} UAH</span>
                                <span className={classes.coins}>🪙 +{donor.totalCoinsEarned} coins</span>
                            </div>
                            <div className={classes.donationCount}>
                                {donor.donationCount} {donor.donationCount === 1 ? 'donation' : 'donations'}
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <div className={classes.footer}>
                <p>Support the platform and earn coins! 🎮💎</p>
            </div>
        </div>
    );
};

export default DonationLeaderboard;
