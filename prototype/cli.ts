#!/usr/bin/env npx tsx
/**
 * Encounter Pipeline CLI Prototyp
 *
 * Interaktives REPL zum Testen der Encounter-Generierungs-Pipeline.
 * Jeder Pipeline-Schritt kann einzeln oder als vollstaendige Pipeline ausgefuehrt werden.
 *
 * Usage: npx tsx prototype/cli.ts
 */

import * as readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import type { PipelineState, ReplConfig } from './types/encounter.js';
import {
  loadCreatures,
  loadTerrains,
  loadTemplates,
  loadFactions,
  loadParty,
  loadAllPresets,
  createPresetLookups,
  type PresetLookups,
} from './loaders/index.js';
import { handleInitiate } from './commands/initiate.js';
import { createFormatter, type Formatter } from './output/index.js';

const state: PipelineState = {};
let lookups: PresetLookups;
let replConfig: ReplConfig = { outputMode: 'text', verbose: false };
let formatter: Formatter = createFormatter('text');

// =============================================================================
// Command Parser
// =============================================================================

interface ParsedCommand {
  command: string;
  args: string[];
  flags: Map<string, string | boolean>;
}

/**
 * Parst einen Befehl in Command, Args und Flags.
 *
 * Beispiele:
 *   "generate --terrain forest" -> { command: "generate", args: [], flags: { terrain: "forest" } }
 *   "initiate --terrain forest --time day" -> { command: "initiate", args: [], flags: { terrain: "forest", time: "day" } }
 */
function parseCommand(input: string): ParsedCommand {
  const parts = input.split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return { command: '', args: [], flags: new Map() };
  }

  const command = parts[0].toLowerCase();
  const args: string[] = [];
  const flags = new Map<string, string | boolean>();

  let i = 1;
  while (i < parts.length) {
    const part = parts[i];

    if (part.startsWith('--')) {
      const flagName = part.slice(2);
      const nextPart = parts[i + 1];

      // Check if next part is a value (not another flag)
      if (nextPart && !nextPart.startsWith('--')) {
        flags.set(flagName, nextPart);
        i += 2;
      } else {
        flags.set(flagName, true);
        i += 1;
      }
    } else {
      args.push(part);
      i += 1;
    }
  }

  return { command, args, flags };
}

// =============================================================================
// Commands
// =============================================================================

type CommandResult = 'continue' | 'exit';
type CommandHandler = (args: string[], flags: Map<string, string | boolean>) => CommandResult | Promise<CommandResult>;

