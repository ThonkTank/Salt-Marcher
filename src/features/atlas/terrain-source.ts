import { AtlasHistory, type AtlasChange } from "./atlas-history";
import type { OverworldDocument } from "./overworld";
import { checkedLocationPlacements } from "./location-placement";
import type { AtlasValue } from "./atlas-history";
import {
  checkedAxial,
  checkedTerrainCell,
  chunkAddress,
  parseTerrainChunk,
  terrainChunkFile,
  terrainChunkKey,
  terrainExtent,
  terrainTarget,
  terrainValue,
  validateTerrainChange,
  type AxialCell,
  type TerrainCell,
  type TerrainChunk,
  type TerrainReference,
  type TerrainExtent,
} from "./terrain-schema";

export type TerrainTool = "land" | "sea" | "forest" | "reset";
export const TERRAIN_COLORS = Object.freeze({
  land: "#dbc998",
  sea: "#9dcbd5",
  forest: "#66866a",
});
/** Sparse storage and loading know nothing about Obsidian, pixels or the camera. */
export class TerrainSource {
  private refs = new Map<string, TerrainReference>();
  private loaded = new Set<string>();
  private loading = new Map<string, Promise<void>>();
  constructor(
    readonly world: OverworldDocument,
    readonly history: AtlasHistory,
    private load: (reference: TerrainReference) => Promise<string>,
  ) {
    history.register(world.id, (target, value) => {
      if (target !== "placements") return validateTerrainChange(target, value);
      if (
        checkedLocationPlacements(value).some((p) => p.locationId === world.id)
      )
        throw new Error(
          "Ort und Welt benötigen verschiedene Dokumentkennungen.",
        );
    });
    history.hydrate(world.id, [
      ["placements", world.placements as unknown as AtlasValue],
    ]);
    for (const ref of world.chunks) this.refs.set(terrainChunkKey(ref), ref);
  }
  async ensure(cells: readonly AxialCell[]): Promise<void> {
    await Promise.all(
      [
        ...new Map(
          cells.map((cell) => {
            const chunk = chunkAddress(cell);
            return [terrainChunkKey(chunk), chunk] as const;
          }),
        ).values(),
      ].map((chunk) => this.ensureChunk(chunk)),
    );
  }
  async ensureVisible(bounds: TerrainExtent): Promise<void> {
    await Promise.all(
      [...this.refs.values()]
        .filter(
          (ref) =>
            ref.extent.maxQ >= bounds.minQ &&
            ref.extent.minQ <= bounds.maxQ &&
            ref.extent.maxR >= bounds.minR &&
            ref.extent.minR <= bounds.maxR,
        )
        .map((ref) => this.ensureChunk(ref)),
    );
  }
  private async ensureChunk(chunk: AxialCell): Promise<void> {
    const key = terrainChunkKey(chunk);
    if (this.loaded.has(key)) return;
    if (this.loading.has(key)) return this.loading.get(key)!;
    const reference = this.refs.get(key);
    if (!reference) {
      this.loaded.add(key);
      return;
    }
    const pending = (async () => {
      const doc = parseTerrainChunk(
        await this.load(reference),
        this.world.id,
        reference,
      );
      this.history.hydrate(
        this.world.id,
        doc.cells.map((c) => [terrainTarget(c), terrainValue(c)] as const),
      );
      this.loaded.add(key);
    })();
    this.loading.set(key, pending);
    try {
      await pending;
    } finally {
      this.loading.delete(key);
    }
  }
  read(a: AxialCell): TerrainCell | null {
    if (!this.loaded.has(terrainChunkKey(chunkAddress(a))))
      throw new Error("Landschaft ist noch nicht geladen.");
    const value = this.history.read(this.world.id, terrainTarget(a));
    return value === null ? null : checkedTerrainCell(value);
  }
  cells(): readonly TerrainCell[] {
    return this.history
      .entries(this.world.id)
      .flatMap(([target, value]) =>
        target === "placements" || value === null
          ? []
          : [checkedTerrainCell(value)],
      );
  }
  placements() {
    return checkedLocationPlacements(
      this.history.read(this.world.id, "placements"),
    );
  }
  references(): readonly TerrainReference[] {
    const refs = new Map(this.refs),
      chunks = new Map<string, TerrainCell[]>();
    for (const key of this.loaded) refs.delete(key);
    for (const cell of this.cells()) {
      const key = terrainChunkKey(chunkAddress(cell));
      if (!chunks.has(key)) chunks.set(key, []);
      chunks.get(key)!.push(cell);
    }
    for (const [key, cells] of chunks) {
      const a = chunkAddress(cells[0]!);
      refs.set(
        key,
        Object.freeze({
          ...a,
          level: 0,
          file: terrainChunkFile(a),
          cellCount: cells.length,
          extent: terrainExtent(cells)!,
        }),
      );
    }
    return [...refs.values()].sort((a, b) => a.q - b.q || a.r - b.r);
  }
  loadedChunks(): readonly TerrainChunk[] {
    const refs = this.references();
    return refs
      .filter((ref) => this.loaded.has(terrainChunkKey(ref)))
      .map((ref) =>
        Object.freeze({
          kind: "atlas-terrain",
          version: 1,
          worldId: this.world.id,
          level: 0,
          q: ref.q,
          r: ref.r,
          cells: Object.freeze(
            this.cells()
              .filter(
                (c) =>
                  terrainChunkKey(chunkAddress(c)) === terrainChunkKey(ref),
              )
              .sort((a, b) => a.q - b.q || a.r - b.r),
          ),
        }),
      );
  }
}
/** Cube interpolation fills every skipped neighbor; only a stroke allocates cells. */
export function axialLine(
  from: AxialCell,
  to: AxialCell,
): readonly AxialCell[] {
  checkedAxial(from.q, from.r);
  checkedAxial(to.q, to.r);
  const count = Math.max(
    Math.abs(from.q - to.q),
    Math.abs(from.r - to.r),
    Math.abs(from.q + from.r - to.q - to.r),
  );
  // Refuse one accidental huge pointer jump without allocating an unbounded array.
  if (count > 10000)
    throw new Error(
      "Der Pinselzug ist zu lang. Näher heranzoomen und in Abschnitten zeichnen.",
    );
  return Array.from({ length: count + 1 }, (_, i) => {
    const t = count ? i / count : 0,
      x = from.q + (to.q - from.q) * t,
      y = from.r + (to.r - from.r) * t,
      z = -x - y;
    let q = Math.round(x),
      r = Math.round(y);
    const s = Math.round(z),
      qe = Math.abs(q - x),
      re = Math.abs(r - y),
      se = Math.abs(s - z);
    if (qe >= re && qe >= se) q = -r - s;
    else if (re >= se) r = -q - s;
    return { q: q || 0, r: r || 0 };
  });
}
export class TerrainStroke {
  private changes = new Map<string, AtlasChange>();
  private previous?: AxialCell;
  private ended = false;
  constructor(
    readonly source: TerrainSource,
    readonly tool: TerrainTool,
    readonly color: string = tool === "reset"
      ? TERRAIN_COLORS.land
      : TERRAIN_COLORS[tool],
  ) {
    if (!/^#[0-9a-f]{6}$/.test(color))
      throw new Error("Ungültige Pinselfarbe.");
  }
  next(a: AxialCell): readonly AxialCell[] {
    return axialLine(this.previous ?? a, a);
  }
  add(a: AxialCell): void {
    if (this.ended) throw new Error("Pinselzug bereits abgeschlossen.");
    const pending = this.next(a).map((cell) => {
      const target = terrainTarget(cell),
        previous = this.changes.get(target),
        before = previous
          ? previous.before
          : terrainValue(this.source.read(cell));
      const after =
        this.tool === "reset"
          ? null
          : terrainValue(
              checkedTerrainCell({
                ...cell,
                surface: this.tool === "sea" ? "sea" : "land",
                terrain: this.tool === "forest" ? "forest" : "plain",
                color: this.color,
              }),
            );
      return { ownerId: this.source.world.id, target, before, after };
    });
    for (const change of pending) this.changes.set(change.target, change);
    this.previous = { ...a };
  }
  preview(): readonly AtlasChange[] {
    return [...this.changes.values()];
  }
  finish(): boolean {
    if (this.ended) return false;
    const changed = this.source.history.execute({
      label: "Gelände zeichnen",
      changes: this.preview(),
    });
    this.ended = true;
    return changed;
  }
}
