// Standalone Script zum Konvertieren von Reference Statblöcken zu Presets
// Verwendung: node scripts/convert-references.mjs [--limit N] [--dry-run]

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Pfade relativ zum Plugin-Root
// Script is in devkit/utilities/conversions/, so go up 3 levels to reach plugin root
const PLUGIN_ROOT = join(__dirname, '..', '..', '..');
const VAULT_ROOT = join(PLUGIN_ROOT, '..', '..', '..');
const REFERENCES_DIR = join(PLUGIN_ROOT, 'References/rulebooks/Statblocks/Creatures');
const PRESETS_DIR = join(PLUGIN_ROOT, 'Presets/Creatures');

/**
 * Validate that all required paths exist
 */
function validatePaths() {
    console.log('Validating paths...');

    const requiredPaths = {
        'Plugin Root': PLUGIN_ROOT,
        'Presets Directory': dirname(PRESETS_DIR)
    };

    const optionalPaths = {
        'References Directory': REFERENCES_DIR
    };

    let hasErrors = false;

    // Check required paths
    for (const [name, dirPath] of Object.entries(requiredPaths)) {
        try {
            const stats = statSync(dirPath);
            if (!stats.isDirectory()) {
                console.error(`❌ ERROR: ${name} is not a directory: ${dirPath}`);
                hasErrors = true;
            }
        } catch (err) {
            console.error(`❌ ERROR: ${name} does not exist: ${dirPath}`);
            console.error(`   Current directory: ${process.cwd()}`);
            console.error(`   Script location: ${__dirname}`);
            hasErrors = true;
        }
    }

    // Check optional paths (warnings only)
    for (const [name, dirPath] of Object.entries(optionalPaths)) {
        try {
            const stats = statSync(dirPath);
            if (!stats.isDirectory()) {
                console.warn(`⚠️  WARNING: ${name} is not a directory: ${dirPath}`);
            }
        } catch (err) {
            console.warn(`⚠️  WARNING: ${name} does not exist: ${dirPath}`);
            console.warn(`   This script will not find any files to convert`);
        }
    }

    if (hasErrors) {
        console.error('\n💡 Tip: Make sure paths in the script are correct');
        console.error('   Expected plugin root: /path/to/vault/.obsidian/plugins/salt-marcher/');
        process.exit(1);
    }

    console.log('✓ Path validation complete\n');
}

// Parse args
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitIndex = args.indexOf('--limit');
const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1]) : null;

console.log('=== Reference Statblock Converter ===');
console.log('Vault Root:', VAULT_ROOT);
console.log('References Dir:', REFERENCES_DIR);
console.log('Presets Dir:', PRESETS_DIR);
console.log('Dry Run:', dryRun);
if (limit) console.log('Limit:', limit);
console.log('');

// Validate paths before proceeding
validatePaths();

// YAML helper functions
function toYamlArray(arr, indent = 0) {
    const spaces = '  '.repeat(indent);
    const lines = [];
    for (const item of arr) {
        if (typeof item === 'object' && item !== null) {
            lines.push(`${spaces}-`);
            for (const [key, value] of Object.entries(item)) {
                if (value === undefined || value === null) continue;
                if (typeof value === 'string' && value.includes('\n')) {
                    lines.push(`${spaces}  ${key}: |`);
                    const textLines = value.split('\n');
                    for (const textLine of textLines) {
                        lines.push(`${spaces}    ${textLine}`);
                    }
                } else if (typeof value === 'string') {
                    lines.push(`${spaces}  ${key}: "${value.replace(/"/g, '\\"')}"`);
                } else {
                    lines.push(`${spaces}  ${key}: ${value}`);
                }
            }
        } else if (typeof item === 'string') {
            lines.push(`${spaces}- "${item.replace(/"/g, '\\"')}"`);
        } else {
            lines.push(`${spaces}- ${item}`);
        }
    }
    return lines.join('\n');
}

