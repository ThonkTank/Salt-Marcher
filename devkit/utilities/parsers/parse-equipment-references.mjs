// scripts/parse-equipment-references.mjs
// Parses equipment from Reference files and generates preset markdown files

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REFERENCES_FILE = path.join(__dirname, '..', 'References', 'rulebooks', 'CharacterFeatures', '06_Equipment.md');
const PRESETS_DIR = path.join(__dirname, '..', 'Presets', 'Equipment');

/**
 * Parse markdown tables into arrays of objects
 */
function parseMarkdownTable(tableText) {
    const lines = tableText.trim().split('\n').filter(l => l.trim());
    if (lines.length < 3) return [];

    // First line is headers
    const headers = lines[0].split('|').map(h => h.trim()).filter(Boolean);

    // Second line is separator (skip it)
    // Remaining lines are data
    const dataLines = lines.slice(2);

    return dataLines.map(line => {
        const cells = line.split('|').map(c => c.trim()).filter(Boolean);
        const row = {};
        headers.forEach((header, i) => {
            row[header] = cells[i] || '';
        });
        return row;
    });
}

/**
 * Clean up markdown formatting from cell content
 */
function cleanMarkdown(text) {
    if (!text) return '';
    return text
        .replace(/\*\*/g, '')  // Remove bold
        .replace(/\*/g, '')    // Remove italic
        .replace(/`/g, '')     // Remove code
        .trim();
}

/**
 * Parse weapon table row into EquipmentData
 */
function parseWeapon(row, category, weaponType) {
    const name = cleanMarkdown(row.Name);
    const damage = cleanMarkdown(row.Damage);
    const properties = cleanMarkdown(row.Properties)
        .split(',')
        .map(p => p.trim())
        .filter(p => p && p !== '—');
    const mastery = cleanMarkdown(row.Mastery);
    const weight = cleanMarkdown(row.Weight);
    const cost = cleanMarkdown(row.Cost);

    return {
        name,
        type: 'weapon',
        cost,
        weight,
        weapon_category: category,
        weapon_type: weaponType,
        damage,
        properties: properties.length > 0 ? properties : undefined,
        mastery,
    };
}

/**
 * Parse armor table row into EquipmentData
 */
function parseArmor(row, category) {
    const name = cleanMarkdown(row.Armor);
    const ac = cleanMarkdown(row['Armor Class (AC)']);
    const strength = cleanMarkdown(row.Strength);
    const stealth = cleanMarkdown(row.Stealth);
    const weight = cleanMarkdown(row.Weight);
    const cost = cleanMarkdown(row.Cost);

    const data = {
        name,
        type: 'armor',
        cost,
        weight,
        armor_category: category,
        ac,
    };

    if (strength && strength !== '—') {
        data.strength_requirement = strength;
    }

    if (stealth && stealth.toLowerCase().includes('disadvantage')) {
        data.stealth_disadvantage = true;
    }

    // Add don/doff times based on category
    if (category === 'Light') {
        data.don_time = '1 Minute';
        data.doff_time = '1 Minute';
    } else if (category === 'Medium') {
        data.don_time = '5 Minutes';
        data.doff_time = '1 Minute';
    } else if (category === 'Heavy') {
        data.don_time = '10 Minutes';
        data.doff_time = '5 Minutes';
    } else if (category === 'Shield') {
        data.don_time = 'Utilize Action';
        data.doff_time = 'Utilize Action';
    }

    return data;
}

/**
 * Generate markdown file for equipment
 */
function generateEquipmentMarkdown(data) {
    const lines = [];

    // Frontmatter
    lines.push('---');
    lines.push('smType: equipment');
    lines.push(`name: "${data.name.replace(/"/g, '\\"')}"`);
    lines.push(`type: "${data.type}"`);

    if (data.cost) lines.push(`cost: "${data.cost}"`);
    if (data.weight) lines.push(`weight: "${data.weight}"`);

    // Weapon fields
    if (data.weapon_category) lines.push(`weapon_category: "${data.weapon_category}"`);
    if (data.weapon_type) lines.push(`weapon_type: "${data.weapon_type}"`);
    if (data.damage) lines.push(`damage: "${data.damage}"`);
    if (data.properties && data.properties.length > 0) {
        const propList = data.properties.map(p => `"${p.replace(/"/g, '\\"')}"`).join(', ');
        lines.push(`properties: [${propList}]`);
    }
    if (data.mastery) lines.push(`mastery: "${data.mastery}"`);

    // Armor fields
    if (data.armor_category) lines.push(`armor_category: "${data.armor_category}"`);
    if (data.ac) lines.push(`ac: "${data.ac}"`);
    if (data.strength_requirement) lines.push(`strength_requirement: "${data.strength_requirement}"`);
    if (data.stealth_disadvantage) lines.push(`stealth_disadvantage: true`);
    if (data.don_time) lines.push(`don_time: "${data.don_time}"`);
    if (data.doff_time) lines.push(`doff_time: "${data.doff_time}"`);

    // Tool fields
    if (data.tool_category) lines.push(`tool_category: "${data.tool_category}"`);
    if (data.ability) lines.push(`ability: "${data.ability}"`);
    if (data.utilize && data.utilize.length > 0) {
        const utilizeList = data.utilize.map(u => `"${u.replace(/"/g, '\\"')}"`).join(', ');
        lines.push(`utilize: [${utilizeList}]`);
    }
    if (data.craft && data.craft.length > 0) {
        const craftList = data.craft.map(c => `"${c.replace(/"/g, '\\"')}"`).join(', ');
        lines.push(`craft: [${craftList}]`);
    }
    if (data.variants && data.variants.length > 0) {
        const variantsList = data.variants.map(v => `"${v.replace(/"/g, '\\"')}"`).join(', ');
        lines.push(`variants: [${variantsList}]`);
    }

    // Gear fields
    if (data.gear_category) lines.push(`gear_category: "${data.gear_category}"`);
    if (data.special_use) lines.push(`special_use: "${data.special_use.replace(/"/g, '\\"')}"`);
    if (data.capacity) lines.push(`capacity: "${data.capacity}"`);
    if (data.duration) lines.push(`duration: "${data.duration}"`);

    lines.push('---\n');

    // Body
    lines.push(`# ${data.name}`);

    // Type line
    const typeParts = [];
    if (data.type === 'weapon') {
        if (data.weapon_category) typeParts.push(data.weapon_category);
        if (data.weapon_type) typeParts.push(data.weapon_type);
        typeParts.push('Weapon');
    } else if (data.type === 'armor') {
        if (data.armor_category) typeParts.push(data.armor_category);
        typeParts.push('Armor');
    } else if (data.type === 'tool') {
        if (data.tool_category) typeParts.push(data.tool_category);
        typeParts.push('Tool');
    } else if (data.type === 'gear') {
        typeParts.push('Adventuring Gear');
    }

    if (typeParts.length > 0) {
        lines.push(`*${typeParts.join(' ')}*\n`);
    }

    // Stats
    const stats = [];
    if (data.cost) stats.push(`- **Cost:** ${data.cost}`);
    if (data.weight) stats.push(`- **Weight:** ${data.weight}`);
    if (stats.length > 0) {
        lines.push(...stats);
        lines.push('');
    }

    // Weapon details
    if (data.type === 'weapon') {
        if (data.damage) {
            lines.push(`**Damage:** ${data.damage}\n`);
        }
        if (data.properties && data.properties.length > 0) {
            lines.push(`**Properties:** ${data.properties.join(', ')}\n`);
        }
        if (data.mastery) {
            lines.push(`**Mastery:** ${data.mastery}\n`);
        }
    }

    // Armor details
    if (data.type === 'armor') {
        if (data.ac) {
            lines.push(`**Armor Class (AC):** ${data.ac}\n`);
        }
        if (data.strength_requirement) {
            lines.push(`**Strength Requirement:** ${data.strength_requirement}\n`);
        }
        if (data.stealth_disadvantage) {
            lines.push(`**Stealth:** Disadvantage\n`);
        }
        if (data.don_time || data.doff_time) {
            const timeParts = [];
            if (data.don_time) timeParts.push(`Don: ${data.don_time}`);
            if (data.doff_time) timeParts.push(`Doff: ${data.doff_time}`);
            lines.push(`**Time:** ${timeParts.join(', ')}\n`);
        }
    }

    // Tool details
    if (data.type === 'tool') {
        if (data.ability) {
            lines.push(`**Ability:** ${data.ability}\n`);
        }
        if (data.utilize && data.utilize.length > 0) {
            lines.push(`## Utilize\n`);
            for (const use of data.utilize) {
                lines.push(`- ${use}`);
            }
            lines.push('');
        }
        if (data.craft && data.craft.length > 0) {
            lines.push(`## Craft\n`);
            lines.push(data.craft.join(', '));
            lines.push('');
        }
        if (data.variants && data.variants.length > 0) {
            lines.push(`## Variants\n`);
            for (const variant of data.variants) {
                lines.push(`- ${variant}`);
            }
            lines.push('');
        }
    }

    if (data.description) {
        lines.push(data.description);
        lines.push('');
    }

    return lines.join('\n');
}

