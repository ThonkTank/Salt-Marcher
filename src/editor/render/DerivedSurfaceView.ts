import {
  HEIGHT_LEVELS,
  clipBounds,
  houseBounds,
  intersectsBounds,
  unionBounds,
  type Bounds,
  type EditorDocument,
  type HeightSnapshot,
  type HouseHeader,
  type Point,
} from "../model";
import { encodeHeightDependency } from "../model/content-identity";
import {
  deriveFoundation,
  foundationBounds,
  pointwiseFoundation,
  pointwiseNatural,
  waterAtPoint,
  type FoundationResult,
} from "../model/surface";
import {
  lakeContainsPoint,
  RIVER_SAMPLE_SUPPORT,
  WATER_MAX_SOURCE_BYTES,
  waterBounds,
  type WaterSource,
} from "../model/water";

export interface SurfaceData {
  lake: Float32Array | null;
  lakeLayers: number;
  rivers: Float32Array;
  foundations: Float32Array;
}

/** Geometry and confirmed values captured with a terrain packet, never authors. */
export interface SurfaceFrame {
  readonly buffers: Set<ArrayBufferLike>;
  readonly bytes: number;
  prepare(): Generator<void, SurfaceData, void>;
}

export interface SurfaceReadNeed {
  key: string;
  version: number;
  kind: "height" | "water";
  bounds: Bounds;
}

export interface SurfaceState {
  ready: boolean;
  water: {
    id: string;
    name: string;
    kind: "lake" | "river";
    status: "current" | "stale" | "unknown";
    sourceIdentity: string;
    currentIdentity: string | null;
    reason: string | null;
  }[];
  foundations: {
    id: string;
    ready: boolean;
    base: number | null;
    top: number | null;
    bounds: Bounds;
    reason: string | null;
  }[];
  message: string | null;
}

interface Entry {
  key: string;
  version: number;
  bounds: Bounds;
  pending: boolean;
  reason: string | null;
}
interface WaterEntry extends Entry {
  kind: "water";
  source: WaterSource;
  identity: string | null;
}
interface HouseEntry extends Entry {
  kind: "house";
  house: HouseHeader;
  waterStamp: string;
  result: FoundationResult | null;
}
type DerivedEntry = WaterEntry | HouseEntry;
interface Work {
  entry: DerivedEntry;
  version: number;
  snapshot: HeightSnapshot;
  buffers: Set<ArrayBufferLike>;
  encoder?: Generator<Uint8Array, void>;
  foundation?: Generator<void, FoundationResult>;
  chunks: Uint8Array[];
  bytes: number;
  digest: boolean;
}

const SIZE = 128;
const SNAPSHOT_BYTES = 4 * 1024 * 1024;
// Includes the bounded control objects/maps, sampler index and search heap.
const FOUNDATION_METADATA_BYTES = 4 * 1024 * 1024;
const INITIAL_WORK_BYTES = 10 * 1024 * 1024;
const HASH_CONCAT_BYTES = 2 * 1024 * 1024;
const MAX_FOUNDATIONS = 64;
const MAX_SEGMENTS = 512;
const MAX_LAKE_POINTS = 4096;
let nextEntryVersion = 0;
const expand = (bounds: Bounds, radius: number): Bounds =>
  clipBounds([
    bounds[0] - radius,
    bounds[1] - radius,
    bounds[2] + radius,
    bounds[3] + radius,
  ]);
const split = (value: number): [number, number] => {
  const high = Math.fround(value);
  return [high, Math.fround(value - high)];
};

/**
 * One bounded, cooperative local derivation slot. Confirmed water geometry is
 * useful even while its dependency hash is pending/stale. Foundation values
 * are admitted only with a complete local read and a certified maximum.
 */
export class DerivedSurfaceView {
  private waters = new Map<string, WaterEntry>();
  private houses = new Map<string, HouseEntry>();
  private work: Work | null = null;
  private frames = new Map<string, SurfaceFrame | null>();
  private view: Bounds = [0, 0, 1, 1];
  private sourceKey = "";
  private geometryVersion = 0;
  private waterReady = false;
  private houseReady = false;
  private message: string | null = null;
  private cachedState: SurfaceState | null = null;
  private disposed = false;
  private sourceDocument: EditorDocument | null;
  version = 0;

