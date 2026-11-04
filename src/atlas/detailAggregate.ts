import {
  mergeDetails,
  type Bounds,
  type Detail,
  type DetailTile,
  type InteriorMetadata,
} from "./model";

// The second entry is admitted only within this shared logical cell budget.
export const AGGREGATE_CELL_BUDGET = 65_536;
const TILE_BUDGET = 32;
type Entry = {
  context: string;
  keys: string[];
  bounds: Bounds[];
  cells: WeakRef<DetailTile["cells"]>[];
  lower: WeakRef<DetailTile["lower"]>[];
  detail: Pick<
    Detail,
    "buildingId" | "floor" | "includeLower" | "bounds" | "cells" | "lower"
  >;
};

// Weak source identities do not keep tile arrays and halo records alive after
// TileCache eviction. The merged cells themselves remain bounded below.
export class DetailAggregate {
  private entries: Entry[] = [];

  clear() {
    this.entries = [];
  }

  get(keys: string[], parts: DetailTile[], metadata: InteriorMetadata): Detail {
    const first = parts[0];
    const context = JSON.stringify([
      first.status.sessionId,
      first.buildingId,
      first.floor,
      first.includeLower,
    ]);
    if (this.entries[0]?.context !== context) this.clear();
    const index = this.entries.findIndex(
      (entry) =>
        keys.length === entry.keys.length &&
        keys.every(
          (key, i) =>
            key === entry.keys[i] &&
            parts[i].bounds.every((v, j) => v === entry.bounds[i][j]) &&
            parts[i].cells === entry.cells[i].deref() &&
            parts[i].lower === entry.lower[i].deref(),
        ),
    );
    if (index >= 0) {
      const [entry] = this.entries.splice(index, 1);
      this.entries.unshift(entry);
      return {
        ...entry.detail,
        status: metadata.status,
        rooms: metadata.rooms,
        connections: metadata.connections,
      };
    }
    const bounds: Bounds = [...first.bounds];
    for (const part of parts.slice(1)) {
      bounds[0] = Math.min(bounds[0], part.bounds[0]);
      bounds[1] = Math.min(bounds[1], part.bounds[1]);
      bounds[2] = Math.max(bounds[2], part.bounds[2]);
      bounds[3] = Math.max(bounds[3], part.bounds[3]);
    }
    const detail = mergeDetails(parts, metadata, bounds);
    const entry: Entry = {
      context,
      keys: [...keys],
      bounds: parts.map((part) => [...part.bounds]),
      cells: parts.map((p) => new WeakRef(p.cells)),
      lower: parts.map((p) => new WeakRef(p.lower)),
      detail: {
        buildingId: detail.buildingId,
        floor: detail.floor,
        includeLower: detail.includeLower,
        bounds: detail.bounds,
        cells: detail.cells,
        lower: detail.lower,
      },
    };
    const previous = this.entries[0];
    const count = (e: Entry) => e.detail.cells.length + e.detail.lower.length;
    this.entries =
      previous &&
      parts.length <= TILE_BUDGET &&
      previous.keys.length <= TILE_BUDGET &&
      count(entry) + count(previous) <= AGGREGATE_CELL_BUDGET
        ? [entry, previous]
        : [entry];
    return detail;
  }
}
