// Standalone Script zum Konvertieren von Reference Spells zu Presets
// Verwendung: node scripts/convert-spell-references.mjs [--limit N] [--dry-run]

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Pfade relativ zum Plugin-Root
const PLUGIN_ROOT = join(__dirname, '..');
const SPELLS_REFERENCE_FILE = join(PLUGIN_ROOT, 'References/rulebooks/Spells/07_Spells.md');
const PRESETS_DIR = join(PLUGIN_ROOT, 'Presets/Spells');

// Parse args
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitIndex = args.indexOf('--limit');
const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1]) : null;

console.log('=== Spell Reference Converter ===');
console.log('Plugin Root:', PLUGIN_ROOT);
console.log('Reference File:', SPELLS_REFERENCE_FILE);
console.log('Presets Dir:', PRESETS_DIR);
console.log('Dry Run:', dryRun);
if (limit) console.log('Limit:', limit);
console.log('');

// Parse spell reference to SpellData
function parseReferenceSpell(markdown) {
    const lines = markdown.split('\n').map(l => l.trim());
    const data = { name: '' };

    // Extract name from #### header and remove ** bold markers
    for (const line of lines) {
        const match = line.match(/^####\s+(.+)$/);
        if (match) {
            // Remove ** bold markers
            data.name = match[1].trim().replace(/^\*\*(.+)\*\*$/, '$1');
            break;
        }
    }

    // Extract subtitle: *Level X School (Classes)*
    for (const line of lines) {
        const match = line.match(/^\*(.+)\*$/);
        if (match) {
            const subtitle = match[1].trim();

            // Extract classes from parentheses
            const classMatch = subtitle.match(/\(([^)]+)\)$/);
            if (classMatch) {
                data.classes = classMatch[1].split(',').map(c => c.trim());
            }

            // Remove classes for parsing level and school
            const withoutClasses = subtitle.replace(/\s*\([^)]+\)$/, '').trim();

            // Check for Cantrip
            if (withoutClasses.toLowerCase().includes('cantrip')) {
                data.level = 0;
                const schoolMatch = withoutClasses.match(/^(\w+)\s+Cantrip/i);
                if (schoolMatch) {
                    data.school = schoolMatch[1];
                }
            } else {
                // Parse "Level X School"
                const levelMatch = withoutClasses.match(/Level\s+(\d+)\s+(\w+)/i);
                if (levelMatch) {
                    data.level = parseInt(levelMatch[1]);
                    data.school = levelMatch[2];
                }
            }
            break;
        }
    }

    // Extract labeled stats
    const stats = new Map();
    for (const line of lines) {
        const match = line.match(/^\*\*(.+?):\*\*\s*(.+)$/);
        if (match) {
            stats.set(match[1].toLowerCase().trim(), match[2].trim());
        }
    }

    data.casting_time = stats.get('casting time');
    data.range = stats.get('range');
    data.duration = stats.get('duration');

    // Parse components
    const componentsText = stats.get('components');
    if (componentsText) {
        data.components = [];
        if (componentsText.includes('V')) data.components.push('V');
        if (componentsText.includes('S')) data.components.push('S');
        if (componentsText.includes('M')) data.components.push('M');

        const materialMatch = componentsText.match(/M\s*\(([^)]+)\)/);
        if (materialMatch) {
            data.materials = materialMatch[1].trim();
        }
    }

    // Extract description and higher levels
    let descriptionLines = [];
    let higherLevelLines = [];
    let inHigherLevels = false;
    let startCapturing = false;

    for (const line of lines) {
        if (line.startsWith('**Duration:')) {
            startCapturing = true;
            continue;
        }

        if (!startCapturing) continue;

        if (line.match(/\*\*_Using a Higher-Level Spell Slot\._\*\*/i) ||
            line.match(/\*\*_Cantrip Upgrade\._\*\*/i)) {
            inHigherLevels = true;
            continue;
        }

        if (line.startsWith('####')) break;

        if (inHigherLevels) {
            if (line) higherLevelLines.push(line);
        } else {
            if (line) descriptionLines.push(line);
        }
    }

    data.description = descriptionLines.join('\n\n').trim() || undefined;
    data.higher_levels = higherLevelLines.join('\n\n').trim() || undefined;

    // Parse flags
    if (data.duration?.toLowerCase().includes('concentration')) {
        data.concentration = true;
    }
    if (data.casting_time?.toLowerCase().includes('ritual')) {
        data.ritual = true;
    }

    // Parse spell details from description
    if (data.description) {
        const saveMatch = data.description.match(/\b(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+saving\s+throw/i);
        if (saveMatch) {
            data.save_ability = saveMatch[1].substring(0, 3).toUpperCase();
        }

        if (data.description.toLowerCase().includes('half') && data.description.toLowerCase().includes('damage')) {
            data.save_effect = "Half damage on success";
        }

        const attackMatch = data.description.match(/\b(ranged|melee)\s+spell\s+attack/i);
        if (attackMatch) {
            data.attack = `${attackMatch[1]} spell attack`;
        }

        const damageMatch = data.description.match(/(\d+d\d+(?:\s*[+\-]\s*\d+)?)\s+(\w+)\s+damage/i);
        if (damageMatch) {
            data.damage = damageMatch[1];
            data.damage_type = damageMatch[2];
        }
    }

    return data;
}

