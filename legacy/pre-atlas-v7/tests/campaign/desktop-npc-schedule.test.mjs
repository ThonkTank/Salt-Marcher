import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';

buildSync({
  entryPoints: ['src/app/campaign/npc-daily-plan.ts'],
  outfile: '.build/npc-schedule.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { dailyPlanAt } = createRequire(import.meta.url)('../../.build/npc-schedule.cjs');
const dayMs = 86400_000;
const slot = (id, weekdays, startMinute = 480) => ({
  id,
  startMinute,
  endMinute: startMinute + 60,
  activity: id,
  place: 'other',
  notes: '',
  ...(weekdays ? { weekdays } : {}),
});
const rest = (day) => ({ day: String(day), label: 'Ruhetag', slots: [] });

test('a cancelled weekly visit resumes after the skipped week', () => {
  const market = slot('Markt', [0], 0);
  const result = dailyPlanAt([market], '0', 86400, 7, [rest(8)]);
  assert.deepEqual(result.current, market);
  assert.deepEqual(result.next, market);
  assert.equal(result.nextDay, '15');
  assert.equal(result.nextInstantMs, String(14 * dayMs));
  assert.equal(result.secondsUntilNext, 14 * 86400);
});

for (const week of [1, 7, 100])
  test(`all 64 cancelled occurrences still have a next visit in a ${week}-day week`, () => {
    const market = slot('Markt', [0], 0),
      exceptions = Array.from({ length: 64 }, (_, i) => rest((i + 1) * week + 1));
    const result = dailyPlanAt([market], '0', 86400, week, exceptions);
    assert.equal(result.nextDay, String(65 * week + 1));
    assert.deepEqual(result.next, market);
  });

test('remaining starts today, alternative weekdays and exception activities compete by actual time', () => {
  const early = slot('Früh', [0], 60),
    late = slot('Spät', [0], 600),
    other = slot('Anderer Tag', [3], 480);
  const exceptions = [
    rest(8),
    { day: '10', label: 'Sondermarkt', slots: [slot('Sondermarkt', undefined, 900)] },
  ];
  assert.equal(
    dailyPlanAt([early, late, other], String(120 * 60000), 86400, 7, exceptions).next.id,
    late.id,
  );
  assert.equal(
    dailyPlanAt([early, late, other], String(700 * 60000), 86400, 7, exceptions).next.id,
    other.id,
  );
  const afterOther = dailyPlanAt(
    [early, late, other],
    String(3 * dayMs + 700 * 60000),
    86400,
    7,
    exceptions,
  );
  assert.equal(afterOther.next.id, 'Sondermarkt');
  assert.equal(afterOther.nextDay, '10');
});

test('distant one-off dates do not require walking the intervening calendar', () => {
  const unique = {
    day: '999999999999',
    label: 'Einmaliger Besuch',
    slots: [slot('Besuch', undefined)],
  };
  const result = dailyPlanAt([], '0', 86400, 7, [unique]);
  assert.equal(result.nextDay, unique.day);
  assert.equal(result.next.id, 'Besuch');
  assert.equal(dailyPlanAt([], result.nextInstantMs, 86400, 7, [unique]).next, null);
});

test('rest days suppress the previous night and future regular overnight visits remain discoverable', () => {
  const night = { ...slot('Nachtwache', [0], 1380), endMinute: 120 };
  const result = dailyPlanAt([night], String(dayMs + 30 * 60000), 86400, 7, [
    rest(2),
    rest(8),
    rest(15),
  ]);
  assert.equal(result.current, null);
  assert.equal(result.overrideLabel, 'Ruhetag');
  assert.equal(result.nextDay, '22');
  assert.deepEqual(result.next, night);
});

test('next starts agree with exhaustive calendar enumeration across sparse weekly cancellations', () => {
  // Independent oracle enumerates actual days, including rest/replacement days.
  for (const week of [2, 7, 13])
    for (let seed = 0; seed < 15; seed++) {
      const plan = [slot('A', [seed % week], 60), slot('B', [(seed + 1) % week], 600)];
      const exceptions = Array.from({ length: 12 }, (_, i) => ({
        day: String(2 + i * week),
        label: 'Ausnahme',
        slots: i % 3 === 0 ? [slot('E' + i, undefined, 900)] : [],
      }));
      const byDay = new Map(exceptions.map((o) => [Number(o.day) - 1, o.slots]));
      for (const now of [0, 60 * 60000, dayMs + 700 * 60000, 20 * dayMs]) {
        let expected = null;
        for (let d = Math.floor(now / dayMs); d < 200; d++) {
          for (const s of byDay.get(d) ?? plan.filter((s) => s.weekdays.includes(d % week))) {
            const at = d * dayMs + s.startMinute * 60000;
            if (at > now && (!expected || at < expected.at)) expected = { at, id: s.id };
          }
        }
        const result = dailyPlanAt(plan, String(now), 86400, week, exceptions);
        assert.equal(result.problem, null);
        assert.equal(result.nextInstantMs, String(expected.at));
        assert.equal(result.next.id, expected.id);
      }
    }
});
