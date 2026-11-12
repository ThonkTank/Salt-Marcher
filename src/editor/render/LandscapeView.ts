import {
  applyLandscapeOverviewPatch,
  cloneLandscapeOverviewTile,
  createLandscapeOverviewTile,
  landscapeOverviewBounds,
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
  landscapeTileBounds,
  parseLandscapeTileKey,
  WORLD_LIMIT,
  type Bounds,
  type EditorDocument,
  type LandscapePatch,
  type LandscapeTile,
  type LandscapeWeights,
} from "../model";

const SIZE = 128;
const WHOLE: Bounds = [0, 0, SIZE, SIZE];
const MAX_BASES = 256;

/** Immutable inputs captured with the same revision as the terrain packet. */
export interface LandscapeFrame {
  readonly key: string;
  readonly version: number;
  /** Incremental texture work is valid only against this exact earlier frame. */
  readonly previousVersion: number | null;
  /** Half-open texture-pixel bounds changed since previousVersion. */
  readonly dirty: Bounds;
  readonly buffers: Set<ArrayBufferLike>;
  prepare(): Generator<void, (x: number, y: number) => LandscapeWeights, void>;
}

interface Base {
  key: string;
  bounds: Bounds;
  power: number;
  /** The store boundary from which this local presentation was reconstructed. */
  sequence: number;
  overview: LandscapeOverviewTile | null;
  valid: boolean;
  dirty: Bounds | null;
  previousVersion: number | null;
}

function pixels(bounds: Bounds, base: Base): Bounds {
  const step = 2 ** base.power;
  const end = (value: number, origin: number) =>
    value === WORLD_LIMIT
      ? Math.floor((value - origin) / step - 0.5) + 1
      : Math.ceil((value - origin) / step - 0.5);
  // Samples live at texel centres. An author cell is a half-open world area.
  return [
    Math.max(0, Math.ceil((bounds[0] - base.bounds[0]) / step - 0.5)),
    Math.max(0, Math.ceil((bounds[1] - base.bounds[1]) / step - 0.5)),
    Math.min(SIZE, end(bounds[2], base.bounds[0])),
    Math.min(SIZE, end(bounds[3], base.bounds[1])),
  ];
}

function merged(a: Bounds, b: Bounds): Bounds {
  return [
    Math.min(a[0], b[0]),
    Math.min(a[1], b[1]),
    Math.max(a[2], b[2]),
    Math.max(a[3], b[3]),
  ];
}

/**
 * Bounded, current presentation cache. Local patches promote the cached fine
 * ownership immediately; an ACK changes durability, not these known pixels.
 * Author tiles remain owned by EditorDocument and are borrowed immutably.
 */
export class LandscapeView {
  private bases = new Map<string, Base>();
  private frames = new Map<string, LandscapeFrame>();
  private requiredSequence = 0;
  private nextVersion = 1;
  private untouched: boolean;

  constructor(
    private document: EditorDocument,
    private initiallyEmpty: boolean,
  ) {
    this.untouched = initiallyEmpty;
  }

  get empty(): boolean {
    return this.untouched;
  }

  private createBase(
    key: string,
    sequence: number,
    overview: LandscapeOverviewTile | null,
  ): Base {
    const at = parseLandscapeOverviewKey(key);
    return {
      key,
      bounds: landscapeOverviewBounds(at),
      power: at.power,
      sequence,
      overview,
      valid: true,
      dirty: [...WHOLE],
      previousVersion: null,
    };
  }

  /** Only cold/new bases need the document journal; the interactive path does not. */
  private reconstruct(base: Base): boolean {
    if (base.sequence < this.document.persistedSequence) return false;
    return this.project(
      base,
      this.document.landscapePatchesAfter(
        base.sequence,
        clipBounds(base.bounds),
      ),
    );
  }

  private base(key: string): Base | undefined {
    let base = this.bases.get(key);
    if (
      !base &&
      this.initiallyEmpty &&
      (this.requiredSequence === 0 ||
        this.document.persistedSequence < this.requiredSequence)
    ) {
      base = this.createBase(key, this.document.persistedSequence, null);
      base.valid = this.reconstruct(base);
      this.bases.set(key, base);
      if (this.bases.size > MAX_BASES) {
        const oldest = this.bases.keys().next().value!;
        this.bases.delete(oldest);
        this.frames.delete(oldest);
      }
    }
    return base;
  }

  /** A cache copy is published only after every needed fallback is known. */
  private project(base: Base, patches: readonly LandscapePatch[]): boolean {
    const cutoff = minimumCoarseLandscapeLevel(base.power);
    const fine = patches.filter(
      (patch) =>
        parseLandscapeTileKey(patch.key).level < cutoff &&
        intersectsBounds(
          landscapeTileBounds(parseLandscapeTileKey(patch.key)),
          base.bounds,
        ),
    );
    if (!fine.length) return true;
    const at = parseLandscapeOverviewKey(base.key);
    const next = base.overview
      ? cloneLandscapeOverviewTile(base.overview)
      : createLandscapeOverviewTile(at.power, at.tileX, at.tileY);
    try {
      for (const patch of fine)
        applyLandscapeOverviewPatch(next, patch, (level, x, y) =>
          this.document.readLandscapeCell(level, x, y),
        );
    } catch (error) {
      // Undo may reveal a fine owner outside the resident author set. A fresh
      // store overview supplies it; never substitute empty/inherited pixels.
      if (
        error instanceof Error &&
        error.message.includes("Landschaftsvererbung")
      )
        return false;
      throw error;
    }
    base.overview = next;
    return true;
  }

