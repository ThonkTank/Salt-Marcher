#!/usr/bin/env node
// Test ob die konvertierten Presets korrekt geladen werden können

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const VAULT_ROOT = join(__dirname, '..', '..', '..', '..');
const PRESETS_DIR = join(VAULT_ROOT, 'SaltMarcher/Presets/Creatures');

// Test files
const testFiles = [
    'Animals/ape.md',
    'Monsters/aboleth.md',
    'Monsters/adult-red-dragon.md',
];

console.log('=== Testing Preset Loading ===\n');

for (const file of testFiles) {
    console.log(`Testing: ${file}`);
    const filePath = join(PRESETS_DIR, file);

    try {
        const content = readFileSync(filePath, 'utf-8');

        // Parse frontmatter
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (!frontmatterMatch) {
            console.error('  ✗ No frontmatter found\n');
            continue;
        }

        const frontmatter = frontmatterMatch[1];
        const lines = frontmatter.split('\n');

        // Extract key fields
        const data = {};
        for (const line of lines) {
            const match = line.match(/^(\w+):\s*(.+)$/);
            if (match) {
                const key = match[1];
                let value = match[2].trim();

                // Remove quotes
                if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.slice(1, -1);
                }

                data[key] = value;
            }
        }

        console.log('  ✓ Loaded successfully');
        console.log('    Name:', data.name);
        console.log('    Type:', data.type, data.size);
        console.log('    CR:', data.cr || 'N/A', 'HP:', data.hp || 'N/A');

        // Check for entries
        if (data.entries_structured_json) {
            try {
                const entries = JSON.parse(data.entries_structured_json.replace(/\\"/g, '"'));
                console.log('    Entries:', entries.length, 'found');

                // Count by category
                const counts = {};
                for (const entry of entries) {
                    counts[entry.category] = (counts[entry.category] || 0) + 1;
                }
                console.log('      -', JSON.stringify(counts));
            } catch (err) {
                console.error('    ✗ Failed to parse entries JSON:', err.message);
            }
        }

        console.log('');

    } catch (err) {
        console.error('  ✗ Failed to load:', err.message);
        console.log('');
    }
}

console.log('=== Test Complete ===');
