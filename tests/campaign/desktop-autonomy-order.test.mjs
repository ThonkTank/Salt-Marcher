import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { buildSync } from 'esbuild';

buildSync({
  stdin: {
    contents:
      "export {CampaignStore} from './src/app/storage/store';export {newLocation} from './src/features/location/location-schema';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  outfile: '.build/autonomy-order.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
function observe() {
  const { CampaignStore, newLocation } = require(process.cwd() + '/.build/autonomy-order.cjs'),
    { mkdtempSync, rmSync } = require('node:fs'),
    { join } = require('node:path'),
    { randomUUID } = require('node:crypto'),
    assert = require('node:assert/strict');
  const root = mkdtempSync(join(process.cwd(), '.build/autonomy-order-')),
    file = join(root, 'campaign.sqlite');
  let store = new CampaignStore(file);
  try {
    const results = {};
    for (const mode of ['jobs', 'route']) {
      const campaign = store.create(mode);
      let w = store.activate(campaign.id);
      const cmd = (action) => ({
        commandId: randomUUID(),
        campaignId: campaign.id,
        token: w.token,
        action,
      });
      for (const id of ['start', 'destination', 'Z-place', 'a-place', 'elsewhere'])
        store.changePreparation({
          ...cmd(null),
          change: {
            kind: 'location',
            expectedRevision: null,
            document: newLocation(id, id, 'poi', [id + '-text', id + '-gm']),
          },
        });
      const actorId = randomUUID();
      store.changePreparation({
        ...cmd(null),
        change: {
          kind: 'note',
          expectedRevision: null,
          note: {
            version: 1,
            id: actorId,
            revision: 1,
            kind: 'npc',
            title: 'Wache',
            readAloud: 'Original\r\nText',
            gmNotes: '',
            relations: [],
            creatureId: null,
            deleted: false,
          },
        },
      });
      store.executeAutonomy(
        cmd({
          kind: 'actor',
          expectedRevision: null,
          initialLocationId: 'start',
          actor: {
            id: actorId,
            revision: 0,
            enabled: true,
            paused: false,
            role: '',
            needs: [],
            jobPriorities: {},
            assignedJobId: null,
            allowConflict: false,
            defense: 12,
            attackBonus: 0,
            maxHpLossPercent: 10,
            cursor: 0,
            offsetSeconds: 0,
            jobId: null,
            progressSeconds: 0,
            pending: null,
          },
        }),
      );
      if (mode === 'route')
        for (const [id, from, to] of [
          ['a-start-Z', 'start', 'Z-place'],
          ['b-start-a', 'start', 'a-place'],
          ['c-Z-destination', 'Z-place', 'destination'],
          ['d-a-destination', 'a-place', 'destination'],
        ])
          store.executeAutonomy(
            cmd({
              kind: 'route',
              expectedRevision: null,
              route: {
                id,
                revision: 0,
                name: id,
                fromLocationId: from,
                toLocationId: to,
                durationSeconds: 20,
                enabled: true,
              },
            }),
          );
      for (const id of mode === 'jobs' ? ['z-job', 'ä-job'] : ['move-job'])
        store.executeAutonomy(
          cmd({
            kind: 'job',
            expectedRevision: null,
            job: {
              id,
              revision: 0,
              name: id,
              kind: mode === 'jobs' ? 'guard' : 'move',
              locationId: mode === 'jobs' ? 'start' : 'destination',
              routeId: null,
              targetActorId: null,
              roles: [],
              priority: 10,
              durationSeconds: mode === 'jobs' ? 3600 : 20,
              exclusive: false,
              enabled: true,
              needEffects: {},
              maxDamage: 0,
            },
          }),
        );
      const scene = store.executeLive(cmd({ kind: 'initialize', expectedRosterRevision: 0 })).scene;
      store.executeLive(
        cmd({
          kind: 'scene-content',
          sceneId: scene.id,
          expectedRevision: 0,
          title: 'Unabhängige Gruppe',
          notes: '',
          readAloud: '',
          locationId: 'elsewhere',
        }),
      );
      store.executeLive(
        cmd({
          kind: 'advance-clock',
          sceneId: scene.id,
          expectedRevision: 0,
          amount: 60,
          unit: 'seconds',
          calendarVersion: 'relative-v1',
          reason: 'Ausdrücklich bestätigte Zeit',
        }),
      );
      const bytes = store.db.serialize(),
        decision = store.autonomyDecision(w.token, actorId);
      assert.equal(decision.basis, 'confirmed');
      assert(store.db.serialize().equals(bytes), 'inspection must not mutate campaign state');
      const step = cmd({ kind: 'catch-up', actorIds: [actorId], maxSteps: 1 });
      store.executeAutonomy(step);
      const view = store.autonomy(w.token),
        actor = view.actors.find((a) => a.id === actorId),
        job = view.logs.find((l) => l.actorId === actorId && l.kind === 'job'),
        move = view.logs.find((l) => l.actorId === actorId && l.kind === 'move');
      assert.equal(job.facts.jobId, decision.selectedJobId);
      const committed = store.db.serialize();
      store.executeAutonomy(step);
      assert(
        store.db.serialize().equals(committed),
        'receipt replay must not execute a second step',
      );
      store.close();
      store = new CampaignStore(file);
      w = store.activate(campaign.id);
      assert.deepEqual(
        store.autonomy(w.token).actors.find((a) => a.id === actorId),
        actor,
      );
      assert.deepEqual(
        store.autonomy(w.token).logs.find((l) => l.id === job.id),
        job,
      );
      results[mode] = {
        selected: decision.selectedJobId,
        job: actor.jobId,
        progress: actor.progressSeconds,
        location: actor.locationId,
        routes: move?.facts.routeIds ?? [],
      };
    }
    console.log(
      JSON.stringify({ locale: Intl.DateTimeFormat().resolvedOptions().locale, results }),
    );
  } finally {
    store.close();
    rmSync(root, { recursive: true, force: true });
  }
}
test('job and equal-duration route choices use stable IDs across host languages, execution, replay and Fresh', () => {
  const outputs = ['de_DE.UTF-8', 'sv_SE.UTF-8'].map((locale) => {
    const result = spawnSync(process.execPath, ['-e', '(' + observe.toString() + ')()'], {
      env: { ...process.env, LANG: locale, LC_ALL: locale },
      encoding: 'utf8',
      timeout: 30000,
    });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  });
  assert.match(outputs[0].locale, /^de/);
  assert.match(outputs[1].locale, /^sv/);
  for (const output of outputs) {
    assert.deepEqual(output.results.jobs, {
      selected: 'z-job',
      job: 'z-job',
      progress: 60,
      location: 'start',
      routes: [],
    });
    assert.deepEqual(output.results.route, {
      selected: 'move-job',
      job: null,
      progress: 0,
      location: 'destination',
      routes: ['a-start-Z', 'c-Z-destination'],
    });
  }
});
