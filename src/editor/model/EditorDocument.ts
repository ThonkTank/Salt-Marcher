import {
  heightBrushReadBounds,
  prepareHeightSampler,
  quarticBrushSegmentIntegral,
} from "./height";
import {
  HEIGHT_LEVELS,
  HEIGHT_MAX_ACTION_TILES,
  HEIGHT_TILE_BYTES,
  HEIGHT_TILE_CELLS,
  HEIGHT_TILE_SIZE,
  WORLD_LIMIT,
  assertBounds,
  assertLevel,
  assertPoint,
  clipBounds,
  cloneHeightTile,
  heightControlAddress,
  heightSpacing,
  heightTileKey,
  heightTileSupport,
  intersectsBounds,
  parseHeightTileKey,
  unionBounds,
  validateHeightTile,
  type Bounds,
  type ChangeSet,
  type HeightBrush,
  type HeightPatch,
  type HeightSnapshot,
  type HeightTile,
  type Point,
  type SourceState,
} from "./types";
import { PrepaidBrush, type PrepaidBrushChange } from "./PrepaidBrush";
import {
  type BrushEffectReceipt,
  type BrushReservation,
  type BrushReservationContext,
} from "./BrushReservations";
import { preparePrepaidHeight, type HeightBrushBatch } from "./prepaid-height";

