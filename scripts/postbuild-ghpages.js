const fs = require('fs');
const path = require('path');

const buildDir = path.join(__dirname, '..', 'build');
const indexPath = path.join(buildDir, 'index.html');
const indexHtml = fs.readFileSync(indexPath, 'utf8');

// GitHub Pages serves 404.html for unknown paths under /vkgaming/.
fs.writeFileSync(path.join(buildDir, '404.html'), indexHtml);

// Serve the OAuth callback as a real page so Twitch can redirect here with ?code=...
const callbackDir = path.join(buildDir, 'auth', 'twitch', 'callback');
fs.mkdirSync(callbackDir, { recursive: true });
fs.writeFileSync(path.join(callbackDir, 'index.html'), indexHtml);

console.log('GitHub Pages SPA fallbacks written (404.html + auth/twitch/callback/index.html).');
