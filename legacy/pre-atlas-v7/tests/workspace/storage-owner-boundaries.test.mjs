import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dependencyGraph, dependencyCycles } from '../../tools/module-graph.mjs';
import { checkModuleBoundaries } from '../../tools/check-module-boundaries.mjs';
import { storageFoundations, storageCommandOwners } from '../../tools/storage-owner-boundaries.mjs';

const sources = new Map(
  ['src', 'desktop'].flatMap((root) =>
    readdirSync(root, { recursive: true })
      .filter((file) => /\.tsx?$/.test(file))
      .map((file) => [`${root}/${file}`, readFileSync(`${root}/${file}`, 'utf8')]),
  ),
);

test('domain storage has no runtime cycles', () => {
  const cycles = dependencyCycles(dependencyGraph(sources, true)).filter((cycle) =>
    cycle.some((file) => file.startsWith('src/app/storage/')),
  );
  assert.deepEqual(cycles, []);
});

test('actual readers and local records cannot return to facades or command owners', () => {
  const violations = checkModuleBoundaries(sources).filter((error) =>
    error.startsWith('Storage foundation imports a command owner'),
  );
  assert.deepEqual(violations, []);
});

for (const owner of storageFoundations)
  test(`${owner} rejects an indirect back import, including a re-export`, () => {
    for (const target of storageCommandOwners) {
      const bridge = 'src/app/storage/foundation-test-bridge.ts';
      const graph = new Map([
        [owner, "export * from './foundation-test-bridge';"],
        [bridge, `export * from './${target.split('/').at(-1).replace(/\.ts$/, '')}';`],
        [target, 'export const marker = 1;'],
      ]);
      assert(
        checkModuleBoundaries(graph).some((error) =>
          error.startsWith('Storage foundation imports a command owner'),
        ),
        `${owner} -> ${target}`,
      );
    }
  });
