// Simple test reporter that saves results to a JSON file
import fs from 'fs';
import path from 'path';

export default class JsonReporter {
  onFinished(files) {
    const results = {
      timestamp: new Date().toISOString(),
      totalTests: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      files: [],
    };

    for (const file of files) {
      const fileResult = {
        name: file.name,
        tests: [],
      };

      for (const task of file.tasks ?? []) {
        this.processTask(task, fileResult.tests, results);
      }

      results.files.push(fileResult);
    }

    const outputPath = path.resolve(process.cwd(), 'node_modules/.vite/vitest/results.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  }

  processTask(task, tests, results) {
    if (task.type === 'test') {
      results.totalTests++;
      const status = task.result?.state ?? 'skipped';
      if (status === 'pass') results.passed++;
      else if (status === 'fail') results.failed++;
      else results.skipped++;

      tests.push({
        name: task.name,
        status,
        duration: task.result?.duration ?? 0,
      });
    }

    if (task.tasks) {
      for (const subtask of task.tasks) {
        this.processTask(subtask, tests, results);
      }
    }
  }
}
