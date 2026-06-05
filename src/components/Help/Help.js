import { Link } from 'react-router-dom';

import classes from './Help.module.css';

import discordIcon from '../../UI/ModalHelp/discord.png';
import telegramIcon from '../../UI/ModalHelp/tg_bcg.png';
import youtubeIcon from '../../UI/ModalHelp/youtube.png';

const channels = [
    {
        name: 'Discord',
        description: 'Best for tournament questions, match disputes, and quick replies.',
        href: 'https://discord.gg/9edXZJZZ',
        label: 'Join our Discord',
        icon: discordIcon
    },
    {
        name: 'Telegram',
        description: 'Announcements and direct messages with the team.',
        href: 'https://t.me/vkgamingplay',
        label: 'Message us on Telegram',
        icon: telegramIcon
    },
    {
        name: 'YouTube',
        description: 'Streams, highlights, and tournament coverage.',
        href: 'https://www.youtube.com/channel/UCtATty8dW9ryDyrICQ63aqQ',
        label: 'Follow on YouTube',
        icon: youtubeIcon
    }
];

const Help = () => (
    <div className={`${classes.wrapper} data-page`}>
        <header className={classes.pageHeader}>
            <div>
                <h1 className={classes.pageTitle}>Help</h1>
                <p className={classes.pageSubtitle}>
                    Questions about tournaments, accounts, or donations? Reach out on any channel below. Cup rules are
                    on the <Link to="/rules">Rules</Link> page.
                </p>
            </div>
        </header>

        <section className={classes.infoPanel}>
            <p className={classes.infoLead}>
                For account issues, include your konoplay nickname. For payment questions, mention the provider you
                used (Donation Alerts, Stripe, or MonoBank).
            </p>
        </section>

        <ul className={classes.channelList}>
            {channels.map((channel) => (
                <li key={channel.name} className={classes.channelItem}>
                    <img src={channel.icon} alt="" className={classes.channelIcon} />
                    <div className={classes.channelBody}>
                        <h2 className={classes.channelName}>{channel.name}</h2>
                        <p className={classes.channelDesc}>{channel.description}</p>
                        <a
                            href={channel.href}
                            target="_blank"
                            rel="noreferrer"
                            className={classes.channelLink}
                        >
                            {channel.label}
                        </a>
                    </div>
                </li>
            ))}
        </ul>
    </div>
);

export default Help;
