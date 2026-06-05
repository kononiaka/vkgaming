/**
 * One-off: replace hardcoded Firebase RTDB URLs with FIREBASE_DATABASE_URL import.
 * Run: node scripts/migrate-firebase-urls.js
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const OLD = 'https://test-prod-app-81915-default-rtdb.firebaseio.com/';
const IMPORT_LINE = "import { FIREBASE_DATABASE_URL } from '{REL}';";

function walk(dir, files = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, files);
        else if (/\.(js|jsx)$/.test(entry.name)) files.push(full);
    }
    return files;
}

function relImport(fromFile) {
    const fromDir = path.dirname(fromFile);
    let rel = path.relative(fromDir, path.join(SRC, 'config', 'firebase')).replace(/\\/g, '/');
    if (!rel.startsWith('.')) rel = './' + rel;
    return rel;
}

for (const file of walk(SRC)) {
    if (file.includes(`${path.sep}config${path.sep}firebase.js`)) continue;
    if (file.includes(`${path.sep}api${path.sep}api.js`)) continue;

    let content = fs.readFileSync(file, 'utf8');
    if (!content.includes(OLD)) continue;

    content = content.replaceAll(OLD, '${FIREBASE_DATABASE_URL}/');

    if (!content.includes('FIREBASE_DATABASE_URL')) {
        const importPath = relImport(file);
        const line = IMPORT_LINE.replace('{REL}', importPath);
        content = line + '\n' + content;
    }

    fs.writeFileSync(file, content);
    console.log('updated', path.relative(SRC, file));
}
