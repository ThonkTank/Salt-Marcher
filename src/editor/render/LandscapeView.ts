import {
  applyLandscapeOverviewPatch,
  cloneLandscapeOverviewTile,
  createLandscapeOverviewTile,
  landscapeOverviewKey,
  landscapeOverviewKeys,
  minimumCoarseLandscapeLevel,
  parseLandscapeOverviewKey,
  prepareLandscapePresentation,
  validateLandscapeOverviewTile,
  type LandscapeOverviewTile,
  type LandscapePresentationRead,
} from "../model/landscape";
import {
  clipBounds,
  intersectsBounds,
  landscapeCellAddress,
  landscapeTileBounds,
  parseLandscapeTileKey,
  type Bounds,
  type EditorDocument,
  type LandscapePatch,
  type LandscapeTile,
  type LandscapeWeights,
} from "../model";

/** Immutable inputs captured with the same revision as the terrain packet. */
export interface LandscapeFrame {
  readonly buffers: Set<ArrayBufferLike>;
  prepare(): Generator<void, (x: number, y: number) => LandscapeWeights, void>;
}

interface Base {
  sequence: number;
  overview: LandscapeOverviewTile | null;
}

const hasRemoval = (patch: LandscapePatch) =>
  Boolean(patch.before?.mask.some((mask, i) => mask && !patch.after?.mask[i]));

/**
 * Bounded presentation cache only. Authors, active edits and pending journal
 * remain in EditorDocument. Unknown inheritance requests a current store
 * overview instead of scanning or loading finer descendants.
 */
export class LandscapeView {
  private bases = new Map<string, Base>();
  private frames = new Map<string, LandscapeFrame>();
  private pending = new Map<number, LandscapePatch[]>();
  private requiredSequence = 0;
  private initialSequence: number;
  private untouched: boolean;

  constructor(
    private document: EditorDocument,
    private initiallyEmpty: boolean,
  ) {
    this.initialSequence = document.sequence;
    this.untouched = initiallyEmpty;
  }

  get empty(): boolean {
    return this.untouched;
  }

  private base(key: string): Base | undefined {
    return (
      this.bases.get(key) ??
      (this.initiallyEmpty &&
      (this.requiredSequence === 0 ||
        this.document.persistedSequence < this.requiredSequence)
        ? { sequence: this.initialSequence, overview: null }
        : undefined)
    );
  }

  changed(sequence?: number): void {
    this.untouched = false;
    if (sequence !== undefined)
      this.requiredSequence = Math.max(this.requiredSequence, sequence);
    this.frames.clear();
    this.pending.clear();
  }

  accept(read: LandscapePresentationRead): void {
    if (read.sessionId !== this.document.sessionId)
      throw new Error(
        "Landschaftsdarstellung gehört zu einer anderen Sitzung.",
      );
    const wanted = new Set(read.overviewKeys);
    const incoming = new Map<string, LandscapeOverviewTile>();
    for (const overview of read.overviews) {
      validateLandscapeOverviewTile(overview);
      if (
        !wanted.has(overview.key) ||
        overview.power !== read.power ||
        incoming.has(overview.key)
      )
        throw new Error("Unpassende Landschaftsübersicht.");
      incoming.set(overview.key, overview);
    }
    for (const key of read.overviewKeys) {
      if (parseLandscapeOverviewKey(key).power !== read.power)
        throw new Error("Unpassende Landschaftsdarstellungsstufe.");
      this.bases.set(key, {
        sequence: read.sequence,
        overview: incoming.get(key) ?? null,
      });
    }
    // Only the current view and its fixed halo are retained.
    for (const key of this.bases.keys())
      if (!wanted.has(key)) this.bases.delete(key);
    this.frames.clear();
    this.pending.clear();
  }

  private inputs(bounds: Bounds, power: number) {
    const clipped = clipBounds(bounds);
    const cutoff = minimumCoarseLandscapeLevel(power);
    if (!this.document.isLandscapeReady(clipped, cutoff)) return null;
    const span = 128 * 2 ** power;
    const key = landscapeOverviewKey(
      power,
      Math.floor(bounds[0] / span),
      Math.floor(bounds[1] / span),
    );
    const base = this.base(key);
    if (
      !base ||
      base.sequence < this.document.persistedSequence ||
      (base.sequence < this.requiredSequence &&
        this.document.persistedSequence >= this.requiredSequence)
    )
      return null;
    let pending = this.pending.get(base.sequence);
    if (!pending) {
      pending = this.document.landscapePatchesAfter(base.sequence);
      this.pending.set(base.sequence, pending);
    }
    const patches = pending.filter((patch) =>
      intersectsBounds(
        landscapeTileBounds(parseLandscapeTileKey(patch.key)),
        clipped,
      ),
    );
    const removals = patches.filter(
      (patch) =>
        parseLandscapeTileKey(patch.key).level < cutoff && hasRemoval(patch),
    );
    const minLevel = Math.min(
      cutoff,
      ...removals.map((patch) => parseLandscapeTileKey(patch.key).level),
    );
    if (!this.document.isLandscapeReady(clipped, minLevel)) return null;
    return {
      key,
      base,
      cutoff,
      patches,
      sources: this.document.landscapeSources(clipped, minLevel),
    };
  }

