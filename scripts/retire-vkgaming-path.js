#!/usr/bin/env node
/**
 * Replaces the legacy project-site deploy at kononiaka.github.io/vkgaming/
 * (gh-pages branch on kononiaka/vkgaming) with redirects to the root site.
 *
 * Run: npm run deploy:retire-vkgaming
 */

const path = require('path');
const ghpages = require('gh-pages');

const redirectDir = path.join(__dirname, 'legacy-vkgaming-redirect');
const remote = 'https://github.com/kononiaka/vkgaming.git';
const options = {
    branch: 'gh-pages',
    repo: remote,
    dotfiles: true,
    message: 'Retire /vkgaming path — redirect to https://kononiaka.github.io'
};

ghpages.clean(options, (cleanError) => {
    if (cleanError) {
        console.error('Failed to clean legacy gh-pages branch:', cleanError.message);
        process.exit(1);
    }

    ghpages.publish(redirectDir, options, (error) => {
        if (error) {
            console.error('Failed to retire /vkgaming path:', error.message);
            process.exit(1);
        }

        console.log('Legacy /vkgaming/ gh-pages branch replaced with redirects.');
        console.log('Verify: https://kononiaka.github.io/vkgaming/ → https://kononiaka.github.io/');
    });
});
