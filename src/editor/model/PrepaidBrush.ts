import {
  BrushReservations,
  type BrushEffectReceipt,
  type BrushControlEffect,
  type BrushReservation,
  type BrushReservationContext,
  type BrushReservationResult,
} from "./BrushReservations";
import {
  HEIGHT_TILE_CELLS,
  HEIGHT_MAX_ACTION_TILES,
  WORLD_LIMIT,
  assertPoint,
  heightSpacing,
  parseHeightTileKey,
  type HeightBrush,
  type Point,
} from "./types";

export interface PrepaidBrushOffer {
  key: string;
  index: number;
  /** Nonnegative |rate|/60 × greatest kernel value on the captured path. */
  minimum: number;
  /** Nonnegative, newly offered temporal coefficient effect, never a backlog. */
  time: number;
}

export interface PrepaidBrushChange {
  key: string;
  index: number;
  delta: number;
  acceptedTime: number;
  discardedTime: number;
  minimum: number;
  timeAccount: number;
  total: number;
}

export type PrepaidBrushResult =
  | {
      accepted: true;
      reservation: BrushReservation | null;
      changes: PrepaidBrushChange[];
    }
  | Exclude<BrushReservationResult, { accepted: true }>;

/** Continuous swept minimum, independently implemented from the offline oracle. */
export function prepaidMinimumAt(
  brush: Pick<HeightBrush, "radius" | "amount">,
  from: Point,
  to: Point,
  control: Point,
): number {
  for (const point of [from, to, control]) assertPoint(point);
  if (
    !Number.isFinite(brush.radius) ||
    brush.radius <= 0 ||
    !Number.isFinite(brush.amount)
  )
    throw new RangeError("Ungültiger vorausbezahlter Höhenpinsel.");
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const length = Math.hypot(dx, dy);
  const ux = length ? dx / length : 0;
  const uy = length ? dy / length : 0;
  const along = Math.max(
    0,
    Math.min(length, (control[0] - from[0]) * ux + (control[1] - from[1]) * uy),
  );
  const distance = Math.hypot(
    control[0] - from[0] - along * ux,
    control[1] - from[1] - along * uy,
  );
  const normalized = distance / brush.radius;
  return normalized >= 1
    ? 0
    : (Math.abs(brush.amount) / 60) * (1 - normalized * normalized) ** 2;
}

/**
 * The active document's C1 account. Author magnitude is max(F,T):
 * F is a once-only swept minimum and T is cumulative accepted temporal effect.
 * The initial click is part of F, never an extra addition. Time below F uses
 * prepaid credit; repeated zero-time visits do not accumulate more floor.
 *
 * The local ledger limits applied plus reserved author increments. Excess time
 * is returned as discarded immediately, never kept for a later receipt. F and T
 * advance on successful reservation and are unaffected by materialization/acks.
 */
export class PrepaidBrush {
  private readonly ledger: BrushReservations;
  private readonly minimum: Float64Array;
  private readonly timeAccount: Float64Array;
  private readonly level: number;
  private readonly direction: number;
  private readonly pulse: number;

  constructor(options: {
    rate: number;
    level: number;
    context: BrushReservationContext;
    maxCells?: number;
    maxTiles?: number;
    maxBufferBytes?: number;
  }) {
    const maxCells = options.maxCells ?? 100_000;
    const bytes = maxCells * 16;
    const maxBufferBytes = options.maxBufferBytes ?? 32 * 1024 * 1024;
    if (!Number.isInteger(maxBufferBytes) || maxBufferBytes > 32 * 1024 * 1024)
      throw new RangeError("Vorausbezahlte Belege überschreiten 32 MiB.");
    this.ledger = new BrushReservations({
      ...options,
      maxCells,
      maxBufferBytes: maxBufferBytes - bytes,
    });
    this.minimum = new Float64Array(maxCells);
    this.timeAccount = new Float64Array(maxCells);
    this.level = options.level;
    this.direction = Math.sign(options.rate);
    this.pulse = Math.abs(options.rate) / 60;
  }

  get usage() {
    const usage = this.ledger.usage;
    const bytes = this.minimum.byteLength + this.timeAccount.byteLength;
    return {
      ...usage,
      bufferBytes: usage.bufferBytes + bytes,
      peakBufferBytes: usage.peakBufferBytes + bytes,
    };
  }

  valueAt(key: string, index: number) {
    const cell = this.ledger.controlIndex(key, index);
    const minimum = cell === null ? 0 : this.minimum[cell];
    const timeAccount = cell === null ? 0 : this.timeAccount[cell];
    return { minimum, timeAccount, total: Math.max(minimum, timeAccount) };
  }

