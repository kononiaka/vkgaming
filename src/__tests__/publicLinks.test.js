import { buildPublicLinks, normalizeSocialUrl } from '../utils/publicLinks';

describe('publicLinks', () => {
    test('normalizeSocialUrl builds telegram links', () => {
        expect(normalizeSocialUrl('@myhandle', 'telegram')).toBe('https://t.me/myhandle');
        expect(normalizeSocialUrl('https://t.me/myhandle', 'telegram')).toBe('https://t.me/myhandle');
    });

    test('buildPublicLinks handles null player', () => {
        expect(buildPublicLinks(null)).toEqual([]);
    });

    test('buildPublicLinks filters empty entries', () => {
        expect(
            buildPublicLinks({
                telegram: '@caster',
                twitch: '',
                youtube: null
            })
        ).toEqual([
            {
                key: 'telegram',
                label: 'Telegram',
                value: '@caster',
                href: 'https://t.me/caster'
            }
        ]);
    });
});
