#!/usr/bin/env node
// remove-duplicate-resistances.mjs
// Removes duplicate resistance/immunity fields from preset files

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CREATURES_DIR = path.join(__dirname, 'Presets', 'Creatures');

const RESISTANCE_FIELDS = [
    'damageResistancesList',
    'damageImmunitiesList',
    'damageVulnerabilitiesList',
    'conditionImmunitiesList',
];

function getAllMarkdownFiles(dir) {
    let files = [];
    try {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
            const fullPath = path.join(dir, item.name);
            if (item.isDirectory()) {
                files = files.concat(getAllMarkdownFiles(fullPath));
            } else if (item.isFile() && item.name.endsWith('.md')) {
                files.push(fullPath);
            }
        }
    } catch (err) {}
    return files;
}

function removeDuplicateResistances(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const result = [];
    const seenFields = new Set();

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check if this is a resistance field header
        let isResistanceField = false;
        let fieldName = null;

        for (const field of RESISTANCE_FIELDS) {
            if (line.match(new RegExp(`^${field}:\\s*$`))) {
                isResistanceField = true;
                fieldName = field;
                break;
            }
        }

        if (isResistanceField) {
            // If we've already seen this field, skip it and its values
            if (seenFields.has(fieldName)) {
                // Skip this line and all following lines that start with "  - value:"
                let j = i + 1;
                while (j < lines.length && lines[j].match(/^\s+- value:/)) {
                    j++;
                }
                i = j - 1; // Skip to the end of this block
                continue;
            } else {
                seenFields.add(fieldName);
                result.push(line);

                // Add all the values for this field
                let j = i + 1;
                while (j < lines.length && lines[j].match(/^\s+- value:/)) {
                    result.push(lines[j]);
                    j++;
                }
                i = j - 1; // Move to the last line of this block
            }
        } else {
            // Reset seen fields when we hit the cr: line or entries:
            if (line.match(/^(cr:|entries:)/)) {
                seenFields.clear();
            }
            result.push(line);
        }
    }

    return result.join('\n');
}

function main() {
    console.log('Finding creature preset files...');
    const files = getAllMarkdownFiles(CREATURES_DIR);
    console.log(`Found ${files.length} files`);

    let fixedCount = 0;
    let errorCount = 0;

    for (const filePath of files) {
        try {
            const originalContent = fs.readFileSync(filePath, 'utf-8');
            const cleanedContent = removeDuplicateResistances(filePath);

            // Only write if content changed
            if (originalContent !== cleanedContent) {
                fs.writeFileSync(filePath, cleanedContent, 'utf-8');
                fixedCount++;
                console.log(`✓ Fixed: ${path.relative(CREATURES_DIR, filePath)}`);
            }
        } catch (err) {
            console.error(`✗ Error processing ${filePath}:`, err.message);
            errorCount++;
        }
    }

    console.log(`\nComplete! Fixed ${fixedCount} files, ${errorCount} errors`);
}

main();
