import { prepareHeightSampler } from "./height";
import { prepareLandscapeSampler } from "./landscape";
import {
  WATER_MAX_REGION_SOURCES,
  freezeWaterSource,
  sameWaterSource,
  validateWaterSource,
  waterBounds,
  waterKey,
  waterSourceBytes,
  type WaterSource,
  type WaterPatch,
} from "./water";
import {
  HOUSE_HEADER_BYTES,
  HOUSE_MAX_REGION_HEADERS,
  cloneHouseHeader,
  houseBounds,
  houseKey,
  sameHouseAuthors,
  validateHouseHeader,
  type HouseHeader,
  type HousePatch,
} from "./house";
import {
  HEIGHT_LEVELS,
  HEIGHT_MAX_ACTION_TILES,
  HEIGHT_TILE_BYTES,
  HEIGHT_TILE_CELLS,
  HEIGHT_TILE_SIZE,
  LANDSCAPE_MAX_LEVEL,
  LANDSCAPE_TILE_BYTES,
  LANDSCAPE_TILE_SIZE,
  WORLD_LIMIT,
  assertBounds,
  assertLevel,
  assertLandscapeLevel,
  assertLandscapeWeights,
  assertPoint,
  clipBounds,
  cloneHeightTile,
  cloneLandscapeTile,
  createLandscapeTile,
  heightControlAddress,
  heightSpacing,
  heightTileKey,
  heightTileSupport,
  intersectsBounds,
  landscapeCellAddress,
  landscapeCellCoordinate,
  landscapeSpacing,
  landscapeTileBounds,
  landscapeTileKey,
  parseHeightTileKey,
  parseLandscapeTileKey,
  unionBounds,
  validateHeightTile,
  validateLandscapeTile,
  type Bounds,
  type ChangeSet,
  type HeightBrush,
  type HeightPatch,
  type HeightSnapshot,
  type HeightTile,
  type LandscapeBrush,
  type LandscapePatch,
  type LandscapeSnapshot,
  type LandscapeTile,
  type LandscapeWeights,
  type Point,
  type SourceState,
  type SourcePatch,
} from "./types";
import { PrepaidBrush, type PrepaidBrushChange } from "./PrepaidBrush";
import {
  type BrushEffectReceipt,
  type BrushReservation,
  type BrushReservationContext,
} from "./BrushReservations";
import { preparePrepaidHeight, type HeightBrushBatch } from "./prepaid-height";

export interface EditorDocumentOptions {
  /** Only valid when creation of an empty store has actually succeeded. */
  empty?: boolean;
  /** Independent from height absence: opening terrain alone proves no landscape absence. */
  landscapeEmpty?: boolean;
  /** Header absence is independent from both raster source families. */
  housesEmpty?: boolean;
  /** Confirmed water sources have their own complete spatial reads. */
  watersEmpty?: boolean;
  sequence?: number;
  maxSourceBytes?: number;
  maxPendingBytes?: number;
  maxHistoryBytes?: number;
  maxHistoryActions?: number;
  maxGestureCells?: number;
}

interface Entry {
  state: Exclude<SourceState, "unknown">;
  tile?: HeightTile;
  localSequence: number;
}

interface LandscapeEntry {
  state: Exclude<SourceState, "unknown">;
  tile?: LandscapeTile;
  localSequence: number;
}

interface SpatialEntry<T> {
  header: T | null;
  localSequence: number;
}

export interface HouseUpdate {
  bounds: Bounds;
  patches: HousePatch[];
}

interface HouseGesture {
  key: string;
  label: string;
  before: HouseHeader | null;
  previousSequence: number;
  finished: Promise<void>;
  resolveFinished(): void;
  rejectFinished(error: Error): void;
}

export interface LandscapeUpdate {
  bounds: Bounds;
  /** Immutable changed sources shared with the live document. */
  patches: LandscapePatch[];
}

interface LandscapeGesture {
  brush: LandscapeBrush & { strength: number };
  before: Map<string, LandscapeTile | null>;
  previousSequences: Map<string, number>;
  cells: Map<
    string,
    Map<number, { before: LandscapeWeights; coverage: number }>
  >;
  cellCount: number;
  retainedBytes: number;
  bounds: Bounds | null;
  sealed: boolean;
  finished: Promise<void>;
  resolveFinished(): void;
  rejectFinished(error: Error): void;
}

/** Exact source requirement; the support halo belongs in bounds. */
export interface SourceNeed {
  bounds: Bounds;
  minLevel: number;
}

function assertSourceNeed(need: SourceNeed): void {
  assertBounds(need.bounds);
  if (
    !Number.isInteger(need.minLevel) ||
    need.minLevel < 0 ||
    need.minLevel > HEIGHT_LEVELS.length
  )
    throw new RangeError("Ungültige untere Quellenstufe.");
}

const coversLevel = (coverage: SourceNeed, level: number) =>
  level >= coverage.minLevel;

export interface HeightUpdate {
  bounds: Bounds;
  /** Shared immutable changed sources. Never mutate or transfer these buffers. */
  patches: HeightPatch[];
}

interface HistoryAction {
  label: string;
  patches: SourcePatch[];
  dirtyBounds: Bounds[];
  bytes: number;
}

interface Gesture {
  brush: HeightBrush;
  before: Map<string, HeightTile | null>;
  cells: Map<string, Set<number>>;
  cellCount: number;
  /** Reserved before/after payloads if this live action finishes now. */
  retainedBytes: number;
  bounds: Bounds | null;
  finished: Promise<void>;
  resolveFinished: () => void;
  rejectFinished: (error: Error) => void;
}

interface BrushContinuation {
  account: PrepaidBrush;
  context: BrushReservationContext;
  queue: {
    id: number;
    reservation: BrushReservation;
    remaining: number;
    total: number;
    points: number;
  }[];
  pendingPoints: number;
  pendingCells: number;
  sealed: boolean;
  complete: boolean;
  invalidated: boolean;
  lastAdmissionId: number;
  reservedRegions: Map<string, Bounds>;
  appliedRegions: Map<string, Bounds>;
  reservedBounds: Bounds | null;
  appliedBounds: Bounds | null;
}

export interface BrushAdmission {
  admissionId: number;
  bounds: Bounds | null;
  regions: Bounds[];
  reserved: boolean;
  reservedCells: number;
  /** Coefficient-effect sums, not normalized elapsed time. */
  acceptedTime: number;
  discardedTime: number;
  pendingPoints: number;
  examinedCells: number;
  /** Dense lookup reference capacity; not a heap-byte estimate. */
  lookupSlotCount: number;
}

export interface BrushAdvance {
  update: HeightUpdate | null;
  change: ChangeSet | null;
  complete: boolean;
  appliedAdmissionIds: number[];
  completedAdmissionIds: number[];
  appliedCells: number;
  applications: {
    admissionId: number;
    fromCell: number;
    toCell: number;
    totalCells: number;
  }[];
}

export class SourcesNotReadyError extends Error {
  constructor(public readonly bounds: Bounds) {
    super("Die benötigten lokalen Geländedaten sind noch nicht geladen.");
    this.name = "SourcesNotReadyError";
  }
}

/** Enumerate only a bounded local stencil. Broad views use a sparse region read. */
export function requiredHeightSources(
  bounds: Bounds,
  levels: readonly number[] = HEIGHT_LEVELS,
  maxKeys = 4096,
): string[] {
  assertBounds(bounds);
  const keys: string[] = [];
  for (const level of new Set(levels)) {
    const step = heightSpacing(level);
    const minControlX = Math.max(
      Math.ceil(-WORLD_LIMIT / step),
      Math.floor(bounds[0] / step) - 1,
    );
    const minControlY = Math.max(
      Math.ceil(-WORLD_LIMIT / step),
      Math.floor(bounds[1] / step) - 1,
    );
    const maxControlX = Math.min(
      Math.floor(WORLD_LIMIT / step),
      Math.floor(bounds[2] / step) + 2,
    );
    const maxControlY = Math.min(
      Math.floor(WORLD_LIMIT / step),
      Math.floor(bounds[3] / step) + 2,
    );
    const minX = Math.floor(minControlX / HEIGHT_TILE_SIZE);
    const minY = Math.floor(minControlY / HEIGHT_TILE_SIZE);
    const maxX = Math.floor(maxControlX / HEIGHT_TILE_SIZE);
    const maxY = Math.floor(maxControlY / HEIGHT_TILE_SIZE);
    if (keys.length + (maxX - minX + 1) * (maxY - minY + 1) > maxKeys)
      throw new RangeError(
        "Dieser Ausschnitt benötigt eine räumliche Sparse-Abfrage.",
      );
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++) keys.push(heightTileKey(level, x, y));
  }
  return keys;
}

function sameValues(a: HeightTile | null, b: HeightTile | null): boolean {
  if (!a || !b) return a === b;
  return a.values.every((value, index) => value === b.values[index]);
}

function sameLandscape(
  a: LandscapeTile | null,
  b: LandscapeTile | null,
): boolean {
  if (!a || !b) return a === b;
  return (
    a.mask.every((value, index) => value === b.mask[index]) &&
    a.values.every((value, index) => value === b.values[index])
  );
}

function assertLandscapeNeed(need: SourceNeed): void {
  assertBounds(need.bounds);
  if (
    !Number.isInteger(need.minLevel) ||
    need.minLevel < 0 ||
    need.minLevel > LANDSCAPE_MAX_LEVEL + 1
  )
    throw new RangeError("Ungültige untere Landschaftsquellenstufe.");
}

/** Bounded editing stencil; broad display demand must use sparse region reads. */
export function requiredLandscapeSources(
  bounds: Bounds,
  minLevel = 0,
  maxKeys = 4096,
): string[] {
  assertLandscapeNeed({ bounds, minLevel });
  const keys: string[] = [];
  for (let level = minLevel; level <= LANDSCAPE_MAX_LEVEL; level++) {
    const step = landscapeSpacing(level);
    const minX = Math.floor(
      landscapeCellCoordinate(bounds[0], step) / LANDSCAPE_TILE_SIZE,
    );
    const minY = Math.floor(
      landscapeCellCoordinate(bounds[1], step) / LANDSCAPE_TILE_SIZE,
    );
    const maxX = Math.floor(
      Math.max(
        landscapeCellCoordinate(bounds[0], step),
        Math.ceil(bounds[2] / step) - 1,
      ) / LANDSCAPE_TILE_SIZE,
    );
    const maxY = Math.floor(
      Math.max(
        landscapeCellCoordinate(bounds[1], step),
        Math.ceil(bounds[3] / step) - 1,
      ) / LANDSCAPE_TILE_SIZE,
    );
    if (keys.length + (maxX - minX + 1) * (maxY - minY + 1) > maxKeys)
      throw new RangeError(
        "Dieser Ausschnitt benötigt eine räumliche Sparse-Abfrage.",
      );
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++)
        keys.push(landscapeTileKey(level, x, y));
  }
  return keys;
}

/** Convex coverage, rounded with a shared total so four channels never exceed 255. */
function blendLandscape(
  before: LandscapeWeights,
  target: LandscapeWeights,
  coverage: number,
): LandscapeWeights {
  const exact = before.map(
    (value, channel) => value * (1 - coverage) + target[channel] * coverage,
  );
  const values = exact.map(Math.floor) as LandscapeWeights;
  let remainder =
    Math.round(exact.reduce((sum, value) => sum + value, 0)) -
    values.reduce((sum, value) => sum + value, 0);
  const order = [0, 1, 2, 3].sort(
    (a, b) => exact[b] - values[b] - (exact[a] - values[a]) || a - b,
  );
  for (const channel of order) if (remainder-- > 0) values[channel]++;
  return values;
}

function copyPatch(patch: HeightPatch): HeightPatch {
  return {
    key: patch.key,
    before: patch.before && cloneHeightTile(patch.before),
    after: patch.after && cloneHeightTile(patch.after),
  };
}

function retainedPatchBytes(patches: readonly SourcePatch[]): number {
  return patches.reduce(
    (sum, patch) =>
      sum +
      (patch.kind === "water"
        ? (patch.before ? waterSourceBytes(patch.before) : 0) +
          (patch.after ? waterSourceBytes(patch.after) : 0)
        : (Number(!!patch.before) + Number(!!patch.after)) *
          (patch.kind === "height"
            ? HEIGHT_TILE_BYTES
            : patch.kind === "landscape"
              ? LANDSCAPE_TILE_BYTES
              : HOUSE_HEADER_BYTES)),
    0,
  );
}

function contained(a: Bounds, b: Bounds): boolean {
  return a[0] <= b[0] && a[1] <= b[1] && a[2] >= b[2] && a[3] >= b[3];
}