  constructor(
    document: EditorDocument,
    private changed: (bounds?: Bounds) => void,
  ) {
    this.sourceDocument = document;
  }

  private get document(): EditorDocument {
    if (!this.sourceDocument)
      throw new Error("Die lokale Oberflächenansicht wurde geschlossen.");
    return this.sourceDocument;
  }

  /** Headers just outside the view can contribute their transition inside it. */
  static houseReadBounds(view: Bounds): Bounds {
    return expand(view, 500);
  }

  sync(view: Bounds, scale: number): void {
    if (this.disposed) return;
    const houseQuery = DerivedSurfaceView.houseReadBounds(view);
    const waterReady = this.document.isWaterRegionReady(view);
    const houseReady = this.document.isHouseRegionReady(houseQuery);
    const key = [
      ...view,
      scale,
      waterReady,
      houseReady,
      this.document.waterGeneration,
      this.document.houseGeneration,
    ].join(":");
    if (key === this.sourceKey) return;
    this.sourceKey = key;
    this.view = view;
    this.waterReady = waterReady;
    this.houseReady = houseReady;
    let geometryBounds: Bounds | undefined;
    const changedGeometry = (bounds: Bounds) => {
      geometryBounds = geometryBounds
        ? unionBounds(geometryBounds, bounds)
        : bounds;
    };
    const visibleWater = waterReady
      ? this.document.waterSourcesInBounds(view)
      : [];
    const waterIds = new Set(visibleWater.map((source) => source.id));
    for (const [id, entry] of this.waters) {
      if (waterIds.has(id)) continue;
      entry.version = ++nextEntryVersion;
      this.waters.delete(id);
      changedGeometry(waterBounds(entry.source));
    }
    for (const source of visibleWater) {
      const old = this.waters.get(source.id);
      if (old?.source === source) continue;
      if (old) {
        old.version = ++nextEntryVersion;
        changedGeometry(waterBounds(old.source));
      }
      this.waters.set(source.id, {
        kind: "water",
        key: `water:${source.id}`,
        version: ++nextEntryVersion,
        bounds: source.terrain.bounds,
        source,
        pending: true,
        identity: null,
        reason: null,
      });
      changedGeometry(waterBounds(source));
    }
    const visibleHouses = houseReady
      ? this.document
          .housesInBounds(houseQuery)
          .filter((house) => intersectsBounds(foundationBounds(house), view))
      : [];
    const candidates = visibleHouses.filter(
      (house) =>
        Math.max(house.width, house.depth, house.foundationTransition) *
          scale >=
        1,
    );
    const centerX = (view[0] + view[2]) / 2,
      centerY = (view[1] + view[3]) / 2;
    candidates.sort(
      (a, b) =>
        Math.hypot(a.x - centerX, a.y - centerY) -
          Math.hypot(b.x - centerX, b.y - centerY) || a.id.localeCompare(b.id),
    );
    const retained = candidates.slice(0, MAX_FOUNDATIONS);
    this.message =
      visibleHouses.length > retained.length
        ? "Weitere Fundamente werden in einer näheren Ansicht berechnet."
        : null;
    const houseIds = new Set(retained.map((house) => house.id));
    for (const [id, entry] of this.houses) {
      if (houseIds.has(id)) continue;
      entry.version = ++nextEntryVersion;
      this.houses.delete(id);
      changedGeometry(foundationBounds(entry.house));
    }
    for (const house of retained) {
      const bounds = houseBounds(house);
      const waterStamp = this.document.isWaterRegionReady(bounds)
        ? this.document
            .waterSourcesInBounds(bounds)
            .filter((source) => source.kind === "river")
            .map((source) => JSON.stringify(source))
            .join("|")
        : "unknown";
      const old = this.houses.get(house.id);
      if (old?.house === house && old.waterStamp === waterStamp) continue;
      if (old) {
        old.version = ++nextEntryVersion;
        changedGeometry(foundationBounds(old.house));
      }
      this.houses.set(house.id, {
        kind: "house",
        key: `foundation:${house.id}`,
        version: ++nextEntryVersion,
        bounds,
        house,
        waterStamp,
        pending: true,
        reason: null,
        result: null,
      });
      changedGeometry(foundationBounds(house));
    }
    this.touch(geometryBounds);
  }

