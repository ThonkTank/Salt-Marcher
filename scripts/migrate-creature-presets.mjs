// scripts/migrate-creature-presets.mjs
// Migrates creature preset frontmatter from old format to new format

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Point to plugin preset creatures directory (source files that get bundled)
const PRESETS_DIR = path.join(__dirname, '..', 'Presets', 'Creatures');

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
 * Parse YAML frontmatter into object using js-yaml
 */
function parseYaml(yamlString) {
    return yaml.load(yamlString);
}

/**
 * Convert object to YAML frontmatter string using js-yaml
 */
function toYaml(obj) {
    return yaml.dump(obj, {
        lineWidth: -1, // Don't wrap lines
        noRefs: true, // Don't use references
        quotingType: '"', // Use double quotes
        forceQuotes: false, // Only quote when necessary
    });
}

/**
 * Transform frontmatter from old format to new format
 */
function transformFrontmatter(fm) {
    const transformed = {};

    // Copy smType and name
    if (fm.smType) transformed.smType = fm.smType;
    if (fm.name) transformed.name = fm.name;

    // Basic fields
    if (fm.size) transformed.size = fm.size;
    if (fm.type) transformed.type = fm.type;

    // type_tags → typeTags
    if (fm.type_tags) {
        transformed.typeTags = fm.type_tags;
    }

    // alignment → alignmentOverride (single field format)
    // OR keep alignmentLawChaos/alignmentGoodEvil if already split
    if (fm.alignmentOverride) {
        transformed.alignmentOverride = fm.alignmentOverride;
    } else if (fm.alignmentLawChaos || fm.alignmentGoodEvil) {
        if (fm.alignmentLawChaos) transformed.alignmentLawChaos = fm.alignmentLawChaos;
        if (fm.alignmentGoodEvil) transformed.alignmentGoodEvil = fm.alignmentGoodEvil;
    } else if (fm.alignment) {
        transformed.alignmentOverride = fm.alignment;
    }

    // Combat stats
    if (fm.ac) transformed.ac = fm.ac;
    if (fm.initiative) transformed.initiative = fm.initiative;
    if (fm.hp) transformed.hp = fm.hp;

    // hit_dice → hitDice
    if (fm.hit_dice) {
        transformed.hitDice = fm.hit_dice;
    } else if (fm.hitDice) {
        transformed.hitDice = fm.hitDice;
    }

    // speeds_json → speeds (already parsed by parseYaml or parse if string)
    if (fm.speeds_json) {
        if (typeof fm.speeds_json === 'object') {
            transformed.speeds = fm.speeds_json;
        } else {
            try {
                transformed.speeds = JSON.parse(fm.speeds_json);
            } catch (err) {
                console.error('Failed to parse speeds_json:', err);
                transformed.speeds = {};
            }
        }
    } else if (fm.speeds) {
        transformed.speeds = fm.speeds;
    }

    // abilities_json → abilities (already parsed by parseYaml or parse if string)
    if (fm.abilities_json) {
        if (Array.isArray(fm.abilities_json)) {
            transformed.abilities = fm.abilities_json;
        } else if (typeof fm.abilities_json === 'object') {
            transformed.abilities = [fm.abilities_json];
        } else {
            try {
                transformed.abilities = JSON.parse(fm.abilities_json);
            } catch (err) {
                console.error('Failed to parse abilities_json:', err);
                transformed.abilities = [];
            }
        }
    } else if (fm.abilities) {
        transformed.abilities = fm.abilities;
    }

    // Other stats
    if (fm.pb) transformed.pb = fm.pb;
    if (fm.cr) transformed.cr = fm.cr;
    if (fm.xp) transformed.xp = fm.xp;

    // Lists
    if (fm.sensesList) transformed.sensesList = fm.sensesList;
    if (fm.languagesList) transformed.languagesList = fm.languagesList;

    // Transform passivesList: "Passive Perception 20" → {skill: "Perception", value: "20"}
    if (fm.passivesList && Array.isArray(fm.passivesList)) {
        transformed.passivesList = fm.passivesList.map(item => {
            let text;

            // Handle different input formats
            if (typeof item === 'string') {
                text = item;
            } else if (item && typeof item === 'object' && 'value' in item) {
                text = String(item.value);
            } else if (item && typeof item === 'object' && 'skill' in item && 'value' in item) {
                // Already in new format - return as-is
                return item;
            } else {
                // Unknown format - skip
                return item;
            }

            // Parse "Passive Perception 20" format
            const match = text.match(/^Passive\s+(\w+)\s+(\d+)$/i);
            if (match) {
                return {
                    skill: match[1], // e.g., "Perception"
                    value: match[2], // e.g., "20"
                };
            }

            // Fallback: try to salvage what we can
            return {
                skill: "Perception",
                value: text.replace(/\D/g, '') || "10",
            };
        });
    }
    if (fm.damageVulnerabilitiesList) transformed.damageVulnerabilitiesList = fm.damageVulnerabilitiesList;
    if (fm.damageResistancesList) transformed.damageResistancesList = fm.damageResistancesList;
    if (fm.damageImmunitiesList) transformed.damageImmunitiesList = fm.damageImmunitiesList;
    if (fm.conditionImmunitiesList) transformed.conditionImmunitiesList = fm.conditionImmunitiesList;
    if (fm.gearList) transformed.gearList = fm.gearList;

    // entries_structured_json → entries (already parsed by parseYaml or parse if string)
    if (fm.entries_structured_json) {
        if (Array.isArray(fm.entries_structured_json)) {
            transformed.entries = fm.entries_structured_json;
        } else if (typeof fm.entries_structured_json === 'object') {
            transformed.entries = [fm.entries_structured_json];
        } else {
            try {
                transformed.entries = JSON.parse(fm.entries_structured_json);
            } catch (err) {
                console.error('Failed to parse entries_structured_json:', err);
                transformed.entries = [];
            }
        }
    } else if (fm.entries) {
        transformed.entries = fm.entries;
    }

    // Spellcasting
    if (fm.spellcasting) transformed.spellcasting = fm.spellcasting;

    return transformed;
}

