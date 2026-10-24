import { FIREBASE_DATABASE_URL } from '../config/firebase';
import { authFetch, getAuthToken } from './authFetch';
import { buildSeasonRecord, isValidSeasonId, normalizeSeasonId, parseSeasonList } from '../utils/seasonData';

const seasonsUrl = (seasonId) =>
    seasonId
        ? `${FIREBASE_DATABASE_URL}/seasons/heroes3/${encodeURIComponent(seasonId)}.json`
        : `${FIREBASE_DATABASE_URL}/seasons/heroes3.json`;

const readError = async (response, fallback) => {
    let detail = '';
    try {
        const payload = await response.json();
        if (payload?.error) {
            detail = String(payload.error);
        }
    } catch {
        // Firebase sometimes returns a plain-text error body.
    }

    if (response.status === 401 || response.status === 403) {
        if (!getAuthToken()) {
            return 'Sign in again to save a season.';
        }
        return detail ? `Could not save the season (${detail}). Sign in again if your session has expired.` : fallback;
    }

    return detail || fallback;
};

export const fetchSeasons = async () => {
    const response = await authFetch(seasonsUrl());
    if (!response.ok) {
        throw new Error(await readError(response, 'Failed to load seasons'));
    }
    const data = await response.json();
    return parseSeasonList(data);
};

export const createSeason = async ({ seasonId, name, createdBy, createdByUid }) => {
    const id = normalizeSeasonId(seasonId);
    const seasonName = String(name || '').trim();

    if (!isValidSeasonId(id)) {
        throw new Error('Use a season id like 2026-s1.');
    }
    if (!seasonName) {
        throw new Error('Season name is required.');
    }

    const existingResponse = await authFetch(seasonsUrl(id));
    if (!existingResponse.ok) {
        throw new Error(await readError(existingResponse, 'Could not check that season.'));
    }
    const existing = await existingResponse.json();
    if (existing) {
        throw new Error('That season already exists.');
    }

    const record = buildSeasonRecord({ name: seasonName, createdBy, createdByUid });
    const response = await authFetch(seasonsUrl(id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
    });

    if (!response.ok) {
        throw new Error(await readError(response, 'Could not create the season.'));
    }

    return { id, ...record };
};

export const assignTournamentSeason = async (tournamentId, seasonId) => {
    const nextId = seasonId ? normalizeSeasonId(seasonId) : null;
    if (seasonId && !isValidSeasonId(nextId)) {
        throw new Error('That season id is not valid.');
    }

    const response = await authFetch(
        `${FIREBASE_DATABASE_URL}/tournaments/heroes3/${encodeURIComponent(tournamentId)}/seasonId.json`,
        {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nextId)
        }
    );

    if (!response.ok) {
        throw new Error(await readError(response, 'Could not move this cup into the season.'));
    }

    return nextId;
};
