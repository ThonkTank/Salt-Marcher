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
test('cycles terminate and pure domain imports remain allowed', () => {
  assert.deepEqual(
    check({
      'src/app/workspace/renderer.ts': "import '../shared/contracts';",
      'src/app/shared/contracts.ts': "import '../campaign/model';",
      'src/app/campaign/model.ts': "import '../shared/contracts';",
    }),
    [],
  );
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
