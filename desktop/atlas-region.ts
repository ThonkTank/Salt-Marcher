import {terrainTraceStart} from '../src/app/terrain-timing';
import { Worker } from 'node:worker_threads';
import { join } from 'node:path';
import type {
  AtlasRegionSource, AtlasRegionQuery, AtlasRegionGeometry, AtlasObjectFocus, AtlasHitPage,
} from '../src/app/atlas-region-contracts';
import { REGION_CACHE_BYTES } from '../src/app/atlas-region-contracts';

type Queued = {
  endQueue:()=>void;
  source: AtlasRegionSource;
  job: object;
  resolve: (value: any) => void;
  reject: (error: Error) => void;
};
type Lane='selection'|'camera'|'terrain'|'author'|'live';
const LANE_PRIORITY:readonly Lane[]=['selection','live','camera','author','terrain'];

/** One readonly worker/index; bounded successors for selection, camera and terrain, with selection first. */
export class AtlasRegionService {
  private worker: Worker | null = null;
  private identity = '';
  private exit: Promise<unknown> = Promise.resolve();
  private pending: { resolve: (v: any) => void; reject: (e: Error) => void } | null = null;
  private generation = 0;
  private closed = false;
  private source: AtlasRegionSource | null = null;
  private queued = new Map<Lane, Queued>();
  private draining = false;
  private starts = 0;
  private terrainYields=0;
  private cache = new Map<string, { json: string; bytes: number }>();
  private cacheBytes = 0;

  constructor(
    private workerFile = join(__dirname, 'atlas-region-worker.cjs'),
    private cacheLimit = REGION_CACHE_BYTES/4,
  ) {}

  get cursor() {
    return this.source ? {
      epoch: this.source.epoch,
      sequence: this.source.sequence,
      ...(this.source.shadow ? {
        shadow: { epoch: this.source.shadow.epoch, sequence: this.source.shadow.sequence },
      } : {}),
    } : undefined;
  }

  get diagnostics() {
    return {
      workerStarts: this.starts,
      active: !!this.pending,
      queued: this.queued.size > 0,
      cacheBytes: this.cacheBytes,
      terrainYields:this.terrainYields,
    };
  }

