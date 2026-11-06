import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, unlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { responsibilities, rendererEntries } from '../../tools/module-responsibilities.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  moduleEdges,
  dependencyGraph,
  dependencyCycles,
  moduleGraphReport,
  readModuleSources,
} from '../../tools/module-graph.mjs';
import { repositoryFiles } from '../../tools/repository-files.mjs';
import { checkSourceModuleBoundaries } from '../../tools/check-module-boundaries.mjs';

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

test('report distinguishes declared and value cycles and counts only edges within a component', () => {
  const sources = new Map(
    Object.entries({
      'src/app/a.ts': "import type { B } from './b'; import './leaf'; import 'external';",
      'src/app/b.ts': "export * from './a';",
      'src/app/leaf.ts': '',
      'src/app/self.ts': "require('./self');",
      'src/legacy/old.ts': "import './old';",
    }),
  );
  const report = moduleGraphReport(sources);
  assert.deepEqual(report.declared.activeCycles, { components: 2, files: 3, internalEdges: 3 });
  assert.deepEqual(report.values.activeCycles, { components: 1, files: 1, internalEdges: 1 });
  assert.equal(report.declared.internalEdges, 5);
  assert.equal(report.declared.externalEdges, 1);
  assert.equal(report.values.internalEdges, 4);
  assert.deepEqual(report.declared.cyclicComponents.at(-1), {
    files: ['src/legacy/old.ts'],
    internalEdges: 1,
    active: false,
  });
  assert.deepEqual(moduleGraphReport(new Map([...sources].reverse())), report);
  const changed = new Map(sources).set('src/app/leaf.ts', '// changed source');
  assert.notEqual(moduleGraphReport(changed).scope.sourceSha256, report.scope.sourceSha256);
});

test('report CLI shares boundary source selection, including untracked sources and excluding ignored or deleted files', (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'module-report-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (file, text) => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), text);
  };
  execFileSync('git', ['init', '--quiet'], { cwd: root });
  write('.gitignore', 'src/app/ignored.ts\n.build/\n');
  write('src/app/workspace/renderer.ts', "import './added';");
  write('src/app/workspace/added.ts', "import 'node:fs';");
  write('src/app/ignored.ts', "import 'node:fs';");
  write('src/app/contract.d.ts', 'export interface Contract {}');
  write('src/legacy/reference.ts', '');
  write('desktop/main.ts', '');
  write('src/app/view.tsx', '');
  write('src/app/deleted.ts', '');
  execFileSync(
    'git',
    ['add', '.gitignore', 'src/app/workspace/renderer.ts', 'src/app/deleted.ts'],
    { cwd: root },
  );
  unlinkSync(path.join(root, 'src/app/deleted.ts'));
  write('.build/generated.ts', '');
  write('tests/fixture.ts', '');
  write('tools/example.ts', '');
  write('src/app/metadata.json', '{}');
  const selected = readModuleSources(root, repositoryFiles(root));
  assert.deepEqual(
    [...selected.keys()],
    [
      'desktop/main.ts',
      'src/app/contract.d.ts',
      'src/app/view.tsx',
      'src/app/workspace/added.ts',
      'src/app/workspace/renderer.ts',
      'src/legacy/reference.ts',
    ],
  );
  assert(
    checkSourceModuleBoundaries(root, repositoryFiles(root)).some(
      (error) =>
        error.includes('Renderer crosses privileged boundary') &&
        error.includes('added.ts -> node:fs'),
    ),
  );
  const cli = JSON.parse(
    execFileSync(
      process.execPath,
      [fileURLToPath(new URL('../../tools/module-graph.mjs', import.meta.url)), '--report'],
      { cwd: root, encoding: 'utf8' },
    ),
  );
  assert.deepEqual(cli, moduleGraphReport(selected));
});

test('the complete active source graph has no declared or runtime cycles', () => {
  const report = moduleGraphReport(
    readModuleSources(process.cwd(), repositoryFiles(process.cwd())),
  );
  for (const graph of [report.declared, report.values]) {
    assert.deepEqual(graph.activeCycles, { components: 0, files: 0, internalEdges: 0 });
  }
});

test('landscape records and frozen brush data do not depend on samplers, brush execution or atlas APIs', () => {
  const sources = readModuleSources(process.cwd(), repositoryFiles(process.cwd())),
    graph = dependencyGraph(sources),
    implementations = new Set([
      'src/app/atlas/atlas-landscape.ts',
      'src/app/atlas/campaign-atlas-contracts.ts',
      'src/app/atlas/campaign-atlas-model.ts',
      'src/app/atlas/terrain-brush.ts',
      'src/app/atlas/terrain-form-brush.ts',
      'src/app/atlas/terrain-height.ts',
    ]);
  for (const contract of [
    'src/app/atlas/landscape-contracts.ts',
    'src/app/atlas/terrain-brush-contracts.ts',
    'src/app/atlas/terrain-view-contracts.ts',
  ]) {
    const visited = new Set();
    const visit = (file) => {
      if (visited.has(file)) return;
      visited.add(file);
      assert(!implementations.has(file), `${contract} depends on ${file}`);
      for (const target of graph.get(file) ?? []) visit(target);
    };
    visit(contract);
  }
});
