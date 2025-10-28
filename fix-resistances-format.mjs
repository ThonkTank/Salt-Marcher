#!/usr/bin/env node
// fix-resistances-format.mjs
// Transforms resistance/immunity arrays from ["value"] to [{value: "..."}] format

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CREATURES_DIR = path.join(__dirname, 'Presets', 'Creatures');

const FIELDS_TO_TRANSFORM = [
    'damageResistancesList',
    'damageImmunitiesList',
    'damageVulnerabilitiesList',
    'conditionImmunitiesList',
];

function getAllMarkdownFiles(dir) {
    let files = [];
    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
            files = files.concat(getAllMarkdownFiles(fullPath));
        } else if (item.isFile() && item.name.endsWith('.md')) {
            files.push(fullPath);
        }
    }

    return files;
}

function transformResistancesInFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const result = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check if this line is a resistance/immunity field with array format
        let matched = false;
        for (const fieldName of FIELDS_TO_TRANSFORM) {
            const pattern = new RegExp(`^(\\s*)${fieldName}:\\s*\\[(.*)\\]\\s*$`);
            const match = line.match(pattern);

            if (match) {
                matched = true;
                const indent = match[1];
                const arrayContent = match[2];

                // Parse the array values
                const values = arrayContent
                    .split(',')
                    .map(v => v.trim().replace(/^["']|["']$/g, ''))
                    .filter(v => v.length > 0);

                // Generate the new format
                result.push(`${indent}${fieldName}:`);
                for (const value of values) {
                    result.push(`${indent}  - value: "${value}"`);
                }
                break;
            }
        }

        if (!matched) {
            result.push(line);
        }
    }

    return result.join('\n');
}

function main() {
    console.log('Finding creature preset files...');
    const files = getAllMarkdownFiles(CREATURES_DIR);
    console.log(`Found ${files.length} files`);

    let transformedCount = 0;
    let errorCount = 0;

    for (const filePath of files) {
        try {
            const originalContent = fs.readFileSync(filePath, 'utf-8');

            // Only process files that have resistance/immunity fields
            const hasFields = FIELDS_TO_TRANSFORM.some(field => originalContent.includes(`${field}:`));
            if (!hasFields) {
                continue;
            }

            const transformedContent = transformResistancesInFile(filePath);

            // Only write if content changed
            if (originalContent !== transformedContent) {
                fs.writeFileSync(filePath, transformedContent, 'utf-8');
                transformedCount++;
                console.log(`✓ Transformed: ${path.relative(CREATURES_DIR, filePath)}`);
            }
        } catch (err) {
            console.error(`✗ Error processing ${filePath}:`, err.message);
            errorCount++;
        }
    }

    console.log(`\nComplete! Transformed ${transformedCount} files, ${errorCount} errors`);
}

main();
