import assert from 'node:assert/strict';

export const requiredE2E01Scenarios = [
  'E01-01-fixture',
  'E01-02-history',
  'E01-03-context',
  'E01-04-fresh',
  'E01-05-confirmed-crash',
  'E01-06-complete',
  'E01-07-versioned-references',
  'E01-N01-context-camera-focus',
  'E01-N02-late-load',
  'E01-N03-held-write-switch-fence',
  'E01-N03b-late-write-after-owner-change',
  ...[
    'foreign-campaign',
    'stale-campaign',
    'foreign-world',
    'stale-world',
    'foreign-location',
    'stale-location',
  ].map((s) => 'E01-N04-' + s),
  'E01-N05-lost-commit-reconcile',
  ...['missing-source', 'unknown-source', 'source-version', 'unavailable-source'].map(
    (s) => 'E01-N06-' + s,
  ),
];
export function assertE2E01Scenarios(report) {
  assert.equal(
    report.buildInfo.commit,
    report.source,
    'Every scenario must belong to the same exact source SHA',
  );
  assert.match(report.seedDatabaseHash, /^[a-f0-9]{64}$/);
  assert.match(report.fixture.recipeHash, /^[a-f0-9]{64}$/);
  assert.equal(
    report.scenarios.length,
    requiredE2E01Scenarios.length,
    'No missing, duplicate or extra mandatory scenario',
  );
  for (const id of requiredE2E01Scenarios) {
    const cases = report.scenarios.filter((s) => s.id === id);
    assert.equal(cases.length, 1, 'Required native scenario ' + id);
    const scenario = cases[0];
    assert.equal(scenario.status, 'passed', 'Missing/skipped/failed native scenario ' + id);
    assert.equal(scenario.build, report.source, 'Different source build in ' + id);
    assert.equal(
      scenario.fixtureHash,
      report.seedDatabaseHash,
      'Different fixture foundation in ' + id,
    );
    assert.equal(
      scenario.fixtureRecipeHash,
      report.fixture.recipeHash,
      'Different fixture recipe in ' + id,
    );
    assert.equal(scenario.storage, true, 'Independent storage evidence missing in ' + id);
    assert.equal(scenario.visible, true, 'Visible native evidence missing in ' + id);
  }
}
