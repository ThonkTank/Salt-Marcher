#!/usr/bin/env node
/**
 * Unified Task CLI Tool
 *
 * Entry point für alle Task-Operationen.
 * Delegiert an spezialisierte Services.
 *
 * Usage:
 *   node scripts/task.mjs <command> [args...]
 *
 * Commands:
 *   show    - Task-Details mit Dep-Trees anzeigen
 *   sort    - Priorisierte Task-Liste (mit Keyword-Filter)
 *   edit    - Task/Bug bearbeiten (Status, Deps, Beschreibung)
 *   add     - Neue Task oder Bug erstellen
 *   claim   - Task claimen/freigeben/prüfen
 *   remove  - Task oder Bug löschen
 *   split   - Task in zwei Teile splitten
 */

// Command → Service Mapping (lazy-loaded)
const COMMANDS = {
  show: () => import('./services/lookup-service.mjs'),
  sort: () => import('./services/sort-service.mjs'),
  edit: () => import('./services/edit-service.mjs'),
  add: () => import('./services/add-service.mjs'),
  claim: () => import('./services/claim-service.mjs'),
  remove: () => import('./services/remove-service.mjs'),
  split: () => import('./services/split-service.mjs'),
  sync: () => import('./services/sync-service.mjs'),
  clear: () => import('./services/clear-service.mjs'),
  'check-doc': () => import('./services/doc-watcher-service.mjs'),
  'scan-refs': () => import('./services/ref-updater-service.mjs'),
};

const COMMAND_DESCRIPTIONS = {
  show: 'Task-Details mit Dependency-Trees anzeigen',
  sort: 'Priorisierte Task-Liste (mit Keyword-Filter)',
  edit: 'Task/Bug bearbeiten (1 oder mehrere)',
  add: 'Neue Task(s) oder Bug(s) erstellen',
  claim: 'Task claimen (ID) oder freigeben (Key)',
  remove: 'Task oder Bug löschen',
  split: 'Task in zwei Teile splitten',
  sync: 'Roadmap → Docs synchronisieren (Diskrepanzen beheben)',
  clear: 'Alle Tasks/Bugs aus einem Dokument löschen',
  'check-doc': 'Doc-Änderungen prüfen, Tasks auf 🔶 setzen',
  'scan-refs': 'Kaputte Markdown-Referenzen finden und fixen',
};

/**
 * Wrapped Text mit Einrückung
 * @param {string} text - Der zu wrappende Text
 * @param {number} width - Maximale Zeilenbreite
 * @param {string} indent - Einrückung für alle Zeilen
 */
function wrapText(text, width, indent = '   ') {
  const maxLen = width - indent.length;
  if (text.length <= maxLen) return indent + text;

  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= maxLen) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines.map(line => indent + line).join('\n');
}

/**
 * Tree-Ausgabe Funktion für Dependency/Dependent Trees
 * @param {object} node - Tree-Node mit number, status, beschreibung, children
 * @param {string} prefix - Einrückung
 * @param {boolean} isLast - Letztes Kind im Parent?
 * @param {boolean} isRoot - Root-Node (wird nicht gedruckt)?
 * @param {number} maxDescLen - Max Länge der Beschreibung
 */
function printTree(node, prefix = '', isLast = true, isRoot = false, maxDescLen = 50) {
  if (!node) return;

  const nodeId = node.isBug ? node.number : `#${node.number}`;
  const desc = (node.beschreibung || '').slice(0, maxDescLen);
  const truncated = (node.beschreibung || '').length > maxDescLen ? '…' : '';
  const missing = node.missing ? ' [FEHLT]' : '';

  if (isRoot) {
    // Root nicht nochmal ausgeben (ist schon oben)
  } else {
    const connector = isLast ? '└─' : '├─';
    console.log(`${prefix}${connector} ${node.status} ${nodeId} ${desc}${truncated}${missing}`);
  }

  const children = node.children || [];
  const childPrefix = prefix + (isRoot ? '' : (isLast ? '   ' : '│  '));
  children.forEach((child, i) => {
    printTree(child, childPrefix, i === children.length - 1, false, maxDescLen);
  });
}

/**
 * Zeigt globale Hilfe
 */
