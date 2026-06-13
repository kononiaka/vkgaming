import { getAppBasePath } from '../utils/appBasePath';

describe('appBasePath', () => {
    const originalPublicUrl = process.env.PUBLIC_URL;

    afterEach(() => {
        process.env.PUBLIC_URL = originalPublicUrl;
    });

    test('getAppBasePath reads path from homepage URL', () => {
        process.env.PUBLIC_URL = 'https://kononiaka.github.io/vkgaming';
        expect(getAppBasePath()).toBe('/vkgaming');
    });

    test('getAppBasePath returns empty path for local root builds', () => {
        process.env.PUBLIC_URL = '';
        expect(getAppBasePath()).toBe('');
    });
});
