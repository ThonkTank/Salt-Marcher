import type { Bounds, DetailTile, Status } from "./model";

// Reject incomplete or malformed hints: without a journal they cannot prove
// anything about data retained from the preceding revision.
export function knownChanges(
  status: Status,
): NonNullable<Status["changes"]> | null {
  const c = status.changes;
  const bounds = (b: unknown): b is Bounds =>
    Array.isArray(b) &&
    b.length === 4 &&
    b.every(Number.isFinite) &&
    b[0] <= b[2] &&
    b[1] <= b[3];
  if (
    !c ||
    !Array.isArray(c.world) ||
    !c.world.every(bounds) ||
    !Array.isArray(c.metadata) ||
    !c.metadata.every((id) => typeof id === "string") ||
    !Array.isArray(c.relations) ||
    !c.relations.every((id) => typeof id === "string") ||
    !Array.isArray(c.interiors) ||
    !c.interiors.every(
      (r) =>
        r &&
        typeof r.buildingId === "string" &&
        Number.isSafeInteger(r.floor) &&
        bounds(r.bounds),
    )
  )
    return null;
  return c;
}

export function tileAffected(
  tile: DetailTile,
  changes: NonNullable<Status["changes"]>,
): boolean {
  const [x0, y0, x1, y1] = tile.bounds;
  return changes.interiors.some(
    (r) =>
      r.buildingId === tile.buildingId &&
      (r.floor === tile.floor || (tile.includeLower && r.floor < tile.floor)) &&
      r.bounds[0] <= x1 + 1 &&
      r.bounds[2] >= x0 - 1 &&
      r.bounds[1] <= y1 + 1 &&
      r.bounds[3] >= y0 - 1,
  );
}

// Bound dense and empty tiles separately.
export const TILE_CACHE_ENTRIES = 32;
export const TILE_CACHE_RECORDS = 262_144;
export type TileContext = {
  session: string;
  revision: number;
  house: string;
  editor: string;
  selectedId: string;
  floor: number;
  lower: boolean;
  retry: number;
  enabled: boolean;
};
export const tileKey = (context: TileContext, x: number, y: number) =>
  JSON.stringify([
    context.session,
    context.house,
    context.editor,
    context.selectedId,
    context.floor,
    context.lower,
    x,
    y,
  ]);

type Flight = { owners: Set<symbol>; promise: Promise<DetailTile | undefined> };

export class TileCache {
  private context: TileContext | null = null;
  private epoch = 0;
  private entries = new Map<string, DetailTile>();
  private flights = new Map<string, Flight>();
  private records = 0;
  constructor(
    private readonly maxEntries = TILE_CACHE_ENTRIES,
    private readonly maxRecords = TILE_CACHE_RECORDS,
  ) {}
  setContext(context: TileContext | null, status?: Status) {
    const prior = this.context;
    if (JSON.stringify(context) === JSON.stringify(prior)) return;
    const changes = status && knownChanges(status);
    const promote =
      prior &&
      context &&
      status &&
      changes &&
      prior.session === context.session &&
      prior.house === context.house &&
      prior.editor === context.editor &&
      prior.selectedId === context.selectedId &&
      prior.floor === context.floor &&
      prior.lower === context.lower &&
      prior.retry === context.retry &&
      prior.enabled &&
      context.enabled &&
      context.revision === prior.revision + 1 &&
      status.sessionId === context.session &&
      status.revision === context.revision;
    this.context = context;
    this.epoch++;
    if (promote) {
      for (const [key, tile] of this.entries) {
        if (tileAffected(tile, changes)) {
          this.entries.delete(key);
          this.records -= tile.cells.length + tile.lower.length;
        } else {
          // The cell arrays have been proven unchanged; the response envelope
          // now belongs to the current coherent presentation revision.
          this.entries.set(key, { ...tile, status });
        }
      }
    } else {
      this.entries.clear();
      this.records = 0;
    }
    // Old transports still own their scheduler slots until they settle.
    this.flights.clear();
  }
  release(owner: symbol) {
    for (const flight of this.flights.values()) flight.owners.delete(owner);
  }
  get(
    context: TileContext,
    x: number,
    y: number,
    owner: symbol,
    load: (wanted: () => boolean) => Promise<DetailTile | undefined>,
    valid: (tile: DetailTile) => boolean,
  ): Promise<DetailTile | undefined> {
    const key = tileKey(context, x, y);
    const entry = this.entries.get(key);
    if (entry) {
      this.entries.delete(key);
      this.entries.set(key, entry);

      return Promise.resolve(entry);
    }
    const existing = this.flights.get(key);
    if (existing) {
      existing.owners.add(owner);

      return existing.promise;
    }
    const epoch = this.epoch;
    const flight: Flight = { owners: new Set([owner]), promise: undefined! };
    const wanted = () => this.epoch === epoch && flight.owners.size > 0;
    flight.promise = Promise.resolve()
      .then(() => load(wanted))
      .then((tile) => {
        if (!tile) return undefined;
        if (!valid(tile))
          throw Error(
            "Dokumentstand hat sich während des Ladens geändert. Bitte erneut laden.",
          );
        if (this.epoch === epoch) {
          const size = tile.cells.length + tile.lower.length;
          if (size <= this.maxRecords && this.maxEntries > 0) {
            while (
              this.entries.size >= this.maxEntries ||
              this.records + size > this.maxRecords
            ) {
              const oldest = this.entries.keys().next().value as string;
              const evicted = this.entries.get(oldest)!;
              this.entries.delete(oldest);
              this.records -= evicted.cells.length + evicted.lower.length;
            }
            this.entries.set(key, tile);
            this.records += size;
          }
        }
        return tile;
      })
      .finally(() => {
        if (this.flights.get(key) === flight) this.flights.delete(key);
      });
    this.flights.set(key, flight);

    return flight.promise;
  }
}
