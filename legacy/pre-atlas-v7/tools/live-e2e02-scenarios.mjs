import assert from 'node:assert/strict';

// These are technical obligations, not owner, package or target-device acceptance.
// A successful subset must never silently become an E2E-02 PASS.
export const requiredE2E02Scenarios = Object.freeze([
  'E02-01-preparation-catalogue',
  'E02-02-immutable-initialize',
  'E02-03-independent-runtime',
  'E02-04-split-move-rejoin',
  'E02-05-focus-fail-closed',
  'E02-06-2014-group-individual',
  'E02-07-chase-combat',
  'E02-08-combat-progression',
  'E02-09-loot-reward-once',
  'E02-10-fresh-process',
  'E02-11-invalid-catalogue',
  'E02-12-publish-failure',
  'E02-13-reply-loss-retry',
  'E02-14-receipt-trace',
]);

export function assertE2E02Scenarios(report) {
  assert.match(report.source, /^[a-f0-9]{40}$/);
  assert.equal(report.buildInfo.commit, report.source, 'Exact source/build binding required');
  assert.match(report.seedDatabaseHash, /^[a-f0-9]{64}$/);
  assert.match(report.fixture.recipeHash, /^[a-f0-9]{64}$/);
  assert.deepEqual(
    report.scenarios.map((s) => s.id).sort(),
    [...requiredE2E02Scenarios].sort(),
    'Every E2E-02 obligation must occur exactly once',
  );
  for (const scenario of report.scenarios) {
    assert.equal(scenario.status, 'passed', scenario.id);
    assert.equal(scenario.build, report.source, scenario.id);
    assert.equal(scenario.fixtureHash, report.seedDatabaseHash, scenario.id);
    assert.equal(scenario.fixtureRecipeHash, report.fixture.recipeHash, scenario.id);
    assert.equal(scenario.storage, true, scenario.id);
    assert.equal(scenario.visible, true, scenario.id);
    assert(
      Array.isArray(scenario.evidence) &&
        scenario.evidence.length > 0 &&
        scenario.evidence.every((e) => typeof e === 'string' && e.trim()),
      scenario.id + ' needs concrete evidence',
    );
  }
}

export function e2e02Qualification(report) {
  try {
    assertE2E02Scenarios(report);
    return { technicalGate: 'passed', open: [] };
  } catch (error) {
    const open = requiredE2E02Scenarios.filter(
      (id) => report.scenarios.filter((s) => s.id === id && s.status === 'passed').length !== 1,
    );
    // An invalid binding is also a failure even if every status claims success.
    return { technicalGate: 'open', open, failure: error.message };
  }
}
