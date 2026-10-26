import { existsSync } from 'node:fs';
import { responsibilities, rendererEntries } from '../../tools/module-responsibilities.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { moduleEdges, dependencyGraph, dependencyCycles } from '../../tools/module-graph.mjs';

test('type-only edges are distinguished without losing mixed/default value imports', () => {
  const edges = moduleEdges(
    'a.ts',
    `
    import type { A } from './a'; import { type B } from './b';
    import value, { type C } from './c'; import { d, type D } from './d';
    export type { E } from './e'; export { type F } from './f';
    type G = import('./g').G; const load = () => import('./h');
  `,
  );
  assert.deepEqual(
    edges.filter((e) => e.typeOnly).map((e) => e.specifier),
    ['./a', './b', './e', './f', './g'],
  );
  assert.deepEqual(
    edges.filter((e) => !e.typeOnly).map((e) => e.specifier),
    ['./c', './d', './h'],
  );
});
test('cycle analysis follows JS spellings, reexports, self loops and disconnected components', () => {
  const sources = new Map(
    Object.entries({
      'a.ts': "import type { B } from './b.js';",
      'b.ts': "export * from './a';",
      'c.ts': "require('./c');",
      'd.ts': "import './leaf';",
      'leaf.ts': '',
    }),
  );
  assert.deepEqual(dependencyCycles(dependencyGraph(sources)), [['a.ts', 'b.ts'], ['c.ts']]);
  assert.deepEqual(dependencyCycles(dependencyGraph(sources, true)), [['c.ts']]);
});

test('declared owners and renderer entries name existing source files without ambiguous owners', () => {
  const files = Object.values(responsibilities).flatMap((owner) => owner.files ?? []);
  assert.equal(new Set(files).size, files.length);
  for (const file of [...files, ...rendererEntries]) assert(existsSync(file), file);
});