// Convert SpellData to markdown
function spellToMarkdown(data) {
    const lines = [];
    const name = data.name || "Unnamed Spell";

    // YAML Frontmatter
    lines.push('---');
    lines.push('smType: spell');
    lines.push(`name: "${name.replace(/"/g, '\\"')}"`);
    if (Number.isFinite(data.level)) lines.push(`level: ${data.level}`);
    if (data.school) lines.push(`school: "${data.school}"`);
    if (data.casting_time) lines.push(`casting_time: "${data.casting_time}"`);
    if (data.range) lines.push(`range: "${data.range}"`);

    if (data.components && data.components.length > 0) {
        const comps = data.components.map(c => `"${c}"`).join(', ');
        lines.push(`components: [${comps}]`);
    }
    if (data.materials) lines.push(`materials: "${data.materials.replace(/"/g, '\\"')}"`);
    if (data.duration) lines.push(`duration: "${data.duration}"`);
    if (data.concentration != null) lines.push(`concentration: ${!!data.concentration}`);
    if (data.ritual != null) lines.push(`ritual: ${!!data.ritual}`);

    if (data.classes && data.classes.length > 0) {
        const classes = data.classes.map(c => `"${c}"`).join(', ');
        lines.push(`classes: [${classes}]`);
    }

    if (data.save_ability) lines.push(`save_ability: "${data.save_ability}"`);
    if (data.save_effect) lines.push(`save_effect: "${data.save_effect.replace(/"/g, '\\"')}"`);
    if (data.attack) lines.push(`attack: "${data.attack}"`);
    if (data.damage) lines.push(`damage: "${data.damage}"`);
    if (data.damage_type) lines.push(`damage_type: "${data.damage_type}"`);

    lines.push('---\n');

    // Markdown body
    lines.push(`# ${name}`);

    const levelStr = (data.level == null) ? "" : (data.level === 0 ? "Cantrip" : `Level ${data.level}`);
    const parts = [levelStr, data.school].filter(Boolean);
    if (parts.length > 0) lines.push(parts.join(" "));
    lines.push('');

    if (data.casting_time) lines.push(`- Casting Time: ${data.casting_time}`);
    if (data.range) lines.push(`- Range: ${data.range}`);
    if (data.components && data.components.length > 0) {
        const compLine = data.components.join(", ") + (data.materials ? ` (${data.materials})` : "");
        lines.push(`- Components: ${compLine}`);
    }
    if (data.duration) lines.push(`- Duration: ${data.duration}`);
    if (data.concentration) lines.push('- Concentration: yes');
    if (data.ritual) lines.push('- Ritual: yes');
    if (data.classes && data.classes.length > 0) {
        lines.push(`- Classes: ${data.classes.join(", ")}`);
    }

    if (data.attack) lines.push(`- Attack: ${data.attack}`);
    if (data.save_ability) {
        lines.push(`- Save: ${data.save_ability}${data.save_effect ? ` (${data.save_effect})` : ""}`);
    }
    if (data.damage) {
        lines.push(`- Damage: ${data.damage}${data.damage_type ? ` ${data.damage_type}` : ""}`);
    }

    lines.push('');

    if (data.description) {
        lines.push(data.description.trim());
        lines.push('');
    }

    if (data.higher_levels) {
        lines.push("## At Higher Levels\n");
        lines.push(data.higher_levels.trim());
        lines.push('');
    }

    return lines.join('\n');
}