  ready(bounds: Bounds, power: number): boolean {
    if (this.untouched) return true;
    return landscapeOverviewKeys(clipBounds(bounds), power).every((key) => {
      const at = parseLandscapeOverviewKey(key),
        span = 128 * 2 ** power;
      const area: Bounds = [
        at.tileX * span,
        at.tileY * span,
        (at.tileX + 1) * span,
        (at.tileY + 1) * span,
      ];
      return (
        !intersectsBounds(area, bounds) || this.inputs(area, power) !== null
      );
    });
  }

  freeze(bounds: Bounds, power: number): LandscapeFrame | null {
    if (this.untouched) return null;
    const input = this.inputs(bounds, power);
    if (!input)
      throw new Error(
        "Landschaftsdarstellung ist noch nicht vollständig bereit.",
      );
    if (!input.base.overview && !input.sources.length && !input.patches.length)
      return null;
    const cached = this.frames.get(input.key);
    if (cached) return cached;
    const { base, cutoff, patches, sources, key } = input;
    const buffers = new Set<ArrayBufferLike>();
    const addSource = (tile: LandscapeTile | null) => {
      if (tile) {
        buffers.add(tile.mask.buffer);
        buffers.add(tile.values.buffer);
      }
    };
    sources.forEach(addSource);
    for (const patch of patches) {
      addSource(patch.before);
      addSource(patch.after);
    }
    const addOverview = (tile: LandscapeOverviewTile) => {
      buffers.add(tile.own.buffer);
      buffers.add(tile.rest.buffer);
      buffers.add(tile.sourceLevels.buffer);
    };
    if (base.overview) addOverview(base.overview);
    const sourceMap = new Map(sources.map((tile) => [tile.key, tile]));
    const lookup = (
      level: number,
      x: number,
      y: number,
    ): LandscapeWeights | null => {
      const at = landscapeCellAddress(level, x, y);
      const tile = sourceMap.get(at.key);
      if (!tile?.mask[at.index]) return null;
      const offset = at.index * 4;
      return [
        tile.values[offset],
        tile.values[offset + 1],
        tile.values[offset + 2],
        tile.values[offset + 3],
      ];
    };
    const sessionId = this.document.sessionId;
    let overview = base.overview;
    let working = false;
    let applied = 0;
    let prepared: ((x: number, y: number) => LandscapeWeights) | null = null;
    const fine = patches.filter(
      (patch) => parseLandscapeTileKey(patch.key).level < cutoff,
    );
    const frame: LandscapeFrame = {
      buffers,
      *prepare() {
        if (prepared) return prepared;
        if (fine.length && !working) {
          const at = parseLandscapeOverviewKey(key);
          overview = overview
            ? cloneLandscapeOverviewTile(overview)
            : createLandscapeOverviewTile(at.power, at.tileX, at.tileY);
          working = true;
          addOverview(overview);
        }
        while (applied < fine.length) {
          applyLandscapeOverviewPatch(overview!, fine[applied], lookup);
          applied++;
          yield;
        }
        prepared = prepareLandscapePresentation({
          sessionId,
          sequence: base.sequence,
          bounds: clipBounds(bounds),
          power,
          tiles: sources.filter((tile) => tile.level >= cutoff),
          overviewKeys: [key],
          overviews: overview ? [overview] : [],
        });
        return prepared;
      },
    };
    this.frames.set(key, frame);
    if (this.frames.size > 96)
      this.frames.delete(this.frames.keys().next().value!);
    return frame;
  }

  retainedBuffers(): Set<ArrayBufferLike> {
    const buffers = new Set<ArrayBufferLike>();
    for (const base of this.bases.values())
      if (base.overview) {
        buffers.add(base.overview.own.buffer);
        buffers.add(base.overview.rest.buffer);
        buffers.add(base.overview.sourceLevels.buffer);
      }
    for (const patches of this.pending.values())
      for (const patch of patches)
        for (const tile of [patch.before, patch.after])
          if (tile) {
            buffers.add(tile.mask.buffer);
            buffers.add(tile.values.buffer);
          }
    for (const frame of this.frames.values())
      for (const buffer of frame.buffers) buffers.add(buffer);
    return buffers;
  }
}
