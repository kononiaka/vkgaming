// Move all progress-related fields into a nested .progress object inside the game
const PROGRESS_KEYS = [
    'latestProcessedStage',
    'detailedStage',
    '_skipCastleProcessing',
    '_skipGamePost',
    '_skipPrizes',
    '_skipRatings'
];

export function moveProgressFieldsToNested(game) {
    const progress = {};
    const rest = {};
    for (const key in game) {
        if (PROGRESS_KEYS.includes(key)) {
            progress[key] = game[key];
        } else {
            rest[key] = game[key];
        }
    }
    if (Object.keys(progress).length > 0) {
        rest.progress = progress;
    }
    return rest;
}

export function restoreProgressFieldsFromNested(game) {
    if (!game.progress) {
        return game;
    }
    return { ...game, ...game.progress };
}
// Helpers for storing and loading per-game progress fields in a separate DB path

/**
 * Remove all fields starting with _ from a game object (UI-only fields)
 */
export function stripUiFields(game) {
    const clean = {};
    for (const key in game) {
        if (!key.startsWith('_')) {
            clean[key] = game[key];
        }
    }
    return clean;
}

/**
 * Get the DB path for a game's progress fields
 * @param {string} tournamentId
 * @param {string|number} pairId
 * @param {string|number} gameId
 */
export function getGameProgressPath(tournamentId, pairId, gameId) {
    return `/progress/heroes3/${tournamentId}/${pairId}/${gameId}`;
}

/**
 * Save progress fields for a game to the separate DB path
 * @param {string} tournamentId
 * @param {string|number} pairId
 * @param {string|number} gameId
 * @param {object} progressFields
 */
export async function saveGameProgressFields(tournamentId, pairId, gameId, progressFields) {
    const path = getGameProgressPath(tournamentId, pairId, gameId);
    await fetch(`https://test-prod-app-81915-default-rtdb.firebaseio.com${path}.json`, {
        method: 'PUT',
        body: JSON.stringify(progressFields),
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Load progress fields for a game from the separate DB path
 * @param {string} tournamentId
 * @param {string|number} pairId
 * @param {string|number} gameId
 * @returns {object}
 */
export async function loadGameProgressFields(tournamentId, pairId, gameId) {
    const path = getGameProgressPath(tournamentId, pairId, gameId);
    const resp = await fetch(`https://test-prod-app-81915-default-rtdb.firebaseio.com${path}.json`);
    if (resp.ok) {
        return await resp.json();
    }
    return {};
}
