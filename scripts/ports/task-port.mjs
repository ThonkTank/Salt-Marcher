/**
 * Task Port Interface
 *
 * Unified Abstraktion für Task-Operationen.
 * Der Adapter findet automatisch ALLE Instanzen einer Task (Roadmap + Feature-Docs)
 * und synchronisiert Änderungen überall.
 *
 * Services müssen keine Lines oder Indices mehr kennen - nur Task-IDs.
 */

/**
 * @typedef {object} TaskData
 * @property {object[]} tasks - Geparste Tasks
 * @property {object[]} bugs - Geparste Bugs
 * @property {string[]} lines - Alle Zeilen der Roadmap
 * @property {Map<string|number, object>} itemMap - Map von ID zu Item
 */

/**
 * @typedef {object} UpdateResult
 * @property {boolean} success
 * @property {object} roadmap - Änderungen in der Roadmap { modified, before?, after? }
 * @property {object[]} docs - Änderungen in Feature-Docs [{ file, path, modified, before?, after? }]
 */

/**
 * @typedef {object} DeleteResult
 * @property {boolean} success
 * @property {object} roadmap - Gelöscht aus Roadmap
 * @property {object[]} docs - Gelöscht aus Feature-Docs
 */

/**
 * @typedef {object} SplitResult
 * @property {boolean} success
 * @property {object} newIds - { a: string|number, b: string|number }
 * @property {object} roadmap - Änderungen in der Roadmap
 * @property {object[]} docs - Änderungen in Feature-Docs
 */

/**
 * @typedef {object} AddResult
 * @property {boolean} success
 * @property {string|number} newId - Neue Task/Bug-ID
 * @property {boolean} isBug - Ob es ein Bug ist
 */

/**
 * @typedef {object} DocMatch
 * @property {string} path - Vollständiger Pfad zur Datei
 * @property {string} name - Dateiname
 * @property {string} content - Dateiinhalt
 */

/**
 * @typedef {object} TaskDefinition
 * @property {string} source - Quelle ('Roadmap' oder Doc-Name)
 * @property {object} task - Task-Objekt
 */

/**
 * @typedef {object} TaskPort
 *
 * @property {() => import('../core/result.mjs').Result<TaskData>} load
 *   Lädt und parst die Roadmap mit allen Task-Daten
 *
 * @property {(taskId: string|number, updates: object, opts?: {dryRun?: boolean}) => import('../core/result.mjs').Result<UpdateResult>} updateTask
 *   Aktualisiert eine Task in Roadmap UND allen Docs.
 *   Der Adapter findet die Task automatisch anhand der ID.
 *   updates: { status?, bereich?, beschreibung?, prio?, mvp?, deps?, spec?, imp? }
 *
 * @property {(taskId: string|number, opts?: {dryRun?: boolean}) => import('../core/result.mjs').Result<DeleteResult>} deleteTask
 *   Löscht eine Task aus Roadmap UND allen Docs
 *
 * @property {(taskId: string|number, splitData: object, opts?: {dryRun?: boolean}) => import('../core/result.mjs').Result<SplitResult>} splitTask
 *   Splittet eine Task in zwei Teile in Roadmap UND allen Docs
 *   splitData: { descA: string, descB: string }
 *
 * @property {(taskData: object, opts?: {dryRun?: boolean}) => import('../core/result.mjs').Result<AddResult>} addTask
 *   Fügt eine neue Task zur Roadmap hinzu.
 *   Neue Tasks werden NICHT zu Docs synchronisiert (müssen manuell referenziert werden).
 *   taskData: { bereich, beschreibung, prio?, mvp?, deps?, spec?, isBug? }
 *
 * @property {(taskId: string|number) => DocMatch[]} findDocsContainingTask
 *   Findet alle Docs die eine bestimmte Task enthalten
 *
 * @property {() => import('../core/result.mjs').Result<Map<number|string, TaskDefinition[]>>} getAllTaskDefinitions
 *   Sammelt alle Task-Definitionen aus Roadmap und Feature-Docs
 *
 * @property {(validIds: Set<number|string>) => import('../core/result.mjs').Result<Array<{file: string, id: number|string}>>} findOrphanReferences
 *   Findet Task-Referenzen in Docs die nicht in der Roadmap existieren
 *
 * @property {() => string} getRoadmapPath
 *   Gibt den Pfad zur Roadmap zurück
 *
 * @property {() => string} getDocsPath
 *   Gibt den Pfad zum docs-Verzeichnis zurück
 */

// Type exports for JSDoc
export const TaskPortType = /** @type {TaskPort} */ (null);
