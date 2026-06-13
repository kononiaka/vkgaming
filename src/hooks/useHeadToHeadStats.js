import { useCallback, useState } from 'react';
import { authFetch } from '../api/authFetch';
import { FIREBASE_DATABASE_URL } from '../config/firebase';
import { fetchHeadToHeadStats } from '../utils/headToHeadStats';

export const canShowHeadToHeadStats = (team1, team2) =>
    Boolean(team1 && team2 && team1 !== 'TBD' && team2 !== 'TBD');

export function useHeadToHeadStats({ playoffPairs = [] } = {}) {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);

    const showHeadToHeadStats = useCallback(
        async (team1, team2) => {
            if (!canShowHeadToHeadStats(team1, team2)) {
                return;
            }

            setStats({ playerA: team1, playerB: team2 });
            setLoading(true);
            setOpen(true);

            try {
                const statsData = await fetchHeadToHeadStats(team1, team2, {
                    authFetch,
                    firebaseUrl: FIREBASE_DATABASE_URL,
                    playoffPairs
                });
                setStats(statsData);
            } catch (error) {
                console.error('Error loading head-to-head stats:', error);
                setOpen(false);
                setStats(null);
                alert('Could not load head-to-head stats.');
            } finally {
                setLoading(false);
            }
        },
        [playoffPairs]
    );

    const closeHeadToHeadStats = useCallback(() => {
        setOpen(false);
        setLoading(false);
        setStats(null);
    }, []);

    return {
        stats,
        loading,
        open,
        showHeadToHeadStats,
        closeHeadToHeadStats
    };
}