const COMMANDS: Record<string, { description: string; handler: CommandHandler }> = {
  help: {
    description: 'Zeigt diese Hilfe an',
    handler: () => {
      console.log('\nVerfuegbare Befehle:\n');
      console.log('  Pipeline:');
      console.log('    generate [--terrain X] [--party Y]  Vollstaendige Pipeline ausfuehren');
      console.log('    initiate --terrain X --time Y       Step 1: Context erstellen');
      console.log('    populate [--seed Z]                 Steps 2-3: Seed + Template');
      console.log('    flavour                             Step 4: NPCs, Activity, Loot');
      console.log('    difficulty                          Step 5: Schwierigkeit berechnen');
      console.log('    adjust --target easy|moderate|hard  Step 6: An Ziel-Difficulty anpassen');
      console.log('');
      console.log('  Utility:');
      console.log('    inspect creatures|terrains|templates|factions|party  Presets anzeigen');
      console.log('    set --json|--text                     Output-Modus wechseln');
      console.log('    state                                 Aktuellen Pipeline-State anzeigen');
      console.log('    clear                                 Pipeline-State zuruecksetzen');
      console.log('    help                                  Diese Hilfe anzeigen');
      console.log('    exit                                  REPL beenden');
      console.log('');
      return 'continue';
    },
  },

  exit: {
    description: 'Beendet das REPL',
    handler: () => {
      console.log('Auf Wiedersehen!');
      return 'exit';
    },
  },

  state: {
    description: 'Zeigt den aktuellen Pipeline-State',
    handler: () => {
      console.log(formatter.formatState(state));
      return 'continue';
    },
  },

  clear: {
    description: 'Setzt den Pipeline-State zurueck',
    handler: () => {
      state.context = undefined;
      state.draft = undefined;
      state.flavoured = undefined;
      state.difficulty = undefined;
      state.balanced = undefined;
      console.log('Pipeline-State zurueckgesetzt.\n');
      return 'continue';
    },
  },

  // Placeholder commands for future tasks
  generate: {
    description: 'Vollstaendige Pipeline ausfuehren',
    handler: () => {
      console.log('[Not implemented] generate - kommt mit Task #3267\n');
      return 'continue';
    },
  },

  initiate: {
    description: 'Step 1: Context erstellen',
    handler: (args, flags) => {
      return handleInitiate(args, flags, state, lookups);
    },
  },

  populate: {
    description: 'Steps 2-3: Seed + Template',
    handler: () => {
      console.log('[Not implemented] populate - kommt mit Task #3263\n');
      return 'continue';
    },
  },

  flavour: {
    description: 'Step 4: NPCs, Activity, Loot',
    handler: () => {
      console.log('[Not implemented] flavour - kommt mit Task #3264\n');
      return 'continue';
    },
  },

  difficulty: {
    description: 'Step 5: Schwierigkeit berechnen',
    handler: () => {
      console.log('[Not implemented] difficulty - kommt mit Task #3265\n');
      return 'continue';
    },
  },

  adjust: {
    description: 'Step 6: An Ziel-Difficulty anpassen',
    handler: () => {
      console.log('[Not implemented] adjust - kommt mit Task #3266\n');
      return 'continue';
    },
  },

  inspect: {
    description: 'Presets anzeigen',
    handler: (args) => {
      const target = args[0]?.toLowerCase();

      if (!target) {
        console.log('\nUsage: inspect <creatures|terrains|templates|factions|party>\n');
        return 'continue';
      }

      try {
        switch (target) {
          case 'creatures': {
            const creatures = loadCreatures();
            console.log(`\n=== Creatures (${creatures.length}) ===\n`);
            for (const c of creatures) {
              const terrains = c.terrainAffinities.join(', ');
              console.log(`  ${c.id.padEnd(25)} CR ${String(c.cr).padStart(4)}  ${c.name.padEnd(20)} [${terrains}]`);
            }
            console.log('');
            break;
          }

          case 'terrains': {
            const terrains = loadTerrains();
            console.log(`\n=== Terrains (${terrains.length}) ===\n`);
            for (const t of terrains) {
              console.log(`  ${t.id.padEnd(12)} ${t.name.padEnd(12)} cost=${t.movementCost} enc=${t.encounterModifier} threat=${t.threatLevel}`);
            }
            console.log('');
            break;
          }

          case 'templates': {
            const templates = loadTemplates();
            console.log(`\n=== Templates (${templates.length}) ===\n`);
            for (const t of templates) {
              const slots = t.slots.map((s) => {
                const count = typeof s.count === 'number' ? s.count : `${s.count.min}-${s.count.max}`;
                return `${s.role}(${count})`;
              }).join(', ');
              console.log(`  ${t.id.padEnd(16)} ${t.name.padEnd(20)} [${slots}]`);
            }
            console.log('');
            break;
          }

          case 'factions': {
            const factions = loadFactions();
            console.log(`\n=== Factions (${factions.length}) ===\n`);
            for (const f of factions) {
              console.log(`  ${f.id.padEnd(20)} ${f.name.padEnd(20)} disposition=${f.disposition}`);
            }
            console.log('');
            break;
          }

          case 'party': {
            const party = loadParty();
            console.log(`\n=== Party (${party.size} members) ===\n`);
            console.log(`  Average Level: ${party.averageLevel}`);
            console.log(`  Total HP: ${party.totalHp}\n`);
            console.log('  Members:');
            for (const c of party.characters) {
              console.log(`    ${c.name.padEnd(20)} Lvl ${c.level} ${c.class.padEnd(10)} HP ${c.currentHp}/${c.maxHp} AC ${c.ac}`);
            }
            console.log('');
            break;
          }

          default:
            console.log(`\nUnbekanntes Ziel: "${target}"`);
            console.log('Verfuegbar: creatures, terrains, templates, factions, party\n');
        }
      } catch (error) {
        console.log(`\nFehler beim Laden: ${error instanceof Error ? error.message : String(error)}\n`);
      }

      return 'continue';
    },
  },

  set: {
    description: 'Output-Modus wechseln',
    handler: (_args, flags) => {
      const wantsJson = flags.has('json');
      const wantsText = flags.has('text');

      if (wantsJson && wantsText) {
        console.log('\nError: Nur --json ODER --text angeben, nicht beide.\n');
        return 'continue';
      }

      if (!wantsJson && !wantsText) {
        console.log(`\nAktueller Output-Modus: ${replConfig.outputMode}`);
        console.log('\nUsage: set --json | --text\n');
        return 'continue';
      }

      const newMode = wantsJson ? 'json' : 'text';
      replConfig.outputMode = newMode;
      formatter = createFormatter(newMode);
      console.log(`\nOutput-Modus gewechselt zu: ${newMode}\n`);
      return 'continue';
    },
  },
};

// =============================================================================
// Command Executor
// =============================================================================

async function executeCommand(input: string): Promise<CommandResult> {
  const { command, args, flags } = parseCommand(input);

  if (command === '') {
    return 'continue';
  }

  const cmd = COMMANDS[command];
  if (!cmd) {
    console.log(`Unbekannter Befehl: "${command}". Tippe "help" fuer verfuegbare Befehle.\n`);
    return 'continue';
  }

  return cmd.handler(args, flags);
}

// =============================================================================
// REPL Main Loop
// =============================================================================

async function main(): Promise<void> {
  // Load presets and create lookups
  console.log('Loading presets...');
  const presets = loadAllPresets();
  lookups = createPresetLookups(presets);
  console.log(`Loaded: ${presets.creatures.length} creatures, ${presets.terrains.length} terrains, ${presets.templates.length} templates, ${presets.factions.length} factions`);

  const rl = readline.createInterface({ input: stdin, output: stdout });

  console.log('');
  console.log('='.repeat(60));
  console.log('  Encounter Pipeline REPL');
  console.log('  Tippe "help" fuer verfuegbare Befehle');
  console.log('='.repeat(60));
  console.log('');

  try {
    while (true) {
      const input = await rl.question('encounter> ');
      const result = await executeCommand(input.trim());
      if (result === 'exit') {
        break;
      }
    }
  } finally {
    rl.close();
  }
}

// Run
main().catch((err) => {
  console.error('Fehler:', err);
  process.exit(1);
});
