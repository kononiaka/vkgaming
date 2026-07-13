import { useCallback, useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    approveCommentatorRequest,
    loadProfileCommentatorRequests,
    rejectCommentatorRequest
} from '../../api/tournamentCommentators';
import { getFirebaseUid } from '../../api/authFetch';
import AuthContext from '../../store/auth-context';
import { flattenProfileCommentatorRequests } from '../../utils/tournamentCommentators';
import { getTwitchWatchUrl } from '../../utils/twitchUtils';
import classes from './ProfileCommentatorRequestsSection.module.css';

const ProfileCommentatorRequestsSection = ({ userId }) => {
    const authCtx = useContext(AuthContext);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionKey, setActionKey] = useState(null);

    const refreshRequests = useCallback(async () => {
        if (!userId) {
            setRequests([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const profileRequests = await loadProfileCommentatorRequests(userId);
            setRequests(flattenProfileCommentatorRequests(profileRequests));
        } catch (error) {
            console.error('Failed to load profile commentator requests:', error);
            setRequests([]);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        refreshRequests();
    }, [refreshRequests]);

    const handleApprove = async (request) => {
        const key = `${request.tournamentId}:approve:${request.requestId}`;
        setActionKey(key);
        try {
            await approveCommentatorRequest(request.tournamentId, request.requestId, request, getFirebaseUid(), {
                creatorUid: userId
            });
            authCtx.setNotificationShown(true, `${request.name} approved as commentator.`, 'success', 4);
            await refreshRequests();
        } catch (error) {
            authCtx.setNotificationShown(true, error.message || 'Could not approve commentator.', 'error', 5);
        } finally {
            setActionKey(null);
        }
    };

    const handleReject = async (request) => {
        const key = `${request.tournamentId}:reject:${request.requestId}`;
        setActionKey(key);
        try {
            await rejectCommentatorRequest(request.tournamentId, request.requestId, { creatorUid: userId });
            authCtx.setNotificationShown(true, `${request.name} request rejected.`, 'success', 4);
            await refreshRequests();
        } catch (error) {
            authCtx.setNotificationShown(true, error.message || 'Could not reject commentator request.', 'error', 5);
        } finally {
            setActionKey(null);
        }
    };

    if (loading) {
        return null;
    }

    if (requests.length === 0) {
        return null;
    }

    return (
        <section className={classes.section}>
            <h2 className={classes.title}>Commentator requests</h2>
            <p className={classes.hint}>
                Streamers applied to commentate cups you host. Review them here or on each tournament page.
            </p>
            <ul className={classes.list}>
                {requests.map((request) => {
                    const approveKey = `${request.tournamentId}:approve:${request.requestId}`;
                    const rejectKey = `${request.tournamentId}:reject:${request.requestId}`;
                    const twitchUrl = getTwitchWatchUrl(request.twitchLogin);

                    return (
                        <li key={`${request.tournamentId}:${request.requestId}`} className={classes.item}>
                            <div className={classes.meta}>
                                <Link
                                    to={`/tournaments/homm3/${request.tournamentId}`}
                                    className={classes.tournamentLink}
                                >
                                    {request.tournamentName}
                                </Link>
                                <span className={classes.applicant}>{request.name}</span>
                                {twitchUrl ? (
                                    <a href={twitchUrl} target="_blank" rel="noreferrer" className={classes.twitchLink}>
                                        @{request.twitchLogin}
                                    </a>
                                ) : null}
                            </div>
                            <div className={classes.actions}>
                                <button
                                    type="button"
                                    className={`${classes.btn} ${classes.btnSuccess}`}
                                    disabled={actionKey === approveKey}
                                    onClick={() => handleApprove(request)}
                                >
                                    {actionKey === approveKey ? 'Approving…' : 'Approve'}
                                </button>
                                <button
                                    type="button"
                                    className={`${classes.btn} ${classes.btnDanger}`}
                                    disabled={actionKey === rejectKey}
                                    onClick={() => handleReject(request)}
                                >
                                    {actionKey === rejectKey ? 'Rejecting…' : 'Reject'}
                                </button>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
};

export default ProfileCommentatorRequestsSection;
