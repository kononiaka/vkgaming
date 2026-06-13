import {
    formatAttendanceFeeLabel,
    getAttendanceFeeUsd,
    isRegistrationOpen,
    requiresAttendancePayment
} from '../utils/tournamentAttendance';

describe('tournamentAttendance', () => {
    test('detects open registration statuses', () => {
        expect(isRegistrationOpen('Registration')).toBe(true);
        expect(isRegistrationOpen('Registration Started')).toBe(true);
        expect(isRegistrationOpen('Registration finished!')).toBe(false);
    });

    test('reads configured attendance fee', () => {
        expect(getAttendanceFeeUsd({ attendanceFeeUsd: 5 })).toBe(5);
        expect(getAttendanceFeeUsd({ attendanceFeeUsd: 0 })).toBe(0);
        expect(getAttendanceFeeUsd({})).toBe(0);
    });

    test('requires payment only for self-registration when fee is set', () => {
        const tournament = { attendanceFeeUsd: 5 };
        expect(requiresAttendancePayment(tournament)).toBe(true);
        expect(requiresAttendancePayment(tournament, { isAdminManagedAdd: true })).toBe(false);
        expect(requiresAttendancePayment({ attendanceFeeUsd: 0 })).toBe(false);
    });

    test('formats attendance fee label', () => {
        expect(formatAttendanceFeeLabel(5)).toBe('$5 attendance fee');
    });
});
