import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { seedE2E01, digest } from './atlas-e2e01-fixture.mjs';

export const fixtureVersion = 'e2e02-desktop-v1';
export const notes = '  Der Salzsteg bleibt bewacht.\r\nMira führt die Laterne.  ';
export const recipeHash = digest(
  JSON.stringify({
    fixtureVersion,
    base: 'e2e01-desktop-v2',
    notes,
    heroes: ['Mira', 'Borin', 'Siv'],
    initialXp: 0,
    opponents: [
      ['guard', 2, true],
      ['wolf', 1, false],
    ],
  }),
);

export function seedE2E02(CampaignStore, profile) {
  const base = seedE2E01(CampaignStore, profile),
    store = new CampaignStore(path.join(profile, 'workbench.sqlite'));
  try {
    const w = store.activate(base.a),
      command = (action) => ({
        commandId: randomUUID(),
        campaignId: base.a,
        token: w.token,
        action,
      }),
      heroes = [];
    for (const name of ['Mira', 'Borin', 'Siv']) {
      const hero = store.executeLive(
          command({ kind: 'create-character', profile: { name } }),
        ).character,
        live = store.live(w.token);
      store.executeLive(
        command({
          kind: 'membership',
          characterId: hero.id,
          expectedRevision: hero.membershipRevision,
          expectedRosterRevision: live.rosterRevision,
          active: true,
          targetSceneId: null,
          expectedFocusRevision: null,
        }),
      );
      heroes.push({ id: hero.id, name });
      store.executeProgress(
        command({
          kind: 'xp',
          characterId: hero.id,
          expectedRevision: 0,
          mode: 'set',
          amount: 0,
          reason: 'E2E-02 bekannter Start',
        }),
      );
    }
    const plan = store.encounterPlan(w.token, base.planId),
      wolf = store.catalogReference('creature', 'wolf');
    store.saveEncounterPlan({
      ...command(null),
      expectedRevision: plan.revision,
      plan: {
        ...plan,
        entries: [
          ...plan.entries,
          { id: randomUUID(), creatureId: 'wolf', count: 1, grouped: false },
        ],
        sourceReferences: [...plan.sourceReferences, wolf],
        party: heroes.map((h) => ({ ...h, level: 1, count: 1 })),
      },
    });
    const sessionPlanId = randomUUID(),
      visitId = randomUUID();
    store.changePreparation({
      ...command(null),
      change: {
        kind: 'plan',
        expectedRevision: null,
        plan: {
          version: 1,
          id: sessionPlanId,
          revision: 1,
          name: 'E2E-02 Salzsteg',
          scenes: [
            { id: visitId, title: 'E2E-02 Wache am Salzsteg', notes, locationId: base.locationId },
          ],
        },
      },
    });
    assert.equal(store.live(w.token).scene, null);
    return {
      ...base,
      version: fixtureVersion,
      recipeHash,
      baseRecipeHash: base.recipeHash,
      heroes,
      sessionPlanId,
      visitId,
    };
  } finally {
    store.close();
  }
}

/** Read raw persisted rows, independently of the renderer and Store projections. */
export function readE2E02(file, campaignId) {
  const Database = createRequire(import.meta.url)('better-sqlite3'),
    db = new Database(file, { readonly: true });
  try {
    const tables = [
      'campaign',
      'plan',
      'planned_visit',
      'session_profile',
      'session_visit',
      'prepared_group',
      'encounter_plan',
      'location',
      'roster_state',
      'roster_member',
      'character_profile',
      'live_state',
      'live_scene',
      'scene_clock',
      'scene_lifecycle',
      'scene_adoption',
      'live_scene_extra',
      'scene_opponent_group',
      'scene_time_step',
      'combat',
      'chase',
      'character_progress',
      'progress_event',
      'treasure',
      'character_ledger',
      'combat_award',
      'receipt',
      'combat_receipt',
      'chase_receipt',
      'progress_receipt',
    ];
    const rows = Object.fromEntries(
      tables.map((table) => [
        table,
        db
          .prepare(
            'SELECT * FROM "' +
              table +
              '" WHERE ' +
              (table === 'campaign' ? 'id' : 'campaign_id') +
              '=?',
          )
          .all(campaignId)
          .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      ]),
    );
    rows.live_receipt = db
      .prepare(
        'SELECT l.* FROM live_receipt l JOIN receipt r USING(command_id) WHERE r.campaign_id=? ORDER BY l.command_id',
      )
      .all(campaignId);
    return rows;
  } finally {
    db.close();
  }
}

export function preparationRows(state) {
  return Object.fromEntries(
    [
      'plan',
      'planned_visit',
      'session_profile',
      'session_visit',
      'prepared_group',
      'encounter_plan',
      'location',
    ].map((table) => [table, state[table]]),
  );
}
