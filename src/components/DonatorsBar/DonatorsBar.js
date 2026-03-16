import { useEffect, useState } from 'react';
import classes from './DonatorsBar.module.css';

const DonatorsBar = () => {
    const [donators, setDonators] = useState([]);

    useEffect(() => {
        const fetchDonators = async () => {
            try {
                const usersResponse = await window.fetch(
                    'https://test-prod-app-81915-default-rtdb.firebaseio.com/users.json'
                );
                if (!usersResponse.ok) {
                    setDonators([]);
                    return;
                }
                const users = await usersResponse.json();

                if (!users) {
                    setDonators([]);
                    return;
                }

                const donors = Object.values(users)
                    .map((userData) => {
                        const transactions = Object.values(userData.coinTransactions || {}).filter(
                            (transaction) => transaction.type === 'donation_reward'
                        );

                        const totalDonated = transactions.reduce((sum, transaction) => {
                            const donationAmount = Number(transaction.metadata?.donationAmount) || 0;
                            return sum + donationAmount;
                        }, 0);

                        return {
                            name: userData.enteredNickname || userData.name || 'Anonymous',
                            amount: totalDonated
                        };
                    })
                    .filter((donor) => donor.amount > 0)
                    .sort((a, b) => b.amount - a.amount)
                    .slice(0, 20);

                setDonators(donors);
            } catch (error) {
                console.error('Error fetching donators:', error);
                setDonators([]);
            }
        };

        fetchDonators();
    }, []);

    // If no donators, don't render
    if (donators.length === 0) {
        return null;
    }

    // Duplicate the list for seamless infinite scroll
    const duplicatedDonators = [...donators, ...donators];

    const getRankEmoji = (index) => {
        if (index === 0) {
            return '🥇';
        }
        if (index === 1) {
            return '🥈';
        }
        if (index === 2) {
            return '🥉';
        }
        return '💰';
    };

    return (
        <div className={classes.donatorsBar}>
            <div className={classes.donatorsTrack}>
                {duplicatedDonators.map((donator, index) => (
                    <div key={`${donator.name}-${index}`} className={classes.donatorItem}>
                        <span className={classes.donatorRank}>{getRankEmoji(index % donators.length)}</span>
                        <span className={classes.donatorName}>{donator.name}</span>
                        <span className={classes.donatorAmount}>{donator.amount} UAH</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DonatorsBar;
