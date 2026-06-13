import { getTwitchEmbedUrl } from '../../utils/twitchUtils';
import classes from './LiveArenaPage.module.css';

const TwitchEmbed = ({ channel, title = 'Live stream' }) => {
    const embedUrl = getTwitchEmbedUrl(channel);

    if (!embedUrl) {
        return null;
    }

    return (
        <div className={classes.embedWrap}>
            <iframe
                title={title}
                src={embedUrl}
                className={classes.embedFrame}
                allowFullScreen
                scrolling="no"
                frameBorder="0"
            />
        </div>
    );
};

export default TwitchEmbed;
