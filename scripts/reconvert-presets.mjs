#!/usr/bin/env node
// Neu-Konvertierung aller Presets mit verbessertem Parser
// Nutzt den Reference-Parser direkt über esbuild

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PLUGIN_ROOT = join(__dirname, '..');
const REFERENCES_DIR = join(PLUGIN_ROOT, 'References/rulebooks/Statblocks/Creatures');
const VAULT_ROOT = join(PLUGIN_ROOT, '..', '..', '..');
const PRESETS_DIR = join(VAULT_ROOT, 'SaltMarcher/Presets/Creatures');

console.log('=== Preset Reconversion with Enhanced Parser ===');
console.log('References Dir:', REFERENCES_DIR);
console.log('Presets Dir:', PRESETS_DIR);
console.log('');

// Build parser module
console.log('Building reference parser...');
try {
    execSync('npx esbuild src/apps/library/core/reference-parser.ts --bundle --platform=node --format=esm --outfile=scripts/.tmp-parser.mjs --external:obsidian', {
        cwd: PLUGIN_ROOT,
        stdio: 'inherit'
    });
    console.log('✓ Parser built\n');
} catch (err) {
    console.error('Failed to build parser:', err.message);
    process.exit(1);
}

// Import parser
const { parseReferenceStatblock } = await import('./.tmp-parser.mjs');

