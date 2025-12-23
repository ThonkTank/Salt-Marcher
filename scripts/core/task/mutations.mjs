/**
 * Task Mutation Builder
 *
 * Immutable Builder Pattern für Task-Änderungen.
 * Sammelt Änderungen ohne sie anzuwenden.
 */

import { ok, err, TaskErrorCode } from '../result.mjs';
import { TaskStatus, isValidStatus, resolveStatusAlias } from '../table/schema.mjs';
import { updateTaskLine, updateBugLine } from '../table/builder.mjs';
import { parseDeps, formatDeps } from '../table/parser.mjs';

/**
 * @typedef {object} TaskChange
 * @property {string} [status] - Neuer Status
 * @property {string} [bereich] - Neuer Bereich
 * @property {string} [beschreibung] - Neue Beschreibung
 * @property {string} [prio] - Neue Priorität
 * @property {string} [mvp] - Neues MVP-Flag
 * @property {Array<string|number>} [deps] - Neue Dependencies
 * @property {string} [spec] - Neue Spec-Referenz
 * @property {string} [imp] - Neue Implementation-Referenz
 */

/**
 * @typedef {object} MutationResult
 * @property {string|number} taskId - Die Task-ID
 * @property {object} original - Original-Werte
 * @property {TaskChange} changes - Die Änderungen
 * @property {string} newLine - Die neue Zeile
 * @property {number} lineIndex - Zeilen-Index
 */

/**
 * Erstellt einen Task Mutation Builder
 *
 * @param {object} task - Die Task die geändert werden soll
 * @returns {TaskMutationBuilder}
 */
export function createTaskMutation(task) {
  return new TaskMutationBuilder(task);
}

/**
 * Task Mutation Builder
 *
 * Sammelt Änderungen an einer Task ohne sie direkt anzuwenden.
 * Ermöglicht Validierung und dry-run vor dem tatsächlichen Anwenden.
 */
class TaskMutationBuilder {
  /**
   * @param {object} task - Die Task
   */
  constructor(task) {
    this._task = task;
    this._changes = {};
    this._errors = [];
  }

  /**
   * Setzt den Status
   * @param {string} status - Status-Emoji oder Alias
   * @returns {TaskMutationBuilder}
   */
  setStatus(status) {
    const resolved = resolveStatusAlias(status);

    if (!isValidStatus(resolved)) {
      this._errors.push({
        code: TaskErrorCode.INVALID_STATUS,
        message: `Ungültiger Status: ${status}`,
        field: 'status'
      });
      return this;
    }

    this._changes.status = resolved;
    return this;
  }

  /**
   * Setzt den Bereich
   * @param {string} bereich
   * @returns {TaskMutationBuilder}
   */
  setBereich(bereich) {
    if (!bereich || bereich.trim() === '') {
      this._errors.push({
        code: TaskErrorCode.INVALID_FORMAT,
        message: 'Bereich darf nicht leer sein',
        field: 'bereich'
      });
      return this;
    }
    this._changes.bereich = bereich.trim();
    return this;
  }

  /**
   * Setzt die Beschreibung
   * @param {string} beschreibung
   * @returns {TaskMutationBuilder}
   */
  setBeschreibung(beschreibung) {
    if (!beschreibung || beschreibung.trim() === '') {
      this._errors.push({
        code: TaskErrorCode.INVALID_FORMAT,
        message: 'Beschreibung darf nicht leer sein',
        field: 'beschreibung'
      });
      return this;
    }
    this._changes.beschreibung = beschreibung.trim();
    return this;
  }

  /**
   * Setzt die Priorität
   * @param {string} prio - hoch/mittel/niedrig
   * @returns {TaskMutationBuilder}
   */
  setPrio(prio) {
    const valid = ['hoch', 'mittel', 'niedrig'];
    const normalized = prio.toLowerCase().trim();

    if (!valid.includes(normalized)) {
      this._errors.push({
        code: TaskErrorCode.INVALID_FORMAT,
        message: `Ungültige Priorität: ${prio}. Erlaubt: ${valid.join(', ')}`,
        field: 'prio'
      });
      return this;
    }
    this._changes.prio = normalized;
    return this;
  }