/**
 * Migrate a single file
 */
function migrateFile(filePath) {
    console.log(`Migrating: ${path.relative(PRESETS_DIR, filePath)}`);

    const content = fs.readFileSync(filePath, 'utf-8');
    const { frontmatter, body } = parseMd(content);
    const fm = parseYaml(frontmatter);
    const transformed = transformFrontmatter(fm);
    const newFrontmatter = toYaml(transformed);
    const newContent = `---\n${newFrontmatter}\n---\n${body}`;

    fs.writeFileSync(filePath, newContent, 'utf-8');
}

/**
 * Get all markdown files recursively
 */
function getMarkdownFiles(dir) {
    const files = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...getMarkdownFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
            files.push(fullPath);
        }
    }

    return files;
}

/**
 * Main migration function
 */
function migrate() {
    console.log('Starting creature preset migration...');
    console.log(`Source directory: ${PRESETS_DIR}`);

    if (!fs.existsSync(PRESETS_DIR)) {
        console.error(`Directory not found: ${PRESETS_DIR}`);
        process.exit(1);
    }

    const files = getMarkdownFiles(PRESETS_DIR);
    console.log(`Found ${files.length} files to migrate`);

    let successCount = 0;
    let errorCount = 0;

    for (const file of files) {
        try {
            migrateFile(file);
            successCount++;
        } catch (err) {
            console.error(`Failed to migrate ${file}:`, err);
            errorCount++;
        }
    }

    console.log(`\nMigration complete!`);
    console.log(`✓ Success: ${successCount} files`);
    console.log(`✗ Errors: ${errorCount} files`);
}

// Run migration
migrate();
