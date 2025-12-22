#!/usr/bin/env node

import { readFileSync } from 'fs';
import { ROADMAP_PATH, parseRoadmap } from './task-utils.mjs';

const roadmapContent = readFileSync(ROADMAP_PATH, 'utf-8');

// Parse tasks using shared parseRoadmap
const { tasks } = parseRoadmap(roadmapContent, { separateBugs: true });

// Group by spec file
const tasksBySpec = new Map();

for (const task of tasks) {
  if (!task.spec || task.spec === '-') continue;

  // Extract just the filename (no path, no anchor)
  const specMatch = task.spec.match(/\[([^\]]+\.md)/i);
  if (!specMatch) continue;

  const filename = specMatch[1].split('/').pop();

  if (!tasksBySpec.has(filename)) {
    tasksBySpec.set(filename, []);
  }

  tasksBySpec.get(filename).push({
    num: task.number,
    status: task.status,
    bereich: task.bereich,
    beschreibung: task.beschreibung,
    prio: task.prio,
    mvp: task.mvp,
    deps: task.depsRaw,
    spec: task.spec,
    imp: task.imp
  });
}

// Output as JSON
console.log(JSON.stringify(Object.fromEntries(tasksBySpec), null, 2));
