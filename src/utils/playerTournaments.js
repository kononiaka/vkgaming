import { FIREBASE_DATABASE_URL } from '../config/firebase';
import { getTournamentPrizeLabel } from '../api/api';
import { findRegisteredPlayerKey } from '../api/tournamentRegistration';
import { formatTournamentTypeLabel } from './matchFixtureLabels';
import { isPublicTournament } from './tournamentVisibility';
import { isRegistrationOpen } from './tournamentAttendance';
import { formatMatchSchedule } from '../components/tournaments/homm3/matchScheduleUtils';

const showsPlannedTournamentStart = (status) => status !== 'Started!' && !String(status || '').includes('Finished');

const formatOrdinal = (place) => {
    const value = Number(place);
    if (!Number.isFinite(value)) {
        return String(place);
    }

    const mod100 = value % 100;
    if (mod100 >= 11 && mod100 <= 13) {
        return `${value}th`;
    }

    switch (value % 10) {
        case 1:
            return `${value}st`;
        case 2:
            return `${value}nd`;
        case 3:
            return `${value}rd`;
        default:
            return `${value}th`;
    }
};

export const formatTournamentStatusLabel = (status) => {
    if (!status) {
        return 'Unknown';
    }

    if (status === 'Registration' || status === 'Registration Started') {
        return 'Registration open';
    }

    if (status === 'Registration finished!') {
        return 'Ready to start';
    }

    if (status === 'Pending funding') {
        return 'Pending funding';
    }

    if (status === 'Started!') {
        return 'In progress';
    }

    if (String(status).includes('Finished')) {
        return 'Finished';
    }

    return status;
};

export const getTournamentStatusQuery = (status) => {
    if (status === 'Registration' || status === 'Registration Started') {
        return 'registration';
    }

    if (status === 'Registration finished!') {
        return 'registrationFinished';
    }

    if (status === 'Started!') {
        return 'started';
    }

    if (status && String(status).includes('Finished')) {
        return 'finished';
    }

    return 'all';
};

export const getTournamentProfileLink = (tournamentId, status) =>
    `/tournaments/homm3/${tournamentId}?status=${getTournamentStatusQuery(status)}`;

export const isPlayerRegisteredInTournament = (tournament, player) => {
    if (!tournament?.players || !player) {
        return false;
    }

    return Boolean(
        findRegisteredPlayerKey(tournament.players, {
            nickname: player.enteredNickname || player.name,
            firebaseUid: player.registeredUid || null
        }) ||
            (player.id &&
                Object.values(tournament.players).some((entry) => entry?.siteUserId && entry.siteUserId === player.id))
    );
};

export const getPlayerTournamentResultLabel = (tournament, playerName) => {
    const normalizedName = String(playerName || '').trim();
    if (!normalizedName || !tournament) {
        return null;
    }

    if (tournament.winners && typeof tournament.winners === 'object') {
        for (const [place, winner] of Object.entries(tournament.winners)) {
            if (String(winner || '').trim() === normalizedName) {
                return `${formatOrdinal(place)} place`;
            }
        }
    }

    if (String(tournament.winner || '').trim() === normalizedName) {
        return 'Winner';
    }

    return null;
};

const getStatusSortRank = (status) => {
    if (status === 'Started!') {
        return 0;
    }

    if (isRegistrationOpen(status)) {
        return 1;
    }

    if (status === 'Registration finished!' || status === 'Pending funding') {
        return 2;
    }

    if (String(status || '').includes('Finished')) {
        return 4;
    }

    return 3;
};

const parseTournamentDateMs = (dateValue) => {
    if (!dateValue) {
        return 0;
    }

    const parsed = new Date(dateValue).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
};

export const collectPlayerTournaments = (tournamentsData, player, { includePrivateTournaments = false } = {}) => {
    if (!tournamentsData || !player) {
        return [];
    }

    const playerIdentity = {
        enteredNickname: player.enteredNickname || player.name,
        registeredUid: player.registeredUid || null,
        id: player.id || player.siteUserId || null
    };

    const tournaments = [];

    Object.entries(tournamentsData).forEach(([tournamentId, tournament]) => {
        if (!tournament || typeof tournament !== 'object') {
            return;
        }

        if (!includePrivateTournaments && !isPublicTournament(tournament)) {
            return;
        }

        if (!isPlayerRegisteredInTournament(tournament, playerIdentity)) {
            return;
        }

        const status = tournament.status || '';
        const resultLabel = getPlayerTournamentResultLabel(tournament, playerIdentity.enteredNickname);

        tournaments.push({
            id: tournamentId,
            name: tournament.name || 'Untitled tournament',
            status,
            statusLabel: formatTournamentStatusLabel(status),
            typeLabel: formatTournamentTypeLabel(tournament.type),
            date: tournament.date && showsPlannedTournamentStart(status) ? formatMatchSchedule(tournament.date) : null,
            prizePoolLabel: getTournamentPrizeLabel(tournament),
            link: getTournamentProfileLink(tournamentId, status),
            resultLabel,
            isPrivate: !isPublicTournament(tournament)
        });
    });

    return tournaments.sort((a, b) => {
        const rankDiff = getStatusSortRank(a.status) - getStatusSortRank(b.status);
        if (rankDiff !== 0) {
            return rankDiff;
        }

        return parseTournamentDateMs(b.date) - parseTournamentDateMs(a.date);
    });
};

export const fetchPlayerTournaments = async (
    player,
    { includePrivateTournaments = false, firebaseUrl = FIREBASE_DATABASE_URL } = {}
) => {
    if (!player?.enteredNickname && !player?.name) {
        return [];
    }

    const response = await fetch(`${firebaseUrl}/tournaments/heroes3.json`);
    if (!response.ok) {
        return [];
    }

    const tournamentsData = await response.json();
    return collectPlayerTournaments(tournamentsData, player, { includePrivateTournaments });
};
