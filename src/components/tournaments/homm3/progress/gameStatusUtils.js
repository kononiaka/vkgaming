// Utility to determine and update gameStatus for partial progress

export function computeGameStatusFromProgress(game) {
    // If the game is fully processed, keep as 'Processed'
    if (game.gameStatus === 'Processed') {
        return 'Processed';
    }
    // If the game is finished (winner set, all required fields set), keep as 'Finished'
    if (game.gameStatus === 'Finished') {
        return 'Finished';
    }

    // If any progress field is set, but not all required for 'Processed', mark as 'PartiallyProcessed'
    const progress = game.progress || {};
    const hasAnyProgress = Object.keys(progress).some(
        (k) => progress[k] !== undefined && progress[k] !== null && progress[k] !== ''
    );
    if (hasAnyProgress) {
        return 'PartiallyProcessed';
    }

    // Otherwise, use default logic
    return game.gameStatus || 'In Progress';
}

export function updateGameStatusForPartialProgress(game) {
    const newStatus = computeGameStatusFromProgress(game);
    if (game.gameStatus !== newStatus) {
        game.gameStatus = newStatus;
    }
    return game;
}