interface SpatialAuthorRules<T extends { id: string; revision: number }> {
  limit: number;
  key(id: string): string;
  bounds(author: T): Bounds;
  bytes(author: T): number;
  validate(author: T): void;
  same(a: T | null, b: T | null): boolean;
  own(author: T): T;
}

const houseRules: SpatialAuthorRules<HouseHeader> = {
  limit: HOUSE_MAX_REGION_HEADERS,
  key: houseKey,
  bounds: houseBounds,
  bytes: () => HOUSE_HEADER_BYTES,
  validate: validateHouseHeader,
  same: (a, b) => sameHouseAuthors(a, b) && a?.revision === b?.revision,
  own: (header) => Object.freeze(cloneHouseHeader(header)),
};
const waterRules: SpatialAuthorRules<WaterSource> = {
  limit: WATER_MAX_REGION_SOURCES,
  key: waterKey,
  bounds: waterBounds,
  bytes: waterSourceBytes,
  validate: validateWaterSource,
  same: sameWaterSource,
  own: freezeWaterSource,
};

/** Common complete-query/absence plan; no source changes before all validation. */
function spatialReadPlan<T extends { id: string; revision: number }>(
  entries: ReadonlyMap<string, SpatialEntry<T>>,
  bounds: Bounds,
  authors: readonly T[],
  sequence: number,
  pinned: (key: string) => boolean,
  rules: SpatialAuthorRules<T>,
): { changes: [string, T | null][]; bytes: number } {
  if (!Array.isArray(authors) || authors.length > rules.limit)
    throw new RangeError("Die räumliche Antwort überschreitet ihr Budget.");
  const received = new Map<string, T>();
  for (const author of authors) {
    rules.validate(author);
    const key = rules.key(author.id);
    if (!intersectsBounds(rules.bounds(author), bounds) || received.has(key))
      throw new Error("Unvollständige oder unpassende räumliche Antwort.");
    received.set(key, author);
  }
  const affected = new Set(received.keys());
  for (const [key, entry] of entries)
    if (entry.header && intersectsBounds(rules.bounds(entry.header), bounds))
      affected.add(key);
  const changes: [string, T | null][] = [];
  let bytes = 0;
  for (const key of affected) {
    const prior = entries.get(key);
    if (pinned(key) || (prior?.localSequence ?? 0) > sequence) continue;
    const next = received.get(key) ?? null;
    if (rules.same(prior?.header ?? null, next)) continue;
    bytes +=
      (next ? rules.bytes(next) : 0) -
      (prior?.header ? rules.bytes(prior.header) : 0);
    changes.push([key, next]);
  }
  return { changes, bytes };
}

function rememberSpatialCoverage(coverage: Bounds[], bounds: Bounds): boolean {
  if (coverage.some((prior) => contained(prior, bounds))) return false;
  const retained = coverage.filter((prior) => !contained(bounds, prior));
  coverage.splice(0, coverage.length, ...retained, [...bounds]);
  if (coverage.length > 256) coverage.shift();
  return true;
}

function spatialRegionReady(
  coverage: readonly Bounds[],
  bounds: Bounds,
): boolean {
  assertBounds(bounds);
  let remaining: Bounds[] = [bounds];
  for (const part of coverage) {
    if (contained(part, bounds)) return true;
    remaining = remaining.flatMap((area) => subtract(area, part));
    if (!remaining.length) return true;
  }
  return false;
}

function clipSpatialCoverage(
  coverage: readonly Bounds[],
  needs: readonly Bounds[],
): Bounds[] {
  const result: Bounds[] = [];
  for (const part of coverage)
    for (const need of needs) {
      const bounds: Bounds = [
        Math.max(part[0], need[0]),
        Math.max(part[1], need[1]),
        Math.min(part[2], need[2]),
        Math.min(part[3], need[3]),
      ];
      if (bounds[0] < bounds[2] && bounds[1] < bounds[3])
        rememberSpatialCoverage(result, bounds);
    }
  return result;
}

function sameSpatialCoverage(
  a: readonly Bounds[],
  b: readonly Bounds[],
): boolean {
  return (
    a.length === b.length &&
    a.every((bounds, index) => bounds.every((n, axis) => n === b[index][axis]))
  );
}

