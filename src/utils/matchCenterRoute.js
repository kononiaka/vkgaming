import { extractTwitchLogin } from './twitchUtils';

export const getMatchCenterLink = (match) => {
    if (!match?.tournamentId) {
        return null;
    }

    const stageIndex = Number(match.stageIndex) || 0;
    const pairIndex = Number(match.pairIndex) || 0;
    return `/live/match/${match.tournamentId}/${stageIndex}/${pairIndex}`;
};

export const hasWatchableStreams = (match) =>
    Boolean(
        extractTwitchLogin(match?.commentatorStreamLogin) ||
            extractTwitchLogin(match?.streamLogin) ||
            extractTwitchLogin(match?.team1TwitchLogin) ||
            extractTwitchLogin(match?.team2TwitchLogin)
    );

export const parseMatchCenterParams = (tournamentId, stageIndex, pairIndex) => ({
    tournamentId: String(tournamentId || ''),
    stageIndex: Number(stageIndex) || 0,
    pairIndex: Number(pairIndex) || 0
});