// Markdown generator
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
        lines.push(`type_tags: [${tags}]`);
    }

    // Alignment
    const alignment = data.alignmentOverride || [data.alignmentLawChaos, data.alignmentGoodEvil].filter(Boolean).join(' ');
    if (alignment) lines.push(`alignment: "${alignment}"`);

    // Combat stats
    if (data.ac) lines.push(`ac: "${data.ac}"`);
    if (data.initiative) lines.push(`initiative: "${data.initiative}"`);
    if (data.hp) lines.push(`hp: "${data.hp}"`);
    if (data.hitDice) lines.push(`hit_dice: "${data.hitDice}"`);

    // Speeds
    if (data.speeds) {
        if (data.speeds.walk?.distance) lines.push(`speed_walk: "${data.speeds.walk.distance}"`);
        if (data.speeds.climb?.distance) lines.push(`speed_climb: "${data.speeds.climb.distance}"`);
        if (data.speeds.swim?.distance) lines.push(`speed_swim: "${data.speeds.swim.distance}"`);
        if (data.speeds.fly?.distance) lines.push(`speed_fly: "${data.speeds.fly.distance}"`);
        if (data.speeds.fly?.hover) lines.push(`speed_fly_hover: true`);
        if (data.speeds.burrow?.distance) lines.push(`speed_burrow: "${data.speeds.burrow.distance}"`);
        const json = JSON.stringify(data.speeds).replace(/"/g, '\\"');
        lines.push(`speeds_json: "${json}"`);
    }

    // Abilities
    if (data.str) lines.push(`str: "${data.str}"`);
    if (data.dex) lines.push(`dex: "${data.dex}"`);
    if (data.con) lines.push(`con: "${data.con}"`);
    if (data.int) lines.push(`int: "${data.int}"`);
    if (data.wis) lines.push(`wis: "${data.wis}"`);
    if (data.cha) lines.push(`cha: "${data.cha}"`);
    if (data.pb) lines.push(`pb: "${data.pb}"`);

    // Saves
    if (data.saveProf) {
        const saves = Object.entries(data.saveProf)
            .filter(([_, v]) => v)
            .map(([k]) => `"${k.toUpperCase()}"`);
        if (saves.length > 0) lines.push(`saves_prof: [${saves.join(', ')}]`);
    }

    // Skills
    if (data.skillsProf && data.skillsProf.length > 0) {
        const skills = data.skillsProf.map(s => `"${s}"`).join(', ');
        lines.push(`skills_prof: [${skills}]`);
    }

    // Senses, Languages, Passives
    if (data.sensesList && data.sensesList.length > 0) {
        const senses = data.sensesList.map(s => `"${s}"`).join(', ');
        lines.push(`senses: [${senses}]`);
    }
    if (data.passivesList && data.passivesList.length > 0) {
        const passives = data.passivesList.map(p => `"${p}"`).join(', ');
        lines.push(`passives: [${passives}]`);
    }
    if (data.languagesList && data.languagesList.length > 0) {
        const langs = data.languagesList.map(l => `"${l}"`).join(', ');
        lines.push(`languages: [${langs}]`);
    }

    // Defenses
    if (data.damageResistancesList && data.damageResistancesList.length > 0) {
        const res = data.damageResistancesList.map(r => `"${r}"`).join(', ');
        lines.push(`damage_resistances: [${res}]`);
    }
    if (data.damageImmunitiesList && data.damageImmunitiesList.length > 0) {
        const imm = data.damageImmunitiesList.map(i => `"${i}"`).join(', ');
        lines.push(`damage_immunities: [${imm}]`);
    }
    if (data.damageVulnerabilitiesList && data.damageVulnerabilitiesList.length > 0) {
        const vuln = data.damageVulnerabilitiesList.map(v => `"${v}"`).join(', ');
        lines.push(`damage_vulnerabilities: [${vuln}]`);
    }
    if (data.conditionImmunitiesList && data.conditionImmunitiesList.length > 0) {
        const cond = data.conditionImmunitiesList.map(c => `"${c}"`).join(', ');
        lines.push(`condition_immunities: [${cond}]`);
    }

    // CR, XP
    if (data.cr) lines.push(`cr: "${data.cr}"`);
    if (data.xp) lines.push(`xp: "${data.xp}"`);

    // Entries as JSON
    if (data.entries && data.entries.length > 0) {
        const json = JSON.stringify(data.entries).replace(/"/g, '\\"');
        lines.push(`entries_structured_json: "${json}"`);
    }

    lines.push('---\n');

    // Markdown body
    lines.push(`# ${data.name}`);
    const subtitle = [data.size, data.type, alignment].filter(Boolean).join(', ');
    if (subtitle) lines.push(`*${subtitle}*\n`);

    if (data.ac) lines.push(`**AC** ${data.ac}`);
    if (data.hp) lines.push(`**HP** ${data.hp}${data.hitDice ? ` (${data.hitDice})` : ''}`);

    // Speed
    const speedParts = [];
    if (data.speeds?.walk?.distance) speedParts.push(data.speeds.walk.distance);
    if (data.speeds?.swim?.distance) speedParts.push(`swim ${data.speeds.swim.distance}`);
    if (data.speeds?.fly?.distance) {
        const fly = `fly ${data.speeds.fly.distance}${data.speeds.fly.hover ? ' (hover)' : ''}`;
        speedParts.push(fly);
    }
    if (data.speeds?.climb?.distance) speedParts.push(`climb ${data.speeds.climb.distance}`);
    if (data.speeds?.burrow?.distance) speedParts.push(`burrow ${data.speeds.burrow.distance}`);
    if (speedParts.length > 0) lines.push(`**Speed** ${speedParts.join(', ')}`);

    // Abilities table
    if (data.str || data.dex || data.con || data.int || data.wis || data.cha) {
        lines.push('\n| STR | DEX | CON | INT | WIS | CHA |');
        lines.push('| --- | --- | --- | --- | --- | --- |');
        lines.push(`| ${data.str || '-'} | ${data.dex || '-'} | ${data.con || '-'} | ${data.int || '-'} | ${data.wis || '-'} | ${data.cha || '-'} |\n`);
    }

    // CR line
    if (data.cr) {
        const crParts = [`CR ${data.cr}`];
        if (data.xp) crParts.push(`XP ${data.xp}`);
        lines.push(crParts.join(', ') + '\n');
    }

    // Entries by category
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

// Recursively process files
function processDirectory(sourceDir, targetDir) {
    const entries = readdirSync(sourceDir);
    let count = 0;

    for (const entry of entries) {
        const sourcePath = join(sourceDir, entry);
        const stat = statSync(sourcePath);

        if (stat.isDirectory()) {
            const newTarget = join(targetDir, entry);
            mkdirSync(newTarget, { recursive: true });
            count += processDirectory(sourcePath, newTarget);
        } else if (entry.endsWith('.md')) {
            try {
                const markdown = readFileSync(sourcePath, 'utf-8');
                const data = parseReferenceStatblock(markdown);
                const output = statblockToMarkdown(data);

                const targetPath = join(targetDir, entry.toLowerCase());
                writeFileSync(targetPath, output, 'utf-8');
                console.log(`✓ ${entry} -> ${targetPath}`);
                count++;
            } catch (err) {
                console.error(`✗ Failed to process ${entry}:`, err.message);
            }
        }
    }

    return count;
}

// Main
mkdirSync(PRESETS_DIR, { recursive: true });
const count = processDirectory(REFERENCES_DIR, PRESETS_DIR);
console.log(`\n✓ Converted ${count} files`);
