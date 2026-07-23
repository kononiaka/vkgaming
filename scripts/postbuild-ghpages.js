const fs = require('fs');
const path = require('path');

const buildDir = path.join(__dirname, '..', 'build');
const indexPath = path.join(buildDir, 'index.html');
const indexHtml = fs.readFileSync(indexPath, 'utf8');

// GitHub Pages serves 404.html for unknown paths (SPA fallback).
fs.writeFileSync(path.join(buildDir, '404.html'), indexHtml);

// Serve OAuth callbacks as real pages so providers can redirect here with ?code=...
const oauthCallbackPaths = [
    ['auth', 'twitch', 'callback'],
    ['auth', 'youtube', 'callback']
];

for (const segments of oauthCallbackPaths) {
    const callbackDir = path.join(buildDir, ...segments);
    fs.mkdirSync(callbackDir, { recursive: true });
    fs.writeFileSync(path.join(callbackDir, 'index.html'), indexHtml);
}

console.log(
    'GitHub Pages SPA fallbacks written (404.html + auth/twitch/callback + auth/youtube/callback).'
);
