// scripts/generate-preset-data.mjs
// Generates a TypeScript module with all preset creature data

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CREATURES_PRESETS_DIR = path.join(__dirname, '..', 'Presets', 'Creatures');
const SPELLS_PRESETS_DIR = path.join(__dirname, '..', 'Presets', 'Spells');
const ITEMS_PRESETS_DIR = path.join(__dirname, '..', 'Presets', 'Items');
const EQUIPMENT_PRESETS_DIR = path.join(__dirname, '..', 'Presets', 'Equipment');
const OUTPUT_FILE = path.join(__dirname, '..', 'src', 'apps', 'library', 'core', 'preset-data.ts');

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
                files[relativePath] = content;
            }
        }
    } catch (err) {
        console.error(`Failed to read directory ${dir}:`, err);
    }

    return files;
}

/**
 * Generate the TypeScript module
 */
function generatePresetModule() {
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

    console.log(`Found ${creatureCount} creature presets, ${spellCount} spell presets, ${itemCount} item presets, and ${equipmentCount} equipment presets`);

    // Generate the TypeScript module
    let moduleContent = '// Auto-generated file - DO NOT EDIT\n';
    moduleContent += '// This file contains all preset data bundled with the plugin\n\n';

    // Creatures
    moduleContent += formatPresetMap('PRESET_CREATURES', creatureFiles);
    moduleContent += formatPresetMap('PRESET_SPELLS', spellFiles);
    moduleContent += formatPresetMap('PRESET_ITEMS', itemFiles);
    moduleContent += formatPresetMap('PRESET_EQUIPMENT', equipmentFiles, true);

    // Ensure output directory exists
    const outputDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write the module
    fs.writeFileSync(OUTPUT_FILE, moduleContent);

    console.log(`Generated preset module with ${creatureCount} creatures, ${spellCount} spells, ${itemCount} items, and ${equipmentCount} equipment at ${OUTPUT_FILE}`);
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