  /** Each coefficient appears once; caller integrates the complete new window. */
  offer(
    offers: readonly PrepaidBrushOffer[],
    validate?: (changes: readonly PrepaidBrushChange[]) => void,
  ): PrepaidBrushResult {
    if (!this.ledger.usage.accepting)
      return { accepted: false, reason: "closed" };
    if (offers.length > this.minimum.length)
      return { accepted: false, reason: "cells" };
    const seen = new Set<string>();
    const changes: PrepaidBrushChange[] = [];
    const step = heightSpacing(this.level);
    const parsedTiles = new Map<
      string,
      ReturnType<typeof parseHeightTileKey>
    >();
    for (const offer of offers) {
      if (
        !Number.isInteger(offer.index) ||
        offer.index < 0 ||
        offer.index >= HEIGHT_TILE_CELLS ||
        !Number.isFinite(offer.minimum) ||
        offer.minimum < 0 ||
        offer.minimum > this.pulse ||
        !Number.isFinite(offer.time) ||
        offer.time < 0 ||
        (this.direction === 0 && offer.time !== 0)
      )
        throw new RangeError("Ungültiger Mindest- oder Zeitauftrag.");
      let parsed = parsedTiles.get(offer.key);
      if (!parsed) {
        if (parsedTiles.size === HEIGHT_MAX_ACTION_TILES)
          return { accepted: false, reason: "tiles" };
        parsedTiles.set(offer.key, (parsed = parseHeightTileKey(offer.key)));
      }
      if (
        parsed.level !== this.level ||
        Math.abs((parsed.tileX * 64 + (offer.index % 64)) * step) >
          WORLD_LIMIT ||
        Math.abs((parsed.tileY * 64 + Math.floor(offer.index / 64)) * step) >
          WORLD_LIMIT
      )
        throw new RangeError("Ungültige vorausbezahlte Autorenstützstelle.");
      const address = `${offer.key}/${offer.index}`;
      if (seen.has(address))
        throw new RangeError("Mindest-/Zeitaufträge je Stützstelle summieren.");
      seen.add(address);

      const old = this.valueAt(offer.key, offer.index);
      const minimum = Math.max(old.minimum, offer.minimum);
      const outstanding = this.ledger.effectAt(offer.key, offer.index).total;
      const available = Math.max(0, this.ledger.limit - outstanding);
      const maximum = old.total + available;
      if (!Number.isFinite(maximum))
        throw new RangeError("Vorausbezahlte Höhe überschreitet Float64.");
      let timeAccount =
        old.timeAccount + Math.min(offer.time, maximum - old.timeAccount);
      // Rounded differences at a large cumulative height must not create a
      // sliver of extra unacknowledged effect. Discard it explicitly as time.
      if (
        outstanding + (Math.max(minimum, timeAccount) - old.total) >
        this.ledger.limit
      )
        timeAccount = Math.max(
          old.timeAccount,
          timeAccount -
            Math.max(Number.MIN_VALUE, Math.abs(timeAccount) * Number.EPSILON),
        );
      const total = Math.max(minimum, timeAccount);
      const acceptedTime = Math.min(
        offer.time,
        Math.max(0, timeAccount - old.timeAccount),
      );
      changes.push({
        key: offer.key,
        index: offer.index,
        delta: this.direction * (total - old.total),
        acceptedTime,
        discardedTime: Math.max(0, offer.time - acceptedTime),
        minimum,
        timeAccount,
        total,
      });
    }

    // Future source/history/work budgets must be accepted before either C1
    // account or reservation ledger changes, including prepaid zero-delta time.
    validate?.(changes);
    const effects = changes
      .filter((change) => change.delta !== 0)
      .map(({ key, index, delta }) => ({ key, index, delta }));
    const result = effects.length ? this.ledger.reserve(effects) : null;
    if (result && !result.accepted) return result;
    for (const change of changes) {
      const cell = this.ledger.controlIndex(change.key, change.index);
      if (cell === null) continue; // All-zero contribution, no author or account.
      this.minimum[cell] = change.minimum;
      this.timeAccount[cell] = change.timeAccount;
    }
    return {
      accepted: true,
      reservation: result?.accepted ? result.reservation : null,
      changes,
    };
  }

  materialize(reservation: BrushReservation | null): boolean {
    return reservation === null || this.ledger.materialize(reservation);
  }

  materializeSlice(
    reservation: BrushReservation,
    maxCells: number,
    apply: (effect: BrushControlEffect) => void,
  ) {
    return this.ledger.materializeSlice(reservation, maxCells, apply);
  }

  effectAt(key: string, index: number) {
    return this.ledger.effectAt(key, index);
  }

  get limit(): number {
    return this.ledger.limit;
  }

  freeze(): BrushEffectReceipt | null {
    return this.ledger.freeze();
  }

  discard(receipt: BrushEffectReceipt): boolean {
    return this.ledger.discard(receipt);
  }

  acknowledge(receipt: BrushEffectReceipt): boolean {
    return this.ledger.acknowledge(receipt);
  }

  seal(): void {
    this.ledger.seal();
  }

  changeContext(context: BrushReservationContext): void {
    this.ledger.changeContext(context);
  }
}
