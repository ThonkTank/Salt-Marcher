import {atlasTilePlan,atlasPrefetchTiles} from './atlas-tile-plan.js';
/** Common ownership and publication rules for raster display products. */
export interface AtlasRasterTileRequest {tile: AtlasWorldTile; revision: number; contours?: number}
export interface AtlasRasterTile {tile: AtlasWorldTile; revision: number; fence: string}
export interface AtlasRasterTileAdapter<T extends AtlasRasterTile,R extends AtlasRasterTileRequest> {
  request(tile: AtlasWorldTile, revision: number, contours?: number): R;
  validate(reply: T, request: R, source: string): void;
}
import type {LandscapeBox} from './atlas-landscape.js';
import {atlasWorldTileBounds, type AtlasWorldTile} from './atlas-world-tiles.js';

const DEFAULT_MAX_BYTES = 32 * 1024 * 1024;
const DEFAULT_MAX_TILES = 64;
const TILE_OBJECT_OVERHEAD = 256;

export interface AtlasRasterStreamOptions {readonly maxBytes?: number; readonly maxTiles?: number;readonly maxRetainedTiles?:number;readonly coverageLod?:number}
export interface AtlasRasterStreamInput {
  readonly box: LandscapeBox;
  readonly focus?: LandscapeBox;
  readonly preload?:LandscapeBox;
  /** Per-view ceiling within the stream owner's allocation budget. */
  readonly maxTiles?: number;
  readonly metersPerPixel: number;
  readonly revision: number;
  readonly source: string;
  readonly contours?: number;
}
export interface AtlasRasterStreamFrame<T extends AtlasRasterTile> {
  readonly tiles: readonly T[];
  readonly complete: boolean;
  readonly overviewComplete:boolean;
  readonly generation: number;
}
interface CachedTile<T extends AtlasRasterTile> {readonly tile: T; readonly key: string; readonly bytes: number}

/** Overview-first loading with stable-camera retention and atomic refinement. */
export class AtlasRasterTileStream<T extends AtlasRasterTile,R extends AtlasRasterTileRequest> {
  private readonly maxBytes: number;
  private readonly maxTiles: number;
  private readonly maxRetainedTiles:number;
  private readonly coverageLod:number|undefined;
  private coverage=new Map<string,CachedTile<T>>();
  private coverageLevel:number|undefined;
  private viewInput:AtlasRasterStreamInput|undefined;
  private targetDetailKeys=new Set<string>();
  private generation = 0;
  private overviewComplete=false;
  private fetchTail:Promise<unknown>=Promise.resolve();
  private controller=new AbortController();
  private disposed = false;
  private identity: string | undefined;
  private visible = new Map<string, CachedTile<T>>();
  private staged = new Map<string, CachedTile<T>>();
  /** Insertion order is LRU order, oldest first. */
  private readonly cache = new Map<string, CachedTile<T>>();

  constructor(private readonly adapter: AtlasRasterTileAdapter<T,R>, options: AtlasRasterStreamOptions = {}) {
    this.maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    this.maxTiles = options.maxTiles ?? DEFAULT_MAX_TILES;
    this.maxRetainedTiles=options.maxRetainedTiles??Infinity;
    this.coverageLod=options.coverageLod;
    if(this.coverageLod!==undefined&&(!Number.isInteger(this.coverageLod)||this.coverageLod< -8||this.coverageLod>32))throw Error('Atlas coverage LOD must be a valid integer');
    if(this.maxRetainedTiles!==Infinity&&(!Number.isSafeInteger(this.maxRetainedTiles)||this.maxRetainedTiles<1))throw Error('Atlas retained tile budget must be positive');
    if (!Number.isSafeInteger(this.maxBytes) || this.maxBytes < 1) throw new Error('Atlas tile stream maxBytes must be a positive safe integer');
    if (!Number.isInteger(this.maxTiles) || this.maxTiles < 1 || this.maxTiles > 256) throw new Error('Atlas tile stream maxTiles must be an integer from 1 to 256');
  }