function toYamlObject(obj, indent = 0) {
    const spaces = '  '.repeat(indent);
    const lines = [];
    for (const [key, value] of Object.entries(obj)) {
        if (value === undefined || value === null) continue;
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            lines.push(`${spaces}${key}:`);
            for (const [nestedKey, nestedValue] of Object.entries(value)) {
                if (nestedValue === undefined || nestedValue === null) continue;
                if (typeof nestedValue === 'string') {
                    lines.push(`${spaces}  ${nestedKey}: "${nestedValue.replace(/"/g, '\\"')}"`);
                } else if (typeof nestedValue === 'boolean') {
                    lines.push(`${spaces}  ${nestedKey}: ${nestedValue}`);
                } else {
                    lines.push(`${spaces}  ${nestedKey}: ${nestedValue}`);
                }
            }
        } else if (typeof value === 'string') {
            lines.push(`${spaces}${key}: "${value.replace(/"/g, '\\"')}"`);
        } else {
            lines.push(`${spaces}${key}: ${value}`);
        }
    }
    return lines.join('\n');
}

// Calculate Proficiency Bonus from CR according to D&D 5e rules
function calculateProficiencyBonus(cr) {
    if (!cr) return '+2';

    // Parse CR (handles fractions like "1/4")
    let crValue;
    if (cr.includes('/')) {
        const [num, denom] = cr.split('/').map(n => parseInt(n.trim()));
        crValue = num / denom;
    } else {
        crValue = parseFloat(cr);
    }

    // D&D 5e Proficiency Bonus by CR
    if (crValue <= 4) return '+2';
    if (crValue <= 8) return '+3';
    if (crValue <= 12) return '+4';
    if (crValue <= 16) return '+5';
    if (crValue <= 20) return '+6';
    if (crValue <= 24) return '+7';
    if (crValue <= 28) return '+8';
    return '+9';
}

