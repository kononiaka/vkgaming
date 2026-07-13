import { buildTournamentFormatPreview } from '../../utils/tournamentFormatPreview';
import classes from './TournamentFormatPreview.module.css';

const KnockoutTree = ({ columns = [] }) => {
    if (!columns.length) {
        return null;
    }

    return (
        <div className={classes.bracketWrap}>
            <div className={classes.bracket} aria-hidden="true">
                {columns.map((column, columnIndex) => {
                    const connectorCount = columnIndex > 0 ? Math.max(1, columns[columnIndex - 1].matchCount / 2) : 0;

                    return (
                        <div key={`${column.label}-${columnIndex}`} className={classes.roundGroup}>
                            {columnIndex > 0 ? (
                                <div className={classes.connectorColumn}>
                                    {Array.from({ length: connectorCount }).map((_, connectorIndex) => (
                                        <div key={connectorIndex} className={classes.connector} />
                                    ))}
                                </div>
                            ) : null}
                            <div className={classes.roundColumn}>
                                <p className={classes.roundLabel}>{column.label}</p>
                                <div className={classes.matchStack}>
                                    {Array.from({ length: column.matchCount }).map((_, slotIndex) => (
                                        <div
                                            key={slotIndex}
                                            className={`${classes.matchSlot} ${
                                                column.label === 'F' ? classes.matchSlotFinal : ''
                                            }`}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const PhaseFlow = ({ phases = [] }) => (
    <div className={classes.flowRow}>
        {phases.map((phase, index) => (
            <div key={`${phase.label}-${index}`} className={classes.phaseItem}>
                {index > 0 ? <span className={classes.arrow}>→</span> : null}
                <span
                    className={`${classes.phaseChip} ${
                        phase.type === 'groups'
                            ? classes.phaseChipGroups
                            : phase.type === 'knockout'
                              ? classes.phaseChipKnockout
                              : ''
                    }`}
                >
                    <span className={classes.phaseLabel}>{phase.label}</span>
                    {phase.subtitle ? <span className={classes.phaseSub}>{phase.subtitle}</span> : null}
                </span>
            </div>
        ))}
    </div>
);

const TournamentFormatPreview = ({ type, maxPlayers, loserBracket = false }) => {
    const preview = buildTournamentFormatPreview({ type, maxPlayers, loserBracket });

    if (preview.mode === 'empty') {
        return (
            <div className={classes.panel}>
                <p className={classes.title}>{preview.title}</p>
                <p className={classes.emptyMessage}>{preview.message}</p>
            </div>
        );
    }

    return (
        <div className={classes.panel} aria-label="Tournament format preview">
            <p className={classes.title}>{preview.title}</p>

            {preview.phases?.length ? <PhaseFlow phases={preview.phases} /> : null}

            {preview.columns?.length ? <KnockoutTree columns={preview.columns} /> : null}

            {preview.extraTracks?.length ? (
                <div className={classes.extraTracks}>
                    {preview.extraTracks.map((track) => (
                        <span key={track} className={classes.extraTag}>
                            {track}
                        </span>
                    ))}
                </div>
            ) : null}

            {preview.footnote ? <p className={classes.footnote}>{preview.footnote}</p> : null}
        </div>
    );
};

export default TournamentFormatPreview;
