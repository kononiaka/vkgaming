import StatsPopup from '../StatsPopup/StatsPopup';
import { canShowHeadToHeadStats } from '../../hooks/useHeadToHeadStats';
import classes from './HeadToHeadStatsButton.module.css';

export const HeadToHeadStatsButton = ({
    team1,
    team2,
    onShow,
    className = '',
    variant = 'icon'
}) => {
    if (!canShowHeadToHeadStats(team1, team2)) {
        return null;
    }

    const handleClick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        onShow(team1, team2);
    };

    if (variant === 'text') {
        return (
            <button
                type="button"
                className={`${classes.textBtn} ${className}`}
                onClick={handleClick}
                title="Show head-to-head stats"
            >
                Head-to-head stats
            </button>
        );
    }

    return (
        <button
            type="button"
            className={`${classes.iconBtn} ${className}`}
            onClick={handleClick}
            title="Show head-to-head stats"
            aria-label="Show head-to-head stats"
        >
            ?
        </button>
    );
};

export const HeadToHeadStatsPortal = ({ stats, loading, open, onClose }) => {
    if (!open || !stats) {
        return null;
    }

    return <StatsPopup stats={stats} loading={loading} onClose={onClose} />;
};
