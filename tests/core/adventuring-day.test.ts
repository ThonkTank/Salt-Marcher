import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CampaignStore } from "../../src/app/storage/store";
import { calculateDay } from "../../src/app/adventuring-day-model";

function fixture(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), "day-preview-")),
    store = new CampaignStore(join(root, "campaign.sqlite"));
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  const campaign = store.create("Tagesprognose"),
    token = store.activate(campaign.id).token;
  let rosterRevision = 0;
  const add = (name: string, xp?: number) => {
    const character = store.executeLive({
      commandId: randomUUID(),
      campaignId: campaign.id,
      token,
      action: { kind: "create-character", profile: { name } },
    }).character!;
    rosterRevision++;
    store.executeLive({
      commandId: randomUUID(),
      campaignId: campaign.id,
      token,
      action: {
        kind: "membership",
        characterId: character.id,
        expectedRevision: 0,
        expectedRosterRevision: rosterRevision,
        active: true,
        targetSceneId: null,
        expectedFocusRevision: null,
      },
    });
    rosterRevision++;
    if (xp !== undefined)
      store.executeProgress({
        commandId: randomUUID(),
        campaignId: campaign.id,
        token,
        action: {
          kind: "xp",
          characterId: character.id,
          expectedRevision: 0,
          mode: "set",
          amount: xp,
          reason: "Bestätigter Stand",
        },
      });
  };
  return { store, token, add };
}
test("active day forecasts use actual XP while custom rows use starting levels, without awarding XP or confirming rests", (t) => {
  const x = fixture(t);
  x.add("Ada", 290);
  x.add("Nia", 600);
  const before = x.store.progress(x.token),
    active = x.store.adventuringDay(x.token, {
      source: "active",
      rows: [],
      totalXp: 1200,
      rewardXp: 51,
    });
  assert.equal(active.snapshot.available, true);
  assert.equal(active.calculation?.dailyBudget, 900);
  assert.deepEqual(
    active.calculation?.projections.map((p) => [
      p.name,
      p.beforeXp,
      p.afterXp,
      p.afterLevel,
    ]),
    [
      ["Ada", 290, 316, 2],
      ["Nia", 600, 626, 2],
    ],
  );
  assert.deepEqual(
    [active.calculation?.shortRests, active.calculation?.longRests],
    [3, 1],
  );
  const custom = x.store.adventuringDay(x.token, {
    source: "custom",
    rows: [{ level: 1, count: 2 }],
    totalXp: 1200,
    rewardXp: 51,
  });
  assert.equal(custom.calculation?.dailyBudget, 600);
  assert.equal(custom.calculation?.projections[0]?.beforeXp, 0);
  assert.deepEqual(x.store.progress(x.token), before);
});
test("a character without confirmed XP blocks active forecasts but allows explicit custom rows", (t) => {
  const x = fixture(t);
  x.add("Offenes Level");
  const active = x.store.adventuringDay(x.token, {
    source: "active",
    rows: [],
    totalXp: 300,
  });
  assert.equal(active.snapshot.averageLevel, null);
  assert.equal(active.calculation, null);
  assert.match(active.problem!, /fehlen Level/);
  const custom = x.store.adventuringDay(x.token, {
    source: "custom",
    rows: [{ level: 1, count: 1 }],
    totalXp: 300,
  });
  assert.equal(custom.problem, null);
  assert.equal(custom.calculation?.longRests, 1);
});
test("very long day forecasts collapse the timeline while retaining total rest counts", () => {
  const result = calculateDay([{ level: 1, count: 1 }], 300 * 100 + 200, 0);
  assert.equal(result.completedDays, 100);
  assert.equal(result.shortRests, 202);
  assert.equal(result.longRests, 100);
  assert.equal(result.timeline.length, 94);
  assert.equal(result.timeline.at(-1)?.xp, 30200);
  assert.equal(result.shareXp, 0);
});