// Simple StatblockData to Markdown converter (inline version)
function statblockToMarkdown(data) {
    const lines = [];

    // YAML Frontmatter
    lines.push('---');
    lines.push('smType: creature');
    lines.push(`name: "${data.name.replace(/"/g, '\\"')}"`);
    if (data.size) lines.push(`size: "${data.size}"`);
    if (data.type) lines.push(`type: "${data.type}"`);
    if (data.typeTags && data.typeTags.length > 0) {
        const tags = data.typeTags.map(t => `"${t}"`).join(', ');
        lines.push(`typeTags: [${tags}]`);
    }

    // Alignment (use separate fields or override)
    if (data.alignmentOverride) {
        lines.push(`alignmentOverride: "${data.alignmentOverride}"`);
    } else {
        if (data.alignmentLawChaos) lines.push(`alignmentLawChaos: "${data.alignmentLawChaos}"`);
        if (data.alignmentGoodEvil) lines.push(`alignmentGoodEvil: "${data.alignmentGoodEvil}"`);
    }

    // Combat stats
    if (data.ac) lines.push(`ac: "${data.ac}"`);
    if (data.initiative) lines.push(`initiative: "${data.initiative}"`);
    if (data.hp) lines.push(`hp: "${data.hp}"`);
    if (data.hitDice) lines.push(`hitDice: "${data.hitDice}"`);

    // Speeds (as YAML object)
    if (data.speeds && Object.keys(data.speeds).length > 0) {
        lines.push('speeds:');
        lines.push(toYamlObject(data.speeds, 1));
    }

    // Abilities (as YAML array)
    if (data.abilities && data.abilities.length > 0) {
        lines.push('abilities:');
        lines.push(toYamlArray(data.abilities, 1));
    }
    if (data.pb) lines.push(`pb: "${data.pb}"`);

    // Saves (as YAML array)
    if (data.saves && data.saves.length > 0) {
        lines.push('saves:');
        lines.push(toYamlArray(data.saves, 1));
    }

    // Skills (as YAML array)
    if (data.skills && data.skills.length > 0) {
        lines.push('skills:');
        lines.push(toYamlArray(data.skills, 1));
    }

    // Senses, Languages, etc.
    if (data.sensesList && data.sensesList.length > 0) {
        const senses = data.sensesList.map(s => `"${s}"`).join(', ');
        lines.push(`sensesList: [${senses}]`);
    }
    if (data.passivesList && data.passivesList.length > 0) {
        const passives = data.passivesList.map(p => `"${p}"`).join(', ');
        lines.push(`passivesList: [${passives}]`);
    }
    if (data.languagesList && data.languagesList.length > 0) {
        const langs = data.languagesList.map(l => `"${l}"`).join(', ');
        lines.push(`languagesList: [${langs}]`);
    }

    // Vulnerabilities, Resistances, Immunities
    if (data.damageVulnerabilitiesList && data.damageVulnerabilitiesList.length > 0) {
        const vuln = data.damageVulnerabilitiesList.map(v => `"${v}"`).join(', ');
        lines.push(`damageVulnerabilitiesList: [${vuln}]`);
    }
    if (data.damageResistancesList && data.damageResistancesList.length > 0) {
        const res = data.damageResistancesList.map(r => `"${r}"`).join(', ');
        lines.push(`damageResistancesList: [${res}]`);
    }
    if (data.damageImmunitiesList && data.damageImmunitiesList.length > 0) {
        const imm = data.damageImmunitiesList.map(i => `"${i}"`).join(', ');
        lines.push(`damageImmunitiesList: [${imm}]`);
    }
    if (data.conditionImmunitiesList && data.conditionImmunitiesList.length > 0) {
        const cond = data.conditionImmunitiesList.map(c => `"${c}"`).join(', ');
        lines.push(`conditionImmunitiesList: [${cond}]`);
    }

    // CR, XP
    if (data.cr) lines.push(`cr: "${data.cr}"`);
    if (data.xp) lines.push(`xp: "${data.xp}"`);

    // Entries (as YAML array)
    if (data.entries && data.entries.length > 0) {
        lines.push('entries:');
        lines.push(toYamlArray(data.entries, 1));
    }

    lines.push('---\n');

    // Markdown content
    lines.push(`# ${data.name}`);

    // Reconstruct alignment for display
    const alignmentDisplay = data.alignmentOverride ||
        [data.alignmentLawChaos, data.alignmentGoodEvil].filter(Boolean).join(' ');

    const subtitle = [
        data.size,
        data.type,
        alignmentDisplay
    ].filter(Boolean).join(', ');
    if (subtitle) lines.push(`*${subtitle}*`);

    lines.push('');
    if (data.ac) lines.push(`**AC** ${data.ac}`);
    if (data.hp) lines.push(`**HP** ${data.hp}${data.hitDice ? ` (${data.hitDice})` : ''}`);
    if (data.initiative) lines.push(`**Initiative** ${data.initiative}`);

    // Speed line
    const speedParts = [];
    if (data.speeds?.walk?.distance) speedParts.push(data.speeds.walk.distance);
    if (data.speeds?.climb?.distance) speedParts.push(`climb ${data.speeds.climb.distance}`);
    if (data.speeds?.swim?.distance) speedParts.push(`swim ${data.speeds.swim.distance}`);
    if (data.speeds?.fly?.distance) {
        const fly = `fly ${data.speeds.fly.distance}${data.speeds.fly.hover ? ' (hover)' : ''}`;
        speedParts.push(fly);
    }
    if (data.speeds?.burrow?.distance) speedParts.push(`burrow ${data.speeds.burrow.distance}`);
    if (speedParts.length > 0) lines.push(`**Speed** ${speedParts.join(', ')}`);

    lines.push('');

    // Abilities table
    if (data.abilities && data.abilities.length > 0) {
        lines.push('| STR | DEX | CON | INT | WIS | CHA |');
        lines.push('| --- | --- | --- | --- | --- | --- |');
        const abilityOrder = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
        const abilityValues = abilityOrder.map(key => {
            const ability = data.abilities.find(a => a.ability === key);
            return ability ? ability.score : '-';
        });
        lines.push(`| ${abilityValues.join(' | ')} |`);
        lines.push('');
    }

    // Skills, Senses, etc.
    if (data.skillsProf && data.skillsProf.length > 0) {
        lines.push(`**Skills** ${data.skillsProf.join(', ')}`);
    }
    if (data.sensesList && data.sensesList.length > 0) {
        const senseLine = data.sensesList.join(', ');
        const passiveLine = data.passivesList?.join('; ') || '';
        lines.push(`**Senses** ${senseLine}${passiveLine ? '; ' + passiveLine : ''}`);
    }
    if (data.languagesList && data.languagesList.length > 0) {
        lines.push(`**Languages** ${data.languagesList.join(', ')}`);
    }
    if (data.cr) {
        const crLine = [`CR ${data.cr}`];
        if (data.pb) crLine.push(`PB ${data.pb}`);
        if (data.xp) crLine.push(`XP ${data.xp}`);
        lines.push(crLine.join(', '));
    }

    lines.push('');

    // Entries
    if (data.entries && data.entries.length > 0) {
        const groups = {
            trait: [],
            action: [],
            bonus: [],
            reaction: [],
            legendary: []
        };

        for (const entry of data.entries) {
            groups[entry.category].push(entry);
        }

        const renderGroup = (title, entries) => {
            if (!entries || entries.length === 0) return;
            lines.push(`## ${title}\n`);
            for (const e of entries) {
                const name = e.recharge ? `${e.name} (${e.recharge})` : e.name;
                lines.push(`**${name}**`);
                if (e.text) lines.push(e.text);
                lines.push('');
            }
        };

        renderGroup('Traits', groups.trait);
        renderGroup('Actions', groups.action);
        renderGroup('Bonus Actions', groups.bonus);
        renderGroup('Reactions', groups.reaction);
        renderGroup('Legendary Actions', groups.legendary);
    }

    return lines.join('\n');
}

