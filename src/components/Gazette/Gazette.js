import { useContext, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
    discardGazetteDraft,
    fetchGazetteCurrent,
    fetchGazetteDraft,
    fetchGazetteFacts,
    fetchGazetteIssues,
    generateGazetteDraft,
    publishGazetteIssue,
    deleteGazetteIssue
} from '../../api/gazette';
import castleImg from '../../image/castles/castle.jpeg';
import blueFlagImg from '../../image/flags/blue.jpg';
import redFlagImg from '../../image/flags/red.jpg';
import konoplayCrest from '../../image/konoplay-crest.png';
import { getAvatar, lookForUserId } from '../../api/api';
import AuthContext from '../../store/auth-context';
import StarsComponent from '../Stars/Stars';
import { getCastleImage } from '../../utils/castleImages';
import {
    describeGazetteEvent,
    isGazetteTickerCopy,
    isSameGazetteIssue,
    orientGazetteScoreline,
    previewGazetteIssue,
    resolveGazetteIssue,
    sortGazetteEvents,
    unpublishedGazetteEvents
} from '../../utils/gazette';
import classes from './Gazette.module.css';

const ART_SRC = {
    crest: konoplayCrest,
    castle: castleImg,
    gold: konoplayCrest,
    finals: konoplayCrest,
    registration: castleImg
};

const colorWash = (color, side) => {
    const from = side === 'left' ? 'to right' : 'to left';
    if (color === 'red') {
        return `linear-gradient(${from}, rgba(139, 0, 0, 0.28), rgba(139, 0, 0, 0.04))`;
    }
    if (color === 'blue') {
        return `linear-gradient(${from}, rgba(0, 0, 139, 0.28), rgba(0, 0, 139, 0.04))`;
    }
    return `linear-gradient(${from}, rgba(26, 18, 12, 0.2), transparent)`;
};

const castleBackground = (castleSrc, color, side) => {
    const wash = colorWash(color, side);
    if (!castleSrc) {
        return wash;
    }
    return `${wash}, url(${castleSrc})`;
};

const flagSrc = (color) => {
    if (color === 'red') {
        return redFlagImg;
    }
    if (color === 'blue') {
        return blueFlagImg;
    }
    return null;
};

