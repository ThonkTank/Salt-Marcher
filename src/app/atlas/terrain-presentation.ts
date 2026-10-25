import {
  applyTerrainFrame,
  type TerrainFullFrame,
  type TerrainFrameIdentity,
  type TerrainFrame,
  type TerrainIdentity,
} from './terrain-frame';
export type {
  TerrainFrame,
  TerrainIdentity,
  TerrainInvalidation,
  TerrainFullFrame,
  TerrainFrameIdentity,
} from './terrain-frame';
import type { AtlasRegionQuery, AtlasRegionSource } from './atlas-region-contracts';
import type { TerrainProjectionRequest } from './terrain-projection';

export type TerrainFrameQuery =
  | { kind: 'top'; query: AtlasRegionQuery; detail?: import('./atlas-landscape').LandscapeBox }
  | { kind: 'tilted'; query: TerrainProjectionRequest };
export interface TerrainFrameRequest {
  source: TerrainIdentity;
  frame: TerrainFrameQuery;
  base?: TerrainFrameIdentity;
  refinement?: boolean;
}
/** A coherent first colour pass. Heights, view coverage and author sampling stay
 * unchanged; only the disposable colour raster is refined in the second pass. */
export function interactiveTerrainFrame(frame: TerrainFrameQuery): TerrainFrameQuery {
  if (frame.kind !== 'tilted') return frame;
  return {
    ...frame,
    query: {
      ...frame.query,
      width: Math.min(64, frame.query.width),
      height: Math.min(64, frame.query.height),
      ...(frame.query.detail
        ? { detailResolution: Math.min(64, frame.query.detailResolution ?? 256) }
        : {}),
    },
  };
}
/** Valid only after the worker has pinned and checked the requested revision.
 * Receipt-only/no-op writes can change the connection fence without changing
 * terrain. The journal distinguishes those from unversioned source changes.
 */
export function terrainSnapshotStillValid(source: AtlasRegionSource, current: AtlasRegionSource) {
  return (
    current.filename === source.filename &&
    current.token === source.token &&
    current.campaignId === source.campaignId &&
    current.epoch === source.epoch &&
    JSON.stringify(current.shadow) === JSON.stringify(source.shadow) &&
    (current.revision > source.revision ||
      (current.revision === source.revision && current.sequence === source.sequence))
  );
}
/** Independent display lane: one full-height read and one latest confirmed successor.
 * Disposable fine colour may finish independently; the service preempts it.
 * An older completed snapshot can be shown while newer writes continue.
 * It is never relabelled with the requested revision.
 */
export class TerrainPresentation {
  private wanted: TerrainIdentity | null = null;
  private running: Promise<void> | null = null;
  private stopped = false;
  private finishing = false;
  private requested = -1;
  private shown = -1;
  private frame: TerrainFullFrame | undefined;
  constructor(
    private read: (
      identity: TerrainIdentity,
      base?: TerrainFrameIdentity,
      refinement?: boolean,
    ) => Promise<TerrainFrame>,
    private present: (frame: TerrainFullFrame, refined?: boolean) => void,
    private failed: (error: unknown) => void,
    private refine = false,
  ) {}
  update(identity: TerrainIdentity) {
    if (this.stopped) return;
    this.requested = Math.max(this.requested, identity.revision);
    this.wanted = identity;
    this.start();
  }
  private start() {
    if (!this.running && !this.stopped)
      this.running = this.pump().finally(() => {
        this.running = null;
        if (this.wanted) this.start();
      });
  }
  private async pump() {
    while (this.wanted && !this.stopped) {
      const source = this.wanted,
        base = this.frame;
      this.wanted = null;
      try {
        const frame = await this.read(source, base?.target);
        const accepted =
          !this.stopped &&
          frame.target.revision >= source.revision &&
          frame.target.revision > this.shown;
        if (accepted) {
          // A fine reply can arrive during this read. Apply deltas to the exact
          // base we requested, not to the subsequently refined display frame.
          this.frame = applyTerrainFrame(base, frame);
          this.present(this.frame, !this.refine);
          this.shown = frame.target.revision;
        }
        const successor = this.wanted as TerrainIdentity | null; // update() may run while read() is awaited.
        if (successor && successor.revision <= this.shown) this.wanted = null;
        // Fine colour must not hold up a newer confirmed frame or gesture
        // completion. The service preempts this low-priority read for either.
        if (
          accepted &&
          this.refine &&
          !this.finishing &&
          !this.stopped &&
          !this.wanted &&
          this.frame
        )
          void this.refineFrame(this.frame);
      } catch (error) {
        // A write can win the race before a worker opens its snapshot. A newer
        // confirmed successor retries that read; author commands are never retried.
        if (!this.stopped && !(this.wanted && String(error).includes('inzwischen geändert')))
          this.failed(error);
      }
    }
  }
  private async refineFrame(base: TerrainFullFrame) {
    try {
      const detail = await this.read(base.target, undefined, true);
      if (
        !this.stopped &&
        this.frame === base &&
        detail.target.revision >= this.requested &&
        detail.target.revision >= this.shown
      ) {
        this.frame = applyTerrainFrame(undefined, detail);
        this.present(this.frame, true);
        this.shown = detail.target.revision;
        if (this.wanted && this.wanted.revision <= this.shown) this.wanted = null;
      }
    } catch (error) {
      if (
        !this.stopped &&
        this.frame === base &&
        base.target.revision >= this.requested &&
        !/inzwischen geändert|neuere Anfrage/.test(String(error))
      )
        this.failed(error);
    }
  }
  /** Writers have finished. Present their final full heights before releasing
   * the gesture; disposable fine colour never holds author tools closed. */
  async finish() {
    this.finishing = true;
    while (this.running) await this.running;
    this.stop();
  }
  stop() {
    this.stopped = true;
    this.wanted = null;
    this.frame = undefined;
  }
}
