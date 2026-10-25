import { performance } from 'node:perf_hooks';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  standardNeeds,
  type AutonomyActor,
  type AutonomyJob,
} from '../src/app/runtime/autonomy-contracts';
import type { Room } from '../src/app/shared/contracts';
import { createHash } from 'node:crypto';
import { validateAutonomy } from '../src/app/storage/autonomy';
import { CampaignStore } from '../src/app/storage/store';
import { campaignLocalId } from '../src/features/campaign/campaign-contracts';
import { newLocation } from '../src/features/location/location-schema';

const actors = Number(process.env.AUTONOMY_ACTORS ?? 200),
  samples = 1,
  stepSeconds = 900,
  scenario = process.env.AUTONOMY_SCENARIO ?? 'baseline',
  root = mkdtempSync(join(tmpdir(), 'autonomy-scale-')),
  store = new CampaignStore(join(root, 'campaign.sqlite'), 'scale-measurement');
const checksum = (payload: string) => createHash('sha256').update(payload).digest('hex');
const percentile = (values: number[], value: number) =>
  values.slice().sort((a, b) => a - b)[Math.ceil(values.length * value) - 1]!;
const round = (value: number) => Math.round(value * 100) / 100;
try {
  if (!Number.isSafeInteger(actors) || actors < 1 || actors > 200)
    throw new Error('AUTONOMY_ACTORS must be an integer from 1 to 200.');
  if (!['baseline', 'spatial'].includes(scenario))
    throw new Error('AUTONOMY_SCENARIO must be baseline or spatial.');
  const spatial = scenario === 'spatial',
    room: Room = {
      id: 'scale-room',
      scopeId: 'local',
      floorId: 'ground',
      name: 'Messhalle',
      number: '1',
      revision: 0,
      polygons: [
        {
          outer: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
            { x: 0, y: 100 },
          ],
          holes: [],
        },
      ],
      sections: [],
    };
  const campaign = store.create('Autonomy scale', spatial ? [room] : []),
    token = store.activate(campaign.id).token,
    actorIds: string[] = [],
    db = (store as unknown as { db: any }).db,
    jobCount = spatial ? 5 : 1;
  if (spatial) {
    const location = {
      ...newLocation('scale-place', 'Messgewölbe', 'poi', ['scale-description', 'scale-notes']),
      detailMaps: [{ kind: 'dungeon' as const, documentId: 'local' }],
    };
    store.changePreparation({
      commandId: 'location',
      campaignId: campaign.id,
      token,
      change: { kind: 'location', expectedRevision: null, document: location },
    });
  }
  for (let index = 0; index < jobCount; index++) {
    const job: AutonomyJob = {
      id: 'scale-guard-' + index,
      revision: 0,
      name: 'Wache ' + index,
      kind: 'guard',
      locationId: null,
      routeId: null,
      targetActorId: null,
      roomId: spatial ? 'scale-room' : null,
      roles: [],
      priority: 10 - index,
      durationSeconds: 3600,
      exclusive: false,
      enabled: true,
      needEffects: {},
      maxDamage: 0,
    };
    store.executeAutonomy({
      commandId: 'job-' + index,
      campaignId: campaign.id,
      token,
      action: { kind: 'job', job, expectedRevision: null },
    });
  }
  db.transaction(() => {
    const noteInsert = db.prepare('INSERT INTO world_note VALUES(?,?,1,0,?,?)'),
      searchInsert = db.prepare(
        'INSERT INTO note_search(campaign_id,note_id,title,body) VALUES(?,?,?,?)',
      ),
      actorInsert = db.prepare('INSERT INTO autonomy_actor VALUES(?,?,?,?,?)'),
      positionInsert = db.prepare('INSERT INTO npc_position VALUES(?,?,?,?)'),
      dungeonInsert = db.prepare('INSERT INTO npc_dungeon_position VALUES(?,?,?,?)');
    for (let index = 0; index < actors; index++) {
      const id = campaignLocalId(`00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`),
        title = 'Actor ' + index;
      actorIds.push(id);
      const note = {
          version: 1,
          id,
          revision: 1,
          kind: 'npc',
          title,
          readAloud: '',
          gmNotes: '',
          relations: [],
          creatureId: null,
          deleted: false,
        },
        notePayload = JSON.stringify(note);
      noteInsert.run(campaign.id, id, notePayload, checksum(notePayload));
      searchInsert.run(campaign.id, id, title, '');
      const pose = spatial
          ? {
              scopeId: 'local',
              floorId: 'ground',
              roomId: 'scale-room',
              x: 45 + (index % 10),
              y: 40 + Math.floor(index / 10),
              z: 0,
            }
          : null,
        positionBasis = spatial
          ? { locationId: 'scale-place', revision: 1, dungeon: pose }
          : { locationId: null, revision: null },
        actor: AutonomyActor = {
          id,
          revision: 1,
          enabled: true,
          paused: false,
          role: '',
          needs: standardNeeds(),
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
          sightMeters: 20,
          darkvisionMeters: 0,
          hearingMeters: 18,
          passivePerception: 10,
          stealthDc: 10,
          positionBasis,
        },
        actorPayload = JSON.stringify(actor);
      actorInsert.run(campaign.id, id, actor.revision, actorPayload, checksum(actorPayload));
      if (pose) {
        positionInsert.run(campaign.id, id, 'scale-place', 1);
        const posePayload = JSON.stringify(pose);
        dungeonInsert.run(campaign.id, id, posePayload, checksum(posePayload));
      }
    }
  }).immediate();
  validateAutonomy(db);
  const scene = store.executeLive({
      commandId: 'scene',
      campaignId: campaign.id,
      token,
      action: { kind: 'initialize', expectedRosterRevision: 0 },
    }).scene!,
    baselineBytes = db.serialize().byteLength,
    captureMs: number[] = [],
    catchUpMs: number[] = [],
    viewMs: number[] = [],
    intervalBytes: number[] = [];
  let clockRevision = 0,
    peakRss = process.memoryUsage().rss,
    progressed = 0;
  for (let sample = 0; sample < samples; sample++) {
    let started = performance.now();
    store.executeLive({
      commandId: 'time-' + sample,
      campaignId: campaign.id,
      token,
      action: {
        kind: 'advance-clock',
        sceneId: scene.id,
        expectedRevision: clockRevision,
        amount: stepSeconds,
        unit: 'seconds',
        calendarVersion: 'relative-v1',
        reason: 'Scale measurement',
      },
    });
    captureMs.push(performance.now() - started);
    clockRevision++;
    intervalBytes.push(
      db
        .prepare(
          'SELECT length(payload) size FROM autonomy_interval WHERE campaign_id=? ORDER BY ordinal DESC LIMIT 1',
        )
        .get(campaign.id).size,
    );
    started = performance.now();
    const result = store.executeAutonomy({
      commandId: 'catch-up-' + sample,
      campaignId: campaign.id,
      token,
      action: { kind: 'catch-up', actorIds, maxSteps: 12 },
    });
    catchUpMs.push(performance.now() - started);
    progressed += result.progressed;
    if (result.progressed < actors || result.pending !== 0)
      throw new Error(`Unexpected progress ${result.progressed}/${result.pending}.`);
    started = performance.now();
    const view = store.autonomy(token);
    viewMs.push(performance.now() - started);
    if (view.actors.length !== actors) throw new Error('Actor projection incomplete.');
    peakRss = Math.max(peakRss, process.memoryUsage().rss);
  }
  const finalBytes = db.serialize().byteLength,
    metrics = {
      sourceCondition: {
        scenario,
        actors,
        samples,
        confirmedStepSeconds: stepSeconds,
        jobs: jobCount,
        locations: spatial ? 1 : 0,
        dungeons: spatial ? 1 : 0,
        maxSteps: 12,
        progressed,
      },
      captureMs: {
        median: round(percentile(captureMs, 0.5)),
        p95: round(percentile(captureMs, 0.95)),
        max: round(Math.max(...captureMs)),
      },
      catchUpMs: {
        median: round(percentile(catchUpMs, 0.5)),
        p95: round(percentile(catchUpMs, 0.95)),
        max: round(Math.max(...catchUpMs)),
      },
      viewMs: {
        median: round(percentile(viewMs, 0.5)),
        p95: round(percentile(viewMs, 0.95)),
        max: round(Math.max(...viewMs)),
      },
      storageBytes: {
        baseline: baselineBytes,
        final: finalBytes,
        growth: finalBytes - baselineBytes,
        perConfirmedStep: Math.round((finalBytes - baselineBytes) / samples),
        intervalPayloadMedian: percentile(intervalBytes, 0.5),
      },
      processPeakRssBytes: peakRss,
    };
  const output = JSON.stringify(metrics, null, 2) + '\n';
  writeFileSync(join(process.cwd(), '.build', 'autonomy-scale.json'), output);
  process.stdout.write(output);
} finally {
  store.close();
  rmSync(root, { recursive: true, force: true });
}