  /**
   * Setzt das MVP-Flag
   * @param {string} mvp - Ja/Nein
   * @returns {TaskMutationBuilder}
   */
  setMvp(mvp) {
    const normalized = mvp.trim();
    if (!['Ja', 'Nein'].includes(normalized)) {
      this._errors.push({
        code: TaskErrorCode.INVALID_FORMAT,
        message: `Ungültiges MVP-Flag: ${mvp}. Erlaubt: Ja, Nein`,
        field: 'mvp'
      });
      return this;
    }
    this._changes.mvp = normalized;
    return this;
  }

  /**
   * Setzt die Dependencies
   * @param {string|Array<string|number>} deps - Deps als String oder Array
   * @returns {TaskMutationBuilder}
   */
  setDeps(deps) {
    if (typeof deps === 'string') {
      this._changes.deps = parseDeps(deps);
    } else if (Array.isArray(deps)) {
      this._changes.deps = deps;
    } else {
      this._changes.deps = [];
    }
    return this;
  }

  /**
   * Entfernt alle Dependencies
   * @returns {TaskMutationBuilder}
   */
  clearDeps() {
    this._changes.deps = [];
    return this;
  }

  /**
   * Setzt die Spec-Referenz
   * @param {string} spec
   * @returns {TaskMutationBuilder}
   */
  setSpec(spec) {
    this._changes.spec = spec?.trim() || '-';
    return this;
  }

  /**
   * Setzt die Implementation-Referenz
   * @param {string} imp
   * @returns {TaskMutationBuilder}
   */
  setImp(imp) {
    this._changes.imp = imp?.trim() || '-';
    return this;
  }

  /**
   * Prüft ob es Änderungen gibt
   * @returns {boolean}
   */
  hasChanges() {
    return Object.keys(this._changes).length > 0;
  }

  /**
   * Prüft ob es Fehler gibt
   * @returns {boolean}
   */
  hasErrors() {
    return this._errors.length > 0;
  }

  /**
   * Gibt die Fehler zurück
   * @returns {Array}
   */
  getErrors() {
    return [...this._errors];
  }

  /**
   * Gibt die geplanten Änderungen zurück
   * @returns {TaskChange}
   */
  getChanges() {
    return { ...this._changes };
  }

  /**
   * Baut das Mutations-Ergebnis
   *
   * @returns {import('../result.mjs').Result<MutationResult>}
   */
  build() {
    if (this._errors.length > 0) {
      return err({
        code: TaskErrorCode.INVALID_FORMAT,
        message: 'Validation fehlgeschlagen',
        errors: this._errors
      });
    }

    if (!this.hasChanges()) {
      return err({
        code: TaskErrorCode.INVALID_FORMAT,
        message: 'Keine Änderungen angegeben'
      });
    }

    // Neue Werte berechnen
    const updates = { ...this._changes };

    // Dependencies formatieren
    if (updates.deps) {
      updates.deps = formatDeps(updates.deps);
    }

    // Neue Zeile bauen
    const updateFn = this._task.isBug ? updateBugLine : updateTaskLine;
    const newLine = updateFn(this._task.originalLine, updates);

    return ok({
      taskId: this._task.number,
      original: this._extractOriginalValues(),
      changes: this._changes,
      newLine,
      lineIndex: this._task.lineIndex
    });
  }

  /**
   * Extrahiert die Original-Werte für die geänderten Felder
   * @private
   */
  _extractOriginalValues() {
    const original = {};
    for (const key of Object.keys(this._changes)) {
      if (key === 'deps') {
        original[key] = [...(this._task.deps || [])];
      } else {
        original[key] = this._task[key];
      }
    }
    return original;
  }
}

/**
 * Wendet eine Mutation auf ein Lines-Array an
 *
 * @param {string[]} lines - Die Zeilen
 * @param {MutationResult} mutation - Die Mutation
 * @returns {string[]} - Neue Zeilen (Kopie)
 */
export function applyMutation(lines, mutation) {
  const newLines = [...lines];
  newLines[mutation.lineIndex] = mutation.newLine;
  return newLines;
}

/**
 * Wendet mehrere Mutationen auf ein Lines-Array an
 *
 * @param {string[]} lines - Die Zeilen
 * @param {MutationResult[]} mutations - Die Mutationen
 * @returns {string[]} - Neue Zeilen (Kopie)
 */
export function applyMutations(lines, mutations) {
  const newLines = [...lines];
  for (const mutation of mutations) {
    newLines[mutation.lineIndex] = mutation.newLine;
  }
  return newLines;
}
