import { useState } from 'react';
import classes from './CsSwissRulesBlock.module.css';

const CsSwissRulesBlock = ({ round, winTarget = 3, lossLimit = 3, playerCount = 8, phase = 'swiss' }) => {
    const [open, setOpen] = useState(false);
    const totalPlayers = Number(playerCount) || 8;
    const qualifierCount = Math.floor(totalPlayers / 2);
    const isEightPlayer = totalPlayers === 8;

    const summary =
        phase === 'playoffs'
            ? `CS Swiss playoffs — ${qualifierCount} qualifiers in knockout bracket`
            : `CS Swiss round ${round} — ${winTarget} wins qualify, ${lossLimit} losses eliminate`;

    return (
        <div className={classes.rulesBlock}>
            <button
                type="button"
                className={`${classes.rulesToggle} ${open ? classes.rulesToggleOpen : ''}`}
                onClick={() => setOpen((prev) => !prev)}
                aria-expanded={open}
            >
                <span className={classes.rulesSummary}>{summary}</span>
                <span className={classes.rulesChevron} aria-hidden="true">
                    {open ? '▼' : '▶'}
                </span>
            </button>
            {open && (
                <div className={classes.rulesBody}>
                    <section className={classes.rulesSection}>
                        <h4 className={classes.rulesHeading}>Swiss stage</h4>
                        <ul className={classes.rulesList}>
                            <li>
                                Reach <strong>{winTarget} wins</strong> to qualify for playoffs.
                            </li>
                            <li>
                                Reach <strong>{lossLimit} losses</strong> and you are eliminated.
                            </li>
                            <li>
                                Swiss continues until every player has qualified or been eliminated — there is no fixed
                                round limit.
                            </li>
                            <li>Active players are paired against others with a similar record when possible.</li>
                            <li>
                                <strong>
                                    {qualifierCount} of {totalPlayers}
                                </strong>{' '}
                                players advance (half the field).
                            </li>
                            <li>
                                Green rows in standings show confirmed qualifiers ({winTarget}+ wins) or projected
                                knock-out places while the Swiss stage is still running.
                            </li>
                        </ul>
                    </section>
                    <section className={classes.rulesSection}>
                        <h4 className={classes.rulesHeading}>Playoff seeding</h4>
                        <ul className={classes.rulesList}>
                            <li>
                                Qualifiers are ranked by Swiss result: <strong>{winTarget}–0</strong> records first,
                                then most wins, fewest losses, then name.
                            </li>
                            {isEightPlayer ? (
                                <>
                                    <li>
                                        All {qualifierCount} qualifiers start in the semi-finals — no quarter-finals.
                                    </li>
                                    <li>
                                        Semi-finals: <strong>1st vs 4th</strong> and <strong>2nd vs 3rd</strong> seed.
                                    </li>
                                </>
                            ) : (
                                <>
                                    <li>All {qualifierCount} qualifiers start in the quarter-finals.</li>
                                    <li>
                                        Quarter-finals: <strong>1 vs 8</strong>, <strong>4 vs 5</strong>,{' '}
                                        <strong>2 vs 7</strong>, <strong>3 vs 6</strong>.
                                    </li>
                                </>
                            )}
                            <li>Winners advance through semi-finals, final, and third-place match as usual.</li>
                        </ul>
                    </section>
                    <p className={classes.rulesNote}>
                        Standings and playoff seeds use the same order: best Swiss record first (e.g. 3–0, then 3–1,
                        then 3–2).
                    </p>
                </div>
            )}
        </div>
    );
};

export default CsSwissRulesBlock;
