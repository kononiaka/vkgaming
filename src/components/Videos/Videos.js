/* global process */

import { useEffect, useState } from 'react';
import classes from './Videos.module.css';

const YOUTUBE_API_KEY = process.env.REACT_APP_YOUTUBE_API_KEY;
const YOUTUBE_CHANNEL_ID = process.env.REACT_APP_YOUTUBE_CHANNEL_ID;
const YOUTUBE_UPLOADS_PLAYLIST_ID = process.env.REACT_APP_YOUTUBE_UPLOADS_PLAYLIST_ID;
const YOUTUBE_EXCLUDED_VIDEO_IDS = process.env.REACT_APP_YOUTUBE_EXCLUDED_VIDEO_IDS;
const YOUTUBE_MAX_RESULTS = 12;
const HIDDEN_VIDEOS_STORAGE_KEY = 'videos-hidden-ids';

const excludedVideoIds = new Set(
    (YOUTUBE_EXCLUDED_VIDEO_IDS || '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
);

const createVideoUrl = (videoId) => `https://www.youtube.com/watch?v=${videoId}`;
const formatCount = (value) => {
    const numericValue = Number(value);

    if (Number.isNaN(numericValue)) {
        return '-';
    }

    return String(numericValue).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

const getStoredHiddenVideoIds = () => {
    try {
        const storedValue = window.localStorage.getItem(HIDDEN_VIDEOS_STORAGE_KEY);

        if (!storedValue) {
            return [];
        }

        const parsedValue = JSON.parse(storedValue);
        return Array.isArray(parsedValue) ? parsedValue : [];
    } catch (error) {
        return [];
    }
};

const Videos = () => {
    const [videos, setVideos] = useState([]);
    const [nextPageToken, setNextPageToken] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState('');
    const [viewMode, setViewMode] = useState('list');
    const [hiddenVideoIds, setHiddenVideoIds] = useState(getStoredHiddenVideoIds);

    const fetchUploadsPlaylistId = async () => {
        const params = new window.URLSearchParams({
            part: 'contentDetails',
            id: YOUTUBE_CHANNEL_ID || '',
            key: YOUTUBE_API_KEY || ''
        });

        const response = await window.fetch(`https://www.googleapis.com/youtube/v3/channels?${params.toString()}`);

        if (!response.ok) {
            throw new Error('Failed to fetch channel information from YouTube API.');
        }

        const data = await response.json();
        const uploadsId = data?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

        if (!uploadsId) {
            throw new Error('Uploads playlist was not found for this channel ID.');
        }

        return uploadsId;
    };

    const fetchVideoStats = async (videoIds) => {
        if (!videoIds.length) {
            return {};
        }

        const params = new window.URLSearchParams({
            part: 'statistics',
            id: videoIds.join(','),
            key: YOUTUBE_API_KEY || ''
        });

        const response = await window.fetch(`https://www.googleapis.com/youtube/v3/videos?${params.toString()}`);

        if (!response.ok) {
            throw new Error('Failed to fetch video statistics from YouTube API.');
        }

        const data = await response.json();

        return (data?.items || []).reduce((acc, item) => {
            acc[item.id] = {
                viewCount: item?.statistics?.viewCount,
                likeCount: item?.statistics?.likeCount,
                commentCount: item?.statistics?.commentCount
            };

            return acc;
        }, {});
    };

    const fetchVideos = async (pageToken = '', append = false) => {
        try {
            if (append) {
                setLoadingMore(true);
            } else {
                setLoading(true);
            }

            setError('');

            if (!YOUTUBE_API_KEY) {
                throw new Error('Missing REACT_APP_YOUTUBE_API_KEY in environment variables.');
            }

            const playlistId = YOUTUBE_UPLOADS_PLAYLIST_ID || (await fetchUploadsPlaylistId());

            const params = new window.URLSearchParams({
                part: 'snippet',
                playlistId,
                maxResults: String(YOUTUBE_MAX_RESULTS),
                key: YOUTUBE_API_KEY
            });

            if (pageToken) {
                params.set('pageToken', pageToken);
            }

            const response = await window.fetch(
                `https://www.googleapis.com/youtube/v3/playlistItems?${params.toString()}`
            );

            if (!response.ok) {
                throw new Error('Failed to fetch videos from YouTube API.');
            }

            const data = await response.json();

            const mappedVideos = (data?.items || [])
                .map((item) => {
                    const snippet = item?.snippet;
                    const videoId = snippet?.resourceId?.videoId;

                    if (!snippet || !videoId) {
                        return null;
                    }

                    return {
                        id: item.id,
                        videoId,
                        title: snippet.title || 'Untitled video',
                        publishedAt: snippet.publishedAt,
                        thumbnail:
                            snippet?.thumbnails?.high?.url ||
                            snippet?.thumbnails?.medium?.url ||
                            snippet?.thumbnails?.default?.url ||
                            ''
                    };
                })
                .filter(Boolean);

            const filteredVideos = mappedVideos.filter((video) => !excludedVideoIds.has(video.videoId));

            const statsByVideoId = await fetchVideoStats(filteredVideos.map((video) => video.videoId));

            const videosWithStats = filteredVideos.map((video) => ({
                ...video,
                viewCount: statsByVideoId?.[video.videoId]?.viewCount,
                likeCount: statsByVideoId?.[video.videoId]?.likeCount,
                commentCount: statsByVideoId?.[video.videoId]?.commentCount
            }));

            setVideos((prevVideos) => (append ? [...prevVideos, ...videosWithStats] : videosWithStats));
            setNextPageToken(data?.nextPageToken || '');
        } catch (fetchError) {
            setError(fetchError.message || 'Unknown error while loading videos.');
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    useEffect(() => {
        fetchVideos();
    }, []);

    useEffect(() => {
        window.localStorage.setItem(HIDDEN_VIDEOS_STORAGE_KEY, JSON.stringify(hiddenVideoIds));
    }, [hiddenVideoIds]);

    const hideVideo = (videoId) => {
        setHiddenVideoIds((prevHiddenVideoIds) => {
            if (prevHiddenVideoIds.includes(videoId)) {
                return prevHiddenVideoIds;
            }

            return [...prevHiddenVideoIds, videoId];
        });
    };

    const resetHiddenVideos = () => {
        setHiddenVideoIds([]);
    };

    const visibleVideos = videos.filter((video) => !hiddenVideoIds.includes(video.videoId));

    if (loading) {
        return <div className={classes.status}>Loading videos...</div>;
    }

    if (error) {
        return (
            <div className={classes.statusError}>
                <p>{error}</p>
                <p className={classes.helpText}>
                    Set <strong>REACT_APP_YOUTUBE_API_KEY</strong> and either
                    <strong> REACT_APP_YOUTUBE_UPLOADS_PLAYLIST_ID</strong> or
                    <strong> REACT_APP_YOUTUBE_CHANNEL_ID</strong>.
                </p>
            </div>
        );
    }

    return (
        <section className={classes.wrapper}>
            <h2 className={classes.title}>Latest YouTube Videos</h2>

            <div className={classes.viewControls}>
                <button
                    type="button"
                    className={`${classes.viewButton} ${viewMode === 'grid' ? classes.activeView : ''}`}
                    onClick={() => setViewMode('grid')}
                >
                    Grid
                </button>
                <button
                    type="button"
                    className={`${classes.viewButton} ${viewMode === 'list' ? classes.activeView : ''}`}
                    onClick={() => setViewMode('list')}
                >
                    List
                </button>
                <button
                    type="button"
                    className={classes.viewButton}
                    onClick={resetHiddenVideos}
                    disabled={!hiddenVideoIds.length}
                >
                    Show Hidden {hiddenVideoIds.length ? `(${hiddenVideoIds.length})` : ''}
                </button>
            </div>

            {!visibleVideos.length && <p className={classes.status}>No videos found on this channel.</p>}

            <div className={`${classes.grid} ${viewMode === 'list' ? classes.list : ''}`}>
                {visibleVideos.map((video) => (
                    <article
                        key={video.id}
                        className={`${classes.card} ${viewMode === 'list' ? classes.listCard : ''}`}
                    >
                        <a
                            href={createVideoUrl(video.videoId)}
                            target="_blank"
                            rel="noreferrer"
                            className={classes.cardLink}
                        >
                            {video.thumbnail && (
                                <img src={video.thumbnail} alt={video.title} className={classes.thumbnail} />
                            )}
                            <div className={classes.cardBody}>
                                <h3 className={classes.videoTitle}>{video.title}</h3>
                                {video.publishedAt && (
                                    <p className={classes.date}>{new Date(video.publishedAt).toLocaleDateString()}</p>
                                )}
                                <div className={classes.statsRow}>
                                    <span className={classes.statItem}>Views: {formatCount(video.viewCount)}</span>
                                    <span className={`${classes.statItem} ${classes.statWithIcon}`}>
                                        <svg
                                            className={classes.statIcon}
                                            viewBox="0 0 24 24"
                                            role="img"
                                            aria-label="Likes"
                                        >
                                            <path
                                                d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5A4.5 4.5 0 0 1 6.5 4C8.24 4 9.91 4.81 11 6.09 12.09 4.81 13.76 4 15.5 4A4.5 4.5 0 0 1 20 8.5c0 3.78-3.4 6.86-8.55 11.54z"
                                                fill="currentColor"
                                            />
                                        </svg>
                                        {formatCount(video.likeCount)}
                                    </span>
                                    <span className={`${classes.statItem} ${classes.statWithIcon}`}>
                                        <svg
                                            className={classes.statIcon}
                                            viewBox="0 0 24 24"
                                            role="img"
                                            aria-label="Comments"
                                        >
                                            <path
                                                d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
                                                fill="currentColor"
                                            />
                                        </svg>
                                        {formatCount(video.commentCount)}
                                    </span>
                                </div>
                            </div>
                        </a>
                        <div className={classes.cardActions}>
                            <button
                                type="button"
                                className={classes.hideButton}
                                onClick={() => hideVideo(video.videoId)}
                            >
                                Hide
                            </button>
                        </div>
                    </article>
                ))}
            </div>

            {nextPageToken && (
                <div className={classes.actions}>
                    <button
                        type="button"
                        className={classes.loadMoreButton}
                        onClick={() => fetchVideos(nextPageToken, true)}
                        disabled={loadingMore}
                    >
                        {loadingMore ? 'Loading...' : 'Load More'}
                    </button>
                </div>
            )}
        </section>
    );
};

export default Videos;