  /** Only dependencies intersecting the actual author change become unknown. */
  invalidate(bounds: Bounds): void {
    let touched = false;
    for (const entry of [...this.waters.values(), ...this.houses.values()]) {
      if (!intersectsBounds(entry.bounds, bounds)) continue;
      entry.version = ++nextEntryVersion;
      entry.pending = true;
      entry.reason = null;
      if (entry.kind === "water") entry.identity = null;
      else entry.result = null;
      touched = true;
    }
    if (touched) this.touch(bounds);
  }

  private touch(bounds?: Bounds): void {
    this.version++;
    this.cachedState = null;
    if (bounds) {
      this.geometryVersion++;
      this.frames.clear();
    }
    this.changed(bounds);
  }

  private valid(work: Work): boolean {
    return (
      !this.disposed &&
      work.version === work.entry.version &&
      (work.entry.kind === "water"
        ? this.waters.get(work.entry.source.id) === work.entry
        : this.houses.get(work.entry.house.id) === work.entry)
    );
  }

  private entries(): DerivedEntry[] {
    // Small visible house platforms get feedback before background hash work.
    return [...this.houses.values(), ...this.waters.values()];
  }

  get pending(): boolean {
    return (
      Boolean(this.work) ||
      this.entries().some((entry) => entry.pending && !entry.reason)
    );
  }

  get pendingDigest(): boolean {
    return Boolean(this.work?.digest);
  }

  /** Logical charge for bounded JS structures not represented by ArrayBuffers. */
  get retainedMetadataBytes(): number {
    if (this.work?.foundation) return FOUNDATION_METADATA_BYTES;
    // The retired digest closure still owns its single confirmed author, even
    // after the much larger old document graph has been released.
    return this.disposed && this.work?.digest ? WATER_MAX_SOURCE_BYTES : 0;
  }

  /** Only the next allocation peak is reserved; owned buffers are already counted. */
  get nextPreparationBytes(): { cpuBytes: number; gpuBytes: number } {
    const work = this.work;
    return {
      cpuBytes: this.disposed
        ? 0
        : !work
          ? INITIAL_WORK_BYTES
          : work.digest || !this.valid(work) || work.foundation
            ? 0
            : HASH_CONCAT_BYTES,
      gpuBytes: 0,
    };
  }

  readNeed(): SurfaceReadNeed | null {
    if (this.disposed) return null;
    for (const entry of this.entries()) {
      if (!entry.pending || entry.reason) continue;
      if (
        entry.kind === "house" &&
        !this.document.isWaterRegionReady(entry.bounds)
      )
        return {
          key: entry.key,
          version: entry.version,
          kind: "water",
          bounds: entry.bounds,
        };
      if (!this.document.isReady(entry.bounds, HEIGHT_LEVELS))
        return {
          key: entry.key,
          version: entry.version,
          kind: "height",
          bounds: entry.bounds,
        };
    }
    return null;
  }

  retainHeightBounds(): Bounds | null {
    const need = this.readNeed();
    let bounds = need?.kind === "height" ? need.bounds : null;
    for (const entry of this.entries())
      if (
        entry.pending &&
        !entry.reason &&
        this.document.isReady(entry.bounds, HEIGHT_LEVELS)
      )
        bounds = bounds ? unionBounds(bounds, entry.bounds) : entry.bounds;
    return bounds;
  }

  retainWaterBounds(): Bounds[] {
    let bounds: Bounds | null = null;
    for (const entry of this.houses.values())
      bounds = bounds ? unionBounds(bounds, entry.bounds) : entry.bounds;
    return bounds ? [this.view, bounds] : [this.view];
  }

