// scripts/migrate-to-structured-tokens.mjs
// Migrates creature preset token fields from string arrays to structured token objects
// Usage: node scripts/migrate-to-structured-tokens.mjs [--dry-run] [--limit N]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse args
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitIndex = args.indexOf('--limit');
const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1]) : null;

// Directories
const PRESETS_DIR = path.join(__dirname, '..', 'Presets', 'Creatures');

console.log('=== Migrate to Structured Tokens ===');
console.log('Presets Dir:', PRESETS_DIR);
console.log('Dry Run:', dryRun);
if (limit) console.log('Limit:', limit);
console.log('');

/**
 * Parse frontmatter and body from markdown file
 */
function parseMd(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) {
        throw new Error('Invalid markdown format - no frontmatter found');
    }
    return {
        frontmatter: match[1],
        body: match[2],
    };
}

/**
 * Strip unit suffix from value (e.g., "120 ft." → "120")
 */
function stripUnit(value) {
    if (!value || typeof value !== 'string') return value;
    return value.replace(/\s*ft\.?$/i, '').trim();
}

/**
 * Parse sense string into structured object
 * Examples:
 *   "darkvision 120 ft." → {type: "darkvision", range: "120"}
 *   "tremorsense 60 ft." → {type: "tremorsense", range: "60"}
 *   "blindsight 30 ft." → {type: "blindsight", range: "30"}
 */
function parseSense(senseStr) {
    const match = senseStr.match(/^(\w+)\s+(\d+)\s*ft\.?$/i);
    if (match) {
        return {
            type: match[1].toLowerCase(),
            range: match[2]
        };
    }
    // Fallback: keep as freeform text
    return { value: senseStr };
}

/**
 * Parse language string into structured object
 * Examples:
 *   "Common" → {value: "Common"}
 *   "telepathy 120 ft." → {type: "telepathy", range: "120"}
 *   "Understands Common but can't speak" → {value: "Understands Common but can't speak"}
 */
function parseLanguage(langStr) {
    const match = langStr.match(/^telepathy\s+(\d+)\s*ft\.?$/i);
    if (match) {
        return {
            type: "telepathy",
            range: match[1]
        };
    }
    // All other languages are simple strings
    return { value: langStr };
}

/**
 * Parse damage resistance/immunity/vulnerability string into structured object
 * Examples:
 *   "Acid" → {value: "Acid"}
 *   "Fire" → {value: "Fire"}
 */
function parseDamageType(damageStr) {
    return { value: damageStr };
}

/**
 * Parse condition immunity string into structured object
 * Examples:
 *   "Charmed" → {value: "Charmed"}
 *   "Prone" → {value: "Prone"}
 */
function parseCondition(conditionStr) {
    return { value: conditionStr };
}

/**
 * Parse passive string into structured object
 * Examples:
 *   "Passive Perception 12" → {value: "Passive Perception 12"}
 *   "Passive Insight 10" → {value: "Passive Insight 10"}
 */
function parsePassive(passiveStr) {
    return { value: passiveStr };
}

/**
 * Migrate speeds from object format to array format
 */
function migrateSpeeds(speeds) {
    if (!speeds || typeof speeds !== 'object') return undefined;
    if (Array.isArray(speeds)) {
        // Already in array format - strip units if present
        return speeds.map(speed => {
            const result = { ...speed };
            if (speed.distance) {
                result.value = stripUnit(speed.distance);
                delete result.distance;
            } else if (speed.value) {
                result.value = stripUnit(speed.value);
            }
            return result;
        });
    }

    // Convert object to array
    const SPEED_TYPES = ['walk', 'burrow', 'climb', 'fly', 'swim'];
    const result = [];

    for (const type of SPEED_TYPES) {
        const speedEntry = speeds[type];
        if (!speedEntry) continue;

        const rawValue = speedEntry.distance || speedEntry.value || "";
        const entry = {
            type: type,
            value: stripUnit(rawValue),  // Strip "ft." since UI adds it
        };

        if (type === 'fly' && speedEntry.hover === true) {
            entry.hover = true;
        }
        result.push(entry);
    }

    return result.length > 0 ? result : undefined;
}

/**
 * Transform frontmatter to structured token format
 */
