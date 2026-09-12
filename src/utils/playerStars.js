export const getTournamentEntryStars = (value) => {
    if (value == null || value === '') {
        return 0;
    }
    const raw = String(value);
    const first = raw.includes(',') ? raw.split(',')[0].trim() : raw.trim();
    const amount = Number(first);
    return Number.isFinite(amount) ? amount : 0;
};
