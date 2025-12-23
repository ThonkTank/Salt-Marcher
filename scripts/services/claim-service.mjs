/**
 * Claim Service
 *
 * Koordiniert alle Claim-Operationen.
 * Nutzt ClaimsPort für Persistenz.
 * Gibt bei erfolgreichem Claim Workflow-Anweisungen aus.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { ok, err, TaskErrorCode } from '../core/result.mjs';
import { TaskStatus, CLAIM_EXPIRY_MS } from '../core/table/schema.mjs';
import { formatId } from '../core/table/parser.mjs';
import { createFsClaimsAdapter } from '../adapters/fs-claims-adapter.mjs';
import { createFsTaskAdapter } from '../adapters/fs-task-adapter.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================================
// Workflow-Guidance Helpers
// ============================================================================

/**
 * Lädt die Workflow-Konfiguration
 * @returns {object} - Workflow-Config
 */
function loadWorkflowConfig() {
  const configPath = join(__dirname, '../workflows/config.json');
  return JSON.parse(readFileSync(configPath, 'utf-8'));
}

/**
 * Extrahiert den Bereich-Key für featureRouting Lookup
 * @param {string} bereich - z.B. "Application/DetailView" oder "Features/Travel"
 * @returns {string} - z.B. "DetailView" oder "Travel"
 */
function extractBereichKey(bereich) {
  const parts = bereich.split('/');
  return parts[parts.length - 1];
}

/**
 * Lädt den Inhalt einer Workflow-Datei
 * @param {string} filePath - Relativer Pfad zur Workflow-Datei
 * @returns {string|null} - Dateiinhalt oder null bei Fehler
 */
