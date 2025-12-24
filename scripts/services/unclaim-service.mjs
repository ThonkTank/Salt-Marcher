/**
 * Unclaim Service - Task freigeben mit Key
 *
 * Usage: node scripts/task.mjs unclaim <key>
 */

import { unclaim } from './claim-service.mjs';

export function parseArgs(argv) {
  const opts = {
    key: null,
    json: false,
    help: false
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '-h' || arg === '--help') {
      opts.help = true;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (!arg.startsWith('-') && /^[a-z0-9]{4}$/.test(arg)) {
      opts.key = arg;
    }
  }

  return opts;
}

export function execute(opts) {
  if (!opts.key) {
    return {
      ok: false,
      error: { code: 'INVALID_FORMAT', message: 'Key erforderlich (4 Zeichen a-z0-9)' }
    };
  }

  const result = unclaim(opts.key);

  if (result.ok) {
    return { ok: true, value: { unclaimed: true, taskId: result.taskId } };
  }

  return { ok: false, error: { code: result.error, message: result.message } };
}

export function showHelp() {
  return `
Unclaim Command - Task freigeben

USAGE:
  node scripts/task.mjs unclaim <key>

ARGUMENTE:
  <key>    Der 4-Zeichen-Key vom claim

BEISPIEL:
  $ node scripts/task.mjs unclaim a4x2
  ✅ Task #428 freigegeben

OPTIONEN:
  --json   JSON-Ausgabe
  -h       Diese Hilfe
`;
}
