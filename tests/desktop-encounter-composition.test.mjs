import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { parseHTML } from './helpers/dom.mjs';
buildSync({
  entryPoints: ['src/app/encounter-composition-ui.ts'],
  outfile: '.build/encounter-composition.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { renderEncounterComposition } = createRequire(import.meta.url)(
  '../.build/encounter-composition.cjs',
);
test('composition displays saved blocks, XP fit counts and soft distances without treating blocks as live groups', () => {
  const { document } = parseHTML('<html><body><main></main></body></html>');
  global.document = document;
  const composition = {
      blocks: [
        { role: 'boss', challengeRating: '3', quantity: 1, statblockSlots: 1 },
        { role: 'minion', challengeRating: '1/4', quantity: 4, statblockSlots: 2 },
      ],
      metrics: {
        adjustedXp: 1100,
        xpDelta: 100,
        monsterCount: 7,
        statblockCount: 4,
        initiativeSlots: 6,
        effectiveMonsterCount: 4.121320343559643,
        xpMultiplier: 2.5,
      },
      diagnostics: [
        {
          constraint: 'initiativeSlots',
          value: 6,
          minimum: 2,
          maximum: 4,
          normalizedDistance: 0.5,
        },
      ],
      candidateCount: 123,
      fitCandidateCount: 3,
    },
    before = JSON.stringify(composition),
    root = document.querySelector('main');
  renderEncounterComposition(
    root,
    composition,
    { amount: 'many', balance: 'varied', diversity: 'high' },
    true,
  );
  assert.equal(JSON.stringify(composition), before);
  assert.match(root.textContent, /3 von 123/);
  assert.match(root.textContent, /Ziel 1000/);
  assert.match(root.textContent, /Ergebnis 1100/);
  assert.match(root.textContent, /0\.500/);
  assert.match(root.textContent, /XP-Multiplikator ×2,5 für 7 Gegner/);
  assert.doesNotMatch(root.textContent, /Gewichtete Gegnerzahl/);
  assert.match(root.textContent, /feste Gegner und Ergänzung gemeinsam/);
  assert.equal(root.querySelectorAll('tbody tr').length, 2);
  assert.deepEqual(
    [...root.querySelectorAll('tbody tr:first-child td')].map((n) => n.textContent),
    ['Boss', '3', '1', '1'],
  );
  assert.match(root.textContent, /Statblock-Vielfalt: Viele verschiedene/);
  assert.doesNotMatch(root.textContent, /Gruppe/);
  const expected = root.textContent,
    current = structuredClone(composition);
  delete current.metrics.effectiveMonsterCount;
  root.replaceChildren();
  renderEncounterComposition(
    root,
    current,
    { amount: 'many', balance: 'varied', diversity: 'high' },
    true,
  );
  assert.equal(root.textContent, expected);
  assert.equal(JSON.stringify(composition), before);
  root.replaceChildren();
  renderEncounterComposition(root, undefined);
  assert.match(root.textContent, /keine strukturierten/);
  assert.equal(root.querySelector('table'), null);
});
