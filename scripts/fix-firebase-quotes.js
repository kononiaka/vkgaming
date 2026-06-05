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

for (const file of walk(SRC)) {
    let content = fs.readFileSync(file, 'utf8');
    const before = content;

    // Fix single-quoted strings that should be template literals
    content = content.replace(/'(\$\{FIREBASE_DATABASE_URL\}[^']*)'/g, '`$1`');

    if (content !== before) {
        fs.writeFileSync(file, content);
        console.log('fixed quotes', path.relative(SRC, file));
    }
}
