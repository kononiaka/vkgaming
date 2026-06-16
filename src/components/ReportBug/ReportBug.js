import { useContext, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { submitBugReport } from '../../api/reportBug';
import { getFirebaseUid } from '../../api/authFetch';
import AuthContext from '../../store/auth-context';

import classes from './ReportBug.module.css';

const getDefaultPageUrl = () => {
    if (typeof window === 'undefined') {
        return '';
    }

    return window.location.href;
};

const getScreenSize = () => {
    if (typeof window === 'undefined') {
        return '';
    }

    return `${window.screen.width}x${window.screen.height}`;
};

const ReportBug = () => {
    const authCtx = useContext(AuthContext);
    const defaultPageUrl = useMemo(() => getDefaultPageUrl(), []);

    const [summary, setSummary] = useState('');
    const [description, setDescription] = useState('');
    const [steps, setSteps] = useState('');
    const [pageUrl, setPageUrl] = useState(defaultPageUrl);
    const [severity, setSeverity] = useState('normal');
    const [submitting, setSubmitting] = useState(false);
    const [reportId, setReportId] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');

        if (!summary.trim() || !description.trim()) {
            setError('Please fill in the summary and description.');
            return;
        }

        setSubmitting(true);

        try {
            const result = await submitBugReport({
                summary: summary.trim(),
                description: description.trim(),
                steps: steps.trim(),
                pageUrl: pageUrl.trim(),
                userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
                screenSize: getScreenSize(),
                reporterNickname: authCtx.userNickName || '',
                reporterUid: getFirebaseUid() || '',
                severity
            });

            setReportId(result.reportId || '');
            setSummary('');
            setDescription('');
            setSteps('');
            authCtx.setNotificationShown(true, 'Bug report submitted. Thank you!', 'success', 5);
        } catch (submitError) {
            setError(submitError.message || 'Could not submit bug report.');
        } finally {
            setSubmitting(false);
        }
    };

    if (reportId) {
        return (
            <div className={`${classes.wrapper} data-page`}>
                <header className={classes.pageHeader}>
                    <h1 className={classes.pageTitle}>Report submitted</h1>
                    <p className={classes.pageSubtitle}>
                        Thanks for helping improve Konoplay. Reference ID:{' '}
                        <code className={classes.reportId}>{reportId}</code>
                    </p>
                </header>
                <div className={classes.successPanel}>
                    <p>
                        We received your report and will review it. For urgent tournament issues you can still reach us
                        on <Link to="/help">Help</Link>.
                    </p>
                    <button type="button" className={classes.secondaryBtn} onClick={() => setReportId('')}>
                        Report another issue
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={`${classes.wrapper} data-page`}>
            <header className={classes.pageHeader}>
                <div>
                    <h1 className={classes.pageTitle}>Report a bug</h1>
                    <p className={classes.pageSubtitle}>
                        Found something broken on Konoplay? Send details here — we auto-attach the page URL and browser
                        info to speed up fixes.
                    </p>
                </div>
            </header>

            <section className={classes.infoPanel}>
                <p className={classes.infoLead}>
                    {authCtx.isLogged ? (
                        <>
                            Reporting as <strong>{authCtx.userNickName}</strong>.
                        </>
                    ) : (
                        <>
                            You can report without logging in. <Link to="/auth">Sign in with Twitch</Link> if the bug
                            affects your account.
                        </>
                    )}
                </p>
            </section>

            <form className={classes.form} onSubmit={handleSubmit}>
                <label className={classes.field}>
                    <span className={classes.label}>Short summary</span>
                    <input
                        type="text"
                        className={classes.input}
                        value={summary}
                        onChange={(event) => setSummary(event.target.value)}
                        placeholder="e.g. Bracket does not load on mobile"
                        maxLength={160}
                        required
                    />
                </label>

                <label className={classes.field}>
                    <span className={classes.label}>What happened?</span>
                    <textarea
                        className={classes.textarea}
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        placeholder="Describe what you expected vs what you saw."
                        rows={5}
                        maxLength={4000}
                        required
                    />
                </label>

                <label className={classes.field}>
                    <span className={classes.label}>Steps to reproduce (optional)</span>
                    <textarea
                        className={classes.textarea}
                        value={steps}
                        onChange={(event) => setSteps(event.target.value)}
                        placeholder="1. Open Live Arena&#10;2. Click Watch&#10;3. ..."
                        rows={4}
                        maxLength={2000}
                    />
                </label>

                <div className={classes.fieldRow}>
                    <label className={classes.field}>
                        <span className={classes.label}>Severity</span>
                        <select
                            className={classes.select}
                            value={severity}
                            onChange={(event) => setSeverity(event.target.value)}
                        >
                            <option value="low">Low — cosmetic / minor</option>
                            <option value="normal">Normal — feature broken</option>
                            <option value="high">High — blocks play or login</option>
                        </select>
                    </label>

                    <label className={classes.field}>
                        <span className={classes.label}>Page URL</span>
                        <input
                            type="url"
                            className={classes.input}
                            value={pageUrl}
                            onChange={(event) => setPageUrl(event.target.value)}
                            readOnly={false}
                        />
                    </label>
                </div>

                {error ? (
                    <p className={classes.error} role="alert">
                        {error}
                    </p>
                ) : null}

                <div className={classes.actions}>
                    <button type="submit" className={classes.submitBtn} disabled={submitting}>
                        {submitting ? 'Sending…' : 'Submit bug report'}
                    </button>
                    <Link to="/help" className={classes.helpLink}>
                        Need help instead?
                    </Link>
                </div>
            </form>
        </div>
    );
};

export default ReportBug;
