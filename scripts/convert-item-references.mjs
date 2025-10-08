// Standalone script to convert reference items to presets
// Usage: node scripts/convert-item-references.mjs [--limit N] [--dry-run]

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Paths relative to plugin root
const PLUGIN_ROOT = join(__dirname, '..');
const ITEMS_REFERENCE_FILE = join(PLUGIN_ROOT, 'References/rulebooks/Items/10_MagicItems.md');
const PRESETS_DIR = join(PLUGIN_ROOT, 'Presets/Items');

// Parse args
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitIndex = args.indexOf('--limit');
const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1]) : null;

console.log('=== Item Reference Converter ===');
console.log('Plugin Root:', PLUGIN_ROOT);
console.log('Reference File:', ITEMS_REFERENCE_FILE);
console.log('Presets Dir:', PRESETS_DIR);
console.log('Dry Run:', dryRun);
if (limit) console.log('Limit:', limit);
console.log('');

/**
 * Parse reference item markdown to ItemData
 */
function parseReferenceItem(markdown) {
    const lines = markdown.split('\n').map(l => l.trim());
    const data = { name: '' };

    // Extract name from #### header and remove ** bold markers
    for (const line of lines) {
        const match = line.match(/^####\s+(.+)$/);
        if (match) {
            data.name = match[1].trim().replace(/^\*\*(.+)\*\*$/, '$1');
            break;
        }
    }

    // Extract type line: *Category (Type), Rarity (Requires Attunement...)*
    for (const line of lines) {
        const typeMatch = line.match(/^\*(.+)\*$/);
        if (typeMatch) {
            const typeLine = typeMatch[1].trim();

            // Category
            const categoryMatch = typeLine.match(/^(\w+)/);
            if (categoryMatch) data.category = categoryMatch[1];

            // Type
            const typeInnerMatch = typeLine.match(/\(([^)]+)\)(?=,|$)/);
            if (typeInnerMatch) data.type = typeInnerMatch[1];

            // Rarity
            const rarityMatch = typeLine.match(/(Common|Uncommon|Rare|Very Rare|Legendary|Artifact)/i);
            if (rarityMatch) data.rarity = rarityMatch[1];

            // Attunement
            if (typeLine.includes('Requires Attunement')) {
                data.attunement = true;
                const attunementMatch = typeLine.match(/Requires Attunement\s+(.+?)(?:\)|$)/);
                if (attunementMatch) {
                    data.attunement_req = attunementMatch[1].trim();
                }
            }
            break;
        }
    }

    // Join for full text pattern matching
    const fullText = lines.join('\n');

    // Extract description
    const descLines = [];
    let foundTypeLine = false;
    for (const line of lines) {
        if (!foundTypeLine) {
            if (line.match(/^\*.*\*$/)) foundTypeLine = true;
            continue;
        }
        if (line.match(/^\*\*_.*\._\*\*/) || line.startsWith('####') || line.startsWith('Table:')) break;
        if (line && !line.startsWith('|')) descLines.push(line);
    }
    data.description = descLines.join('\n\n').trim() || undefined;

    // Parse charges
    const chargesMatch = fullText.match(/has\s+(\d+)\s+charges/i);
    if (chargesMatch) data.max_charges = parseInt(chargesMatch[1]);

    const rechargeMatch = fullText.match(/regains\s+([\dd+\s-]+)\s+(?:expended\s+)?charges/i);
    if (rechargeMatch) {
        data.recharge_formula = rechargeMatch[1].trim();
        data.recharge_time = "Dawn";
    }

    const destructionMatch = fullText.match(/On a 1,([^.]+)\./i);
    if (destructionMatch) {
        data.destruction_risk = `On 1, ${destructionMatch[1].trim()}`;
    }

    // Parse resistances
    const resistanceMatches = fullText.matchAll(/Resistance\s+to\s+(\w+)\s+damage/gi);
    const resistances = [];
    for (const match of resistanceMatches) {
        resistances.push(match[1]);
    }
    if (resistances.length > 0) data.resistances = resistances;

    // Parse ability changes
    const abilityMatches = fullText.matchAll(/Your\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+is\s+(\d+)/gi);
    const ability_changes = [];
    for (const match of abilityMatches) {
        ability_changes.push({
            ability: match[1].toLowerCase().substring(0, 3),
            value: parseInt(match[2]),
        });
    }
    if (ability_changes.length > 0) data.ability_changes = ability_changes;

    // Parse cursed
    const curseMatch = fullText.match(/\*\*_Curse\._\*\*\s+([^*]+?)(?=\*\*_|####|$)/s);
    if (curseMatch) {
        data.cursed = true;
        data.curse_description = curseMatch[1].trim().replace(/\n+/g, ' ');
    }

    return data;
}

/**
 * Convert ItemData to markdown
 */
function itemToMarkdown(data) {
    const lines = [];
    const name = data.name || "Unnamed Item";

    // YAML Frontmatter
    lines.push('---');
    lines.push('smType: item');
    lines.push(`name: "${name.replace(/"/g, '\\"')}"`);
    if (data.category) lines.push(`category: "${data.category}"`);
    if (data.type) lines.push(`type: "${data.type}"`);
    if (data.rarity) lines.push(`rarity: "${data.rarity}"`);
    if (data.attunement != null) lines.push(`attunement: ${!!data.attunement}`);
    if (data.attunement_req) lines.push(`attunement_req: "${data.attunement_req.replace(/"/g, '\\"')}"`);
    if (data.max_charges != null) lines.push(`max_charges: ${data.max_charges}`);
    if (data.recharge_formula) lines.push(`recharge_formula: "${data.recharge_formula}"`);
    if (data.recharge_time) lines.push(`recharge_time: "${data.recharge_time}"`);
    if (data.destruction_risk) lines.push(`destruction_risk: "${data.destruction_risk.replace(/"/g, '\\"')}"`);

    if (data.resistances && data.resistances.length > 0) {
        const resStr = data.resistances.map(r => `"${r}"`).join(', ');
        lines.push(`resistances: [${resStr}]`);
    }

    if (data.ability_changes && data.ability_changes.length > 0) {
        lines.push(`ability_changes_json: "${JSON.stringify(data.ability_changes).replace(/"/g, '\\"')}"`);
    }

    if (data.cursed != null) lines.push(`cursed: ${!!data.cursed}`);
    if (data.curse_description) lines.push(`curse_description: "${data.curse_description.replace(/"/g, '\\"')}"`);

    lines.push('---\n');

    // Markdown body
    lines.push(`# ${name}`);

    const typeParts = [];
    if (data.category) typeParts.push(data.category);
    if (data.type) typeParts.push(`(${data.type})`);
    if (data.rarity) typeParts.push(data.rarity);
    if (data.attunement) {
        const attunementText = data.attunement_req
            ? `Requires Attunement ${data.attunement_req}`
            : "Requires Attunement";
        typeParts.push(`(${attunementText})`);
    }
    if (typeParts.length > 0) {
        lines.push(`*${typeParts.join(" ")}*`);
    }
    lines.push('');

    if (data.max_charges != null) {
        lines.push(`## Charges\n`);
        lines.push(`This item has ${data.max_charges} charges.`);
        if (data.recharge_formula || data.recharge_time) {
            const rechargeParts = [];
            if (data.recharge_formula) rechargeParts.push(`regains ${data.recharge_formula} charges`);
            if (data.recharge_time) rechargeParts.push(`at ${data.recharge_time}`);
            lines.push(rechargeParts.join(" ") + ".");
        }
        if (data.destruction_risk) {
            lines.push(data.destruction_risk);
        }
        lines.push('');
    }

    if (data.resistances && data.resistances.length > 0) {
        lines.push(`- Resistances: ${data.resistances.join(", ")}`);
        lines.push('');
    }

    if (data.ability_changes && data.ability_changes.length > 0) {
        lines.push(`## Ability Changes\n`);
        for (const change of data.ability_changes) {
            const parts = [`${change.ability.toUpperCase()} becomes ${change.value}`];
            if (change.condition) parts.push(`(${change.condition})`);
            lines.push(`- ${parts.join(" ")}`);
        }
        lines.push('');
    }

    if (data.description) {
        lines.push(data.description.trim());
        lines.push('');
    }

    if (data.cursed && data.curse_description) {
        lines.push(`## Curse\n`);
        lines.push(data.curse_description.trim());
        lines.push('');
    }

    return lines.join('\n');
}

/**
 * Extract item sections from the large reference file
 */
function extractItemSections(content) {
    const sections = [];
    const lines = content.split('\n');
    let currentSection = [];
    let insideItems = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Start capturing when we find "Adamantine Armor" (first real item)
        if (line.includes('Adamantine Armor') && line.startsWith('####')) {
            insideItems = true;
            currentSection = [line];
            continue;
        }

        if (!insideItems) continue;

        if (line.startsWith('####')) {
            if (currentSection.length > 0) {
                // Validate this is a real item by checking for rarity in type line
                const sectionText = currentSection.join('\n');
                if (sectionText.match(/(Common|Uncommon|Rare|Very Rare|Legendary|Artifact)/i)) {
                    sections.push(sectionText);
                }
            }
            currentSection = [line];
        } else {
            currentSection.push(line);
        }
    }

    // Don't forget the last section
    if (currentSection.length > 0) {
        const sectionText = currentSection.join('\n');
        if (sectionText.match(/(Common|Uncommon|Rare|Very Rare|Legendary|Artifact)/i)) {
            sections.push(sectionText);
        }
    }

    return sections;
}

