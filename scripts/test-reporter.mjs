#!/usr/bin/env node
/**
 * Custom Vitest Reporter
 *
 * Erzwingt Task-Verknüpfung in Tests und aktualisiert die Roadmap bei Fehlern.
 *
 * Task-IDs werden im describe-Block angegeben:
 *   describe('#428 Result Type', () => { ... })
 *   describe('[#428, #429] Combined Feature', () => { ... })
 *
 * Bei fehlgeschlagenen Tests wird die entsprechende Task auf ⚠️ gesetzt.
 */

import { extractTaskIds } from './core/table/parser.mjs';
import { createFsTaskAdapter } from './adapters/fs-task-adapter.mjs';

/**
 * Findet die oberste describe-Ebene eines Tests
 */
function getTopLevelDescribe(task) {
  // Vitest gibt uns task.suite als Kette von Suites
  let current = task.suite;
  while (current?.suite) {
    current = current.suite;
  }
  return current?.name || '';
}

/**
 * Custom Vitest Reporter
 */
export default class TaskReporter {
  constructor() {
    this.testsWithoutTasks = [];
    this.failedTaskIds = new Map(); // taskId -> [error messages]
    this.taskCoverage = new Map(); // taskId -> test count
  }

  onInit() {
    // Reporter initialisiert
  }

  onCollected(files) {
    // Tests wurden gesammelt - hier könnten wir Task-IDs validieren
  }

  onTaskUpdate(packs) {
    // Wird für jeden Test-Update aufgerufen
  }

  onFinished(files, errors) {
    // Alle Tests durchlaufen
    for (const file of files || []) {
      this.processFile(file);
    }

    // Zusammenfassung ausgeben
    this.printSummary();

    // Roadmap aktualisieren bei Fehlern
    this.updateRoadmap();

    // Fehler werfen wenn Tests ohne Tasks existieren
    if (this.testsWithoutTasks.length > 0) {
      console.error('\n❌ FEHLER: Tests ohne Task-Verknüpfung gefunden!\n');
      for (const test of this.testsWithoutTasks) {
        console.error(`  - ${test.file}: ${test.name}`);
      }
      console.error('\nFüge Task-IDs im describe-Block hinzu: describe(\'#428 Feature Name\', () => { ... })\n');
      process.exitCode = 1;
    }
  }

  processFile(file) {
    const tasks = this.collectTasks(file);

    for (const task of tasks) {
      if (task.type !== 'test') continue;

      const topDescribe = getTopLevelDescribe(task);
      const taskIds = extractTaskIds(topDescribe);

      // Prüfen ob Task-IDs vorhanden
      if (taskIds.length === 0) {
        this.testsWithoutTasks.push({
          file: file.name,
          name: task.name,
          fullName: topDescribe ? `${topDescribe} > ${task.name}` : task.name
        });
        continue;
      }

      // Task-Coverage zählen
      for (const id of taskIds) {
        this.taskCoverage.set(id, (this.taskCoverage.get(id) || 0) + 1);
      }

      // Fehlgeschlagene Tests tracken
      if (task.result?.state === 'fail') {
        const errorMsg = task.result.errors?.[0]?.message || 'Unknown error';
        for (const id of taskIds) {
          if (!this.failedTaskIds.has(id)) {
            this.failedTaskIds.set(id, []);
          }
          this.failedTaskIds.get(id).push({
            test: task.name,
            error: errorMsg.slice(0, 100) // Kürzen
          });
        }
      }
    }
  }

  collectTasks(suite, tasks = []) {
    if (suite.tasks) {
      for (const task of suite.tasks) {
        if (task.type === 'test') {
          tasks.push(task);
        } else if (task.type === 'suite') {
          this.collectTasks(task, tasks);
        }
      }
    }
    return tasks;
  }

  printSummary() {
    console.log('\n--- Task-Reporter Zusammenfassung ---\n');

    // Task-Coverage
    if (this.taskCoverage.size > 0) {
      console.log('Task-Coverage:');
      const sorted = [...this.taskCoverage.entries()].sort((a, b) => a[0] - b[0]);
      for (const [id, count] of sorted) {
        const status = this.failedTaskIds.has(id) ? '❌' : '✅';
        console.log(`  #${id}: ${count} Tests ${status}`);
      }
    }

    // Fehlgeschlagene Tasks
    if (this.failedTaskIds.size > 0) {
      console.log('\n⚠️ Tasks mit fehlgeschlagenen Tests:');
      for (const [id, errors] of this.failedTaskIds) {
        console.log(`  #${id}:`);
        for (const { test, error } of errors) {
          console.log(`    - ${test}: ${error}`);
        }
      }
    }

    // Tests ohne Tasks
    if (this.testsWithoutTasks.length > 0) {
      console.log(`\n⚠️ Tests ohne Task-Verknüpfung: ${this.testsWithoutTasks.length}`);
    }
  }

  updateRoadmap() {
    if (this.failedTaskIds.size === 0) return;

    console.log('\n📝 Aktualisiere Development-Roadmap.md...\n');

    const taskAdapter = createFsTaskAdapter();

    for (const [taskId, errors] of this.failedTaskIds) {
      const result = taskAdapter.updateStatus(taskId, '⚠️', errors[0]?.error);
      if (result.ok) {
        console.log(`  ⚠️ Task #${taskId} auf Status ⚠️ gesetzt`);
      } else {
        console.log(`  ℹ️ Task #${taskId}: ${result.error?.message || 'nicht gefunden'}`);
      }
    }
  }
}
