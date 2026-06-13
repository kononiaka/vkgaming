import { FIREBASE_DATABASE_URL } from '../../config/firebase';
import { normalizeDonationToUsd } from '../../utils/prizePoolData';
import { useEffect, useState } from 'react';
import classes from './DonatorsBar.module.css';

const getLegacyDonatedUsd = (userData) => {
    const transactions = Object.values(userData.coinTransactions || {}).filter(
        (transaction) => transaction.type === 'donation_reward'
    );

    return transactions.reduce((sum, transaction) => {
        const donationAmount = Number(transaction.metadata?.donationAmount) || 0;
        const currency = transaction.metadata?.currency || 'UAH';
        return sum + normalizeDonationToUsd(donationAmount, currency);
    }, 0);
};

const getDonorTotalUsd = (userData) => {
    const tracked = Number(userData.totalDonatedUsd);
    if (Number.isFinite(tracked) && tracked > 0) {
        return tracked;
    }
    return getLegacyDonatedUsd(userData);
};

const DonatorsBar = () => {
    const [donators, setDonators] = useState([]);

    useEffect(() => {
        const fetchDonators = async () => {
            try {
                const usersResponse = await window.fetch(`${FIREBASE_DATABASE_URL}/users.json`);
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
                    .map((userData) => ({
                        name: userData.enteredNickname || userData.name || 'Anonymous',
                        amount: getDonorTotalUsd(userData)
                    }))
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

    useEffect(() => {
        document.documentElement.classList.toggle('has-supporters-bar', donators.length > 0);
        return () => document.documentElement.classList.remove('has-supporters-bar');
    }, [donators.length]);

    if (donators.length === 0) {
        return null;
    }

    const duplicatedDonators = [...donators, ...donators];

    const getRankLabel = (index) => {
        if (index === 0) {
            return '#1';
        }
        if (index === 1) {
            return '#2';
        }
        if (index === 2) {
            return '#3';
        }
        return null;
    };

    return (
        <div className={classes.donatorsBar}>
            <span className={classes.donatorsLabel}>Supporters</span>
            <div className={classes.donatorsScroll}>
                <div className={classes.donatorsTrack}>
                    {duplicatedDonators.map((donator, index) => {
                        const rank = getRankLabel(index % donators.length);
                        return (
                            <div key={`${donator.name}-${index}`} className={classes.donatorItem}>
                                {rank ? <span className={classes.donatorRank}>{rank}</span> : null}
                                <span className={classes.donatorName}>{donator.name}</span>
                                <span className={classes.donatorAmount}>
                                    <strong>${Math.round(donator.amount).toLocaleString()}</strong>
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default DonatorsBar;