  async load(
    input: AtlasRasterStreamInput,
    fetch: (request: R, signal:AbortSignal) => Promise<T>,
    publish: (frame: AtlasRasterStreamFrame<T>) => void,
  ): Promise<void> {
    if (this.disposed) throw new Error('Atlas tile stream is disposed');
    const generation = ++this.generation;this.overviewComplete=false;
    this.controller.abort();this.controller=new AbortController();
    if (!input || !Number.isSafeInteger(input.revision) || input.revision < 0 || typeof input.source !== 'string' || !input.source
      || typeof fetch !== 'function' || typeof publish !== 'function') {
      throw new Error('Atlas tile stream input is invalid');
    }
    const contours = input.contours;
    if (contours !== undefined && (!Number.isFinite(contours) || (contours < 0 && contours !== -1) || contours > 100000)) {
      throw new Error('Atlas tile stream contours are invalid');
    }
    const limit=Math.min(input.maxTiles??this.maxTiles,this.maxTiles);
    const roots:AtlasWorldTile[]=[];
    if(this.coverageLod!==undefined&&limit>4){
      const lod=Math.max(this.coverageLod,this.coverageLevel??-8,Math.ceil(Math.log2(Math.max(input.box.width,input.box.height)/256)));
      this.coverageLevel=lod;const size=256*2**lod,x=Math.floor((input.box.x+input.box.width/2)/size-.5),y=Math.floor((input.box.y+input.box.height/2)/size-.5);
      for(const dy of [0,1])for(const dx of [0,1])roots.push({lod,x:x+dx,y:y+dy});
    }
    const plan = atlasTilePlan(input.box, input.metersPerPixel, {maxTiles: Math.max(1,limit-roots.length), focus: input.focus});
    this.targetDetailKeys=new Set(plan.detail.map(worldTileKey));
    const identity = sourceIdentity(input.source, input.revision, contours);
    this.viewInput=input;
    const compatible = this.identity === identity;
    this.identity = identity;

    // Camera movement does not invalidate terrain. Retain only old tiles that
    // still intersect the new viewport; changes to source content revoke them.
    if (compatible) {
      this.visible = new Map([...this.visible].filter(([, entry]) => intersectsBox(entry.tile.tile, input.box)));
    } else {
      this.visible = new Map();
      this.coverage.clear();
    }
    this.staged = new Map();
    this.overviewComplete=roots.length>0&&roots.every(t=>this.coverage.has(worldTileKey(t)));
    this.emit(generation, false, publish);

    // Four stable world-scale products keep real terrain behind the current
    // detail partition while a zoom-out read is still pending. They share the
    // existing CPU/tile budgets; their hidden portions are clipped by the
    // terrain presentation owner, rather than depth-competing with detail.
    if(roots.length){
      const next=new Map<string,CachedTile<T>>();
      for(const tile of roots){
        const entry=await this.getTile(this.adapter.request(tile,input.revision,contours),input.source,fetch,generation,new Set([...this.activeKeys(),...next.values()].map(e=>typeof e==='string'?e:e.key)));
        if(!this.isCurrent(generation)||!entry)return;
        next.set(worldTileKey(tile),entry);
      }
      this.coverage=next;this.overviewComplete=true;this.enforceBudget(this.activeKeys());this.emit(generation,false,publish);
    }

    const warmDetails=plan.detail.map(tile=>this.cache.get(cacheKey(input.source,this.adapter.request(tile,input.revision,contours))));
    if(warmDetails.every((entry):entry is CachedTile<T>=>!!entry)){
      // A camera-only update must not replace already resident detail with its
      // coarse overview. This also preserves the detail image on the return
      // journey; height and material still enter the frame as one product.
      this.visible=new Map(warmDetails.map(entry=>[worldTileKey(entry.tile.tile),entry]));
      for(const entry of warmDetails){this.cache.delete(entry.key);this.cache.set(entry.key,entry);}
      this.overviewComplete=true;this.enforceBudget(this.activeKeys());this.emit(generation,true,publish);
    }else{
    const detailsByParent = groupChildren(plan.detail,plan.overview);
    const parentTileKeys = new Map(plan.overview.map(tile => [worldTileKey(tile), tile]));
    const protectedKeys = () => this.activeKeys();
    const bridgeExistingFrame = this.visible.size > 0;

    // With an existing valid frame, assemble a complete new overview off-screen
    // and swap atomically. A cold start can publish each non-overlapping parent
    // as soon as it arrives so the first useful view is not delayed.
    // Permanent coverage roots already bridge every not-yet-refined part of the
    // view. Reading another four-tile overview first makes a continuously
    // changing zoom spend every short generation on disposable ancestors and
    // never reach the requested close sources. Without coverage roots the
    // overview remains the required atomic bridge.
    for (const tile of this.coverage.size ? [] : plan.overview) {
      if (!this.isCurrent(generation)) return;
      const request = this.adapter.request(tile, input.revision, contours);
      const loaded = await this.getTile(request, input.source, fetch, generation, protectedKeys());
      if (!this.isCurrent(generation)) return;
      if (!loaded) return;
      const key = worldTileKey(tile);
      if (bridgeExistingFrame) this.staged.set(key, loaded);
      else {
        this.visible.set(key, loaded);
        this.enforceBudget(protectedKeys());
        if(tile===plan.overview.at(-1))this.overviewComplete=true;
        this.emit(generation, false, publish);
      }
    }

    if (!this.coverage.size && bridgeExistingFrame && plan.overview.length > 0) {
      this.visible = new Map(this.staged);
      this.staged.clear();
      this.enforceBudget(protectedKeys());
      this.overviewComplete=true;
      this.emit(generation, false, publish);
    } else if (!this.coverage.size && plan.overview.length === 0 && plan.detail.length > 0) {
      // At the pyramid's top edge there is no coarse level to bridge with.
      // Assemble the requested tiles before replacing the retained frame.
      for (const tile of plan.detail) {
        if (!this.isCurrent(generation)) return;
        const request = this.adapter.request(tile, input.revision, contours);
        const key = cacheKey(input.source, request);
        const loaded = await this.getTile(request, input.source, fetch, generation, new Set([...protectedKeys(), key]));
        if (!this.isCurrent(generation)) return;
        if (!loaded) return;
        this.staged.set(worldTileKey(tile), loaded);
      }
      this.visible = new Map(this.staged);
      const assembled=this.visible;
      this.staged.clear();
      this.enforceBudget(protectedKeys());
      this.overviewComplete=true;
      this.emit(generation, false, publish);
      this.visible=assembled;
      this.emit(generation, true, publish);
      return;
    }

    for (const tile of plan.detail) {
      if (!this.isCurrent(generation)) return;
      const request = this.adapter.request(tile, input.revision, contours);
      const key = cacheKey(input.source, request);
      const loaded = await this.getTile(request, input.source, fetch, generation, new Set([...protectedKeys(), key]));
      if (!this.isCurrent(generation)) return;
      if (!loaded) return;
      const detailKey = worldTileKey(tile);
      this.staged.set(detailKey, loaded);

      if(this.coverage.size){
        // The shared field topology clips the permanent roots against every
        // ready detail tile, so a single close tile is a complete publication:
        // uncovered siblings still come from the roots and never become holes.
        // Publishing it immediately lets a fast uninterrupted zoom accumulate
        // useful near-camera sources instead of discarding a whole sibling set
        // when the next wheel event supersedes this generation.
        this.visible.set(detailKey,loaded);this.staged.delete(detailKey);this.enforceBudget(protectedKeys());this.emit(generation,false,publish);continue;
      }

      const parent = coveringParent(tile,plan.overview);
      const parentKey = worldTileKey(parent);
      const requiredChildren = detailsByParent.get(parentKey);
      const childrenReady = requiredChildren?.every(child => this.staged.has(worldTileKey(child))) ?? false;
      if (requiredChildren && childrenReady && (this.visible.has(parentKey)||this.coverage.size>0)) {
        // Replace in one map mutation block; no published frame can contain both
        // the coarse parent and any of its fine children.
        this.visible.delete(parentKey);
        for (const child of requiredChildren) {
          const childKey = worldTileKey(child);
          const entry = this.staged.get(childKey);
          if (entry) this.visible.set(childKey, entry);
          if(!this.coverage.size)this.staged.delete(childKey);
        }
        this.enforceBudget(protectedKeys());
        this.emit(generation, false, publish);
      } else if (!parentTileKeys.has(parentKey)) {
        this.visible.set(detailKey, loaded);
        if(!this.coverage.size)this.staged.delete(detailKey);
        this.enforceBudget(protectedKeys());
        this.emit(generation, false, publish);
      }
    }

    if (!this.isCurrent(generation)) return;
    if(this.coverage.size)this.visible=new Map(plan.detail.map(tile=>{const entry=this.staged.get(worldTileKey(tile))??this.cache.get(cacheKey(input.source,this.adapter.request(tile,input.revision,contours)));if(!entry)throw Error('Completed terrain detail lost its retained source');return[worldTileKey(tile),entry];}));
    this.staged.clear();
    this.enforceBudget(protectedKeys());
    this.emit(generation, true, publish);
    }
    if(input.preload)for(const tile of atlasPrefetchTiles(plan,input.preload)){
      if(!this.isCurrent(generation))return;
      // Preloading may use spare capacity, but cannot evict or coarsen the view.
      if(this.activeKeys().size>=this.maxRetainedTiles)break;
      try{await this.getTile(this.adapter.request(tile,input.revision,contours),input.source,fetch,generation,this.activeKeys());}
      // An optional neighbour must not invalidate an already complete view (for
      // example when Main stops accepting reads during native shutdown). The
      // adapter still validates every reply before it can enter the cache.
      catch{break;}
    }
  }

