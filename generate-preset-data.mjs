// scripts/generate-preset-data.mjs
// Generates a TypeScript module with all preset creature data

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CREATURES_PRESETS_DIR = path.join(__dirname, 'Presets', 'Creatures');
const SPELLS_PRESETS_DIR = path.join(__dirname, 'Presets', 'Spells');
const ITEMS_PRESETS_DIR = path.join(__dirname, 'Presets', 'Items');
const EQUIPMENT_PRESETS_DIR = path.join(__dirname, 'Presets', 'Equipment');
const TERRAINS_PRESETS_DIR = path.join(__dirname, 'Presets', 'Terrains');
const REGIONS_PRESETS_DIR = path.join(__dirname, 'Presets', 'Regions');
const CALENDARS_PRESETS_DIR = path.join(__dirname, 'Presets', 'Calendars');
const PLAYLISTS_PRESETS_DIR = path.join(__dirname, 'Presets', 'Playlists');
const OUTPUT_FILE = path.join(__dirname, 'Presets', 'lib', 'preset-data.ts');

/**
 * Validate that all required paths exist
 */
function validatePaths() {
    console.log('Validating paths...');

    const requiredPaths = {
        'Presets Directory': path.dirname(CREATURES_PRESETS_DIR),
        'Output Directory': path.dirname(OUTPUT_FILE)
    };

    let hasErrors = false;

    for (const [name, dirPath] of Object.entries(requiredPaths)) {
        if (!fs.existsSync(dirPath)) {
            console.error(`❌ ERROR: ${name} does not exist: ${dirPath}`);
            console.error(`   Current directory: ${process.cwd()}`);
            console.error(`   Script location: ${__dirname}`);
            hasErrors = true;
        }
    }

    if (hasErrors) {
        console.error('\n💡 Tip: Make sure you are running this script from the plugin root directory');
        console.error('   Expected: /path/to/vault/.obsidian/plugins/salt-marcher/');
        process.exit(1);
    }

    console.log('✓ All paths validated\n');
}

/**
 * Recursively get all .md files from a directory
 */
function getMarkdownFiles(dir, baseDir = dir) {
    const files = {};

    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                // Recursively search subdirectories
                Object.assign(files, getMarkdownFiles(fullPath, baseDir));
            } else if (entry.isFile() && entry.name.endsWith('.md')) {
                // Preserve the relative path so nested folders remain intact
                const relativePath = path.relative(baseDir, fullPath).split(path.sep).join('/');
                const content = fs.readFileSync(fullPath, 'utf-8');
                validateFrontmatter(relativePath, content);
                files[relativePath] = content;
            }
        }
    } catch (err) {
        console.error(`Failed to read directory ${dir}:`, err);
    }

    return files;
}

function validateFrontmatter(relativePath, content) {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return;
    let frontmatter;
    try {
        frontmatter = yaml.load(match[1]);
    } catch (err) {
        console.warn(`⚠️  Invalid frontmatter in ${relativePath}: ${(err && err.message) || err}`);
        return;
    }
    if (!frontmatter || typeof frontmatter !== 'object') return;

    if ('typeTags' in frontmatter) {
        const value = frontmatter.typeTags;
        if (Array.isArray(value)) {
            for (const tag of value) {
                if (typeof tag === 'string') continue;
                if (tag && typeof tag === 'object' && typeof tag.value === 'string') continue;
                console.warn(`⚠️  ${relativePath}: typeTags should contain strings or { value } objects.`);
                break;
            }
        } else if (value != null) {
            console.warn(`⚠️  ${relativePath}: typeTags expected as array, found ${typeof value}.`);
        }
    }

    if ('tags' in frontmatter && frontmatter.tags != null && !Array.isArray(frontmatter.tags)) {
        console.warn(`⚠️  ${relativePath}: tags should be an array.`);
    }
}

/**
 * Generate the TypeScript module
 */
