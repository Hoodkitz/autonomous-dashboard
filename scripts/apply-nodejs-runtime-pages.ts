import * as fs from 'fs';
import * as path from 'path';

function processFile(filePath: string) {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (!content.includes('export const runtime = "nodejs"') && !content.includes("export const runtime = 'nodejs'")) {
        // Find the last import statement or "use client"
        const lines = content.split('\n');
        let lastImportIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('import ') || lines[i].includes('"use client"')) {
                lastImportIndex = i;
            }
        }

        if (lastImportIndex !== -1) {
            lines.splice(lastImportIndex + 1, 0, '\nexport const runtime = "nodejs";\n');
            fs.writeFileSync(filePath, lines.join('\n'));
            console.log(`Updated ${filePath}`);
        } else {
            lines.unshift('export const runtime = "nodejs";\n');
            fs.writeFileSync(filePath, lines.join('\n'));
            console.log(`Updated ${filePath} (prepend)`);
        }
    }
}

function walkSync(dir: string) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkSync(fullPath);
        } else if (fullPath.endsWith('page.tsx') || fullPath.endsWith('layout.tsx')) {
            processFile(fullPath);
        }
    }
}

walkSync(path.join(process.cwd(), 'app'));