// Parser (inline simplified version)
function parseReferenceStatblock(markdown) {
    const lines = markdown.split('\n').map(l => l.trim());
    const data = { name: '' };

    // Extract name from H1
    for (const line of lines) {
        const match = line.match(/^#\s+(.+)$/);
        if (match) {
            data.name = match[1].trim();
            break;
        }
    }

    // Extract subtitle
    for (const line of lines) {
        const match = line.match(/^\*(.+)\*$/);
        if (match) {
            const subtitle = match[1].trim();
            const parts = subtitle.split(',').map(p => p.trim());

            if (parts[0]) {
                const typeMatch = parts[0].match(/^(\w+)\s+(.+)$/);
                if (typeMatch) {
                    data.size = typeMatch[1];
                    const typeWithTags = typeMatch[2];
                    const tagMatch = typeWithTags.match(/^(.+?)\s*\((.+)\)$/);
                    if (tagMatch) {
                        data.type = tagMatch[1].trim();
                        data.typeTags = tagMatch[2].split(',').map(t => t.trim());
                    } else {
                        data.type = typeWithTags;
                    }
                }
            }

            if (parts[1]) {
                const alignment = parts[1].trim();
                if (alignment.toLowerCase() === 'unaligned' || alignment.toLowerCase() === 'any alignment') {
                    data.alignmentOverride = alignment;
                } else if (alignment.toLowerCase() === 'neutral') {
                    data.alignmentLawChaos = 'Neutral';
                    data.alignmentGoodEvil = 'Neutral';
                } else {
                    const words = alignment.split(/\s+/);
                    if (words.length === 2) {
                        data.alignmentLawChaos = words[0];
                        data.alignmentGoodEvil = words[1];
                    }
                }
            }
            break;
        }
    }

    // Extract bullet stats
    const bullets = new Map();
    for (const line of lines) {
        let match;

        // Pattern 1: **Label:** value (colon before closing **)
        match = line.match(/^-?\s*\*\*(.+?):\*\*\s*(.+)$/);
        if (match) {
            bullets.set(match[1].toLowerCase().trim(), match[2].trim());
            continue;
        }

        // Pattern 2: **Label**: value (colon after closing **)
        match = line.match(/^-?\s*\*\*(.+?)\*\*:\s*(.+)$/);
        if (match) {
            bullets.set(match[1].toLowerCase().trim(), match[2].trim());
            continue;
        }

        // Pattern 3: **Label** value (no colon, for CR line)
        match = line.match(/^-?\s*\*\*(.+?)\*\*\s+(.+)$/);
        if (match) {
            bullets.set(match[1].toLowerCase().trim(), match[2].trim());
        }
    }

    data.ac = bullets.get('armor class');
    data.initiative = bullets.get('initiative');

    const hpText = bullets.get('hit points');
    if (hpText) {
        const hpMatch = hpText.match(/^(\d+)\s*(?:\((.+?)\))?/);
        if (hpMatch) {
            data.hp = hpMatch[1];
            data.hitDice = hpMatch[2];
        }
    }

    const speedText = bullets.get('speed');
    if (speedText) {
        data.speeds = {};
        const parts = speedText.split(',').map(p => p.trim());

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];

            if (i === 0 && !part.match(/^(walk|climb|fly|swim|burrow)/i)) {
                const match = part.match(/^(\d+\s*ft\.?)/);
                if (match) data.speeds.walk = { distance: match[1] };
                continue;
            }

            const match = part.match(/^(walk|climb|fly|swim|burrow)\s+(\d+\s*ft\.?)(\s*\(hover\))?/i);
            if (match) {
                const type = match[1].toLowerCase();
                const distance = match[2];
                const hover = !!match[3];

                data.speeds[type] = { distance };
                if (type === 'fly' && hover) data.speeds.fly.hover = true;
            }
        }
    }

    const skillsText = bullets.get('skills');
    if (skillsText) {
        data.skills = [];
        const parts = skillsText.split(',').map(p => p.trim());
        for (const part of parts) {
            const match = part.match(/^(.+?)\s+([+\-]\d+)/);
            if (match) {
                data.skills.push({
                    name: match[1].trim(),
                    bonus: parseInt(match[2])
                });
            }
        }
    }

    const sensesText = bullets.get('senses');
    if (sensesText) {
        const parts = sensesText.split(';').map(p => p.trim());
        data.sensesList = [];
        data.passivesList = [];

        for (const part of parts) {
            if (part.toLowerCase().startsWith('passive')) {
                data.passivesList.push(part);
            } else if (part) {
                data.sensesList.push(...part.split(',').map(s => s.trim()).filter(Boolean));
            }
        }
    }

    const languagesText = bullets.get('languages');
    if (languagesText) {
        data.languagesList = languagesText.split(/[,;]/).map(l => l.trim()).filter(Boolean);
    }

    // Parse damage vulnerabilities
    const vulnerabilitiesText = bullets.get('vulnerabilities');
    if (vulnerabilitiesText) {
        data.damageVulnerabilitiesList = vulnerabilitiesText.split(/[,;]/).map(v => v.trim()).filter(Boolean);
    }

    // Parse damage resistances
    const resistancesText = bullets.get('resistances');
    if (resistancesText) {
        data.damageResistancesList = resistancesText.split(/[,;]/).map(r => r.trim()).filter(Boolean);
    }

    // Parse damage immunities
    const immunitiesText = bullets.get('immunities');
    if (immunitiesText) {
        data.damageImmunitiesList = immunitiesText.split(/[,;]/).map(i => i.trim()).filter(Boolean);
    }

    // Parse condition immunities
    const conditionImmunitiesText = bullets.get('condition immunities');
    if (conditionImmunitiesText) {
        data.conditionImmunitiesList = conditionImmunitiesText.split(/[,;]/).map(c => c.trim()).filter(Boolean);
    }

    const crText = bullets.get('cr');
    if (crText) {
        const crMatch = crText.match(/^([\d/]+)/);
        if (crMatch) data.cr = crMatch[1];

        const xpMatch = crText.match(/XP\s+([\d,]+)/);
        if (xpMatch) data.xp = xpMatch[1].replace(/,/g, '');

        const pbMatch = crText.match(/PB\s+([+\-]?\d+)/);
        if (pbMatch) {
            data.pb = pbMatch[1];
        } else if (data.cr) {
            // Calculate PB from CR if not explicitly provided
            data.pb = calculateProficiencyBonus(data.cr);
        }
    }

    // Extract ability table
    let tableStart = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('| STAT |') || lines[i].includes('|STAT|')) {
            tableStart = i;
            break;
        }
    }

    if (tableStart !== -1) {
        data.abilities = [];
        for (let i = tableStart + 2; i < tableStart + 8 && i < lines.length; i++) {
            const line = lines[i];
            const cells = line.split('|').map(c => c.trim()).filter(Boolean);

            if (cells.length >= 4) {
                const stat = cells[0].toLowerCase();
                const scoreText = cells[1];
                const scoreValue = parseInt(scoreText);
                const mod = parseInt(cells[2].replace(/[+\-]/g, '')) || 0;
                const saveText = cells[3];
                const saveMatch = saveText.match(/([+\-]?\d+)/);
                const save = saveMatch ? parseInt(saveMatch[1]) : mod;

                if (['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(stat) && !isNaN(scoreValue)) {
                    // Check if creature has save proficiency (save differs from mod)
                    const hasSaveProf = Math.abs(save) > Math.abs(mod) + 0.5;

                    // Add to abilities array with saveProf and saveMod
                    data.abilities.push({
                        key: stat,  // Use "key" instead of "ability"
                        score: scoreValue,
                        saveProf: hasSaveProf,
                        saveMod: hasSaveProf ? save : undefined
                    });
                }
            }
        }
    }

    // Extract entries from sections
    data.entries = [];
    let currentSection = null;
    let currentEntry = null;

    const categoryMap = {
        'traits': 'trait',
        'actions': 'action',
        'bonus actions': 'bonus',
        'reactions': 'reaction',
        'legendary actions': 'legendary'
    };

    for (const line of lines) {
        const headerMatch = line.match(/^###\s+(.+)$/);
        if (headerMatch) {
            if (currentEntry) {
                data.entries.push(currentEntry);
                currentEntry = null;
            }
            currentSection = categoryMap[headerMatch[1].toLowerCase().trim()];
            continue;
        }

        if (!currentSection) continue;

        const entryMatch = line.match(/^\*\*\*(.+?)\.\*\*\*(.*)$/);
        if (entryMatch) {
            if (currentEntry) {
                data.entries.push(currentEntry);
            }

            const nameAndRecharge = entryMatch[1];
            const rest = entryMatch[2].trim();

            const rechargeMatch = nameAndRecharge.match(/^(.+?)\s*\((Recharge\s+\d+)\)$/);
            const name = rechargeMatch ? rechargeMatch[1].trim() : nameAndRecharge.trim();
            const recharge = rechargeMatch ? rechargeMatch[2] : undefined;

            currentEntry = {
                category: currentSection,
                name,
                recharge,
                text: rest
            };
        } else if (currentEntry && line) {
            currentEntry.text = (currentEntry.text ? currentEntry.text + ' ' : '') + line;
        }
    }

    if (currentEntry) {
        data.entries.push(currentEntry);
    }

    return data;
}

// Find all .md files recursively
function findMarkdownFiles(dir, baseDir = dir) {
    const files = [];

    try {
        const entries = readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = join(dir, entry.name);

            if (entry.isDirectory()) {
                files.push(...findMarkdownFiles(fullPath, baseDir));
            } else if (entry.isFile() && entry.name.endsWith('.md')) {
                files.push({
                    path: fullPath,
                    relativePath: relative(baseDir, fullPath)
                });
            }
        }
    } catch (err) {
        console.error(`Error reading directory ${dir}:`, err.message);
    }

    return files;
}

