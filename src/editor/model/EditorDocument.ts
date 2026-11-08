import { prepareHeightSampler, quarticBrushSegmentIntegral } from "./height";
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
  state: SourceState;
  tile?: HeightTile;
  localSequence: number;
  error?: string;
}

interface Coverage {
  level: number | null;
  minLevel?: number;
  bounds: Bounds;
}

const coversLevel = (coverage: Coverage, level: number) =>
  coverage.level === null
    ? level >= (coverage.minLevel ?? 0)
    : coverage.level === level;

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
  previous: Point | null;
  bounds: Bounds | null;
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
  private readonly options: Required<HeightDocumentOptions>;
  private readonly entries = new Map<string, Entry>();
  private coverage: Coverage[] = [];
  private gesture: Gesture | null = null;
  private history: HistoryAction[] = [];
  private historyPosition = 0;
  private readonly pending = new Map<
    number,
    { bytes: number; patches: readonly HeightPatch[] }
  >();
  private sourceBytes = 0;
  private historyBytes = 0;
  private pendingBytes = 0;

  constructor(sessionId: string, options: HeightDocumentOptions = {}) {
    if (!sessionId) throw new Error("Dokumentsitzung fehlt.");
    this.sessionId = sessionId;
    this.options = {
      empty: options.empty ?? false,
      sequence: options.sequence ?? 0,
      maxSourceBytes: options.maxSourceBytes ?? 256 * 1024 * 1024,
      maxPendingBytes: options.maxPendingBytes ?? 32 * 1024 * 1024,
      maxHistoryBytes: options.maxHistoryBytes ?? 128 * 1024 * 1024,
      maxHistoryActions: options.maxHistoryActions ?? 100,
      maxGestureCells: options.maxGestureCells ?? 100_000,
    };
    for (const [key, value] of Object.entries(this.options)) {
      if (
        key !== "empty" &&
        (!Number.isSafeInteger(value) || Number(value) < 0)
      )
        throw new RangeError("Ungültiges Dokumentbudget oder Sequenznummer.");
    }
    if (this.options.maxHistoryActions < 1 || this.options.maxGestureCells < 1)
      throw new RangeError(
        "History und Gesten benötigen ein positives Budget.",
      );
    this.sequence = this.options.sequence;
    this.persistedSequence = this.sequence;
  }

  get active(): boolean {
    return this.gesture !== null;
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
      coverageRegions: this.coverage.length,
    };
  }

  sourceState(key: string): SourceState {
    const parsed = parseHeightTileKey(key);
    const entry = this.entries.get(key);
    if (entry) return entry.state;
    if (this.options.empty) return "absent";
    const support = heightTileSupport(parsed);
    return this.coverage.some(
      (c) =>
        coversLevel(c, parsed.level) && intersectsBounds(support, c.bounds),
    )
      ? "absent"
      : "unknown";
  }

  sourceError(key: string): string | undefined {
    return this.entries.get(key)?.error;
  }

  markLoading(keys: readonly string[]): void {
    for (const key of keys) {
      parseHeightTileKey(key);
      if (["ready", "absent"].includes(this.sourceState(key))) continue;
      this.entries.set(key, {
        state: "loading",
        localSequence: this.entries.get(key)?.localSequence ?? 0,
      });
    }
  }

  failSources(keys: readonly string[], message: string): void {
    for (const key of keys) {
      parseHeightTileKey(key);
      if (["ready", "absent"].includes(this.sourceState(key))) continue;
      this.entries.set(key, {
        state: "error",
        error: message,
        localSequence: this.entries.get(key)?.localSequence ?? 0,
      });
    }
    this.generation++;
  }

  requiredSources(
    bounds: Bounds,
    levels: readonly number[] = HEIGHT_LEVELS,
    maxKeys = 4096,
  ): string[] {
    return requiredHeightSources(bounds, levels, maxKeys);
  }

  /** Each supplied region is certified by a complete support-overlap store read. */
  acceptCoverage(
    bounds: Bounds,
    tiles: readonly HeightTile[],
    storeSequence = this.persistedSequence,
    sessionId = this.sessionId,
    minLevel = 0,
  ): void {
    if (
      !Number.isInteger(minLevel) ||
      minLevel < 0 ||
      minLevel > HEIGHT_LEVELS.length
    )
      throw new RangeError("Ungültige untere Quellenstufe.");
    this.acceptRead(
      { level: null, minLevel, bounds },
      null,
      tiles,
      storeSequence,
      sessionId,
    );
  }

  acceptRegion(
    level: number,
    bounds: Bounds,
    tiles: readonly HeightTile[],
    storeSequence = this.persistedSequence,
    sessionId = this.sessionId,
  ): void {
    assertLevel(level);
    this.acceptRead({ level, bounds }, null, tiles, storeSequence, sessionId);
  }

  acceptSources(
    keys: readonly string[],
    tiles: readonly HeightTile[],
    storeSequence = this.persistedSequence,
    sessionId = this.sessionId,
  ): void {
    keys.forEach(parseHeightTileKey);
    this.acceptRead(null, new Set(keys), tiles, storeSequence, sessionId);
  }

  private acceptRead(
    coverage: Coverage | null,
    keys: Set<string> | null,
    tiles: readonly HeightTile[],
    storeSequence: number,
    sessionId: string,
  ): void {
    if (sessionId !== this.sessionId)
      throw new Error("Geländedaten gehören zu einer anderen Sitzung.");
    if (
      !Number.isSafeInteger(storeSequence) ||
      storeSequence < 0 ||
      storeSequence > this.sequence
    )
      throw new Error("Ungültige Lesesequenz der Arbeitskopie.");
    if (coverage) assertBounds(coverage.bounds);
    const affects = (key: string) =>
      keys
        ? keys.has(key)
        : coversLevel(coverage!, parseHeightTileKey(key).level) &&
          intersectsBounds(
            heightTileSupport(parseHeightTileKey(key)),
            coverage!.bounds,
          );
    const received = new Map<string, HeightTile>();
    for (const tile of tiles) {
      validateHeightTile(tile);
      if (!affects(tile.key) || received.has(tile.key))
        throw new Error(
          "Unvollständige oder unpassende räumliche Höhenantwort.",
        );
      received.set(tile.key, tile);
    }
    const affectedKeys = new Set(keys ?? received.keys());
    if (coverage)
      for (const key of this.entries.keys())
        if (affects(key)) affectedKeys.add(key);
    const changes: [string, HeightTile | null][] = [];
    let nextBytes = this.sourceBytes;
    for (const key of affectedKeys) {
      const prior = this.entries.get(key);
      // A store read can lag both an active gesture and an acknowledged local
      // action. Compare its captured sequence, not the latest store ack.
      if (
        this.gesture?.before.has(key) ||
        (prior?.localSequence ?? 0) > storeSequence
      )
        continue;
      const next = received.get(key) ?? null;
      nextBytes +=
        (next ? HEIGHT_TILE_BYTES : 0) -
        (prior?.state === "ready" ? HEIGHT_TILE_BYTES : 0);
      changes.push([key, next]);
    }
    if (nextBytes > this.options.maxSourceBytes)
      throw new RangeError(
        "Aktive Höhenquellen überschreiten das Speicherbudget; bestätigte Quellen zuerst verdrängen.",
      );
    for (const [key, tile] of changes) {
      const localSequence = this.entries.get(key)?.localSequence ?? 0;
      this.entries.set(
        key,
        tile
          ? { state: "ready", tile: cloneHeightTile(tile), localSequence }
          : { state: "absent", localSequence },
      );
      if (tile) this.revision = Math.max(this.revision, tile.revision);
    }
    this.sourceBytes = nextBytes;
    if (coverage) {
      const copy = {
        level: coverage.level,
        minLevel: coverage.minLevel,
        bounds: [...coverage.bounds] as Bounds,
      };
      this.coverage = this.coverage.filter(
        (old) =>
          !(
            (copy.level === null
              ? old.level === null
                ? (old.minLevel ?? 0) >= (copy.minLevel ?? 0)
                : coversLevel(copy, old.level)
              : copy.level === old.level) && contained(copy.bounds, old.bounds)
          ),
      );
      this.coverage.push(copy);
      // This only drops an absence proof. It cannot discard authors or turn an
      // unknown source into ocean; the next view can request the region again.
      if (this.coverage.length > 256) this.coverage.shift();
    }
    this.generation++;
  }

  isReady(bounds: Bounds, levels: readonly number[] = HEIGHT_LEVELS): boolean {
    assertBounds(bounds);
    levels.forEach(assertLevel);
    const requestedLevels = new Set(levels);
    const coverageReady =
      this.options.empty ||
      levels.every((level) => {
        let remaining: Bounds[] = [bounds];
        for (const coverage of this.coverage) {
          if (!coversLevel(coverage, level)) continue;
          if (contained(coverage.bounds, bounds)) return true;
          remaining = remaining.flatMap((area) =>
            subtract(area, coverage.bounds),
          );
          if (!remaining.length) return true;
        }
        return false;
      });
    if (coverageReady) {
      for (const [key, entry] of this.entries) {
        if (entry.state === "ready" || entry.state === "absent") continue;
        const tile = parseHeightTileKey(key);
        if (
          requestedLevels.has(tile.level) &&
          intersectsBounds(heightTileSupport(tile), bounds)
        )
          return false;
      }
      return true;
    }
    try {
      return this.requiredSources(bounds, levels).every((key) => {
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

  readSources(keys: readonly string[]): HeightTile[] {
    const result: HeightTile[] = [];
    for (const key of keys) {
      const state = this.sourceState(key);
      if (state !== "ready" && state !== "absent")
        throw new Error("Höhenquelle ist nicht bereit.");
      const tile = this.entries.get(key)?.tile;
      if (tile) result.push(cloneHeightTile(tile));
    }
    return result;
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
      dependencies: tiles.map(({ key, revision }) => ({ key, revision })),
    };
  }

  isSnapshotCurrent(snapshot: HeightSnapshot): boolean {
    if (
      snapshot.sessionId !== this.sessionId ||
      !this.isReady(snapshot.bounds, snapshot.levels)
    )
      return false;
    const expected = new Map(
      snapshot.dependencies.map((s) => [s.key, s.revision]),
    );
    for (const entry of this.entries.values()) {
      if (
        !entry.tile ||
        !snapshot.levels.includes(entry.tile.level) ||
        !intersectsBounds(heightTileSupport(entry.tile), snapshot.bounds)
      )
        continue;
      if (expected.get(entry.tile.key) !== entry.tile.revision) return false;
      expected.delete(entry.tile.key);
    }
    return expected.size === 0;
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

  sampleHeightLoaded(x: number, y: number): number {
    return this.sampleHeight(x, y);
  }

  evictSources(keys: readonly string[]): number {
    let count = 0;
    for (const key of keys) {
      parseHeightTileKey(key);
      const entry = this.entries.get(key);
      if (
        entry?.state !== "ready" ||
        entry.localSequence > this.persistedSequence ||
        this.gesture?.before.has(key)
      )
        continue;
      this.entries.set(key, {
        state: "unknown",
        localSequence: entry.localSequence,
      });
      this.sourceBytes -= HEIGHT_TILE_BYTES;
      count++;
    }
    if (count) this.generation++;
    return count;
  }

  evictConfirmedSources(): number {
    return this.evictSources([...this.entries.keys()]);
  }

  /** Keep the current sampling halo, active gestures and unacknowledged writes. */
  evictConfirmedOutside(bounds: Bounds): number {
    assertBounds(bounds);
    const keys: string[] = [];
    for (const [key, entry] of this.entries)
      if (
        entry.tile &&
        !intersectsBounds(heightTileSupport(entry.tile), bounds)
      )
        keys.push(key);
    return this.evictSources(keys);
  }

  beginGesture(brush: HeightBrush): void {
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
    this.gesture = {
      brush: { ...brush },
      before: new Map(),
      cells: new Map(),
      cellCount: 0,
      retainedBytes: 0,
      previous: null,
      bounds: null,
    };
  }

  /** Complete segment support, using the model's last accepted point only. */
  readBoundsForPoint(point: Point, brush: HeightBrush): Bounds {
    assertPoint(point);
    const activeBrush = this.gesture?.brush ?? brush;
    const halo = activeBrush.radius + 2 * heightSpacing(activeBrush.level);
    const previous = this.gesture?.previous ?? point;
    return clipBounds([
      Math.min(previous[0], point[0]) - halo,
      Math.min(previous[1], point[1]) - halo,
      Math.max(previous[0], point[0]) + halo,
      Math.max(previous[1], point[1]) + halo,
    ]);
  }

  /** Apply one elapsed time interval; a zero-duration point only sets its origin. */
  applyPoint(point: Point, elapsedMs: number): HeightUpdate | null {
    const gesture = this.gesture;
    if (!gesture) throw new Error("Keine aktive Höhengeste.");
    assertPoint(point);
    if (!Number.isFinite(elapsedMs) || elapsedMs < 0)
      throw new RangeError(
        "Die Pinselzeit muss endlich und nichtnegativ sein.",
      );
    const { brush } = gesture;
    const step = heightSpacing(brush.level);
    const from = gesture.previous ?? point;
    const dx = point[0] - from[0];
    const dy = point[1] - from[1];
    const length = Math.hypot(dx, dy);
    if (elapsedMs === 0 || brush.amount === 0) {
      gesture.previous = [...point];
      return null;
    }
    const sampleBounds = this.readBoundsForPoint(point, brush);
    const levels = HEIGHT_LEVELS.slice(brush.level);
    if (!this.isReady(sampleBounds, levels))
      throw new SourcesNotReadyError(sampleBounds);
    const minX = Math.max(
      Math.ceil(-WORLD_LIMIT / step),
      Math.ceil((Math.min(from[0], point[0]) - brush.radius) / step),
    );
    const minY = Math.max(
      Math.ceil(-WORLD_LIMIT / step),
      Math.ceil((Math.min(from[1], point[1]) - brush.radius) / step),
    );
    const maxX = Math.min(
      Math.floor(WORLD_LIMIT / step),
      Math.floor((Math.max(from[0], point[0]) + brush.radius) / step),
    );
    const maxY = Math.min(
      Math.floor(WORLD_LIMIT / step),
      Math.floor((Math.max(from[1], point[1]) + brush.radius) / step),
    );
    if ((maxX - minX + 1) * (maxY - minY + 1) > 400_000)
      throw new RangeError(
        "Pinselabschnitt ist zu groß für die direkte lokale Bearbeitung.",
      );
    const directionX = length ? dx / length : 0;
    const directionY = length ? dy / length : 0;
    const updates = new Map<
      string,
      { tileX: number; tileY: number; values: Map<number, number> }
    >();
    let newCells = 0;
    let dirty: Bounds | null = null;
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
        const old = this.entries.get(key)?.tile?.values[index] ?? 0;
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
    for (const [key, update] of updates)
      if (!update.values.size) updates.delete(key);
    if (!updates.size) {
      gesture.previous = [...point];
      return null;
    }
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
      const before = entry?.tile ? cloneHeightTile(entry.tile) : null;
      if (!gesture.before.has(key))
        gesture.before.set(
          key,
          entry?.tile ? cloneHeightTile(entry.tile) : null,
        );
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
      }
      let cells = gesture.cells.get(key);
      if (!cells) gesture.cells.set(key, (cells = new Set()));
      for (const [index, value] of update.values) {
        entry.tile!.values[index] = value;
        cells.add(index);
      }
      entry.localSequence = this.sequence + 1;
      entry.tile!.revision = this.revision;
      patches.push({ key, before, after: cloneHeightTile(entry.tile!) });
    }
    gesture.cellCount += newCells;
    gesture.retainedBytes = retainedBytes;
    gesture.previous = [...point];
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
    const patches: HeightPatch[] = [];
    for (const [key, before] of gesture.before) {
      const live = this.entries.get(key)!.tile!;
      const after = live.values.some((v) => v !== 0)
        ? cloneHeightTile(live)
        : null;
      if (!after) {
        this.entries.set(key, {
          state: "absent",
          localSequence: this.sequence + 1,
        });
        this.sourceBytes -= HEIGHT_TILE_BYTES;
      }
      if (!sameValues(before, after)) patches.push({ key, before, after });
    }
    this.gesture = null;
    if (!patches.length) return null;
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
    return this.commit(action.label, patches, action.dirtyBounds);
  }

  private commit(
    label: string,
    patches: HeightPatch[],
    dirtyBounds: Bounds[],
  ): ChangeSet {
    this.sequence++;
    const bytes = retainedPatchBytes(patches);
    this.pending.set(this.sequence, { bytes, patches });
    this.pendingBytes += bytes;
    return {
      sessionId: this.sessionId,
      transactionId: `${this.sessionId}:${this.sequence}`,
      sequence: this.sequence,
      revision: this.revision,
      label,
      patches: patches.map(copyPatch),
      dirtyBounds: dirtyBounds.map((b) => [...b]),
    };
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
        before: expected && cloneHeightTile(expected),
        after: target ? { ...cloneHeightTile(target), revision } : null,
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
    for (const [pendingSequence, change] of this.pending)
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