const usePlayerAvatar = (name) => {
    const [avatar, setAvatar] = useState(null);

    useEffect(() => {
        let cancelled = false;
        if (!name) {
            setAvatar(null);
            return undefined;
        }

        Promise.resolve(typeof lookForUserId === 'function' ? lookForUserId(name) : null)
            .then((uid) => (uid && typeof getAvatar === 'function' ? getAvatar(uid) : null))
            .then((url) => {
                if (!cancelled) {
                    setAvatar(url || null);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setAvatar(null);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [name]);

    return avatar;
};

const GazettePlayer = ({ name, stars, color, avatar, align }) => {
    const flag = flagSrc(color);
    const portrait = (
        <div className={classes.matchAvatar} aria-hidden={!avatar}>
            {avatar ? (
                <img src={avatar} alt="" className={classes.matchAvatarImg} />
            ) : (
                <span>{String(name || '?').charAt(0).toUpperCase()}</span>
            )}
        </div>
    );
    const flagMark = flag ? (
        <img
            src={flag}
            alt={color === 'red' ? 'Red flag' : 'Blue flag'}
            className={`${classes.matchFlag} ${color === 'red' ? classes.matchFlagRed : classes.matchFlagBlue}`}
        />
    ) : null;
    const identity = (
        <div className={classes.matchIdentity}>
            <span className={classes.matchName}>{name}</span>
            {stars > 0 ? (
                <span className={classes.matchStars}>
                    <StarsComponent stars={stars} />
                </span>
            ) : null}
        </div>
    );

    return (
        <div className={`${classes.matchPlayer} ${align === 'end' ? classes.matchPlayerEnd : ''}`}>
            {align === 'start' ? (
                <>
                    {portrait}
                    {flagMark}
                    {identity}
                </>
            ) : (
                <>
                    {identity}
                    {flagMark}
                    {portrait}
                </>
            )}
        </div>
    );
};

const GazetteArt = ({ issue, fallbackSrc }) => {
    const winnerSrc = getCastleImage(issue?.winnerCastle);
    const loserSrc = getCastleImage(issue?.loserCastle);
    const winnerAvatar = usePlayerAvatar(issue?.winnerName);
    const loserAvatar = usePlayerAvatar(issue?.loserName);
    const hasPlayers = Boolean(issue?.winnerName && issue?.loserName);

    if (hasPlayers) {
        const label =
            issue.winnerCastle && issue.loserCastle
                ? `${issue.winnerCastle} against ${issue.loserCastle}`
                : `${issue.winnerName} against ${issue.loserName}`;
        const [scoreLeft, scoreRight] = String(orientGazetteScoreline(issue.scoreline) || '').split(/[–-]/);
        return (
            <div className={classes.matchArt} role="img" aria-label={label}>
                <div
                    className={classes.matchBgLeft}
                    style={{
                        backgroundImage: castleBackground(winnerSrc, issue.winnerColor, 'left'),
                        backgroundSize: winnerSrc ? 'auto, cover' : 'auto',
                        backgroundPosition: 'left center'
                    }}
                    aria-hidden="true"
                />
                <div
                    className={classes.matchBgRight}
                    style={{
                        backgroundImage: castleBackground(loserSrc, issue.loserColor, 'right'),
                        backgroundSize: loserSrc ? 'auto, cover' : 'auto',
                        backgroundPosition: 'right center'
                    }}
                    aria-hidden="true"
                />
                <div className={classes.matchDivider} aria-hidden="true" />
                <div
                    className={`${classes.matchScoreBar} ${
                        issue.winnerColor === 'blue' ? classes.matchScoreBarBlueLead : classes.matchScoreBarRedLead
                    }`}
                >
                    <GazettePlayer
                        name={issue.winnerName}
                        stars={issue.winnerStars}
                        color={issue.winnerColor}
                        avatar={winnerAvatar}
                        align="start"
                    />
                    <div className={classes.matchCenter}>
                        <span className={classes.matchScore}>{scoreLeft || '—'}</span>
                        <span className={classes.matchScoreDash} aria-hidden="true">
                            ⚔️
                        </span>
                        <span className={classes.matchScore}>{scoreRight || '—'}</span>
                    </div>
                    <GazettePlayer
                        name={issue.loserName}
                        stars={issue.loserStars}
                        color={issue.loserColor}
                        avatar={loserAvatar}
                        align="end"
                    />
                </div>
                {issue.winnerCastle || issue.loserCastle ? (
                    <div className={classes.matchTownRow}>
                        <span>
                            {issue.winnerCastle}
                            {issue.winnerColor ? ` · ${issue.winnerColor}` : ''}
                        </span>
                        <span>
                            {issue.loserCastle}
                            {issue.loserColor ? ` · ${issue.loserColor}` : ''}
                        </span>
                    </div>
                ) : null}
            </div>
        );
    }

    if (winnerSrc && loserSrc) {
        return (
            <div
                className={classes.artTowns}
                role="img"
                aria-label={`${issue.winnerCastle} against ${issue.loserCastle}`}
            >
                <figure className={classes.artTown}>
                    <img src={winnerSrc} alt="" />
                    <figcaption className={classes.artCaption}>{issue.winnerCastle}</figcaption>
                </figure>
                <span className={classes.artVs} aria-hidden="true">
                    vs
                </span>
                <figure className={classes.artTown}>
                    <img src={loserSrc} alt="" />
                    <figcaption className={classes.artCaption}>{issue.loserCastle}</figcaption>
                </figure>
            </div>
        );
    }

    return (
        <img
            className={classes.art}
            src={winnerSrc || fallbackSrc}
            alt={winnerSrc && issue?.winnerCastle ? issue.winnerCastle : ''}
        />
    );
};

const TOPIC_LIMIT = 8;

const Gazette = ({ variant = 'home' }) => {
    const authCtx = useContext(AuthContext);
    const isAdmin = Boolean(authCtx.isAdmin);
    const isPage = variant === 'page';
    const { issueId } = useParams();
    const navigate = useNavigate();
    const [published, setPublished] = useState(null);
    const [draft, setDraft] = useState(null);
    const [facts, setFacts] = useState(null);
    const [issues, setIssues] = useState([]);
    const [headline, setHeadline] = useState('');
    const [body, setBody] = useState('');
    const [selectedEventId, setSelectedEventId] = useState('');
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState('');

    const selectedArchive = isPage && issueId ? issues.find((issue) => String(issue.id) === String(issueId)) : null;
    const viewingArchive = Boolean(selectedArchive);
    const publicIssue = published && !isGazetteTickerCopy(published) ? published : null;
    const draftMatchesTopic = Boolean(draft && selectedEventId && draft.eventId === selectedEventId);
    const topicPreview =
        isPage && isAdmin && selectedEventId && !viewingArchive ? previewGazetteIssue(facts, selectedEventId) : null;
    const stored = viewingArchive
        ? selectedArchive
        : isPage && isAdmin
          ? draftMatchesTopic
            ? draft
            : topicPreview || draft || publicIssue
          : publicIssue;
    const viewing = resolveGazetteIssue(stored, facts);
    const topics = sortGazetteEvents(facts?.events).slice(0, TOPIC_LIMIT);
    const unpublished = unpublishedGazetteEvents(facts, published?.eventId);
    const newsCount = unpublished.length;
    const showNewsroom = isAdmin && isPage;
    const editingPaper = showNewsroom && draftMatchesTopic && !viewingArchive;

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            setLoading(true);
            try {
                const [current, nextFacts] = await Promise.all([fetchGazetteCurrent(), fetchGazetteFacts()]);
                const nextIssues = isPage ? await fetchGazetteIssues() : [];
                let nextDraft = null;
                if (isAdmin && isPage) {
                    nextDraft = await fetchGazetteDraft();
                }
                if (!cancelled) {
                    setPublished(current);
                    const usableDraft = nextDraft && !isGazetteTickerCopy(nextDraft) ? nextDraft : null;
                    setDraft(usableDraft);
                    setFacts(nextFacts);
                    setIssues(nextIssues);
                    const nextUnpublished = unpublishedGazetteEvents(nextFacts, current?.eventId);
                    const nextEventId =
                        usableDraft?.eventId || nextUnpublished[0]?.eventId || nextFacts?.events?.[0]?.eventId || '';
                    setSelectedEventId(nextEventId);
                    const preview = nextEventId ? previewGazetteIssue(nextFacts, nextEventId) : null;
                    const issue =
                        usableDraft ||
                        (preview && preview.story !== 'idle' ? preview : null) ||
                        (current && !isGazetteTickerCopy(current) ? current : null);
                    setHeadline(issue?.headline || '');
                    setBody(issue?.body || '');
                    if (!usableDraft && preview && preview.story !== 'idle') {
                        setDraft(preview);
                    }
                }
            } catch (error) {
                console.error('Gazette load failed:', error);
                if (!cancelled) {
                    setPublished(null);
                    setDraft(null);
                    setIssues([]);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        load();
        return () => {
            cancelled = true;
        };
    }, [isAdmin, isPage]);

    const applyIssue = (issue, asDraft) => {
        if (asDraft) {
            setDraft(issue);
        } else {
            setPublished(issue);
            setDraft(null);
            if (issue) {
                setIssues((current) => [issue, ...current.filter((item) => item.id !== issue.id)]);
            }
        }
        setHeadline(issue?.headline || '');
        setBody(issue?.body || '');
        if (issue?.eventId) {
            setSelectedEventId(issue.eventId);
        }
    };

    const showTopic = (eventId) => {
        if (issueId) {
            navigate('/gazette');
        }
        setSelectedEventId(eventId);
        const preview = previewGazetteIssue(facts, eventId);
        if (!preview || preview.story === 'idle') {
            return;
        }
        setDraft(preview);
        setHeadline(preview.headline);
        setBody(preview.body);
        setStatus('Draft ready for this topic. Publish to put it on the stands.');
    };

    const handleGenerate = async () => {
        if (!selectedEventId) {
            setStatus('Pick a topic first.');
            return;
        }
        if (issueId) {
            navigate('/gazette');
        }
        const preview = previewGazetteIssue(facts, selectedEventId);
        if (preview?.story && preview.story !== 'idle') {
            applyIssue(preview, true);
        }
        setBusy(true);
        setStatus('');
        try {
            const issue = await generateGazetteDraft(selectedEventId);
            const next = isGazetteTickerCopy(issue) ? preview : issue;
            applyIssue(next, true);
            if (next?.story === 'idle') {
                setStatus('That topic is no longer available.');
            } else {
                setStatus(
                    next?.source === 'ai'
                        ? 'Draft written from the selected topic (AI).'
                        : 'Draft written from the selected topic.'
                );
            }
        } catch (error) {
            setStatus(error.message || 'Could not generate a draft.');
        } finally {
            setBusy(false);
        }
    };

    const handlePublish = async () => {
        if (!draft) {
            return;
        }
        const pending = { ...draft, headline, body };
        if (isGazetteTickerCopy(pending)) {
            setStatus('That is the old maps ticker. Pick an upset or gift, then Publish.');
            return;
        }
        setBusy(true);
        setStatus('');
        try {
            const issue = await publishGazetteIssue(pending);
            applyIssue(issue, false);
            setStatus('Gazette published.');
        } catch (error) {
            setStatus(error.message || 'Could not publish.');
        } finally {
            setBusy(false);
        }
    };

    const handleDiscard = async () => {
        setBusy(true);
        setStatus('');
        try {
            await discardGazetteDraft();
            setDraft(null);
            setHeadline(published?.headline || '');
            setBody(published?.body || '');
            setStatus('Draft discarded.');
        } catch (error) {
            setStatus(error.message || 'Could not discard draft.');
        } finally {
            setBusy(false);
        }
    };

    const handleDeleteIssue = async (issue) => {
        if (!issue) {
            return;
        }
        const confirmed = window.confirm(`Delete “${issue.headline}” from the Gazette? This cannot be undone.`);
        if (!confirmed) {
            return;
        }
        setBusy(true);
        setStatus('');
        try {
            const result = await deleteGazetteIssue(issue);
            const nextIssues = isPage ? await fetchGazetteIssues() : [];
            setIssues(nextIssues.filter((item) => !isSameGazetteIssue(item, issue)));
            if (Object.prototype.hasOwnProperty.call(result || {}, 'current')) {
                setPublished(result.current);
            }
            if (issueId && (issue.id === issueId || isSameGazetteIssue(selectedArchive, issue))) {
                navigate('/gazette');
            }
            setStatus('Gazette issue deleted.');
        } catch (error) {
            setStatus(error.message || 'Could not delete that issue.');
        } finally {
            setBusy(false);
        }
    };

    if (loading) {
        return isAdmin || isPage ? (
            <section className={classes.wrap} id="gazette" aria-label="Konoplay Gazette">
                <p className={classes.loading}>Loading Gazette…</p>
            </section>
        ) : null;
    }

    if (!isPage && !publicIssue && !isAdmin) {
        return null;
    }

    if (!isPage && !publicIssue && isAdmin) {
        if (!newsCount) {
            return null;
        }
        return (
            <section className={classes.wrap} id="gazette" aria-label="Konoplay Gazette">
                <p className={classes.newsAlert} role="status">
                    New news can be generated.{' '}
                    <Link className={classes.deskLink} to="/gazette">
                        Open the Gazette desk →
                    </Link>
                </p>
            </section>
        );
    }

    const artSrc = ART_SRC[viewing?.artKey] || konoplayCrest;
    const newsMessage = viewingArchive
        ? 'This is a past issue. Choose On the stands to see what’s published, or pick a topic below to return to the desk.'
        : isPage && isAdmin && selectedEventId && !draftMatchesTopic && topicPreview?.story && topicPreview.story !== 'idle'
          ? 'This is a preview of the selected topic. Generate this story to make it the draft.'
          : draft && newsCount
            ? 'Draft ready. Publish to put it on the stands.'
            : newsCount === 1
              ? 'New news can be generated — 1 topic is waiting.'
              : newsCount > 1
                ? `New news can be generated — ${newsCount} topics are waiting.`
                : '';

    return (
        <section className={classes.wrap} id="gazette" aria-label="Konoplay Gazette">
            <div className={classes.frame}>
                <article className={classes.paper}>
                    <header className={classes.masthead}>
                        <span>News …</span>
                        <span className={classes.mastheadTitle}>Konoplay Gazette</span>
                        <span>{viewing?.dateLabel || '—'}</span>
                    </header>
                    {viewing ? (
                        <>
                            {editingPaper ? (
                                <label className={classes.editLabel}>
                                    Headline
                                    <input
                                        className={classes.headlineInput}
                                        value={headline}
                                        onChange={(event) => setHeadline(event.target.value)}
                                        maxLength={90}
                                    />
                                </label>
                            ) : (
                                <h2 className={classes.headline}>{viewing.headline}</h2>
                            )}
                            <GazetteArt issue={viewing} fallbackSrc={artSrc} />
                            {editingPaper ? (
                                <label className={classes.editLabel}>
                                    Story
                                    <textarea
                                        className={classes.bodyInput}
                                        value={body}
                                        onChange={(event) => setBody(event.target.value)}
                                        maxLength={700}
                                        rows={5}
                                    />
                                </label>
                            ) : (
                                <p className={classes.body}>{viewing.body}</p>
                            )}
                            {viewing.href ? (
                                <Link className={classes.cupLink} to={viewing.href}>
                                    Open this cup →
                                </Link>
                            ) : null}
                        </>
                    ) : (
                        <p className={classes.empty}>
                            {isAdmin
                                ? 'No issue on the stands. Pick a topic below and generate a draft.'
                                : 'The Gazette has not printed yet.'}
                        </p>
                    )}
                </article>
            </div>
            {!isPage && publicIssue ? (
                <p className={classes.archiveHomeLink}>
                    <Link to="/gazette">Read past issues in the Gazette →</Link>
                </p>
            ) : null}
            {!isPage && isAdmin && newsCount ? (
                <p className={classes.newsAlert} role="status">
                    New news can be generated.{' '}
                    <Link className={classes.deskLink} to="/gazette">
                        Open the Gazette desk →
                    </Link>
                </p>
            ) : null}
            {isPage && issues.length > 0 ? (
                <aside className={classes.archive} aria-label="Past Gazette issues">
                    <h3 className={classes.archiveTitle}>Past issues</h3>
                    <ul className={classes.archiveList}>
                        {issues.map((issue, index) => {
                            const issueKey = issue.id || `issue-${index}`;
                            const isCurrent = Boolean(
                                published &&
                                    (issue.id === published.id ||
                                        (issue.id === 'current' && !published.id) ||
                                        (issue.eventId &&
                                            issue.eventId === published.eventId &&
                                            issue.publishedAt === published.publishedAt))
                            );
                            const href =
                                isCurrent || !issue.id || issue.id === 'current'
                                    ? '/gazette'
                                    : `/gazette/${encodeURIComponent(issue.id)}`;
                            const isActive = viewingArchive ? issue.id === selectedArchive.id : isCurrent && !issueId;
                            const mark = isActive && !isCurrent ? 'Viewing' : isCurrent ? 'On the stands' : 'Read';
                            return (
                                <li key={issueKey} className={classes.archiveRow}>
                                    <Link
                                        className={`${classes.archiveItem} ${isActive ? classes.archiveItemActive : ''}`}
                                        to={href}
                                    >
                                        <span className={classes.archiveDate}>{issue.dateLabel || '—'}</span>
                                        <span className={classes.archiveHeadline}>{issue.headline}</span>
                                        <span className={classes.archiveOpen}>{mark}</span>
                                    </Link>
                                    {showNewsroom ? (
                                        <button
                                            type="button"
                                            className={classes.archiveDelete}
                                            onClick={() => handleDeleteIssue(issue)}
                                            disabled={busy}
                                            aria-label={`Delete ${issue.headline}`}
                                        >
                                            Delete
                                        </button>
                                    ) : null}
                                </li>
                            );
                        })}
                    </ul>
                </aside>
            ) : null}
            {showNewsroom ? (
                <div className={classes.adminBar}>
                    {newsMessage ? (
                        <p className={classes.newsAlert} role="status">
                            {newsMessage}
                        </p>
                    ) : null}
                    {topics.length ? (
                        <fieldset className={classes.topics}>
                            <legend className={classes.topicsLegend}>Proposed topics</legend>
                            {topics.map((event) => {
                                const isPublishedTopic = event.eventId === published?.eventId;
                                return (
                                    <label key={event.eventId} className={classes.topic}>
                                        <input
                                            type="radio"
                                            name="gazette-topic"
                                            value={event.eventId}
                                            checked={selectedEventId === event.eventId}
                                            onChange={() => showTopic(event.eventId)}
                                            disabled={busy}
                                        />
                                        <span>
                                            {describeGazetteEvent(event)}
                                            {isPublishedTopic ? (
                                                <span className={classes.topicMark}>On the stands</span>
                                            ) : (
                                                <span className={classes.topicMarkNew}>New</span>
                                            )}
                                        </span>
                                    </label>
                                );
                            })}
                        </fieldset>
                    ) : (
                        <p className={classes.adminHint}>
                            No notable events right now — upsets, $50+ gifts, or a champion.
                        </p>
                    )}
                    <div className={classes.adminActions}>
                        <button
                            type="button"
                            className={classes.adminBtn}
                            onClick={handleGenerate}
                            disabled={busy || !selectedEventId}
                        >
                            {busy ? 'Working…' : 'Generate this story'}
                        </button>
                        <button
                            type="button"
                            className={classes.adminBtnPrimary}
                            onClick={handlePublish}
                            disabled={busy || !draft}
                        >
                            Publish
                        </button>
                        {draft ? (
                            <button type="button" className={classes.adminBtn} onClick={handleDiscard} disabled={busy}>
                                Discard draft
                            </button>
                        ) : null}
                    </div>
                    {status ? (
                        <p className={classes.status} role="status">
                            {status}
                        </p>
                    ) : !newsMessage ? (
                        <p className={classes.adminHint}>
                            Visitors only see a story after you publish. Past issues stay in the Gazette archive.
                        </p>
                    ) : null}
                </div>
            ) : null}
        </section>
    );
};

export default Gazette;