function transformToStructuredTokens(fm) {
    const transformed = { ...fm };

    // Migrate speeds
    if (fm.speeds) {
        transformed.speeds = migrateSpeeds(fm.speeds);
    }

    // Migrate senses
    if (fm.sensesList && Array.isArray(fm.sensesList)) {
        const allStrings = fm.sensesList.every(s => typeof s === 'string');
        if (allStrings) {
            transformed.sensesList = fm.sensesList.map(parseSense);
        }
    }

    // Migrate languages
    if (fm.languagesList && Array.isArray(fm.languagesList)) {
        const allStrings = fm.languagesList.every(l => typeof l === 'string');
        if (allStrings) {
            transformed.languagesList = fm.languagesList.map(parseLanguage);
        }
    }

    // Migrate passives
    if (fm.passivesList && Array.isArray(fm.passivesList)) {
        const allStrings = fm.passivesList.every(p => typeof p === 'string');
        if (allStrings) {
            transformed.passivesList = fm.passivesList.map(parsePassive);
        }
    }

    // Migrate damage vulnerabilities
    if (fm.damageVulnerabilitiesList && Array.isArray(fm.damageVulnerabilitiesList)) {
        const allStrings = fm.damageVulnerabilitiesList.every(v => typeof v === 'string');
        if (allStrings) {
            transformed.damageVulnerabilitiesList = fm.damageVulnerabilitiesList.map(parseDamageType);
        }
    }

    // Migrate damage resistances
    if (fm.damageResistancesList && Array.isArray(fm.damageResistancesList)) {
        const allStrings = fm.damageResistancesList.every(r => typeof r === 'string');
        if (allStrings) {
            transformed.damageResistancesList = fm.damageResistancesList.map(parseDamageType);
        }
    }

    // Migrate damage immunities
    if (fm.damageImmunitiesList && Array.isArray(fm.damageImmunitiesList)) {
        const allStrings = fm.damageImmunitiesList.every(i => typeof i === 'string');
        if (allStrings) {
            transformed.damageImmunitiesList = fm.damageImmunitiesList.map(parseDamageType);
        }
    }

    // Migrate condition immunities
    if (fm.conditionImmunitiesList && Array.isArray(fm.conditionImmunitiesList)) {
        const allStrings = fm.conditionImmunitiesList.every(c => typeof c === 'string');
        if (allStrings) {
            transformed.conditionImmunitiesList = fm.conditionImmunitiesList.map(parseCondition);
        }
    }

    return transformed;
}

/**
 * Migrate a single file
 */
function migrateFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const { frontmatter, body } = parseMd(content);

    // Parse YAML using js-yaml
    const fm = yaml.load(frontmatter);

    // Transform to structured tokens
    const transformed = transformToStructuredTokens(fm);

    // Serialize back to YAML using js-yaml
    const newFrontmatter = yaml.dump(transformed, {
        lineWidth: -1,  // Don't wrap lines
        noRefs: true,   // Don't use references
        quotingType: '"', // Use double quotes
        forceQuotes: false // Only quote when necessary
    });

    const newContent = `---\n${newFrontmatter}---\n${body}`;
    return newContent;
}

/**
 * Get all markdown files recursively
 */
function getMarkdownFiles(dir) {
    const files = [];

    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                files.push(...getMarkdownFiles(fullPath));
            } else if (entry.isFile() && entry.name.endsWith('.md')) {
                files.push(fullPath);
            }
        }
    } catch (err) {
        console.error(`Error reading directory ${dir}:`, err.message);
    }

    return files;
}

/**
 * Main migration function
 */
function migrate() {
    console.log('Finding preset files...');
    const files = getMarkdownFiles(PRESETS_DIR);
    console.log(`Found ${files.length} preset files\n`);

    if (files.length === 0) {
        console.log('No files to migrate. Exiting.');
        process.exit(0);
    }

    const filesToProcess = limit ? files.slice(0, limit) : files;
    console.log(`Processing ${filesToProcess.length} files...\n`);

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (let i = 0; i < filesToProcess.length; i++) {
        const file = filesToProcess[i];
        const progress = `[${i + 1}/${filesToProcess.length}]`;
        const relativePath = path.relative(PRESETS_DIR, file);

        try {
            const newContent = migrateFile(file);

            if (dryRun) {
                console.log(`${progress} [DRY RUN] ${relativePath}`);
            } else {
                fs.writeFileSync(file, newContent, 'utf-8');
                console.log(`${progress} ✓ ${relativePath}`);
            }

            successCount++;
        } catch (err) {
            console.error(`${progress} ✗ ${relativePath}: ${err.message}`);
            errors.push({ file: relativePath, error: err.message });
            errorCount++;
        }
    }

    console.log(`\n=== Migration Complete ===`);
    console.log(`Success: ${successCount} files`);
    console.log(`Errors: ${errorCount} files`);

    if (errors.length > 0) {
        console.log('\nErrors:');
        errors.forEach(e => console.log(`  - ${e.file}: ${e.error}`));
    }
}

// Run migration
migrate();