  get availableTiles(){return [...new Set([...this.cache.values(),...this.visible.values(),...this.staged.values(),...this.coverage.values()])].map(e=>({tile:e.tile.tile,revision:e.tile.revision,fence:e.tile.fence}));}
  get statistics(){return {bytes:this.retainedBytes(),tiles:new Set([...this.cache.values(),...this.visible.values(),...this.staged.values(),...this.coverage.values()].map(e=>e.tile)).size,visible:new Set([...this.visible.values(),...this.coverage.values()].map(e=>e.tile)).size,staged:this.staged.size};}

  /** Stop disposable reads without discarding the useful displayed cache. */
  cancel():void {this.controller.abort();this.generation++;this.staged.clear();}

  /** Invalidates in-flight loads and releases retained tile data. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.controller.abort();
    this.generation++;
    this.visible.clear();
    this.staged.clear();
    this.cache.clear();
    this.coverage.clear();
    this.identity = undefined;
  }

  private async getTile(
    request: R,
    source: string,
    fetch: (request: R, signal:AbortSignal) => Promise<T>,
    generation: number,
    keepKeys: Set<string>,
  ): Promise<CachedTile<T> | undefined> {
    const key = cacheKey(source, request);
    const cached = this.cache.get(key);
    if (cached) {
      this.cache.delete(key);
      this.cache.set(key, cached);
      return cached;
    }

    // A superseded load cannot launch another physical fetch. Even consumers
    // that do not support cancellation have at most one outstanding request.
    const signal=this.controller.signal,previous=this.fetchTail;
    let release!:()=>void;
    this.fetchTail=new Promise<void>(resolve=>{release=resolve;});
    let reply:T;
    try{
      await previous;
      if(!this.isCurrent(generation)||signal.aborted)return undefined;
      reply=await fetch(request,signal);
    }catch(error){if(!this.isCurrent(generation)||signal.aborted)return undefined;throw error;}
    finally{release();}
    if (!this.isCurrent(generation)) return undefined;
    this.adapter.validate(reply, request, source);
    const entry = {tile: reply, key, bytes: estimateBytes(reply)};
    this.cache.set(key, entry);
    keepKeys.add(key);
    try {
      this.enforceBudget(keepKeys);
    } catch (error) {
      if (this.cache.get(key) === entry) this.cache.delete(key);
      throw error;
    }
    return entry;
  }

  private emit(generation: number, complete: boolean, publish: (frame: AtlasRasterStreamFrame<T>) => void): void {
    if (!this.isCurrent(generation)) return;
    let visible=[...this.visible.values()];
    if(this.coverage.size&&this.viewInput){
      const input=this.viewInput;
      if(!complete){
        const pyramid=this.pyramidKeys();
        visible.push(...[...this.cache.values()].filter(e=>pyramid.has(e.key)&&intersectsBox(e.tile.tile,input.box)));
        visible=visible.filter(e=>atlasWorldTileBounds(e.tile.tile).sizeM/input.metersPerPixel>=8);
      }
      visible=visible.filter(e=>!this.coverage.has(worldTileKey(e.tile.tile))).sort((a,b)=>
        Number(this.targetDetailKeys.has(worldTileKey(b.tile.tile)))-Number(this.targetDetailKeys.has(worldTileKey(a.tile.tile)))||a.tile.tile.lod-b.tile.tile.lod);
      visible=visible.filter((e,i,all)=>all.findIndex(other=>other.key===e.key)===i).slice(0,Math.max(0,(input.maxTiles??this.maxTiles)-this.coverage.size));
      // Cached ancestors in the actual publication belong to the displayed
      // allocation too. Keep them in its owner map so eviction, byte accounting
      // and disposal include every published source, not only the target plan.
      this.visible=new Map(visible.map(entry=>[worldTileKey(entry.tile.tile),entry]));
    }
    const tiles = Object.freeze([...visible,...this.coverage.values()].filter((entry,index,all)=>all.findIndex(e=>worldTileKey(e.tile.tile)===worldTileKey(entry.tile.tile))===index).map(entry => entry.tile));
    publish(Object.freeze({tiles, complete, overviewComplete:this.overviewComplete||complete, generation}));
  }

  private isCurrent(generation: number): boolean {return !this.disposed && generation === this.generation;}

  private activeKeys(): Set<string> {
    return new Set([...this.visible.values(), ...this.staged.values(),...this.coverage.values()].map(entry => entry.key));
  }

  private enforceBudget(protectedKeys: Set<string>): void {
    while (this.retainedBytes() > this.maxBytes || this.statistics.tiles>this.maxRetainedTiles) {
      let evictKey: string | undefined;
      const pyramid=this.coverageLod===undefined?new Set<string>():this.pyramidKeys();
      for (const key of this.cache.keys()) {
        if (!protectedKeys.has(key)&&!pyramid.has(key)) {evictKey = key; break;}
      }
      if(evictKey===undefined){
        // LRU alone discards the most recently prepared close view on a return
        // to world scale. Preserve the finest anchor level and prefer removing
        // redundant intermediate levels before opening a gap in its scale path.
        const levels=[...new Set([...this.cache.values()].filter(e=>pyramid.has(e.key)).map(e=>e.tile.tile.lod))].sort((a,b)=>a-b);
        let redundancy=Infinity;
        for(const [key,entry]of this.cache){
          if(protectedKeys.has(key))continue;
          const index=levels.indexOf(entry.tile.tile.lod);
          const gap=index<=0||index===levels.length-1?Infinity:Math.min(levels[index]!-levels[index-1]!,levels[index+1]!-levels[index]!);
          if(evictKey===undefined||gap<redundancy){evictKey=key;redundancy=gap;}
        }
      }
      if (evictKey === undefined) throw new Error(this.retainedBytes()>this.maxBytes?`Atlas tile stream exceeds maxBytes (${this.maxBytes})`:`Atlas tile stream exceeds maxRetainedTiles (${this.maxRetainedTiles})`);
      this.cache.delete(evictKey);
    }
  }

  /** Keep the available scale pyramid around the current terrain anchor before
   * spending spare LRU capacity on peripheral tiles. No extra allocation budget. */
  private pyramidKeys():Set<string>{
    const input=this.viewInput;if(!input)return new Set();
    const box=input.focus??input.box,x=box.x+box.width/2,y=box.y+box.height/2;
    return new Set([...this.cache.values()].filter(e=>{if(e.tile.fence!==input.source||e.tile.revision!==input.revision)return false;const b=atlasWorldTileBounds(e.tile.tile),epsilon=Math.max(b.sizeM*1e-5,Math.abs(x)*Number.EPSILON*16,Math.abs(y)*Number.EPSILON*16);return x>=b.minX-epsilon&&x<=b.maxX+epsilon&&y>=b.minY-epsilon&&y<=b.maxY+epsilon;}).map(e=>e.key));
  }

