// Ziel: Neue Tasks und Bugs erstellen
// Siehe: docs/tools/taskTool.md#add---tasksbbugs-erstellen
//
// Funktionen:
// - addTasks(taskInputs, existingTasks) - Neue Tasks erstellen
// - addBugs(bugInputs, tasks, existingBugs) - Neue Bugs erstellen
// - validateTaskInput(input) - Task-Input validieren
// - validateBugInput(input) - Bug-Input validieren
// - getNextTaskId(existingTasks) - Nächste freie Task-ID
// - getNextBugId(existingBugs) - Nächste freie Bug-ID

import { existsSync } from 'node:fs';
import { ok, err } from '../core/result.mjs';
import { PRIORITIES, STATUS, parseMultiValue, isValidLayerAsync, loadValidLayers } from '../core/table/schema.mjs';
import { resolveSpecPath, resolveImplPath, functionExists, DOCS_PATH } from '../adapters/fs-task-adapter.mjs';
import { areDependenciesSatisfied } from '../core/deps/propagation.mjs';

/**
 * Erstellt neue Tasks.
 * @param {NewTaskInput[]} taskInputs
 * @param {import('../core/table/parser.mjs').Task[]} existingTasks
 * @returns {Promise<import('../core/result.mjs').Result<import('../core/table/parser.mjs').Task[], {code: string, details?: string}>>}
 */
export async function addTasks(taskInputs, existingTasks) {
  const newTasks = [];
  let nextId = getNextTaskId(existingTasks);

  for (let i = 0; i < taskInputs.length; i++) {
    const input = taskInputs[i];
    // Validierung
    const validation = await validateTaskInput(input, existingTasks);
    if (!validation.ok) {
      // Task-Index und Beschreibung für bessere Fehleridentifikation hinzufügen
      return err({
        ...validation.error,
        taskIndex: i,
        taskPreview: input.beschreibung?.substring(0, 50) || '(keine Beschreibung)'
      });
    }

    // Task erstellen - domain, layer, spec, impl als Arrays
    const task = {
      id: nextId++,
      status: STATUS.open.symbol,
      domain: parseMultiValue(input.domain),  // String zu Array
      layer: parseMultiValue(input.layer),    // String zu Array
      beschreibung: input.beschreibung,
      prio: input.prio || 'mittel',
      mvp: input.mvp ?? false,
      deps: input.deps === '-' ? [] : (input.deps || '').split(',').map(d => d.trim()).filter(Boolean),
      spec: parseMultiValue(input.specs),     // String zu Array
      impl: parseMultiValue(input.impl),      // String zu Array
      lineNumber: 0, // Wird beim Schreiben aktualisiert
    };

    // Dependency-Check: Wenn nicht alle Dependencies erfüllt → ⛔
    const allTasksForCheck = [...existingTasks, ...newTasks, task];
    if (task.deps.length > 0 && !areDependenciesSatisfied(task, allTasksForCheck, [])) {
      task.status = STATUS.blocked.symbol;
    }

    newTasks.push(task);
  }

  return ok(newTasks);
}

/**
 * Erstellt neue Bugs.
 * @param {NewBugInput[]} bugInputs
 * @param {import('../core/table/parser.mjs').Task[]} tasks
 * @param {import('../core/table/parser.mjs').Bug[]} existingBugs
 * @returns {import('../core/result.mjs').Result<{bugs: import('../core/table/parser.mjs').Bug[], affectedTasks: import('../core/table/parser.mjs').Task[]}, {code: string}>}
 */
export function addBugs(bugInputs, tasks, existingBugs) {
  const newBugs = [];
  const affectedTasks = [];
  let nextId = getNextBugId(existingBugs);

  for (const input of bugInputs) {
    // Validierung
    const validation = validateBugInput(input);
    if (!validation.ok) {
      return validation;
    }

    // Bug erstellen
    const bug = {
      id: `b${nextId++}`,
      status: STATUS.open.symbol,
      beschreibung: input.beschreibung,
      prio: input.prio || 'hoch',
      deps: (input.deps || '').split(',').map(d => d.trim()).filter(Boolean),
      lineNumber: 0,
    };

    newBugs.push(bug);

    // Referenzierte Tasks auf ⚠️ setzen
    for (const depId of bug.deps) {
      const taskId = depId.replace('#', '');
      const task = tasks.find(t => String(t.id) === taskId);
      if (task && !affectedTasks.includes(task)) {
        task.status = STATUS.broken.symbol;
        affectedTasks.push(task);
      }
    }
  }

  return ok({ bugs: newBugs, affectedTasks });
}

/**
 * Validiert Task-Input.
 * @param {NewTaskInput} input
 * @param {import('../core/table/parser.mjs').Task[]} existingTasks
 * @returns {Promise<import('../core/result.mjs').Result<void, {code: string, field?: string}>>}
 */