// Main conversion
console.log('Finding reference files...');
const referenceFiles = findMarkdownFiles(REFERENCES_DIR);
console.log(`Found ${referenceFiles.length} reference files\n`);

if (referenceFiles.length === 0) {
    console.log('No files to convert. Exiting.');
    process.exit(0);
}

const filesToProcess = limit ? referenceFiles.slice(0, limit) : referenceFiles;
console.log(`Processing ${filesToProcess.length} files...\n`);

let success = 0;
let failed = 0;
const errors = [];

for (let i = 0; i < filesToProcess.length; i++) {
    const file = filesToProcess[i];
    const progress = `[${i + 1}/${filesToProcess.length}]`;

    try {
        // Read reference file
        const content = readFileSync(file.path, 'utf-8');

        // Parse
        const statblockData = parseReferenceStatblock(content);

        // Convert to markdown
        const presetMarkdown = statblockToMarkdown(statblockData);

        // Determine target path
        const targetPath = join(PRESETS_DIR, file.relativePath);

        if (dryRun) {
            console.log(`${progress} [DRY RUN] ${file.relativePath}`);
        } else {
            // Create directory
            mkdirSync(dirname(targetPath), { recursive: true });

            // Write file
            writeFileSync(targetPath, presetMarkdown, 'utf-8');

            console.log(`${progress} ✓ ${file.relativePath}`);
        }

        success++;
    } catch (err) {
        failed++;
        errors.push({ file: file.relativePath, error: err.message });
        console.error(`${progress} ✗ ${file.relativePath}: ${err.message}`);
    }
}

console.log('\n=== Conversion Complete ===');
console.log(`Success: ${success}`);
console.log(`Failed: ${failed}`);

if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(e => console.log(`  - ${e.file}: ${e.error}`));
}
