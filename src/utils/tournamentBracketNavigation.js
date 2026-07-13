import {
    CHAMPIONS_LEAGUE_TWO_GROUP_TYPE,
    isChampionsLeagueType
} from '../components/tournaments/homm3/championsLeagueUtils';

const SCHEDULE_STAGE_PATTERN = /LEAGUE|GROUP|MATCHDAY|ROUND|SWISS/i;

export const normalizePlayoffPairs = (raw) => {
    if (!raw) {
        return [];
    }
    if (Array.isArray(raw)) {
        return raw;
    }
    if (typeof raw === 'object') {
        return Object.keys(raw)
            .filter((key) => /^\d+$/.test(key))
            .sort((a, b) => Number(a) - Number(b))
            .map((key) => raw[key]);
    }
    return [];
};

const isScheduleStageLabel = (stage) => SCHEDULE_STAGE_PATTERN.test(String(stage || ''));

export const inferScheduleView = ({
    type = null,
    playoffPairs = [],
    maxPlayers = 8,
    championsLeaguePhase = 'group',
    isChampionsLeague = false,
    isChampionsLeagueTwoGroup = false
} = {}) => {
    if (type === 'league' || type === 'swiss' || type === 'cs-swiss') {
        return true;
    }

    const twoGroup = isChampionsLeagueTwoGroup || type === CHAMPIONS_LEAGUE_TWO_GROUP_TYPE;

    if (isChampionsLeagueType(type)) {
        return championsLeaguePhase !== 'knockout';
    }

    if (isChampionsLeague && championsLeaguePhase === 'group') {
        return true;
    }

    if (twoGroup && (championsLeaguePhase === 'group1' || championsLeaguePhase === 'group2')) {
        return true;
    }

    const pairs = normalizePlayoffPairs(playoffPairs);
    if (pairs.length !== 1 || !Array.isArray(pairs[0]) || pairs[0].length === 0) {
        return false;
    }

    const stagePairs = pairs[0];
    const firstKnockoutRoundSize = Math.max(1, Math.floor(Number(maxPlayers) / 2));

    if (stagePairs.length > firstKnockoutRoundSize) {
        return true;
    }

    return stagePairs.some((pair) => pair?.round != null || pair?.group || isScheduleStageLabel(pair?.stage));
};

export const getTournamentMatchLink = (match) => {
    const stageIndex = Number(match.stageIndex) || 0;
    const pairIndex = Number(match.pairIndex) || 0;
    const roundParam = match.round != null && match.round !== '' ? `&round=${encodeURIComponent(match.round)}` : '';
    return `/tournaments/homm3/${match.tournamentId}?status=started&stage=${stageIndex}&pair=${pairIndex}${roundParam}&focus=1`;
};

export const pairHasLiveMap = (pair) =>
    Boolean(pair?.games?.some((game) => game?.castle1 && game?.castle2 && !game?.castleWinner));

export const isTestOnlyGame = (game, pair) => Boolean(game?.testOnly || pair?.testReport);

export const countCastleLiveUses = (castleName, pairsData) => {
    let liveGames = 0;

    if (!pairsData || !Array.isArray(pairsData)) {
        return liveGames;
    }

    pairsData.forEach((stage) => {
        if (!Array.isArray(stage)) {
            return;
        }
        stage.forEach((matchPair) => {
            if (!matchPair?.games || !Array.isArray(matchPair.games)) {
                return;
            }
            matchPair.games.forEach((game) => {
                if (isTestOnlyGame(game, matchPair)) {
                    return;
                }
                const isInProgress = game.gameStatus === 'In Progress';
                const hasCastlesNoWinner = game.castle1 && game.castle2 && !game.castleWinner;
                if (
                    (game.castle1 === castleName || game.castle2 === castleName) &&
                    (isInProgress || hasCastlesNoWinner)
                ) {
                    liveGames++;
                }
            });
        });
    });

    return liveGames;
};

export const calculateAvailableCastlesFromBracket = (apiCastles, pairsData) => {
    const castlesWithLiveGames = (apiCastles || []).map((castle) => ({
        ...castle,
        liveGames: countCastleLiveUses(castle.name, pairsData)
    }));

    return [...castlesWithLiveGames].sort((a, b) => a.total - b.total);
};
