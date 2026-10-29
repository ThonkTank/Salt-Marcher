import { isProjectionJob, isCachedTileJob, type AtlasWorkerJob } from './atlas-worker-contract';
import type { AtlasRegionSource } from '../src/app/atlas/atlas-region-view-contracts';
import { AtlasGeometryTiles } from '../src/app/storage/atlas-geometry-tiles';
import { AtlasTerrainTiles } from '../src/app/storage/atlas-terrain-tiles';
import { AtlasMaterialTiles } from '../src/app/storage/atlas-material-tiles';
import { AtlasProjectionIndex } from '../src/app/storage/atlas-projection-index';
import { assertAtlasProjectionSource } from '../src/app/storage/atlas-shape-source';
import {
  computeTerrainStroke,
  computeLakeStroke,
  TerrainScalePyramid,
} from '../src/app/storage/terrain-scale';
import { terrainTraceStart } from '../src/app/atlas/terrain-timing';
import { parentPort, workerData } from 'node:worker_threads';
import Database from 'better-sqlite3';
import { takeTerrainTrace } from '../src/app/atlas/terrain-timing';
import { AtlasRegionReader } from '../src/app/storage/atlas-region';
import {
  atlasReadCheckpoint,
  AtlasReadCancelled,
} from '../src/app/storage/atlas-read-cancellation';

const db = new Database(workerData.filename, { readonly: true, fileMustExist: true }),
  pyramid = new TerrainScalePyramid();
let index: AtlasProjectionIndex, reader: AtlasRegionReader;
const terrainTiles = new AtlasTerrainTiles(db, workerData.cacheDirectory),
  materialTiles = new AtlasMaterialTiles(db, workerData.cacheDirectory),
  geometryTiles = new AtlasGeometryTiles(workerData.cacheDirectory);

let preparation: { fence: string; stroke: string; steps: Generator<void> } | undefined;
let projection:
  | {
      fence: string;
      query: string;
      steps:
        | ReturnType<AtlasRegionReader['terrainSteps']>
        | ReturnType<AtlasRegionReader['colorSteps']>
        | ReturnType<AtlasRegionReader['liveTerrainSteps']>
        | ReturnType<AtlasTerrainTiles['read']>
        | ReturnType<AtlasMaterialTiles['read']>
        | ReturnType<AtlasGeometryTiles['read']>;
    }
  | undefined;

function assertTerrainRevision(source: AtlasRegionSource) {
  const root = db
    .prepare('SELECT revision FROM campaign_atlas WHERE campaign_id=?')
    .get(source.campaignId) as { revision: number } | undefined;
  if (root?.revision !== source.revision)
    throw Error('Gelände inzwischen geändert. Ausschnitt erneut laden.');
}

