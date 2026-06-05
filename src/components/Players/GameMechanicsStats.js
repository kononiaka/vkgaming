import classes from './Players.module.css';

const RestartBreakdownRow = ({ label, count, percent, note }) => (
    <div className={classes.restartBreakdown}>
        <div className={classes.mechanicsRow}>
            <span className={classes.mechanicsRowLabel}>{label}</span>
            <span className={classes.mechanicsRowValue}>{count}</span>
        </div>
        <div className={classes.progressTrack}>
            <div className={classes.progressFill} style={{ width: `${percent}%` }} />
        </div>
        <p className={classes.mechanicsNote}>{note}</p>
    </div>
);

const GameMechanicsStats = ({ goldStats, restartStats, showRestartDetails, onToggleRestartDetails }) => (
    <div className={classes.section}>
        <h3 className={classes.sectionTitle}>Game mechanics</h3>
        <div className={classes.mechanicsGrid}>
            <div className={classes.mechanicsCard}>
                <h4 className={classes.mechanicsCardTitle}>Gold</h4>
                {goldStats ? (
                    <div className={classes.mechanicsRow}>
                        <span className={classes.mechanicsRowLabel}>Avg gold trade</span>
                        <span
                            className={`${classes.mechanicsRowValue} ${
                                Number(goldStats.averageGold) >= 0 ? classes.valuePositive : classes.valueNegative
                            }`}
                        >
                            {Number(goldStats.averageGold) >= 0 ? '+' : ''}
                            {goldStats.averageGold}
                        </span>
                    </div>
                ) : (
                    <p className={classes.emptyNote}>No gold data available</p>
                )}
            </div>

            <div className={classes.mechanicsCard}>
                <h4 className={classes.mechanicsCardTitle}>Flags</h4>
                {goldStats ? (
                    <>
                        <div className={`${classes.mechanicsRow} ${classes.mechanicsRowDivider}`}>
                            <span className={classes.mechanicsRowLabel}>Blue flag games</span>
                            <span className={classes.mechanicsRowValue}>{goldStats.blueGames}</span>
                        </div>
                        <div className={classes.mechanicsRow}>
                            <span className={classes.mechanicsRowLabel}>Red flag games</span>
                            <span className={classes.mechanicsRowValue}>{goldStats.redGames}</span>
                        </div>
                    </>
                ) : (
                    <p className={classes.emptyNote}>No flag data available</p>
                )}
            </div>

            <div className={classes.mechanicsCard}>
                <h4 className={classes.mechanicsCardTitle}>Restarts</h4>
                {restartStats ? (
                    <div className={classes.restartPanel}>
                        <button
                            type="button"
                            className={`${classes.restartSummary} ${showRestartDetails ? classes.restartSummaryOpen : ''}`}
                            onClick={onToggleRestartDetails}
                        >
                            <span className={classes.restartSummaryLabel}>
                                Average restart coefficient {showRestartDetails ? '▼' : '▶'}
                            </span>
                            <span className={classes.restartSummaryValue}>
                                {restartStats.averageCoefficient || '1.00'}
                            </span>
                            <span className={classes.restartSummaryHint}>Range: 1.0 (none) to 2.0 (max)</span>
                        </button>

                        {showRestartDetails && (
                            <div className={classes.restartDetails}>
                                <RestartBreakdownRow
                                    label="x1 1-11 restarts"
                                    count={restartStats.games111x1}
                                    percent={restartStats.percent111x1}
                                    note={`${restartStats.percent111x1}% of games · coefficient 1.5`}
                                />
                                <RestartBreakdownRow
                                    label="x2 1-11 restarts"
                                    count={restartStats.games111x2}
                                    percent={restartStats.percent111x2}
                                    note={`${restartStats.percent111x2}% of games · coefficient 2.0`}
                                />
                                <RestartBreakdownRow
                                    label="x1 1-12 restart"
                                    count={restartStats.games112}
                                    percent={restartStats.percent112}
                                    note={`${restartStats.percent112}% of games · coefficient 2.0`}
                                />
                                <RestartBreakdownRow
                                    label="No restarts"
                                    count={restartStats.gamesNoRestarts}
                                    percent={restartStats.percentNoRestarts}
                                    note={`${restartStats.percentNoRestarts}% of games · coefficient 1.0`}
                                />
                                <div className={classes.restartTotals}>
                                    <span>Analyzed: {restartStats.totalAnalyzedGames}</span>
                                    <span>With restarts: {restartStats.gamesWithRestarts}</span>
                                    <span>Without: {restartStats.gamesNoRestarts}</span>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <p className={classes.emptyNote}>No restart data available</p>
                )}
            </div>
        </div>
    </div>
);

export default GameMechanicsStats;
