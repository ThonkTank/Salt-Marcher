import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertE2E02Scenarios,
  e2e02Qualification,
  requiredE2E02Scenarios,
} from '../../tools/live-e2e02-scenarios.mjs';

function report() {
  const source = 'a'.repeat(40),
    seedDatabaseHash = 'b'.repeat(64),
    recipeHash = 'c'.repeat(64);
  return {
    source,
    buildInfo: { commit: source },
    seedDatabaseHash,
    fixture: { recipeHash },
    scenarios: requiredE2E02Scenarios.map((id) => ({
      id,
      status: 'passed',
      build: source,
      fixtureHash: seedDatabaseHash,
      fixtureRecipeHash: recipeHash,
      storage: true,
      visible: true,
      evidence: ['snapshots.json#' + id],
    })),
  };
}

test('a successful live-game subset cannot qualify the complete E2E-02 gate', () => {
  assert.equal(e2e02Qualification(report()).technicalGate, 'passed');
  for (const mutate of [
    (r) => r.scenarios.pop(),
    (r) => (r.scenarios[1].status = 'missing-input'),
    (r) => (r.scenarios[2] = structuredClone(r.scenarios[0])),
    (r) => (r.scenarios[0].visible = false),
    (r) => (r.scenarios[0].storage = false),
    (r) => (r.scenarios[0].evidence = []),
    (r) => (r.scenarios[0].evidence = 'a-label-is-not-an-evidence-list'),
    (r) => (r.scenarios[0].evidence = ['']),
    (r) => (r.scenarios[0].fixtureHash = 'd'.repeat(64)),
    (r) => (r.scenarios[0].fixtureRecipeHash = 'd'.repeat(64)),
    (r) => (r.scenarios[0].build = 'd'.repeat(40)),
    (r) => (r.buildInfo.commit = 'd'.repeat(40)),
    (r) => {
      r.source = 'not-a-sha';
      r.buildInfo.commit = r.source;
    },
  ]) {
    const r = report();
    mutate(r);
    assert.throws(() => assertE2E02Scenarios(r));
    assert.equal(e2e02Qualification(r).technicalGate, 'open');
  }
});
