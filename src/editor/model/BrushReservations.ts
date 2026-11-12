import {
  HEIGHT_MAX_ACTION_TILES,
  HEIGHT_TILE_CELLS,
  HEIGHT_TILE_SIZE,
  WORLD_LIMIT,
  assertLevel,
  clipBounds,
  heightSpacing,
  parseHeightTileKey,
  unionBounds,
  type Bounds,
} from "./types";

const MAX_CELLS = 100_000;
const MAX_BUFFERS = 32 * 1024 * 1024;
const MAX_RESERVATIONS = 128;
const MAX_RECEIPTS = 2;

export interface BrushReservationContext {
  sessionId: string;
  gestureId: number;
  viewId: number;
  preparationId: number;
}

export interface BrushControlEffect {
  key: string;
  index: number;
  /** Signed, already integrated change to one author coefficient. */
  delta: number;
}

export interface BrushReservation {
  readonly id: number;
}

export interface BrushEffectReceipt extends BrushReservationContext {
  readonly id: number;
  /** Full cubic support of exactly this receipt's materialized effect. */
  readonly regions: readonly Bounds[];
}

export type BrushReservationResult =
  | { accepted: true; reservation: BrushReservation }
  | {
      accepted: false;
      reason: "closed" | "effect" | "cells" | "tiles" | "work" | "buffers";
    };

interface TileIndex {
  key: string;
  slot: number;
  tileX: number;
  tileY: number;
  /** Dense coefficient index plus one; zero means untouched in this gesture. */
  cells: Int32Array;
}

interface ReservedEffect {
  token: BrushReservation;
  cells: Uint32Array;
  amounts: Float64Array;
  count: number;
  cursor: number;
}

export interface BrushMaterialization {
  fromCell: number;
  toCell: number;
  totalCells: number;
  complete: boolean;
}

interface FrozenEffect {
  receipt: BrushEffectReceipt;
  /** Sorted canonical tile/control addresses, not the gesture's historical cells. */
  cells: Uint32Array;
  applied: Float64Array;
}

function validContext(context: BrushReservationContext): void {
  if (
    typeof context.sessionId !== "string" ||
    !context.sessionId.length ||
    context.sessionId.length > 256 ||
    [context.gestureId, context.viewId, context.preparationId].some(
      (value) => !Number.isSafeInteger(value) || value < 0,
    )
  )
    throw new RangeError("Ungültige lokale Pinselidentität.");
}

function sameContext(
  a: BrushReservationContext,
  b: BrushReservationContext,
): boolean {
  return (
    a.sessionId === b.sessionId &&
    a.gestureId === b.gestureId &&
    a.viewId === b.viewId &&
    a.preparationId === b.preparationId
  );
}

/**
 * Exact per-coefficient reservation ledger. The document owns its continuation;
 * the caller must independently prove source/D11
 * readiness and the complete visible influence before acknowledging a receipt.
 *
 * reserve -> materialize -> freeze -> acknowledge. Accepted but unapplied work
 * consumes the same B = |rate| * .05 allowance as unacknowledged applied work.
 * Only nonnegative magnitudes are stored, with one fixed gesture direction.
 *
 * Typed buffers are counted, including retained tickets and frozen receipts.
 * Maps/Sets have explicit cell/tile/ticket bounds; bufferBytes is not a claim
 * about measured JavaScript heap usage or execution time. No masks are needed.
 */
export class BrushReservations {
  readonly limit: number;
  private readonly level: number;
  private readonly direction: number;
  private readonly maxCells: number;
  private readonly maxTiles: number;
  private readonly maxBuffers: number;
  private readonly applied: Float64Array;
  private readonly reserved: Float64Array;
  /** Only currently materialized, unacknowledged controls need a render proof. */
  private readonly unconfirmed = new Set<number>();
  private readonly tiles = new Map<string, TileIndex>();
  private readonly bySlot: TileIndex[] = [];
  private readonly pending = new Map<number, ReservedEffect>();
  private readonly frozen = new Map<number, FrozenEffect>();
  private context: BrushReservationContext;
  private accepting = true;
  private cellCount = 0;
  private nextReservation = 1;
  private nextReceipt = 1;
  private acknowledgedReceipt = 0;
  private peakBytes = 0;
  private maximumOutstanding = 0;

