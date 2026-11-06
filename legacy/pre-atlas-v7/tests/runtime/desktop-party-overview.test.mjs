import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
buildSync({
  entryPoints: ['src/app/runtime/party-overview.ts'],
  outfile: '.build/party-overview.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const require = createRequire(import.meta.url),
  {
    partyRestOverview,
    partyQuickFacts,
    checkedPartyQuickFields,
    characterRestHint,
  } = require('../../.build/party-overview.cjs');
const progress = (xp, longXp, baseline = 0, sections = 0, known = true) => ({
  xp,
  rest: { longXp, shortXp: longXp, baseline, sections, known },
});
test('Party rest average uses remaining frames without budget weighting, excludes unknown and only shares equal marks', () => {
  const first = progress(0, 60),
    second = progress(300, 360, 120, 1),
    unknown = progress(null, 0);
  const all = partyRestOverview([first, second, unknown, undefined]);
  assert.equal(all.fill, 0.35);
  assert.equal(all.sections, null);
  assert.equal(all.included, 2);
  assert.equal(all.total, 4);
  assert.equal(all.partial, true);
  assert.equal(partyRestOverview([first, progress(300, 120)]).sections, 3);
  assert.equal(partyRestOverview([undefined, unknown]).fill, null);
  assert.equal(partyRestOverview([]).fill, null);
  assert.equal(partyRestOverview([progress(0, 500)]).fill, 1);
  assert.match(characterRestHint(progress(0, 500)), /500.*300.*Lange Rast fällig/);
  assert.equal(partyRestOverview([progress(0, 60, 0, 0, false)]).fill, null);
  assert.match(characterRestHint(progress(0, 60, 0, 0, false)), /nicht verlässlich.*60/);
});
test('all ten optional quick values are selectable and unknowns never invent zero or level one', () => {
  const c = {
    profile: { name: 'Gleichnamig', speedFeet: 0, languages: ['Elbisch', 'Gemeinsprache'] },
  };
  assert.deepEqual(
    partyQuickFacts(c, undefined, ['armorClass', 'level', 'speedFeet', 'languages']).map(
      (v) => v.value,
    ),
    ['offen', 'offen', '0 ft', 'Elbisch, Gemeinsprache'],
  );
  assert.deepEqual(
    partyQuickFacts(c, progress(355000, 0), ['level']).map((v) => v.value),
    ['20'],
  );
  assert.deepEqual(checkedPartyQuickFields(['languages', 'level']), ['level', 'languages']);
  assert.deepEqual(checkedPartyQuickFields([]), []);
  assert.throws(() => checkedPartyQuickFields(['level', 'level']));
  assert.throws(() => checkedPartyQuickFields(['hp']));
});
