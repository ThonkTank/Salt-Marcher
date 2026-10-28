import {
  isProjectionJob,
  isWorkerControl,
  type AtlasJob,
  type AtlasJobResults,
  type AtlasWorkerValue,
  type AtlasWorkerReply,
} from './atlas-worker-contract';
import {
  validateAtlasReadRequest,
  type AtlasReadRequest,
} from '../src/app/atlas/atlas-read-request';
import { randomUUID } from 'node:crypto';
import { eraseProjectionWork } from '../src/app/storage/atlas-projection-index';
import { terrainTraceStart } from '../src/app/atlas/terrain-timing';
import { Worker } from 'node:worker_threads';
import { join } from 'node:path';
import type {
  AtlasRegionSource,
  AtlasRegionQuery,
  AtlasRegionGeometry,
  AtlasObjectFocus,
  AtlasHitPage,
} from '../src/app/atlas/atlas-region-contracts';
import { REGION_CACHE_BYTES } from '../src/app/atlas/atlas-region-contracts';

type Queued = {
  control?: AtlasReadRequest;
  cancellation?: Int32Array;
  endQueue: () => void;
  source: AtlasRegionSource;
  job: AtlasJob;
  resolve: (value: AtlasWorkerValue) => void;
  reject: (error: Error) => void;
};
type Lane = 'selection' | 'camera' | 'terrain' | 'author' | 'live';
const LANE_PRIORITY: readonly Lane[] = ['selection', 'live', 'camera', 'author', 'terrain'];

/** One readonly worker/index; bounded successors for selection, camera and terrain, with selection first. */
export class AtlasRegionService {
  private worker: Worker | null = null;
  private identity = '';
  private exit: Promise<unknown> = Promise.resolve();
  private pending: { resolve: (v: AtlasWorkerValue) => void; reject: (e: Error) => void } | null =
    null;
  private generation = 0;
  private closed = false;
  private source: AtlasRegionSource | null = null;
  private queued = new Map<Lane, Queued>();
  private draining = false;
  private starts = 0;
  private activeRead: { token: string; control: AtlasReadRequest; signal: Int32Array } | undefined;
  private terrainYields = 0;
  private regionCancellation: Int32Array | null = null;
  private regionCancelled = 0;
  private cache = new Map<string, { json: string; bytes: number }>();
  private cacheBytes = 0;

  constructor(
    private workerFile = join(__dirname, 'atlas-region-worker.cjs'),
    private cacheLimit = REGION_CACHE_BYTES / 4,
    private cacheDirectory?: string,
  ) {}

  get cursor() {
    return this.source
      ? {
          epoch: this.source.epoch,
          sequence: this.source.sequence,
          ...(this.source.shadow
            ? {
                shadow: { epoch: this.source.shadow.epoch, sequence: this.source.shadow.sequence },
              }
            : {}),
        }
      : undefined;
  }

  get diagnostics() {
    return {
      workerStarts: this.starts,
      active: !!this.pending,
      queued: this.queued.size > 0,
      cacheBytes: this.cacheBytes,
      terrainYields: this.terrainYields,
      regionCancelled: this.regionCancelled,
    };
  }

  private sourceIdentity(s: AtlasRegionSource) {
    return JSON.stringify([
      s.filename,
      s.campaignId,
      s.token,
      s.epoch,
      s.shadow?.filename,
      s.shadow?.scopeId,
      s.shadow?.epoch,
    ]);
  }

  cancel() {
    this.generation++;
    const worker = this.worker;
    // Drop ownership before termination; late callbacks must not settle a new worker's request.
    this.worker = null;
    this.identity = '';
    this.source = null;
    this.pending?.reject(new Error('Kartenausschnitt abgebrochen.'));
    this.pending = null;
    for (const q of this.queued.values()) {
      q.reject(new Error('Kartenausschnitt abgebrochen.'));
    }
    this.queued.clear();
    if (worker) {
      void worker.terminate();
    }
  }

  async cancelAndWait() {
    this.cancel();
    await this.exit;
  }