  private invalidate(base: Base, bounds: Bounds): void {
    const dirty = pixels(bounds, base);
    if (dirty[0] >= dirty[2] || dirty[1] >= dirty[3]) return;
    const previous = this.frames.get(base.key);
    if (previous) base.previousVersion = previous.version;
    base.dirty = base.dirty ? merged(base.dirty, dirty) : dirty;
    this.frames.delete(base.key);
  }

  changed(
    bounds: Bounds,
    sequence?: number,
    patches?: readonly LandscapePatch[],
  ): readonly Bounds[] {
    this.untouched = false;
    if (sequence !== undefined)
      this.requiredSequence = Math.max(this.requiredSequence, sequence);
    // Finishing an already materialized stroke changes no pixels.
    if (patches?.length === 0) return [];
    for (const base of this.bases.values()) {
      if (!intersectsBounds(base.bounds, bounds)) continue;
      if (base.valid) {
        if (patches) base.valid = this.project(base, patches);
        else {
          // A caller without a delta cannot safely replay a stroke against a
          // baseline which already contains some of that stroke's edits.
          base.valid = false;
        }
      }
      this.invalidate(base, bounds);
    }
    return [bounds];
  }

  accept(read: LandscapePresentationRead): readonly Bounds[] {
    if (read.sessionId !== this.document.sessionId)
      throw new Error(
        "Landschaftsdarstellung gehört zu einer anderen Sitzung.",
      );
    if (
      !Number.isSafeInteger(read.sequence) ||
      read.sequence < 0 ||
      read.sequence > this.document.sequence
    )
      throw new Error("Ungültige Lesesequenz der Landschaftsdarstellung.");
    // A late read cannot replace a local projection after its source patches
    // have been acknowledged and released from the document journal.
    if (read.sequence < this.document.persistedSequence) return [];
    const wanted = new Set(read.overviewKeys);
    if (wanted.size > MAX_BASES)
      throw new Error("Zu viele gehaltene Landschaftsübersichten.");
    if (wanted.size !== read.overviewKeys.length)
      throw new Error("Doppelte Landschaftsübersichtsbestätigung.");
    const incoming = new Map<string, LandscapeOverviewTile>();
    for (const key of read.overviewKeys)
      if (parseLandscapeOverviewKey(key).power !== read.power)
        throw new Error("Unpassende Landschaftsdarstellungsstufe.");
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
    const changed: Bounds[] = [];
    for (const key of read.overviewKeys) {
      // Every author mutation was already projected through changed(). An
      // equivalent durable read must not evict this current local snapshot.
      if (this.bases.get(key)?.valid) continue;
      const base = this.createBase(
        key,
        read.sequence,
        incoming.get(key) ?? null,
      );
      base.valid = this.reconstruct(base);
      this.bases.set(key, base);
      this.frames.delete(key);
      changed.push(clipBounds(base.bounds));
    }
    // Only the current view and its fixed halo are retained.
    for (const key of this.bases.keys())
      if (!wanted.has(key)) {
        this.bases.delete(key);
        this.frames.delete(key);
      }
    return changed;
  }

  private inputs(bounds: Bounds, power: number) {
    const clipped = clipBounds(bounds);
    const cutoff = minimumCoarseLandscapeLevel(power);
    if (!this.document.isLandscapeReady(clipped, cutoff)) return null;
    const span = SIZE * 2 ** power;
    const key = landscapeOverviewKey(
      power,
      Math.floor(bounds[0] / span),
      Math.floor(bounds[1] / span),
    );
    const base = this.base(key);
    if (!base?.valid) return null;
    return {
      key,
      base,
      cutoff,
    };
  }

  ready(bounds: Bounds, power: number): boolean {
    if (this.untouched) return true;
    return landscapeOverviewKeys(clipBounds(bounds), power).every((key) => {
      const area = landscapeOverviewBounds(parseLandscapeOverviewKey(key));
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
    const { key, base, cutoff } = input;
    const cached = this.frames.get(key);
    if (cached) return cached;
    const sources = this.document.landscapeSources(clipBounds(bounds), cutoff);
    if (!base.overview && !sources.length) return null;
    const buffers = new Set<ArrayBufferLike>();
    const addSource = (tile: LandscapeTile) => {
      buffers.add(tile.mask.buffer);
      buffers.add(tile.values.buffer);
    };
    sources.forEach(addSource);
    const overview = base.overview;
    if (overview) {
      buffers.add(overview.own.buffer);
      buffers.add(overview.rest.buffer);
      buffers.add(overview.sourceLevels.buffer);
    }
    const sessionId = this.document.sessionId;
    let prepared: ((x: number, y: number) => LandscapeWeights) | null = null;
    const frame: LandscapeFrame = {
      key,
      version: this.nextVersion++,
      previousVersion: base.previousVersion,
      dirty: base.dirty ? [...base.dirty] : [...WHOLE],
      buffers,
      *prepare() {
        if (prepared) return prepared;
        prepared = prepareLandscapePresentation({
          sessionId,
          sequence: base.sequence,
          bounds: clipBounds(bounds),
          power,
          tiles: [...sources],
          overviewKeys: [key],
          overviews: overview ? [overview] : [],
        });
        return prepared;
      },
    };
    base.dirty = null;
    base.previousVersion = null;
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
    for (const frame of this.frames.values())
      for (const buffer of frame.buffers) buffers.add(buffer);
    return buffers;
  }
}