  constructor(options: {
    rate: number;
    level: number;
    context: BrushReservationContext;
    maxCells?: number;
    maxTiles?: number;
    maxBufferBytes?: number;
  }) {
    assertLevel(options.level);
    validContext(options.context);
    this.maxCells = options.maxCells ?? MAX_CELLS;
    this.maxTiles = options.maxTiles ?? HEIGHT_MAX_ACTION_TILES;
    this.maxBuffers = options.maxBufferBytes ?? MAX_BUFFERS;
    if (
      !Number.isFinite(options.rate) ||
      !Number.isInteger(this.maxCells) ||
      this.maxCells < 1 ||
      this.maxCells > MAX_CELLS ||
      !Number.isInteger(this.maxTiles) ||
      this.maxTiles < 1 ||
      this.maxTiles > HEIGHT_MAX_ACTION_TILES ||
      !Number.isInteger(this.maxBuffers) ||
      this.maxBuffers < this.maxCells * 16 ||
      this.maxBuffers > MAX_BUFFERS
    )
      throw new RangeError("Ungültige Pinselreserve oder Arbeitsgrenze.");
    this.level = options.level;
    this.direction = Math.sign(options.rate);
    this.limit = Math.abs(options.rate) * 0.05;
    this.context = { ...options.context };
    this.applied = new Float64Array(this.maxCells);
    this.reserved = new Float64Array(this.maxCells);
    this.peakBytes = this.bufferBytes;
  }

  private get bufferBytes(): number {
    let bytes = this.applied.byteLength + this.reserved.byteLength;
    for (const tile of this.tiles.values()) bytes += tile.cells.byteLength;
    for (const entry of this.pending.values())
      bytes += entry.cells.byteLength + entry.amounts.byteLength;
    for (const entry of this.frozen.values())
      bytes += entry.cells.byteLength + entry.applied.byteLength;
    return bytes;
  }

  get usage() {
    return {
      cells: this.cellCount,
      tiles: this.tiles.size,
      reservations: this.pending.size,
      receipts: this.frozen.size,
      unconfirmedCells: this.unconfirmed.size,
      bufferBytes: this.bufferBytes,
      peakBufferBytes: this.peakBytes,
      maskBytes: 0,
      accepting: this.accepting,
      maximumOutstanding: this.maximumOutstanding,
    };
  }

  /** A request contains each changed coefficient once, after kernel integration. */
  reserve(effects: readonly BrushControlEffect[]): BrushReservationResult {
    if (!this.accepting) return { accepted: false, reason: "closed" };
    if (this.pending.size === MAX_RESERVATIONS)
      return { accepted: false, reason: "work" };
    if (effects.length > this.maxCells)
      return { accepted: false, reason: "cells" };
    const ticketBytes = effects.length * 12;
    const currentBytes = this.bufferBytes;
    if (currentBytes + ticketBytes > this.maxBuffers)
      return { accepted: false, reason: "buffers" };

    // These buffers become the ticket on success. No duplicate staging copy.
    const cells = new Uint32Array(effects.length);
    const amounts = new Float64Array(effects.length);
    this.peakBytes = Math.max(this.peakBytes, currentBytes + ticketBytes);
    const newTiles = new Map<
      string,
      { slot: number; tileX: number; tileY: number }
    >();
    const newCells = new Map<number, number>();
    const seen = new Set<number>();
    let count = 0;
    const spacing = heightSpacing(this.level);
    for (const effect of effects) {
      if (
        !Number.isInteger(effect.index) ||
        effect.index < 0 ||
        effect.index >= HEIGHT_TILE_CELLS ||
        !Number.isFinite(effect.delta) ||
        (effect.delta !== 0 && Math.sign(effect.delta) !== this.direction)
      )
        throw new RangeError("Ungültiger oder gegenläufiger Pinselbeitrag.");
      const existing = this.tiles.get(effect.key);
      let tile = existing ?? newTiles.get(effect.key);
      if (!tile) {
        const parsed = parseHeightTileKey(effect.key);
        if (parsed.level !== this.level)
          throw new RangeError("Eine Geste besitzt genau eine Autorenstufe.");
        if (
          effect.delta !== 0 &&
          this.tiles.size + newTiles.size === this.maxTiles
        )
          return { accepted: false, reason: "tiles" };
        tile = { ...parsed, slot: this.tiles.size + newTiles.size };
        if (effect.delta !== 0) newTiles.set(effect.key, tile);
      }
      if (
        Math.abs((tile.tileX * 64 + (effect.index % 64)) * spacing) >
          WORLD_LIMIT ||
        Math.abs((tile.tileY * 64 + Math.floor(effect.index / 64)) * spacing) >
          WORLD_LIMIT
      )
        throw new RangeError("Pinselstützstelle außerhalb der Welt.");
      if (effect.delta === 0) continue;
      const address = tile.slot * HEIGHT_TILE_CELLS + effect.index;
      if (seen.has(address))
        throw new RangeError("Pinselbeiträge je Stützstelle zuerst summieren.");
      seen.add(address);
      let cell = (existing?.cells[effect.index] ?? 0) - 1;
      if (cell < 0) {
        if (this.cellCount + newCells.size === this.maxCells)
          return { accepted: false, reason: "cells" };
        cell = this.cellCount + newCells.size;
        newCells.set(address, cell);
      }
      const amount = Math.abs(effect.delta);
      if (this.applied[cell] + this.reserved[cell] + amount > this.limit)
        return { accepted: false, reason: "effect" };
      // Encode the canonical tile/control address in the existing ticket
      // buffer. It needs no second dense address buffer or retained effects list.
      cells[count] = address;
      amounts[count++] = amount;
    }
    const nextBytes =
      currentBytes + ticketBytes + newTiles.size * HEIGHT_TILE_CELLS * 4;
    if (nextBytes > this.maxBuffers)
      return { accepted: false, reason: "buffers" };

    // All failures above precede logical mutation and tile-buffer allocation.
    for (const [key, tile] of newTiles) {
      const indexed: TileIndex = {
        ...tile,
        key,
        cells: new Int32Array(HEIGHT_TILE_CELLS),
      };
      this.tiles.set(key, indexed);
      this.bySlot.push(indexed);
    }
    for (const [address, cell] of newCells)
      this.bySlot[Math.floor(address / HEIGHT_TILE_CELLS)].cells[
        address % HEIGHT_TILE_CELLS
      ] = cell + 1;
    this.cellCount += newCells.size;
    for (let i = 0; i < count; i++) {
      const address = cells[i];
      const tile = this.bySlot[Math.floor(address / HEIGHT_TILE_CELLS)];
      const cell = tile.cells[address % HEIGHT_TILE_CELLS] - 1;
      this.reserved[cell] += amounts[i];
      this.maximumOutstanding = Math.max(
        this.maximumOutstanding,
        this.applied[cell] + this.reserved[cell],
      );
    }
    const token = Object.freeze({ id: this.nextReservation++ });
    this.pending.set(token.id, { token, cells, amounts, count, cursor: 0 });
    this.peakBytes = Math.max(this.peakBytes, nextBytes);
    return { accepted: true, reservation: token };
  }