  async close() {
    this.closed = true;
    await this.cancelAndWait();
    this.cache.clear();
    this.cacheBytes = 0;
  }

  cancelRead(control: AtlasReadRequest, token?: string) {
    validateAtlasReadRequest(control);
    const active = this.activeRead;
    if (
      active &&
      (token === undefined || active.token === token) &&
      active.control.owner === control.owner &&
      active.control.id === control.id
    )
      Atomics.store(active.signal, 0, 1);
    for (const [lane, queued] of this.queued)
      if (
        (token === undefined || queued.source.token === token) &&
        queued.control?.owner === control.owner &&
        queued.control.id === control.id
      ) {
        queued.endQueue();
        queued.reject(new Error('Kartenausschnitt abgebrochen.'));
        this.queued.delete(lane);
      }
  }
  private enqueue<J extends AtlasJob>(
    source: AtlasRegionSource,
    job: J,
    lane: Lane = 'selection',
    control?: AtlasReadRequest,
  ) {
    validateAtlasReadRequest(control);
    if (
      control &&
      this.activeRead?.token === source.token &&
      this.activeRead.control.owner === control.owner
    )
      Atomics.store(this.activeRead.signal, 0, 1);
    if (this.closed) {
      return Promise.reject(new Error('Kartenausschnitt abgebrochen.'));
    }
    if (this.worker && this.sourceIdentity(source) !== this.identity) {
      this.cancel();
    }
    if (lane === 'camera' || lane === 'live' || lane === 'author') {
      this.queued
        .get('terrain')
        ?.reject(new Error('Geländeberechnung durch neuere Anfrage ersetzt.'));
      this.queued.delete('terrain');
    }
    this.queued.get(lane)?.reject(new Error('Kartenausschnitt durch neuere Anfrage ersetzt.'));
    const promise = new Promise<AtlasJobResults[J['kind']]>((resolve, reject) => {
      this.queued.set(lane, {
        source,
        job,
        control,
        cancellation: control ? new Int32Array(new SharedArrayBuffer(4)) : undefined,
        resolve: (value) => resolve(value as AtlasJobResults[J['kind']]),
        reject,
        endQueue: terrainTraceStart('region.queue', source.revision),
      });
    });
    void this.drain();
    return promise;
  }

  private async drain() {
    if (this.draining) {
      return;
    }
    this.draining = true;
    try {
      while (this.queued.size && !this.closed) {
        const lane = LANE_PRIORITY.find((lane) => this.queued.has(lane))!,
          request = this.queued.get(lane)!;
        this.queued.delete(lane);
        request.endQueue();
        const cancellation =
          request.cancellation ??
          (lane === 'camera' ? new Int32Array(new SharedArrayBuffer(4)) : null);
        if (request.control && cancellation)
          this.activeRead = {
            token: request.source.token,
            control: request.control,
            signal: cancellation,
          };
        if (cancellation) this.regionCancellation = cancellation;
        try {
          const value = await this.run(
            request.source,
            cancellation ? { ...request.job, cancellation } : request.job,
          );
          if (
            cancellation &&
            (Atomics.load(cancellation, 0) || isWorkerControl(value, 'regionReadCancelled'))
          ) {
            this.regionCancelled++;
            request.reject(new Error('Kartenausschnitt durch neuere Anfrage ersetzt.'));
          } else if (
            isWorkerControl(value, 'terrainProjectionContinuation') &&
            isProjectionJob(request.job)
          ) {
            this.terrainYields++;
            if (
              ['terrain', 'live', 'camera', 'author'].some((lane) => this.queued.has(lane as Lane))
            )
              request.reject(new Error('Geländeberechnung durch neuere Anfrage ersetzt.'));
            else
              this.queued.set('terrain', {
                ...request,
                job: { ...request.job, continuation: true },
                endQueue: () => {},
              });
          } else if (
            isWorkerControl(value, 'terrainContinuation') &&
            request.job.kind === 'terrain-stroke'
          ) {
            if (this.queued.has('author'))
              request.reject(new Error('Geländeberechnung durch neueren Auftrag ersetzt.'));
            else
              this.queued.set('author', {
                ...request,
                job: { ...request.job, continuation: true },
                endQueue: () => {},
              });
          } else request.resolve(value);
        } catch (e) {
          request.reject(e as Error);
        } finally {
          if (this.regionCancellation === cancellation) this.regionCancellation = null;
          if (this.activeRead?.signal === cancellation) this.activeRead = undefined;
        }
      }
    } finally {
      this.draining = false;
    }
  }

