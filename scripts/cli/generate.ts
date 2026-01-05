// CLI-Generator: Scannt src/ und generiert gebundelte cli.mjs
// Nutzung: npx tsx scripts/cli/generate.ts
// Siehe: CLAUDE.md#CLI-Testing

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import esbuild from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const SRC_DIR = path.resolve(PROJECT_ROOT, 'src');
const PRESETS_DIR = path.resolve(PROJECT_ROOT, 'presets');
const TEMP_FILE = path.resolve(__dirname, 'cli.temp.ts');
const OUTPUT = path.resolve(__dirname, 'cli.mjs');

// Path aliases aus tsconfig.json
const PATH_ALIASES: Record<string, string> = {
  '@core': path.join(SRC_DIR, 'core'),
  '@shared': path.join(SRC_DIR, 'application/shared'),
  '@': SRC_DIR,
  '@services': path.join(SRC_DIR, 'services'),
  '@constants': path.join(SRC_DIR, 'constants'),
  '@entities': path.join(SRC_DIR, 'entities'),
  '#types': path.join(SRC_DIR, 'types'),
  '#entities': path.join(SRC_DIR, 'types/entities'),
};

interface FunctionInfo {
  name: string;
  modulePath: string; // Relativer Pfad ohne .ts
}

interface ModuleInfo {
  functions: string[];
  hasSchemas: boolean;
}

/** Prüft ob ein Modul `export const functionSchemas` exportiert. */
function hasSchemaExport(filePath: string): boolean {
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.includes('export const functionSchemas');
}

// Module die Framework-Abhängigkeiten haben (svelte, obsidian)
const EXCLUDE_DIRS = ['SessionRunner', 'views', 'application'];

// Preset-Mappings: Ordner -> Entity-Typ
// Nur Presets mit default export werden unterstützt
const PRESET_MAPPINGS: Record<string, string> = {
  actions: 'action',
  creatures: 'creature',
  factions: 'faction',
  cultures: 'culture',
  species: 'species',
  terrains: 'terrain',
  'encounter-templates': 'encounter-template',
  npcs: 'npc',
  activities: 'activity',
  landmarks: 'landmark',
  maps: 'map',
  tiles: 'tile',
  weatherEvents: 'weatherEvent',
  items: 'item',
  characters: 'character',
};

/** Scannt alle exportierten Funktionen und Module mit Schema-Exports. */
function scanExports(): { functions: FunctionInfo[]; modules: Map<string, ModuleInfo> } {
  const functions: FunctionInfo[] = [];
  const modules = new Map<string, ModuleInfo>();

  function walk(dir: string) {
    if (!fs.existsSync(dir)) return;

    // Prüfen ob Verzeichnis ausgeschlossen ist
    const relDir = path.relative(SRC_DIR, dir);
    if (EXCLUDE_DIRS.some(exc => relDir === exc || relDir.startsWith(exc + path.sep))) {
      return;
    }

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
        const relativePath = path.relative(SRC_DIR, fullPath).replace('.ts', '');
        const exportedFunctions = getExportedFunctions(fullPath);
        const hasSchemas = hasSchemaExport(fullPath);

        // Track module info
        if (exportedFunctions.length > 0) {
          modules.set(relativePath, {
            functions: exportedFunctions,
            hasSchemas,
          });
        }

        for (const name of exportedFunctions) {
          functions.push({ name, modulePath: relativePath });
        }
      }
    }
  }

  walk(SRC_DIR);
  return { functions, modules };
}

function getExportedFunctions(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');

  // Leere Dateien überspringen
  if (content.trim().length === 0) return [];

  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

  const exports: string[] = [];

  ts.forEachChild(sourceFile, node => {
    // export function foo() {}
    if (ts.isFunctionDeclaration(node) && node.name && hasExportModifier(node)) {
      exports.push(node.name.text);
    }

    // export const foo = () => {}
    if (ts.isVariableStatement(node) && hasExportModifier(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.initializer) {
          if (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer)) {
            exports.push(decl.name.text);
          }
        }
      }
    }
  });

  return exports;
}

