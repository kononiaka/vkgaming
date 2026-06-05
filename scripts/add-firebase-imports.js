const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');

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
    if (file.includes(`${path.sep}base.js`)) continue;

    let content = fs.readFileSync(file, 'utf8');
    if (!content.includes('FIREBASE_DATABASE_URL')) continue;
    if (content.includes('import { FIREBASE_DATABASE_URL }')) continue;

    const importLine = `import { FIREBASE_DATABASE_URL } from '${relImport(file)}';\n`;
    content = importLine + content;
    fs.writeFileSync(file, content);
    console.log('added import', path.relative(SRC, file));
}