  private async run(source: AtlasRegionSource, job: AtlasJob) {
    const identity = this.sourceIdentity(source),
      generation = this.generation;
    // A cancelled worker must release its database connection before its replacement starts.
    if (!this.worker) {
      await this.exit;
    }
    if (this.closed || generation !== this.generation) {
      throw new Error('Kartenausschnitt abgebrochen.');
    }
    if (!this.worker) {
      const workId = randomUUID();
      const worker = new Worker(this.workerFile, {
        workerData: {
          filename: source.filename,
          shadow: source.shadow,
          cacheDirectory: this.cacheDirectory,
          workId,
        },
      });
      this.starts++;
      this.worker = worker;
      this.identity = identity;
      this.exit = new Promise((resolve) => worker.once('exit', resolve)).then(async () => {
        if (this.cacheDirectory)
          await eraseProjectionWork(
            this.cacheDirectory,
            source.filename,
            source.campaignId,
            workId,
          ).catch(() => {});
      });
      worker.on('message', (result: AtlasWorkerReply) => {
        if (this.worker !== worker) {
          return;
        }
        const pending = this.pending;
        this.pending = null;
        if ('error' in result) {
          pending?.reject(new Error(result.error));
        } else {
          pending?.resolve(result.value);
        }
      });
      const fail = (e: Error) => {
        if (this.worker !== worker) {
          return;
        }
        this.pending?.reject(e);
        this.pending = null;
        this.worker = null;
        this.source = null;
        this.identity = '';
      };
      worker.once('error', fail);
      worker.once('exit', () => fail(new Error('Kartenausschnitt ohne Ergebnis beendet.')));
      source = { ...source, reset: true };
    } else if (this.source?.fence === source.fence) {
      // A successor captured before the first response has no cursor yet. Same source needs no rebuild.
      source = { ...source, reset: false, changes: [] };
    }
    const endRoundtrip = terrainTraceStart('worker.roundtrip', source.revision);
    const value = await new Promise<AtlasWorkerValue>((resolve, reject) => {
      this.pending = { resolve, reject };
      this.worker!.postMessage({ ...job, source });
    });
    if (this.closed || generation !== this.generation) {
      throw new Error('Kartenausschnitt abgebrochen.');
    }
    endRoundtrip();
    this.source = source;
    return value;
  }

  async read(source: AtlasRegionSource, query: AtlasRegionQuery): Promise<AtlasRegionGeometry> {
    if (this.closed) {
      throw new Error('Kartenausschnitt abgebrochen.');
    }
    // A cache hit also supersedes older work. Shared memory reaches the busy
    // worker without waiting for its synchronous read to process a message.
    if (this.regionCancellation) Atomics.store(this.regionCancellation, 0, 1);
    this.queued.get('camera')?.reject(new Error('Kartenausschnitt durch neuere Anfrage ersetzt.'));
    this.queued.delete('camera');
    const key = JSON.stringify([source.filename, source.token, source.fence, query]);
    const hit = this.cache.get(key);
    if (hit) {
      this.cache.delete(key);
      this.cache.set(key, hit);
      return JSON.parse(hit.json);
    }
    const value = (await this.enqueue(
        source,
        { kind: 'region', query },
        'camera',
      )) as AtlasRegionGeometry,
      json = JSON.stringify(value),
      size = (json.length + key.length) * 2;
    while (this.cacheBytes + size > this.cacheLimit && this.cache.size) {
      const [old, c] = this.cache.entries().next().value!;
      this.cache.delete(old);
      this.cacheBytes -= c.bytes;
    }
    if (size <= this.cacheLimit) {
      this.cache.set(key, { json, bytes: size });
      this.cacheBytes += size;
    }
    return value;
  }