  /** Transfer an accepted ticket; the caller applies exactly this reserved vector. */
  materialize(token: BrushReservation): boolean {
    const entry = this.pending.get(token.id);
    if (!entry || entry.token !== token) return false;
    return this.materializeSlice(token, entry.count - entry.cursor) !== null;
  }

  /** Visit and transfer exactly one bounded prefix of the reserved vector. */
  materializeSlice(
    token: BrushReservation,
    maxCells: number,
    apply?: (effect: BrushControlEffect) => void,
  ): BrushMaterialization | null {
    if (!Number.isSafeInteger(maxCells) || maxCells < 0)
      throw new RangeError("Ungültiges Materialisierungsbudget.");
    const entry = this.pending.get(token.id);
    if (!entry || entry.token !== token) return null;
    const fromCell = entry.cursor;
    const toCell = Math.min(entry.count, fromCell + maxCells);
    for (let i = fromCell; i < toCell; i++) {
      const address = entry.cells[i];
      const tile = this.bySlot[Math.floor(address / HEIGHT_TILE_CELLS)];
      const index = address % HEIGHT_TILE_CELLS;
      const cell = tile.cells[index] - 1;
      apply?.({
        key: tile.key,
        index,
        delta: this.direction * entry.amounts[i],
      });
      this.reserved[cell] = Math.max(0, this.reserved[cell] - entry.amounts[i]);
      this.applied[cell] += entry.amounts[i];
      this.unconfirmed.add(address);
    }
    entry.cursor = toCell;
    const complete = toCell === entry.count;
    if (complete) this.pending.delete(token.id);
    return { fromCell, toCell, totalCells: entry.count, complete };
  }