function loadWorkflowContent(filePath) {
  try {
    // Pfad relativ zum scripts-Verzeichnis auflösen
    const fullPath = join(__dirname, '..', filePath.replace('scripts/', ''));
    return readFileSync(fullPath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Erstellt Workflow-Guidance für eine Task
 * @param {object} item - Task-Item
 * @param {object} config - Workflow-Config
 * @returns {object} - Guidance mit workflow und readingList
 */
function getGuidance(item, config) {
  // Status → Workflow
  const workflow = config.workflows[item.status];

  // Bereich → Feature-Docs
  const bereichKey = extractBereichKey(item.bereich);
  const featureRouting = config.featureRouting[bereichKey];

  // Workflow-Content laden
  let workflowContent = null;
  if (workflow?.flowchartFile) {
    workflowContent = loadWorkflowContent(workflow.flowchartFile);
  }

  return {
    workflow: workflow ? {
      title: workflow.title,
      content: workflowContent,
      accessible: workflow.accessible,
      meaning: workflow.meaning
    } : null,
    readingList: {
      baseline: config.architekturBaseline,
      featureDocs: featureRouting
        ? featureRouting.docs.map(d => `${featureRouting.path}/${d}`)
        : [],
      specDoc: item.spec
    }
  };
}

// ============================================================================
// Types
// ============================================================================

/**
 * @typedef {object} ClaimResult
 * @property {string} action - 'claimed', 'unclaimed', 'already_mine', 'removed_by_status'
 * @property {string} owner - Agent-ID des Owners
 * @property {string} [remaining] - Verbleibende Zeit (formatiert)
 */

/**
 * @typedef {object} ClaimStatus
 * @property {boolean} claimed - Ob geclaimed
 * @property {string} [owner] - Agent-ID des Owners
 * @property {boolean} [isMe] - Ob eigener Claim
 * @property {string} [timestamp] - ISO-Timestamp
 * @property {string} [remaining] - Verbleibende Zeit
 */

/**
 * Formatiert verbleibende Zeit eines Claims
 * @param {string} timestamp - ISO-Timestamp
 * @returns {string} - Formatierte Zeit
 */
export function formatTimeRemaining(timestamp) {
  const claimTime = new Date(timestamp).getTime();
  const elapsed = Date.now() - claimTime;
  const remaining = CLAIM_EXPIRY_MS - elapsed;

  if (remaining <= 0) return 'abgelaufen';

  const minutes = Math.floor(remaining / 60000);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

/**
 * Gibt die Agent-ID aus Umgebung oder CLI-Flag zurück
 *
 * @param {string} [cliAgentId] - CLI-übergebene Agent-ID
 * @returns {string|null}
 */
export function getAgentId(cliAgentId = null) {
  // Priorität: Umgebungsvariable > CLI-Flag
  if (process.env.CLAUDE_AGENT_ID) {
    return process.env.CLAUDE_AGENT_ID;
  }
  return cliAgentId ?? null;
}

/**
 * Prüft und entfernt abgelaufene Claims aus einem Claims-Objekt
 *
 * @param {Object} claims - Claims-Objekt { taskId: { owner, timestamp } } (wird mutiert)
 * @returns {Array<{taskId: string, owner: string}>} - Liste der abgelaufenen Claims
 */
export function checkClaimExpiry(claims) {
  const now = Date.now();
  const expired = [];

  for (const [taskId, claim] of Object.entries(claims)) {
    const claimTime = new Date(claim.timestamp).getTime();
    if (now - claimTime > CLAIM_EXPIRY_MS) {
      expired.push({ taskId, owner: claim.owner });
      delete claims[taskId];
    }
  }

  return expired;
}

/**
 * Erstellt einen Claim-Service
 *
 * @param {object} [options] - Optionen
 * @param {import('../ports/claims-port.mjs').ClaimsPort} [options.claimsPort] - Claims-Port
 * @param {import('../ports/task-port.mjs').TaskPort} [options.taskAdapter] - Task-Adapter
 * @returns {ClaimService}
 */
export function createClaimService(options = {}) {
  const claimsPort = options.claimsPort ?? createFsClaimsAdapter();
  const taskAdapter = options.taskAdapter ?? createFsTaskAdapter();

  // Workflow-Config lazy laden
  let workflowConfig = null;
  function getWorkflowConfig() {
    if (!workflowConfig) {
      workflowConfig = loadWorkflowConfig();
    }
    return workflowConfig;
  }

  return {
    /**
     * Claimed eine Task für einen Agenten
     *
     * @param {string|number} taskId - Task-ID
     * @param {string} agentId - Agent-ID
     * @returns {import('../core/result.mjs').Result<ClaimResult>}
     */
    claim(taskId, agentId) {
      if (!agentId) {
        return err({
          code: TaskErrorCode.AGENT_ID_REQUIRED,
          message: 'Claim erfordert Agent-ID. Setze CLAUDE_AGENT_ID oder nutze --agent-id.\n' +
                   'Beispiel: export CLAUDE_AGENT_ID="agent-$(openssl rand -hex 4)"'
        });
      }

      const taskIdStr = String(taskId);
      const claimResult = claimsPort.getClaim(taskIdStr);

      if (!claimResult.ok) {
        return claimResult;
      }

      const existingClaim = claimResult.value;

      if (existingClaim) {
        if (existingClaim.owner === agentId) {
          return ok({
            action: 'already_mine',
            owner: agentId,
            remaining: formatTimeRemaining(existingClaim.timestamp)
          });
        }

        return err({
          code: TaskErrorCode.ALREADY_CLAIMED,
          message: `Task ${formatId(taskId)} bereits geclaimed von ${existingClaim.owner} (noch ${formatTimeRemaining(existingClaim.timestamp)})`
        });
      }

      // Neuen Claim setzen
      const newClaim = {
        owner: agentId,
        timestamp: new Date().toISOString()
      };

      const setResult = claimsPort.setClaim(taskIdStr, newClaim);
      if (!setResult.ok) {
        return setResult;
      }

      // Task-Details und Guidance holen
      const loadResult = taskAdapter.load();
      if (!loadResult.ok) {
        // Claim war erfolgreich, aber Task-Details konnten nicht geladen werden
        return ok({
          action: 'claimed',
          owner: agentId
        });
      }

      const { itemMap } = loadResult.value;
      const item = itemMap.get(taskId);

      if (!item) {
        // Claim war erfolgreich, aber Task nicht gefunden
        return ok({
          action: 'claimed',
          owner: agentId
        });
      }

      // Guidance erstellen
      const config = getWorkflowConfig();
      const guidance = getGuidance(item, config);

      return ok({
        action: 'claimed',
        owner: agentId,
        task: {
          number: item.number,
          bereich: item.bereich,
          status: item.status,
          beschreibung: item.beschreibung,
          spec: item.spec
        },
        guidance
      });
    },

    /**
     * Gibt einen Claim frei
     *
     * @param {string|number} taskId - Task-ID
     * @param {string} agentId - Agent-ID
     * @returns {import('../core/result.mjs').Result<ClaimResult>}
     */
    unclaim(taskId, agentId) {
      if (!agentId) {
        return err({
          code: TaskErrorCode.AGENT_ID_REQUIRED,
          message: 'Unclaim erfordert Agent-ID. Setze CLAUDE_AGENT_ID oder nutze --agent-id.'
        });
      }

      const taskIdStr = String(taskId);
      const claimResult = claimsPort.getClaim(taskIdStr);

      if (!claimResult.ok) {
        return claimResult;
      }

      const existingClaim = claimResult.value;

      if (!existingClaim) {
        return ok({
          action: 'not_claimed',
          owner: null
        });
      }

      if (existingClaim.owner !== agentId) {
        return err({
          code: TaskErrorCode.NOT_OWNER,
          message: `Nur der Owner (${existingClaim.owner}) kann den Claim freigeben`
        });
      }

      const removeResult = claimsPort.removeClaim(taskIdStr);
      if (!removeResult.ok) {
        return removeResult;
      }

      return ok({
        action: 'unclaimed',
        owner: agentId
      });
    },

    /**
     * Prüft den Claim-Status einer Task
     *
     * @param {string|number} taskId - Task-ID
     * @param {string} [agentId] - Optionale Agent-ID für isMe-Check
     * @returns {import('../core/result.mjs').Result<ClaimStatus>}
     */
    checkClaim(taskId, agentId = null) {
      const taskIdStr = String(taskId);
      const claimResult = claimsPort.getClaim(taskIdStr);

      if (!claimResult.ok) {
        return claimResult;
      }

      const claim = claimResult.value;

      if (!claim) {
        return ok({ claimed: false });
      }

      return ok({
        claimed: true,
        owner: claim.owner,
        isMe: agentId ? claim.owner === agentId : false,
        timestamp: claim.timestamp,
        remaining: formatTimeRemaining(claim.timestamp)
      });
    },

    /**
     * Entfernt einen Claim wenn Status sich ändert (außer zu CLAIMED)
     *
     * @param {string|number} taskId - Task-ID
     * @param {string} newStatus - Neuer Status
     * @returns {import('../core/result.mjs').Result<ClaimResult|null>}
     */
    handleStatusChange(taskId, newStatus) {
      // Claim bleibt bei CLAIMED-Status bestehen
      if (newStatus === TaskStatus.CLAIMED) {
        return ok(null);
      }

      const taskIdStr = String(taskId);
      const claimResult = claimsPort.getClaim(taskIdStr);

      if (!claimResult.ok) {
        return claimResult;
      }

      const existingClaim = claimResult.value;

      if (!existingClaim) {
        return ok(null);
      }

      // Claim entfernen
      const removeResult = claimsPort.removeClaim(taskIdStr);
      if (!removeResult.ok) {
        return removeResult;
      }

      return ok({
        action: 'removed_by_status',
        owner: existingClaim.owner
      });
    },

    /**
     * Bereinigt abgelaufene Claims
     *
     * @returns {import('../core/result.mjs').Result<Array<{taskId: string, owner: string}>>}
     */
    cleanupExpired() {
      return claimsPort.cleanupExpired();
    },

    /**
     * Gibt die Agent-ID aus Umgebung oder CLI-Flag zurück
     *
     * @param {string} [cliAgentId] - CLI-übergebene Agent-ID
     * @returns {string|null}
     */
    getAgentId(cliAgentId = null) {
      // Priorität: CLI-Flag > Umgebungsvariable
      return cliAgentId ?? process.env.CLAUDE_AGENT_ID ?? null;
    }
  };
}

/**
 * Default Claim-Service Instanz
 */
export const defaultClaimService = createClaimService();

// ============================================================================
// CLI Interface
// ============================================================================

/**
 * Parst Task-ID (numerisch oder alphanumerisch wie 428b)
 */
function parseTaskId(str) {
  if (/^b\d+$/.test(str)) return str;
  const match = str.match(/^#?(\d+[a-z]?)$/);
  if (match) {
    const id = match[1];
    return /\d+[a-z]$/.test(id) ? id : parseInt(id, 10);
  }
  return null;
}

/**
 * Parst CLI-Argumente für claim command
 */
export function parseArgs(argv) {
  const opts = {
    taskId: null,
    action: 'claim', // 'claim', 'unclaim', 'check', 'whoami'
    agentId: null,
    json: false,
    quiet: false,
    help: false
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '-h' || arg === '--help') {
      opts.help = true;
    } else if (arg === '--unclaim' || arg === '-u') {
      opts.action = 'unclaim';
    } else if (arg === '--check' || arg === '-c') {
      opts.action = 'check';
    } else if (arg === '--whoami' || arg === '-w') {
      opts.action = 'whoami';
    } else if (arg === '--agent-id') {
      opts.agentId = argv[++i];
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '-q' || arg === '--quiet') {
      opts.quiet = true;
    } else if (!arg.startsWith('-')) {
      // ID parsen
      if (arg.match(/^b\d+$/)) {
        opts.taskId = arg;
      } else {
        const parsed = parseTaskId(arg);
        if (parsed !== null) opts.taskId = parsed;
      }
    }
  }

  return opts;
}

/**
 * Führt den claim command aus
 */
export function execute(opts, service = null) {
  const claimService = service ?? createClaimService();
  const agentId = claimService.getAgentId(opts.agentId);

  // Whoami: Zeigt aktuelle Agent-ID
  if (opts.action === 'whoami') {
    if (agentId) {
      return { ok: true, value: { agentId } };
    }
    return {
      ok: false,
      error: {
        code: 'NO_AGENT_ID',
        message: 'Keine Agent-ID gesetzt. Nutze: export CLAUDE_AGENT_ID="agent-$(openssl rand -hex 4)"'
      }
    };
  }

  // Alle anderen Actions brauchen eine Task-ID
  if (!opts.taskId) {
    return {
      ok: false,
      error: {
        code: 'INVALID_FORMAT',
        message: 'Task-ID erforderlich (außer bei --whoami)'
      }
    };
  }

  switch (opts.action) {
    case 'claim':
      return claimService.claim(opts.taskId, agentId);

    case 'unclaim':
      return claimService.unclaim(opts.taskId, agentId);

    case 'check':
      return claimService.checkClaim(opts.taskId, agentId);

    default:
      return {
        ok: false,
        error: {
          code: 'UNKNOWN_ACTION',
          message: `Unbekannte Aktion: ${opts.action}`
        }
      };
  }
}

/**
 * Zeigt Hilfe für claim command
 */
export function showHelp() {
  return `
Claim Command - Task claimen, freigeben oder prüfen

USAGE:
  node scripts/task.mjs claim <ID>           # Task claimen
  node scripts/task.mjs claim <ID> --unclaim # Claim freigeben
  node scripts/task.mjs claim <ID> --check   # Claim-Status prüfen
  node scripts/task.mjs claim --whoami       # Eigene Agent-ID anzeigen

ARGUMENTE:
  <ID>                   Task-ID (z.B. 428, #428, 428b) oder Bug-ID (z.B. b4)

OPTIONEN:
  -u, --unclaim          Claim freigeben
  -c, --check            Claim-Status prüfen
  -w, --whoami           Eigene Agent-ID anzeigen
  --agent-id <id>        Agent-ID überschreiben

ALLGEMEIN:
  --json                 JSON-Ausgabe
  -q, --quiet            Kompakte Ausgabe
  -h, --help             Diese Hilfe anzeigen

AGENT-ID:
  Claims erfordern eine Agent-ID. Setze sie über:
  - Umgebungsvariable: export CLAUDE_AGENT_ID="agent-$(openssl rand -hex 4)"
  - CLI-Flag: --agent-id <id>

BEISPIELE:
  node scripts/task.mjs claim 428            # Task #428 claimen
  node scripts/task.mjs claim 428 --unclaim  # Claim freigeben
  node scripts/task.mjs claim 428 --check    # Wer hat den Claim?
  node scripts/task.mjs claim --whoami       # Meine Agent-ID
`;
}