/**
 * Extract all table content between a header and the next header
 */
function extractTableSection(content, startPattern, endPattern) {
    const startMatch = content.match(new RegExp(startPattern, 'i'));
    if (!startMatch) return '';

    const startPos = startMatch.index + startMatch[0].length;
    let endPos = content.length;

    if (endPattern) {
        const endMatch = content.slice(startPos).match(new RegExp(endPattern, 'i'));
        if (endMatch) {
            endPos = startPos + endMatch.index;
        }
    }

    return content.slice(startPos, endPos);
}

/**
 * Parse tool section (e.g., "#### Alchemist's Supplies (50 GP)")
 */
function parseTool(section, toolCategory) {
    const lines = section.trim().split('\n');
    if (lines.length === 0) return null;

    // First line: #### Tool Name (Cost)
    const headerMatch = lines[0].match(/^####\s+(.+?)\s*\((.+?)\)/);
    if (!headerMatch) return null;

    const name = cleanMarkdown(headerMatch[1]);
    const cost = cleanMarkdown(headerMatch[2]);

    const data = {
        name,
        type: 'tool',
        cost,
        tool_category: toolCategory,
    };

    // Parse subsequent fields
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.startsWith('**Ability:**')) {
            data.ability = line.replace('**Ability:**', '').trim();
        } else if (line.startsWith('**Weight:**')) {
            data.weight = line.replace('**Weight:**', '').trim();
        } else if (line.startsWith('**Utilize:**')) {
            const utilizeLine = line.replace('**Utilize:**', '').trim();
            data.utilize = utilizeLine.split(/,\s*or\s+/).map(u => u.trim());
        } else if (line.startsWith('**Craft:**')) {
            const craftLine = line.replace('**Craft:**', '').trim();
            data.craft = craftLine.split(',').map(c => c.trim());
        } else if (line.startsWith('**Variants:**')) {
            const variantsLine = line.replace('**Variants:**', '').trim();
            data.variants = variantsLine.split(',').map(v => v.trim());
        }
    }

    return data;
}

