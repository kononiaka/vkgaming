import React from 'react';
import styles from './ModalAddTournament.module.css';

const Bracket = () => (
    <div className={styles.bracket}>
        {/* 1/16 Round */}
        <div className={styles.round}>
            <div className={styles.match}>
                <div className={styles.team}>Team 1</div>
                <div className={styles.team}>Team 2</div>
                <div className={styles.line}></div>
            </div>
            <div className={styles.match}>
                <div className={styles.team}>Team 3</div>
                <div className={styles.team}>Team 4</div>
                <div className={styles.line}></div>
            </div>
            {/* Add more match components for the remaining brackets */}
            {/* Total of 8 match components for 16 teams */}
        </div>

        {/* 1/8 Round */}
        <div className={styles.round}>
            <div className={styles.match}>
                <div className={styles.team}>Winner 1</div>
                <div className={styles.team}>Winner 2</div>
                <div className={styles.line}></div>
            </div>
            <div className={styles.match}>
                <div className={styles.team}>Winner 3</div>
                <div className={styles.team}>Winner 4</div>
                <div className={styles.line}></div>
            </div>
            {/* Add more match components for the remaining brackets */}
            {/* Total of 4 match components for 8 teams */}
        </div>

        {/* 1/4 Round */}
        <div className={styles.round}>
            <div className={styles.match}>
                <div className={styles.team}>Winner 5</div>
                <div className={styles.team}>Winner 6</div>
                <div className={styles.line}></div>
            </div>
            {/* Add more match components for the remaining brackets */}
            {/* Total of 2 match components for 4 teams */}
        </div>

        {/* 1/2 Round */}
        <div className={styles.round}>
            <div className={styles.match}>
                <div className={styles.team}>Winner 7</div>
                <div className={styles.team}>Winner 8</div>
                <div className={styles.line}></div>
            </div>
        </div>

        {/* Final */}
        <div className={styles.round}>
            <div className={styles.match}>
                <div className={styles.team}>Winner 9</div>
                <div className={styles.team}>Winner 10</div>
                <div className={styles.line}></div>
            </div>
        </div>

        {/* Champion */}
        <div className={styles.round}>
            <div className={styles.champion}>
                <div className={styles.team}>Champion</div>
            </div>
        </div>
    </div>
);

export default Bracket;