function hasExportModifier(node: ts.Node): boolean {
  return ts.canHaveModifiers(node) &&
    (ts.getModifiers(node)?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) ?? false);
}

function getAvailablePresets(): string[] {
  const presets: string[] = [];
  for (const folder of Object.keys(PRESET_MAPPINGS)) {
    const indexPath = path.join(PRESETS_DIR, folder, 'index.ts');
    if (fs.existsSync(indexPath)) {
      presets.push(folder);
    }
  }
  return presets;
}

/**
 * Konvertiert einen Modulpfad zu einem gültigen Variablennamen für Schemas.
 * z.B. "services/combatSimulator/combatantAI" -> "combatantAISchemas"
 */
function modulePathToSchemaVar(modulePath: string): string {
  const baseName = path.basename(modulePath);
  return baseName + 'Schemas';
}

function generateCLISource(
  functions: FunctionInfo[],
  modules: Map<string, ModuleInfo>
): string {
  // Gruppiere nach Modul
  const byModule = new Map<string, string[]>();
  for (const fn of functions) {
    if (!byModule.has(fn.modulePath)) byModule.set(fn.modulePath, []);
    byModule.get(fn.modulePath)!.push(fn.name);
  }

  // Function imports generieren
  const imports: string[] = [];
  const registryEntries: string[] = [];

  // Schema-Imports für Module mit functionSchemas
  const schemaImports: string[] = [];
  const schemaRegistryEntries: string[] = [];

  for (const [modulePath, names] of byModule) {
    const importPath = `../../src/${modulePath}`;
    const moduleInfo = modules.get(modulePath);
    const hasSchemas = moduleInfo?.hasSchemas ?? false;

    // Funktionen importieren
    const importItems = [...names];
    if (hasSchemas) {
      importItems.push('functionSchemas as ' + modulePathToSchemaVar(modulePath));
    }
    imports.push(`import { ${importItems.join(', ')} } from '${importPath}';`);

    const fns = names.map(n => `    ${n},`).join('\n');
    registryEntries.push(`  '${modulePath}': {\n${fns}\n  },`);

    // Schema-Registry Entry generieren
    if (hasSchemas) {
      schemaRegistryEntries.push(`  '${modulePath}': ${modulePathToSchemaVar(modulePath)},`);
    }
  }

  // Preset imports generieren
  const availablePresets = getAvailablePresets();
  const presetImports: string[] = [];
  const presetRegistrations: string[] = [];

  for (const folder of availablePresets) {
    const entityType = PRESET_MAPPINGS[folder];
    const varName = folder.replace(/-/g, '') + 'Presets';
    presetImports.push(`import { default as ${varName} } from '../../presets/${folder}/index';`);
    presetRegistrations.push(`  vaultAdapter.register('${entityType}', ${varName});`);
  }

  return `// AUTO-GENERATED by generate.ts - DO NOT EDIT
import { parseArgs } from 'node:util';

// Infrastructure imports
import { PresetVaultAdapter } from '../../src/infrastructure/vault/PresetVaultAdapter';
import { setVault, vault } from '../../src/infrastructure/vault/vaultInstance';
import { resetState } from '../../src/infrastructure/state/sessionState';

// Preset imports
${presetImports.join('\n')}

// Function imports (inkl. functionSchemas für Module mit Validierung)
${imports.join('\n')}

// ============================================================================
// SCHEMA REGISTRY (dynamisch generiert)
// ============================================================================

/**
 * Schema-Registry: Mappt Modulpfade zu deren functionSchemas.
 * Wird automatisch für Module generiert, die \`export const functionSchemas\` haben.
 */
const schemaRegistry: Record<string, Record<string, unknown[]>> = {
${schemaRegistryEntries.join('\n')}
};

// ============================================================================
// HELPERS
// ============================================================================

function coordToKey(coord: { q: number; r: number }): string {
  return \`\${coord.q},\${coord.r}\`;
}

/**
 * Gibt den erhaltenen Wert an einem Pfad zurück.
 */
function getNestedValue(obj: unknown, pathArray: (string | number)[]): unknown {
  let current = obj;
  for (const key of pathArray) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/**
 * Formatiert Zod-Validierungsfehler mit hilfreichen Meldungen.
 * Zeigt: Parameter, Feld, Fehler, erhaltenen Wert.
 */
function formatZodError(
  error: { issues: Array<{ path: (string | number)[]; message: string; code: string }> },
  input: unknown,
  paramIndex: number
): string {
  const lines: string[] = [\`❌ Validierungsfehler in Parameter \${paramIndex + 1}:\`];

  for (const issue of error.issues) {
    const path = issue.path.join('.');
    lines.push(\`\\n  Feld: \${path || '(root)'}\`);
    lines.push(\`  Fehler: \${issue.message}\`);
    lines.push(\`  Code: \${issue.code}\`);

    // Zeige erhaltenen Wert (gekürzt)
    const received = path ? getNestedValue(input, issue.path) : input;
    const truncated = JSON.stringify(received)?.slice(0, 100) ?? 'undefined';
    lines.push(\`  Erhalten: \${truncated}\${truncated.length >= 100 ? '...' : ''}\`);

    // Kontextspezifische Hilfe für bekannte Felder
    if (path === 'alliances') {
      lines.push('  Erwartetes Format: Record<string, string[]>');
      lines.push('  Beispiel: {"party": ["party"], "enemies": ["enemies"]}');
    }
    if (path.includes('hp')) {
      lines.push('  Erwartetes Format: Object mit numerischen Keys');
      lines.push('  Beispiel: {"7": 1} oder {"45": 1}');
    }
    if (path.includes('position')) {
      lines.push('  Erwartetes Format: {x: number, y: number, z: number}');
      lines.push('  Beispiel: {"x": 0, "y": 5, "z": 0}');
    }
    if (path.includes('speed')) {
      lines.push('  Erwartetes Format: {walk: number, fly?: number, ...}');
      lines.push('  Beispiel: {"walk": 30}');
    }
  }

  return lines.join('\\n');
}

/**
 * Validiert Input dynamisch gegen Schema-Registry.
 * Gibt null zurück wenn kein Schema definiert oder Validierung erfolgreich.
 * Gibt Fehler-String zurück wenn Validierung fehlschlägt.
 */
function validateInput(
  modulePath: string,
  functionName: string,
  args: unknown[]
): string | null {
  const moduleSchemas = schemaRegistry[modulePath];
  if (!moduleSchemas) return null;  // Modul hat keine Schemas

  const fnSchemas = moduleSchemas[functionName] as { safeParse: (input: unknown) => { success: boolean; error?: { issues: Array<{ path: (string | number)[]; message: string; code: string }> } } }[] | undefined;
  if (!fnSchemas) return null;  // Funktion hat kein Schema

  // Validiere jeden Parameter
  for (let i = 0; i < fnSchemas.length; i++) {
    const schema = fnSchemas[i];
    const arg = args[i];

    if (!schema || typeof schema.safeParse !== 'function') {
      continue;  // Schema ist kein Zod-Schema (z.B. z.any())
    }

    const result = schema.safeParse(arg);
    if (!result.success && result.error) {
      return formatZodError(result.error, arg, i);
    }
  }

  return null;  // Alle Parameter valide
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function initializeVault(): void {
  const vaultAdapter = new PresetVaultAdapter();
${presetRegistrations.join('\n')}
  setVault(vaultAdapter);

  // Transform tiles to have id from coordinates (for vault lookup by coordToKey)
  if (typeof tilesPresets !== 'undefined') {
    const tilesWithId = tilesPresets.map((tile: { coordinate: { q: number; r: number } }) => ({
      ...tile,
      id: coordToKey(tile.coordinate),
    }));
    vaultAdapter.register('tile', tilesWithId);
  }
}

function initializeState(): void {
  resetState({
    activeMapId: 'test-map' as any,
    party: {
      position: { q: 0, r: 0 },
      mapId: 'test-map' as any,
      members: ['test-fighter', 'test-wizard'] as any[],
      transport: 'foot',
    },
    time: {
      year: 1,
      month: 6,
      day: 15,
      hour: 10,
      minute: 0,
      segment: 'midday',
    },
    weather: { type: 'clear', severity: 0 } as any,
    travel: { status: 'idle', route: null, progress: null },
    encounter: { status: 'idle', current: null, generatedNPCs: [] },
    combat: { status: 'idle', participants: [], currentTurn: 0, round: 1 },
  });
}

// ============================================================================
// REGISTRY
// ============================================================================

const registry: Record<string, Record<string, Function>> = {
${registryEntries.join('\n')}
};

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      list: { type: 'boolean', short: 'l' },
      help: { type: 'boolean', short: 'h' },
      debug: { type: 'boolean', short: 'd' },
    },
  });

  // Debug-Modus aktivieren
  if (values.debug) {
    process.env.DEBUG_SERVICES = 'true';
  }

  // Initialize infrastructure
  initializeVault();
  initializeState();

  if (values.list && positionals.length === 0) {
    console.log('Verfügbare Module:');
    Object.keys(registry).forEach(m => console.log('  ' + m));
    return;
  }

  const [modulePath, functionName, argsJson] = positionals;

  if (values.help || !modulePath) {
    console.log(\`
Service-Test-CLI

Nutzung:
  npm run cli -- <modul> <funktion> '<json-args>'
  npm run cli -- --list
  npm run cli -- <modul> --list

Optionen:
  -l, --list    Module oder Funktionen auflisten
  -d, --debug   Debug-Modus aktivieren (DEBUG_SERVICES=true)
  -h, --help    Diese Hilfe anzeigen

Beispiele:
  npm run cli -- services/encounterGenerator/groupSeed selectSeed '{\"terrain\":{\"id\":\"forest\"},\"crBudget\":15,\"timeSegment\":\"midday\",\"factions\":[]}'

  # Multi-Arg Funktionen (Array = spread):
  npm run cli -- services/encounterGenerator/groupPopulation populate '[{\"creatureId\":\"goblin\",\"factionId\":\"bergstamm\"},{\"terrain\":{\"id\":\"forest\"},\"timeSegment\":\"midday\",\"eligibleCreatures\":[]},\"threat\"]'

  # Mit Debug-Output:
  npm run cli -- services/encounterGenerator/groupSeed selectSeed '{...}' --debug
\`);
    return;
  }

  const mod = registry[modulePath];
  if (!mod) {
    console.error('Modul nicht gefunden:', modulePath);
    console.log('Verfügbare Module:', Object.keys(registry).join(', '));
    process.exit(1);
  }

  if (values.list) {
    console.log('Funktionen in', modulePath + ':');
    Object.keys(mod).forEach(f => console.log('  ' + f));
    return;
  }

  if (!functionName) {
    console.error('Funktionsname erforderlich.');
    console.log('Verfügbare Funktionen:', Object.keys(mod).join(', '));
    process.exit(1);
  }

  const fn = mod[functionName];
  if (typeof fn !== 'function') {
    console.error(functionName + ' ist keine Funktion.');
    process.exit(1);
  }

  // Convert object with numeric keys to Map (for PMF functions)
  function objectToMap(obj: unknown): unknown {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(objectToMap);

    const o = obj as Record<string, unknown>;
    const keys = Object.keys(o);

    // If all keys are numeric, convert to Map
    if (keys.length > 0 && keys.every(k => !isNaN(Number(k)))) {
      const map = new Map<number, number>();
      for (const [k, v] of Object.entries(o)) {
        map.set(Number(k), v as number);
      }
      return map;
    }

    // Otherwise recursively process
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
      result[k] = objectToMap(v);
    }
    return result;
  }

  // Parse args and handle multi-arg (array = spread)
  let result: unknown;
  if (argsJson) {
    const rawParsed = JSON.parse(argsJson);

    // Validiere Input VOR Map-Konvertierung (Schemas erwarten Object-Format)
    const rawArgsArray = Array.isArray(rawParsed) ? rawParsed : [rawParsed];
    const validationError = validateInput(modulePath, functionName, rawArgsArray);
    if (validationError) {
      console.error(validationError);
      process.exit(1);
    }

    // Konvertiere Objects mit numerischen Keys zu Maps (für PMF-Funktionen)
    const parsed = objectToMap(rawParsed);

    if (Array.isArray(parsed)) {
      // Multi-arg: spread array as arguments
      result = await fn(...parsed);
    } else {
      // Single arg
      result = await fn(parsed);
    }
  } else {
    result = await fn();
  }

  // Custom replacer to handle Maps
  const replacer = (_key: string, value: unknown) => {
    if (value instanceof Map) {
      return Object.fromEntries(value);
    }
    return value;
  };
  console.log(JSON.stringify(result, replacer, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
`;
}

