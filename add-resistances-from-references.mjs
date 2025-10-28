#!/usr/bin/env node
// add-resistances-from-references.mjs
// Extracts resistance/immunity data from References and adds to Presets

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REFERENCES_DIR = path.join(__dirname, 'References', 'rulebooks', 'Statblocks', 'Creatures');
const PRESETS_DIR = path.join(__dirname, 'Presets', 'Creatures');

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

function extractResistances(content) {
    const result = {
        damageResistancesList: [],
        damageImmunitiesList: [],
        damageVulnerabilitiesList: [],
        conditionImmunitiesList: [],
    };

    const lines = content.split('\n');

    for (const line of lines) {
        // Match patterns like: - **Resistances**: Fire, Cold
        const resistMatch = line.match(/^-\s+\*\*Resistances\*\*:\s*(.+)$/);
        if (resistMatch) {
            const values = resistMatch[1].split(',').map(v => v.trim()).filter(v => v.length > 0);
            result.damageResistancesList = values;
        }

        // Match: - **Immunities**: Lightning (can be damage OR conditions)
        const immunMatch = line.match(/^-\s+\*\*Immunities\*\*:\s*(.+)$/);
        if (immunMatch) {
            const values = immunMatch[1].split(',').map(v => v.trim()).filter(v => v.length > 0);
            // Separate damage immunities from condition immunities
            const conditionKeywords = ['Charmed', 'Frightened', 'Grappled', 'Paralyzed', 'Petrified', 'Prone', 'Restrained', 'Stunned', 'Blinded', 'Deafened', 'Exhausted', 'Poisoned', 'Unconscious'];
            for (const value of values) {
                if (conditionKeywords.includes(value)) {
                    result.conditionImmunitiesList.push(value);
                } else {
                    result.damageImmunitiesList.push(value);
                }
            }
        }

        // Match: - **Vulnerabilities**: Fire
        const vulnMatch = line.match(/^-\s+\*\*Vulnerabilities\*\*:\s*(.+)$/);
        if (vulnMatch) {
            const values = vulnMatch[1].split(',').map(v => v.trim()).filter(v => v.length > 0);
            result.damageVulnerabilitiesList = values;
        }
    }

    return result;
}

function addResistancesToPreset(presetPath, resistances) {
    const content = fs.readFileSync(presetPath, 'utf-8');
    const lines = content.split('\n');
    const result = [];
    let added = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Insert resistance fields right before "cr:" line
        if (!added && line.match(/^cr:/)) {
            // Add each resistance field if it has values
            if (resistances.damageVulnerabilitiesList.length > 0) {
                result.push('damageVulnerabilitiesList:');
                for (const value of resistances.damageVulnerabilitiesList) {
                    result.push(`  - value: "${value}"`);
                }
            }
            if (resistances.damageResistancesList.length > 0) {
                result.push('damageResistancesList:');
                for (const value of resistances.damageResistancesList) {
                    result.push(`  - value: "${value}"`);
                }
            }
            if (resistances.damageImmunitiesList.length > 0) {
                result.push('damageImmunitiesList:');
                for (const value of resistances.damageImmunitiesList) {
                    result.push(`  - value: "${value}"`);
                }
            }
            if (resistances.conditionImmunitiesList.length > 0) {
                result.push('conditionImmunitiesList:');
                for (const value of resistances.conditionImmunitiesList) {
                    result.push(`  - value: "${value}"`);
                }
            }
            added = true;
        }

        result.push(line);
    }

    return result.join('\n');
}

function main() {
    console.log('Finding reference files...');
    const referenceFiles = getAllMarkdownFiles(REFERENCES_DIR);
    console.log(`Found ${referenceFiles.length} reference files`);

    let processedCount = 0;
    let addedCount = 0;
    let errorCount = 0;

    for (const refPath of referenceFiles) {
        try {
            // Get relative path to find matching preset
            const relativePath = path.relative(REFERENCES_DIR, refPath);
            const presetPath = path.join(PRESETS_DIR, relativePath);

            // Check if preset exists
            if (!fs.existsSync(presetPath)) {
                continue;
            }

            // Extract resistances from reference
            const refContent = fs.readFileSync(refPath, 'utf-8');
            const resistances = extractResistances(refContent);

            // Check if there's any resistance data
            const hasData =
                resistances.damageResistancesList.length > 0 ||
                resistances.damageImmunitiesList.length > 0 ||
                resistances.damageVulnerabilitiesList.length > 0 ||
                resistances.conditionImmunitiesList.length > 0;

            if (!hasData) {
                continue;
            }

            // Add resistances to preset
            const updatedContent = addResistancesToPreset(presetPath, resistances);
            fs.writeFileSync(presetPath, updatedContent, 'utf-8');

            processedCount++;
            addedCount++;
            console.log(`✓ Added resistances: ${relativePath}`);
        } catch (err) {
            console.error(`✗ Error processing ${refPath}:`, err.message);
            errorCount++;
        }
    }

    console.log(`\nComplete! Processed ${processedCount} files, added to ${addedCount}, ${errorCount} errors`);
}

main();
