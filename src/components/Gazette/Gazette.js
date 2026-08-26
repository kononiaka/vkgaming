import { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    discardGazetteDraft,
    fetchGazetteCurrent,
    fetchGazetteDraft,
    generateGazetteDraft,
    publishGazetteIssue
} from '../../api/gazette';
import castleImg from '../../image/castles/castle.jpeg';
import konoplayCrest from '../../image/konoplay-crest.png';
import AuthContext from '../../store/auth-context';
import classes from './Gazette.module.css';

const ART_SRC = {
    crest: konoplayCrest,
    castle: castleImg,
    gold: konoplayCrest,
    finals: konoplayCrest,
    registration: castleImg
};

const Gazette = () => {
    const authCtx = useContext(AuthContext);
    const isAdmin = Boolean(authCtx.isAdmin);
    const [published, setPublished] = useState(null);
    const [draft, setDraft] = useState(null);
    const [headline, setHeadline] = useState('');
    const [body, setBody] = useState('');
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState('');

    const viewing = draft || published;

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            setLoading(true);
            try {
                const current = await fetchGazetteCurrent();
                let nextDraft = null;
                if (isAdmin) {
                    nextDraft = await fetchGazetteDraft();
                }
                if (!cancelled) {
                    setPublished(current);
                    setDraft(nextDraft);
                    const issue = nextDraft || current;
                    setHeadline(issue?.headline || '');
                    setBody(issue?.body || '');
                }
            } catch (error) {
                console.error('Gazette load failed:', error);
                if (!cancelled) {
                    setPublished(null);
                    setDraft(null);
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
    }, [isAdmin]);

    const applyIssue = (issue, asDraft) => {
        if (asDraft) {
            setDraft(issue);
        } else {
            setPublished(issue);
            setDraft(null);
        }
        setHeadline(issue?.headline || '');
        setBody(issue?.body || '');
    };

    const handleGenerate = async () => {
        setBusy(true);
        setStatus('');
        try {
            const issue = await generateGazetteDraft();
            applyIssue(issue, true);
            setStatus(issue.source === 'ai' ? 'Draft written from live cups (AI).' : 'Draft written from live cups.');
        } catch (error) {
            setStatus(error.message || 'Could not generate a draft.');
        } finally {
            setBusy(false);
        }
    };

    const handlePublish = async () => {
        if (!viewing) {
            return;
        }
        setBusy(true);
        setStatus('');
        try {
            const issue = await publishGazetteIssue({
                ...viewing,
                headline,
                body
            });
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

    if (loading) {
        return isAdmin ? (
            <section className={classes.wrap} aria-label="Konoplay Gazette">
                <p className={classes.loading}>Loading Gazette…</p>
            </section>
        ) : null;
    }

    if (!viewing && !isAdmin) {
        return null;
    }

    const artSrc = ART_SRC[viewing?.artKey] || konoplayCrest;

    return (
        <section className={classes.wrap} aria-label="Konoplay Gazette">
            <div className={classes.frame}>
                <article className={classes.paper}>
                    <header className={classes.masthead}>
                        <span>News …</span>
                        <span className={classes.mastheadTitle}>Konoplay Gazette</span>
                        <span>{viewing?.dateLabel || '—'}</span>
                    </header>
                    {viewing ? (
                        <>
                            {isAdmin && draft ? (
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
                            <img className={classes.art} src={artSrc} alt="" />
                            {isAdmin && draft ? (
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
                                    Continue on the cup page →
                                </Link>
                            ) : null}
                        </>
                    ) : (
                        <p className={classes.empty}>No issue on the stands. Generate a draft from the live cups.</p>
                    )}
                </article>
            </div>
            {isAdmin ? (
                <div className={classes.adminBar}>
                    <button type="button" className={classes.adminBtn} onClick={handleGenerate} disabled={busy}>
                        {busy ? 'Working…' : 'Generate new'}
                    </button>
                    <button
                        type="button"
                        className={classes.adminBtnPrimary}
                        onClick={handlePublish}
                        disabled={busy || !viewing}
                    >
                        Publish
                    </button>
                    {draft ? (
                        <button type="button" className={classes.adminBtn} onClick={handleDiscard} disabled={busy}>
                            Discard draft
                        </button>
                    ) : null}
                    {status ? (
                        <p className={classes.status} role="status">
                            {status}
                        </p>
                    ) : (
                        <p className={classes.adminHint}>
                            Generate writes a draft from live cup facts. Publish puts it on the home page.
                        </p>
                    )}
                </div>
            ) : null}
        </section>
    );
};

export default Gazette;