  private retainedBytes(): number {
    const seen = new Set<T>();
    let bytes = 0;
    const add = (entry: CachedTile<T>) => {
      if (seen.has(entry.tile)) return;
      seen.add(entry.tile);
      bytes += entry.bytes;
    };
    for (const entry of this.cache.values()) add(entry);
    for (const entry of this.visible.values()) add(entry);
    for (const entry of this.staged.values()) add(entry);
    for (const entry of this.coverage.values()) add(entry);
    return bytes;
  }
}

function sourceIdentity(source: string, revision: number, contours?: number): string {
  return JSON.stringify([source, revision, contours ?? 0]);
}

function intersectsBox(tile: AtlasWorldTile, box: LandscapeBox): boolean {
  const bounds = atlasWorldTileBounds(tile);
  return bounds.minX < box.x + box.width && bounds.maxX > box.x
    && bounds.minY < box.y + box.height && bounds.maxY > box.y;
}

function cacheKey(source: string, request: AtlasRasterTileRequest): string {
  return JSON.stringify([source, request.revision, request.contours ?? 0, request.tile.lod, request.tile.x, request.tile.y]);
}

function worldTileKey(tile: AtlasWorldTile): string {return `${tile.lod}/${tile.x}/${tile.y}`;}

function parentOf(tile: AtlasWorldTile): AtlasWorldTile {
  const lod = tile.lod + 2;
  if (lod > 32) return {lod, x: tile.x, y: tile.y};
  const divisor = 2 ** (lod - tile.lod);
  return {lod, x: Math.floor(tile.x / divisor), y: Math.floor(tile.y / divisor)};
}

