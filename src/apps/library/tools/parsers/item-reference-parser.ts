// src/apps/library/core/item-reference-parser.ts
// Intelligent parsing of item references from markdown format
import { ItemData } from "./item-files";

/**
 * Parse a reference item markdown block into ItemData
 * Handles complex patterns like charges, spells, tables, etc.
 */
export function parseReferenceItem(markdown: string): ItemData {
    const lines = markdown.split('\n').map(l => l.trim());
    const data: ItemData = { name: "" };

    // Extract name from #### header (remove ** bold markers)
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
            parseTypeLine(typeMatch[1], data);
            break;
        }
    }

    // Join all lines into full text for pattern matching
    const fullText = lines.join('\n');

    // Extract description (everything after type line, before special sections)
    data.description = extractDescription(lines);

    // Parse charges system
    parseCharges(fullText, data);

    // Parse spells
    parseSpells(fullText, data);

    // Parse bonuses
    parseBonuses(fullText, data);

    // Parse resistances
    parseResistances(fullText, data);

    // Parse ability changes
    parseAbilityChanges(fullText, data);

    // Parse properties
    parseProperties(fullText, data);

    // Parse curse
    parseCurse(fullText, data);

    // Parse tables
    parseTables(fullText, data);

    // Parse variants (for +1/+2/+3 items)
    parseVariants(fullText, data);

    return data;
}

/**
 * Parse the type line: *Category (Type), Rarity (Requires Attunement...)*
 */
function parseTypeLine(typeLine: string, data: ItemData): void {
    // Remove extra spaces
    typeLine = typeLine.trim();

    // Extract category (first word before parenthesis or comma)
    const categoryMatch = typeLine.match(/^(\w+)/);
    if (categoryMatch) {
        data.category = categoryMatch[1];
    }

    // Extract type (in parentheses after category)
    const typeMatch = typeLine.match(/\(([^)]+)\)(?=,|$)/);
    if (typeMatch) {
        data.type = typeMatch[1];
    }

    // Extract rarity
    const rarityPattern = /(Common|Uncommon|Rare|Very Rare|Legendary|Artifact)/i;
    const rarityMatch = typeLine.match(rarityPattern);
    if (rarityMatch) {
        data.rarity = rarityMatch[1];
    }

    // Extract attunement
    if (typeLine.includes('Requires Attunement')) {
        data.attunement = true;
        const attunementMatch = typeLine.match(/Requires Attunement\s+(.+?)(?:\)|$)/);
        if (attunementMatch) {
            data.attunement_req = attunementMatch[1].trim();
        }
    }
}

/**
 * Extract description (main text before special sections)
 */
function extractDescription(lines: string[]): string | undefined {
    const descLines: string[] = [];
    let foundTypeLine = false;
    let inSpecialSection = false;

    for (const line of lines) {
        // Skip until we find the type line
        if (!foundTypeLine) {
            if (line.match(/^\*.*\*$/)) {
                foundTypeLine = true;
            }
            continue;
        }

        // Stop at special sections
        if (line.match(/^\*\*_.*\._\*\*/) || line.startsWith('####') || line.startsWith('Table:')) {
            inSpecialSection = true;
        }

        if (inSpecialSection) break;

        // Collect description lines
        if (line && !line.startsWith('|')) {
            descLines.push(line);
        }
    }

    return descLines.join('\n\n').trim() || undefined;
}

/**
 * Parse charges system
 */
function parseCharges(text: string, data: ItemData): void {
    // Match "has X charges"
    const chargesMatch = text.match(/has\s+(\d+)\s+charges/i);
    if (chargesMatch) {
        data.max_charges = parseInt(chargesMatch[1]);
    }

    // Match "regains XdX + X" or "regains XdX"
    const rechargeMatch = text.match(/regains\s+([\dd+\s-]+)\s+(?:expended\s+)?charges/i);
    if (rechargeMatch) {
        data.recharge_formula = rechargeMatch[1].trim();
        data.recharge_time = "Dawn"; // Default
    }

    // Match "daily at dawn" or other timing
    const timingMatch = text.match(/charges\s+daily\s+at\s+(\w+)/i);
    if (timingMatch) {
        data.recharge_time = timingMatch[1];
    }

    // Match destruction risk: "On a 1, ..."
    const destructionMatch = text.match(/On a 1,([^.]+)\./i);
    if (destructionMatch) {
        data.destruction_risk = `On 1, ${destructionMatch[1].trim()}`;
    }
}

/**
 * Parse spells from tables or text
 */