function showGlobalHelp() {
  console.log(`
Task CLI Tool - Unified Task Management

USAGE:
  node scripts/task.mjs <command> [args...]

COMMANDS:
${Object.entries(COMMAND_DESCRIPTIONS)
    .map(([cmd, desc]) => `  ${cmd.padEnd(10)} ${desc}`)
    .join('\n')}

OPTIONS:
  -h, --help     Hilfe anzeigen (global oder für Command)

HILFE FÜR COMMAND:
  node scripts/task.mjs <command> --help

BEISPIELE:
  node scripts/task.mjs show 428                   # Task-Details + Trees
  node scripts/task.mjs sort Travel                # Tasks mit "Travel"
  node scripts/task.mjs sort --mvp                 # MVP-Tasks priorisiert
  node scripts/task.mjs edit 428 --status ✅       # Task abschließen
  node scripts/task.mjs edit 100 101 --status ✅   # Mehrere Tasks bearbeiten
  node scripts/task.mjs claim 428                  # Task claimen
  node scripts/task.mjs add --tasks '[{...}]'      # Neue Task(s) erstellen
  node scripts/task.mjs remove b4                  # Bug löschen
  node scripts/task.mjs split 428 "A" "B"          # Task splitten
`);
}

/**
 * Baut einen Filter-Header für die sort-Ausgabe
 * @param {object} opts - Parse-Optionen mit Filtern
 * @returns {string|null} - Header-Text oder null wenn keine Filter
 */
function buildFilterHeader(opts) {
  const parts = [];
  if (opts.layer) parts.push(`--layer ${opts.layer}`);
  if (opts.domain) parts.push(`--domain ${opts.domain}`);
  if (opts.status) parts.push(`--status ${opts.status}`);
  if (opts.mvp === true) parts.push('--mvp');
  if (opts.mvp === false) parts.push('--no-mvp');
  if (opts.prio) parts.push(`--prio ${opts.prio}`);
  if (opts.keywords?.length > 0) parts.push(opts.keywords.join(' '));
  return parts.length > 0 ? `📋 Filter: ${parts.join(' ')}` : null;
}

/**
 * Formatiert Ausgabe (JSON oder Text)
 */