function generatePresetModule() {
    validatePaths();
    console.log('Generating preset data module...');

    // Get creature files
    const creatureFiles = fs.existsSync(CREATURES_PRESETS_DIR)
        ? getMarkdownFiles(CREATURES_PRESETS_DIR)
        : {};
    const creatureCount = Object.keys(creatureFiles).length;

    // Get spell files
    const spellFiles = fs.existsSync(SPELLS_PRESETS_DIR)
        ? getMarkdownFiles(SPELLS_PRESETS_DIR)
        : {};
    const spellCount = Object.keys(spellFiles).length;

    // Get item files
    const itemFiles = fs.existsSync(ITEMS_PRESETS_DIR)
        ? getMarkdownFiles(ITEMS_PRESETS_DIR)
        : {};
    const itemCount = Object.keys(itemFiles).length;

    // Get equipment files
    const equipmentFiles = fs.existsSync(EQUIPMENT_PRESETS_DIR)
        ? getMarkdownFiles(EQUIPMENT_PRESETS_DIR)
        : {};
    const equipmentCount = Object.keys(equipmentFiles).length;

    // Get terrain files
    const terrainFiles = fs.existsSync(TERRAINS_PRESETS_DIR)
        ? getMarkdownFiles(TERRAINS_PRESETS_DIR)
        : {};
    const terrainCount = Object.keys(terrainFiles).length;

    // Get region files
    const regionFiles = fs.existsSync(REGIONS_PRESETS_DIR)
        ? getMarkdownFiles(REGIONS_PRESETS_DIR)
        : {};
    const regionCount = Object.keys(regionFiles).length;

    // Get calendar files
    const calendarFiles = fs.existsSync(CALENDARS_PRESETS_DIR)
        ? getMarkdownFiles(CALENDARS_PRESETS_DIR)
        : {};
    const calendarCount = Object.keys(calendarFiles).length;

    // Get playlist files
    const playlistFiles = fs.existsSync(PLAYLISTS_PRESETS_DIR)
        ? getMarkdownFiles(PLAYLISTS_PRESETS_DIR)
        : {};
    const playlistCount = Object.keys(playlistFiles).length;

    console.log(`Found ${creatureCount} creature presets, ${spellCount} spell presets, ${itemCount} item presets, ${equipmentCount} equipment presets, ${terrainCount} terrain presets, ${regionCount} region presets, ${calendarCount} calendar presets, and ${playlistCount} playlist presets`);

    // Generate the TypeScript module
    let moduleContent = '// Auto-generated file - DO NOT EDIT\n';
    moduleContent += '// This file contains all preset data bundled with the plugin\n\n';

    // Creatures
    moduleContent += formatPresetMap('PRESET_CREATURES', creatureFiles);
    moduleContent += formatPresetMap('PRESET_SPELLS', spellFiles);
    moduleContent += formatPresetMap('PRESET_ITEMS', itemFiles);
    moduleContent += formatPresetMap('PRESET_EQUIPMENT', equipmentFiles);
    moduleContent += formatPresetMap('PRESET_TERRAINS', terrainFiles);
    moduleContent += formatPresetMap('PRESET_REGIONS', regionFiles);
    moduleContent += formatPresetMap('PRESET_CALENDARS', calendarFiles);
    moduleContent += formatPresetMap('PRESET_PLAYLISTS', playlistFiles, true);

    // Ensure output directory exists
    const outputDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write the module
    fs.writeFileSync(OUTPUT_FILE, moduleContent);

    console.log(`Generated preset module with ${creatureCount} creatures, ${spellCount} spells, ${itemCount} items, ${equipmentCount} equipment, ${terrainCount} terrains, ${regionCount} regions, ${calendarCount} calendars, and ${playlistCount} playlists at ${OUTPUT_FILE}`);
}

// Run the generator
generatePresetModule();

function formatPresetMap(constName, files, isLast = false) {
    let content = `export const ${constName}: { [key: string]: string } = {\n`;
    const entries = Object.entries(files).sort(([a], [b]) => a.localeCompare(b));
    for (const [fileName, fileContent] of entries) {
        const escapedContent = fileContent
            .replace(/\\/g, '\\\\')
            .replace(/`/g, '\\`')
            .replace(/\$/g, '\\$');
        content += `  "${fileName}": \`${escapedContent}\`,\n`;
    }
    content += '};\n';
    if (!isLast) {
        content += '\n';
    }
    return content;
}