  failed(need: SurfaceReadNeed, error: unknown): void {
    const entry = this.entries().find((item) => item.key === need.key);
    if (
      !entry ||
      entry.version !== need.version ||
      !entry.bounds.every((value, index) => value === need.bounds[index])
    )
      return;
    entry.reason = error instanceof Error ? error.message : String(error);
    entry.pending = false;
    this.touch();
  }

  retry(): void {
    if (this.disposed) return;
    for (const entry of this.entries())
      if (entry.reason) {
        entry.reason = null;
        entry.pending = true;
        entry.version = ++nextEntryVersion;
      }
    this.touch();
  }

  step(deadline: number, maxSteps: number): number {
    if (this.disposed) return 0;
    let steps = 0;
    while (steps < maxSteps && performance.now() < deadline) {
      // An obsolete digest still owns its input until the asynchronous primitive
      // settles. It keeps this sole slot; rapid edits cannot spawn a hash queue.
      if (this.work && !this.valid(this.work)) {
        if (this.work.digest) break;
        this.work = null;
        break;
      }
      if (!this.work) {
        const entry = this.entries().find(
          (candidate) =>
            candidate.pending &&
            !candidate.reason &&
            this.document.isReady(candidate.bounds, HEIGHT_LEVELS) &&
            (candidate.kind === "water" ||
              this.document.isWaterRegionReady(candidate.bounds)),
        );
        if (!entry) break;
        try {
          const snapshot = this.document.snapshot(
            entry.bounds,
            HEIGHT_LEVELS,
            SNAPSHOT_BYTES,
          );
          const work: Work = {
            entry,
            version: entry.version,
            snapshot,
            buffers: new Set(snapshot.tiles.map((tile) => tile.values.buffer)),
            chunks: [],
            bytes: 0,
            digest: false,
          };
          if (entry.kind === "water")
            work.encoder = encodeHeightDependency(snapshot);
          else
            work.foundation = deriveFoundation(
              entry.house,
              snapshot,
              this.document.waterSourcesInBounds(entry.bounds),
            );
          this.work = work;
        } catch (error) {
          this.failed(
            {
              key: entry.key,
              version: entry.version,
              kind: "height",
              bounds: entry.bounds,
            },
            error,
          );
          steps++;
          break;
        }
      }
      const work = this.work;
      if (work.digest) break;
      steps++;
      try {
        if (work.encoder) {
          const next = work.encoder.next();
          if (next.done) {
            const bytes = new Uint8Array(work.bytes);
            let offset = 0;
            for (const chunk of work.chunks) {
              bytes.set(chunk, offset);
              offset += chunk.length;
            }
            work.chunks = [];
            work.buffers = new Set([bytes.buffer]);
            work.snapshot.tiles = [];
            work.digest = true;
            void crypto.subtle
              .digest("SHA-256", bytes)
              .then((digest) => {
                if (this.work === work) this.work = null;
                if (!this.valid(work) || work.entry.kind !== "water") return;
                work.entry.identity = `height-controls-v1:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
                work.entry.pending = false;
                this.touch();
              })
              .catch((error: unknown) => {
                if (this.valid(work))
                  this.failed(
                    {
                      key: work.entry.key,
                      version: work.version,
                      kind: "height",
                      bounds: work.entry.bounds,
                    },
                    error,
                  );
                if (this.work === work) this.work = null;
              });
          } else if (next.value.length) {
            work.chunks.push(next.value);
            work.bytes += next.value.length;
            work.buffers.add(next.value.buffer);
          }
        } else if (work.foundation) {
          const next = work.foundation.next();
          if (next.done && work.entry.kind === "house") {
            work.entry.result = next.value;
            work.entry.pending = false;
            work.entry.reason =
              next.value.status === "current"
                ? null
                : "Die Genauigkeit des Fundamentmaximums ist im lokalen Rechenbudget noch nicht belegt.";
            this.work = null;
            this.touch(foundationBounds(work.entry.house));
            break;
          }
        }
      } catch (error) {
        this.failed(
          {
            key: work.entry.key,
            version: work.version,
            kind: "height",
            bounds: work.entry.bounds,
          },
          error,
        );
        this.work = null;
        break;
      }
    }
    return steps;
  }

  freeze(bounds: Bounds, power: number): SurfaceFrame | null {
    if (this.disposed) return null;
    const key = `${this.geometryVersion}:${power}:${bounds.join(":")}`;
    if (this.frames.has(key)) return this.frames.get(key)!;
    const waters = this.document.isWaterRegionReady(bounds)
      ? this.document.waterSourcesInBounds(bounds)
      : [];
    const lakes = waters.filter((source) => source.kind === "lake");
    const lakeLevels = [...new Set(lakes.map((lake) => lake.level))].sort(
      (a, b) => a - b,
    );
    const segments = waters.flatMap((source) =>
      source.kind === "river"
        ? source.samples
            .slice(1)
            .map((b, i) => ({ a: source.samples[i], b }))
            .filter(({ a, b }) => {
              const width = Math.max(a.width, b.width);
              const radius =
                width / 2 + Math.max(width, 5) + RIVER_SAMPLE_SUPPORT;
              return intersectsBounds(
                expand(
                  [
                    Math.min(a.point[0], b.point[0]),
                    Math.min(a.point[1], b.point[1]),
                    Math.max(a.point[0], b.point[0]),
                    Math.max(a.point[1], b.point[1]),
                  ],
                  radius,
                ),
                bounds,
              );
            })
        : [],
    );
    const houses = [...this.houses.values()]
      .filter(
        (entry) =>
          entry.result?.status === "current" &&
          intersectsBounds(foundationBounds(entry.house), bounds),
      )
      .map(({ house, result }) => ({ house, result: result! }));
    if (
      segments.length > MAX_SEGMENTS ||
      houses.length > MAX_FOUNDATIONS ||
      lakeLevels.length > 8 ||
      lakes.reduce(
        (n, lake) => n + lake.rings.reduce((sum, ring) => sum + ring.length, 0),
        0,
      ) > MAX_LAKE_POINTS
    ) {
      const message =
        "Dieser Ausschnitt enthält zu viel Gewässergeometrie; näher heranzoomen.";
      if (this.message !== message) {
        this.message = message;
        this.touch();
      }
      this.frames.set(key, null);
      this.trimFrames();
      return null;
    }
    if (!lakes.length && !segments.length && !houses.length) {
      this.frames.set(key, null);
      this.trimFrames();
      return null;
    }
    const buffers = new Set<ArrayBufferLike>();
    let prepared: SurfaceData | null = null;
    let preparation: Generator<void, SurfaceData> | null = null;
    const build = function* (): Generator<void, SurfaceData> {
      const lake = lakes.length
        ? new Float32Array(SIZE * SIZE * 4 * lakeLevels.length)
        : null;
      const rivers = new Float32Array(segments.length * 12);
      const foundations = new Float32Array(houses.length * 12);
      if (lake) buffers.add(lake.buffer);
      buffers.add(rivers.buffer);
      buffers.add(foundations.buffer);
      const span = bounds[2] - bounds[0];
      if (lake)
        for (let y = 0; y < SIZE; y++)
          for (let x = 0; x < SIZE; x++) {
            const point: Point = [
              bounds[0] + ((x + 0.5) * span) / SIZE,
              bounds[1] + ((y + 0.5) * span) / SIZE,
            ];
            for (let layer = 0; layer < lakeLevels.length; layer++) {
              const level = lakeLevels[layer];
              if (
                lakes.some(
                  (source) =>
                    source.level === level && lakeContainsPoint(source, point),
                )
              )
                lake.set(
                  [...split(level), 1, 0],
                  ((layer * SIZE + y) * SIZE + x) * 4,
                );
            }
            if ((x & 7) === 7) yield;
          }
      for (let i = 0; i < segments.length; i++) {
        const { a, b } = segments[i];
        rivers.set(
          [
            a.point[0] - bounds[0],
            a.point[1] - bounds[1],
            b.point[0] - bounds[0],
            b.point[1] - bounds[1],
            a.width,
            b.width,
            ...split(a.level),
            ...split(b.level),
            0,
            0,
          ],
          i * 12,
        );
        if ((i & 15) === 15) yield;
      }
      for (let i = 0; i < houses.length; i++) {
        const { house, result } = houses[i];
        const angle = (house.rotation * Math.PI) / 180;
        const [baseHi, baseLo] = split(result!.baseUpper);
        foundations.set(
          [
            house.x - bounds[0],
            house.y - bounds[1],
            house.width / 2,
            house.depth / 2,
            Math.cos(angle),
            Math.sin(angle),
            house.foundationTransition,
            baseHi,
            baseLo,
            ...split(result!.topUpper),
            0,
          ],
          i * 12,
        );
        if ((i & 15) === 15) yield;
      }
      prepared = { lake, lakeLayers: lakeLevels.length, rivers, foundations };
      return prepared;
    };
    const frame: SurfaceFrame = {
      buffers,
      bytes:
        lakeLevels.length * SIZE * SIZE * 16 +
        segments.length * 48 +
        houses.length * 48,
      *prepare() {
        preparation ??= build();
        // Cancellation of one consumer leaves the shared immutable preparation
        // resumable. A second frozen packet never allocates a second buffer set.
        while (!prepared) {
          const next = preparation.next();
          if (next.done) return next.value;
          yield;
        }
        return prepared;
      },
    };
    this.frames.set(key, frame);
    this.trimFrames();
    return frame;
  }

  private trimFrames(): void {
    if (this.frames.size > 96)
      this.frames.delete(this.frames.keys().next().value!);
  }

  state(): SurfaceState {
    if (this.cachedState) return this.cachedState;
    const water: SurfaceState["water"] = [...this.waters.values()].map(
      (entry) => ({
        id: entry.source.id,
        name: entry.source.name,
        kind: entry.source.kind,
        status: !entry.identity
          ? "unknown"
          : entry.identity === entry.source.terrain.identity
            ? "current"
            : "stale",
        sourceIdentity: entry.source.terrain.identity,
        currentIdentity: entry.identity,
        reason: entry.reason,
      }),
    );
    const foundations: SurfaceState["foundations"] = [
      ...this.houses.values(),
    ].map((entry) => ({
      id: entry.house.id,
      ready: entry.result?.status === "current",
      base: entry.result?.status === "current" ? entry.result.baseUpper : null,
      top: entry.result?.status === "current" ? entry.result.topUpper : null,
      bounds: foundationBounds(entry.house),
      reason: entry.reason,
    }));
    return (this.cachedState = {
      ready:
        this.waterReady &&
        this.houseReady &&
        !this.message &&
        water.every((entry) => entry.status !== "unknown") &&
        foundations.every((entry) => entry.ready),
      water,
      foundations,
      message: this.message,
    });
  }

  sample(point: Point, natural: number | null) {
    if (this.disposed || natural === null) return null;
    const area = expand([point[0], point[1], point[0], point[1]], 1e-7);
    if (!this.document.isWaterRegionReady(area)) return null;
    const waters = this.document.waterSourcesInBounds(area);
    const riverBedHeight = pointwiseNatural(() => natural, waters, point);
    const water = waterAtPoint(waters, point, riverBedHeight);
    const surfaceHeight = pointwiseFoundation(
      riverBedHeight,
      [...this.houses.values()]
        .filter((entry) => entry.result?.status === "current")
        .map((entry) => ({ house: entry.house, foundation: entry.result! })),
      point,
    );
    return {
      point,
      naturalHeight: natural,
      riverBedHeight,
      surfaceHeight,
      waterLevel: water?.level ?? null,
      wet: !!water || riverBedHeight <= 0,
    };
  }

  retainedBuffers(): Set<ArrayBufferLike> {
    const buffers = new Set(this.work?.buffers);
    for (const frame of this.frames.values())
      for (const buffer of frame?.buffers ?? []) buffers.add(buffer);
    return buffers;
  }

  destroy(): void {
    this.disposed = true;
    this.sourceDocument = null;
    // WebCrypto cannot be cancelled. The old view keeps its sole input until
    // settlement so a session replacement can retain and account for it.
    if (!this.work?.digest) this.work = null;
    this.frames.clear();
    this.waters.clear();
    this.houses.clear();
    this.waterReady = false;
    this.houseReady = false;
    this.cachedState = null;
  }
}
