import { Link } from 'react-router-dom';

import classes from './Rules.module.css';

const rules = [
    {
        title: 'Registration',
        body: 'Create an account and set your profile nickname to match your in-game lobby name. One account per player.'
    },
    {
        title: 'Reporting results',
        body: 'Report match results within 24 hours on the tournament bracket. Both players may submit; the organizer resolves disputes.'
    },
    {
        title: 'Match format',
        body: 'BO-3 cups: first to 2 map wins. Castles and colors recorded on the site must match what was played.'
    },
    {
        title: 'League standings',
        body: 'League and Champions League tables are sorted by points first. If players are tied on points, their direct head-to-head result decides who is higher; if that is still tied, wins and then player name are used.'
    },
    {
        title: 'Scheduling',
        body: 'Players arrange match times via Discord or Telegram. Post agreed times in the cup thread when possible.'
    },
    {
        title: 'Forfeits',
        body: 'Do not forfeit without notifying your opponent and the organizer. Repeated no-shows may be excluded from future cups.'
    },
    {
        title: 'Disputes',
        body: (
            <>
                Contact the organizer on <Link to="/help">Help</Link> channels. Include tournament name, round, and both
                player nicks.
            </>
        )
    },
    {
        title: 'Streams',
        body: 'Streaming is encouraged. VOD links may be added to match reports in a future update.'
    },
    {
        title: 'Country flags',
        body: 'Registered players may show a country flag on profiles and player lists. On Twitch sign-in, Konoplay detects your country from your connection IP and stores only the two-letter country code (for example PL or UA), not your IP address. You can change or override the flag in your profile settings. VPNs and mobile networks may show the wrong country — pick your country manually if needed.'
    },
    {
        title: 'Privacy',
        body: 'Konoplay stores account data needed to run cups: nickname, ratings, tournament history, optional social links, and country code for display flags. We do not publish or store raw IP addresses on player profiles. Contact the organizer via Help if you want your account removed.'
    }
];

const Rules = () => (
    <div className={`${classes.wrapper} data-page`}>
        <header className={classes.pageHeader}>
            <h1 className={classes.pageTitle}>Cup rules</h1>
            <p className={classes.pageSubtitle}>
                Short rules for Konoplay knockout cups. Full season ladder rules may differ in future seasons.
            </p>
        </header>

        <ol className={classes.ruleList}>
            {rules.map((rule) => (
                <li key={rule.title} className={classes.ruleItem}>
                    <h2 className={classes.ruleTitle}>{rule.title}</h2>
                    <p className={classes.ruleBody}>{rule.body}</p>
                </li>
            ))}
        </ol>
    </div>
);

export default Rules;