// esbuild Plugin für Path Aliases (markiert fehlende als external)
function aliasPlugin(): esbuild.Plugin {
  const missingAliases: string[] = [];

  return {
    name: 'alias',
    setup(build) {
      // Resolve path aliases
      build.onResolve({ filter: /^[@#]/ }, args => {
        for (const [alias, target] of Object.entries(PATH_ALIASES)) {
          if (args.path === alias || args.path.startsWith(alias + '/')) {
            const resolved = args.path.replace(alias, target);
            const tsPath = resolved + '.ts';
            const indexPath = path.join(resolved, 'index.ts');

            // Prüfen ob Datei existiert
            if (fs.existsSync(tsPath)) {
              return { path: tsPath };
            }
            if (fs.existsSync(indexPath)) {
              return { path: indexPath };
            }

            missingAliases.push(args.path);
            return { path: args.path, external: true };
          }
        }
        return null;
      });

      build.onEnd(() => {
        if (missingAliases.length > 0) {
          console.warn('\n  Fehlende Alias-Module (als external markiert):');
          [...new Set(missingAliases)].forEach(m => console.warn(`   - ${m}`));
        }
      });
    },
  };
}

// esbuild Plugin um fehlende Module zu erkennen
function missingModulesPlugin(): esbuild.Plugin {
  const missing: string[] = [];

  return {
    name: 'missing-modules',
    setup(build) {
      build.onResolve({ filter: /.*/ }, args => {
        // Relative imports prüfen
        if (args.path.startsWith('./') || args.path.startsWith('../')) {
          const dir = path.dirname(args.importer);
          const resolved = path.resolve(dir, args.path);
          const tsPath = resolved + '.ts';
          const indexPath = path.join(resolved, 'index.ts');

          if (!fs.existsSync(tsPath) && !fs.existsSync(indexPath) && !fs.existsSync(resolved)) {
            missing.push(args.path);
            return { path: args.path, external: true };
          }
        }
        return null;
      });

      build.onEnd(() => {
        if (missing.length > 0) {
          console.warn('\n  Fehlende Module (als external markiert):');
          [...new Set(missing)].forEach(m => console.warn(`   - ${m}`));
          console.warn('');
        }
      });
    },
  };
}

async function bundleCLI() {
  await esbuild.build({
    entryPoints: [TEMP_FILE],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node18',
    outfile: OUTPUT,
    plugins: [aliasPlugin(), missingModulesPlugin()],
    external: ['svelte', 'svelte/*', 'obsidian'],
    logLevel: 'warning',
    banner: {
      js: '#!/usr/bin/env node',
    },
  });
}

// ============================================================================
// MAIN
// ============================================================================

console.log('Scanning src/ for exported functions...');
const { functions, modules } = scanExports();

if (functions.length === 0) {
  console.log('Keine exportierten Funktionen gefunden.');
  process.exit(0);
}

// Zähle Module mit Schema-Exports
const modulesWithSchemas = [...modules.values()].filter(m => m.hasSchemas).length;
console.log(`Found ${functions.length} functions in ${modules.size} modules (${modulesWithSchemas} with validation schemas).`);

const cliSource = generateCLISource(functions, modules);

// Temporäre Datei schreiben
fs.writeFileSync(TEMP_FILE, cliSource);

try {
  // Mit esbuild bundeln
  await bundleCLI();
  console.log(`Generated cli.mjs`);
} catch (e) {
  console.error('Build failed:', e);
  process.exit(1);
} finally {
  // Temporäre Datei löschen
  if (fs.existsSync(TEMP_FILE)) {
    fs.unlinkSync(TEMP_FILE);
  }
}