  private sourceIdentity(s: AtlasRegionSource) {
    return JSON.stringify([
      s.filename, s.campaignId, s.token, s.epoch,
      s.shadow?.filename, s.shadow?.scopeId, s.shadow?.epoch,
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

  private enqueue(source: AtlasRegionSource, job: object, lane: Lane = "selection") {
    if (this.closed) {
      return Promise.reject(new Error('Kartenausschnitt abgebrochen.'));
    }
    if (this.worker && this.sourceIdentity(source) !== this.identity) {
      this.cancel();
    }
    if(lane==='camera'||lane==='live'||lane==='author'){
      this.queued.get('terrain')?.reject(new Error('Geländeberechnung durch neuere Anfrage ersetzt.'));
      this.queued.delete('terrain');
    }
    this.queued.get(lane)?.reject(new Error('Kartenausschnitt durch neuere Anfrage ersetzt.'));
    const promise = new Promise<any>((resolve, reject) => {
      this.queued.set(lane, { source, job, resolve, reject, endQueue:terrainTraceStart("region.queue",source.revision) });
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
        const lane = LANE_PRIORITY.find(lane=>this.queued.has(lane))!,
          request = this.queued.get(lane)!;
        this.queued.delete(lane);request.endQueue();
        try {
          const value=await this.run(request.source, request.job);
          if(value?.terrainProjectionContinuation===true&&(request.job as {kind?:string}).kind==='terrain'){
            this.terrainYields++;
            if(['terrain','live','camera','author'].some(lane=>this.queued.has(lane as Lane)))request.reject(new Error('Geländeberechnung durch neuere Anfrage ersetzt.'));
            else this.queued.set('terrain',{...request,job:{...request.job,continuation:true},endQueue:()=>{}});
          }else if(value?.terrainContinuation===true&&(request.job as {kind?:string}).kind==='terrain-stroke'){
            if(this.queued.has('author'))request.reject(new Error('Geländeberechnung durch neueren Auftrag ersetzt.'));
            else this.queued.set('author',{...request,job:{...request.job,continuation:true},endQueue:()=>{}});
          }else request.resolve(value);
        } catch (e) {
          request.reject(e as Error);
        }
      }
    } finally {
      this.draining = false;
    }
  }

  private async run(source: AtlasRegionSource, job: object) {
    const identity = this.sourceIdentity(source), generation = this.generation;
    // A cancelled worker must release its database connection before its replacement starts.
    if (!this.worker) {
      await this.exit;
    }
    if (this.closed || generation !== this.generation) {
      throw new Error('Kartenausschnitt abgebrochen.');
    }
    if (!this.worker) {
      const worker = new Worker(this.workerFile, {
        workerData: { filename: source.filename, shadow: source.shadow },
      });
      this.starts++;
      this.worker = worker;
      this.identity = identity;
      this.exit = new Promise(resolve => worker.once('exit', resolve));
      worker.on('message', result => {
        if (this.worker !== worker) {
          return;
        }
        const pending = this.pending;
        this.pending = null;
        if (result.error) {
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
    const endRoundtrip=terrainTraceStart("worker.roundtrip",source.revision);
    const value = await new Promise<any>((resolve, reject) => {
      this.pending = { resolve, reject };
      this.worker!.postMessage({ ...job, source });
    });
    if (this.closed || generation !== this.generation) {
      throw new Error('Kartenausschnitt abgebrochen.');
    }
    endRoundtrip();this.source = source;
    return value;
  }

  async read(source: AtlasRegionSource, query: AtlasRegionQuery): Promise<AtlasRegionGeometry> {
    if (this.closed) {
      throw new Error('Kartenausschnitt abgebrochen.');
    }
    const key = JSON.stringify([source.filename, source.token, source.fence, query]);
    const hit = this.cache.get(key);
    if (hit) {
      this.cache.delete(key);
      this.cache.set(key, hit);
      return JSON.parse(hit.json);
    }
    const value = await this.enqueue(source, { kind: 'region', query }, 'camera') as AtlasRegionGeometry,
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

  prepareTerrainStroke(source:AtlasRegionSource,stroke:import('../src/app/terrain-brush').HeightStroke):Promise<import('../src/app/storage/terrain-scale').PreparedTerrainStroke>{return this.enqueue(source,{kind:'terrain-stroke',stroke},'author');}

  terrain(source:AtlasRegionSource,query:import('../src/app/terrain-projection').TerrainProjectionRequest):Promise<import('../src/app/terrain-projection').TerrainProjection>{return this.enqueue(source,{kind:'terrain',query},'terrain');}

  liveTerrain(source:AtlasRegionSource,query:import('../src/app/terrain-presentation').TerrainFrameQuery,base?:import('../src/app/terrain-frame').TerrainFrameIdentity):Promise<import('../src/app/terrain-presentation').TerrainFrame>{return this.enqueue(source,{kind:'terrain-live',query,base},'live');}

  focus(source: AtlasRegionSource, kind: 'room' | 'city' | 'building' | 'element' | 'scope', id: string): Promise<AtlasObjectFocus> {
    return this.enqueue(source, { kind: 'focus', objectKind: kind, id });
  }

  hit(source: AtlasRegionSource, query: AtlasRegionQuery, point: { x: number; y: number }): Promise<AtlasObjectFocus | null> {
    return this.enqueue(source, { kind: 'hit', query, point });
  }

  candidates(
    source: AtlasRegionSource, query: AtlasRegionQuery, point: { x: number; y: number },
    offset = 0, layer: 'geometry' | 'landscape' | 'all' = 'geometry', visualElementId?: string,
  ): Promise<AtlasHitPage> {
    return this.enqueue(source, { kind: 'candidates', query, point, offset, layer, visualElementId });
  }
}
