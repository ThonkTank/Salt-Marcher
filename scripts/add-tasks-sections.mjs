#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const roadmapPath = join(__dirname, '../docs/architecture/Development-Roadmap.md');

// Architecture docs to process (excluding Development-Roadmap.md)
const archDocs = [
  'Application.md',
  'Conventions.md',
  'Core.md',
  'Data-Flow.md',
  'EntityRegistry.md',
  'Error-Handling.md',
  'EventBus.md',
  'Events-Catalog.md',
  'Features.md',
  'Glossary.md',
  'Infrastructure.md',
  'Project-Structure.md',
  'Testing.md'
];

// Parse the roadmap
const roadmapContent = readFileSync(roadmapPath, 'utf-8');
const lines = roadmapContent.split('\n');
let inTasksTable = false;
const tasks = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  if (line.match(/^\|\s*#\s*\|\s*Status\s*\|/)) {
    inTasksTable = true;
    continue;
  }

  if (inTasksTable && line.match(/^\|[-:\s|]+\|$/)) {
    continue;
  }

  if (inTasksTable && !line.startsWith('|')) {
    inTasksTable = false;
    continue;
  }

  if (inTasksTable && line.startsWith('|')) {
    const parts = line.split('|').map(p => p.trim()).filter(p => p);

    if (parts.length >= 9) {
      const [num, status, bereich, beschreibung, prio, mvp, deps, spec, imp] = parts;

      tasks.push({
        num,
        status,
        bereich,
        beschreibung,
        prio,
        mvp,
        deps,
        spec,
        imp
      });
    }
  }
}

// For each architecture doc, find tasks that reference it
archDocs.forEach(docName => {
  const docPath = join(__dirname, '../docs/architecture', docName);

  // Find tasks that reference this doc in the Spec column
  const relevantTasks = tasks.filter(task => {
    return task.spec.includes(docName);
  });

  if (relevantTasks.length === 0) {
    console.log(`${docName}: No tasks found`);
    return;
  }

  // Read current doc content
  let content = readFileSync(docPath, 'utf-8');

  // Check if Tasks section already exists
  if (content.match(/^## Tasks$/m)) {
    console.log(`${docName}: Tasks section already exists, skipping`);
    return;
  }

  // Build the Tasks section
  let tasksSection = '\n\n## Tasks\n\n';
  tasksSection += '| # | Beschreibung | Prio | MVP? | Deps | Referenzen |\n';
  tasksSection += '|--:|--------------|:----:|:----:|------|------------|\n';

  relevantTasks.forEach(task => {
    // Extract other doc references from spec column
    const specMatch = task.spec.match(/\[([^\]]+)\]\(([^)]+)\)/);
    let referenzen = '-';

    if (specMatch) {
      const [fullMatch, linkText, linkUrl] = specMatch;

      // Only add to Referenzen if it references a different doc (not the home doc)
      // For architecture docs, the home doc is the one we're adding to
      const isHomeDocs = linkUrl.includes(docName);

      if (!isHomeDocs) {
        referenzen = `[${linkText}](${linkUrl})`;
      }
    }

    tasksSection += `| ${task.num} | ${task.beschreibung} | ${task.prio} | ${task.mvp} | ${task.deps} | ${referenzen} |\n`;
  });

  // Append to the end of the file
  content = content.trimEnd() + tasksSection;

  // Write back
  writeFileSync(docPath, content, 'utf-8');
  console.log(`${docName}: Added ${relevantTasks.length} tasks`);
});

console.log('\nDone!');