/**
 * Parse adventuring gear from table
 */
function parseAdventuringGear(row) {
    const name = cleanMarkdown(row.Item);
    const weight = cleanMarkdown(row.Weight);
    const cost = cleanMarkdown(row.Cost);

    return {
        name,
        type: 'gear',
        cost,
        weight,
    };
}

/**
 * Main parsing function
 */
function parseEquipmentReferences() {
    console.log('Reading equipment references...');

    if (!fs.existsSync(REFERENCES_FILE)) {
        console.error(`References file not found: ${REFERENCES_FILE}`);
        return;
    }

    const content = fs.readFileSync(REFERENCES_FILE, 'utf-8');
    const equipmentData = [];

    // === Parse Weapons ===
    console.log('Parsing weapons...');

    // Simple Melee Weapons
    const simpleMeleeSection = extractTableSection(content, 'Table: Simple Melee Weapons', 'Table: Simple Ranged Weapons');
    const simpleMeleeRows = parseMarkdownTable(simpleMeleeSection);
    for (const row of simpleMeleeRows) {
        equipmentData.push(parseWeapon(row, 'Simple', 'Melee'));
    }

    // Simple Ranged Weapons
    const simpleRangedSection = extractTableSection(content, 'Table: Simple Ranged Weapons', 'Table: Martial Melee Weapons');
    const simpleRangedRows = parseMarkdownTable(simpleRangedSection);
    for (const row of simpleRangedRows) {
        equipmentData.push(parseWeapon(row, 'Simple', 'Ranged'));
    }

    // Martial Melee Weapons
    const martialMeleeSection = extractTableSection(content, 'Table: Martial Melee Weapons', 'Table: Martial Ranged Weapons');
    const martialMeleeRows = parseMarkdownTable(martialMeleeSection);
    for (const row of martialMeleeRows) {
        equipmentData.push(parseWeapon(row, 'Martial', 'Melee'));
    }

    // Martial Ranged Weapons
    const martialRangedSection = extractTableSection(content, 'Table: Martial Ranged Weapons', '## Armor');
    const martialRangedRows = parseMarkdownTable(martialRangedSection);
    for (const row of martialRangedRows) {
        equipmentData.push(parseWeapon(row, 'Martial', 'Ranged'));
    }

    // === Parse Armor ===
    console.log('Parsing armor...');

    // Light Armor
    const lightArmorSection = extractTableSection(content, 'Table: Light Armor', 'Table: Medium Armor');
    const lightArmorRows = parseMarkdownTable(lightArmorSection);
    for (const row of lightArmorRows) {
        equipmentData.push(parseArmor(row, 'Light'));
    }

    // Medium Armor
    const mediumArmorSection = extractTableSection(content, 'Table: Medium Armor', 'Table: Heavy Armor');
    const mediumArmorRows = parseMarkdownTable(mediumArmorSection);
    for (const row of mediumArmorRows) {
        equipmentData.push(parseArmor(row, 'Medium'));
    }

    // Heavy Armor
    const heavyArmorSection = extractTableSection(content, 'Table: Heavy Armor', 'Table: Shield');
    const heavyArmorRows = parseMarkdownTable(heavyArmorSection);
    for (const row of heavyArmorRows) {
        equipmentData.push(parseArmor(row, 'Heavy'));
    }

    // Shield
    const shieldSection = extractTableSection(content, 'Table: Shield', '## Tools');
    const shieldRows = parseMarkdownTable(shieldSection);
    for (const row of shieldRows) {
        equipmentData.push(parseArmor(row, 'Shield'));
    }

    // === Parse Tools ===
    console.log('Parsing tools...');

    // Extract tools section
    const toolsSection = extractTableSection(content, '## Tools', '## Adventuring Gear');

    // Parse individual tool sections (#### Tool Name (Cost))
    const toolSections = toolsSection.split(/(?=^####\s+)/m).filter(s => s.trim());

    for (const section of toolSections) {
        let toolCategory = 'Other';

        // Determine category based on section position or content
        if (section.includes("Alchemist's") || section.includes("Brewer's") || section.includes("Calligrapher's") ||
            section.includes("Carpenter's") || section.includes("Cartographer's") || section.includes("Cobbler's") ||
            section.includes("Cook's") || section.includes("Glassblower's") || section.includes("Jeweler's") ||
            section.includes("Leatherworker's") || section.includes("Mason's") || section.includes("Painter's") ||
            section.includes("Potter's") || section.includes("Smith's") || section.includes("Tinker's") ||
            section.includes("Weaver's") || section.includes("Woodcarver's")) {
            toolCategory = 'Artisan';
        } else if (section.includes('Gaming Set')) {
            toolCategory = 'Gaming';
        } else if (section.includes('Musical Instrument')) {
            toolCategory = 'Musical';
        }

        const toolData = parseTool(section, toolCategory);
        if (toolData) {
            equipmentData.push(toolData);
        }
    }

    // === Parse Adventuring Gear ===
    console.log('Parsing adventuring gear...');

    const adventuringGearSection = extractTableSection(content, 'Table: Adventuring Gear', 'Table: Ammunition');
    const adventuringGearRows = parseMarkdownTable(adventuringGearSection);

    for (const row of adventuringGearRows) {
        const gearData = parseAdventuringGear(row);
        if (gearData && gearData.name) {
            equipmentData.push(gearData);
        }
    }

    // === Generate Preset Files ===
    console.log(`Generating ${equipmentData.length} equipment preset files...`);

    // Create presets directory structure
    const weaponsDir = path.join(PRESETS_DIR, 'Weapons');
    const armorDir = path.join(PRESETS_DIR, 'Armor');
    const toolsDir = path.join(PRESETS_DIR, 'Tools');
    const gearDir = path.join(PRESETS_DIR, 'Gear');

    [weaponsDir, armorDir, toolsDir, gearDir].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });

    let weaponCount = 0;
    let armorCount = 0;
    let toolCount = 0;
    let gearCount = 0;

    for (const item of equipmentData) {
        const markdown = generateEquipmentMarkdown(item);
        const sanitizedName = item.name.replace(/[/\\:*?"<>|]/g, '-');

        let targetDir;
        if (item.type === 'weapon') {
            targetDir = weaponsDir;
            weaponCount++;
        } else if (item.type === 'armor') {
            targetDir = armorDir;
            armorCount++;
        } else if (item.type === 'tool') {
            targetDir = toolsDir;
            toolCount++;
        } else {
            targetDir = gearDir;
            gearCount++;
        }

        const filePath = path.join(targetDir, `${sanitizedName}.md`);
        fs.writeFileSync(filePath, markdown);
    }

    console.log('✓ Equipment parsing complete!');
    console.log(`  - ${weaponCount} weapons`);
    console.log(`  - ${armorCount} armor pieces`);
    console.log(`  - ${toolCount} tools`);
    console.log(`  - ${gearCount} adventuring gear items`);
}

// Run the parser
parseEquipmentReferences();