export interface HeightDocumentOptions {
  /** Only valid when creation of an empty store has actually succeeded. */
  empty?: boolean;
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

/** One timed part of an atomically accepted brush path. */
export interface HeightSegment {
  from: Point;
  to: Point;
  elapsedMs: number;
}

export interface HeightUpdate {
  bounds: Bounds;
  /** Owned changed sources only; unrelated fine sources are never copied. */
  patches: HeightPatch[];
}

interface HistoryAction {
  label: string;
  patches: HeightPatch[];
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

function copyPatch(patch: HeightPatch): HeightPatch {
  return {
    key: patch.key,
    before: patch.before && cloneHeightTile(patch.before),
    after: patch.after && cloneHeightTile(patch.after),
  };
}

function retainedPatchBytes(patches: readonly HeightPatch[]): number {
  return patches.reduce(
    (sum, patch) =>
      sum +
      (Number(!!patch.before) + Number(!!patch.after)) * HEIGHT_TILE_BYTES,
    0,
  );
}

function contained(a: Bounds, b: Bounds): boolean {
  return a[0] <= b[0] && a[1] <= b[1] && a[2] >= b[2] && a[3] >= b[3];
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
  sequence: number;
  persistedSequence: number;
  private readonly options: Required<Omit<HeightDocumentOptions, "empty">>;
  private readonly entries = new Map<string, Entry>();
  private coverage: SourceNeed[] = [];
  private gesture: Gesture | null = null;
  private prepaid: BrushContinuation | null = null;
  private invalidationError: Error | null = null;
  private history: HistoryAction[] = [];
  private historyPosition = 0;
  private readonly pending = new Map<
    number,
    { bytes: number; change: ChangeSet }
  >();
  private sourceBytes = 0;
  private historyBytes = 0;
  private pendingBytes = 0;

  constructor(sessionId: string, options: HeightDocumentOptions = {}) {
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
  }

  get active(): boolean {
    return this.gesture !== null;
  }

  get finishing(): boolean {
    return Boolean(this.gesture && this.prepaid?.sealed);
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
    return this.gesture?.finished ?? Promise.resolve();
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
    if (this.prepaid) this.prepaid.invalidated = true;
    this.gesture = null;
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
      historyBytes: this.historyBytes,
      pendingBytes: this.pendingBytes,
      gestureBeforeBytes: (this.gesture?.before.size ?? 0) * HEIGHT_TILE_BYTES,
      gestureCells: this.gesture?.cellCount ?? 0,
      historyActions: this.history.length,
      readyTiles: this.sourceBytes / HEIGHT_TILE_BYTES,
      sourceEntries: this.entries.size,
      coverageRegions: this.coverage.length,
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
  ): HeightSnapshot {
    if (!this.isReady(bounds, levels)) throw new SourcesNotReadyError(bounds);
    const selected = new Set(levels);
    const tiles: HeightTile[] = [];
    for (const entry of this.entries.values())
      if (
        entry.tile &&
        selected.has(entry.tile.level) &&
        intersectsBounds(heightTileSupport(entry.tile), bounds)
      )
        tiles.push(cloneHeightTile(entry.tile));
    return {
      sessionId: this.sessionId,
      generation: this.generation,
      revision: this.revision,
      sequence: this.sequence,
      bounds: [...bounds],
      levels: [...levels],
      tiles,
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

  beginGesture(brush: HeightBrush): void {
    if (this.invalidationError) throw this.invalidationError;
    if (this.gesture) throw new Error("Eine Höhengeste ist bereits aktiv.");
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
    if (this.gesture) throw new Error("Eine Höhengeste ist bereits aktiv.");
    if (context.sessionId !== this.sessionId)
      throw new Error("Die Pinselreserve gehört zu einer anderen Sitzung.");
    const account = new PrepaidBrush({
      rate: brush.amount,
      level: brush.level,
      context,
      maxCells: this.options.maxGestureCells,
    });
    this.beginGesture(brush);
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

  /** Existing single-segment callers share the atomic path integrator. */
  applySegment(from: Point, to: Point, elapsedMs: number): HeightUpdate | null {
    return this.applySegments([{ from, to, elapsedMs }]);
  }

  /** Validate the whole path and its budgets before mutating any author value. */
  applySegments(segments: readonly HeightSegment[]): HeightUpdate | null {
    const gesture = this.gesture;
    if (!gesture) throw new Error("Keine aktive Höhengeste.");
    if (this.prepaid)
      throw new Error(
        "Vorausbezahlte Höhengesten nur über ihre Reserve materialisieren.",
      );
    const { brush } = gesture;
    const step = heightSpacing(brush.level);
    const levels = HEIGHT_LEVELS.slice(brush.level);
    let examinedCells = 0;
    const prepared = segments.flatMap(({ from, to, elapsedMs }) => {
      assertPoint(from);
      assertPoint(to);
      if (!Number.isFinite(elapsedMs) || elapsedMs < 0)
        throw new RangeError(
          "Die Pinselzeit muss endlich und nichtnegativ sein.",
        );
      if (elapsedMs === 0 || brush.amount === 0) return [];
      const sampleBounds = heightBrushReadBounds(brush, from, to);
      if (!this.isReady(sampleBounds, levels))
        throw new SourcesNotReadyError(sampleBounds);
      const minX = Math.max(
        Math.ceil(-WORLD_LIMIT / step),
        Math.ceil((Math.min(from[0], to[0]) - brush.radius) / step),
      );
      const minY = Math.max(
        Math.ceil(-WORLD_LIMIT / step),
        Math.ceil((Math.min(from[1], to[1]) - brush.radius) / step),
      );
      const maxX = Math.min(
        Math.floor(WORLD_LIMIT / step),
        Math.floor((Math.max(from[0], to[0]) + brush.radius) / step),
      );
      const maxY = Math.min(
        Math.floor(WORLD_LIMIT / step),
        Math.floor((Math.max(from[1], to[1]) + brush.radius) / step),
      );
      examinedCells += (maxX - minX + 1) * (maxY - minY + 1);
      if (examinedCells > 400_000)
        throw new RangeError(
          "Pinselabschnitt ist zu groß für die direkte lokale Bearbeitung.",
        );
      return [{ from, to, elapsedMs, minX, minY, maxX, maxY }];
    });
    const updates = new Map<
      string,
      { tileX: number; tileY: number; values: Map<number, number> }
    >();
    let newCells = 0;
    let dirty: Bounds | null = null;
    for (const { from, to, elapsedMs, minX, minY, maxX, maxY } of prepared) {
      const dx = to[0] - from[0];
      const dy = to[1] - from[1];
      const length = Math.hypot(dx, dy);
      const directionX = length ? dx / length : 0;
      const directionY = length ? dy / length : 0;
      for (let y = minY; y <= maxY; y++)
        for (let x = minX; x <= maxX; x++) {
          const qx = x * step - from[0];
          const qy = y * step - from[1];
          let weight: number;
          if (length > 0) {
            weight =
              quarticBrushSegmentIntegral(
                qx * directionX + qy * directionY,
                qx * directionY - qy * directionX,
                length,
                brush.radius,
              ) / length;
          } else {
            const d2 = (qx / brush.radius) ** 2 + (qy / brush.radius) ** 2;
            weight = d2 < 1 ? (1 - d2) ** 2 : 0;
          }
          if (weight === 0) continue;
          const { key, tileX, tileY, index } = heightControlAddress(
            brush.level,
            x,
            y,
          );
          let update = updates.get(key);
          if (!update)
            updates.set(key, (update = { tileX, tileY, values: new Map() }));
          const old =
            update.values.get(index) ??
            this.entries.get(key)?.tile?.values[index] ??
            0;
          const value = old + brush.amount * ((elapsedMs / 1000) * weight);
          if (!Number.isFinite(value))
            throw new RangeError("Relative Höhe ist nicht endlich.");
          if (value === old) continue;
          if (!gesture.cells.get(key)?.has(index) && !update.values.has(index))
            newCells++;
          if (gesture.cellCount + newCells > this.options.maxGestureCells)
            throw new RangeError(
              "Höchstens 100.000 Höhenpunkte je Aktion; einen kürzeren Strich malen.",
            );
          update.values.set(index, value);
          const changed: Bounds = [
            x * step - 2 * step,
            y * step - 2 * step,
            x * step + 2 * step,
            y * step + 2 * step,
          ];
          dirty = dirty ? unionBounds(dirty, changed) : changed;
        }
    }
    for (const [key, update] of updates)
      if (!update.values.size) updates.delete(key);
    if (!updates.size) return null;
    const newKeys = [...updates.keys()].filter(
      (key) => !gesture.before.has(key),
    );
    const totalGestureTiles = gesture.before.size + newKeys.length;
    if (totalGestureTiles > HEIGHT_MAX_ACTION_TILES)
      throw new RangeError(
        `Eine Höhengeste darf höchstens ${HEIGHT_MAX_ACTION_TILES} Höhenkacheln ändern; einen kürzeren Strich malen.`,
      );
    let retainedBytes = gesture.retainedBytes;
    for (const [key, update] of updates) {
      const live = this.entries.get(key)?.tile;
      const alreadyChanged = gesture.before.has(key);
      if (!alreadyChanged && live) retainedBytes += HEIGHT_TILE_BYTES;
      const hadAfter =
        alreadyChanged && Boolean(live?.values.some((value) => value !== 0));
      let hasAfter = false;
      for (const value of update.values.values())
        if (value !== 0) {
          hasAfter = true;
          break;
        }
      if (!hasAfter && live)
        hasAfter = live.values.some(
          (value, index) => value !== 0 && !update.values.has(index),
        );
      retainedBytes +=
        (Number(hasAfter) - Number(hadAfter)) * HEIGHT_TILE_BYTES;
    }
    if (this.pendingBytes + retainedBytes > this.options.maxPendingBytes)
      throw new RangeError(
        "Die Arbeitskopie muss vorhandene Änderungen sichern, bevor dieser Pinselabschnitt angenommen werden kann.",
      );
    if (
      totalGestureTiles * HEIGHT_TILE_BYTES * 2 >
      this.options.maxHistoryBytes
    )
      throw new RangeError(
        "Diese Aktion überschreitet die lokale History; einen kürzeren Strich malen.",
      );
    const extraTiles = [...updates.keys()].filter(
      (key) => this.entries.get(key)?.state !== "ready",
    ).length;
    if (
      this.sourceBytes + extraTiles * HEIGHT_TILE_BYTES >
      this.options.maxSourceBytes
    )
      throw new RangeError(
        "Aktive Höhenquellen überschreiten das Speicherbudget.",
      );
    this.revision++;
    const patches: HeightPatch[] = [];
    for (const [key, update] of updates) {
      let entry = this.entries.get(key);
      const before = entry?.tile ?? null;
      if (!gesture.before.has(key)) gesture.before.set(key, before);
      if (entry?.state !== "ready") {
        entry = {
          state: "ready",
          localSequence: this.sequence + 1,
          tile: {
            key,
            level: brush.level,
            tileX: update.tileX,
            tileY: update.tileY,
            revision: this.revision,
            values: new Float64Array(HEIGHT_TILE_CELLS),
          },
        };
        this.entries.set(key, entry);
        this.sourceBytes += HEIGHT_TILE_BYTES;
      } else
        entry.tile = { ...entry.tile!, values: entry.tile!.values.slice() };
      let cells = gesture.cells.get(key);
      if (!cells) gesture.cells.set(key, (cells = new Set()));
      for (const [index, value] of update.values) {
        entry.tile!.values[index] = value;
        cells.add(index);
      }
      entry.localSequence = this.sequence + 1;
      entry.tile!.revision = this.revision;
      patches.push({ key, before, after: entry.tile! });
    }
    gesture.cellCount += newCells;
    gesture.retainedBytes = retainedBytes;
    dirty = clipBounds(dirty!);
    gesture.bounds = gesture.bounds
      ? unionBounds(gesture.bounds, dirty)
      : dirty;
    this.generation++;
    return { bounds: dirty, patches };
  }

  /** Heights keep accepted live changes on release, Escape, blur and cancel. */
  finishGesture(): ChangeSet | null {
    const gesture = this.gesture;
    if (!gesture) return null;
    if (this.prepaid && (!this.prepaid.sealed || this.prepaid.queue.length))
      throw new Error(
        "Angenommene Pinselarbeit muss vor dem Aktionsabschluss materialisiert werden.",
      );
    const patches: HeightPatch[] = [];
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
      if (!sameValues(before, after)) patches.push({ key, before, after });
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
    const action: HistoryAction = {
      label:
        gesture.brush.label ??
        (gesture.brush.amount >= 0 ? "Gelände anheben" : "Gelände absenken"),
      patches,
      dirtyBounds: gesture.bounds ? [gesture.bounds] : [],
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
    const change = this.commit(action.label, patches, action.dirtyBounds);
    gesture.resolveFinished();
    return change;
  }

  private commit(
    label: string,
    patches: HeightPatch[],
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
    const patches = action.patches.map((patch): HeightPatch => {
      const expected = forward ? patch.before : patch.after;
      const entry = this.entries.get(patch.key);
      const actual = entry?.tile;
      if (
        (actual && !sameValues(actual, expected)) ||
        (entry?.state === "absent" && expected !== null)
      )
        throw new Error("History passt nicht zum aktuellen Quellenstand.");
      const target = forward ? patch.after : patch.before;
      return {
        key: patch.key,
        // History snapshots are immutable. Only their descriptor needs the new
        // revision; the separately cloned live source remains mutable below.
        before: expected,
        after: target ? { ...target, revision } : null,
      };
    });
    const nextSourceBytes =
      this.sourceBytes +
      patches.reduce(
        (sum, p) =>
          sum +
          (Number(!!p.after) -
            Number(this.entries.get(p.key)?.state === "ready")) *
            HEIGHT_TILE_BYTES,
        0,
      );
    if (nextSourceBytes > this.options.maxSourceBytes)
      throw new RangeError(
        "History benötigt mehr aktive Quellen als das Speicherbudget erlaubt.",
      );
    for (const patch of patches)
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
    this.sourceBytes = nextSourceBytes;
    this.revision = revision;
    this.generation++;
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
        patches.push(...change.patches.map(copyPatch));
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
}