  /** Freeze the sparse applied vector and its support together; never reserved work. */
  freeze(): BrushEffectReceipt | null {
    const bytes = this.bufferBytes + this.unconfirmed.size * 12;
    if (this.frozen.size === MAX_RECEIPTS || bytes > this.maxBuffers)
      return null;
    const cells = Uint32Array.from(this.unconfirmed).sort();
    const applied = new Float64Array(cells.length);
    const regions = new Map<number, Bounds>();
    const step = heightSpacing(this.level);
    for (let i = 0; i < cells.length; i++) {
      const address = cells[i];
      const slot = Math.floor(address / HEIGHT_TILE_CELLS);
      const tile = this.bySlot[slot];
      const index = address % HEIGHT_TILE_CELLS;
      applied[i] = this.applied[tile.cells[index] - 1];
      const x =
        (tile.tileX * HEIGHT_TILE_SIZE + (index % HEIGHT_TILE_SIZE)) * step;
      const y =
        (tile.tileY * HEIGHT_TILE_SIZE + Math.floor(index / HEIGHT_TILE_SIZE)) *
        step;
      const support = clipBounds([
        x - 2 * step,
        y - 2 * step,
        x + 2 * step,
        y + 2 * step,
      ]);
      const old = regions.get(slot);
      regions.set(slot, old ? unionBounds(old, support) : support);
    }
    const receipt = Object.freeze({
      ...this.context,
      id: this.nextReceipt++,
      regions: Object.freeze(
        [...regions.values()].map((bounds) => Object.freeze(bounds) as Bounds),
      ),
    });
    this.frozen.set(receipt.id, { receipt, cells, applied });
    this.peakBytes = Math.max(this.peakBytes, bytes);
    return receipt;
  }

  /** A failed render acquisition releases its receipt slot, never any effect. */
  discard(receipt: BrushEffectReceipt): boolean {
    const frozen = this.frozen.get(receipt.id);
    if (!frozen || frozen.receipt !== receipt) return false;
    this.frozen.delete(receipt.id);
    return true;
  }

  /** A matching, complete external draw proof may release only its frozen vector. */
  acknowledge(receipt: BrushEffectReceipt): boolean {
    const frozen = this.frozen.get(receipt.id);
    if (
      !frozen ||
      frozen.receipt !== receipt ||
      receipt.id <= this.acknowledgedReceipt ||
      !sameContext(receipt, this.context) ||
      !sameContext(receipt, frozen.receipt)
    )
      return false;
    for (let i = 0; i < frozen.applied.length; i++) {
      const address = frozen.cells[i];
      const tile = this.bySlot[Math.floor(address / HEIGHT_TILE_CELLS)];
      const cell = tile.cells[address % HEIGHT_TILE_CELLS] - 1;
      const confirmed = frozen.applied[i];
      this.applied[cell] = Math.max(0, this.applied[cell] - confirmed);
      if (this.applied[cell] === 0) this.unconfirmed.delete(address);
    }
    // Receipts contain different sparse sets. Merge sorted addresses rather
    // than treating their array positions as the same author coefficient.
    // Remaining vectors stay relative, avoiding cumulative cancellation error.
    for (const later of this.frozen.values()) {
      if (later.receipt.id <= receipt.id) continue;
      let before = 0;
      for (
        let i = 0;
        i < later.cells.length && before < frozen.cells.length;
        i++
      ) {
        while (
          before < frozen.cells.length &&
          frozen.cells[before] < later.cells[i]
        )
          before++;
        if (frozen.cells[before] === later.cells[i])
          later.applied[i] = Math.max(
            0,
            later.applied[i] - frozen.applied[before],
          );
      }
    }
    this.acknowledgedReceipt = receipt.id;
    for (const id of this.frozen.keys())
      if (id <= receipt.id) this.frozen.delete(id);
    return true;
  }

  effectAt(key: string, index: number) {
    const cell = this.controlIndex(key, index);
    const applied = cell === null ? 0 : this.applied[cell];
    const reserved = cell === null ? 0 : this.reserved[cell];
    return { applied, reserved, total: applied + reserved };
  }

  /** Stable dense slot shared by the bounded C1 account; no second tile index. */
  controlIndex(key: string, index: number): number | null {
    const cell = (this.tiles.get(key)?.cells[index] ?? 0) - 1;
    return cell < 0 ? null : cell;
  }

  /** Up stops acceptance; already accepted tickets can still materialize. */
  seal(): void {
    this.accepting = false;
  }

  /** A changed view/preparation invalidates old receipts, not accepted work. */
  changeContext(context: BrushReservationContext): void {
    validContext(context);
    if (
      context.sessionId !== this.context.sessionId ||
      context.gestureId !== this.context.gestureId
    )
      throw new RangeError(
        "Eine Pinselreserve gehört genau einer Sitzung/Geste.",
      );
    if (sameContext(context, this.context)) return;
    this.accepting = false;
    this.context = { ...context };
    this.frozen.clear();
  }
}