function coveringParent(tile: AtlasWorldTile, roots: readonly AtlasWorldTile[]): AtlasWorldTile {
  return roots.find(root => {const divisor=2 ** (root.lod-tile.lod);return root.lod>=tile.lod&&Math.floor(tile.x/divisor)===root.x&&Math.floor(tile.y/divisor)===root.y;}) ?? parentOf(tile);
}

function groupChildren(tiles: readonly AtlasWorldTile[], roots: readonly AtlasWorldTile[]): Map<string, AtlasWorldTile[]> {
  const groups = new Map<string, AtlasWorldTile[]>();
  for (const tile of tiles) {
    const key = worldTileKey(coveringParent(tile,roots));
    const children = groups.get(key) ?? [];
    children.push(tile);
    groups.set(key, children);
  }
  return groups;
}

/** Counts typed buffers exactly and JS containers conservatively for bounded caching. */
function estimateBytes(value: unknown): number {
  const objects = new Set<object>();
  const buffers = new Set<ArrayBufferLike>();
  const visit = (item: unknown): number => {
    if (item === null || item === undefined) return 0;
    if (typeof item === 'string') return item.length * 2;
    if (typeof item === 'number') return 8;
    if (typeof item === 'boolean') return 1;
    if (typeof item !== 'object') return 0;
    if (ArrayBuffer.isView(item)) {
      const buffer = item.buffer;
      if (buffers.has(buffer)) return 32;
      buffers.add(buffer);
      return buffer.byteLength + 32;
    }
    if (item instanceof ArrayBuffer) {
      if (buffers.has(item)) return 0;
      buffers.add(item);
      return item.byteLength;
    }
    if (objects.has(item)) return 0;
    objects.add(item);
    if (Array.isArray(item)) return 24 + item.length * 8 + item.reduce((sum, child) => sum + visit(child), 0);
    let bytes = 64;
    for (const [key, child] of Object.entries(item)) bytes += key.length * 2 + visit(child);
    return bytes;
  };
  return Math.max(TILE_OBJECT_OVERHEAD, visit(value));
}