export async function validateTaskInput(input, existingTasks) {
  const requiredFields = ['domain', 'layer', 'beschreibung', 'specs', 'impl'];

  for (const field of requiredFields) {
    if (!input[field]) {
      return err({ code: 'MISSING_FIELD', field });
    }
  }

  if (!(await isValidLayerAsync(input.layer, DOCS_PATH))) {
    const validLayers = await loadValidLayers(DOCS_PATH);
    return err({ code: 'INVALID_LAYER', layer: input.layer, valid: validLayers });
  }

  if (input.prio && !PRIORITIES[input.prio]) {
    return err({ code: 'INVALID_PRIO', prio: input.prio });
  }

  // Spec-Datei Existenz prüfen
  const specResult = await validateSpec(input.specs);
  if (!specResult.ok) {
    return specResult;
  }

  // Impl-Referenz validieren
  const implResult = await validateImpl(input.impl);
  if (!implResult.ok) {
    return implResult;
  }

  // Dependency-IDs auf Existenz prüfen
  const depsResult = validateDeps(input.deps, existingTasks);
  if (!depsResult.ok) {
    return depsResult;
  }

  return ok(undefined);
}

/**
 * Validiert Bug-Input.
 * @param {NewBugInput} input
 * @returns {import('../core/result.mjs').Result<void, {code: string}>}
 */
export function validateBugInput(input) {
  if (!input.beschreibung) {
    return err({ code: 'MISSING_FIELD', field: 'beschreibung' });
  }

  return ok(undefined);
}

/**
 * Berechnet nächste freie Task-ID.
 * @param {import('../core/table/parser.mjs').Task[]} existingTasks
 * @returns {number}
 */
export function getNextTaskId(existingTasks) {
  if (existingTasks.length === 0) return 1;
  return Math.max(...existingTasks.map(t => t.id)) + 1;
}

/**
 * Berechnet nächste freie Bug-ID.
 * @param {import('../core/table/parser.mjs').Bug[]} existingBugs
 * @returns {number}
 */
export function getNextBugId(existingBugs) {
  if (existingBugs.length === 0) return 1;
  return Math.max(...existingBugs.map(b => parseInt(b.id.replace('b', ''), 10))) + 1;
}

/**
 * Validiert Impl-Referenzen (komma-separiert).
 * - [neu]: Nur Format prüfen
 * - [ändern]/[fertig]: Datei + Funktion müssen existieren
 * @param {string} impls - Komma-separierte Impl-Referenzen
 * @returns {Promise<import('../core/result.mjs').Result<void, {code: string}>>}
 */
async function validateImpl(impls) {
  const implRefs = parseMultiValue(impls);
  for (const impl of implRefs) {
    if (impl === '-') continue;
    const implResult = await resolveImplPath(impl);
    if (!implResult.ok) {
      return err({ code: implResult.error.code, impl });
    }

    const { path, functionName, tag } = implResult.value;

    // [neu] - nur Format validiert, Datei muss nicht existieren
    if (tag === '[neu]') {
      continue;
    }

    // [ändern]/[fertig] - Funktion muss existieren
    if (functionName && !(await functionExists(path, functionName))) {
      return err({ code: 'FUNC_NOT_FOUND', functionName, file: path });
    }
  }

  return ok(undefined);
}

/**
 * Validiert Spec-Referenzen (komma-separiert).
 * Alle Spec-Dateien müssen in docs/ existieren.
 * @param {string} specs - Komma-separierte Spec-Referenzen
 * @returns {Promise<import('../core/result.mjs').Result<void, {code: string}>>}
 */
async function validateSpec(specs) {
  const specRefs = parseMultiValue(specs);
  for (const spec of specRefs) {
    if (spec === '-') continue;
    const specResult = await resolveSpecPath(spec);
    if (!specResult.ok) {
      return err({ code: 'SPEC_NOT_FOUND', spec, error: specResult.error.code });
    }
  }
  return ok(undefined);
}

/**
 * Validiert Dependency-Referenzen.
 * Alle referenzierten Task-IDs müssen existieren.
 * @param {string} deps
 * @param {import('../core/table/parser.mjs').Task[]} existingTasks
 * @returns {import('../core/result.mjs').Result<void, {code: string}>}
 */
function validateDeps(deps, existingTasks) {
  if (deps === '-' || !deps) return ok(undefined);

  const depIds = deps.split(',').map(d => d.trim().replace('#', '')).filter(Boolean);
  const taskIds = new Set(existingTasks.map(t => String(t.id)));

  for (const depId of depIds) {
    // Bug-Referenzen (b1, b2, ...) überspringen
    if (depId.startsWith('b')) continue;

    if (!taskIds.has(depId)) {
      return err({ code: 'DEP_NOT_FOUND', depId: `#${depId}` });
    }
  }
  return ok(undefined);
}

/**
 * @typedef {Object} NewTaskInput
 * @property {string} domain
 * @property {string} layer
 * @property {string} beschreibung
 * @property {string} [deps]
 * @property {string} specs
 * @property {string} impl
 * @property {string} [prio]
 * @property {boolean} [mvp]
 */

/**
 * @typedef {Object} NewBugInput
 * @property {string} beschreibung
 * @property {string} [deps]
 * @property {string} [prio]
 */