// Main conversion
console.log('Reading item reference file...');
const content = readFileSync(ITEMS_REFERENCE_FILE, 'utf-8');

console.log('Extracting item sections...');
const itemSections = extractItemSections(content);
console.log(`Found ${itemSections.length} items\n`);

if (itemSections.length === 0) {
    console.log('No items to convert. Exiting.');
    process.exit(0);
}

const sectionsToProcess = limit ? itemSections.slice(0, limit) : itemSections;
console.log(`Processing ${sectionsToProcess.length} items...\n`);

let success = 0;
let failed = 0;
const errors = [];

for (let i = 0; i < sectionsToProcess.length; i++) {
    const itemMarkdown = sectionsToProcess[i];
    const progress = `[${i + 1}/${sectionsToProcess.length}]`;

    try {
        // Parse
        const itemData = parseReferenceItem(itemMarkdown);

        if (!itemData.name) {
            throw new Error('No item name found');
        }

        // Convert to markdown
        const presetMarkdown = itemToMarkdown(itemData);

        // Sanitize filename
        const fileName = itemData.name.replace(/[\\/:*?"<>|]/g, '-') + '.md';
        const targetPath = join(PRESETS_DIR, fileName);

        if (dryRun) {
            console.log(`${progress} [DRY RUN] ${itemData.name}`);
        } else {
            // Create directory
            mkdirSync(PRESETS_DIR, { recursive: true });

            // Write file
            writeFileSync(targetPath, presetMarkdown, 'utf-8');

            console.log(`${progress} ✓ ${itemData.name}`);
        }

        success++;
    } catch (err) {
        failed++;
        const itemName = itemMarkdown.split('\n')[0].replace(/^####\s*/, '').trim();
        errors.push({ item: itemName || `Item ${i + 1}`, error: err.message });
        console.error(`${progress} ✗ ${itemName}: ${err.message}`);
    }
}

console.log('\n=== Conversion Complete ===');
console.log(`Success: ${success}`);
console.log(`Failed: ${failed}`);

if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(e => console.log(`  - ${e.item}: ${e.error}`));
}
