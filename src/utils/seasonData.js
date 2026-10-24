const SEASON_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const normalizeSeasonId = (value) =>
    String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

export const isValidSeasonId = (seasonId) =>
    SEASON_ID_PATTERN.test(String(seasonId || '')) && String(seasonId).length <= 40;

export const suggestSeasonId = (date = new Date()) => {
    const year = date.getFullYear();
    const half = date.getMonth() < 6 ? 1 : 2;
    return `${year}-s${half}`;
};

export const suggestSeasonName = (seasonId) => {
    const match = /^(\d{4})-s(\d+)$/.exec(String(seasonId || ''));
    if (!match) {
        return '';
    }
    return `${match[1]} Season ${match[2]}`;
};

export const nextAvailableSeasonId = (existingIds = [], date = new Date()) => {
    const year = date.getFullYear();
    let half = date.getMonth() < 6 ? 1 : 2;
    const taken = new Set(existingIds);
    while (taken.has(`${year}-s${half}`)) {
        half += 1;
    }
    return `${year}-s${half}`;
};

export const seasonDisplayName = (season) => String(season?.name || '').trim();

export const buildSeasonRecord = ({ name, createdBy, createdByUid, now = new Date().toISOString() }) => ({
    name: String(name || '').trim(),
    status: 'active',
    createdAt: now,
    createdBy: createdBy || null,
    createdByUid: createdByUid || null
});

export const parseSeasonList = (data) => {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return [];
    }

    return Object.entries(data)
        .filter(([, season]) => season && typeof season === 'object')
        .map(([id, season]) => ({ id, ...season }))
        .sort(
            (a, b) =>
                String(b.createdAt || '').localeCompare(String(a.createdAt || '')) ||
                String(a.name || a.id).localeCompare(String(b.name || b.id))
        );
};

export const groupTournamentsBySeason = (tournaments, seasons) => {
    const seasonById = new Map((seasons || []).map((season) => [season.id, season]));
    const buckets = new Map();
    const unassigned = [];

    (tournaments || []).forEach((tournament) => {
        const seasonId = tournament?.seasonId;
        if (seasonId && seasonById.has(seasonId)) {
            if (!buckets.has(seasonId)) {
                buckets.set(seasonId, []);
            }
            buckets.get(seasonId).push(tournament);
            return;
        }
        unassigned.push(tournament);
    });

    const groups = (seasons || [])
        .filter((season) => buckets.has(season.id))
        .map((season) => ({
            season,
            tournaments: buckets.get(season.id)
        }));

    return { groups, unassigned };
};

export const buildSeasonRows = (tournaments, seasons, seasonFilter) => {
    const list = seasonFilter
        ? (tournaments || []).filter((tournament) => tournament?.seasonId === seasonFilter)
        : tournaments || [];

    if (seasonFilter || !(seasons || []).length) {
        return list.map((tournament) => ({ kind: 'cup', tournament }));
    }

    const { groups, unassigned } = groupTournamentsBySeason(list, seasons);
    const rows = [];

    groups.forEach((group) => {
        rows.push({
            kind: 'heading',
            season: group.season,
            count: group.tournaments.length
        });
        group.tournaments.forEach((tournament) => {
            rows.push({ kind: 'cup', tournament });
        });
    });

    if (unassigned.length && groups.length) {
        rows.push({
            kind: 'heading',
            season: { id: '__none', name: 'Cups outside a season' },
            count: unassigned.length
        });
    }

    unassigned.forEach((tournament) => {
        rows.push({ kind: 'cup', tournament });
    });

    return rows;
};

export const countCupsInSeason = (tournaments, seasonId) =>
    (tournaments || []).filter((tournament) => tournament?.seasonId === seasonId).length;