function spatialAuthors<T extends { id: string; revision: number }>(
  entries: ReadonlyMap<string, SpatialEntry<T>>,
  bounds: Bounds,
  rules: SpatialAuthorRules<T>,
): T[] {
  const authors: T[] = [];
  for (const { header } of entries.values()) {
    if (!header || !intersectsBounds(rules.bounds(header), bounds)) continue;
    if (authors.length === rules.limit)
      throw new RangeError(
        "Der Bereich überschreitet sein Darstellungsbudget; näher heranzoomen.",
      );
    authors.push(header);
  }
  return authors.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Subtract a closed rectangle's interior; no false coverage across an L-shaped hole. */
function subtract(a: Bounds, b: Bounds): Bounds[] {
  if (!intersectsBounds(a, b)) return [a];
  const x0 = Math.max(a[0], b[0]),
    y0 = Math.max(a[1], b[1]);
  const x1 = Math.min(a[2], b[2]),
    y1 = Math.min(a[3], b[3]);
  const result: Bounds[] = [];
  if (a[0] < x0) result.push([a[0], a[1], x0, a[3]]);
  if (x1 < a[2]) result.push([x1, a[1], a[2], a[3]]);
  if (a[1] < y0) result.push([x0, a[1], x1, y0]);
  if (y1 < a[3]) result.push([x0, y1, x1, a[3]]);
  return result;
}

/** Active sources and user history have one owner; storage is an ordered follower. */
export class EditorDocument {
  readonly sessionId: string;
  revision = 0;
  generation = 0;
  /** Header presentation identity; terrain changes never rebuild roof geometry. */
  houseGeneration = 0;
  waterGeneration = 0;
  sequence: number;
  persistedSequence: number;
  private readonly options: Required<
    Omit<
      EditorDocumentOptions,
      "empty" | "landscapeEmpty" | "housesEmpty" | "watersEmpty"
    >
  >;
  private readonly entries = new Map<string, Entry>();
  private readonly landscapeEntries = new Map<string, LandscapeEntry>();
  private readonly houseEntries = new Map<string, SpatialEntry<HouseHeader>>();
  private readonly waterEntries = new Map<string, SpatialEntry<WaterSource>>();
  private coverage: SourceNeed[] = [];
  private landscapeCoverage: SourceNeed[] = [];
  private houseCoverage: Bounds[] = [];
  private waterCoverage: Bounds[] = [];
  private gesture: Gesture | null = null;
  private landscapeGesture: LandscapeGesture | null = null;
  private houseGesture: HouseGesture | null = null;
  private prepaid: BrushContinuation | null = null;
  private invalidationError: Error | null = null;
  private history: HistoryAction[] = [];
  private historyPosition = 0;
  private readonly pending = new Map<
    number,
    { bytes: number; change: ChangeSet }
  >();
  private sourceBytes = 0;
  private landscapeSourceBytes = 0;
  private houseSourceBytes = 0;
  private waterSourceBytes = 0;
  private historyBytes = 0;
  private pendingBytes = 0;

  constructor(sessionId: string, options: EditorDocumentOptions = {}) {
    if (!sessionId) throw new Error("Dokumentsitzung fehlt.");
    this.sessionId = sessionId;
    this.options = {
      sequence: options.sequence ?? 0,
      maxSourceBytes: options.maxSourceBytes ?? 256 * 1024 * 1024,
      maxPendingBytes: options.maxPendingBytes ?? 32 * 1024 * 1024,
      maxHistoryBytes: options.maxHistoryBytes ?? 128 * 1024 * 1024,
      maxHistoryActions: options.maxHistoryActions ?? 100,
      maxGestureCells: options.maxGestureCells ?? 100_000,
    };
    for (const value of Object.values(this.options)) {
      if (!Number.isSafeInteger(value) || Number(value) < 0)
        throw new RangeError("Ungültiges Dokumentbudget oder Sequenznummer.");
    }
    if (this.options.maxHistoryActions < 1 || this.options.maxGestureCells < 1)
      throw new RangeError(
        "History und Gesten benötigen ein positives Budget.",
      );
    this.sequence = this.options.sequence;
    this.persistedSequence = this.sequence;
    if (options.empty)
      this.coverage.push({
        bounds: [-WORLD_LIMIT, -WORLD_LIMIT, WORLD_LIMIT, WORLD_LIMIT],
        minLevel: 0,
      });
    if (options.landscapeEmpty)
      this.landscapeCoverage.push({
        bounds: [-WORLD_LIMIT, -WORLD_LIMIT, WORLD_LIMIT, WORLD_LIMIT],
        minLevel: 0,
      });
    if (options.housesEmpty)
      this.houseCoverage.push([
        -WORLD_LIMIT,
        -WORLD_LIMIT,
        WORLD_LIMIT,
        WORLD_LIMIT,
      ]);
    if (options.watersEmpty)
      this.waterCoverage.push([
        -WORLD_LIMIT,
        -WORLD_LIMIT,
        WORLD_LIMIT,
        WORLD_LIMIT,
      ]);
  }

  get active(): boolean {
    return (
      this.gesture !== null ||
      this.landscapeGesture !== null ||
      this.houseGesture !== null
    );
  }

  get finishing(): boolean {
    return Boolean(
      (this.gesture && this.prepaid?.sealed) || this.landscapeGesture?.sealed,
    );
  }

  get disposed(): boolean {
    return this.invalidationError !== null;
  }

  /** Capture this action's completion, not a future gesture or a GPU receipt. */
  whenActionFinished(): Promise<void> {
    if (this.invalidationError) {
      const failed = Promise.reject<void>(this.invalidationError);
      void failed.catch(() => {});
      return failed;
    }
    return (
      this.gesture?.finished ??
      this.landscapeGesture?.finished ??
      this.houseGesture?.finished ??
      Promise.resolve()
    );
  }

  get brushWork() {
    const work = this.prepaid;
    if (!work) return null;
    return {
      ...work.account.usage,
      context: { ...work.context },
      sealed: work.sealed,
      complete: work.complete,
      pendingPoints: work.pendingPoints,
      pendingCells: work.pendingCells,
      pendingAdmissions: work.queue.length,
      reservedBounds:
        work.reservedBounds && ([...work.reservedBounds] as Bounds),
      appliedBounds: work.appliedBounds && ([...work.appliedBounds] as Bounds),
      appliedRegions: [...work.appliedRegions.values()].map(
        (bounds) => [...bounds] as Bounds,
      ),
      effectLimit: work.account.limit,
      maxOutstandingEffect: work.account.usage.maximumOutstanding,
    };
  }

  /** Detached documents must never resume an incomplete save or continuation. */
  invalidateContinuation(): void {
    if (this.invalidationError) return;
    this.invalidationError = new Error(
      "Die Dokumentsitzung wurde beendet; ihre unvollständige Aktion wurde verworfen.",
    );
    this.gesture?.rejectFinished(this.invalidationError);
    this.landscapeGesture?.rejectFinished(this.invalidationError);
    this.houseGesture?.rejectFinished(this.invalidationError);
    if (this.prepaid) this.prepaid.invalidated = true;
    this.gesture = null;
    this.landscapeGesture = null;
    this.houseGesture = null;
    this.prepaid = null;
  }

  /** The one accepted-change journal, borrowed read-only by the ordered writer. */
  pendingChanges(): readonly ChangeSet[] {
    return [...this.pending.values()].map(({ change }) => change);
  }

  /** Receipts release both retry data and projection data at one boundary. */
  acknowledge(receipt: {
    sessionId: string;
    sequence: number;
    transactionId: string;
  }): void {
    const change = this.pending.values().next().value?.change;
    if (
      !change ||
      receipt.sessionId !== this.sessionId ||
      receipt.sequence !== change.sequence ||
      receipt.transactionId !== change.transactionId
    )
      throw new Error(
        "Die Speicherbestätigung gehört nicht zur ausstehenden Änderung.",
      );
    this.acceptPersistence(receipt.sequence);
  }
  get canUndo(): boolean {
    return !this.active && this.historyPosition > 0;
  }
  get canRedo(): boolean {
    return !this.active && this.historyPosition < this.history.length;
  }
  get metrics() {
    return {
      sourceBytes: this.sourceBytes,
      landscapeSourceBytes: this.landscapeSourceBytes,
      houseSourceBytes: this.houseSourceBytes,
      waterSourceBytes: this.waterSourceBytes,
      historyBytes: this.historyBytes,
      pendingBytes: this.pendingBytes,
      gestureBeforeBytes:
        (this.gesture?.before.size ?? 0) * HEIGHT_TILE_BYTES +
        (this.landscapeGesture?.before.size ?? 0) * LANDSCAPE_TILE_BYTES +
        Number(!!this.houseGesture?.before) * HOUSE_HEADER_BYTES,
      gestureCells:
        this.gesture?.cellCount ?? this.landscapeGesture?.cellCount ?? 0,
      historyActions: this.history.length,
      readyTiles:
        (this.sourceBytes -
          this.landscapeSourceBytes -
          this.houseSourceBytes -
          this.waterSourceBytes) /
        HEIGHT_TILE_BYTES,
      landscapeReadyTiles: this.landscapeSourceBytes / LANDSCAPE_TILE_BYTES,
      readyHouses: this.houseSourceBytes / HOUSE_HEADER_BYTES,
      readyWaters: [...this.waterEntries.values()].filter(
        (entry) => entry.header,
      ).length,
      sourceEntries:
        this.entries.size +
        this.landscapeEntries.size +
        this.houseEntries.size +
        this.waterEntries.size,
      coverageRegions:
        this.coverage.length +
        this.landscapeCoverage.length +
        this.houseCoverage.length +
        this.waterCoverage.length,
    };
  }

  sourceState(key: string): SourceState {
    const parsed = parseHeightTileKey(key);
    const entry = this.entries.get(key);
    if (entry) return entry.state;
    const support = heightTileSupport(parsed);
    return this.coverage.some(
      (c) =>
        coversLevel(c, parsed.level) && intersectsBounds(support, c.bounds),
    )
      ? "absent"
      : "unknown";
  }

  landscapeSourceState(key: string): SourceState {
    const at = parseLandscapeTileKey(key);
    const entry = this.landscapeEntries.get(key);
    if (entry) return entry.state;
    return this.landscapeCoverage.some(
      (coverage) =>
        coversLevel(coverage, at.level) &&
        intersectsBounds(landscapeTileBounds(at), coverage.bounds),
    )
      ? "absent"
      : "unknown";
  }

  /** A loaded, immutable header; null does not certify global ID absence. */
  house(id: string): HouseHeader | null {
    return this.houseEntries.get(houseKey(id))?.header ?? null;
  }

  /** Complete spatial answers certify absence independently from terrain. */
  acceptHouseCoverage(
    bounds: Bounds,
    headers: readonly HouseHeader[],
    storeSequence = this.persistedSequence,
    sessionId = this.sessionId,
  ): void {
    const result = this.acceptSpatialCoverage(
      this.houseEntries,
      this.houseCoverage,
      houseRules,
      bounds,
      headers,
      storeSequence,
      sessionId,
      (key) => this.houseGesture?.key === key,
    );
    this.houseSourceBytes += result.bytes;
    if (result.changed) this.houseGeneration++;
  }

  private acceptSpatialCoverage<T extends { id: string; revision: number }>(
    entries: Map<string, SpatialEntry<T>>,
    coverage: Bounds[],
    rules: SpatialAuthorRules<T>,
    bounds: Bounds,
    authors: readonly T[],
    sequence: number,
    sessionId: string,
    pinned: (key: string) => boolean,
  ): { bytes: number; changed: boolean } {
    assertBounds(bounds);
    if (bounds[0] === bounds[2] || bounds[1] === bounds[3])
      throw new RangeError("Ein Quellenbereich benötigt eine positive Fläche.");
    if (this.invalidationError) throw this.invalidationError;
    if (sessionId !== this.sessionId)
      throw new Error("Quellen gehören zu einer anderen Sitzung.");
    if (
      !Number.isSafeInteger(sequence) ||
      sequence < 0 ||
      sequence > this.sequence
    )
      throw new Error("Ungültige Lesesequenz der Arbeitskopie.");
    if (sequence < this.persistedSequence) return { bytes: 0, changed: false };
    const plan = spatialReadPlan(
      entries,
      bounds,
      authors,
      sequence,
      pinned,
      rules,
    );
    if (
      this.sourceBytes + plan.bytes + this.reservedSourceBytes() >
      this.options.maxSourceBytes
    )
      throw new RangeError(
        "Aktive Quellen überschreiten das Speicherbudget; bestätigte Quellen zuerst verdrängen.",
      );
    // Own all new data before publishing any entry, including deep water geometry.
    const changes = plan.changes.map(
      ([key, author]) => [key, author && rules.own(author)] as const,
    );
    for (const [key, header] of changes) {
      const localSequence = entries.get(key)?.localSequence ?? 0;
      if (header) {
        entries.set(key, { header, localSequence });
        this.revision = Math.max(this.revision, header.revision);
      } else entries.delete(key);
    }
    this.sourceBytes += plan.bytes;
    const changed =
      rememberSpatialCoverage(coverage, bounds) || changes.length > 0;
    this.generation++;
    return { bytes: plan.bytes, changed };
  }

  isHouseRegionReady(bounds: Bounds): boolean {
    return spatialRegionReady(this.houseCoverage, bounds);
  }

  /** Bounded resident headers only; a missing spatial proof remains unknown. */
  housesInBounds(bounds: Bounds): readonly HouseHeader[] {
    if (!this.isHouseRegionReady(bounds))
      throw new Error(
        "Die benötigten lokalen Hausdaten sind noch nicht geladen.",
      );
    return spatialAuthors(this.houseEntries, bounds, houseRules);
  }

  private retainSpatialSources<T extends { id: string; revision: number }>(
    entries: Map<string, SpatialEntry<T>>,
    coverage: Bounds[],
    rules: SpatialAuthorRules<T>,
    needs: readonly Bounds[],
    pinned: (key: string) => boolean,
    extra: readonly Bounds[] = [],
  ): {
    coverage: Bounds[];
    removed: string[];
    bytes: number;
    changed: boolean;
  } {
    if (needs.length > 2)
      throw new RangeError(
        "Höchstens Darstellungs- und Werkzeugbedarf halten.",
      );
    needs.forEach(assertBounds);
    const retained = [...needs, ...extra];
    const nextCoverage = clipSpatialCoverage(coverage, retained);
    const removed: string[] = [];
    let bytes = 0;
    for (const [key, entry] of entries) {
      if (entry.localSequence > this.persistedSequence || pinned(key)) continue;
      if (
        entry.header &&
        retained.some((bounds) =>
          intersectsBounds(rules.bounds(entry.header!), bounds),
        )
      )
        continue;
      entries.delete(key);
      if (entry.header) {
        bytes -= rules.bytes(entry.header);
        removed.push(key);
      }
    }
    this.sourceBytes += bytes;
    this.generation++;
    return {
      coverage: nextCoverage,
      removed,
      bytes,
      changed:
        removed.length > 0 || !sameSpatialCoverage(coverage, nextCoverage),
    };
  }

  retainHouseSources(needs: readonly Bounds[]): string[] {
    const gesture = this.houseGesture;
    const extra: Bounds[] = [];
    if (gesture?.before) extra.push(houseBounds(gesture.before));
    const live = gesture && this.houseEntries.get(gesture.key)?.header;
    if (live) extra.push(houseBounds(live));
    const result = this.retainSpatialSources(
      this.houseEntries,
      this.houseCoverage,
      houseRules,
      needs,
      (key) => gesture?.key === key,
      extra,
    );
    this.houseCoverage = result.coverage;
    this.houseSourceBytes += result.bytes;
    if (result.changed) this.houseGeneration++;
    return result.removed;
  }

  water(id: string): WaterSource | null {
    return this.waterEntries.get(waterKey(id))?.header ?? null;
  }

  acceptWaterCoverage(
    bounds: Bounds,
    sources: readonly WaterSource[],
    storeSequence = this.persistedSequence,
    sessionId = this.sessionId,
  ): void {
    const result = this.acceptSpatialCoverage(
      this.waterEntries,
      this.waterCoverage,
      waterRules,
      bounds,
      sources,
      storeSequence,
      sessionId,
      () => false,
    );
    this.waterSourceBytes += result.bytes;
    if (result.changed) this.waterGeneration++;
  }

  isWaterRegionReady(bounds: Bounds): boolean {
    return spatialRegionReady(this.waterCoverage, bounds);
  }

  waterSourcesInBounds(bounds: Bounds): readonly WaterSource[] {
    if (!this.isWaterRegionReady(bounds))
      throw new Error(
        "Die benötigten lokalen Gewässerdaten sind noch nicht geladen.",
      );
    return spatialAuthors(this.waterEntries, bounds, waterRules);
  }

  retainWaterSources(needs: readonly Bounds[]): string[] {
    const result = this.retainSpatialSources(
      this.waterEntries,
      this.waterCoverage,
      waterRules,
      needs,
      () => false,
    );
    this.waterCoverage = result.coverage;
    this.waterSourceBytes += result.bytes;
    if (result.changed) this.waterGeneration++;
    return result.removed;
  }

  /** Atomic confirmed-source action, using the existing journal and history. */
  applyWaterSources(
    changes: readonly { id: string; after: WaterSource | null }[],
    label = "Gewässer ändern",
  ): ChangeSet | null {
    if (this.invalidationError) throw this.invalidationError;
    if (this.active) throw new Error("Eine andere Aktion ist bereits aktiv.");
    if (!Array.isArray(changes) || changes.length > WATER_MAX_REGION_SOURCES)
      throw new RangeError("Die Gewässeraktion überschreitet ihr Budget.");
    const seen = new Set<string>();
    const revision = this.revision + 1;
    const patches: WaterPatch[] = [];
    const dirty: Bounds[] = [];
    let nextBytes = this.sourceBytes;
    for (const change of changes) {
      const key = waterKey(change.id);
      if (seen.has(key))
        throw new RangeError("Doppelte Gewässeridentität in einer Aktion.");
      seen.add(key);
      const before = this.waterEntries.get(key)?.header ?? null;
      if (change.after) {
        validateWaterSource(change.after);
        if (change.after.id !== change.id)
          throw new RangeError("Gewässeridentität stimmt nicht überein.");
      }
      if (!before && !change.after) continue;
      const after = change.after && { ...change.after, revision };
      // Runtime author revisions do not turn an identical confirmed source into an edit.
      if (
        before &&
        after &&
        sameWaterSource(before, { ...after, revision: before.revision })
      )
        continue;
      for (const source of [before, after])
        if (source) {
          const bounds = waterBounds(source);
          if (!this.isWaterRegionReady(bounds))
            throw new Error(
              "Die benötigten lokalen Gewässerdaten sind noch nicht geladen.",
            );
          dirty.push(bounds);
        }
      nextBytes +=
        (after ? waterSourceBytes(after) : 0) -
        (before ? waterSourceBytes(before) : 0);
      patches.push({ key, before, after: after && freezeWaterSource(after) });
    }
    if (!patches.length) return null;
    const authored: SourcePatch[] = patches.map((patch) => ({
      kind: "water",
      ...patch,
    }));
    const bytes = retainedPatchBytes(authored);
    if (nextBytes > this.options.maxSourceBytes)
      throw new RangeError("Aktive Quellen überschreiten das Speicherbudget.");
    if (bytes > this.options.maxHistoryBytes)
      throw new RangeError(
        "Die Gewässeraktion überschreitet das Historybudget.",
      );
    if (this.pendingBytes + bytes > this.options.maxPendingBytes)
      throw new RangeError(
        "Die Arbeitskopie muss vorhandene Änderungen zuerst sichern.",
      );
    for (const patch of patches)
      this.waterEntries.set(patch.key, {
        header: patch.after,
        localSequence: this.sequence + 1,
      });
    this.waterSourceBytes += nextBytes - this.sourceBytes;
    this.sourceBytes = nextBytes;
    this.revision = revision;
    this.generation++;
    this.waterGeneration++;
    return this.recordHistory(label, authored, dirty);
  }

  /** A string edits a loaded ID; a fresh header creates a placement preview. */
  beginHouseGesture(
    target: string | HouseHeader,
    label?: string,
  ): HouseUpdate | null {
    if (this.invalidationError) throw this.invalidationError;
    if (this.active) throw new Error("Eine Autorenaktion ist bereits aktiv.");
    const creating = typeof target !== "string";
    const key = houseKey(creating ? target.id : target);
    const entry = this.houseEntries.get(key);
    const before = entry?.header ?? null;
    if (!creating && !before)
      throw new Error("Das gewählte Haus ist noch nicht geladen.");
    if (
      creating &&
      (this.houseEntries.has(key) ||
        this.history.some((action) =>
          action.patches.some(
            (patch) => patch.kind === "house" && patch.key === key,
          ),
        ))
    )
      throw new Error("Die Hausidentität ist bereits vergeben.");
    const header = creating ? target : before!;
    validateHouseHeader(header);
    if (!this.isHouseRegionReady(houseBounds(header)))
      throw new Error(
        "Die benötigten lokalen Hausdaten sind noch nicht geladen.",
      );
    if (creating) this.checkHouseBudget(null, null);
    let resolveFinished!: () => void;
    let rejectFinished!: (error: Error) => void;
    const finished = new Promise<void>((resolve, reject) => {
      resolveFinished = resolve;
      rejectFinished = reject;
    });
    void finished.catch(() => {});
    this.prepaid = null;
    this.houseGesture = {
      key,
      label: label ?? (creating ? "Haus platzieren" : "Haus verschieben"),
      before,
      previousSequence: entry?.localSequence ?? 0,
      finished,
      resolveFinished,
      rejectFinished,
    };
    return creating ? this.updateHouseGesture(header) : null;
  }

  private checkHouseBudget(
    before: HouseHeader | null,
    current: HouseHeader | null,
  ): void {
    const retainedBytes = (Number(!!before) + 1) * HOUSE_HEADER_BYTES;
    if (this.pendingBytes + retainedBytes > this.options.maxPendingBytes)
      throw new RangeError(
        "Die Arbeitskopie muss vorhandene Änderungen zuerst sichern.",
      );
    if (retainedBytes > this.options.maxHistoryBytes)
      throw new RangeError(
        "Diese Hausaktion überschreitet die lokale History.",
      );
    if (
      this.sourceBytes + Number(!current) * HOUSE_HEADER_BYTES >
      this.options.maxSourceBytes
    )
      throw new RangeError("Aktive Quellen überschreiten das Speicherbudget.");
  }

  updateHouseGesture(header: HouseHeader): HouseUpdate | null {
    if (this.invalidationError) throw this.invalidationError;
    const gesture = this.houseGesture;
    if (!gesture) throw new Error("Keine aktive Hausgeste.");
    validateHouseHeader(header);
    if (houseKey(header.id) !== gesture.key)
      throw new Error("Eine Hausgeste darf ihre Identität nicht wechseln.");
    const before = this.houseEntries.get(gesture.key)?.header ?? null;
    if (sameHouseAuthors(before, header)) return null;
    const bounds = houseBounds(header);
    if (!this.isHouseRegionReady(bounds))
      throw new Error(
        "Die benötigten lokalen Hausdaten sind noch nicht geladen.",
      );
    this.checkHouseBudget(gesture.before, before);
    const after = Object.freeze({
      ...cloneHouseHeader(header),
      revision: this.revision + 1,
    });
    this.houseEntries.set(gesture.key, {
      header: after,
      localSequence: this.sequence + 1,
    });
    if (!before) {
      this.sourceBytes += HOUSE_HEADER_BYTES;
      this.houseSourceBytes += HOUSE_HEADER_BYTES;
    }
    this.revision++;
    this.generation++;
    this.houseGeneration++;
    return {
      bounds: before ? unionBounds(houseBounds(before), bounds) : bounds,
      patches: [{ key: gesture.key, before, after }],
    };
  }

  finishHouseGesture(): ChangeSet | null {
    const gesture = this.houseGesture;
    if (!gesture) return null;
    const after = this.houseEntries.get(gesture.key)?.header ?? null;
    this.houseGesture = null;
    let change: ChangeSet | null = null;
    if (!sameHouseAuthors(gesture.before, after)) {
      const dirtyBounds = [gesture.before, after]
        .filter((value): value is HouseHeader => !!value)
        .map(houseBounds);
      change = this.recordHistory(
        gesture.label,
        [
          {
            kind: "house",
            key: gesture.key,
            before: gesture.before,
            after,
          },
        ],
        dirtyBounds,
      );
    } else if (gesture.before) {
      // Returning to the original pose is a no-op, including its content identity.
      this.houseEntries.set(gesture.key, {
        header: gesture.before,
        localSequence: gesture.previousSequence,
      });
      if (after !== gesture.before) this.houseGeneration++;
    }
    gesture.resolveFinished();
    return change;
  }

  /** Restore exact author identity without making a second transaction. */
  cancelHouseGesture(): HouseUpdate | null {
    const gesture = this.houseGesture;
    if (!gesture) return null;
    const before = this.houseEntries.get(gesture.key)?.header ?? null;
    const after = gesture.before;
    this.houseGesture = null;
    if (after || gesture.previousSequence > this.persistedSequence)
      this.houseEntries.set(gesture.key, {
        header: after,
        localSequence: gesture.previousSequence,
      });
    else this.houseEntries.delete(gesture.key);
    const delta = (Number(!!after) - Number(!!before)) * HOUSE_HEADER_BYTES;
    this.sourceBytes += delta;
    this.houseSourceBytes += delta;
    if (before === after) {
      gesture.resolveFinished();
      return null;
    }
    this.revision++;
    this.generation++;
    this.houseGeneration++;
    const bounds =
      before && after
        ? unionBounds(houseBounds(before), houseBounds(after))
        : houseBounds((before ?? after)!);
    gesture.resolveFinished();
    return { bounds, patches: [{ key: gesture.key, before, after }] };
  }

  /** One keyed cell lookup: undefined is unknown, null inherits, zero weights own. */
  readLandscapeCell(
    level: number,
    x: number,
    y: number,
  ): LandscapeWeights | null | undefined {
    const at = landscapeCellAddress(level, x, y);
    const tile = this.landscapeEntries.get(at.key)?.tile;
    if (!tile)
      return this.landscapeSourceState(at.key) === "unknown" ? undefined : null;
    if (!tile.mask[at.index]) return null;
    const offset = at.index * 4;
    return [
      tile.values[offset],
      tile.values[offset + 1],
      tile.values[offset + 2],
      tile.values[offset + 3],
    ];
  }

  acceptLandscapeCoverage(
    bounds: Bounds,
    tiles: readonly LandscapeTile[],
    storeSequence = this.persistedSequence,
    sessionId = this.sessionId,
    minLevel = 0,
  ): void {
    const coverage = { bounds, minLevel };
    assertLandscapeNeed(coverage);
    if (this.invalidationError) throw this.invalidationError;
    if (sessionId !== this.sessionId)
      throw new Error("Landschaftsdaten gehören zu einer anderen Sitzung.");
    if (
      !Number.isSafeInteger(storeSequence) ||
      storeSequence < 0 ||
      storeSequence > this.sequence
    )
      throw new Error("Ungültige Lesesequenz der Arbeitskopie.");
    if (storeSequence < this.persistedSequence) return;
    const affects = (key: string) => {
      const at = parseLandscapeTileKey(key);
      return (
        at.level >= minLevel &&
        intersectsBounds(landscapeTileBounds(at), bounds)
      );
    };
    const received = new Map<string, LandscapeTile>();
    for (const tile of tiles) {
      validateLandscapeTile(tile);
      if (!affects(tile.key) || received.has(tile.key))
        throw new Error(
          "Unvollständige oder unpassende räumliche Landschaftsantwort.",
        );
      received.set(tile.key, tile);
    }
    const affected = new Set(received.keys());
    for (const key of this.landscapeEntries.keys())
      if (affects(key)) affected.add(key);
    const changes: [string, LandscapeTile | null][] = [];
    let nextBytes = this.sourceBytes;
    for (const key of affected) {
      const prior = this.landscapeEntries.get(key);
      if (
        this.pinnedLandscapeSource(key) ||
        (prior?.localSequence ?? 0) > storeSequence
      )
        continue;
      const next = received.get(key) ?? null;
      nextBytes +=
        (Number(!!next) - Number(prior?.state === "ready")) *
        LANDSCAPE_TILE_BYTES;
      changes.push([key, next]);
    }
    if (nextBytes + this.reservedSourceBytes() > this.options.maxSourceBytes)
      throw new RangeError(
        "Aktive Quellen überschreiten das Speicherbudget; bestätigte Quellen zuerst verdrängen.",
      );
    for (const [key, tile] of changes) {
      const localSequence = this.landscapeEntries.get(key)?.localSequence ?? 0;
      if (tile) {
        this.landscapeEntries.set(key, {
          state: "ready",
          tile: cloneLandscapeTile(tile),
          localSequence,
        });
        this.revision = Math.max(this.revision, tile.revision);
      } else if (localSequence > this.persistedSequence)
        this.landscapeEntries.set(key, { state: "absent", localSequence });
      else this.landscapeEntries.delete(key);
    }
    this.landscapeSourceBytes += nextBytes - this.sourceBytes;
    this.sourceBytes = nextBytes;
    this.rememberLandscapeCoverage(coverage);
    this.generation++;
  }

  private rememberLandscapeCoverage(coverage: SourceNeed): void {
    this.landscapeCoverage = this.landscapeCoverage.filter(
      (old) =>
        !(
          old.minLevel >= coverage.minLevel &&
          contained(coverage.bounds, old.bounds)
        ),
    );
    this.landscapeCoverage.push({
      minLevel: coverage.minLevel,
      bounds: [...coverage.bounds],
    });
    if (this.landscapeCoverage.length > 256) this.landscapeCoverage.shift();
  }

  isLandscapeReady(bounds: Bounds, minLevel = 0): boolean {
    assertLandscapeNeed({ bounds, minLevel });
    let ready = true;
    for (let level = minLevel; level <= LANDSCAPE_MAX_LEVEL; level++) {
      let remaining: Bounds[] = [bounds];
      let covered = false;
      for (const coverage of this.landscapeCoverage) {
        if (coverage.minLevel > level) continue;
        if (contained(coverage.bounds, bounds)) {
          covered = true;
          break;
        }
        remaining = remaining.flatMap((area) =>
          subtract(area, coverage.bounds),
        );
        if (!remaining.length) {
          covered = true;
          break;
        }
      }
      if (!covered) {
        ready = false;
        break;
      }
    }
    if (ready) return true;
    try {
      return requiredLandscapeSources(bounds, minLevel).every(
        (key) => this.landscapeSourceState(key) !== "unknown",
      );
    } catch (error) {
      if (
        error instanceof RangeError &&
        error.message.includes("Sparse-Abfrage")
      )
        return false;
      throw error;
    }
  }

  /** Borrowed immutable sources: neither modify nor transfer these buffers. */
  landscapeSources(bounds: Bounds, minLevel = 0): readonly LandscapeTile[] {
    if (!this.isLandscapeReady(bounds, minLevel))
      throw new SourcesNotReadyError(bounds);
    const tiles: LandscapeTile[] = [];
    for (const entry of this.landscapeEntries.values())
      if (
        entry.tile &&
        entry.tile.level >= minLevel &&
        intersectsBounds(landscapeTileBounds(entry.tile), bounds)
      )
        tiles.push(entry.tile);
    return tiles;
  }

  landscapeSnapshot(bounds: Bounds, minLevel = 0): LandscapeSnapshot {
    return {
      sessionId: this.sessionId,
      generation: this.generation,
      revision: this.revision,
      sequence: this.sequence,
      bounds: [...bounds],
      minLevel,
      tiles: this.landscapeSources(bounds, minLevel).map(cloneLandscapeTile),
    };
  }

  sampleLandscape(x: number, y: number): LandscapeWeights {
    assertPoint([x, y]);
    const epsilon = 1e-7;
    const bounds = clipBounds([
      x - epsilon,
      y - epsilon,
      x + epsilon,
      y + epsilon,
    ]);
    return prepareLandscapeSampler(this.landscapeSources(bounds))(x, y);
  }

  private pinnedLandscapeSource(key: string): boolean {
    const gesture = this.landscapeGesture;
    if (!gesture) return false;
    if (gesture.before.has(key)) return true;
    const at = parseLandscapeTileKey(key);
    return (
      at.level >= gesture.brush.level &&
      !!gesture.bounds &&
      intersectsBounds(landscapeTileBounds(at), gesture.bounds)
    );
  }

  /** Same residency budget as height, with independent absence certificates. */
  retainLandscapeSources(needs: readonly SourceNeed[]): string[] {
    if (needs.length > 2)
      throw new RangeError(
        "Höchstens Darstellungs- und Werkzeugbedarf halten.",
      );
    needs.forEach(assertLandscapeNeed);
    const retained = [...needs];
    if (this.landscapeGesture?.bounds)
      retained.push({
        bounds: this.landscapeGesture.bounds,
        minLevel: this.landscapeGesture.brush.level,
      });
    const clipped: SourceNeed[] = [];
    for (const coverage of this.landscapeCoverage)
      for (const need of retained) {
        const bounds: Bounds = [
          Math.max(coverage.bounds[0], need.bounds[0]),
          Math.max(coverage.bounds[1], need.bounds[1]),
          Math.min(coverage.bounds[2], need.bounds[2]),
          Math.min(coverage.bounds[3], need.bounds[3]),
        ];
        if (bounds[0] < bounds[2] && bounds[1] < bounds[3])
          clipped.push({
            bounds,
            minLevel: Math.max(coverage.minLevel, need.minLevel),
          });
      }
    this.landscapeCoverage = [];
    for (const coverage of clipped) this.rememberLandscapeCoverage(coverage);
    const removed: string[] = [];
    for (const [key, entry] of this.landscapeEntries) {
      if (
        entry.localSequence > this.persistedSequence ||
        this.pinnedLandscapeSource(key)
      )
        continue;
      if (
        entry.tile &&
        needs.some(
          (need) =>
            entry.tile!.level >= need.minLevel &&
            intersectsBounds(landscapeTileBounds(entry.tile!), need.bounds),
        )
      )
        continue;
      this.landscapeEntries.delete(key);
      if (entry.tile) {
        this.sourceBytes -= LANDSCAPE_TILE_BYTES;
        this.landscapeSourceBytes -= LANDSCAPE_TILE_BYTES;
        removed.push(key);
      }
    }
    this.generation++;
    return removed;
  }

  /** Each supplied region is certified by a complete support-overlap store read. */
  acceptCoverage(
    bounds: Bounds,
    tiles: readonly HeightTile[],
    storeSequence = this.persistedSequence,
    sessionId = this.sessionId,
    minLevel = 0,
  ): void {
    const coverage = { minLevel, bounds };
    assertSourceNeed(coverage);
    this.acceptRead(coverage, tiles, storeSequence, sessionId);
  }

  private acceptRead(
    coverage: SourceNeed,
    tiles: readonly HeightTile[],
    storeSequence: number,
    sessionId: string,
  ): void {
    if (this.invalidationError) throw this.invalidationError;
    if (sessionId !== this.sessionId)
      throw new Error("Geländedaten gehören zu einer anderen Sitzung.");
    if (
      !Number.isSafeInteger(storeSequence) ||
      storeSequence < 0 ||
      storeSequence > this.sequence
    )
      throw new Error("Ungültige Lesesequenz der Arbeitskopie.");
    // Confirmed per-key markers may have been released. A read predating their
    // ACK must not recreate old authors or certify old absence anywhere.
    if (storeSequence < this.persistedSequence) return;
    const affects = (key: string) => {
      const tile = parseHeightTileKey(key);
      return (
        coversLevel(coverage, tile.level) &&
        intersectsBounds(heightTileSupport(tile), coverage.bounds)
      );
    };
    const received = new Map<string, HeightTile>();
    for (const tile of tiles) {
      validateHeightTile(tile);
      if (!affects(tile.key) || received.has(tile.key))
        throw new Error(
          "Unvollständige oder unpassende räumliche Höhenantwort.",
        );
      received.set(tile.key, tile);
    }
    const affectedKeys = new Set(received.keys());
    for (const key of this.entries.keys())
      if (affects(key)) affectedKeys.add(key);
    const changes: [string, HeightTile | null][] = [];
    let nextBytes = this.sourceBytes;
    for (const key of affectedKeys) {
      const prior = this.entries.get(key);
      // A valid store read can still lag an active or unacknowledged local edit.
      if (this.pinnedSource(key) || (prior?.localSequence ?? 0) > storeSequence)
        continue;
      const next = received.get(key) ?? null;
      nextBytes +=
        (next ? HEIGHT_TILE_BYTES : 0) -
        (prior?.state === "ready" ? HEIGHT_TILE_BYTES : 0);
      changes.push([key, next]);
    }
    if (nextBytes + this.reservedSourceBytes() > this.options.maxSourceBytes)
      throw new RangeError(
        "Aktive Höhenquellen überschreiten das Speicherbudget; bestätigte Quellen zuerst verdrängen.",
      );
    for (const [key, tile] of changes) {
      const localSequence = this.entries.get(key)?.localSequence ?? 0;
      if (tile)
        this.entries.set(key, {
          state: "ready",
          tile: cloneHeightTile(tile),
          localSequence,
        });
      else if (localSequence > this.persistedSequence)
        this.entries.set(key, { state: "absent", localSequence });
      else this.entries.delete(key);
      if (tile) this.revision = Math.max(this.revision, tile.revision);
    }
    this.sourceBytes = nextBytes;
    this.rememberCoverage(coverage);
    this.generation++;
  }

  private rememberCoverage(coverage: SourceNeed): void {
    this.coverage = this.coverage.filter(
      (old) =>
        !(
          old.minLevel >= coverage.minLevel &&
          contained(coverage.bounds, old.bounds)
        ),
    );
    this.coverage.push({
      minLevel: coverage.minLevel,
      bounds: [...coverage.bounds],
    });
    // Forgetting a proof can request another read, never invent absent authors.
    if (this.coverage.length > 256) this.coverage.shift();
  }

  isReady(bounds: Bounds, levels: readonly number[] = HEIGHT_LEVELS): boolean {
    assertBounds(bounds);
    levels.forEach(assertLevel);
    const coverages = this.retainedCoverage();
    const coverageReady = levels.every((level) => {
      let remaining: Bounds[] = [bounds];
      for (const coverage of coverages) {
        if (!coversLevel(coverage, level)) continue;
        if (contained(coverage.bounds, bounds)) return true;
        remaining = remaining.flatMap((area) =>
          subtract(area, coverage.bounds),
        );
        if (!remaining.length) return true;
      }
      return false;
    });
    // Coverage survives only while every positive contributor remains resident.
    // There is no exception dictionary of previously visited, evicted sources.
    if (coverageReady) return true;
    try {
      return requiredHeightSources(bounds, levels).every((key) => {
        const state = this.sourceState(key);
        return state === "ready" || state === "absent";
      });
    } catch (error) {
      if (
        error instanceof RangeError &&
        error.message.includes("Sparse-Abfrage")
      )
        return false;
      throw error;
    }
  }

  snapshot(
    bounds: Bounds,
    levels: readonly number[] = HEIGHT_LEVELS,
    maxBytes = Infinity,
  ): HeightSnapshot {
    if (!this.isReady(bounds, levels)) throw new SourcesNotReadyError(bounds);
    if (
      maxBytes !== Infinity &&
      (!Number.isSafeInteger(maxBytes) || maxBytes < 0)
    )
      throw new RangeError("Ungültiges Höhen-Snapshotbudget.");
    const selected = new Set(levels);
    const tiles: HeightTile[] = [];
    for (const entry of this.entries.values())
      if (
        entry.tile &&
        selected.has(entry.tile.level) &&
        intersectsBounds(heightTileSupport(entry.tile), bounds)
      ) {
        if ((tiles.length + 1) * HEIGHT_TILE_BYTES > maxBytes)
          throw new RangeError(
            "Die lokale Höhenmomentaufnahme überschreitet ihr Speicherbudget.",
          );
        tiles.push(entry.tile);
      }
    return {
      sessionId: this.sessionId,
      generation: this.generation,
      revision: this.revision,
      sequence: this.sequence,
      bounds: [...bounds],
      levels: [...levels],
      tiles: tiles.map(cloneHeightTile),
    };
  }

  sampleHeight(x: number, y: number): number {
    assertPoint([x, y]);
    // A tiny positive region keeps support intersection/coverage unambiguous at
    // exact boundaries. It does not approximate the sample position.
    const epsilon = 1e-7;
    const bounds = clipBounds([
      x - epsilon,
      y - epsilon,
      x + epsilon,
      y + epsilon,
    ]);
    return prepareHeightSampler(this.snapshot(bounds))(x, y);
  }

  /** Bounded read-only diagnostic: real authors and the existing C1 account. */
  observeBrushCoefficients(level: number, points: readonly Point[]) {
    assertLevel(level);
    if (points.length > 256)
      throw new RangeError("Höchstens 256 diagnostische Autorenproben.");
    const step = heightSpacing(level);
    const values = points.map((point) => {
      assertPoint(point);
      if (point.some((axis) => !Number.isInteger(axis / step)))
        throw new RangeError(
          "Autorenproben müssen auf dem Stützstellengitter liegen.",
        );
      const address = heightControlAddress(
        level,
        point[0] / step,
        point[1] / step,
      );
      const key = address.key;
      const known = this.sourceState(key) !== "unknown";
      const live = this.entries.get(key)?.tile;
      const prior = this.gesture?.before.has(key)
        ? this.gesture.before.get(key)
        : live;
      const account = this.prepaid?.account.valueAt(key, address.index);
      return {
        author: known ? (live?.values[address.index] ?? 0) : null,
        before: known ? (prior?.values[address.index] ?? 0) : null,
        minimum: account?.minimum ?? 0,
        timeAccount: account?.timeAccount ?? 0,
      };
    });
    return {
      authors: values.map((value) => value.author),
      before: values.map((value) => value.before),
      minimum: values.map((value) => value.minimum),
      timeAccount: values.map((value) => value.timeAccount),
    };
  }

  /** Accepted local source proofs remain valid while their contributors are pinned. */
  private retainedCoverage(): readonly SourceNeed[] {
    if (!this.gesture || !this.prepaid) return this.coverage;
    return [
      ...this.coverage,
      ...[...this.prepaid.reservedRegions.values()].map((bounds) => ({
        bounds,
        minLevel: this.gesture!.brush.level,
      })),
    ];
  }

  private pinnedSource(key: string): boolean {
    if (this.gesture?.before.has(key)) return true;
    if (!this.gesture || !this.prepaid) return false;
    const tile = parseHeightTileKey(key);
    if (tile.level < this.gesture.brush.level) return false;
    const support = heightTileSupport(tile);
    for (const bounds of this.prepaid.reservedRegions.values())
      if (intersectsBounds(support, bounds)) return true;
    return false;
  }

  private reservedSourceBytes(): number {
    if (!this.gesture || !this.prepaid) return 0;
    let missing = 0;
    for (const key of this.gesture.before.keys())
      if (this.entries.get(key)?.state !== "ready") missing++;
    return missing * HEIGHT_TILE_BYTES;
  }

  /** Keep display/tool requirements and pinned edits; return discarded copies. */
  retainSources(needs: readonly SourceNeed[]): string[] {
    if (needs.length > 2)
      throw new RangeError(
        "Höchstens Darstellungs- und Werkzeugbedarf halten.",
      );
    needs.forEach(assertSourceNeed);
    const retainedNeeds = [...needs];
    if (this.gesture && this.prepaid)
      for (const bounds of this.prepaid.reservedRegions.values())
        retainedNeeds.push({ bounds, minLevel: this.gesture.brush.level });
    const clipped: SourceNeed[] = [];
    for (const coverage of this.coverage)
      for (const need of retainedNeeds) {
        const bounds: Bounds = [
          Math.max(coverage.bounds[0], need.bounds[0]),
          Math.max(coverage.bounds[1], need.bounds[1]),
          Math.min(coverage.bounds[2], need.bounds[2]),
          Math.min(coverage.bounds[3], need.bounds[3]),
        ];
        if (bounds[0] < bounds[2] && bounds[1] < bounds[3])
          clipped.push({
            bounds,
            minLevel: Math.max(coverage.minLevel, need.minLevel),
          });
      }
    // Revoke broad proofs before removing their positive contributors. In
    // particular, a new world's original empty proof cannot outlive eviction.
    this.coverage = [];
    for (const coverage of clipped) this.rememberCoverage(coverage);
    const removed: string[] = [];
    for (const [key, entry] of this.entries) {
      if (
        entry.localSequence > this.persistedSequence ||
        this.pinnedSource(key)
      )
        continue;
      if (
        entry.tile &&
        needs.some(
          (need) =>
            coversLevel(need, entry.tile!.level) &&
            intersectsBounds(heightTileSupport(entry.tile!), need.bounds),
        )
      )
        continue;
      this.entries.delete(key);
      if (entry.tile) {
        this.sourceBytes -= HEIGHT_TILE_BYTES;
        removed.push(key);
      }
    }
    this.generation++;
    return removed;
  }

  beginLandscapeGesture(brush: LandscapeBrush): void {
    if (this.invalidationError) throw this.invalidationError;
    if (this.active) throw new Error("Eine Autorenaktion ist bereits aktiv.");
    assertLandscapeLevel(brush.level);
    assertLandscapeWeights(brush.weights);
    const strength = brush.strength ?? 1;
    if (
      !Number.isFinite(brush.radius) ||
      brush.radius <= 0 ||
      !Number.isFinite(strength) ||
      strength < 0 ||
      strength > 1
    )
      throw new RangeError("Ungültiger Landschaftspinsel.");
    if (((2 * brush.radius) / landscapeSpacing(brush.level) + 3) ** 2 > 400_000)
      throw new RangeError(
        "Landschaftspinsel zu groß; eine gröbere Autorenstufe wählen.",
      );
    let resolveFinished!: () => void;
    let rejectFinished!: (error: Error) => void;
    const finished = new Promise<void>((resolve, reject) => {
      resolveFinished = resolve;
      rejectFinished = reject;
    });
    void finished.catch(() => {});
    this.prepaid = null;
    this.landscapeGesture = {
      brush: { ...brush, weights: [...brush.weights], strength },
      before: new Map(),
      previousSequences: new Map(),
      cells: new Map(),
      cellCount: 0,
      retainedBytes: 0,
      bounds: null,
      sealed: false,
      finished,
      resolveFinished,
      rejectFinished,
    };
  }

  sealLandscapeGesture(): void {
    if (this.landscapeGesture) this.landscapeGesture.sealed = true;
  }

  /**
   * One bounded geometric segment. The controller owns the queued path; sealed
   * input may still drain here. Every source is copied once per materialization.
   */
  applyLandscapeSegment(from: Point, to: Point): LandscapeUpdate | null {
    const gesture = this.landscapeGesture;
    if (!gesture) throw new Error("Keine aktive Landschaftsgeste.");
    assertPoint(from);
    assertPoint(to);
    const brush = gesture.brush;
    if (brush.strength === 0) return null;
    const bounds = clipBounds([
      Math.min(from[0], to[0]) - brush.radius,
      Math.min(from[1], to[1]) - brush.radius,
      Math.max(from[0], to[0]) + brush.radius,
      Math.max(from[1], to[1]) + brush.radius,
    ]);
    if (!this.isLandscapeReady(bounds, brush.level))
      throw new SourcesNotReadyError(bounds);
    const step = landscapeSpacing(brush.level);
    const minX = landscapeCellCoordinate(bounds[0], step),
      minY = landscapeCellCoordinate(bounds[1], step);
    const maxX = Math.max(minX, Math.ceil(bounds[2] / step) - 1),
      maxY = Math.max(minY, Math.ceil(bounds[3] / step) - 1);
    if ((maxX - minX + 1) * (maxY - minY + 1) > 400_000)
      throw new RangeError(
        "Landschaftssegment überschreitet den begrenzten Arbeitsbereich.",
      );
    const dx = to[0] - from[0],
      dy = to[1] - from[1],
      length2 = dx * dx + dy * dy;
    const candidates: {
      key: string;
      index: number;
      tileX: number;
      tileY: number;
      before: LandscapeWeights;
      coverage: number;
      values: LandscapeWeights;
      changed: boolean;
      bounds: Bounds;
    }[] = [];
    const newKeys = new Set<string>();
    let newCells = 0;
    for (let cy = minY; cy <= maxY; cy++) {
      const bottom = Math.max(-WORLD_LIMIT, cy * step),
        top = Math.min(WORLD_LIMIT, (cy + 1) * step);
      if (bottom >= top) continue;
      const y = (bottom + top) / 2;
      for (let cx = minX; cx <= maxX; cx++) {
        const left = Math.max(-WORLD_LIMIT, cx * step),
          right = Math.min(WORLD_LIMIT, (cx + 1) * step);
        if (left >= right) continue;
        const x = (left + right) / 2;
        const t = length2
          ? Math.max(
              0,
              Math.min(1, ((x - from[0]) * dx + (y - from[1]) * dy) / length2),
            )
          : 0;
        const distance2 =
          (x - from[0] - t * dx) ** 2 + (y - from[1] - t * dy) ** 2;
        if (distance2 >= brush.radius ** 2) continue;
        // Full inner half-radius reaches every target exactly. The outer ring
        // uses (1 - (2d/R - 1)^2)^2 and joins both ends with zero derivative.
        const rim = Math.max(0, (2 * Math.sqrt(distance2)) / brush.radius - 1);
        const coverage = (1 - rim * rim) ** 2 * brush.strength;
        if (coverage === 0) continue;
        const at = landscapeCellAddress(brush.level, x, y);
        const previous = gesture.cells.get(at.key)?.get(at.index);
        if (previous && previous.coverage >= coverage) continue;
        let before = previous?.before;
        if (!before) {
          for (let level = brush.level; level <= LANDSCAPE_MAX_LEVEL; level++) {
            const value = this.readLandscapeCell(level, x, y);
            if (value === undefined) throw new SourcesNotReadyError(bounds);
            if (value !== null) {
              before = value;
              break;
            }
          }
          before ??= [0, 0, 0, 0];
        }
        const values = blendLandscape(before, brush.weights, coverage);
        const live = this.landscapeEntries.get(at.key)?.tile;
        const changed =
          !live?.mask[at.index] ||
          values.some(
            (value, channel) => value !== live.values[at.index * 4 + channel],
          );
        if (!changed && !previous) continue;
        if (!previous) newCells++;
        if (gesture.cellCount + newCells > this.options.maxGestureCells)
          throw new RangeError(
            "Landschaftsaktion überschreitet das Zellbudget; einen kürzeren Strich malen.",
          );
        if (changed && !gesture.before.has(at.key)) newKeys.add(at.key);
        candidates.push({
          ...at,
          before,
          coverage,
          values,
          changed,
          bounds: [left, bottom, right, top],
        });
      }
    }
    const tileCount = gesture.before.size + newKeys.size;
    if (tileCount > HEIGHT_MAX_ACTION_TILES)
      throw new RangeError(
        "Eine Autorenaktion darf höchstens 512 Quellkacheln ändern.",
      );
    let retainedBytes = gesture.retainedBytes,
      missing = 0;
    for (const key of newKeys) {
      const exists = !!this.landscapeEntries.get(key)?.tile;
      retainedBytes += LANDSCAPE_TILE_BYTES * (exists ? 2 : 1);
      if (!exists) missing++;
    }
    if (this.pendingBytes + retainedBytes > this.options.maxPendingBytes)
      throw new RangeError(
        "Die Arbeitskopie muss vorhandene Änderungen sichern, bevor dieser Pinselabschnitt angenommen werden kann.",
      );
    if (retainedBytes > this.options.maxHistoryBytes)
      throw new RangeError(
        "Diese Aktion überschreitet die lokale History; einen kürzeren Strich malen.",
      );
    if (
      this.sourceBytes + missing * LANDSCAPE_TILE_BYTES >
      this.options.maxSourceBytes
    )
      throw new RangeError("Aktive Quellen überschreiten das Speicherbudget.");
    const revision = this.revision + 1;
    const patches = new Map<string, LandscapePatch>();
    let dirty: Bounds | null = null;
    for (const candidate of candidates) {
      let cells = gesture.cells.get(candidate.key);
      if (!cells) gesture.cells.set(candidate.key, (cells = new Map()));
      cells.set(candidate.index, {
        before: candidate.before,
        coverage: candidate.coverage,
      });
      if (!candidate.changed) continue;
      const live = this.landscapeEntries.get(candidate.key);
      if (!gesture.before.has(candidate.key)) {
        gesture.before.set(candidate.key, live?.tile ?? null);
        gesture.previousSequences.set(candidate.key, live?.localSequence ?? 0);
      }
      let patch = patches.get(candidate.key);
      if (!patch) {
        const after = live?.tile
          ? cloneLandscapeTile(live.tile)
          : createLandscapeTile(brush.level, candidate.tileX, candidate.tileY);
        after.revision = revision;
        patch = { key: candidate.key, before: live?.tile ?? null, after };
        patches.set(candidate.key, patch);
        this.landscapeEntries.set(candidate.key, {
          state: "ready",
          tile: after,
          localSequence: this.sequence + 1,
        });
        if (!live?.tile) {
          this.sourceBytes += LANDSCAPE_TILE_BYTES;
          this.landscapeSourceBytes += LANDSCAPE_TILE_BYTES;
        }
      }
      patch.after!.mask[candidate.index] = 1;
      patch.after!.values.set(candidate.values, candidate.index * 4);
      dirty = dirty ? unionBounds(dirty, candidate.bounds) : candidate.bounds;
    }
    gesture.cellCount += newCells;
    gesture.retainedBytes = retainedBytes;
    if (!patches.size) return null;
    this.revision = revision;
    this.generation++;
    gesture.bounds = gesture.bounds
      ? unionBounds(gesture.bounds, dirty!)
      : dirty;
    return { bounds: dirty!, patches: [...patches.values()] };
  }

  finishLandscapeGesture(): ChangeSet | null {
    const gesture = this.landscapeGesture;
    if (!gesture) return null;
    const patches: SourcePatch[] = [];
    for (const [key, before] of gesture.before) {
      const live = this.landscapeEntries.get(key)?.tile;
      const after = live?.mask.some((value) => value === 1) ? live : null;
      if (live && !after) {
        this.landscapeEntries.set(key, {
          state: "absent",
          localSequence: this.sequence + 1,
        });
        this.sourceBytes -= LANDSCAPE_TILE_BYTES;
        this.landscapeSourceBytes -= LANDSCAPE_TILE_BYTES;
      }
      if (!sameLandscape(before, after))
        patches.push({ kind: "landscape", key, before, after });
      else {
        const entry = this.landscapeEntries.get(key);
        if (entry)
          entry.localSequence = gesture.previousSequences.get(key) ?? 0;
      }
    }
    this.landscapeGesture = null;
    const change = patches.length
      ? this.recordHistory(
          gesture.brush.label ?? "Landschaft malen",
          patches,
          gesture.bounds ? [gesture.bounds] : [],
        )
      : null;
    gesture.resolveFinished();
    return change;
  }

  /** Restore the held source identity; cancellation is not a journal/history action. */
  cancelLandscapeGesture(): LandscapeUpdate | null {
    const gesture = this.landscapeGesture;
    if (!gesture) return null;
    const revision = this.revision + 1;
    const patches: LandscapePatch[] = [];
    for (const [key, original] of gesture.before) {
      const before = this.landscapeEntries.get(key)?.tile ?? null;
      const after = original ? { ...original, revision } : null;
      const localSequence = gesture.previousSequences.get(key) ?? 0;
      if (after)
        this.landscapeEntries.set(key, {
          state: "ready",
          tile: after,
          localSequence,
        });
      else if (localSequence > this.persistedSequence)
        this.landscapeEntries.set(key, { state: "absent", localSequence });
      else this.landscapeEntries.delete(key);
      const delta = (Number(!!after) - Number(!!before)) * LANDSCAPE_TILE_BYTES;
      this.sourceBytes += delta;
      this.landscapeSourceBytes += delta;
      patches.push({ key, before, after });
    }
    this.landscapeGesture = null;
    if (patches.length) {
      this.revision = revision;
      this.generation++;
    }
    gesture.resolveFinished();
    return patches.length ? { bounds: gesture.bounds!, patches } : null;
  }

  private initializeGesture(brush: HeightBrush): void {
    if (this.invalidationError) throw this.invalidationError;
    if (this.active) throw new Error("Eine Autorenaktion ist bereits aktiv.");
    assertLevel(brush.level);
    if (
      !Number.isFinite(brush.radius) ||
      brush.radius <= 0 ||
      !Number.isFinite(brush.amount)
    )
      throw new RangeError("Ungültiger Höhenpinsel.");
    const step = heightSpacing(brush.level);
    // V7 validates this workload in author coordinates after dividing the world
    // radius by 2^level. Its helper's absolute radius cap is not a world-foot cap.
    if (((2 * brush.radius) / step + 3) ** 2 > 400_000)
      throw new RangeError(
        "Höhenpinsel zu groß; eine gröbere Autorenstufe wählen.",
      );
    let resolveFinished!: () => void;
    let rejectFinished!: (error: Error) => void;
    const finished = new Promise<void>((resolve, reject) => {
      resolveFinished = resolve;
      rejectFinished = reject;
    });
    // Preserve rejection for real waiters without unhandled disposal promises.
    void finished.catch(() => {});
    this.prepaid = null;
    this.gesture = {
      brush: { ...brush },
      before: new Map(),
      cells: new Map(),
      cellCount: 0,
      retainedBytes: 0,
      bounds: null,
      finished,
      resolveFinished,
      rejectFinished,
    };
  }

  /** One C1 account and one bounded continuation belong to the active document. */
  beginPrepaidGesture(
    brush: HeightBrush,
    context: BrushReservationContext,
  ): void {
    if (this.active) throw new Error("Eine Autorenaktion ist bereits aktiv.");
    if (context.sessionId !== this.sessionId)
      throw new Error("Die Pinselreserve gehört zu einer anderen Sitzung.");
    const account = new PrepaidBrush({
      rate: brush.amount,
      level: brush.level,
      context,
      maxCells: this.options.maxGestureCells,
    });
    this.initializeGesture(brush);
    this.prepaid = {
      account,
      context: { ...context },
      queue: [],
      pendingPoints: 0,
      pendingCells: 0,
      sealed: false,
      complete: false,
      invalidated: false,
      lastAdmissionId: -1,
      reservedRegions: new Map(),
      appliedRegions: new Map(),
      reservedBounds: null,
      appliedBounds: null,
    };
  }

  /** Reserve the whole immutable contribution before returning from an input handler. */
  admitBrushBatch(batch: HeightBrushBatch): BrushAdmission {
    const gesture = this.gesture;
    const work = this.prepaid;
    if (!gesture || !work || work.sealed || work.invalidated)
      throw new Error("Keine annehmende vorausbezahlte Höhengeste.");
    if (
      !Number.isSafeInteger(batch.admissionId) ||
      batch.admissionId <= work.lastAdmissionId
    )
      throw new RangeError("Pinselfenster sind nicht eindeutig geordnet.");
    if (
      !Number.isSafeInteger(batch.pointCount) ||
      batch.pointCount < batch.path.points.length ||
      batch.pointCount < 0 ||
      work.pendingPoints + batch.pointCount > (batch.path.end ? 128 : 127)
    )
      throw new RangeError(
        "Pinselweg übergelaufen; der letzte Platz bleibt für das Loslassen reserviert.",
      );
    if (batch.path.end && batch.pointCount === 0)
      throw new RangeError("Pinselende benötigt seinen erfassten Endpunkt.");
    if (batch.time.length > 129)
      throw new RangeError(
        "Pinsel-Zeitfenster überschreitet das Segmentbudget.",
      );
    const prepared = preparePrepaidHeight(
      gesture.brush,
      batch,
      this.options.maxGestureCells,
    );
    const levels = HEIGHT_LEVELS.slice(gesture.brush.level);
    for (const bounds of prepared.regions.values())
      if (!this.isReady(bounds, levels)) throw new SourcesNotReadyError(bounds);

    let prospectiveBytes = gesture.retainedBytes;
    const validate = (changes: readonly PrepaidBrushChange[]) => {
      let newCells = 0;
      const newKeys = new Set<string>();
      for (const change of changes) {
        if (!change.delta) continue;
        if (!gesture.cells.get(change.key)?.has(change.index)) newCells++;
        if (!gesture.before.has(change.key)) newKeys.add(change.key);
        const before = gesture.before.has(change.key)
          ? gesture.before.get(change.key)
          : this.entries.get(change.key)?.tile;
        if (
          !Number.isFinite(
            (before?.values[change.index] ?? 0) +
              Math.sign(gesture.brush.amount) * change.total,
          )
        )
          throw new RangeError("Relative Höhe ist nicht endlich.");
      }
      if (gesture.cellCount + newCells > this.options.maxGestureCells)
        throw new RangeError(
          "Höchstens 100.000 Höhenpunkte je Aktion; einen kürzeren Strich malen.",
        );
      const tileCount = gesture.before.size + newKeys.size;
      if (tileCount > HEIGHT_MAX_ACTION_TILES)
        throw new RangeError(
          "Eine Höhengeste darf höchstens 512 Höhenkacheln ändern.",
        );
      prospectiveBytes = gesture.retainedBytes;
      for (const key of newKeys)
        prospectiveBytes +=
          HEIGHT_TILE_BYTES * (this.entries.get(key)?.tile ? 2 : 1);
      if (this.pendingBytes + prospectiveBytes > this.options.maxPendingBytes)
        throw new RangeError(
          "Die Arbeitskopie muss vorhandene Änderungen sichern, bevor dieser Pinselabschnitt angenommen werden kann.",
        );
      if (tileCount * HEIGHT_TILE_BYTES * 2 > this.options.maxHistoryBytes)
        throw new RangeError(
          "Diese Aktion überschreitet die lokale History; einen kürzeren Strich malen.",
        );
      const reservedKeys = new Set([...gesture.before.keys(), ...newKeys]);
      let missing = 0;
      for (const key of reservedKeys)
        if (this.entries.get(key)?.state !== "ready") missing++;
      if (
        this.sourceBytes + missing * HEIGHT_TILE_BYTES >
        this.options.maxSourceBytes
      )
        throw new RangeError(
          "Aktive Höhenquellen überschreiten das Speicherbudget.",
        );
    };
    const result = work.account.offer(prepared.offers, validate);
    if (!result.accepted)
      throw new RangeError(
        `Pinselreserve überschritten (${result.reason}); der angenommene Strich bleibt erhalten.`,
      );
    let changedCells = 0;
    for (const change of result.changes) {
      if (!change.delta) continue;
      changedCells++;
      if (!gesture.before.has(change.key))
        // COW materialization keeps this exact original source immutable.
        gesture.before.set(
          change.key,
          this.entries.get(change.key)?.tile ?? null,
        );
      let cells = gesture.cells.get(change.key);
      if (!cells) gesture.cells.set(change.key, (cells = new Set()));
      if (!cells.has(change.index)) {
        cells.add(change.index);
        gesture.cellCount++;
      }
    }
    gesture.retainedBytes = prospectiveBytes;
    for (const [key, bounds] of prepared.regions) {
      const old = work.reservedRegions.get(key);
      work.reservedRegions.set(key, old ? unionBounds(old, bounds) : bounds);
      work.reservedBounds = work.reservedBounds
        ? unionBounds(work.reservedBounds, bounds)
        : bounds;
    }
    if (result.reservation) {
      work.queue.push({
        id: batch.admissionId,
        reservation: result.reservation,
        remaining: changedCells,
        total: changedCells,
        points: batch.pointCount,
      });
      work.pendingPoints += batch.pointCount;
      work.pendingCells += changedCells;
    }
    work.lastAdmissionId = batch.admissionId;
    if (batch.path.end) this.sealBrushGesture();
    return {
      admissionId: batch.admissionId,
      bounds: prepared.regions.size
        ? [...prepared.regions.values()].reduce(unionBounds)
        : null,
      regions: [...prepared.regions.values()].map((bounds) => [...bounds]),
      reserved: result.reservation !== null,
      reservedCells: changedCells,
      acceptedTime: result.changes.reduce(
        (sum, change) => sum + change.acceptedTime,
        0,
      ),
      discardedTime: result.changes.reduce(
        (sum, change) => sum + change.discardedTime,
        0,
      ),
      pendingPoints: work.pendingPoints,
      examinedCells: prepared.examinedCells,
      lookupSlotCount: prepared.lookupSlotCount,
    };
  }

  sealBrushGesture(): void {
    if (!this.gesture || !this.prepaid || this.prepaid.invalidated) return;
    this.prepaid.sealed = true;
    this.prepaid.account.seal();
  }

  freezeBrushEffect(): BrushEffectReceipt | null {
    return this.prepaid && !this.prepaid.invalidated
      ? this.prepaid.account.freeze()
      : null;
  }

  acknowledgeBrushEffect(receipt: BrushEffectReceipt): boolean {
    return this.prepaid && !this.prepaid.invalidated
      ? this.prepaid.account.acknowledge(receipt)
      : false;
  }

  changeBrushContext(context: BrushReservationContext): void {
    const work = this.prepaid;
    if (!work || work.invalidated) return;
    if (
      context.sessionId === work.context.sessionId &&
      context.gestureId === work.context.gestureId &&
      context.viewId === work.context.viewId &&
      context.preparationId === work.context.preparationId
    )
      return;
    work.account.changeContext(context);
    work.context = { ...context };
    work.sealed = true;
  }

  /** Materialize one RAF's bounded portion; each changed tile is copied once. */
  advanceBrushGesture(
    options: { maxCells?: number; maxMs?: number } = {},
  ): BrushAdvance {
    const result: BrushAdvance = {
      update: null,
      change: null,
      complete: this.prepaid?.complete ?? true,
      appliedAdmissionIds: [],
      completedAdmissionIds: [],
      appliedCells: 0,
      applications: [],
    };
    const gesture = this.gesture;
    const work = this.prepaid;
    if (!gesture || !work || work.invalidated) return result;
    result.complete = false;
    const maxCells = options.maxCells ?? 2048;
    const maxMs = options.maxMs ?? 2;
    if (
      !Number.isSafeInteger(maxCells) ||
      maxCells < 0 ||
      !Number.isFinite(maxMs) ||
      maxMs < 0
    )
      throw new RangeError("Ungültiges Pinsel-Fortsetzungsbudget.");
    const started = performance.now();
    const patches = new Map<string, HeightPatch>();
    const step = heightSpacing(gesture.brush.level);
    const direction = Math.sign(gesture.brush.amount);
    const revision = this.revision + 1;
    let dirty: Bounds | null = null;
    while (work.queue.length && result.appliedCells < maxCells) {
      if (result.appliedCells > 0 && performance.now() - started >= maxMs)
        break;
      const pending = work.queue[0];
      const part = work.account.materializeSlice(
        pending.reservation,
        Math.min(256, maxCells - result.appliedCells),
        ({ key, index, delta }) => {
          const original = gesture.before.get(key)?.values[index] ?? 0;
          const account = work.account.valueAt(key, index);
          const outstanding = work.account.effectAt(key, index);
          const value =
            original +
            direction *
              (account.total - outstanding.reserved + Math.abs(delta));
          const live = this.entries.get(key)?.tile;
          // A consumed reservation must publish its source revision even when
          // Float64 rounds the addition to the same coefficient value. The
          // renderer still needs an attributable patch for this accepted work.
          let patch = patches.get(key);
          if (!patch) {
            const parsed = parseHeightTileKey(key);
            const after: HeightTile = live
              ? { ...live, revision, values: live.values.slice() }
              : {
                  ...parsed,
                  key,
                  revision,
                  values: new Float64Array(HEIGHT_TILE_CELLS),
                };
            patch = { key, before: live ?? null, after };
            patches.set(key, patch);
            this.entries.set(key, {
              state: "ready",
              tile: after,
              localSequence: this.sequence + 1,
            });
            if (!live) this.sourceBytes += HEIGHT_TILE_BYTES;
          }
          patch.after!.values[index] = value;
          const tile = patch.after!;
          const x =
            (tile.tileX * HEIGHT_TILE_SIZE + (index % HEIGHT_TILE_SIZE)) * step;
          const y =
            (tile.tileY * HEIGHT_TILE_SIZE +
              Math.floor(index / HEIGHT_TILE_SIZE)) *
            step;
          const support = clipBounds([
            x - 2 * step,
            y - 2 * step,
            x + 2 * step,
            y + 2 * step,
          ]);
          dirty = dirty ? unionBounds(dirty, support) : support;
          const old = work.appliedRegions.get(key);
          work.appliedRegions.set(
            key,
            old ? unionBounds(old, support) : support,
          );
          work.appliedBounds = work.appliedBounds
            ? unionBounds(work.appliedBounds, support)
            : support;
        },
      );
      if (!part) throw new Error("Angenommene Pinselreserve fehlt.");
      const count = part.toCell - part.fromCell;
      result.appliedCells += count;
      pending.remaining -= count;
      work.pendingCells -= count;
      if (!result.appliedAdmissionIds.includes(pending.id))
        result.appliedAdmissionIds.push(pending.id);
      const last = result.applications.at(-1);
      if (last?.admissionId === pending.id && last.toCell === part.fromCell)
        last.toCell = part.toCell;
      else
        result.applications.push({
          admissionId: pending.id,
          fromCell: part.fromCell,
          toCell: part.toCell,
          totalCells: part.totalCells,
        });
      if (part.complete) {
        work.queue.shift();
        work.pendingPoints -= pending.points;
        result.completedAdmissionIds.push(pending.id);
      }
    }
    if (patches.size) {
      this.revision = revision;
      this.generation++;
      gesture.bounds = gesture.bounds
        ? unionBounds(gesture.bounds, dirty!)
        : dirty;
      result.update = { bounds: dirty!, patches: [...patches.values()] };
    }
    if (work.sealed && work.queue.length === 0) {
      result.change = this.finishGesture();
      work.complete = true;
      result.complete = true;
    }
    return result;
  }

  /** Heights keep accepted live changes on release, Escape, blur and cancel. */
  private finishGesture(): ChangeSet | null {
    const gesture = this.gesture;
    if (!gesture) return null;
    if (this.prepaid && (!this.prepaid.sealed || this.prepaid.queue.length))
      throw new Error(
        "Angenommene Pinselarbeit muss vor dem Aktionsabschluss materialisiert werden.",
      );
    const patches: SourcePatch[] = [];
    for (const [key, before] of gesture.before) {
      const live = this.entries.get(key)?.tile;
      const after = live?.values.some((v) => v !== 0) ? live : null;
      if (!after && live) {
        this.entries.set(key, {
          state: "absent",
          localSequence: this.sequence + 1,
        });
        this.sourceBytes -= HEIGHT_TILE_BYTES;
      }
      if (!sameValues(before, after))
        patches.push({ kind: "height", key, before, after });
      else {
        // Consumed rounded-equal work publishes a render revision but creates
        // no journal entry. Remove its provisional next-sequence marker while
        // conservatively retaining protection for earlier unacknowledged work.
        const entry = this.entries.get(key);
        if (entry)
          entry.localSequence = Math.min(entry.localSequence, this.sequence);
      }
    }
    this.gesture = null;
    if (this.prepaid) this.prepaid.complete = true;
    if (!patches.length) {
      gesture.resolveFinished();
      return null;
    }
    const change = this.recordHistory(
      gesture.brush.label ??
        (gesture.brush.amount >= 0 ? "Gelände anheben" : "Gelände absenken"),
      patches,
      gesture.bounds ? [gesture.bounds] : [],
    );
    gesture.resolveFinished();
    return change;
  }

  private recordHistory(
    label: string,
    patches: SourcePatch[],
    dirtyBounds: Bounds[],
  ): ChangeSet {
    const action: HistoryAction = {
      label,
      patches,
      dirtyBounds,
      bytes: retainedPatchBytes(patches),
    };
    for (const discarded of this.history.splice(this.historyPosition))
      this.historyBytes -= discarded.bytes;
    this.history.push(action);
    this.historyPosition++;
    this.historyBytes += action.bytes;
    while (
      this.history.length > this.options.maxHistoryActions ||
      this.historyBytes > this.options.maxHistoryBytes
    ) {
      this.historyBytes -= this.history.shift()!.bytes;
      this.historyPosition--;
    }
    return this.commit(action.label, patches, action.dirtyBounds);
  }

  private commit(
    label: string,
    patches: SourcePatch[],
    dirtyBounds: Bounds[],
  ): ChangeSet {
    this.sequence++;
    const bytes = retainedPatchBytes(patches);
    const change: ChangeSet = {
      sessionId: this.sessionId,
      transactionId: `${this.sessionId}:${this.sequence}`,
      sequence: this.sequence,
      revision: this.revision,
      label,
      // These immutable snapshots are also owned by history. Live sources never
      // mutate them; the writer and overview projection borrow this one record.
      patches,
      dirtyBounds: dirtyBounds.map((b) => [...b]),
    };
    for (const patch of patches) Object.freeze(patch);
    Object.freeze(patches);
    for (const bounds of change.dirtyBounds) Object.freeze(bounds);
    Object.freeze(change.dirtyBounds);
    Object.freeze(change);
    this.pending.set(this.sequence, { bytes, change });
    this.pendingBytes += bytes;
    return change;
  }

  undo(): ChangeSet | null {
    if (this.active) throw new Error("Aktive Höhengeste zuerst abschließen.");
    if (!this.canUndo) return null;
    const action = this.history[this.historyPosition - 1];
    const change = this.restore(action, false);
    this.historyPosition--;
    return change;
  }

  redo(): ChangeSet | null {
    if (this.active) throw new Error("Aktive Höhengeste zuerst abschließen.");
    if (!this.canRedo) return null;
    const action = this.history[this.historyPosition];
    const change = this.restore(action, true);
    this.historyPosition++;
    return change;
  }

  private restore(action: HistoryAction, forward: boolean): ChangeSet {
    if (
      this.pendingBytes + retainedPatchBytes(action.patches) >
      this.options.maxPendingBytes
    )
      throw new RangeError(
        "Die Arbeitskopie muss vorhandene Änderungen zuerst sichern.",
      );
    const revision = this.revision + 1;
    const patches = action.patches.map((patch): SourcePatch => {
      if (patch.kind === "water") {
        const expected = forward ? patch.before : patch.after;
        const entry = this.waterEntries.get(patch.key);
        if (entry && !sameWaterSource(entry.header, expected))
          throw new Error("History passt nicht zum aktuellen Gewässerstand.");
        return {
          kind: "water",
          key: patch.key,
          before: expected,
          after: forward ? patch.after : patch.before,
        };
      }
      if (patch.kind === "house") {
        const expected = forward ? patch.before : patch.after;
        const entry = this.houseEntries.get(patch.key);
        if (entry && !sameHouseAuthors(entry.header, expected))
          throw new Error("History passt nicht zum aktuellen Hausstand.");
        return {
          kind: "house",
          key: patch.key,
          before: expected,
          // Header content identity is restored; the document revision remains
          // monotone for presentation invalidation and stale-job rejection.
          after: forward ? patch.after : patch.before,
        };
      }
      if (patch.kind === "height") {
        const expected = forward ? patch.before : patch.after;
        const entry = this.entries.get(patch.key);
        if (
          (entry?.tile && !sameValues(entry.tile, expected)) ||
          (entry?.state === "absent" && expected !== null)
        )
          throw new Error("History passt nicht zum aktuellen Quellenstand.");
        const target = forward ? patch.after : patch.before;
        return {
          kind: "height",
          key: patch.key,
          before: expected,
          after: target ? { ...target, revision } : null,
        };
      }
      const expected = forward ? patch.before : patch.after;
      const entry = this.landscapeEntries.get(patch.key);
      if (
        (entry?.tile && !sameLandscape(entry.tile, expected)) ||
        (entry?.state === "absent" && expected !== null)
      )
        throw new Error("History passt nicht zum aktuellen Quellenstand.");
      const target = forward ? patch.after : patch.before;
      return {
        kind: "landscape",
        key: patch.key,
        before: expected,
        after: target ? { ...target, revision } : null,
      };
    });
    const nextSourceBytes =
      this.sourceBytes +
      patches.reduce(
        (sum, p) =>
          sum +
          (p.kind === "water"
            ? (p.after ? waterSourceBytes(p.after) : 0) -
              (this.waterEntries.get(p.key)?.header
                ? waterSourceBytes(this.waterEntries.get(p.key)!.header!)
                : 0)
            : (Number(!!p.after) -
                Number(
                  p.kind === "house"
                    ? !!this.houseEntries.get(p.key)?.header
                    : (p.kind === "height"
                        ? this.entries
                        : this.landscapeEntries
                      ).get(p.key)?.state === "ready",
                )) *
              (p.kind === "height"
                ? HEIGHT_TILE_BYTES
                : p.kind === "landscape"
                  ? LANDSCAPE_TILE_BYTES
                  : HOUSE_HEADER_BYTES)),
        0,
      );
    if (nextSourceBytes > this.options.maxSourceBytes)
      throw new RangeError(
        "History benötigt mehr aktive Quellen als das Speicherbudget erlaubt.",
      );
    for (const patch of patches) {
      if (patch.kind === "water") {
        const current = this.waterEntries.get(patch.key)?.header;
        this.waterSourceBytes +=
          (patch.after ? waterSourceBytes(patch.after) : 0) -
          (current ? waterSourceBytes(current) : 0);
        this.waterEntries.set(patch.key, {
          header: patch.after && freezeWaterSource(patch.after),
          localSequence: this.sequence + 1,
        });
      } else if (patch.kind === "house") {
        this.houseSourceBytes +=
          (Number(!!patch.after) -
            Number(!!this.houseEntries.get(patch.key)?.header)) *
          HOUSE_HEADER_BYTES;
        this.houseEntries.set(patch.key, {
          header: patch.after && Object.freeze(cloneHouseHeader(patch.after)),
          localSequence: this.sequence + 1,
        });
      } else if (patch.kind === "height")
        this.entries.set(
          patch.key,
          patch.after
            ? {
                state: "ready",
                tile: cloneHeightTile(patch.after),
                localSequence: this.sequence + 1,
              }
            : { state: "absent", localSequence: this.sequence + 1 },
        );
      else {
        this.landscapeSourceBytes +=
          (Number(!!patch.after) -
            Number(this.landscapeEntries.get(patch.key)?.state === "ready")) *
          LANDSCAPE_TILE_BYTES;
        this.landscapeEntries.set(
          patch.key,
          patch.after
            ? {
                state: "ready",
                tile: cloneLandscapeTile(patch.after),
                localSequence: this.sequence + 1,
              }
            : { state: "absent", localSequence: this.sequence + 1 },
        );
      }
    }
    this.sourceBytes = nextSourceBytes;
    this.revision = revision;
    this.generation++;
    if (patches.some((patch) => patch.kind === "house")) this.houseGeneration++;
    if (patches.some((patch) => patch.kind === "water")) this.waterGeneration++;
    return this.commit(
      `${forward ? "Wiederholen" : "Rückgängig"}: ${action.label}`,
      patches,
      action.dirtyBounds,
    );
  }

  acceptPersistence(sequence: number): void {
    if (
      !Number.isSafeInteger(sequence) ||
      sequence < this.persistedSequence ||
      sequence > this.sequence
    )
      throw new Error("Ungültige Speicherbestätigung.");
    this.persistedSequence = sequence;
    for (const [pendingSequence, { bytes }] of this.pending)
      if (pendingSequence <= sequence) {
        this.pending.delete(pendingSequence);
        this.pendingBytes -= bytes;
      }
    for (const [key, entry] of this.entries)
      if (
        entry.state === "absent" &&
        entry.localSequence <= sequence &&
        !this.gesture?.before.has(key)
      )
        this.entries.delete(key);
    for (const [key, entry] of this.landscapeEntries)
      if (
        entry.state === "absent" &&
        entry.localSequence <= sequence &&
        !this.landscapeGesture?.before.has(key)
      )
        this.landscapeEntries.delete(key);
    for (const [key, entry] of this.houseEntries)
      if (
        !entry.header &&
        entry.localSequence <= sequence &&
        this.houseGesture?.key !== key
      )
        this.houseEntries.delete(key);
    for (const [key, entry] of this.waterEntries)
      if (!entry.header && entry.localSequence <= sequence)
        this.waterEntries.delete(key);
  }

  /** Overlay only changes absent from this store read, then the current live action.
   * A reply older than an acknowledged boundary must be reread: acknowledged
   * patches are released, never retained as a second permanent change journal.
   */
  presentationPatchesAfter(sequence: number): HeightPatch[] {
    if (
      !Number.isSafeInteger(sequence) ||
      sequence < this.persistedSequence ||
      sequence > this.sequence
    )
      throw new Error("Die gelesene Übersicht ist nicht mehr aktuell.");
    const patches: HeightPatch[] = [];
    for (const [pendingSequence, { change }] of this.pending)
      if (pendingSequence > sequence)
        patches.push(
          ...change.patches
            .filter((patch) => patch.kind === "height")
            .map(copyPatch),
        );
    for (const [key, before] of this.gesture?.before ?? []) {
      const live = this.entries.get(key)?.tile;
      patches.push({
        key,
        before: before ? cloneHeightTile(before) : null,
        after: live?.values.some((value) => value !== 0)
          ? cloneHeightTile(live)
          : null,
      });
    }
    return patches;
  }

  /** Owned pending/live overlays for rebasing one immutable store boundary exactly once. */
  landscapePatchesAfter(sequence: number): LandscapePatch[] {
    if (
      !Number.isSafeInteger(sequence) ||
      sequence < this.persistedSequence ||
      sequence > this.sequence
    )
      throw new Error(
        "Die gelesene Landschaftsübersicht ist nicht mehr aktuell.",
      );
    const patches: LandscapePatch[] = [];
    for (const [pendingSequence, { change }] of this.pending)
      if (pendingSequence > sequence)
        for (const patch of change.patches)
          if (patch.kind === "landscape")
            patches.push({
              key: patch.key,
              before: patch.before && cloneLandscapeTile(patch.before),
              after: patch.after && cloneLandscapeTile(patch.after),
            });
    for (const [key, before] of this.landscapeGesture?.before ?? []) {
      const live = this.landscapeEntries.get(key)?.tile;
      patches.push({
        key,
        before: before && cloneLandscapeTile(before),
        after: live?.mask.some((value) => value === 1)
          ? cloneLandscapeTile(live)
          : null,
      });
    }
    return patches;
  }
}
