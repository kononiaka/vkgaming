export const OPEN_REGISTRATION_STATUSES = new Set(['Registration', 'Registration Started']);

export const isRegistrationOpen = (status) => OPEN_REGISTRATION_STATUSES.has(status);

export const getAttendanceFeeUsd = (tournament) => {
    const fee = Number(tournament?.attendanceFeeUsd);
    return Number.isFinite(fee) && fee > 0 ? fee : 0;
};

export const requiresAttendancePayment = (tournament, { isAdminManagedAdd = false } = {}) =>
    !isAdminManagedAdd && getAttendanceFeeUsd(tournament) > 0;

export const formatAttendanceFeeLabel = (feeUsd) => `$${Number(feeUsd).toLocaleString()} attendance fee`;
