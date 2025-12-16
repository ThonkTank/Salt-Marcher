/**
 * Generate Creatures JSON
 *
 * Parses markdown statblocks from References/rulebooks and generates
 * a clean JSON file for the plugin.
 *
 * Run: node scripts/generate-creatures.mjs
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { join, basename } from 'path';

const CREATURES_DIR = './References/rulebooks/Statblocks/Creatures';
const OUTPUT_FILE = './src/generated/creatures.json';

// ============================================================================
// Parsing Functions
// ============================================================================

/**
 * Parse a single creature markdown file
 */
function parseCreature(content, id) {
	const creature = { id };

	// Name from first H1
	const nameMatch = content.match(/^#\s+(.+)$/m);
	creature.name = nameMatch ? nameMatch[1].trim() : id;

	// Type line: *Large Beast (Dinosaur), Unaligned*
	const typeLineMatch = content.match(/^\*([^*]+)\*$/m);
	if (typeLineMatch) {
		parseTypeLine(typeLineMatch[1], creature);
	}

	// Armor Class
	const acMatch = content.match(/\*\*Armor Class:\*\*\s*(\d+)/i);
	creature.ac = acMatch ? parseInt(acMatch[1], 10) : 10;

	// Hit Points
	const hpMatch = content.match(/\*\*Hit Points:\*\*\s*(\d+)\s*(?:\(([^)]+)\))?/i);
	if (hpMatch) {
		creature.hp = parseInt(hpMatch[1], 10);
		if (hpMatch[2]) {
			creature.hitDice = hpMatch[2].replace(/\s+/g, '');
		}
	}

	// Speed
	const speedMatch = content.match(/\*\*Speed:\*\*\s*([^\n]+)/i);
	creature.speed = speedMatch ? speedMatch[1].trim() : '30 ft.';

	// Ability scores from table
	creature.abilities = parseAbilityTable(content);

	// Save proficiencies from table
	const saves = parseSaveTable(content);
	if (Object.keys(saves).length > 0) {
		creature.saves = saves;
	}

	// CR and XP
	const crMatch = content.match(/\*\*CR\*\*\s*([^\s(]+)\s*(?:\(XP\s*([\d,]+))?/i);
	if (crMatch) {
		creature.cr = crMatch[1].trim();
		if (crMatch[2]) {
			creature.xp = parseInt(crMatch[2].replace(/,/g, ''), 10);
		}
	}

	// PB (from CR line or calculate)
	const pbMatch = content.match(/PB\s*\+(\d+)/i);
	if (pbMatch) {
		creature.pb = parseInt(pbMatch[1], 10);
	}

	// Skills
	const skillsMatch = content.match(/\*\*Skills\*\*:?\s*([^\n]+)/i);
	if (skillsMatch) {
		creature.skills = parseSkills(skillsMatch[1]);
	}

	// Senses (stop at semicolon, newline, or "Passive")
	const sensesMatch = content.match(/\*\*Senses\*\*:?\s*([^;\n]+?)(?:;|Passive|\n)/i);
	if (sensesMatch) {
		creature.senses = sensesMatch[1].trim();
	}

	// Passive Perception
	const passiveMatch = content.match(/Passive Perception\s*(\d+)/i);
	if (passiveMatch) {
		creature.passivePerception = parseInt(passiveMatch[1], 10);
	}

	// Languages
	const langMatch = content.match(/\*\*Languages\*\*:?\s*([^\n]+)/i);
	if (langMatch) {
		creature.languages = langMatch[1].trim();
	}

	// Immunities
	const immuneMatch = content.match(/\*\*Immunit(?:y|ies)\*\*:?\s*([^\n]+)/i);
	if (immuneMatch) {
		creature.immunities = immuneMatch[1].trim();
	}

	// Resistances
	const resistMatch = content.match(/\*\*Resistance[s]?\*\*:?\s*([^\n]+)/i);
	if (resistMatch) {
		creature.resistances = resistMatch[1].trim();
	}

	// Vulnerabilities
	const vulnMatch = content.match(/\*\*Vulnerabilit(?:y|ies)\*\*:?\s*([^\n]+)/i);
	if (vulnMatch) {
		creature.vulnerabilities = vulnMatch[1].trim();
	}

	// Condition Immunities
	const condMatch = content.match(/\*\*Condition Immunit(?:y|ies)\*\*:?\s*([^\n]+)/i);
	if (condMatch) {
		creature.conditionImmunities = condMatch[1].trim();
	}

	// Sections (Traits, Actions, etc.)
	const sections = parseSections(content);
	if (sections.traits) creature.traits = sections.traits;
	if (sections.actions) creature.actions = sections.actions;
	if (sections.bonusActions) creature.bonusActions = sections.bonusActions;
	if (sections.reactions) creature.reactions = sections.reactions;
	if (sections.legendary) creature.legendary = sections.legendary;

	return creature;
}

/**
 * Parse the type line: "Large Beast (Dinosaur), Unaligned"
 */
function parseTypeLine(line, creature) {
	// Size is first word
	const sizeMatch = line.match(/^(Tiny|Small|Medium|Large|Huge|Gargantuan)\b/i);
	creature.size = sizeMatch ? capitalize(sizeMatch[1]) : 'Medium';

	// Type and optional tags: "Beast (Dinosaur)" or "Dragon (Chromatic)"
	const typeMatch = line.match(/(?:Tiny|Small|Medium|Large|Huge|Gargantuan)\s+(\w+)(?:\s*\(([^)]+)\))?/i);
	if (typeMatch) {
		creature.type = capitalize(typeMatch[1]);
		if (typeMatch[2]) {
			creature.typeTags = typeMatch[2].split(/,\s*/).map(t => t.trim());
		}
	}

	// Alignment is after the comma
	const alignMatch = line.match(/,\s*(.+)$/);
	if (alignMatch) {
		creature.alignment = alignMatch[1].trim();
	}
}

/**
 * Parse ability scores from the markdown table
 */
function parseAbilityTable(content) {
	const abilities = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

	// Find table rows
	const tableMatch = content.match(/\|STAT\|SCORE\|MOD\|SAVE\|[\s\S]*?(?=\n\n|\n-|\n###|$)/i);
	if (!tableMatch) return abilities;

	const rows = tableMatch[0].split('\n').filter(row => row.includes('|'));

	for (const row of rows) {
		const cells = row.split('|').map(c => c.trim()).filter(c => c);
		if (cells.length >= 2) {
			const stat = cells[0].toLowerCase();
			const score = parseInt(cells[1], 10);
			if (stat in abilities && !isNaN(score)) {
				abilities[stat] = score;
			}
		}
	}

	return abilities;
}

/**
 * Parse save proficiencies from the table (where SAVE differs from MOD)
 */
function parseSaveTable(content) {
	const saves = {};

	const tableMatch = content.match(/\|STAT\|SCORE\|MOD\|SAVE\|[\s\S]*?(?=\n\n|\n-|\n###|$)/i);
	if (!tableMatch) return saves;

	const rows = tableMatch[0].split('\n').filter(row => row.includes('|'));

	for (const row of rows) {
		const cells = row.split('|').map(c => c.trim()).filter(c => c);
		if (cells.length >= 4) {
			const stat = cells[0].toLowerCase();
			const mod = parseInt(cells[2], 10);
			const save = parseInt(cells[3], 10);
			// If save differs from mod, it's a proficiency
			if (!isNaN(mod) && !isNaN(save) && save !== mod && ['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(stat)) {
				saves[stat] = save;
			}
		}
	}

	return saves;
}

/**
 * Parse skills from a line like "Perception +11, Stealth +7"
 */
function parseSkills(line) {
	const skills = {};
	const matches = line.matchAll(/(\w+(?:\s+\w+)?)\s*\+(\d+)/g);
	for (const match of matches) {
		skills[match[1]] = parseInt(match[2], 10);
	}
	return Object.keys(skills).length > 0 ? skills : undefined;
}

/**
 * Parse markdown sections (### Traits, ### Actions, etc.)
 */
function parseSections(content) {
	const sections = {};
	const sectionRegex = /###\s+(Traits|Actions|Bonus Actions|Reactions|Legendary Actions)\s*\n([\s\S]*?)(?=###|\n## |$)/gi;

	let match;
	while ((match = sectionRegex.exec(content)) !== null) {
		const name = match[1].toLowerCase().replace(/\s+/g, '');
		const text = match[2].trim();

		switch (name) {
			case 'traits':
				sections.traits = text;
				break;
			case 'actions':
				sections.actions = text;
				break;
			case 'bonusactions':
				sections.bonusActions = text;
				break;
			case 'reactions':
				sections.reactions = text;
				break;
			case 'legendaryactions':
				sections.legendary = text;
				break;
		}
	}

	return sections;
}

/**
 * Capitalize first letter
 */
function capitalize(str) {
	return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// ============================================================================
// File Reading
// ============================================================================

/**
 * Read all markdown files from a directory recursively
 */
function readCreaturesFromDir(dirPath) {
	const creatures = [];

	if (!existsSync(dirPath)) {
		console.warn(`Directory not found: ${dirPath}`);
		return creatures;
	}

	const entries = readdirSync(dirPath, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = join(dirPath, entry.name);

		if (entry.isDirectory()) {
			creatures.push(...readCreaturesFromDir(fullPath));
		} else if (entry.name.endsWith('.md')) {
			try {
				const content = readFileSync(fullPath, 'utf-8');
				const id = basename(entry.name, '.md');
				const creature = parseCreature(content, id);
				creatures.push(creature);
			} catch (e) {
				console.warn(`Failed to parse ${fullPath}: ${e.message}`);
			}
		}
	}

	return creatures;
}

// ============================================================================
// Main
// ============================================================================

console.log('Generating creatures JSON...');

const creatures = readCreaturesFromDir(CREATURES_DIR);

// Sort by name
creatures.sort((a, b) => a.name.localeCompare(b.name));

console.log(`Found ${creatures.length} creatures`);

// Ensure output directory exists
const outputDir = join('.', 'src', 'generated');
if (!existsSync(outputDir)) {
	mkdirSync(outputDir, { recursive: true });
}

writeFileSync(OUTPUT_FILE, JSON.stringify(creatures, null, 2));
console.log(`Written to ${OUTPUT_FILE}`);
