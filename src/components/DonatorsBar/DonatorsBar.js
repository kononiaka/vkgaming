import { useEffect, useState } from 'react';
import classes from './DonatorsBar.module.css';

const DonatorsBar = () => {
    const [donators, setDonators] = useState([]);

    useEffect(() => {
        const fetchDonators = async () => {
            try {
                const response = await window.fetch(
                    'https://test-prod-app-81915-default-rtdb.firebaseio.com/donators.json'
                );
                if (!response.ok) {
                    // Use mock data if fetch fails
                    const mockDonators = [
                        { name: 'VladTheConqueror', amount: 1500 },
                        { name: 'HeroMaster2024', amount: 1200 },
                        { name: 'DonatorPro', amount: 1000 },
                        { name: 'GamingLegend', amount: 800 },
                        { name: 'SupportKing', amount: 650 },
                        { name: 'CastleBuilder', amount: 500 },
                        { name: 'TournamentFan', amount: 450 },
                        { name: 'PlatformSupporter', amount: 400 }
                    ];
                    setDonators(mockDonators);
                    return;
                }
                const data = await response.json();

                if (data) {
                    // Convert to array and sort by amount
                    const donatorsArray = Object.values(data).sort((a, b) => b.amount - a.amount);
                    setDonators(donatorsArray);
                } else {
                    // Use mock data if no data in Firebase
                    const mockDonators = [
                        { name: 'VladTheConqueror', amount: 1500 },
                        { name: 'HeroMaster2024', amount: 1200 },
                        { name: 'DonatorPro', amount: 1000 },
                        { name: 'GamingLegend', amount: 800 },
                        { name: 'SupportKing', amount: 650 },
                        { name: 'CastleBuilder', amount: 500 },
                        { name: 'TournamentFan', amount: 450 },
                        { name: 'PlatformSupporter', amount: 400 }
                    ];
                    setDonators(mockDonators);
                }
            } catch (error) {
                console.error('Error fetching donators:', error);
                // Use mock data on error
                const mockDonators = [
                    { name: 'VladTheConqueror', amount: 1500 },
                    { name: 'HeroMaster2024', amount: 1200 },
                    { name: 'DonatorPro', amount: 1000 },
                    { name: 'GamingLegend', amount: 800 },
                    { name: 'SupportKing', amount: 650 },
                    { name: 'CastleBuilder', amount: 500 },
                    { name: 'TournamentFan', amount: 450 },
                    { name: 'PlatformSupporter', amount: 400 }
                ];
                setDonators(mockDonators);
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
