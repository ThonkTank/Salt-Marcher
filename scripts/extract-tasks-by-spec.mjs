#!/usr/bin/env node

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const roadmapPath = join(__dirname, '../docs/architecture/Development-Roadmap.md');

const roadmapContent = readFileSync(roadmapPath, 'utf-8');

// Parse the tasks table
const lines = roadmapContent.split('\n');
let inTasksTable = false;
const tasks = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // Detect table start
  if (line.match(/^\|\s*#\s*\|\s*Status\s*\|/)) {
    inTasksTable = true;
    continue;
  }

  // Skip separator line
  if (inTasksTable && line.match(/^\|[-:\s|]+\|$/)) {
    continue;
  }

  // End of table
  if (inTasksTable && !line.startsWith('|')) {
    inTasksTable = false;
    continue;
  }

  // Parse task line
  if (inTasksTable && line.startsWith('|')) {
    const parts = line.split('|').map(p => p.trim()).filter(p => p);

    if (parts.length >= 9) {
      const [num, status, bereich, beschreibung, prio, mvp, deps, spec, imp] = parts;

      // Extract spec filename (without anchors)
      let specFile = null;
      const specMatch = spec.match(/\[([^\]]+\.md)/i);
      if (specMatch) {
        specFile = specMatch[1];
      }

      tasks.push({
        num,
        status,
        bereich,
        beschreibung,
        prio,
        mvp,
        deps,
        spec,
        specFile,
        imp
      });
    }
  }
}

// Group by spec file
const tasksBySpec = new Map();

tasks.forEach(task => {
  if (!task.specFile) return;

  // Extract just the filename (no path)
  const filename = task.specFile.split('/').pop();

  if (!tasksBySpec.has(filename)) {
    tasksBySpec.set(filename, []);
  }

  tasksBySpec.get(filename).push(task);
});

// Output as JSON
console.log(JSON.stringify(Object.fromEntries(tasksBySpec), null, 2));
