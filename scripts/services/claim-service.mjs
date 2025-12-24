/**
 * Claim Service - Vereinfachtes Key-basiertes System
 *
 * claim <ID>           → Generiert 4-Zeichen-Key, gibt ihn zurück
 * unclaim <key>        → Gibt Task frei (Key identifiziert die Task)
 * checkKey(id, key)    → Prüft ob Zugriff erlaubt
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { formatId } from '../core/table/parser.mjs';
import { createFsTaskAdapter } from '../adapters/fs-task-adapter.mjs';
import { createLookupService } from './show-service.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLAIMS_PATH = join(__dirname, '..', '..', 'docs', 'architecture', '.task-claims.json');
const EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 Stunden

// ============================================================================
// Persistence
// ============================================================================

function load() {
  if (!existsSync(CLAIMS_PATH)) return { claims: {}, keys: {} };
  try {
    const data = JSON.parse(readFileSync(CLAIMS_PATH, 'utf-8'));
    return { claims: data.claims || {}, keys: data.keys || {} };
  } catch {
    return { claims: {}, keys: {} };
  }
}

function save(data) {
  writeFileSync(CLAIMS_PATH, JSON.stringify(data, null, 2));
}

// ============================================================================
// Helpers
// ============================================================================

function generateKey() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 4 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

function isExpired(timestamp) {
  return Date.now() - timestamp > EXPIRY_MS;
}

function formatRemaining(timestamp) {
  const remaining = EXPIRY_MS - (Date.now() - timestamp);
  if (remaining <= 0) return 'abgelaufen';
  const mins = Math.floor(remaining / 60000);
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Claimed eine Task und gibt den Key zurück.
 * Setzt den Task-Status auf 🔒 und speichert den vorherigen Status.
 */
export function claim(taskId) {
  const data = load();
  const taskIdStr = String(taskId);
  const existing = data.claims[taskIdStr];

  // Bereits geclaimed (und nicht abgelaufen)?
  if (existing && !isExpired(existing.timestamp)) {
    return {
      ok: false,
      error: 'ALREADY_CLAIMED',
      message: `Task ${formatId(taskId)} bereits geclaimed (noch ${formatRemaining(existing.timestamp)})`
    };
  }

  // Aktuellen Status aus Roadmap lesen
  const taskAdapter = createFsTaskAdapter();
  const loadResult = taskAdapter.load();
  if (!loadResult.ok) {
    return { ok: false, error: 'LOAD_FAILED', message: loadResult.error.message };
  }

  const item = loadResult.value.itemMap.get(taskId);
  if (!item) {
    return { ok: false, error: 'TASK_NOT_FOUND', message: `Task ${formatId(taskId)} nicht gefunden` };
  }

  const previousStatus = item.status;

  // Alten abgelaufenen Claim aufräumen
  if (existing) {
    delete data.keys[existing.key];
  }

  // Neuen Claim erstellen (mit previousStatus)
  const key = generateKey();
  data.claims[taskIdStr] = { key, timestamp: Date.now(), previousStatus };
  data.keys[key] = taskIdStr;
  save(data);

  // Status in Roadmap auf 🔒 setzen
  const statusResult = taskAdapter.updateTask(taskId, { status: '🔒' });
  if (!statusResult.ok) {
    // Claim zurückrollen bei Fehler
    delete data.keys[key];
    delete data.claims[taskIdStr];
    save(data);
    return {
      ok: false,
      error: 'STATUS_UPDATE_FAILED',
      message: `Status-Update fehlgeschlagen: ${statusResult.error.message}`
    };
  }

  return { ok: true, key, taskId: taskIdStr, previousStatus };
}

/**
 * Gibt eine Task frei (nur Key, keine ID nötig).
 * Stellt den vorherigen Status wieder her.
 */
export function unclaim(key) {
  const data = load();
  const taskIdStr = data.keys[key];

  if (!taskIdStr) {
    return { ok: false, error: 'INVALID_KEY', message: 'Ungültiger Key' };
  }

  // TaskId korrekt parsen (Integer oder Bug-ID)
  const taskId = parseTaskId(taskIdStr);

  // Vorherigen Status wiederherstellen
  const claim = data.claims[taskIdStr];
  const previousStatus = claim?.previousStatus || '⬜';  // Fallback auf ⬜

  const taskAdapter = createFsTaskAdapter();
  taskAdapter.updateTask(taskId, { status: previousStatus });
  // Bei Status-Fehler trotzdem Claim entfernen

  delete data.claims[taskIdStr];
  delete data.keys[key];
  save(data);

  return { ok: true, taskId, restoredStatus: previousStatus };
}

/**
 * Prüft ob Zugriff auf eine Task erlaubt ist
 * - Nicht geclaimed → erlaubt
 * - Abgelaufen → erlaubt
 * - Key stimmt → erlaubt
 */
export function checkKey(taskId, key) {
  const data = load();
  const claim = data.claims[String(taskId)];

  if (!claim) return true;
  if (isExpired(claim.timestamp)) return true;
  return claim.key === key;
}

/**
 * Gibt Claim-Info für eine Task zurück
 */
export function getClaimInfo(taskId) {
  const data = load();
  const claim = data.claims[String(taskId)];

  if (!claim) return { claimed: false };
  if (isExpired(claim.timestamp)) return { claimed: false, expired: true };

  return {
    claimed: true,
    remaining: formatRemaining(claim.timestamp)
  };
}

