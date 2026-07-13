import { setStageLabels } from '../components/tournaments/tournament_api';
import { getDoubleElimStageLabels } from '../components/tournaments/homm3/loserBracketUtils';
import {
    CHAMPIONS_LEAGUE_GROUP_SIZE,
    CHAMPIONS_LEAGUE_QUALIFIERS_PER_GROUP,
    CHAMPIONS_LEAGUE_TWO_GROUP_TYPE,
    getChampionsLeagueGroupCount,
    getKnockoutPlayerCount,
    getKnockoutPlayerCountForType,
    getKnockoutPlayerCountTwoGroup,
    getSecondGroupCount
} from '../components/tournaments/homm3/championsLeagueUtils';
import { calculateSwissTotalRounds } from '../components/tournaments/homm3/swissUtils';

const shortenStageLabel = (label) => {
    const map = {
        '1/32 Final': 'R32',
        '1/16 Final': 'R16',
        '1/8 Final': 'R8',
        'Quarter-final': 'QF',
        'Semi-final': 'SF',
        'Third Place': '3rd',
        Final: 'F',
        'WB Final': 'WB',
        'Grand Final': 'GF',
        'LB Final': 'LB'
    };

    if (map[label]) {
        return map[label];
    }

    if (label.startsWith('LB R')) {
        return label.replace('LB R', 'LB');
    }

    return label;
};

export const getKnockoutRoundColumns = (entrantCount, stageLabels = null) => {
    const entrants = Number(entrantCount);
    if (!Number.isFinite(entrants) || entrants < 2) {
        return [];
    }

    const labels =
        stageLabels ||
        setStageLabels(entrants).filter((label) => label !== 'Third Place' && label !== 'Final');

    const columns = [];
    let matchCount = entrants / 2;

    for (let index = 0; index < labels.length && matchCount >= 1; index++) {
        columns.push({
            label: shortenStageLabel(labels[index]),
            matchCount
        });
        matchCount = Math.floor(matchCount / 2);
    }

    columns.push({
        label: 'F',
        matchCount: 1
    });

    return columns;
};

const buildKnockoutPreview = (maxPlayers, { loserBracket = false, thirdPlace = true } = {}) => {
    if (loserBracket) {
        const labels = getDoubleElimStageLabels(maxPlayers);
        const winnerLabels = labels.filter((label) => !label.startsWith('LB') && label !== 'Grand Final');
        const columns = getKnockoutRoundColumns(maxPlayers, winnerLabels.filter((l) => l !== 'Third Place'));
        return {
            mode: 'knockout',
            title: 'Double elimination',
            columns,
            extraTracks: ['Loser bracket', 'Grand Final'],
            footnote: `${maxPlayers} players · winner + loser paths`
        };
    }

    const labels = setStageLabels(maxPlayers);
    const knockoutLabels = labels.filter((label) => label !== 'Third Place');
    const columns = getKnockoutRoundColumns(maxPlayers, knockoutLabels.slice(0, -1));

    return {
        mode: 'knockout',
        title: 'Knockout bracket',
        columns,
        extraTracks: thirdPlace ? ['3rd place'] : [],
        footnote: `${maxPlayers} players · single elimination`
    };
};

const buildGroupsPhase = (groupCount, subtitle) => ({
    label: `${groupCount}×${CHAMPIONS_LEAGUE_GROUP_SIZE}`,
    subtitle: subtitle || `Groups A–${String.fromCharCode(64 + groupCount)}`,
    type: 'groups'
});

export const buildTournamentFormatPreview = ({
    type,
    maxPlayers,
    loserBracket = false
} = {}) => {
    const players = Number(maxPlayers);

    if (!type || !Number.isFinite(players) || players < 2) {
        return {
            mode: 'empty',
            title: 'Format preview',
            message: 'Choose type and max players to see the tournament path.'
        };
    }

    if (type === 'league') {
        const rounds = Math.max(1, players - 1);
        return {
            mode: 'schedule',
            title: 'Round-robin league',
            phases: [{ label: `${players} players`, subtitle: `${rounds} matchdays`, type: 'league' }],
            footnote: 'Everyone plays everyone · standings decide the winner'
        };
    }

    if (type === 'swiss') {
        const rounds = calculateSwissTotalRounds(players);
        return {
            mode: 'schedule',
            title: 'Swiss system',
            phases: [{ label: `${rounds} rounds`, subtitle: `${players} players`, type: 'swiss' }],
            footnote: 'Pairings by record each round · top standings win'
        };
    }

    if (type === 'cs-swiss') {
        const knockoutSize = Math.max(4, Math.floor(players / 2));
        return {
            mode: 'flow',
            title: 'CS Swiss → playoffs',
            phases: [
                { label: 'Swiss', subtitle: '3W / 3L', type: 'swiss' },
                { label: `${knockoutSize}`, subtitle: 'Qualifiers', type: 'knockout' }
            ],
            columns: getKnockoutRoundColumns(knockoutSize),
            footnote: `${players} players · Swiss phase then knockout`
        };
    }

    if (type === CHAMPIONS_LEAGUE_TWO_GROUP_TYPE) {
        const group1 = getChampionsLeagueGroupCount(players);
        const group2 = getSecondGroupCount(players);
        const knockoutEntrants = getKnockoutPlayerCountTwoGroup(players);
        return {
            mode: 'flow',
            title: 'Two group stages',
            phases: [
                buildGroupsPhase(group1, 'Stage I'),
                buildGroupsPhase(group2, 'Stage II'),
                { label: `${knockoutEntrants}`, subtitle: 'Knockout', type: 'knockout' }
            ],
            columns: getKnockoutRoundColumns(knockoutEntrants),
            footnote: `Top ${CHAMPIONS_LEAGUE_QUALIFIERS_PER_GROUP} per group each stage · UCL 2000–01 style`
        };
    }

    if (type === 'champions-league') {
        const groupCount = getChampionsLeagueGroupCount(players);
        const knockoutEntrants = getKnockoutPlayerCount(players);
        return {
            mode: 'flow',
            title: 'Groups + knockout',
            phases: [buildGroupsPhase(groupCount, 'Group stage'), { label: `${knockoutEntrants}`, subtitle: 'Knockout', type: 'knockout' }],
            columns: getKnockoutRoundColumns(knockoutEntrants),
            footnote: `Top ${CHAMPIONS_LEAGUE_QUALIFIERS_PER_GROUP} per group advance`
        };
    }

    if (type === 'kick-off') {
        return buildKnockoutPreview(players, { loserBracket, thirdPlace: true });
    }

    return buildKnockoutPreview(getKnockoutPlayerCountForType(type, players) || players, {
        loserBracket,
        thirdPlace: true
    });
};
