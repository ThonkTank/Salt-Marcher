import test from 'node:test';
import assert from 'node:assert/strict';
import {
  requiredE2E01Scenarios,
  assertE2E01Scenarios,
} from '../../tools/atlas-e2e01-scenarios.mjs';
function report() {
  const source = 'a'.repeat(40),
    seedDatabaseHash = 'b'.repeat(64),
    recipeHash = 'c'.repeat(64);
  return {
    source,
    buildInfo: { commit: source },
    seedDatabaseHash,
    fixture: { recipeHash },
    scenarios: requiredE2E01Scenarios.map((id) => ({
      id,
      status: 'passed',
      build: source,
      fixtureHash: seedDatabaseHash,
      fixtureRecipeHash: recipeHash,
      storage: true,
      visible: true,
    })),
  };
}
test('E2E-01 machine catalogue requires every native case on the same source, build and fixture', () => {
  assert.doesNotThrow(() => assertE2E01Scenarios(report()));
  for (const mutate of [
    (r) => r.scenarios.pop(),
    (r) => {
      r.scenarios[0].status = 'skipped';
    },
    (r) => {
      r.scenarios[0].build = 'd'.repeat(40);
    },
    (r) => {
      r.scenarios[0].fixtureHash = 'd'.repeat(64);
    },
    (r) => {
      r.scenarios[0].fixtureRecipeHash = 'd'.repeat(64);
    },
    (r) => {
      r.scenarios[0].storage = false;
    },
    (r) => {
      r.scenarios[0].visible = false;
    },
    (r) => {
      r.scenarios[1] = structuredClone(r.scenarios[0]);
    },
    (r) => {
      r.buildInfo.commit = 'd'.repeat(40);
    },
  ]) {
    const r = report();
    mutate(r);
    assert.throws(() => assertE2E01Scenarios(r));
  }
});