  prepareTerrainStroke(
    source: AtlasRegionSource,
    stroke:
      | import('../src/app/atlas/terrain-brush').HeightStroke
      | import('../src/app/atlas/atlas-landscape').LakeStroke,
  ): Promise<import('../src/app/storage/terrain-scale').PreparedTerrainStroke> {
    return this.enqueue(source, { kind: 'terrain-stroke', stroke }, 'author');
  }

  geometryTile(
    source: AtlasRegionSource,
    query: import('../src/app/atlas/atlas-geometry-tile').AtlasGeometryTileRequest,
  ): Promise<import('../src/app/atlas/atlas-geometry-tile').AtlasGeometryTile> {
    return this.enqueue(source, { kind: 'geometry-tile', query }, 'terrain');
  }
  terrainTile(
    source: AtlasRegionSource,
    query: import('../src/app/atlas/atlas-terrain-tile').AtlasTerrainTileRequest,
    control?: AtlasReadRequest,
  ): Promise<import('../src/app/atlas/atlas-terrain-tile').AtlasTerrainTile> {
    return this.enqueue(source, { kind: 'terrain-tile', query }, 'terrain', control);
  }
  materialTile(
    source: AtlasRegionSource,
    query: import('../src/app/atlas/atlas-material-tile').AtlasMaterialTileRequest,
    control?: AtlasReadRequest,
  ): Promise<import('../src/app/atlas/atlas-material-tile').AtlasMaterialTile> {
    return this.enqueue(source, { kind: 'material-tile', query }, 'terrain', control);
  }
  terrainColor(
    source: AtlasRegionSource,
    query: import('../src/app/atlas/terrain-color').TerrainColorRequest,
  ): Promise<import('../src/app/atlas/terrain-color').TerrainColorTile> {
    return this.enqueue(source, { kind: 'terrain-color', query }, 'terrain');
  }
  terrain(
    source: AtlasRegionSource,
    query: import('../src/app/atlas/terrain-projection').TerrainProjectionRequest,
    control?: AtlasReadRequest,
  ): Promise<import('../src/app/atlas/terrain-projection').TerrainProjection> {
    return this.enqueue(source, { kind: 'terrain', query }, 'terrain', control);
  }

  liveTerrain(
    source: AtlasRegionSource,
    query: import('../src/app/atlas/terrain-presentation').TerrainFrameQuery,
    base?: import('../src/app/atlas/terrain-frame').TerrainFrameIdentity,
    refinement = false,
  ): Promise<import('../src/app/atlas/terrain-presentation').TerrainFrame> {
    return this.enqueue(
      source,
      { kind: refinement ? 'terrain-refine' : 'terrain-live', query, base },
      refinement ? 'terrain' : 'live',
    );
  }

  focus(
    source: AtlasRegionSource,
    kind: 'room' | 'city' | 'building' | 'element' | 'scope',
    id: string,
  ): Promise<AtlasObjectFocus> {
    return this.enqueue(source, { kind: 'focus', objectKind: kind, id });
  }

  hit(
    source: AtlasRegionSource,
    query: AtlasRegionQuery,
    point: { x: number; y: number },
  ): Promise<AtlasObjectFocus | null> {
    return this.enqueue(source, { kind: 'hit', query, point });
  }

  candidates(
    source: AtlasRegionSource,
    query: AtlasRegionQuery,
    point: { x: number; y: number },
    offset = 0,
    layer: 'geometry' | 'landscape' | 'all' = 'geometry',
    visualElementId?: string,
  ): Promise<AtlasHitPage> {
    return this.enqueue(source, {
      kind: 'candidates',
      query,
      point,
      offset,
      layer,
      visualElementId,
    });
  }
}
