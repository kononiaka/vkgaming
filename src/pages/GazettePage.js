import Gazette from '../components/Gazette/Gazette';
import classes from './GazettePage.module.css';

const GazettePage = () => (
    <div className={classes.wrapper}>
        <header className={classes.pageHeader}>
            <div>
                <h1 className={classes.pageTitle}>Gazette</h1>
                <p className={classes.pageSubtitle}>
                    The paper of record for cup upsets, heavy gifts to the purse, and new champions.
                </p>
            </div>
        </header>
        <Gazette variant="page" />
    </div>
);

export default GazettePage;
