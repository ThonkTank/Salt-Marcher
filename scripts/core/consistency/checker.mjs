/**
 * Consistency Checker
 *
 * Vergleicht Task-Definitionen aus verschiedenen Quellen auf Konsistenz.
 * Die Roadmap ist die Single Source of Truth.
 */

/**
 * Vergleicht zwei Task-Definitionen auf relevante Unterschiede
 *
 * @param {object} roadmapTask - Task aus Development-Roadmap.md
 * @param {object} docTask - Task aus einem Feature-Doc
 * @returns {object|null} - Unterschiede oder null wenn konsistent
 */
export function compareTaskDefinitions(roadmapTask, docTask) {
  const diffs = [];

  // Status vergleichen (wichtigster Check)
  if (roadmapTask.status !== docTask.status) {
    diffs.push({
      field: 'status',
      roadmap: roadmapTask.status,
      doc: docTask.status
    });
  }

  // Beschreibung vergleichen (ohne Whitespace-Unterschiede)
  const roadmapDesc = roadmapTask.beschreibung?.trim();
  const docDesc = docTask.beschreibung?.trim();
  if (roadmapDesc !== docDesc) {
    diffs.push({
      field: 'beschreibung',
      roadmap: roadmapDesc,
      doc: docDesc
    });
  }

  return diffs.length > 0 ? diffs : null;
}

/**
 * Findet alle Inkonsistenzen in einer Map von Task-Definitionen
 *
 * @param {Map<number|string, Array<{source: string, task: object}>>} definitions
 * @returns {Array<{taskId: number|string, source: string, diffs: Array}>}
 */
export function findInconsistencies(definitions) {
  const inconsistencies = [];

  for (const [taskId, sources] of definitions) {
    if (sources.length < 2) continue;

    // Roadmap-Definition finden (Single Source of Truth)
    const roadmapSource = sources.find(s => s.source === 'Roadmap');
    if (!roadmapSource) continue;

    // Mit allen anderen Quellen vergleichen
    for (const otherSource of sources) {
      if (otherSource.source === 'Roadmap') continue;

      const diffs = compareTaskDefinitions(roadmapSource.task, otherSource.task);
      if (diffs) {
        inconsistencies.push({
          taskId,
          source: otherSource.source,
          diffs
        });
      }
    }
  }

  return inconsistencies;
}