function formatOutput(result, opts) {
  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!result.ok) {
    console.error(`❌ ${result.error.message}`);

    // Bei ALREADY_CLAIMED: Klare Abort-Nachricht
    if (result.error.code === 'ALREADY_CLAIMED') {
      console.error();
      console.error('   ⛔ ABBRUCH: Diese Task ist für dich nicht zugänglich.');
      console.error('   → Wähle eine andere: node scripts/task.mjs sort');
    }
    return;
  }

  // Erfolgreiche Ausgabe
  const value = result.value;

  // Claim-Ergebnis (neues Key-System)
  if (value.key !== undefined) {
    // claim result
    console.log(`✅ Task #${value.taskId} geclaimed`);
    console.log(`   Key: ${value.key} (2h gültig)`);
    console.log(`   Merke dir den Key für unclaim und edit!`);

    // Bei erfolgreichem Claim: Task-Info und Workflow-Guidance anzeigen
    if (value.guidance?.task) {
      const task = value.guidance.task;
      const guidance = value.guidance;

      // Task-Info (wie bei show)
      const id = task.isBug ? task.number : `#${task.number}`;
      const mvpLabel = task.mvp === 'Ja' ? 'MVP' : '';
      console.log();
      console.log(`${task.status} ${id} ${task.domain} | ${task.prio} | ${mvpLabel}`);
      if (guidance.readingList?.layer) {
        console.log(`   Layer: ${guidance.readingList.layer}`);
      }
      console.log(`   ${task.beschreibung}`);
      if (task.spec && task.spec !== '-') console.log(`   Spec: ${task.spec}`);
      if (task.imp && task.imp !== '-') console.log(`   Imp: ${task.imp}`);

      // Dependency-Tree (Voraussetzungen)
      if (guidance.dependencyTree?.children?.length > 0) {
        console.log('\n   Voraussetzungen:');
        for (let i = 0; i < guidance.dependencyTree.children.length; i++) {
          const child = guidance.dependencyTree.children[i];
          const isLast = i === guidance.dependencyTree.children.length - 1;
          printTree(child, '   ', isLast, false);
        }
      }

      // Dependent-Tree (Blockiert)
      if (guidance.dependentTree?.children?.length > 0) {
        console.log('\n   Blockiert:');
        for (let i = 0; i < guidance.dependentTree.children.length; i++) {
          const child = guidance.dependentTree.children[i];
          const isLast = i === guidance.dependentTree.children.length - 1;
          printTree(child, '   ', isLast, false);
        }
      }

      // Workflow
      if (guidance.workflow) {
        console.log();
        if (guidance.workflow.accessible) {
          if (guidance.workflow.content) {
            // Workflow-Inhalt direkt anzeigen
            console.log(guidance.workflow.content);
          } else {
            console.log(`📖 WORKFLOW: ${guidance.workflow.title}`);
            console.log('   (Workflow-Datei nicht gefunden)');
          }
        } else {
          console.log(`⛔ ${guidance.workflow.title}`);
          if (guidance.workflow.meaning) {
            console.log(`   ${guidance.workflow.meaning}`);
          }
        }
      }

      // Leseliste im Box-Format
      if (guidance.readingList) {
        const rl = guidance.readingList;
        const bereichKey = task.domain ? task.domain.split('/').pop() : null;
        const W = 75; // Innenbreite der Box (passend für lange URLs)

        const pad = (s) => {
          const len = s.length;
          return len < W ? s + ' '.repeat(W - len) : s.slice(0, W);
        };

        const lines = [];
        lines.push('┌─' + '─'.repeat(W) + '─┐');
        lines.push('│ ' + pad('LESELISTE (PFLICHT)') + ' │');
        lines.push('├─' + '─'.repeat(W) + '─┤');
        lines.push('│ ' + pad('') + ' │');

        let sectionCounter = 0;
        const nextSection = () => String.fromCharCode(65 + sectionCounter++); // A, B, C, ...

        // Architektur-Docs (Layer-spezifisch)
        if (rl.layerDocs?.length > 0 && rl.layer) {
          lines.push('│ ' + pad(`${nextSection()}) Architektur-Docs (${rl.layer}):`) + ' │');
          for (const doc of rl.layerDocs) {
            lines.push('│ ' + pad(`   → ${doc}`) + ' │');
          }
          lines.push('│ ' + pad('') + ' │');
        }

        // Feature-Docs
        if (rl.featureDocs?.length > 0) {
          const bereichLabel = bereichKey ? ` (${bereichKey})` : '';
          lines.push('│ ' + pad(`${nextSection()}) Feature-Docs${bereichLabel}:`) + ' │');
          for (const doc of rl.featureDocs) {
            lines.push('│ ' + pad(`   → ${doc}`) + ' │');
          }
          lines.push('│ ' + pad('') + ' │');
        }

        // Spec der Task (jede Referenz auf eigener Zeile)
        if (rl.specDoc && rl.specDoc !== '-') {
          lines.push('│ ' + pad(`${nextSection()}) Spec der Task:`) + ' │');
          const specRefs = rl.specDoc.split(', ');
          for (const ref of specRefs) {
            const trimmed = ref.trim();
            if (trimmed) {
              lines.push('│ ' + pad(`   → ${trimmed}`) + ' │');
            }
          }
          lines.push('│ ' + pad('') + ' │');
        }

        lines.push('└─' + '─'.repeat(W) + '─┘');

        console.log();
        for (const line of lines) {
          console.log(line);
        }
      }
    }
    return;
  }

  // Unclaim-Ergebnis
  if (value.unclaimed) {
    console.log(`✅ Task #${value.taskId} freigegeben`);
    return;
  }

  // Multi-Show result (mehrere Tasks kompakt) - VOR sort prüfen!
  if (value.isMultiShow) {
    const termWidth = process.stdout.columns || 120;

    for (const item of value.items) {
      const id = item.isBug ? item.number : `#${item.number}`;
      const depsArr = item.deps || [];
      const depsStr = depsArr.length > 0
        ? depsArr.map(d => typeof d === 'string' ? d : `#${d}`).join(', ')
        : '';
      const depsDisplay = depsStr ? ` [${depsStr}]` : '';

      // Zeile 1: Status, ID, Domain, Prio, MVP, Deps
      console.log(`${item.status} ${id} ${item.domain} | ${item.prio} | ${item.mvp === 'Ja' ? 'MVP' : ''}${depsDisplay}`);

      // Beschreibung (vollständig mit Wrapping)
      console.log(wrapText(item.beschreibung, termWidth));

      // Spec (vollständig mit Wrapping)
      if (item.spec && item.spec !== '-') {
        console.log(wrapText(`Spec: ${item.spec}`, termWidth));
      }

      // Imp (vollständig mit Wrapping)
      if (item.imp && item.imp !== '-') {
        console.log(wrapText(`Imp: ${item.imp}`, termWidth));
      }

      console.log(); // Leerzeile zwischen Tasks
    }

    // Warnung für fehlende IDs
    if (value.missing?.length > 0) {
      console.log(`⚠️  Nicht gefunden: ${value.missing.map(id =>
        typeof id === 'string' ? id : `#${id}`).join(', ')}`);
    }
    return;
  }

  // sort result (object with items array)
  if (value.items && Array.isArray(value.items)) {
    const items = value.items;
    const filterHeader = buildFilterHeader(opts);

    if (items.length === 0) {
      if (filterHeader) {
        console.log(filterHeader);
        console.log();
      }
      console.log('Keine Ergebnisse gefunden.');

      // Verfügbare Werte anzeigen bei aktiven Filtern
      if (opts.layer && value.availableValues?.layers?.length > 0) {
        console.log(`Verfügbare Layer: ${value.availableValues.layers.join(', ')}`);
      }
      if (opts.domain && value.availableValues?.domains?.length > 0) {
        console.log(`Verfügbare Domains: ${value.availableValues.domains.join(', ')}`);
      }
      return;
    }

    // Filter-Header vor der Task-Liste
    if (filterHeader) {
      console.log(filterHeader);
      console.log();
    }

    const termWidth = process.stdout.columns || 120;

    // Tasks ausgeben
    for (const item of items) {
      const id = item.isBug ? item.number : `#${item.number}`;
      const depsArr = item.deps || [];
      const depsStr = depsArr.length > 0
        ? depsArr.map(d => typeof d === 'string' ? d : `#${d}`).join(', ')
        : '';
      const depsDisplay = depsStr ? ` [${depsStr}]` : '';

      // Zeile 1: Status, ID, Domain, Prio, MVP, Deps
      console.log(`${item.status} ${id} ${item.domain} | ${item.prio} | ${item.mvp === 'Ja' ? 'MVP' : ''}${depsDisplay}`);

      // Zeile 2: Beschreibung
      const maxDesc = termWidth - 4;
      const desc = item.beschreibung.length > maxDesc
        ? item.beschreibung.slice(0, maxDesc - 1) + '…'
        : item.beschreibung;
      console.log(`   ${desc}`);
    }

    // Statistiken
    if (!opts.quiet && value.stats) {
      const s = value.stats;
      console.log();
      const statusLine = Object.entries(s.statusCounts)
        .filter(([, count]) => count > 0)
        .map(([status, count]) => `${status} ${count}`)
        .join('  ');
      console.log(statusLine);
      console.log(`${items.length} von ${s.filteredCount} passenden Tasks (${s.totalTasks} gesamt)`);
    }

    // Zyklus-Warnung
    if (!opts.quiet && value.cycles?.length > 0) {
      console.log('\n⚠️  Zirkuläre Dependencies:');
      for (const cycle of value.cycles) {
        console.log(`   ${cycle.map(id => `#${id}`).join(' → ')}`);
      }
    }

    // Inkonsistenz-Warnung (max 10 anzeigen)
    if (!opts.quiet && value.inconsistencies?.length > 0) {
      const maxShow = 10;
      const total = value.inconsistencies.length;
      console.log(`\n⚠️  Inkonsistente Definitionen (${total} gefunden, Roadmap ≠ Doc):`);
      for (const inc of value.inconsistencies.slice(0, maxShow)) {
        const id = typeof inc.taskId === 'number' ? `#${inc.taskId}` : inc.taskId;
        for (const diff of inc.diffs) {
          const docVal = diff.doc?.length > 30 ? diff.doc.slice(0, 30) + '…' : diff.doc;
          const roadmapVal = diff.roadmap?.length > 30 ? diff.roadmap.slice(0, 30) + '…' : diff.roadmap;
          console.log(`   ${id} ${inc.source}: ${diff.field} "${docVal}" ≠ "${roadmapVal}"`);
        }
      }
      if (total > maxShow) {
        console.log(`   ... und ${total - maxShow} weitere`);
      }
    }
    return;
  }

  if (Array.isArray(value)) {
    // search results (plain array)
    if (value.length === 0) {
      console.log('Keine Ergebnisse gefunden.');
      return;
    }
    for (const item of value) {
      const id = item.isBug ? item.number : `#${item.number}`;
      console.log(`${item.status} ${id} [${item.domain}] ${item.beschreibung}`);
    }
    console.log(`\n${value.length} Ergebnis(se)`);
    return;
  }

  // bulk-edit result (has success[] and failed[] arrays)
  if (Array.isArray(value.success) && Array.isArray(value.failed)) {
    const { success, failed, propagation, dryRun } = value;

    if (dryRun) {
      console.log('DRY-RUN (keine Änderungen gespeichert)\n');
    }

    // Erfolge
    for (const s of success) {
      // bulk-add: taskId/bugId + beschreibung, bulk-edit: taskId + statusChange
      const id = s.bugId ?? (typeof s.taskId === 'string' ? s.taskId : `#${s.taskId}`);
      const statusInfo = s.statusChange
        ? `: ${s.statusChange.from} -> ${s.statusChange.to}`
        : '';
      const desc = s.beschreibung ? ` "${s.beschreibung}"` : '';
      console.log(`  ✅ ${id}${statusInfo}${desc}`);
    }

    // Fehler
    for (const f of failed) {
      // bulk-add: taskIndex/bugIndex, bulk-edit: taskId
      const id = f.taskIndex
        ? `Task ${f.taskIndex}`
        : f.bugIndex
          ? `Bug ${f.bugIndex}`
          : typeof f.taskId === 'string' ? f.taskId : `#${f.taskId}`;
      console.log(`  ❌ ${id}: ${f.error.message}`);
    }

    // Propagation
    if (propagation?.length > 0) {
      console.log('\nPropagation:');
      for (const p of propagation) {
        const id = typeof p.id === 'string' ? p.id : `#${p.id}`;
        console.log(`  ${id}: ${p.oldStatus} -> ${p.newStatus} (${p.reason})`);
      }
    }

    // Summary
    const total = success.length + failed.length;
    console.log(`\nErgebnis: ${success.length}/${total} Tasks aktualisiert`);
    if (failed.length > 0) {
      console.log(`         ${failed.length} fehlgeschlagen`);
    }
    return;
  }

  // clear result (has docPath and deleted/failed arrays or taskIds/bugIds for dry-run)
  if (value.docPath !== undefined) {
    if (value.dryRun) {
      console.log('DRY-RUN (keine Änderungen)\n');
      console.log(`📋 Würde löschen aus ${value.docPath}:`);

      const allIds = [
        ...(value.taskIds || []).map(id => `#${id}`),
        ...(value.bugIds || [])
      ];

      if (allIds.length > 0) {
        console.log(`   ${allIds.join(', ')}`);
        console.log(`\n${value.totalCount} Items würden gelöscht`);
      } else {
        console.log('   (keine Items gefunden)');
      }
      return;
    }

    if (value.message) {
      console.log(`✅ ${value.message}`);
      return;
    }

    console.log(`📋 Lösche aus ${value.docPath}\n`);

    for (const item of value.deleted || []) {
      const id = item.type === 'bug' ? item.id : `#${item.id}`;
      console.log(`  ✅ ${id} gelöscht`);
    }

    for (const item of value.failed || []) {
      const id = item.type === 'bug' ? item.id : `#${item.id}`;
      console.log(`  ❌ ${id}: ${item.error?.message || 'Unbekannter Fehler'}`);
    }

    const deletedCount = (value.deleted || []).length;
    const failedCount = (value.failed || []).length;
    console.log(`\nErgebnis: ${deletedCount}/${value.totalCount} Items gelöscht`);
    if (failedCount > 0) {
      console.log(`         ${failedCount} fehlgeschlagen`);
    }
    return;
  }

  if (value.success !== undefined) {
    // sync result
    if (value.isSync) {
      if (value.synced === 0 && value.message) {
        console.log(`✅ ${value.message}`);
      } else {
        console.log(`✅ Synchronisierung abgeschlossen`);
        if (value.dryRun) console.log('   (Dry-Run - keine Änderungen gespeichert)');
        console.log(`   Inkonsistenzen gefunden: ${value.totalInconsistencies}`);
        console.log(`   Tasks synchronisiert: ${value.synced}/${value.processed}`);
        console.log(`   Doc-Dateien aktualisiert: ${value.docsSynced}`);

        // Fehler anzeigen
        const failures = value.results?.filter(r => !r.success) || [];
        if (failures.length > 0) {
          console.log('\n   ⚠️ Fehler bei:');
          for (const f of failures.slice(0, 5)) {
            const id = typeof f.taskId === 'number' ? `#${f.taskId}` : f.taskId;
            console.log(`      ${id}: ${f.reason}`);
          }
          if (failures.length > 5) {
            console.log(`      ... und ${failures.length - 5} weitere`);
          }
        }
      }
      return;
    }

    // edit/add/remove/split result
    if (value.success) {
      console.log('✅ Erfolgreich');
      if (value.dryRun) console.log('   (Dry-Run - keine Änderungen gespeichert)');
      if (value.newId) console.log(`   Neue ID: ${value.isBug ? value.newId : '#' + value.newId}`);
      if (value.newIds) console.log(`   Neue IDs: #${value.newIds.a}, #${value.newIds.b}`);
      if (value.roadmap?.statusChange) {
        console.log(`   Status: ${value.roadmap.statusChange.from} → ${value.roadmap.statusChange.to}`);
      }
      if (value.propagation?.length > 0) {
        console.log(`   Propagiert: ${value.propagation.length} Tasks`);
      }
    } else {
      console.log('❌ Fehlgeschlagen');
    }
    return;
  }

  if (value.item) {
    // show single item result with trees
    const item = value.item;
    const id = item.isBug ? item.number : `#${item.number}`;

    // Task-Info
    console.log(`\n${item.status} ${id} ${item.domain} | ${item.prio} | ${item.mvp === 'Ja' ? 'MVP' : ''}`);
    console.log(`   ${item.beschreibung}`);
    if (item.spec && item.spec !== '-') console.log(`   Spec: ${item.spec}`);
    if (item.imp && item.imp !== '-') console.log(`   Imp: ${item.imp}`);

    // Claim-Info
    if (value.claim) {
      console.log(`\n   🔒 Geclaimed (noch ${value.claim.remaining})`);
      console.log('   → Wähle eine andere Task, oder gib den Key ein falls du diese Task geclaimed hast.');
    }

    // Dependency-Tree (Voraussetzungen)
    if (value.dependencyTree?.children?.length > 0) {
      console.log('\n   Voraussetzungen:');
      for (let i = 0; i < value.dependencyTree.children.length; i++) {
        const child = value.dependencyTree.children[i];
        const isLast = i === value.dependencyTree.children.length - 1;
        printTree(child, '   ', isLast, false);
      }
    }

    // Dependent-Tree (Blockiert)
    if (value.dependentTree?.children?.length > 0) {
      console.log('\n   Blockiert:');
      for (let i = 0; i < value.dependentTree.children.length; i++) {
        const child = value.dependentTree.children[i];
        const isLast = i === value.dependentTree.children.length - 1;
        printTree(child, '   ', isLast, false);
      }
    }

    console.log();
    return;
  }

  // Fallback: JSON ausgeben
  console.log(JSON.stringify(value, null, 2));
}

/**
 * Main Entry Point
 */
async function main() {
  const args = process.argv.slice(2);

  // Globale Hilfe
  if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
    showGlobalHelp();
    process.exit(0);
  }

  const command = args[0];
  const commandArgs = args.slice(1);

  // Command validieren
  if (!COMMANDS[command]) {
    console.error(`❌ Unbekannter Command: ${command}`);
    console.error(`   Verfügbar: ${Object.keys(COMMANDS).join(', ')}`);
    console.error('   Nutze --help für mehr Info.');
    process.exit(1);
  }

  try {
    // Service lazy-loaden
    const service = await COMMANDS[command]();

    // Command-spezifische Hilfe
    if (commandArgs.includes('-h') || commandArgs.includes('--help')) {
      console.log(service.showHelp());
      process.exit(0);
    }

    // Args parsen und Command ausführen
    const opts = service.parseArgs(commandArgs);
    const result = service.execute(opts);

    // Ausgabe formatieren
    formatOutput(result, opts);

    // Exit-Code
    process.exit(result.ok ? 0 : 1);

  } catch (error) {
    console.error(`❌ Interner Fehler: ${error.message}`);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
