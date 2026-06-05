/**
 * Replace RTDB fetch() with authFetch() in tournament / game write paths.
 */
const fs = require('fs');
const path = require('path');

const targets = [
    {
        file: 'src/components/tournaments/homm3/tournamentsBracket.js',
        importPath: '../../../api/authFetch'
    },
    {
        file: 'src/components/tournaments/homm3/Tournaments.js',
        importPath: '../../../api/authFetch'
    },
    {
        file: 'src/components/tournaments/homm3/progress/gameProgressApi.js',
        importPath: '../../../../api/authFetch'
    },
    {
        file: 'src/UI/modalAddTournament/ModalAddTournament.js',
        importPath: '../../api/authFetch'
    },
    {
        file: 'src/UI/modalAddGame/modalAddGame.js',
        importPath: '../../api/authFetch'
    }
];

const root = path.join(__dirname, '..');

for (const { file, importPath } of targets) {
    const fullPath = path.join(root, file);
    let content = fs.readFileSync(fullPath, 'utf8');

    if (!content.includes("from '" + importPath + "'") && !content.includes('from "' + importPath + '"')) {
        const importLine = `import { authFetch } from '${importPath}';\n`;
        const firebaseMatch = content.match(/^import .+ from ['"].+firebase.+['"];?\s*$/m);
        if (firebaseMatch) {
            const insertAt = content.indexOf(firebaseMatch[0]) + firebaseMatch[0].length + 1;
            content = content.slice(0, insertAt) + importLine + content.slice(insertAt);
        } else {
            content = importLine + content;
        }
    }

    content = content.replace(/\bfetch\(/g, 'authFetch(');

    fs.writeFileSync(fullPath, content);
    console.log('Updated', file);
}