// Extract spell sections from the large reference file
function extractSpellSections(content) {
    const sections = [];
    const lines = content.split('\n');
    let currentSection = [];
    let insideSpellDescriptions = false;

    for (const line of lines) {
        // Start capturing after "## Spell Descriptions" header
        if (line.match(/^##\s+Spell Descriptions/i)) {
            insideSpellDescriptions = true;
            continue;
        }

        if (!insideSpellDescriptions) continue;

        if (line.startsWith('####')) {
            if (currentSection.length > 0) {
                sections.push(currentSection.join('\n'));
            }
            currentSection = [line];
        } else if (currentSection.length > 0) {
            currentSection.push(line);
        }
    }

    if (currentSection.length > 0) {
        sections.push(currentSection.join('\n'));
    }

    return sections;
}

// Main conversion
console.log('Reading spell reference file...');
const content = readFileSync(SPELLS_REFERENCE_FILE, 'utf-8');

console.log('Extracting spell sections...');
const spellSections = extractSpellSections(content);
console.log(`Found ${spellSections.length} spells\n`);

if (spellSections.length === 0) {
    console.log('No spells to convert. Exiting.');
    process.exit(0);
}

const sectionsToProcess = limit ? spellSections.slice(0, limit) : spellSections;
console.log(`Processing ${sectionsToProcess.length} spells...\n`);

let success = 0;
let failed = 0;
const errors = [];

for (let i = 0; i < sectionsToProcess.length; i++) {
    const spellMarkdown = sectionsToProcess[i];
    const progress = `[${i + 1}/${sectionsToProcess.length}]`;

    try {
        // Parse
        const spellData = parseReferenceSpell(spellMarkdown);

        if (!spellData.name) {
            throw new Error('No spell name found');
        }

        // Convert to markdown
        const presetMarkdown = spellToMarkdown(spellData);

        // Sanitize filename
        const fileName = spellData.name.replace(/[\\/:*?"<>|]/g, '-') + '.md';
        const targetPath = join(PRESETS_DIR, fileName);

        if (dryRun) {
            console.log(`${progress} [DRY RUN] ${spellData.name}`);
        } else {
            // Create directory
            mkdirSync(PRESETS_DIR, { recursive: true });

            // Write file
            writeFileSync(targetPath, presetMarkdown, 'utf-8');

            console.log(`${progress} ✓ ${spellData.name}`);
        }

        success++;
    } catch (err) {
        failed++;
        const spellName = spellMarkdown.split('\n')[0].replace(/^####\s*/, '').trim();
        errors.push({ spell: spellName || `Spell ${i + 1}`, error: err.message });
        console.error(`${progress} ✗ ${spellName}: ${err.message}`);
    }
}

console.log('\n=== Conversion Complete ===');
console.log(`Success: ${success}`);
console.log(`Failed: ${failed}`);

if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(e => console.log(`  - ${e.spell}: ${e.error}`));
}
