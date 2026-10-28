import test from 'node:test';
import assert from 'node:assert/strict';
import { checkModuleBoundaries, moduleImports } from '../../tools/check-module-boundaries.mjs';

const check = (files) => checkModuleBoundaries(new Map(Object.entries(files)));
test('module edges include type imports, lazy loads, require and re-exports, but not comments', () => {
  assert.deepEqual(
    moduleImports(
      'test.ts',
      `
    // import 'fake';
    import type { A } from './types'; export { value } from './values';
    const load = () => import('./lazy'); const data = require('./data');
    type T = import('./contract').T; import legacy = require('./equals');
  `,
    ),
    ['./types', './values', './lazy', './data', './contract', './equals'],
  );
});
for (const target of ['src/app/storage/store.ts', 'desktop/main.ts'])
  test(`renderer rejects an indirect dependency on ${target}`, () => {
    const errors = check({
      'src/app/workspace/renderer.ts': "import('../atlas/bridge');",
      'src/app/atlas/bridge.ts': `export * from '${target.startsWith('desktop') ? '../../../desktop/main' : '../storage/store'}';`,
      [target]: 'export const value = 1;',
    });
    assert(
      errors.some(
        (error) => error.includes('Renderer crosses privileged boundary') && error.includes(target),
      ),
    );
  });
for (const module of ['node:fs/promises', 'fs', 'electron', 'better-sqlite3'])
  test(`renderer rejects privileged module ${module}`, () => {
    assert.equal(check({ 'src/app/workspace/renderer.ts': `import '${module}';` }).length, 1);
  });
test('shared logic rejects UI through a re-export while shared controls may use DOM helpers', () => {
  assert.equal(
    check({
      'src/app/shared/dice-formula.ts': "export * from '../catalog/bridge';",
      'src/app/catalog/bridge.ts': "export * from './items-ui';",
      'src/app/catalog/items-ui.ts': '',
    }).length,
    1,
  );
  assert.deepEqual(
    check({
      'src/app/shared/booking-dialog.ts': "import './anchored-popup';",
      'src/app/shared/anchored-popup.ts': '',
    }),
    [],
  );
});
test('active desktop code rejects legacy through pure-code intermediaries', () => {
  assert(
    check({
      'desktop/main.ts': "import '../src/features/bridge';",
      'src/features/bridge.ts': "export * from '../legacy/obsidian/main';",
      'src/legacy/obsidian/main.ts': '',
    }).some((error) => error.includes('Active code imports historical adapter')),
  );
});
test('new cycles are rejected even when every module is pure', () => {
  const errors = check({
    'src/app/workspace/renderer.ts': "import '../shared/contracts';",
    'src/app/shared/contracts.ts': "import '../campaign/model';",
    'src/app/campaign/model.ts': "import '../shared/contracts';",
  });
  assert(errors.length >= 2);
  assert(errors.every((error) => error.startsWith('New cyclic dependency:')));
});

test('presentation checks do not depend only on a UI filename suffix', () => {
  assert.equal(
    check({
      'src/app/shared/dice-formula.ts': "import '../workspace/navigation';",
      'src/app/workspace/navigation.ts': "document.querySelector('nav');",
    }).length,
    1,
  );
});

test('a document payload parameter is not the browser document', () => {
  assert.deepEqual(
    check({
      'src/app/shared/literal-text-edit.ts': "import '../campaign/text-references';",
      'src/app/campaign/text-references.ts':
        'export function refs(document: any) { return document.gmNotes; }',
    }),
    [],
  );
});

test('explicit storage responsibility overrides the old preparation/live filename heuristic', () => {
  assert.deepEqual(
    check({
      'src/app/storage/preparation.ts': "import './live';",
      'src/app/storage/live.ts': '',
    }),
    [],
  );
});
for (const entry of ['src/app/shared/editor-session.ts', 'src/app/storage/preparation.ts'])
  test(`named owner rejects the combat presentation even without a UI suffix: ${entry}`, () => {
    assert(
      check({ [entry]: "import '../runtime/combat';", 'src/app/runtime/combat.ts': '' }).some(
        (error) => /imports.*(capability|presentation)/.test(error),
      ),
    );
  });
test('removed path and aggregate-contract cycles cannot be reintroduced', () => {
  for (const files of [
    {
      'src/app/atlas/path-model.ts': "import './spatial-3d';",
      'src/app/atlas/spatial-3d.ts': "import './path-spatial';",
      'src/app/atlas/path-spatial.ts': "import './path-model';",
    },
    {
      'src/app/shared/contracts.ts': "import type { A } from '../campaign/preparation-contracts';",
      'src/app/campaign/preparation-contracts.ts': "import type { B } from '../shared/contracts';",
    },
  ])
    assert(check(files).some((error) => error.startsWith('New cyclic dependency:')));
});
test('the removed key/surface runtime cycle cannot be reintroduced', () => {
  const files = {
    'src/app/storage/dungeon-key.ts': "import './surfaces';",
    'src/app/storage/surfaces.ts': "import './dungeon-key';",
  };
  assert(check(files).some((error) => error.endsWith('(values)')));
  assert.deepEqual(check({ ...files, 'src/app/storage/surfaces.ts': '' }), []);
});

test('an explicitly named domain owner cannot quietly acquire browser globals', () => {
  assert(
    check({ 'src/app/shared/editor-session.ts': "document.querySelector('main');" }).some((error) =>
      error.includes('Domain owner uses presentation globals'),
    ),
  );
});

for (const [name, forward, backward] of [
  [
    'named type imports',
    "import type { B } from './note-merge-contracts';",
    "import type { A } from './preparation-contracts';",
  ],
  [
    'type re-exports',
    "export type { B } from './note-merge-contracts';",
    "export type { A } from './preparation-contracts';",
  ],
  [
    'inline import types',
    "export type A = import('./note-merge-contracts').B;",
    "export type B = import('./preparation-contracts').A;",
  ],
])
  test(`removed note contracts reject cycles through ${name} but allow one-way contracts`, () => {
    const files = {
      'src/app/campaign/preparation-contracts.ts': forward,
      'src/app/campaign/note-merge-contracts.ts': backward,
    };
    const cycles = check(files).filter((error) => error.startsWith('New cyclic dependency:'));
    assert.equal(cycles.length, 2);
    assert(cycles.every((error) => error.endsWith('(declared)')));
    assert.deepEqual(
      check({ ...files, 'src/app/campaign/note-merge-contracts.ts': 'export interface B {}' }),
      [],
    );
  });