/**
 * Entfernt Claim wenn Status sich ändert (außer zu 🔒)
 */
export function handleStatusChange(taskId, newStatus) {
  if (newStatus === '🔒') return null;

  const data = load();
  const taskIdStr = String(taskId);
  const claim = data.claims[taskIdStr];

  if (!claim) return null;

  delete data.keys[claim.key];
  delete data.claims[taskIdStr];
  save(data);

  return { removed: true, taskId: taskIdStr };
}

// ============================================================================
// Service Factory (für Dependency Injection in anderen Services)
// ============================================================================

/**
 * Erstellt einen ClaimService mit checkClaim-Methode
 * Wird von show-service und sort-service verwendet
 */
export function createClaimService() {
  return {
    checkClaim(taskId, _agentId) {
      const info = getClaimInfo(taskId);
      return { ok: true, value: info };
    }
  };
}

// ============================================================================
// Workflow Guidance (beibehalten für claim-Output)
// ============================================================================

function loadWorkflowConfig() {
  const configPath = join(__dirname, '../workflows/config.json');
  return JSON.parse(readFileSync(configPath, 'utf-8'));
}

function extractDomainKey(domain) {
  if (!domain || domain === '-') return null;
  const parts = domain.split('/');
  return parts[parts.length - 1];
}

function loadWorkflowContent(filePath) {
  try {
    const fullPath = join(__dirname, '..', filePath.replace('scripts/', ''));
    return readFileSync(fullPath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Gibt Workflow-Guidance für eine Task zurück
 * @param {string|number} taskId - Task-ID
 * @param {string|null} overrideStatus - Optional: Status überschreiben (für Claim)
 */
export function getGuidance(taskId, overrideStatus = null) {
  const taskAdapter = createFsTaskAdapter();
  const loadResult = taskAdapter.load();
  if (!loadResult.ok) return null;

  const { itemMap } = loadResult.value;
  const item = itemMap.get(taskId);
  if (!item) return null;

  const config = loadWorkflowConfig();
  const statusForWorkflow = overrideStatus || item.status;
  const workflow = config.workflows[statusForWorkflow];
  const domainKey = extractDomainKey(item.domain);
  const featureRouting = domainKey ? config.featureRouting[domainKey] : null;
  const layerKey = (item.layer || '-').toLowerCase().trim();
  const layerDocs = config.layerDocs?.[layerKey] || [];

  let workflowContent = null;
  if (workflow?.flowchartFile) {
    workflowContent = loadWorkflowContent(workflow.flowchartFile);
  }

  // Dependency Trees laden
  const lookupService = createLookupService({ taskAdapter });
  const depTreeResult = lookupService.getDependencyTree(taskId, 2);
  const dependentTreeResult = lookupService.getDependentTree(taskId, 2);

  return {
    task: {
      number: item.number,
      domain: item.domain,
      status: overrideStatus || item.status,
      beschreibung: item.beschreibung,
      spec: item.spec,
      prio: item.prio,
      mvp: item.mvp,
      imp: item.imp,
      deps: item.deps,
      isBug: item.isBug
    },
    workflow: workflow ? {
      title: workflow.title,
      content: workflowContent,
      accessible: workflow.accessible,
      meaning: workflow.meaning
    } : null,
    readingList: {
      baseline: [...(config.architekturBaseline || []), ...layerDocs],
      layer: layerKey !== '-' ? layerKey : null,
      featureDocs: featureRouting
        ? featureRouting.docs.map(d => `${featureRouting.path}/${d}`)
        : [],
      specDoc: item.spec
    },
    dependencyTree: depTreeResult.ok ? depTreeResult.value : null,
    dependentTree: dependentTreeResult.ok ? dependentTreeResult.value : null
  };
}

// ============================================================================
// CLI Interface
// ============================================================================

function parseTaskId(str) {
  if (/^b\d+$/.test(str)) return str;
  const match = str.match(/^#?(\d+[a-z]?)$/);
  if (match) {
    const id = match[1];
    return /\d+[a-z]$/.test(id) ? id : parseInt(id, 10);
  }
  return null;
}

export function parseArgs(argv) {
  const opts = {
    taskId: null,
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
    } else if (!arg.startsWith('-')) {
      // Task-ID oder Key
      const parsed = parseTaskId(arg);
      if (parsed !== null) {
        opts.taskId = parsed;
      }
    }
  }

  return opts;
}

export function execute(opts) {
  if (!opts.taskId) {
    return {
      ok: false,
      error: { code: 'INVALID_FORMAT', message: 'Task-ID erforderlich' }
    };
  }

  const result = claim(opts.taskId);

  if (result.ok) {
    const guidance = getGuidance(opts.taskId, result.previousStatus);
    return { ok: true, value: { ...result, guidance } };
  }

  return { ok: false, error: { code: result.error, message: result.message } };
}

export function showHelp() {
  return `
Claim Command - Task claimen

USAGE:
  node scripts/task.mjs claim <ID>     # Task claimen, Key merken!
  node scripts/task.mjs unclaim <key>  # Task freigeben

BEISPIEL:
  $ node scripts/task.mjs claim 428
  Claimed. Key: a4x2 (2h gültig)

  $ node scripts/task.mjs unclaim a4x2
  Task #428 freigegeben

  $ node scripts/task.mjs edit 428 --status ✅ --key a4x2

OPTIONEN:
  --json    JSON-Ausgabe
  -h        Diese Hilfe
`;
}