function parseSpells(text: string, data: ItemData): void {
    // Look for spell tables: | Spell | Charge Cost |
    const spellTableMatch = text.match(/\|\s*Spell\s*\|\s*Charge Cost\s*\|[\s\S]*?(?=\n\n|\*\*_|####|$)/);
    if (!spellTableMatch) return;

    const spells: ItemData['spells'] = [];
    const tableText = spellTableMatch[0];
    const rows = tableText.split('\n').slice(2); // Skip header and separator

    for (const row of rows) {
        if (!row.trim() || !row.includes('|')) continue;

        const cells = row.split('|').map(c => c.trim()).filter(Boolean);
        if (cells.length < 2) continue;

        const spellName = cells[0].trim();
        const chargeCostText = cells[1].trim();

        // Parse charge cost (might be number or text like "1 charge per spell level")
        let chargeCost: number | undefined;
        const costMatch = chargeCostText.match(/^\d+/);
        if (costMatch) {
            chargeCost = parseInt(costMatch[0]);
        }

        spells.push({
            name: spellName,
            charge_cost: chargeCost,
        });
    }

    if (spells.length > 0) {
        data.spells = spells;
    }

    // Check if uses caster's DC
    if (text.includes('using your spell save DC') || text.includes('using your spellcasting ability')) {
        if (data.spells) {
            data.spells.forEach(spell => spell.uses_caster_dc = true);
        }
    }
}

/**
 * Parse bonuses (+1, +2, etc.)
 */
function parseBonuses(text: string, data: ItemData): void {
    const bonuses: ItemData['bonuses'] = [];

    // Match "+X bonus to Y"
    const bonusMatches = text.matchAll(/\+(\d+)\s+bonus\s+to\s+([^.,]+)/gi);
    for (const match of bonusMatches) {
        bonuses.push({
            type: match[2].trim(),
            value: `+${match[1]}`,
        });
    }

    // Match "bonus to attack rolls and damage rolls"
    if (text.match(/bonus\s+to\s+attack\s+rolls\s+and\s+damage\s+rolls/i)) {
        const bonusMatch = text.match(/\+(\d+)/);
        if (bonusMatch && bonuses.length === 0) {
            bonuses.push({ type: "attack", value: `+${bonusMatch[1]}` });
            bonuses.push({ type: "damage", value: `+${bonusMatch[1]}` });
        }
    }

    if (bonuses.length > 0) {
        data.bonuses = bonuses;
    }
}

/**
 * Parse resistances
 */
function parseResistances(text: string, data: ItemData): void {
    // Match "Resistance to X damage"
    const resistanceMatches = text.matchAll(/Resistance\s+to\s+(\w+)\s+damage/gi);
    const resistances: string[] = [];

    for (const match of resistanceMatches) {
        resistances.push(match[1]);
    }

    if (resistances.length > 0) {
        data.resistances = resistances;
    }
}

/**
 * Parse ability score changes
 */
function parseAbilityChanges(text: string, data: ItemData): void {
    const changes: ItemData['ability_changes'] = [];

    // Match "Your X is Y"
    const abilityPattern = /Your\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+is\s+(\d+)/gi;
    const matches = text.matchAll(abilityPattern);

    for (const match of matches) {
        const ability = match[1].toLowerCase().substring(0, 3);
        const value = parseInt(match[2]);

        changes.push({
            ability,
            value,
        });
    }

    if (changes.length > 0) {
        data.ability_changes = changes;
    }
}

/**
 * Parse properties with **_Name._** pattern
 */
function parseProperties(text: string, data: ItemData): void {
    const properties: ItemData['properties'] = [];

    // Match **_Property Name._** followed by description
    const propertyPattern = /\*\*_([^_]+)\._\*\*\s+([^*]+?)(?=\*\*_|####|$)/gs;
    const matches = text.matchAll(propertyPattern);

    for (const match of matches) {
        const name = match[1].trim();
        let description = match[2].trim();

        // Remove leading/trailing whitespace and newlines
        description = description.replace(/\n+/g, ' ').trim();

        properties.push({
            name,
            description,
        });
    }

    if (properties.length > 0) {
        data.properties = properties;
    }
}

/**
 * Parse curse information
 */
function parseCurse(text: string, data: ItemData): void {
    // Look for **_Curse._** section
    const curseMatch = text.match(/\*\*_Curse\._\*\*\s+([^*]+?)(?=\*\*_|####|$)/s);
    if (curseMatch) {
        data.cursed = true;
        data.curse_description = curseMatch[1].trim().replace(/\n+/g, ' ');
    }
}

/**
 * Parse tables
 */
function parseTables(text: string, data: ItemData): void {
    const tables: ItemData['tables'] = [];

    // Find all markdown tables (but not spell tables)
    const tablePattern = /(?:Table:\s*([^\n]+)\n)?\|([^\n]+)\|[\s\S]*?(?=\n\n|####|$)/g;
    const matches = text.matchAll(tablePattern);

    for (const match of matches) {
        const tableName = match[1]?.trim();
        const tableText = match[0];

        // Skip spell tables
        if (tableText.includes('Spell') && tableText.includes('Charge Cost')) continue;

        // Parse table
        const rows = tableText.split('\n').filter(l => l.includes('|'));
        if (rows.length < 3) continue; // Need header, separator, and at least one row

        const headerCells = rows[0].split('|').map(c => c.trim()).filter(Boolean);
        const dataRows = rows.slice(2); // Skip header and separator

        const entries: Array<{ roll: string; result: string }> = [];

        for (const row of dataRows) {
            const cells = row.split('|').map(c => c.trim()).filter(Boolean);
            if (cells.length < 2) continue;

            entries.push({
                roll: cells[0],
                result: cells.slice(1).join(' '),
            });
        }

        if (entries.length > 0) {
            tables.push({
                name: tableName || "Table",
                entries,
            });
        }
    }

    if (tables.length > 0) {
        data.tables = tables;
    }
}

/**
 * Parse variant information (for +1/+2/+3 items)
 */
function parseVariants(text: string, data: ItemData): void {
    // Check if item name contains "+1, +2, or +3"
    if (data.name.match(/\+1,\s*\+2,\s*or\s*\+3/i)) {
        data.has_variants = true;
        data.variant_info = "This item comes in +1, +2, and +3 variants with different rarities.";
    }
}