parentPort!.on('message', async (job: AtlasWorkerJob) => {
  if (
    projection &&
    (projection.fence !== job.source.fence ||
      ['terrain-live', 'terrain-stroke', 'region'].includes(job.kind))
  )
    projection = undefined;
  const geometry =
    job.kind === 'geometry-tile'
      ? 'core'
      : ['region', 'focus', 'candidates', 'hit', 'geometry-tile'].includes(job.kind);
  let syncStarted = false,
    readStarted = false,
    endRead: (() => void) | undefined;
  try {
    // An exact retained product needs no global projection. Validate it against
    // a pinned canonical snapshot before decoding the cache. Once a reader has
    // observed changes, keep the ordinary synchronization path: skipping later
    // source cursors would lose its incremental invalidations.
    if (!reader && !job.continuation && isCachedTileJob(job)) {
      db.exec('BEGIN');
      assertTerrainRevision(job.source);
      assertAtlasProjectionSource(db, job.source);
      const value =
        job.kind === 'geometry-tile'
          ? geometryTiles.cached(job.source, job.query)
          : job.kind === 'terrain-tile'
            ? terrainTiles.cached(job.source, job.query)
            : materialTiles.cached(job.source, job.query);
      db.exec('COMMIT');
      if (value) {
        parentPort!.postMessage({ value });
        return;
      }
    }
    if (!reader) {
      // Earlier exact hits advanced Main's cursor without preparing a reader.
      // The first miss must establish every derived dependency from this source.
      job.source = { ...job.source, reset: true };
      index = await AtlasProjectionIndex.open(
        db,
        job.source,
        workerData.cacheDirectory,
        workerData.workId,
      );
      reader = new AtlasRegionReader(db, workerData.shadow, index);
    }
    db.exec('BEGIN');
    // The first SELECT pins the WAL snapshot before async index maintenance.
    // A queued source must never label newer terrain rows as an older revision.
    if (
      job.kind === 'terrain-live' ||
      job.kind === 'terrain-stroke' ||
      job.kind === 'terrain-change' ||
      isProjectionJob(job)
    ) {
      assertTerrainRevision(job.source);
    }
    atlasReadCheckpoint(job.cancellation)();
    const endSync = terrainTraceStart('region.sync', job.source.revision);
    syncStarted = true;
    await reader.sync(job.source, geometry, job.kind === 'geometry-tile' ? 'field' : 'full');
    pyramid.sync(db, job.source);
    endSync();
    if (job.kind === 'terrain-stroke') {
      const stroke = JSON.stringify(job.stroke);
      if (!job.continuation)
        preparation = {
          fence: job.source.fence,
          stroke,
          steps:
            'waterLevelM' in job.stroke
              ? (function* () {})()
              : pyramid.warm(db, job.source.campaignId, job.stroke),
        };
      if (!preparation || preparation.fence !== job.source.fence || preparation.stroke !== stroke)
        throw Error('Geländeberechnung inzwischen ersetzt.');
      if (!preparation.steps.next().done) {
        db.exec('COMMIT');
        parentPort!.postMessage({ value: { terrainContinuation: true } });
        return;
      }
      preparation = undefined;
    }
    endRead = terrainTraceStart('region.read', job.source.revision);
    readStarted = true;
    let value;
    if (isProjectionJob(job)) {
      const query = JSON.stringify([job.kind, job.query, 'base' in job ? job.base : undefined]);
      if (!job.continuation)
        projection = {
          fence: job.source.fence,
          query,
          steps:
            job.kind === 'geometry-tile'
              ? geometryTiles.read(job.source, job.query, reader)
              : job.kind === 'material-tile'
                ? materialTiles.read(job.source, job.query, reader)
                : job.kind === 'terrain-tile'
                  ? terrainTiles.read(job.source, job.query, reader)
                  : job.kind === 'terrain-refine'
                    ? reader.liveTerrainSteps(job.source, job.query, job.base)
                    : job.kind === 'terrain-color'
                      ? reader.colorSteps(job.source, job.query)
                      : reader.terrainSteps(job.source, job.query),
        };
      if (!projection || projection.fence !== job.source.fence || projection.query !== query)
        throw Error('Geländeberechnung inzwischen ersetzt.');
      atlasReadCheckpoint(job.cancellation)();
      const step = projection.steps.next();
      atlasReadCheckpoint(job.cancellation)();
      if (!step.done) {
        endRead();
        db.exec('COMMIT');
        const terrainTrace = takeTerrainTrace();
        parentPort!.postMessage({
          value: { terrainProjectionContinuation: true },
          ...(terrainTrace ? { terrainTrace } : {}),
        });
        return;
      }
      projection = undefined;
      value = step.value;
    } else if (job.kind === 'terrain-change') {
      value = {
        ...reader.terrainSourceChange(job.base),
        target: { revision: job.source.revision, fence: job.source.fence },
      };
    } else
      value =
        job.kind === 'terrain-stroke'
          ? {
              fence: job.source.fence,
              revision: job.source.revision,
              stroke: JSON.stringify(job.stroke),
              ...('waterLevelM' in job.stroke
                ? computeLakeStroke(
                    db,
                    job.source.campaignId,
                    job.stroke,
                    job.stroke.visibility
                      ? reader.terrainVisibility(job.source, job.stroke.visibility)
                      : undefined,
                  )
                : {
                    records: computeTerrainStroke(
                      db,
                      job.source.campaignId,
                      job.stroke,
                      pyramid,
                      job.stroke.visibility
                        ? reader.terrainVisibility(job.source, job.stroke.visibility)
                        : undefined,
                    ),
                  }),
            }
          : job.kind === 'terrain-live'
            ? reader.liveTerrain(job.source, job.query, job.base)
            : job.kind === 'focus'
              ? reader.focus(job.source, job.objectKind, job.id)
              : job.kind === 'candidates'
                ? reader.candidatesAt(
                    job.source,
                    job.query,
                    job.point,
                    job.offset,
                    job.layer,
                    job.visualElementId,
                  )
                : job.kind === 'hit'
                  ? reader.hit(job.source, job.query, job.point)
                  : reader.read(job.source, job.query, job.cancellation);
    endRead();
    db.exec('COMMIT');
    const terrainTrace = takeTerrainTrace();
    parentPort!.postMessage({ value, ...(terrainTrace ? { terrainTrace } : {}) });
  } catch (error) {
    endRead?.();
    if (error instanceof AtlasReadCancelled) {
      projection = undefined;
      // Read iterators have unwound. Keep the completed TEMP index maintenance:
      // rolling it back would make every camera successor rebuild the world.
      if (db.inTransaction) {
        if (readStarted) db.exec('COMMIT');
        else {
          db.exec('ROLLBACK');
          if (syncStarted) reader.rollback(geometry);
        }
      }
      const terrainTrace = takeTerrainTrace();
      parentPort!.postMessage({
        value: { regionReadCancelled: true },
        ...(terrainTrace ? { terrainTrace } : {}),
      });
      return;
    }
    if (job.kind === 'terrain-stroke') preparation = undefined;
    if (isProjectionJob(job)) projection = undefined;
    if (db.inTransaction) {
      db.exec('ROLLBACK');
      if (syncStarted) reader.rollback(geometry);
    }
    const terrainTrace = takeTerrainTrace();
    parentPort!.postMessage({
      error: (error as Error).message,
      ...(terrainTrace ? { terrainTrace } : {}),
    });
  } finally {
    // Publishing derived data never delays the response; the next job can run
    // between SQLite backup batches. Main owns cleanup after worker termination.
    index?.schedule();
  }
});
