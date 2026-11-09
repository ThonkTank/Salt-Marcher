import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Graphics } from "pixi.js";
import { EditorController } from "../EditorController";
import { editorBudgets } from "../budgets";
import { MAX_BRUSH_POINTS } from "../brush";
import { evaluateBrushTime } from "../../../scripts/atlas-p0-evaluate.mjs";
import type {
  AtlasDesktop,
  CommitRequest,
  ProjectInfo,
  ReadPresentationRequest,
  ReadRegionRequest,
  RegionRead,
} from "../bridge";
import {
  EditorDocument,
  HEIGHT_TILE_BYTES,
  SourcesNotReadyError,
  createCoastFixture,
  heightTilesFromControls,
  prepareHeightSampler,
  projectHeightOverviewPatches,
  heightOverviewKeys,
  heightOverviewKey,
  heightOverviewBounds,
  HEIGHT_SUM_SCALE,
  heightFromScaledSum,
  heightTileSupport,
  intersectsBounds,
  minimumCoarseHeightLevel,
  type Bounds,
  type HeightPatch,
  type HeightOverviewTile,
  type HeightTile,
} from "../model";
import { Observation } from "../observation";
import { WorldRenderer } from "./WorldRenderer";
import {
  HEIGHT_DESCRIPTOR_HEIGHT,
  HEIGHT_DESCRIPTOR_WIDTH,
} from "./height-field-data";

interface NumericFieldMirror {
  sources: Map<string, HeightTile>;
  overviews: Map<string, HeightOverviewTile>;
  uploads: number;
  updates: number;
  draws: number;
  restores: number;
  drawDirty(): number;
  flush(maxBytes?: number): number;
  rebuildAfterContextRestore(): void;
}
const fields = vi.hoisted(() => [] as NumericFieldMirror[]);

// Only the GL resource boundary is mocked. The real controller, source projection,
// local-ready gate, fault handling, frame submission and observation stay active.
// Numeric/shader equivalence is tested separately against actual GPU rendering.
vi.mock("./HeightField", () => ({
  HeightField: class {
    sources = new Map<string, HeightTile>();
    atlas = { sources: this.sources };
    overviews = new Map<string, HeightOverviewTile>();
    uploads = 0;
    updates = 0;
    draws = 0;
    restores = 0;
    lastFlushHadWork = false;
    numericSupported = true;
    private changedBytes = 0;
    toolLevel = 0;
    private tiles = new Set<{
      bytes: number;
      dirty: boolean;
      pixels: number;
      needsPreparation: boolean;
      bounds: Bounds;
      power: number;
      preparationVersion: number;
      preparedVersion: number;
      handle: unknown;
    }>();
    constructor() {
      fields.push(this);
    }
    init() {}
    retainedSourceBuffers() {
      return [];
    }
    setToolLevel(level: number) {
      if (this.toolLevel === level) return false;
      this.toolLevel = level;
      for (const tile of this.tiles) {
        tile.needsPreparation = true;
        tile.preparationVersion++;
        tile.dirty = true;
      }
      return true;
    }
    rebuildAfterContextRestore() {
      this.restores++;
      this.changedBytes = [...this.sources.values()].reduce(
        (bytes, tile) => bytes + tile.values.byteLength,
        0,
      );
      for (const tile of this.tiles) {
        tile.bytes = 128 * 128 * 8;
        tile.dirty = true;
        tile.preparationVersion++;
      }
    }
    drawDirty() {
      this.draws++;
      return 128 * 128;
    }
    updateSources(
      tiles: readonly HeightTile[],
      removed: readonly string[] = [],
      local = false,
    ) {
      const changed: Bounds[] = [];
      const changedSources: HeightTile[] = [];
      for (const key of removed) {
        const before = this.sources.get(key);
        if (before) {
          changed.push(heightTileSupport(before));
          changedSources.push(before);
        }
        this.sources.delete(key);
      }
      for (const tile of tiles) {
        const before = this.sources.get(tile.key);
        if (
          before &&
          before.values.every((value, i) => value === tile.values[i])
        )
          continue;
        this.sources.set(tile.key, { ...tile, values: tile.values.slice() });
        this.changedBytes += tile.values.byteLength;
        changed.push(heightTileSupport(tile));
        changedSources.push(tile);
      }
      if (!local)
        for (const tile of this.tiles) {
          if (
            changedSources.some(
              (source) =>
                (source.level >= minimumCoarseHeightLevel(tile.power) ||
                  source.level === this.toolLevel) &&
                intersectsBounds(heightTileSupport(source), tile.bounds),
            )
          ) {
            tile.preparationVersion++;
            tile.needsPreparation = true;
            tile.dirty = true;
          }
        }
      return changed;
    }
    readSource(key: string) {
      return this.sources.get(key);
    }
    applySourcePatches(patches: readonly HeightPatch[]) {
      return this.updateSources(
        patches.flatMap((patch) => (patch.after ? [patch.after] : [])),
        patches.filter((patch) => !patch.after).map((patch) => patch.key),
        true,
      );
    }
    createTile(bounds: Bounds, power: number, overview?: HeightOverviewTile) {
      const state = {
        bytes: 0,
        dirty: true,
        pixels: 128 * 128,
        needsPreparation: true,
        bounds,
        power,
        preparationVersion: 0,
        preparedVersion: -1,
        handle: null as unknown,
      };
      this.tiles.add(state);
      const span = 128 * 2 ** power;
      const key = heightOverviewKey(power, bounds[0] / span, bounds[1] / span);
      const prepare = (
        next?: HeightOverviewTile | null,
        rect?: [number, number, number, number],
      ) => {
        state.pixels = rect
          ? (rect[2] - rect[0]) * (rect[3] - rect[1])
          : 128 * 128;
        this.updates++;
        state.needsPreparation = false;
        if (next)
          this.overviews.set(key, { ...next, values: next.values.slice() });
        else if (next === null) this.overviews.delete(key);
        state.bytes +=
          HEIGHT_DESCRIPTOR_WIDTH * HEIGHT_DESCRIPTOR_HEIGHT * 4 * 4;
        if (next !== undefined) state.bytes += 128 * 128 * 8;
        state.dirty = true;
      };
      let nextOverview: HeightOverviewTile | null | undefined =
        overview ?? null;
      let nextRect: [number, number, number, number] | undefined;
      const update = (
        next?: HeightOverviewTile | null,
        rect?: [number, number, number, number],
      ) => {
        nextOverview = next;
        nextRect = rect;
        state.needsPreparation = true;
      };
      const field = this;
      const handle = {
        mesh: { position: { set() {} }, visible: false, destroy() {} },
        update,
        prepareStep() {
          if (!state.needsPreparation) return false;
          prepare(nextOverview, nextRect);
          return true;
        },
        cancelPreparation() {
          state.needsPreparation = true;
          state.dirty = true;
        },
        get nextPreparationBytes() {
          return { cpuBytes: 0, gpuBytes: 0 };
        },
        get needsComposition() {
          return state.dirty;
        },
        get waitingProjection() {
          return false;
        },
        get hasProjectionTask() {
          return false;
        },
        get fallback() {
          return false;
        },
        preparationState() {
          return {
            phase: state.needsPreparation ? "prepare" : "ready",
            preparationVersion: state.preparationVersion,
            preparedVersion: state.preparedVersion,
            compositionDirty: state.dirty,
          };
        },
        invalidateGPU() {
          state.preparationVersion++;
          state.needsPreparation = true;
          state.dirty = true;
        },
        invalidateTotal() {
          state.preparationVersion++;
          state.needsPreparation = true;
          state.dirty = true;
        },
        markHeightChanged() {},
        dependsOnAuthorLevel(level: number) {
          return (
            level >= minimumCoarseHeightLevel(power) ||
            level === field.toolLevel
          );
        },
        get preparationVersion() {
          return state.preparationVersion;
        },
        get preparedVersion() {
          return state.preparedVersion;
        },
        get needsPreparation() {
          return state.needsPreparation;
        },
        get uploadReady() {
          return (
            !state.needsPreparation &&
            state.bytes === 0 &&
            field.changedBytes === 0
          );
        },
        get compositionWork() {
          return state.dirty ? state.pixels : 0;
        },
        get compositionStats() {
          return {
            canonicalSamples: state.pixels,
            deltaSamples: 0,
            colourSamples: state.pixels,
            anchorCopySamples: 0,
            basisCaptureSamples: 0,
            canonicalBasisBuilds: 0,
            horizontalSamples: 0,
            projectionProducts: state.pixels * 20,
          };
        },
        drawDirty: () => {
          if (!state.dirty) return 0;
          this.drawDirty();
          state.dirty = false;
          state.preparedVersion = state.preparationVersion;
          return state.pixels;
        },
        destroy: () => {
          this.tiles.delete(state);
          this.overviews.delete(key);
        },
      };
      state.handle = handle;
      return handle;
    }
    flush(maxBytes = Infinity, selected?: Iterable<unknown>) {
      let bytes = Math.min(this.changedBytes, maxBytes);
      this.changedBytes -= bytes;
      this.uploads++;
      const targets = selected ? new Set(selected) : null;
      for (const tile of this.tiles) {
        if (targets && !targets.has(tile.handle)) continue;
        const count = Math.min(tile.bytes, maxBytes - bytes);
        tile.bytes -= count;
        bytes += count;
      }
      this.lastFlushHadWork = bytes > 0;
      return bytes;
    }
    metrics() {
      const sourceBytes = [...this.sources.values()].reduce(
        (total, tile) => total + tile.values.byteLength,
        0,
      );
      const overviewBytes = [...this.overviews.values()].reduce(
        (total, tile) => total + tile.values.byteLength,
        0,
      );
      return {
        sourceBytes,
        sourceCount: this.sources.size,
        gpuBytes: sourceBytes + overviewBytes,
        cpuBytes: sourceBytes + overviewBytes,
        fallbackTiles: 0,
        fallbackSamples: 0,
        pendingUploadBytes:
          this.changedBytes +
          [...this.tiles].reduce((sum, tile) => sum + tile.bytes, 0),
        pendingCompositionTiles: [...this.tiles].filter((tile) => tile.dirty)
          .length,
      };
    }
    reset() {
      this.sources.clear();
      this.overviews.clear();
      this.changedBytes = 0;
      this.tiles.clear();
    }
    destroy() {
      this.reset();
    }
  },
}));
vi.mock("pixi.js", () => ({
  Container: class {
    addChild() {}
    removeChild() {}
  },
  Graphics: class {
    clear() {
      return this;
    }
    moveTo() {
      return this;
    }
    lineTo() {
      return this;
    }
    circle() {
      return this;
    }
    stroke() {
      return this;
    }
  },
  WebGLRenderer: class {
    canvas: HTMLCanvasElement | undefined;
    gl = {
      SYNC_GPU_COMMANDS_COMPLETE: 0x9117,
      ALREADY_SIGNALED: 0x911a,
      TIMEOUT_EXPIRED: 0x911b,
      CONDITION_SATISFIED: 0x911c,
      WAIT_FAILED: 0x911d,
      fenceSync: vi.fn(() => ({})),
      clientWaitSync: vi.fn(() => 0x911a),
      deleteSync: vi.fn(),
      flush: vi.fn(),
    };
    async init(options: { canvas: HTMLCanvasElement }) {
      this.canvas = options.canvas;
    }
    render() {}
    resize() {}
    destroy() {}
  },
}));
vi.mock("pixi.js/unsafe-eval", () => ({}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  fields.length = 0;
  // Unit scheduling uses a deterministic clock. Tests which examine time spent
  // advance it at the expensive work boundary; wall-clock timing belongs to the
  // real renderer checks, not this mocked GL driver.
  let clock = 1000;
  vi.spyOn(performance, "now").mockImplementation(() => (clock += 0.001));
});

/** Explicit source-publication boundary; it does not draw or acknowledge a GPU. */
function prepareSources(world: WorldRenderer): void {
  if (world["sourcesFrozen"]) return;
  for (let step = 0; step < 256; step++) {
    world.prepareFrame();
    if (!world["queuedSources"].size && !world["queuedOverviews"].size) return;
  }
  throw new Error("Queued numerical source preparation did not finish");
}

it("mirrors coarse Undo/Redo after unrelated fine sources were evicted", () => {
  const broad: Bounds = [-20_000, -20_000, 20_000, 20_000];
  const detail: Bounds = [-3000, -2000, 3000, 2000];
  const distant = heightTilesFromControls(0, [[2000, 0, 25]])[0];
  const document = new EditorDocument("history-source-transfer");
  document.acceptCoverage(broad, [...createCoastFixture(), distant]);
  const original = document.sampleHeight(320, 0);
  document.beginGesture({ level: 8, radius: 12_000, amount: 100 });
  document.applySegment([0, 0], [0, 0], 1000);
  const edit = document.finishGesture()!;
  document.acceptPersistence(edit.sequence);
  const lifted = document.sampleHeight(320, 0);
  expect(lifted).toBeGreaterThan(original);
  expect(
    document.retainSources([{ bounds: detail, minLevel: 0 }]).length,
  ).toBeGreaterThan(0);
  expect(document.sourceState(distant.key)).toBe("unknown");
  const world = new WorldRenderer(new Observation());
  world.reset(document);
  const field = fields.at(-1)!;
  world.updatePresentation(
    document.snapshot(detail).tiles,
    [],
    heightOverviewKeys(detail, world.presentationPower()),
  );
  prepareSources(world);
  const rendered = () =>
    prepareHeightSampler([...field.sources.values()])(320, 0);
  expect(rendered()).toBeCloseTo(lifted, 10);
  const undone = document.undo()!;
  expect(() => document.snapshot(undone.dirtyBounds[0])).toThrow(
    SourcesNotReadyError,
  );
  world.updateSourcePatches(undone.patches);
  prepareSources(world);
  expect(rendered()).toBeCloseTo(original, 10);
  expect(undone.patches.every((patch) => !field.sources.has(patch.key))).toBe(
    true,
  );
  const redone = document.redo()!;
  world.updateSourcePatches(redone.patches);
  prepareSources(world);
  expect(rendered()).toBeCloseTo(lifted, 10);
  expect(document.sampleHeight(320, 0)).toBeCloseTo(lifted, 10);
  expect(
    redone.patches.every(
      (patch) => patch.after?.values.byteLength === HEIGHT_TILE_BYTES,
    ),
  ).toBe(true);
  expect(document.sourceState(distant.key)).toBe("unknown");
  expect(document.isReady(redone.dirtyBounds[0])).toBe(false);
});

async function readyRenderer({
  width = 64,
  height = 64,
  x = 256,
  y = 256,
  scale = 0.25,
  rendered = true,
} = {}) {
  vi.stubGlobal("devicePixelRatio", 1);
  const document = new EditorDocument("render-progress", { empty: true });
  const observation = new Observation(true);
  const world = new WorldRenderer(observation);
  world.width = width;
  world.height = height;
  world.grid = false;
  const canvas = new EventTarget();
  await world.init(canvas as HTMLCanvasElement);
  world.reset(document);
  const field = fields.at(-1)!;
  world.moveCamera({ x, y, scale });
  world.updatePresentation(
    [],
    [],
    heightOverviewKeys(world.sourceBounds(), world.presentationPower()),
  );
  world.refresh();
  const frame = (afterSubmit?: () => void) => {
    world.pollCompletion();
    const submitted = world.renderFrame(performance.now());
    afterSubmit?.();
    world.pollCompletion();
    return submitted;
  };
  if (rendered) {
    for (
      let step = 0;
      step < 100 && world.inspectRegion(world.bounds()).status !== "current";
      step++
    )
      frame();
    expect(world.inspectRegion(world.bounds()).status).toBe("current");
  }
  const change = (
    point: [number, number],
    brush = { level: 0, radius: 20, amount: 400 },
  ) => {
    document.beginGesture(brush);
    const update = document.applySegment(point, point, 1000)!;
    world.updateSourcePatches(update.patches);
    world.invalidate(update.bounds);
    document.finishGesture();
    prepareSources(world);
    return update;
  };
  return { document, observation, world, field, frame, change, canvas };
}

it("requires the actual local draw after numeric data are ready and uploaded", async () => {
  const { world, field, frame } = await readyRenderer({ rendered: false });
  const area: Bounds = [200, 200, 240, 240];
  expect(world.isPresentationReady(area)).toBe(true);
  expect(world.inspectRegion(area).status).toBe("missing");
  field.flush();
  expect(world.inspectRegion(area).status).toBe("missing");
  const render = vi
    .spyOn(world.renderer, "render")
    .mockImplementationOnce(() => {
      expect(field.uploads).toBeGreaterThan(0);
      expect(world.inspectRegion(area).status).toBe("missing");
    });
  const receipt = frame();
  expect(render).toHaveBeenCalledOnce();
  expect(receipt).toMatchObject({
    sessionId: "render-progress",
    frame: world.state().lastSubmittedFrame,
    viewGeneration: world.state().viewGeneration,
  });
  expect(world.inspectRegion(area)).toEqual({
    status: "current",
    sessionId: receipt!.sessionId,
    frame: receipt!.frame,
    viewGeneration: receipt!.viewGeneration,
  });
});

it("waits for GPU completion, keeps submission timestamps, and never queues a second draw", async () => {
  const { world, change, document } = await readyRenderer();
  const update = change([200, 200]);
  const gl = world.renderer.gl;
  const wait = vi
    .spyOn(gl, "clientWaitSync")
    .mockReturnValue(gl.TIMEOUT_EXPIRED);
  const render = vi.spyOn(world.renderer, "render");
  const submission = world.renderFrame(performance.now())!;
  expect(submission.revision).toBe(document.revision);
  expect(world.inspectSubmittedRegion(update.bounds).status).toBe("current");
  expect(world.inspectRegion(update.bounds).status).toBe("stale");
  world.redraw();
  expect(world.renderFrame(performance.now())).toBeNull();
  expect(world.pollCompletion()).toBeNull();
  expect(render).toHaveBeenCalledTimes(1);
  expect(wait).toHaveBeenCalledWith(expect.anything(), 0, 0);
  wait.mockReturnValue(gl.CONDITION_SATISFIED);
  expect(world.pollCompletion()).toEqual(submission);
  expect(world.inspectRegion(update.bounds).status).toBe("current");
  expect(world.state().gpuPending).toBe(false);
  expect(gl.deleteSync).toHaveBeenCalled();
});

it("requires the captured preparation version across L1 to L2 to L1 while an older same-revision fence is pending", async () => {
  const { world, document } = await readyRenderer();
  const area: Bounds = [200, 200, 240, 240];
  const revision = document.revision;
  const gl = world.renderer.gl;
  const wait = vi
    .spyOn(gl, "clientWaitSync")
    .mockReturnValue(gl.TIMEOUT_EXPIRED);
  world.setToolLevel(1);
  const first = world.renderFrame(performance.now())!;
  expect(first.revision).toBe(revision);
  expect(world.inspectRegion(area).status).toBe("stale");
  world.setToolLevel(2);
  world.setToolLevel(1);
  expect(world.renderFrame(performance.now())).toBeNull();
  wait.mockReturnValue(gl.ALREADY_SIGNALED);
  expect(world.pollCompletion()).toBe(first);
  expect(world.inspectRegion(area).status).toBe("stale");
  const last = world.renderFrame(performance.now())!;
  expect(last.frame).toBeGreaterThan(first.frame);
  expect(last.revision).toBe(revision);
  expect(world.inspectRegion(area).status).toBe("stale");
  world.pollCompletion();
  expect(world.inspectRegion(area).status).toBe("current");
});

it("does not let a pending preparation certify an author import at the same document revision", async () => {
  const { world, document } = await readyRenderer();
  const area: Bounds = [200, 200, 240, 240];
  const revision = document.revision;
  world.setToolLevel(1);
  world.renderFrame(performance.now());
  world.updatePresentation(heightTilesFromControls(1, [[20, 20, 100]]), [], []);
  world.pollCompletion();
  expect(document.revision).toBe(revision);
  expect(world.inspectRegion(area).status).toBe("missing");
  prepareSources(world);
  expect(world.inspectRegion(area).status).toBe("stale");
  world.renderFrame(performance.now());
  world.pollCompletion();
  expect(world.inspectRegion(area).status).toBe("current");
});

it("reprepares a budget-queued tile when a tool change releases its source bindings", async () => {
  const { world, frame } = await readyRenderer({
    width: 256,
    height: 128,
    x: 512,
    y: 256,
    rendered: false,
  });
  world.cursor = { x: 64, y: 64, radius: 1 };
  for (const tile of world["tiles"].values())
    vi.spyOn(tile.field, "compositionWork", "get").mockReturnValue(
      editorBudgets.compositionWorkPerFrame,
    );
  const queued = world["tiles"].get("2:1:0")!;
  const prepare = vi.spyOn(queued.field, "update");
  prepareSources(world);
  world.freezeRender(world.bounds());
  frame();
  expect(queued.dirty).not.toBeNull();
  expect(queued.preparedRevision).toBe(queued.revision);
  expect(prepare).toHaveBeenCalledTimes(1);
  const previousRevision = queued.revision;
  world.setToolLevel(1);
  expect(queued.revision).toBe(previousRevision);
  expect(queued.preparedRevision).toBe(-1);
  expect(queued.field.needsPreparation).toBe(true);
  for (let index = 0; index < 20 && prepare.mock.calls.length < 2; index++)
    frame();
  expect(prepare).toHaveBeenCalledTimes(2);
  expect(queued.field.needsPreparation).toBe(false);
  for (let index = 0; index < 10 && queued.dirty; index++) frame();
  expect(queued.dirty).toBeNull();
  expect(queued.completedRevision).toBe(previousRevision);
});

it("invalidates failed GPU fences and redraws from retained document data", async () => {
  const { world, change, document, frame } = await readyRenderer();
  const update = change([200, 200]);
  const height = document.sampleHeight(200, 200);
  world.renderFrame(performance.now());
  vi.spyOn(world.renderer.gl, "clientWaitSync").mockReturnValueOnce(
    world.renderer.gl.WAIT_FAILED,
  );
  expect(() => world.pollCompletion()).toThrow("Grafikabschluss");
  expect(world.inspectRegion(update.bounds).status).toBe("missing");
  expect(world.state().gpuPending).toBe(true);
  const upload = vi.spyOn(fields.at(-1)!, "flush");
  const draw = vi.spyOn(world.renderer, "render");
  expect(world.renderFrame(performance.now())).toBeNull();
  expect(upload).not.toHaveBeenCalled();
  expect(draw).not.toHaveBeenCalled();
  frame();
  expect(world.inspectRegion(update.bounds).status).toBe("current");
  expect(document.sampleHeight(200, 200)).toBe(height);
});

it("keeps identical reads current and does not recompose unrelated overview changes", async () => {
  const { world, field, frame } = await readyRenderer();
  const area: Bounds = [200, 200, 240, 240];
  const updates = field.updates;
  const draws = field.draws;
  const sources = [...field.sources.values()];
  world.updatePresentation(
    sources,
    [],
    heightOverviewKeys(world.sourceBounds(), world.presentationPower()),
  );
  expect(world.inspectRegion(area).status).toBe("current");
  frame();
  expect(field.updates).toBe(updates);
  expect(field.draws).toBe(draws);
  const overview: HeightOverviewTile = {
    key: heightOverviewKey(2, 100, 100),
    power: 2,
    tileX: 100,
    tileY: 100,
    values: new Float64Array(128 * 128).fill(1),
  };
  world.updatePresentation([], [overview], [overview.key]);
  expect(world.inspectRegion(area).status).toBe("current");
  frame();
  expect(field.updates).toBe(updates);
  expect(field.draws).toBe(draws);
});

it.each(["upload", "compose", "draw"] as const)(
  "never certifies a %s failure and recovers without losing the edit",
  async (failure) => {
    const { world, field, frame, change, document } = await readyRenderer();
    const update = change([200, 200]);
    const previous = world.state().lastSubmittedFrame;
    const error = new Error(`${failure} failed`);
    if (failure === "upload")
      vi.spyOn(field, "flush").mockImplementationOnce(() => {
        throw error;
      });
    else if (failure === "compose")
      vi.spyOn(field, "drawDirty").mockImplementationOnce(() => {
        throw error;
      });
    else
      vi.spyOn(world.renderer, "render").mockImplementationOnce(() => {
        throw error;
      });
    expect(frame).toThrow(error);
    expect(world.inspectRegion(update.bounds).status).not.toBe("current");
    expect(world.state().lastSubmittedFrame).toBe(previous);
    expect(world.state().submittedRevision).toBe(0);
    frame();
    expect(world.inspectRegion(update.bounds).status).toBe("current");
    expect(world.state().submittedRevision).toBe(document.revision);
  },
);

it("keeps partial numeric uploads visibly incomplete and resumes without rebuilding their data", async () => {
  const { world, field, frame } = await readyRenderer({ rendered: false });
  const flush = field.flush.bind(field);
  // Force the resource boundary to deliver one bounded part. Lazy preparation
  // no longer assumes the whole viewport was eagerly encoded before frame one.
  const partialBytes =
    (HEIGHT_DESCRIPTOR_WIDTH * HEIGHT_DESCRIPTOR_HEIGHT * 16) / 2;
  vi.spyOn(field, "flush").mockImplementation(() => flush(partialBytes));
  const first = frame()!;
  expect(first.uploadedBytes).toBeLessThanOrEqual(
    editorBudgets.uploadBytesPerFrame,
  );
  expect(world.state().pendingUploadBytes).toBeGreaterThan(0);
  expect(field.draws).toBe(0);
  expect(first.exactRevision).toBe(-1);
  expect(world.inspectRegion(world.bounds()).status).toBe("missing");
  const updates = field.updates;
  for (
    let step = 0;
    step < 100 &&
    (world.state().pendingUploadBytes > 0 || world.state().queuedTiles > 0);
    step++
  ) {
    const receipt = frame()!;
    expect(receipt.uploadedBytes).toBeLessThanOrEqual(
      editorBudgets.uploadBytesPerFrame,
    );
    expect(field.updates).toBe(updates);
    if (world.state().pendingUploadBytes > 0)
      expect(world.inspectRegion(world.bounds()).status).not.toBe("current");
  }
  expect(world.state().pendingUploadBytes).toBe(0);
  expect(field.draws).toBeGreaterThan(0);
  expect(world.inspectRegion(world.bounds()).status).toBe("current");
});

it("reuses composed terrain for overlay redraws and camera moves inside retained tiles", async () => {
  const { world, field, frame } = await readyRenderer();
  const draws = field.draws;
  world.redraw();
  frame();
  expect(field.draws).toBe(draws);
  world.moveCamera({ ...world.camera, x: world.camera.x + 4 });
  world.refresh();
  frame();
  expect(field.draws).toBe(draws);
  expect(world.inspectRegion(world.bounds()).status).toBe("current");
});

it("invalidates lost GPU submissions and requires bounded uploads plus a new draw after restoration", async () => {
  const { world, field, frame, canvas, change, document } = await readyRenderer(
    {
      width: 1180,
      height: 894,
    },
  );
  const update = change([200, 200]);
  frame();
  const previous = world.inspectRegion(update.bounds);
  expect(previous.status).toBe("current");
  const height = document.sampleHeight(200, 200);
  const revision = document.revision;
  const sourceCopies = [...field.sources.values()].map((tile) => ({
    key: tile.key,
    values: tile.values.slice(),
  }));
  const render = vi.spyOn(world.renderer, "render");
  const uploaded = field.uploads;
  const composed = field.draws;
  const lost = new Event("webglcontextlost", { cancelable: true });
  canvas.dispatchEvent(lost);
  expect(lost.defaultPrevented).toBe(true);
  expect(world.inspectRegion(update.bounds).status).toBe("missing");
  expect(world.state()).toMatchObject({
    contextLost: true,
    submittedRevision: -1,
    lastSubmittedFrame: 0,
  });
  world.redraw();
  expect(frame()).toBeNull();
  expect(render).not.toHaveBeenCalled();
  expect(field.uploads).toBe(uploaded);
  canvas.dispatchEvent(new Event("webglcontextrestored"));
  expect(field.restores).toBe(1);
  expect(world.inspectRegion(update.bounds).status).toBe("missing");
  expect(world.state().contextLost).toBe(false);
  const partial = frame()!;
  expect(partial.uploadedBytes).toBeLessThanOrEqual(
    editorBudgets.uploadBytesPerFrame,
  );
  expect(partial.exactRevision).toBe(-1);
  expect(field.draws).toBeGreaterThan(composed);
  expect(world.inspectRegion(world.bounds()).status).toBe("missing");
  for (
    let step = 0;
    step < 20 &&
    (world.state().pendingUploadBytes || world.state().queuedTiles);
    step++
  ) {
    const receipt = frame()!;
    expect(receipt.uploadedBytes).toBeLessThanOrEqual(
      editorBudgets.uploadBytesPerFrame,
    );
    if (world.state().pendingUploadBytes)
      expect(world.inspectRegion(world.bounds()).status).not.toBe("current");
  }
  expect(world.inspectRegion(update.bounds).status).toBe("current");
  expect(world.inspectRegion(update.bounds).frame).toBeGreaterThan(
    previous.frame,
  );
  expect(field.draws).toBeGreaterThan(composed);
  expect(document.revision).toBe(revision);
  expect(document.sampleHeight(200, 200)).toBe(height);
  for (const source of sourceCopies)
    expect(
      field.sources
        .get(source.key)!
        .values.every((value, index) => value === source.values[index]),
    ).toBe(true);
  world.destroy();
  const afterDestroy = new Event("webglcontextlost", { cancelable: true });
  canvas.dispatchEvent(afterDestroy);
  canvas.dispatchEvent(new Event("webglcontextrestored"));
  expect(afterDestroy.defaultPrevented).toBe(false);
  expect(field.restores).toBe(1);
});

it("requires a new submitted view after camera changes, resize and session replacement", async () => {
  const { world, frame } = await readyRenderer();
  const area: Bounds = [200, 200, 240, 240];
  const first = world.inspectRegion(area);
  world.moveCamera({ ...world.camera, x: world.camera.x + 4 });
  world.refresh();
  expect(world.inspectRegion(area)).toMatchObject({
    status: "missing",
    frame: first.frame,
  });
  frame();
  expect(world.inspectRegion(area).status).toBe("current");
  expect(world.inspectRegion(area).frame).toBeGreaterThan(first.frame);
  world.resize(68, 68);
  world.refresh();
  expect(world.inspectRegion(area).status).toBe("missing");
  frame();
  expect(world.inspectRegion(area).status).toBe("current");
  world.reset(new EditorDocument("replacement", { empty: true }));
  expect(world.inspectRegion(area)).toMatchObject({
    status: "missing",
    sessionId: "replacement",
    frame: 0,
  });
});

it("marks a still-unprepared view as loading even without a pointer or terrain tiles", async () => {
  const { world, frame } = await readyRenderer();
  const lines = vi.spyOn(Graphics.prototype, "lineTo");
  const camera = { ...world.camera };
  world.moveCamera({ ...camera, x: 50_000 });
  frame();
  expect(world.cursor).toBeNull();
  expect(lines).toHaveBeenCalled();
  lines.mockClear();
  world.moveCamera(camera);
  world.refresh();
  frame();
  expect(lines).not.toHaveBeenCalled();
});

it("preserves a readiness overlay redraw requested after an actual submit", async () => {
  const { world, frame } = await readyRenderer();
  const render = vi.spyOn(world.renderer, "render");
  world.redraw();
  expect(frame(() => world.redraw())).not.toBeNull();
  expect(render).toHaveBeenCalledTimes(1);
  frame();
  expect(render).toHaveBeenCalledTimes(2);
  frame();
  expect(render).toHaveBeenCalledTimes(2);
});

it("refreshes retained numeric tiles when a presentation read replaces sources or certifies an empty overview", async () => {
  const { world, field, frame } = await readyRenderer();
  const key = heightOverviewKey(2, 0, 0);
  const overview: HeightOverviewTile = {
    key,
    power: 2,
    tileX: 0,
    tileY: 0,
    values: new Float64Array(128 * 128).fill(2),
  };
  world.updatePresentation([], [overview], [key]);
  expect(world.inspectRegion([200, 200, 240, 240]).status).not.toBe("current");
  prepareSources(world);
  frame();
  expect(field.overviews.get(key)?.values[0]).toBe(2);
  expect(world.inspectRegion([200, 200, 240, 240]).status).toBe("current");
  world.updatePresentation([], [], [key]);
  expect(world.inspectRegion([200, 200, 240, 240]).status).not.toBe("current");
  prepareSources(world);
  frame();
  expect(field.overviews.has(key)).toBe(false);
  expect(world.inspectRegion([200, 200, 240, 240]).status).toBe("current");
});

it("keeps a drawn foundation stale until the new numeric terrain is actually drawn", async () => {
  const { world, field, frame, change } = await readyRenderer();
  const update = change([200, 200]);
  expect(world.inspectRegion(update.bounds).status).toBe("stale");
  field.flush();
  expect(world.inspectRegion(update.bounds).status).toBe("stale");
  frame();
  expect(world.inspectRegion(update.bounds).status).toBe("current");
});

it("checks the entire visible sweep without requiring unrelated unavailable tiles", async () => {
  const { world, frame, change, document } = await readyRenderer({
    width: 320,
    x: 768,
    rendered: false,
  });
  const left: Bounds = [240, 240, 272, 272];
  const right: Bounds = [1264, 240, 1296, 272];
  world.reset(document);
  world.refresh();
  world.updatePresentation(
    [],
    [],
    [heightOverviewKey(2, 0, 0), heightOverviewKey(2, 2, 0)],
  );
  for (
    let step = 0;
    step < 8 &&
    (world.inspectRegion(left).status !== "current" ||
      world.inspectRegion(right).status !== "current");
    step++
  )
    frame();
  expect(world.inspectRegion(left).status).toBe("current");
  expect(world.inspectRegion(right).status).toBe("current");
  expect(world.inspectRegion([240, 240, 1296, 272]).status).toBe("missing");
  const update = change([256, 256]);
  frame();
  expect(world.inspectRegion(update.bounds).status).toBe("current");
  expect(world.inspectRegion(world.bounds()).status).toBe("missing");
});

it("does not require offscreen brush or halo pixels even inside a partially visible tile", async () => {
  const { world } = await readyRenderer();
  const offscreen: Bounds = [400, 160, 420, 180];
  world.invalidate(offscreen);
  expect(world.inspectRegion([160, 160, 420, 180]).status).toBe("current");
  expect(world.inspectRegion(offscreen).status).toBe("outside");
});

it("draws the complete warm 512px footprint in one eligible frame from changed numeric sources", async () => {
  const { world, frame, change, document, field, observation } =
    await readyRenderer({ width: 1180, height: 894, x: 0, y: 0 });
  const update = change([-1600, -300], {
    level: 4,
    radius: 1024,
    amount: 4000,
  });
  expect(world.inspectRegion(update.bounds).status).toBe("stale");
  const revision = document.revision;
  world.freezeRender(update.bounds);
  const render = vi.spyOn(world.renderer, "render");
  const receipt = frame();
  expect(render).toHaveBeenCalledOnce();
  expect(world.inspectRegion(update.bounds).status).toBe("current");
  expect(receipt!.exactRevision).toBe(revision);
  expect(document.revision).toBe(revision);
  expect(field.sources.size).toBeGreaterThan(0);
  expect(
    observation.read().some((event) => event.kind.startsWith("raster-")),
  ).toBe(false);
});

it("publishes only the latest complete numeric revision through Undo and Redo", async () => {
  const { world, frame, change, document, field } = await readyRenderer();
  const first = change([160, 160]);
  frame();
  const firstHeight = document.sampleHeight(160, 160);
  change([172, 160]);
  const undone = document.undo()!;
  world.updateSourcePatches(undone.patches);
  for (const bounds of undone.dirtyBounds) world.invalidate(bounds);
  expect(world.inspectRegion(first.bounds).status).toBe("stale");
  prepareSources(world);
  frame();
  expect(world.state().submittedRevision).toBe(3);
  expect(
    prepareHeightSampler([...field.sources.values()])(160, 160),
  ).toBeCloseTo(firstHeight, 10);
  const redone = document.redo()!;
  world.updateSourcePatches(redone.patches);
  for (const bounds of redone.dirtyBounds) world.invalidate(bounds);
  expect(world.inspectRegion(first.bounds).status).toBe("stale");
  prepareSources(world);
  frame();
  expect(world.inspectRegion(first.bounds).status).toBe("current");
  expect(world.state().submittedRevision).toBe(4);
  expect(
    prepareHeightSampler([...field.sources.values()])(160, 160),
  ).toBeCloseTo(document.sampleHeight(160, 160), 10);
});

it("never certifies dropped rendering and recovers through the ordinary numeric draw", async () => {
  const { world, frame, change } = await readyRenderer();
  world.fault = "drop-render";
  const update = change([160, 160]);
  const submitted = world.state().lastSubmittedFrame;
  for (let i = 0; i < 5; i++) frame();
  expect(world.inspectRegion(update.bounds).status).toBe("stale");
  expect(world.state().submittedRevision).toBe(0);
  expect(world.state().lastSubmittedFrame).toBe(submitted);
  world.fault = "none";
  frame();
  expect(world.inspectRegion(update.bounds).status).toBe("current");
});

it("holds delayed terrain until its deadline and does not mislabel a redraw", async () => {
  const { world, frame, change } = await readyRenderer();
  let now = 1000;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  world.fault = "delay-render";
  const update = change([160, 160]);
  frame();
  now += 249;
  world.redraw();
  frame();
  expect(world.inspectRegion(update.bounds).status).toBe("stale");
  now += 1;
  frame();
  expect(world.inspectRegion(update.bounds).status).toBe("current");
});

it("holds terrain during pointerup control then displays the already accepted dose after release", async () => {
  const { world, frame, document } = await readyRenderer();
  world.fault = "pointerup-render";
  document.beginGesture({ level: 0, radius: 20, amount: 400 });
  const update = document.applySegment([160, 160], [160, 160], 16)!;
  world.updateSourcePatches(update.patches);
  world.invalidate(update.bounds);
  frame();
  expect(world.inspectRegion(update.bounds).status).toBe("stale");
  expect(document.revision).toBe(1);
  document.finishGesture();
  frame();
  expect(world.inspectRegion(update.bounds).status).toBe("current");
  expect(document.revision).toBe(1);
});

it("keeps the same certified source area during a small camera move", async () => {
  const { world, frame } = await readyRenderer();
  const bounds = world.sourceBounds();
  world.moveCamera({ ...world.camera, x: world.camera.x + 4 });
  expect(world.sourceBounds()).toEqual(bounds);
  expect(world.isPresentationReady(bounds)).toBe(true);
  expect(world.inspectRegion(world.bounds()).status).not.toBe("current");
  world.refresh();
  frame();
  expect(world.inspectRegion(world.bounds()).status).toBe("current");
});

it("R2 renderer completes the entire frozen group while retaining newer changes", async () => {
  const { world, field, document, observation, change, frame } =
    await readyRenderer({ width: 256, height: 128, x: 512, y: 256 });
  const first = change([240, 240]);
  const second = change([720, 240]);
  const frozenSources = [...field.sources.values()].map((tile) => ({
    ...tile,
    values: tile.values.slice(),
  }));
  const receipt = world.freezeRender([first.bounds, second.bounds])!;
  expect(receipt).not.toBeNull();
  expect(receipt.revision).toBe(document.revision);
  for (const tile of world["tiles"].values())
    vi.spyOn(tile.field, "compositionWork", "get").mockReturnValue(
      editorBudgets.compositionWorkPerFrame,
    );
  const partial = world.renderFrame(performance.now())!;
  expect(partial.exactRevision).toBe(-1);
  const newer = change([740, 240]);
  expect(document.revision).toBeGreaterThan(receipt.revision);
  expect([...field.sources.values()]).toEqual(frozenSources);
  expect(world.state().queuedSourceTiles).toBeGreaterThan(0);
  world.pollCompletion();
  expect(world.inspectRenderReceipt(receipt)).toBe("pending");
  expect(observation.read().at(-1)).toMatchObject({
    kind: "gpu-completed",
    renderReceipt: null,
  });
  for (
    let step = 0;
    step < 20 && world.inspectRenderReceipt(receipt) === "pending";
    step++
  )
    frame();
  expect(world.inspectRenderReceipt(receipt)).toBe("complete");
  expect(world.inspectRenderReceipt({ ...receipt })).toBe("invalid");
  expect(world.inspectRegion(newer.bounds).status).toBe("stale");
  expect(world.state().queuedSourceTiles).toBeGreaterThan(0);
  prepareSources(world);
  expect(world.state().queuedSourceTiles).toBe(0);
  expect(observation.read().at(-1)).toMatchObject({
    kind: "gpu-completed",
    revision: receipt.revision,
    renderReceipt: receipt,
  });
  for (const tile of field.sources.values())
    expect(tile.values).toEqual(
      document
        .snapshot(heightTileSupport(tile))
        .tiles.find((item) => item.key === tile.key)!.values,
    );
  for (let step = 0; step < 20 && world.state().queuedTiles; step++) frame();
  expect(world.inspectRegion(newer.bounds).status).toBe("current");
  expect(world.inspectRenderReceipt(receipt)).toBe("complete");
});

it("R2 renderer rejects an imported foundation while completing its older immutable group", async () => {
  const { world, document, field, change } = await readyRenderer();
  const area: Bounds = [180, 180, 240, 240];
  const foundation = world.captureFoundation();
  const update = change([200, 200]);
  expect(world.inspectFoundation(area, foundation).status).toBe("current");
  const receipt = world.freezeRender(update.bounds)!;
  world.renderFrame(performance.now());
  const source = update.patches.find((patch) => patch.after)!.after!;
  const imported = { ...source, values: source.values.slice() };
  imported.values[40 * 64 + 40] += 5;
  world.updatePresentation([imported], [], []);
  expect(document.revision).toBe(receipt.revision);
  expect(field.sources.get(source.key)!.values).toEqual(source.values);
  expect(world.inspectFoundation(area, foundation).status).toBe("missing");
  world.pollCompletion();
  expect(world.inspectRenderReceipt(receipt)).toBe("complete");
  expect(field.sources.get(source.key)!.values).toEqual(source.values);
  prepareSources(world);
  expect(field.sources.get(source.key)!.values).toEqual(imported.values);
  expect(world.inspectRegion(area).status).toBe("stale");
  world.renderFrame(performance.now());
  world.pollCompletion();
  expect(world.inspectRegion(area).status).toBe("current");
  expect(world.inspectFoundation(area, foundation).status).toBe("missing");
});

it("R2 renderer captures partial current foundations without mutating them during inspection", async () => {
  const { world, change, frame } = await readyRenderer();
  const left: Bounds = [180, 180, 230, 230];
  const right: Bounds = [320, 320, 360, 360];
  change([200, 200]);
  expect(world.inspectRegion(left).status).toBe("stale");
  expect(world.inspectRegion(right).status).toBe("current");
  const foundation = world.captureFoundation();
  expect(world.inspectFoundation(left, foundation).status).toBe("missing");
  expect(world.inspectFoundation(right, foundation).status).toBe("current");
  frame();
  const state = world.state();
  for (let i = 0; i < 4; i++)
    expect(world.inspectFoundation(left, foundation).status).toBe("current");
  expect(world.state()).toEqual(state);
  change([200, 200]);
  expect(world.inspectFoundation(left, foundation).status).toBe("missing");
  frame();
  expect(world.acceptFoundation(left, foundation)).toBe(true);
  change([200, 200]);
  expect(world.inspectFoundation(left, foundation).status).toBe("current");
  expect(world.acceptFoundation(left, { ...foundation })).toBe(false);
});

it("R2 renderer freezes separate influences without requiring a cold gap", async () => {
  const { world, change, frame } = await readyRenderer({
    width: 384,
    height: 384,
  });
  const first = change([-200, -200]);
  const second = change([700, 700]);
  const ready = world.isPresentationReady.bind(world);
  vi.spyOn(world, "isPresentationReady").mockImplementation((bounds, power) =>
    intersectsBounds(bounds, [0, 0, 512, 512]) ? false : ready(bounds, power),
  );
  expect(world.freezeRender(world.bounds())).toBeNull();
  const receipt = world.freezeRender([first.bounds, second.bounds])!;
  expect(receipt).not.toBeNull();
  expect(receipt.bounds).toEqual([first.bounds, second.bounds]);
  for (
    let step = 0;
    step < 20 && world.inspectRenderReceipt(receipt) === "pending";
    step++
  )
    frame();
  expect(world.inspectRenderReceipt(receipt)).toBe("complete");
  expect(world.inspectRegion(first.bounds).status).toBe("current");
  expect(world.inspectRegion(second.bounds).status).toBe("current");
});

it("R2 renderer invalidates receipts across preparation, view, session and context changes", async () => {
  const { world, canvas, change, frame, observation } = await readyRenderer();
  const foundation = world.captureFoundation();
  const update = change([200, 200]);
  const first = world.freezeRender(update.bounds)!;
  frame();
  expect(world.inspectRenderReceipt(first)).toBe("complete");
  world.setToolLevel(1);
  expect(world.inspectRenderReceipt(first)).toBe("invalid");
  expect(world.inspectFoundation(update.bounds, foundation).status).toBe(
    "missing",
  );
  frame();
  const reused = world.freezeRender(update.bounds)!;
  expect(world.inspectRenderReceipt(reused)).toBe("complete");
  expect(observation.read().at(-1)).toMatchObject({
    kind: "render-current",
    renderReceipt: reused,
    frame: world.state().lastCompletedFrame,
  });
  world.moveCamera({ ...world.camera, x: world.camera.x + 1 });
  expect(world.inspectRenderReceipt(reused)).toBe("invalid");
  world.refresh();
  frame();
  const moved = world.freezeRender(update.bounds)!;
  canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
  expect(world.inspectRenderReceipt(moved)).toBe("invalid");
  canvas.dispatchEvent(new Event("webglcontextrestored"));
  frame();
  const restored = world.freezeRender(update.bounds)!;
  expect(world.inspectRenderReceipt(restored)).toBe("complete");
  world.reset(new EditorDocument("another-render-session", { empty: true }));
  expect(world.inspectRenderReceipt(restored)).toBe("invalid");
});

it("R2 renderer preserves frozen fine overviews and coalesces every later delta", async () => {
  const { world, field, document, change, frame } = await readyRenderer({
    scale: 0.01,
  });
  const first = change([200, 200]);
  const receipt = world.freezeRender(first.bounds)!;
  world.renderFrame(performance.now());
  const frozenOverviews = [...field.overviews.values()].map((tile) => ({
    ...tile,
    values: tile.values.slice(),
  }));
  const second = change([210, 210]);
  const third = change([220, 220]);
  expect([...field.overviews.values()]).toEqual(frozenOverviews);
  world.pollCompletion();
  expect(world.inspectRenderReceipt(receipt)).toBe("complete");
  prepareSources(world);
  const latest = world.freezeRender([
    first.bounds,
    second.bounds,
    third.bounds,
  ])!;
  expect(latest.revision).toBe(document.revision);
  for (
    let step = 0;
    step < 20 && world.inspectRenderReceipt(latest) === "pending";
    step++
  )
    frame();
  expect(world.inspectRenderReceipt(latest)).toBe("complete");
  for (const overview of field.overviews.values()) {
    const bounds = heightOverviewBounds(overview);
    const sample = prepareHeightSampler(document.snapshot(bounds).tiles);
    const step = 2 ** overview.power;
    for (let y = 0; y < 128; y++)
      for (let x = 0; x < 128; x++)
        expect(overview.values[y * 128 + x]).toBeCloseTo(
          (sample(bounds[0] + (x + 0.5) * step, bounds[1] + (y + 0.5) * step) +
            100) /
            HEIGHT_SUM_SCALE,
          12,
        );
  }
});

it("R2 renderer keeps the before proof of a queued deletion after author eviction", async () => {
  const { world, field, change } = await readyRenderer({ scale: 0.01 });
  const update = change([200, 200]);
  const source = update.patches.find((patch) => patch.after)!.after!;
  world.forgetSources([source.key]);
  prepareSources(world);
  expect(field.sources.has(source.key)).toBe(false);
  const receipt = world.freezeRender(update.bounds)!;
  const apply = vi.spyOn(world["field"], "applySourcePatches");
  world.renderFrame(performance.now());
  world.updateSourcePatches([{ key: source.key, before: source, after: null }]);
  expect(apply).not.toHaveBeenCalled();
  world.pollCompletion();
  expect(world.inspectRenderReceipt(receipt)).toBe("complete");
  expect(apply).not.toHaveBeenCalled();
  prepareSources(world);
  expect(apply).toHaveBeenCalledWith([
    { key: source.key, before: source, after: null },
  ]);
});

it("keeps visible progress and the frame loop after a slow or failed brush decision", async () => {
  const { drainView, controller, frame, pointer, advance } =
    await readyController();
  controller.setBrush(16, 400);
  await drainView();
  pointer("pointerdown", 20, 20);
  const decision = vi.spyOn(
    controller as unknown as { advanceHeldBrush(now: number): void },
    "advanceHeldBrush",
  );
  decision.mockImplementationOnce(() => {
    throw new Error("input failed");
  });
  frame();
  expect(controller.state.error).toBe("input failed");
  decision.mockImplementation(() => advance(5));
  frame();
  expect(
    controller.world.inspectSubmittedRegion(controller.world.bounds()).status,
  ).toBe("current");
  frame(0); // The next real controller tick observes the completed GPU fence.
  expect(controller.world.inspectRegion(controller.world.bounds()).status).toBe(
    "current",
  );
  expect(controller.observe().document!.revision).toBe(1);
  pointer("pointerup", 20, 20);
  controller.destroy();
});

async function readyController(
  sourceTiles = 0,
  options: {
    diagnostics?: boolean;
    ready?: boolean;
    readFailure?: boolean;
    width?: number;
    height?: number;
  } = {},
) {
  let nextFrame = 0;
  let now = 1000;
  let width = options.width ?? 64;
  let height = options.height ?? 64;
  let resized!: () => void;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const callbacks = new Map<number, FrameRequestCallback>();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callbacks.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => callbacks.delete(id));
  vi.stubGlobal("devicePixelRatio", 1);
  vi.stubGlobal("location", { search: "" });
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal(
    "document",
    Object.assign(new EventTarget(), { visibilityState: "visible" }),
  );
  vi.stubGlobal("HTMLInputElement", class {});
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resized = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "Worker",
    class {
      postMessage() {}
      terminate() {}
    },
  );
  class Canvas extends EventTarget {
    getBoundingClientRect() {
      return { left: 0, top: 0, width, height };
    }
    focus() {}
    setPointerCapture() {}
  }
  const canvas = new Canvas();
  const info: ProjectInfo = {
    sessionId: "shared-frame",
    projectId: "frame-test",
    format: 24,
    title: "Frame test",
    sequence: 0,
    savedSequence: 0,
    path: null,
    activeLevels: [],
    sourceTiles,
  };
  const bridge = {
    diagnostics: options.diagnostics ?? true,
    onFileAction: vi.fn(() => () => {}),
    status: async () => info,
    readPresentation: vi.fn(
      async (
        request: ReadPresentationRequest,
      ): Promise<Awaited<ReturnType<AtlasDesktop["readPresentation"]>>> => ({
        ...request,
        sequence: info.sequence,
        tiles: [],
        overviews: [],
        overviewKeys: heightOverviewKeys(request.bounds, request.power),
      }),
    ),
    readRegion: vi.fn(
      async (request: ReadRegionRequest): Promise<RegionRead> => ({
        ...request,
        sequence: info.sequence,
        tiles: [],
      }),
    ),
    commit: vi.fn(async (request: CommitRequest) => {
      info.sequence = request.sequence;
      return {
        sessionId: request.sessionId,
        sequence: request.sequence,
        transactionId: request.transactionId,
      };
    }),
    newProject: vi.fn(),
    openProject: vi.fn(),
    saveProject: vi.fn(),
    metrics: vi.fn(),
  } satisfies AtlasDesktop;
  const controller = new EditorController(
    canvas as unknown as HTMLCanvasElement,
    bridge,
  );
  if (options.readFailure)
    bridge.readPresentation.mockRejectedValueOnce(
      new Error("Lokaler Lesefehler"),
    );
  const frame = (elapsedMs = 16) => {
    now += elapsedMs;
    const pending = [...callbacks.values()];
    callbacks.clear();
    for (const callback of pending) callback(performance.now());
  };
  const drainView = async () => {
    for (let step = 0; step < 100; step++) {
      await Promise.resolve();
      frame();
      if (
        !controller.state.finishing &&
        !controller.state.loading &&
        controller.world.inspectRegion(controller.world.bounds()).status ===
          "current"
      )
        return;
    }
    throw new Error("Actual numeric terrain view did not finish");
  };
  const drainAction = async () => {
    for (let step = 0; step < 200; step++) {
      frame(0);
      for (let turn = 0; turn < 8; turn++) await Promise.resolve();
      const observed = controller.observe();
      if (!observed.document!.active && !observed.state.finishing) {
        expect(observed.document!.brushWork?.pendingPoints ?? 0).toBe(0);
        expect(observed.document!.brushWork?.pendingCells ?? 0).toBe(0);
        expect(observed.document!.brushWork?.pendingAdmissions ?? 0).toBe(0);
        return;
      }
    }
    throw new Error("Accepted author work did not finish");
  };
  const pointer = (
    type: string,
    x = 32,
    y = 32,
    at = now,
    coalesced: { x: number; y: number; at: number }[] = [],
  ) => {
    const event = new Event(type);
    Object.assign(event, {
      button: 0,
      pointerId: 1,
      clientX: x,
      clientY: y,
      getCoalescedEvents: () =>
        coalesced.map((sample) => ({
          clientX: sample.x,
          clientY: sample.y,
          timeStamp: sample.at,
          type,
        })),
    });
    Object.defineProperty(event, "timeStamp", { value: at });
    canvas.dispatchEvent(event);
  };
  await controller.init();
  controller.setGrid(false);
  if (options.ready !== false) await drainView();
  const advance = (elapsedMs: number) => {
    now += elapsedMs;
  };
  const resize = (nextWidth: number, nextHeight = height) => {
    width = nextWidth;
    height = nextHeight;
    resized();
  };
  return {
    controller,
    bridge,
    callbacks,
    frame,
    pointer,
    drainView,
    drainAction,
    canvas,
    advance,
    resize,
  };
}

it("rejects Down during tool preparation, never autostarts a held press, and keeps observation read-only", async () => {
  const { controller, pointer, frame, drainView, drainAction } =
    await readyController();
  const prepare = vi.spyOn(controller.world, "setToolLevel");
  const gl = controller.world.renderer.gl;
  const wait = vi
    .spyOn(gl, "clientWaitSync")
    .mockReturnValue(gl.TIMEOUT_EXPIRED);
  controller.setBrush(16, 400);
  expect(controller.observe().readiness).toMatchObject({
    ready: false,
    reason: "terrain",
  });
  const calls = prepare.mock.calls.length;
  const resources = controller.world.state();
  controller.observe();
  controller.observe();
  expect(prepare).toHaveBeenCalledTimes(calls);
  expect(controller.world.state()).toEqual(resources);
  pointer("pointerdown", 20, 20);
  frame();
  frame();
  expect(controller.observe().document!.revision).toBe(0);
  expect(controller.state.needsPress).toBe(true);
  wait.mockReturnValue(gl.ALREADY_SIGNALED);
  await drainView();
  pointer("pointermove", 24, 20);
  frame();
  expect(controller.observe().document!.revision).toBe(0);
  pointer("pointerup", 24, 20);
  pointer("pointerdown", 24, 20);
  expect(controller.observe().document!.revision).toBe(0);
  expect(controller.observe().document!.brushWork!.pendingPoints).toBe(1);
  pointer("pointerup", 24, 20);
  await drainAction();
  expect(controller.observe().document!.historyActions).toBe(1);
  controller.destroy();
});

it("keeps the stroke level through finishing and prepares changed settings after completion", async () => {
  const { controller, pointer, frame, drainView, drainAction } =
    await readyController();
  controller.setBrush(16, 400);
  await drainView();
  pointer("pointerdown", 20, 20);
  const prepare = vi.spyOn(controller.world, "setToolLevel");
  controller.setBrush(512, 400);
  expect(prepare).toHaveBeenLastCalledWith(0);
  expect(controller.observe().readiness.brush.level).toBe(0);
  frame(0);
  pointer("pointerup", 20, 20);
  expect(controller.state.finishing).toBe(true);
  expect(prepare).toHaveBeenLastCalledWith(0);
  await drainAction();
  await drainView();
  expect(prepare).toHaveBeenLastCalledWith(controller.currentBrush().level);
  expect(controller.observe().readiness.ready).toBe(true);
  controller.destroy();
});

it.each([16, 512])(
  "reserves a %ipx short click and rejects another gesture until its action and terrain complete",
  async (diameter) => {
    const { controller, bridge, pointer, frame, drainView, drainAction } =
      await readyController(0, { width: 1180, height: 894 });
    controller.setBrush(diameter, 400);
    await drainView();
    pointer("pointerdown", 20, 20);
    expect(controller.observe().document!.revision).toBe(0);
    expect(controller.observe().document!.brushWork!.pendingPoints).toBe(1);
    pointer("pointerup", 20, 20);
    expect(controller.state.finishing).toBe(true);
    pointer("pointerdown", 20, 20);
    pointer("pointerup", 20, 20);
    expect(bridge.commit).not.toHaveBeenCalled();
    await drainAction();
    const complete = controller.observe();
    expect(complete.document!.historyActions).toBe(1);
    expect(bridge.commit).toHaveBeenCalledOnce();
    const accepted = complete.events.filter(
      (event) => event.kind === "brush-accepted",
    );
    expect(accepted.map((event) => event.cause)).toEqual(["press", "terminal"]);
    expect(accepted[0]).toMatchObject({
      pointCount: 1,
      rawElapsedMs: 0,
      offeredElapsedMs: 0,
    });
    expect(
      complete.events.filter((event) => event.kind === "brush-start"),
    ).toHaveLength(1);
    await drainView();
    frame(1000);
    expect(controller.observe().document!.revision).toBe(
      complete.document!.revision,
    );
    expect(controller.observe().document!.historyActions).toBe(1);
    expect(
      controller.observation
        .read()
        .filter((event) => event.kind === "edit-submit"),
    ).toHaveLength(1);
    controller.destroy();
  },
);

it.each(["drop-render", "delay-render", "pointerup-render"] as const)(
  "retains accepted path and terminal endpoint through %s without new time after Up",
  async (fault) => {
    const {
      controller,
      bridge,
      frame,
      pointer,
      advance,
      drainView,
      drainAction,
    } = await readyController(0, { width: 1180, height: 894 });
    controller.setBrush(512, 400);
    await drainView();
    controller.world.fault = fault;
    pointer("pointerdown", 190, 372);
    frame(0);
    advance(24);
    pointer("pointermove", 330, 372);
    frame(0);
    advance(24);
    pointer("pointermove", 610, 372);
    pointer("pointerup", 650, 372);
    expect(controller.state.finishing).toBe(true);
    await drainAction();
    const complete = controller.observe([
      [-1600, -300],
      [-640, -300],
      [240, -300],
    ]);
    expect(complete.samples.every((value) => value! > -100)).toBe(true);
    expect(complete.document!.historyActions).toBe(1);
    expect(bridge.commit).toHaveBeenCalledOnce();
    const admissions = complete.events.filter(
      (event) => event.kind === "brush-accepted",
    );
    expect(admissions.map((event) => event.cause)).toEqual([
      "press",
      "move",
      "move",
      "terminal",
    ]);
    expect(admissions.at(-1)!.to).toEqual([240, -300]);
    controller.world.fault = "none";
    await drainView();
    frame(1000);
    const after = controller.observe([
      [-1600, -300],
      [-640, -300],
      [240, -300],
    ]);
    expect(after.samples).toEqual(complete.samples);
    expect(after.document!.revision).toBe(complete.document!.revision);
    expect(
      after.events.filter((event) => event.kind === "brush-accepted"),
    ).toHaveLength(admissions.length);
    controller.destroy();
  },
);

it("retains accepted author work and its dose fact when presentation projection fails", async () => {
  const { controller, bridge, frame, pointer, drainView, drainAction } =
    await readyController();
  controller.setBrush(16, 400);
  await drainView();
  const original = controller.observe([[-48, -48]]).samples[0]!;
  bridge.readPresentation.mockImplementation(async (request) => ({
    ...request,
    sequence: bridge.commit.mock.calls.at(-1)?.[0].sequence ?? 0,
    tiles:
      bridge.commit.mock.calls
        .at(-1)?.[0]
        .patches.flatMap((patch) => (patch.after ? [patch.after] : [])) ?? [],
    overviews: [],
    overviewKeys: heightOverviewKeys(request.bounds, request.power),
  }));
  vi.spyOn(controller.world, "updateSourcePatches").mockImplementationOnce(
    () => {
      throw new Error("Darstellungsbudget überschritten");
    },
  );
  pointer("pointerdown", 20, 20);
  expect(controller.state.error).toBeNull();
  frame(0);
  expect(controller.state.error).toBe("Darstellungsbudget überschritten");
  expect(controller.state.finishing).toBe(true);
  expect(controller.observe([[-48, -48]]).samples[0]).toBeGreaterThan(original);
  const intervals = controller.observation
    .read()
    .filter((event) => event.kind === "brush-interval");
  expect(intervals).toHaveLength(1);
  expect(intervals[0]).toMatchObject({
    cause: "materialize",
    dosing: "c1",
    changed: true,
    projectedAt: null,
  });
  pointer("pointerup", 20, 20);
  await drainAction();
  await drainView();
  expect(controller.observe().document!.historyActions).toBe(1);
  expect(bridge.commit).toHaveBeenCalledOnce();
  const stored = prepareHeightSampler(
    bridge.commit.mock.calls[0][0].patches.flatMap((patch) =>
      patch.after ? [patch.after] : [],
    ),
  );
  expect(stored(-48, -48)).toBeCloseTo(
    controller.observe([[-48, -48]]).samples[0]!,
    10,
  );
  controller.undo();
  await drainView();
  expect(controller.observe([[-48, -48]]).samples[0]).toBe(original);
  expect(controller.state.canRedo).toBe(true);
  expect(
    controller.observation
      .read()
      .filter((event) => event.kind === "brush-submit"),
  ).toHaveLength(0);
  controller.destroy();
});

it("rejects an invalid path before acceptance and finishes its already reserved press", async () => {
  const { controller, frame, pointer, drainAction } = await readyController();
  pointer("pointerdown", 20, 20);
  pointer("pointermove", 30_000_000, 20);
  pointer("pointerup", 30_000_000, 20);
  expect(controller.state.finishing).toBe(true);
  expect(
    controller.observation
      .read()
      .filter((event) => event.kind === "brush-accepted"),
  ).toHaveLength(1);
  await drainAction();
  const complete = controller.observe([[-48, -48]]);
  expect(complete.gesture).toBeNull();
  expect(complete.document!.historyActions).toBe(1);
  frame(1000);
  expect(controller.observe([[-48, -48]]).samples).toEqual(complete.samples);
  controller.destroy();
});

it("deepens while held using local C1 allowance without synthetic pointer inputs", async () => {
  const { controller, frame, pointer, drainView, drainAction } =
    await readyController();
  controller.setBrush(16, 400);
  await drainView();
  pointer("pointerdown", 20, 20);
  frame(0);
  const pressHeight = controller.observe([[-48, -48]]).samples[0]!;
  for (let step = 0; step < 8; step++) frame(16);
  expect(controller.observe([[-48, -48]]).samples[0]).toBeGreaterThan(
    pressHeight,
  );
  const events = controller.observation.read();
  const held = events.filter(
    (event) => event.kind === "brush-accepted" && event.cause === "hold",
  );
  expect(
    held.reduce((sum, event) => sum + Number(event.offeredElapsedMs), 0),
  ).toBe(128);
  expect(
    held.every(
      (event) =>
        (event.inputIds as number[]).length === 0 &&
        Number(event.offeredElapsedMs) <= 50,
    ),
  ).toBe(true);
  expect(
    events.filter(
      (event) => event.kind === "input" && event.inputKind === "edit",
    ),
  ).toHaveLength(1);
  pointer("pointerup", 20, 20);
  await drainAction();
  const complete = controller.observe([[-48, -48]]);
  await drainView();
  frame(1000);
  expect(controller.observe([[-48, -48]]).samples).toEqual(complete.samples);
  expect(controller.observe().document!.revision).toBe(
    complete.document!.revision,
  );
  controller.undo();
  await drainView();
  expect(controller.observe([[-48, -48]]).samples[0]).toBeCloseTo(-100, 10);
  controller.destroy();
});

it("caps stalled time while preserving its complete spatial path and rejects a causally older sample", async () => {
  const { controller, frame, pointer, advance, drainView, drainAction } =
    await readyController(0, { width: 256, height: 128 });
  controller.setBrush(16, 400);
  await drainView();
  pointer("pointerdown", 48, 64);
  const oldAt = performance.now();
  frame(0);
  advance(1000);
  pointer("pointermove", 208, 64);
  const admission = controller.observation
    .read()
    .filter((event) => event.kind === "brush-accepted")
    .at(-1)!;
  expect(admission).toMatchObject({
    cause: "move",
    from: [-320, 0],
    to: [320, 0],
    rawElapsedMs: 1000,
    offeredElapsedMs: 50,
  });
  pointer("pointermove", 10, 64, oldAt);
  expect(controller.state.error).toContain("geordnet");
  pointer("pointerup", 208, 64);
  await drainAction();
  const complete = controller.observe([
    [-320, 0],
    [0, 0],
    [320, 0],
  ]);
  expect(complete.samples.every((value) => value! > -100)).toBe(true);
  expect(complete.document!.historyActions).toBe(1);
  frame(1000);
  expect(
    controller.observe([
      [-320, 0],
      [0, 0],
      [320, 0],
    ]).samples,
  ).toEqual(complete.samples);
  controller.destroy();
});

it("accepts many finite moves while a frozen draw waits and materializes all reserved work", async () => {
  const { controller, frame, pointer, drainView, drainAction } =
    await readyController();
  controller.setBrush(16, 400);
  await drainView();
  controller.world.fault = "drop-render";
  pointer("pointerdown", 20, 20);
  frame(0);
  for (let x = 21; x <= 40; x++) pointer("pointermove", x, 20);
  expect(
    controller.observation
      .read()
      .filter(
        (event) => event.kind === "brush-accepted" && event.cause === "move",
      ),
  ).toHaveLength(20);
  expect(
    controller.observe().document!.brushWork!.pendingPoints,
  ).toBeGreaterThan(0);
  pointer("pointerup", 44, 20);
  await drainAction();
  const complete = controller.observe([
    [-48, -48],
    [0, -48],
    [48, -48],
  ]);
  expect(complete.samples.every((value) => value! > -100)).toBe(true);
  expect(complete.document!.historyActions).toBe(1);
  controller.world.fault = "none";
  await drainView();
  expect(controller.observe().renderer.submittedRevision).toBe(
    complete.document!.revision,
  );
  controller.destroy();
});

it("invalidates a frozen receipt on navigation while finishing accepted old-view work", async () => {
  const { controller, frame, pointer, drainView, drainAction } =
    await readyController();
  controller.setBrush(16, 400);
  await drainView();
  pointer("pointerdown", 20, 20);
  frame(0);
  const frozen = controller.observation
    .read()
    .find((event) => event.kind === "brush-frozen")!;
  expect(frozen).toBeDefined();
  const gl = controller.world.renderer.gl;
  const wait = vi
    .spyOn(gl, "clientWaitSync")
    .mockReturnValue(gl.TIMEOUT_EXPIRED);
  pointer("pointerup", 20, 20);
  controller.goTo(new Event("navigate"), 10_000, 0, 0.25);
  expect(
    controller.world.inspectRenderReceipt(
      frozen.renderReceipt as import("./WorldRenderer").FrozenRenderReceipt,
    ),
  ).toBe("invalid");
  pointer("pointerdown", 20, 20);
  pointer("pointerup", 20, 20);
  wait.mockReturnValue(gl.ALREADY_SIGNALED);
  await drainAction();
  expect(controller.observe().document!.historyActions).toBe(1);
  expect(
    controller.observation
      .read()
      .some(
        (event) =>
          event.kind === "brush-feedback" &&
          event.accepted &&
          event.renderReceipt === frozen.renderReceipt,
      ),
  ).toBe(false);
  await drainView();
  pointer("pointerdown", 20, 20);
  pointer("pointerup", 20, 20);
  await drainAction();
  expect(controller.observe().document!.historyActions).toBe(2);
  controller.destroy();
});

it("finishes accepted work across resize and requires the new view before another press", async () => {
  const { controller, pointer, resize, drainView, drainAction } =
    await readyController();
  controller.setBrush(8, 400);
  await drainView();
  pointer("pointerdown", 2, 32);
  pointer("pointerup", 2, 32);
  resize(8);
  pointer("pointerdown", 4, 32);
  pointer("pointerup", 4, 32);
  expect(controller.observe().document!.revision).toBe(0);
  await drainAction();
  expect(controller.observe().document!.historyActions).toBe(1);
  await drainView();
  pointer("pointerdown", 4, 32);
  pointer("pointerup", 4, 32);
  await drainAction();
  expect(controller.observe().document!.historyActions).toBe(2);
  controller.destroy();
});

it.each(["pointerup", "cancel", "blur", "visibility", "escape", "destroy"])(
  "never applies a deferred source impulse after %s",
  async (ending) => {
    const { controller, bridge, frame, pointer, drainView, advance } =
      await readyController(1);
    controller.goTo(new Event("navigate"), 10_000, 0, 1 / 64);
    await drainView();
    controller.setBrush(8, 400);
    let resume!: (reply: RegionRead) => void;
    bridge.readRegion.mockImplementationOnce(
      () =>
        new Promise<RegionRead>((resolve) => {
          resume = resolve;
        }),
    );
    pointer("pointerdown");
    expect(controller.observe().gesture).toBeNull();
    expect(controller.observe().document!.revision).toBe(0);
    frame();
    for (let step = 0; step < 8; step++) await Promise.resolve();
    frame(0); // The current tool read follows the completed presentation read.
    for (let step = 0; step < 8; step++) await Promise.resolve();
    advance(200);
    if (ending === "pointerup") pointer("pointerup");
    else if (ending === "cancel") pointer("pointercancel");
    else if (ending === "blur") window.dispatchEvent(new Event("blur"));
    else if (ending === "visibility") {
      Object.assign(document, { visibilityState: "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
    } else if (ending === "escape") {
      const event = new Event("keydown");
      Object.assign(event, { key: "Escape" });
      window.dispatchEvent(event);
    } else controller.destroy();
    expect(controller.observe().gesture).toBeNull();
    const request = bridge.readRegion.mock.calls.at(-1)![0];
    resume({ ...request, sequence: 0, tiles: [] });
    for (let step = 0; step < 5; step++) await Promise.resolve();
    frame(500);
    expect(controller.observe().document!.revision).toBe(0);
    expect(bridge.commit).not.toHaveBeenCalled();
    expect(
      controller.observation
        .read()
        .some((event) => event.kind === "brush-interval"),
    ).toBe(false);
    if (ending !== "destroy") controller.destroy();
  },
);

it("never resumes a held early press; release and a new press are required after sources arrive", async () => {
  const { controller, bridge, frame, pointer, drainView, advance } =
    await readyController(1);
  controller.goTo(new Event("navigate"), 10_000, 0, 1 / 64);
  await drainView();
  controller.setBrush(8, 400);
  let resume!: (reply: RegionRead) => void;
  bridge.readRegion.mockImplementationOnce(
    () =>
      new Promise<RegionRead>((resolve) => {
        resume = resolve;
      }),
  );
  pointer("pointerdown");
  frame(200);
  for (let step = 0; step < 8; step++) await Promise.resolve();
  frame(0);
  for (let step = 0; step < 8; step++) await Promise.resolve();
  advance(500);
  const request = bridge.readRegion.mock.calls.at(-1)![0];
  resume({ ...request, sequence: 0, tiles: [] });
  for (let step = 0; step < 5; step++) await Promise.resolve();
  expect(controller.observe().document!.revision).toBe(0);
  frame();
  const intervals = controller.observation
    .read()
    .filter((event) => event.kind === "brush-interval");
  expect(intervals).toHaveLength(0);
  expect(controller.observe().gesture).toBeNull();
  expect(controller.state.needsPress).toBe(true);
  expect(controller.state.message).toBe(
    "Zum Bearbeiten loslassen und erneut drücken",
  );
  pointer("pointerdown");
  expect(controller.observe().gesture).toBeNull();
  expect(controller.observe().document!.revision).toBe(0);
  pointer("pointermove", 36, 32);
  frame(200);
  expect(controller.observe().document!.revision).toBe(0);
  expect(bridge.commit).not.toHaveBeenCalled();
  pointer("pointerup");
  pointer("pointerdown");
  expect(
    controller.observation
      .read()
      .filter((event) => event.kind === "brush-accepted"),
  ).toHaveLength(1);
  expect(
    controller.observation
      .read()
      .find((event) => event.kind === "brush-accepted"),
  ).toMatchObject({
    cause: "press",
    offeredElapsedMs: 0,
    rawElapsedMs: 0,
  });
  pointer("pointerup");
  frame(200);
  await drainView();
  expect(controller.observe().document!.historyActions).toBe(1);
  controller.destroy();
});

it("uses the displayed-terrain gate in normal startup without diagnostic callbacks", async () => {
  const { controller, bridge, pointer, frame, drainView } =
    await readyController(0, {
      diagnostics: false,
      ready: false,
    });
  controller.setBrush(16, 400);
  expect(controller.observe().readiness.reason).toBe("terrain");
  expect(controller.state.loading).toBe(true);
  pointer("pointerdown", 20, 20);
  pointer("pointermove", 24, 20);
  expect(controller.observe().gesture).toBeNull();
  expect(controller.observe().document!.revision).toBe(0);
  expect(controller.state.canUndo).toBe(false);
  await drainView();
  frame(500);
  expect(controller.state.loading).toBe(false);
  expect(controller.state.needsPress).toBe(true);
  expect(controller.state.message).toBe(
    "Zum Bearbeiten loslassen und erneut drücken",
  );
  expect(controller.observe().document!.revision).toBe(0);
  expect(bridge.commit).not.toHaveBeenCalled();
  pointer("pointerup", 24, 20);
  pointer("pointerdown", 24, 20);
  pointer("pointerup", 24, 20);
  expect(controller.state.finishing).toBe(true);
  await drainView();
  expect(controller.observe().document!.historyActions).toBe(1);
  expect(bridge.commit).toHaveBeenCalledOnce();
  expect(controller.state.canUndo).toBe(true);
  expect(controller.observation.read()).toEqual([]);
  controller.undo();
  await drainView();
  expect(controller.observe([[-32, -48]]).samples[0]).toBe(-100);
  controller.destroy();
});

it("keeps input decisions, terrain and history identical with diagnostics enabled or disabled", async () => {
  const replay = async (diagnostics: boolean) => {
    const {
      controller,
      bridge,
      pointer,
      frame,
      drainView,
      drainAction,
      advance,
    } = await readyController(0, { diagnostics, ready: false });
    controller.setBrush(16, 400);
    const states: unknown[] = [];
    const capture = () => {
      const { document, readiness, samples } = controller.observe([
        [-48, -48],
        [-32, -48],
        [0, -48],
      ]);
      states.push({
        document,
        readiness,
        samples,
        needsPress: controller.state.needsPress,
      });
    };
    pointer("pointerdown", 20, 20);
    pointer("pointermove", 24, 20);
    await drainView();
    frame(500);
    capture();
    expect(controller.observe().document!.revision).toBe(0);
    expect(controller.state.needsPress).toBe(true);
    pointer("pointerup", 24, 20);
    controller.world.fault = "drop-render";
    pointer("pointerdown", 24, 20);
    pointer("pointermove", 32, 20);
    capture();
    frame(24);
    capture();
    advance(16);
    pointer("pointermove", 36, 20);
    pointer("pointerup", 40, 20);
    pointer("pointerdown", 32, 20);
    pointer("pointerup", 32, 20);
    await drainAction();
    expect(controller.observe().document!.historyActions).toBe(1);
    controller.world.fault = "none";
    await drainView();
    capture();
    controller.undo();
    await drainView();
    capture();
    controller.redo();
    await drainView();
    for (let step = 0; step < 20 && controller.state.writing; step++)
      await Promise.resolve();
    expect(controller.state.writing).toBe(false);
    capture();
    const result = {
      states,
      commits: structuredClone(bridge.commit.mock.calls),
    };
    expect(result.commits).toHaveLength(3);
    expect(controller.observation.eventCount > 0).toBe(diagnostics);
    controller.destroy();
    return result;
  };
  expect(await replay(true)).toEqual(await replay(false));
});

it("prepares an off-center finer tool on hover and size change without a gesture", async () => {
  const { controller, bridge, pointer, drainView } = await readyController(1, {
    width: 512,
  });
  controller.goTo(new Event("navigate"), 100_000, 0, 1 / 64);
  await drainView();
  controller.setBrush(8, 400);
  pointer("pointermove", 450, 32);
  expect(controller.observe().readiness.reason).toBe("sources");
  await drainView();
  const { point, bounds, ready } = controller.observe().readiness;
  expect(point).toEqual([112_416, 0]);
  expect(bounds[0]).toBeGreaterThan(100_000);
  expect(bridge.readRegion.mock.calls.at(-1)![0]).toMatchObject({
    bounds,
    minLevel: 2,
  });
  expect(ready).toBe(true);
  expect(controller.observe().gesture).toBeNull();
  expect(controller.state.canUndo).toBe(false);
  pointer("pointerdown", 450, 32);
  pointer("pointerup", 450, 32);
  await drainView();
  expect(controller.observe().document!.historyActions).toBe(1);
  controller.destroy();
});

it("marks navigation ready only after the actual matching local submit", async () => {
  const { controller, frame, pointer, drainView } = await readyController(1);
  controller.goTo(new Event("navigate"), 20_000, 0, 0.25);
  expect(controller.observe().readiness.ready).toBe(false);
  frame();
  for (let step = 0; step < 8; step++) await Promise.resolve();
  let events = controller.observation.read();
  expect(events.some((event) => event.kind === "sources-ready")).toBe(true);
  expect(events.some((event) => event.kind === "input-ready")).toBe(false);
  pointer("pointerdown");
  pointer("pointerup");
  expect(controller.observe().document!.revision).toBe(0);
  await drainView();
  events = controller.observation.read();
  const ready = events.find((event) => event.kind === "input-ready")!;
  const submit = events.find(
    (event) => event.kind === "submit" && event.frame === ready.frame,
  )!;
  expect(ready).toMatchObject({
    sessionId: "shared-frame",
    revision: 0,
  });
  expect(controller.observe().readiness).toMatchObject({
    ready: true,
    reason: null,
  });
  expect(submit.viewGeneration).toBe(ready.viewGeneration);
  expect(events.indexOf(submit)).toBeLessThan(events.indexOf(ready));
  pointer("pointerdown");
  pointer("pointerup");
  await drainView();
  expect(controller.observe().document!.historyActions).toBe(1);
  controller.destroy();
});

it("ends a stroke before an unseen gap even when its two endpoints are visible", async () => {
  const { controller, bridge, frame, pointer, drainView, drainAction } =
    await readyController(0, { width: 512 });
  controller.setBrush(16, 400);
  await drainView();
  pointer("pointerdown", 64, 32);
  frame(0);
  const accepted = controller.observe().document!.revision;
  const inspect = controller.world.inspectFoundation.bind(controller.world);
  const gap = vi
    .spyOn(controller.world, "inspectFoundation")
    .mockImplementation((bounds, proof) => {
      const region = inspect(bounds, proof);
      return bounds[0] < 0 && bounds[2] > 0
        ? { ...region, status: "missing" }
        : region;
    });
  pointer("pointermove", 448, 32);
  expect(controller.state.finishing).toBe(true);
  await drainAction();
  expect(controller.observe().gesture).toBeNull();
  expect(controller.observe().document!.revision).toBe(accepted);
  expect(controller.state.needsPress).toBe(true);
  expect(bridge.commit).toHaveBeenCalledOnce();
  gap.mockRestore();
  await drainView();
  frame(500);
  expect(controller.observe().document!.revision).toBe(accepted);
  pointer("pointerup", 448, 32);
  controller.undo();
  await drainView();
  expect(
    controller.observe([
      [-768, 0],
      [0, 0],
      [768, 0],
    ]).samples,
  ).toEqual([-100, -100, -100]);
  controller.destroy();
});

it("permits a partial edge footprint but ends before a captured pointer paints wholly outside the viewport", async () => {
  const { controller, bridge, pointer, frame, drainView, drainAction } =
    await readyController();
  controller.setBrush(16, 400);
  await drainView();
  pointer("pointerdown", 1, 32);
  expect(controller.observe().document!.brushWork!.pendingPoints).toBe(1);
  pointer("pointermove", 1000, 32);
  await drainAction();
  expect(controller.observe().gesture).toBeNull();
  const complete = controller.observe().document!.revision;
  expect(complete).toBeGreaterThan(0);
  expect(controller.observe().readiness.reason).toBe("outside");
  expect(controller.state.loading).toBe(false);
  pointer("pointermove", 32, 32);
  await drainView();
  frame(500);
  expect(controller.state.needsPress).toBe(true);
  expect(controller.observe().document!.revision).toBe(complete);
  expect(bridge.commit).toHaveBeenCalledOnce();
  pointer("pointerup");
  controller.undo();
  await drainView();
  expect(
    controller.observe([
      [-124, 0],
      [0, 0],
      [1000, 0],
    ]).samples,
  ).toEqual([-100, -100, -100]);
  controller.destroy();
});

it("retains the current full tool halo when size and hover change during a presentation read", async () => {
  const { controller, bridge, frame, pointer, drainView } =
    await readyController(1, { width: 512, height: 256 });
  let resume!: (
    reply: Awaited<ReturnType<typeof bridge.readPresentation>>,
  ) => void;
  bridge.readPresentation.mockImplementationOnce(
    () => new Promise((resolve) => (resume = resolve)),
  );
  controller.goTo(new Event("navigate"), 100_000, 0, 1 / 64);
  frame();
  for (let step = 0; step < 8; step++) await Promise.resolve();
  expect(resume).toBeTypeOf("function");
  const presentation = bridge.readPresentation.mock.calls.at(-1)![0];
  controller.setBrush(8, 400);
  pointer("pointermove", 511, 128);
  const requestedTool = controller.observe().readiness;
  expect(requestedTool.bounds[2]).toBeGreaterThan(controller.world.bounds()[2]);
  resume({
    ...presentation,
    sequence: 0,
    tiles: [],
    overviews: [],
    overviewKeys: heightOverviewKeys(presentation.bounds, presentation.power),
  });
  await drainView();
  expect(bridge.readRegion.mock.calls.at(-1)![0]).toMatchObject({
    bounds: requestedTool.bounds,
    minLevel: requestedTool.brush.level,
  });
  expect(controller.observe().readiness.ready).toBe(true);
  expect(controller.state.error).toBeNull();
  pointer("pointerdown", 511, 128);
  pointer("pointerup", 511, 128);
  await drainView();
  expect(controller.observe().document!.historyActions).toBe(1);
  controller.destroy();
});

it("releases unused fine numeric source copies while retaining their coarse visible contribution", async () => {
  const { controller, pointer, drainView } = await readyController(1, {
    width: 1024,
    height: 256,
  });
  controller.goTo(new Event("navigate"), 100_000, 0, 1 / 64);
  controller.setBrush(8, 400);
  pointer("pointermove", 100, 128);
  await drainView();
  pointer("pointerdown", 100, 128);
  pointer("pointerup", 100, 128);
  await drainView();
  for (let step = 0; step < 8; step++) await Promise.resolve();
  expect(controller.state.writing).toBe(false);
  expect(fields.at(-1)!.sources.size).toBeGreaterThan(0);
  expect(controller.observe().renderer.sourceBytes).toBeGreaterThan(0);
  const retainedOverview = [...fields.at(-1)!.overviews.values()].find((tile) =>
    tile.values.some((value) => value !== 0),
  )!;
  expect(retainedOverview).toBeDefined();
  const before = retainedOverview.values.slice();

  pointer("pointermove", 950, 128);
  await drainView();
  expect(controller.observe().readiness.ready).toBe(true);
  expect(controller.observe().document!.sourceEntries).toBe(0);
  expect(controller.observe().document!.sourceBytes).toBe(0);
  expect(controller.observe().renderer.sourceBytes).toBe(0);
  expect(fields.at(-1)!.sources.size).toBe(0);
  expect(fields.at(-1)!.overviews.get(retainedOverview.key)!.values).toEqual(
    before,
  );
  expect(controller.state.canUndo).toBe(true);
  controller.destroy();
});

it("rereads both source paths when an acknowledgement has already overtaken their sequence", async () => {
  const { controller, bridge, pointer, drainView } = await readyController(1);
  controller.setBrush(16, 400);
  await drainView();
  pointer("pointerdown");
  pointer("pointerup");
  await drainView();
  expect(controller.observe().document!.sequence).toBe(1);
  bridge.readPresentation.mockImplementationOnce(async (request) => ({
    ...request,
    sequence: 0,
    tiles: [],
    overviews: [],
    overviewKeys: heightOverviewKeys(request.bounds, request.power),
  }));
  const previous = bridge.readPresentation.mock.calls.length;
  controller.setBrush(80, 400);
  controller.goTo(new Event("navigate"), 100_000, 0, 1 / 64);
  await drainView();
  expect(bridge.readPresentation.mock.calls.length - previous).toBe(2);
  bridge.readRegion.mockImplementationOnce(async (request) => ({
    ...request,
    sequence: 0,
    tiles: [],
  }));
  const regions = bridge.readRegion.mock.calls.length;
  controller.setBrush(8, 400);
  await drainView();
  expect(bridge.readRegion.mock.calls.length - regions).toBe(2);
  expect(controller.observe().readiness.ready).toBe(true);
  expect(controller.state.error).toBeNull();
  controller.destroy();
});

it.each(["presentation", "region"] as const)(
  "consumes a %s read atomically before an acknowledgement microtask releases its patches",
  async (purpose) => {
    const { controller, bridge, pointer, drainView } = await readyController(1);
    const point: [number, number] = purpose === "region" ? [10_000, 0] : [0, 0];
    if (purpose === "region") {
      controller.goTo(new Event("navigate"), point[0], point[1], 1 / 16);
      await drainView();
    }
    controller.setBrush(purpose === "region" ? 80 : 32, 400);
    await drainView();
    let acknowledge!: () => void;
    let written!: CommitRequest;
    bridge.commit.mockImplementationOnce(
      (request) =>
        new Promise((resolve) => {
          written = request;
          acknowledge = () =>
            resolve({
              sessionId: request.sessionId,
              sequence: request.sequence,
              transactionId: request.transactionId,
            });
        }),
    );
    pointer("pointerdown");
    pointer("pointerup");
    await drainView();
    expect(bridge.commit).toHaveBeenCalledOnce();
    expect(controller.state.writing).toBe(true);
    const expected = prepareHeightSampler(
      written.patches.flatMap((patch) => (patch.after ? [patch.after] : [])),
    )(...point);
    const sinceEvent = controller.observation.read().length;
    // The store has reached S+1, but this response was captured at S. The ack
    // arrives in the exact microtask gap an async validation-only helper creates.
    bridge.readPresentation.mockImplementation(async (request) => ({
      ...request,
      sequence: 1,
      tiles: [],
      overviews: [],
      overviewKeys: heightOverviewKeys(request.bounds, request.power),
    }));
    bridge.readRegion.mockImplementation(async (request) => ({
      ...request,
      sequence: 1,
      tiles: [],
    }));
    const releaseAck = () => queueMicrotask(() => queueMicrotask(acknowledge));
    if (purpose === "presentation") {
      bridge.readPresentation.mockImplementationOnce((request) => {
        releaseAck();
        return Promise.resolve({
          ...request,
          sequence: 0,
          tiles: [],
          overviews: [],
          overviewKeys: heightOverviewKeys(request.bounds, request.power),
        });
      });
      controller.goTo(new Event("navigate"), 0, 0, 1 / 64);
    } else {
      bridge.readRegion.mockImplementationOnce((request) => {
        releaseAck();
        return Promise.resolve({ ...request, sequence: 0, tiles: [] });
      });
      controller.setBrush(8, 400);
    }
    await drainView();
    for (let step = 0; step < 8; step++) await Promise.resolve();
    const events = controller.observation.read().slice(sinceEvent);
    const consumed = events.findIndex(
      (event) =>
        event.kind === "sources" &&
        (purpose === "presentation"
          ? event.power !== undefined
          : event.power === undefined),
    );
    const acknowledged = events.findIndex(
      (event) => event.kind === "persisted" && event.sequence === 1,
    );
    expect(consumed).toBeGreaterThanOrEqual(0);
    expect(acknowledged).toBeGreaterThan(consumed);
    expect(controller.state.error).toBeNull();
    expect(controller.state.writing).toBe(false);
    expect(controller.observe().readiness.ready).toBe(true);
    expect(controller.state.canUndo).toBe(true);
    if (purpose === "presentation") {
      // The coarse view releases fine authors after their ACK. Verify their
      // exact contribution at a displayed overview sample, not a now-unknown
      // arbitrary fine point that this view intentionally no longer retains.
      expect(controller.observe([point]).samples[0]).toBeNull();
      const overview = [...fields.at(-1)!.overviews.values()].find((tile) =>
        tile.values.some((value) => value !== 0),
      )!;
      expect(overview).toBeDefined();
      const index = overview.values.findIndex((value) => value !== 0);
      const bounds = heightOverviewBounds(overview);
      const samplePoint: [number, number] = [
        bounds[0] + ((index % 128) + 0.5) * 2 ** overview.power,
        bounds[1] + (Math.floor(index / 128) + 0.5) * 2 ** overview.power,
      ];
      const expectedSample = prepareHeightSampler(
        written.patches.flatMap((patch) => (patch.after ? [patch.after] : [])),
      )(...samplePoint);
      expect(
        heightFromScaledSum(overview.values[index] - 100 / HEIGHT_SUM_SCALE),
      ).toBeCloseTo(expectedSample, 10);
    } else
      expect(controller.observe([point]).samples[0]).toBeCloseTo(expected, 10);
    controller.destroy();
  },
);

it("edits a submitted warm local area while the outer presentation read is still pending", async () => {
  const { controller, bridge, frame, pointer } = await readyController(1);
  controller.setBrush(16, 400);
  let resume!: (
    reply: Awaited<ReturnType<typeof bridge.readPresentation>>,
  ) => void;
  bridge.readPresentation.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resume = resolve;
      }),
  );
  controller.goTo(new Event("navigate"), 400, 0, 0.25);
  expect(controller.observe().readiness.ready).toBe(false);
  pointer("pointerdown");
  pointer("pointerup");
  expect(controller.observe().document!.revision).toBe(0);
  frame();
  for (let step = 0; step < 8; step++) await Promise.resolve();
  expect(resume).toBeTypeOf("function");
  // Each background group may prepare one nearest target. Neither these local
  // submissions nor their actual GPU completion depend on the outer read.
  for (let step = 0; step < 8 && !controller.observe().readiness.ready; step++)
    frame(0);
  expect(controller.observe().readiness.ready).toBe(true);
  expect(controller.state.loading).toBe(false);
  pointer("pointerdown");
  pointer("pointerup");
  expect(controller.state.finishing).toBe(true);
  for (let step = 0; step < 6; step++) {
    frame();
    await Promise.resolve();
  }
  expect(controller.observe().readiness.ready).toBe(true);
  expect(controller.state.loading).toBe(false);
  expect(bridge.commit).toHaveBeenCalledOnce();
  controller.destroy();
  const request = bridge.readPresentation.mock.calls.at(-1)![0];
  resume({
    ...request,
    sequence: 0,
    tiles: [],
    overviews: [],
    overviewKeys: heightOverviewKeys(request.bounds, request.power),
  });
  for (let step = 0; step < 8; step++) await Promise.resolve();
});

it("shows an initial read failure and recovers through the ordinary retry without an early edit", async () => {
  const { controller, pointer, drainView } = await readyController(1, {
    ready: false,
    readFailure: true,
  });
  expect(controller.state.error).toBe("Lokaler Lesefehler");
  expect(controller.state.loading).toBe(true);
  pointer("pointerdown");
  pointer("pointerup");
  expect(controller.observe().document!.revision).toBe(0);
  const retryPreparation = vi.spyOn(controller.world, "retryPreparation");
  controller.retryLoad();
  expect(retryPreparation).toHaveBeenCalledOnce();
  await drainView();
  expect(controller.state.error).toBeNull();
  expect(controller.observe().readiness.ready).toBe(true);
  expect(controller.observe().document!.revision).toBe(0);
  pointer("pointerdown");
  pointer("pointerup");
  await drainView();
  expect(controller.observe().document!.historyActions).toBe(1);
  controller.destroy();
});

it("seals a held stroke on resize and finishes at its accepted world point", async () => {
  const { controller, pointer, resize, frame, drainView, drainAction } =
    await readyController();
  controller.setBrush(16, 400);
  await drainView();
  pointer("pointerdown", 32, 32);
  expect(controller.observe().document!.revision).toBe(0);
  resize(128);
  expect(controller.state.finishing).toBe(true);
  await drainAction();
  expect(controller.observe().gesture).toBeNull();
  expect(
    controller.observe([
      [0, 0],
      [-128, 0],
    ]).samples[0],
  ).toBeGreaterThan(-100);
  expect(
    controller.observe([
      [0, 0],
      [-128, 0],
    ]).samples[1],
  ).toBe(-100);
  await drainView();
  frame(500);
  expect(controller.observe().document!.historyActions).toBe(1);
  expect(controller.state.needsPress).toBe(true);
  pointer("pointerup", 32, 32);
  pointer("pointerdown", 32, 32);
  pointer("pointerup", 32, 32);
  await drainAction();
  expect(controller.observe().document!.historyActions).toBe(2);
  expect(controller.observe([[-128, 0]]).samples[0]).toBeGreaterThan(-100);
  controller.destroy();
});

it("projects fine source changes into a certified empty overview exactly once, including history", async () => {
  const { document, world, field, frame } = await readyRenderer({
    width: 1,
    height: 1,
    x: 32,
    y: 32,
    scale: 1 / 64,
  });
  const key = heightOverviewKey(6, 0, 0);
  const rendered = () =>
    heightFromScaledSum(
      -100 / HEIGHT_SUM_SCALE + (field.overviews.get(key)?.values[0] ?? 0),
    );
  document.beginGesture({ level: 0, radius: 20, amount: 400 });
  const first = document.applySegment([32, 32], [32, 32], 1000)!;
  world.updateSourcePatches(first.patches);
  world.invalidate(first.bounds);
  prepareSources(world);
  frame();
  expect(rendered()).toBeCloseTo(document.sampleHeight(32, 32), 10);
  const second = document.applySegment([48, 32], [48, 32], 1000)!;
  world.updateSourcePatches(second.patches);
  world.invalidate(second.bounds);
  prepareSources(world);
  frame();
  expect(rendered()).toBeCloseTo(document.sampleHeight(32, 32), 10);
  expect(
    second.patches.every(
      (patch) => patch.after!.values.byteLength === HEIGHT_TILE_BYTES,
    ),
  ).toBe(true);
  document.finishGesture();
  const undone = document.undo()!;
  world.updateSourcePatches(undone.patches);
  for (const bounds of undone.dirtyBounds) world.invalidate(bounds);
  prepareSources(world);
  frame();
  expect(rendered()).toBeCloseTo(-100, 10);
  const redone = document.redo()!;
  world.updateSourcePatches(redone.patches);
  for (const bounds of redone.dirtyBounds) world.invalidate(bounds);
  prepareSources(world);
  frame();
  expect(rendered()).toBeCloseTo(document.sampleHeight(32, 32), 10);
});

// Controller regressions use the real author model and presentation readiness.
// Only the existing GL boundary is mocked; reservation and completion are distinct.
it.each([16, 512])(
  "reserves the final %ipx Up point before RAF and finishes it once with one Undo",
  async (diameter) => {
    const {
      controller,
      bridge,
      pointer,
      frame,
      advance,
      drainView,
      drainAction,
    } = await readyController(0, { width: 1180, height: 894 });
    controller.setBrush(diameter, 4000);
    await drainView();
    const endX = diameter === 512 ? 690 : 290;
    const endpoint: [number, number] = [(endX - 590) / 0.25, -300];
    pointer("pointerdown", 190, 372);
    advance(24);
    pointer("pointermove", endX - 40, 372);
    pointer("pointerup", endX, 372);
    const sealed = controller.observe([endpoint]);
    expect(sealed.document!.revision).toBe(0);
    expect(sealed.state.finishing).toBe(true);
    expect(sealed.document!.brushWork!.pendingPoints).toBe(3);
    expect(
      sealed.events.filter((event) => event.kind === "brush-accepted").at(-1),
    ).toMatchObject({
      cause: "terminal",
      to: endpoint,
      end: true,
      pointCount: 1,
    });
    expect(bridge.commit).not.toHaveBeenCalled();
    await drainAction();
    const complete = controller.observe([endpoint]);
    expect(complete.samples[0]).toBeGreaterThan(-100);
    expect(complete.document!.historyActions).toBe(1);
    expect(bridge.commit).toHaveBeenCalledOnce();
    const stored = prepareHeightSampler(
      bridge.commit.mock.calls[0][0].patches.flatMap((patch) =>
        patch.after ? [patch.after] : [],
      ),
    );
    expect(stored(...endpoint)).toBeCloseTo(complete.samples[0]!, 10);
    await drainView();
    frame(1000);
    expect(controller.observe([endpoint]).samples).toEqual(complete.samples);
    expect(controller.observe().document!.revision).toBe(
      complete.document!.revision,
    );
    controller.undo();
    await drainView();
    expect(controller.observe([endpoint]).samples[0]).toBe(-100);
    expect(controller.observe().document!.historyActions).toBe(1);
    expect(controller.state.canUndo).toBe(false);
    expect(controller.state.canRedo).toBe(true);
    controller.destroy();
  },
);

it("keeps a frozen GPU stand while newer accepted work advances and releases only its own receipt", async () => {
  const { controller, pointer, frame, advance, drainView, drainAction } =
    await readyController();
  controller.setBrush(16, 400);
  await drainView();
  pointer("pointerdown", 20, 20);
  frame(0);
  const gl = controller.world.renderer.gl;
  const wait = vi
    .spyOn(gl, "clientWaitSync")
    .mockReturnValue(gl.TIMEOUT_EXPIRED);
  const frozen = controller.observation
    .read()
    .find((event) => event.kind === "brush-frozen")!;
  const revision = controller.observe().document!.revision;
  const frameId = controller.observe().renderer.lastSubmittedFrame;
  advance(16);
  pointer("pointermove", 48, 20);
  frame(0);
  advance(16);
  pointer("pointermove", 56, 20);
  frame(0);
  expect(controller.observe().document!.revision).toBeGreaterThan(revision);
  expect(controller.observe().renderer.lastSubmittedFrame).toBe(frameId);
  expect(controller.observe().renderer.queuedSourceTiles).toBeGreaterThan(0);
  expect(controller.observe().readiness.ready).toBe(true);
  wait.mockReturnValue(gl.ALREADY_SIGNALED);
  pointer("pointerup", 56, 20);
  const feedback = controller.observation
    .read()
    .filter((event) => event.kind === "brush-feedback" && event.accepted);
  expect(feedback).toHaveLength(1);
  expect(feedback[0]).toMatchObject({
    revision,
    renderReceipt: frozen.renderReceipt,
  });
  await drainAction();
  await drainView();
  expect(
    controller
      .observe([
        [0, -48],
        [96, -48],
      ])
      .samples.every((value) => value! > -100),
  ).toBe(true);
  expect(
    wait.mock.calls.every(([, flags, timeout]) => flags === 0 && timeout === 0),
  ).toBe(true);
  controller.destroy();
});

it.each(["pointerup", "pointercancel", "blur"])(
  "seals accepted work at %s and creates no new contribution during finishing",
  async (end) => {
    const { controller, pointer, frame, advance, drainView, drainAction } =
      await readyController();
    controller.setBrush(16, 400);
    await drainView();
    pointer("pointerdown", 20, 20);
    frame(0);
    advance(16);
    pointer("pointermove", 40, 20);
    advance(200);
    if (end === "blur") window.dispatchEvent(new Event("blur"));
    else pointer(end, 40, 20);
    const admissions = controller.observation
      .read()
      .filter((event) => event.kind === "brush-accepted");
    expect(
      admissions.filter((event) => event.cause === "terminal"),
    ).toHaveLength(end === "pointerup" ? 1 : 0);
    expect(controller.state.finishing).toBe(true);
    await drainAction();
    const complete = controller.observe([
      [-48, -48],
      [32, -48],
    ]);
    expect(complete.samples.every((value) => value! > -100)).toBe(true);
    expect(complete.document!.historyActions).toBe(1);
    frame(1000);
    frame(1000);
    const after = controller.observe([
      [-48, -48],
      [32, -48],
    ]);
    expect(after.gesture).toBeNull();
    expect(after.samples).toEqual(complete.samples);
    expect(after.document!.revision).toBe(complete.document!.revision);
    expect(
      after.events.filter((event) => event.kind === "brush-accepted"),
    ).toHaveLength(admissions.length);
    controller.destroy();
  },
);

/** Same physical motion and 60Hz rendering, with independent pointer delivery. */
async function timedControllerStroke(
  inputHz: 30 | 60 | 120,
  durationMs = 1000,
  corner = false,
) {
  const {
    drainView,
    drainAction,
    controller,
    bridge,
    pointer,
    frame,
    advance,
  } = await readyController(0, { width: 256, height: 128 });
  controller.setBrush(64, 400);
  await drainView();
  pointer("pointerdown", 64, 64);
  frame(0);
  const ticks = (durationMs * 120) / 1000;
  for (let tick = 1; tick <= ticks; tick++) {
    advance(1000 / 120);
    if (tick % (120 / inputHz) === 0)
      pointer(
        "pointermove",
        64 + (128 * tick) / ticks,
        64 - (corner ? 64 * Math.min(tick / ticks, 1 - tick / ticks) : 0),
      );
    if (tick % 2 === 0) frame(0);
  }
  // Every replay remains physically held for the same final frame. This isolates
  // dose rate from the separately tested Move→Up boundary between frames.
  frame(1000 / 60);
  pointer("pointerup", 192, 64);
  await drainAction();
  await drainView();
  const observed = controller.observe([
    [-128, 0],
    [0, corner ? -128 : 0],
    [128, 0],
  ]);
  expect(observed.renderer.submittedRevision).toBe(observed.document!.revision);
  expect(controller.state.error).toBeNull();
  const intervals = observed.events.filter(
    (event) => event.kind === "brush-accepted" && event.cause !== "press",
  );
  await Promise.resolve();
  expect(bridge.commit).toHaveBeenCalledOnce();
  const mass = bridge.commit.mock.calls[0][0].patches.reduce(
    (sum, patch) =>
      sum +
      (patch.after?.values.reduce((total, value) => total + value, 0) ?? 0),
    0,
  );
  controller.destroy();
  return {
    mass,
    heights: observed.samples.map((height) => height! + 100),
    acceptedMs: intervals.reduce(
      (sum, event) => sum + Number(event.offeredElapsedMs),
      0,
    ),
  };
}

it("keeps stroke strength tied to elapsed time for 30, 60 and 120Hz pointer delivery", async () => {
  const results = [];
  for (const inputHz of [30, 60, 120] as const)
    results.push(await timedControllerStroke(inputHz));
  for (const result of results)
    expect(result.acceptedMs).toBeCloseTo(1000 + 1000 / 60, 7);
  const masses = results.map((result) => result.mass);
  expect(Math.max(...masses) / Math.min(...masses)).toBeLessThan(1.01);
  for (let index = 0; index < 3; index++) {
    const heights = results.map((result) => result.heights[index]);
    expect(Math.min(...heights)).toBeGreaterThan(0);
    expect(Math.max(...heights) / Math.min(...heights)).toBeLessThan(1.05);
  }
});

it("makes the same drawn path stronger when moved more slowly", async () => {
  const fast = await timedControllerStroke(60, 600);
  const slow = await timedControllerStroke(60, 1200);
  for (let index = 0; index < 3; index++)
    expect(slow.heights[index] / fast.heights[index]).toBeCloseTo(2, 1);
});

it("keeps a timed corner comparable across 30, 60 and 120Hz pointer delivery", async () => {
  const results = [];
  for (const inputHz of [30, 60, 120] as const)
    results.push(await timedControllerStroke(inputHz, 1000, true));
  for (const result of results)
    expect(result.acceptedMs).toBeCloseTo(1000 + 1000 / 60, 7);
  const masses = results.map((result) => result.mass);
  expect(Math.max(...masses) / Math.min(...masses)).toBeLessThan(1.01);
  for (let index = 0; index < 3; index++) {
    const heights = results.map((result) => result.heights[index]);
    expect(Math.min(...heights)).toBeGreaterThan(0);
    expect(Math.max(...heights) / Math.min(...heights)).toBeLessThan(1.05);
  }
});

it("preserves the whole stalled path while capping only its offered time", async () => {
  const { controller, pointer, frame, advance, drainView, drainAction } =
    await readyController(0, { width: 256, height: 128 });
  controller.setBrush(16, 400);
  await drainView();
  pointer("pointerdown", 48, 64);
  frame(0);
  advance(250);
  pointer("pointermove", 208, 64);
  pointer("pointerup", 208, 64);
  await drainAction();
  const complete = controller.observe([
    [0, 0],
    [320, 0],
  ]);
  expect(complete.samples.every((height) => height! > -100)).toBe(true);
  const move = complete.events.find(
    (event) => event.kind === "brush-accepted" && event.cause === "move",
  )!;
  expect(move).toMatchObject({
    from: [-320, 0],
    to: [320, 0],
    offeredElapsedMs: 50,
    rawElapsedMs: 250,
  });
  frame(1000);
  expect(
    controller.observe([
      [0, 0],
      [320, 0],
    ]).samples,
  ).toEqual(complete.samples);
  controller.destroy();
});

/** Direct C1 author reference for the same finite polyline, independent of DOM delivery. */
function prepaidReference(
  brush: import("../model").HeightBrush,
  points: [number, number][],
  time: import("../model").HeightSegment[],
) {
  const reference = new EditorDocument("controller-c1-reference", {
    empty: true,
  });
  reference.beginPrepaidGesture(brush, {
    sessionId: reference.sessionId,
    gestureId: 1,
    viewId: 1,
    preparationId: 1,
  });
  reference.admitBrushBatch({
    admissionId: 1,
    path: { from: points[0], points, end: true },
    time,
    pointCount: points.length,
  });
  reference.sealBrushGesture();
  for (let count = 0; count < 200 && reference.active; count++)
    reference.advanceBrushGesture();
  expect(reference.active).toBe(false);
  expect(reference.metrics.historyActions).toBe(1);
  return reference;
}

it.each([
  [16, false],
  [512, false],
  [16, true],
  [512, true],
] as const)(
  "keeps the complete %ipx corner and dwell during normal pending drawing (browser coalescing: %s)",
  async (diameter, coalesced) => {
    const width = diameter === 16 ? 256 : 1200;
    const height = diameter === 16 ? 256 : 1000;
    const offset = diameter === 16 ? 64 : 200;
    const {
      controller,
      bridge,
      pointer,
      advance,
      frame,
      drainView,
      drainAction,
    } = await readyController(0, { width, height });
    controller.setBrush(diameter, 400);
    pointer("pointermove", width / 2 - offset, height / 2);
    await drainView();
    const from: [number, number] = [-offset * 4, 0];
    const corner: [number, number] = [0, -offset * 4];
    const to: [number, number] = [offset * 4, 0];
    const probes: [number, number][] = [corner, [0, 0], from, to];
    const reference = prepaidReference(
      controller.currentBrush(),
      [from, corner, to],
      [
        { from, to: corner, elapsedMs: 8 },
        { from: corner, to, elapsedMs: 8 },
        { from: to, to, elapsedMs: 16 },
      ],
    );

    expect(controller.observe().readiness.ready).toBe(true);
    pointer("pointerdown", width / 2 - offset, height / 2);
    if (coalesced) {
      advance(16);
      pointer(
        "pointermove",
        width / 2 + offset,
        height / 2,
        performance.now(),
        [
          { x: width / 2, y: height / 2 - offset, at: performance.now() - 8 },
          { x: width / 2 + offset, y: height / 2, at: performance.now() },
        ],
      );
    } else {
      advance(8);
      pointer("pointermove", width / 2, height / 2 - offset);
      advance(8);
      pointer("pointermove", width / 2 + offset, height / 2);
    }
    frame(0);
    frame(16);
    pointer("pointerup", width / 2 + offset, height / 2);
    await drainAction();
    await drainView();

    expect(controller.state.error).toBeNull();
    expect(controller.world.fault).toBe("none");
    expect(bridge.commit).toHaveBeenCalledOnce();
    const actual = prepareHeightSampler(
      bridge.commit.mock.calls[0][0].patches.flatMap((patch) =>
        patch.after ? [patch.after] : [],
      ),
    );
    for (const point of probes)
      expect(actual(...point)).toBeCloseTo(
        reference.sampleHeight(...point),
        10,
      );
    const observed = controller.observe();
    expect(observed.document!.historyActions).toBe(1);
    expect(observed.renderer.submittedRevision).toBe(
      observed.document!.revision,
    );
    expect(
      observed.events.filter((event) => event.kind === "brush-discard"),
    ).toHaveLength(0);
    const time = evaluateBrushTime(
      observed.events,
      observed.events
        .filter((event) => event.kind === "input")
        .map((event) => event.id),
      observed.sessionId,
    );
    expect(time.passed).toBe(true);
    expect(
      observed.events
        .filter((event) => event.kind === "brush-accepted")
        .reduce((sum, event) => sum + Number(event.offeredElapsedMs), 0),
    ).toBe(32);
    expect(
      observed.events.filter(
        (event) => event.kind === "noop" && event.reason === "coalesced",
      ),
    ).toHaveLength(0);
    controller.destroy();
  },
);

it("rejects an oversized input window before acceptance and finishes every earlier reservation", async () => {
  const { controller, pointer, frame, advance, drainView, drainAction } =
    await readyController();
  controller.setBrush(16, 400);
  await drainView();
  pointer("pointerdown", 20, 20);
  frame(0);
  advance(16);
  pointer("pointermove", 40, 20);
  const accepted = controller.observation
    .read()
    .filter((event) => event.kind === "brush-accepted").length;
  advance(16);
  pointer(
    "pointermove",
    56,
    20,
    performance.now(),
    Array.from({ length: MAX_BRUSH_POINTS }, (_, index) => ({
      x: 40 + index / 8,
      y: 20,
      at: performance.now(),
    })),
  );
  expect(controller.state.error).toContain("offene Pinselpunkte");
  expect(controller.state.finishing).toBe(true);
  expect(
    controller.observation
      .read()
      .filter((event) => event.kind === "brush-accepted"),
  ).toHaveLength(accepted);
  await drainAction();
  expect(controller.observe([[32, -48]]).samples[0]).toBeGreaterThan(-100);
  expect(controller.observe().document!.historyActions).toBe(1);
  expect(controller.state.needsPress).toBe(true);
  pointer("pointermove", 52, 20);
  frame(500);
  expect(controller.observe().document!.historyActions).toBe(1);
  pointer("pointerup", 52, 20);
  await drainView();
  pointer("pointerdown", 52, 20);
  pointer("pointerup", 52, 20);
  await drainAction();
  expect(controller.observe().document!.historyActions).toBe(2);
  controller.destroy();
});

it("reserves the terminal slot after 127 coalesced pending points", async () => {
  const { controller, pointer, frame, advance, drainView, drainAction } =
    await readyController(0, { width: 512, height: 128 });
  controller.setBrush(16, 400);
  await drainView();
  pointer("pointerdown", 64, 64);
  frame(0);
  advance(50);
  const at = performance.now();
  const points = Array.from({ length: 127 }, (_, i) => ({
    x: 64 + (256 * (i + 1)) / 127,
    y: 64 + (i % 2 ? 1 : -1),
    at: at - 50 + (50 * (i + 1)) / 127,
  }));
  pointer("pointermove", 320, 64, at, points);
  expect(controller.observe().document!.brushWork!.pendingPoints).toBe(127);
  pointer("pointerup", 336, 64, at);
  expect(controller.observe().document!.brushWork!.pendingPoints).toBe(128);
  expect(controller.state.error).toBeNull();
  await drainAction();
  const complete = controller.observe([
    [-768, 0],
    [-256, 0],
    [320, 0],
  ]);
  expect(complete.samples.every((value) => value! > -100)).toBe(true);
  expect(complete.document!.historyActions).toBe(1);
  expect(
    complete.events
      .filter((event) => event.kind === "brush-accepted")
      .map((event) => event.pointCount),
  ).toEqual([1, 127, 1]);
  controller.destroy();
});

it.each(["sources", "outside", "partial"] as const)(
  "validates every coalesced corner before accepting its path (%s)",
  async (kind) => {
    const {
      drainView,
      drainAction,
      controller,
      pointer,
      advance,
      frame,
      bridge,
    } = await readyController(0, { width: 256, height: 256 });
    controller.setBrush(16, 400);
    await drainView();
    pointer("pointerdown", 64, 128);
    frame(0);
    if (kind === "sources") {
      const doc = controller["doc"];
      const ready = doc.isReady.bind(doc);
      vi.spyOn(doc, "isReady").mockImplementation(
        (bounds, levels) => bounds[1] >= -200 && ready(bounds, levels),
      );
    }
    advance(16);
    pointer("pointermove", 192, 128, performance.now(), [
      {
        x: 128,
        y: kind === "sources" ? 64 : kind === "outside" ? -50 : -4,
        at: performance.now() - 8,
      },
      { x: 192, y: 128, at: performance.now() },
    ]);
    expect(controller.state.error).toBeNull();
    expect(controller.observe().document!.revision).toBe(1);
    expect(controller.state.finishing).toBe(kind !== "partial");
    const moves = controller.observation
      .read()
      .filter(
        (event) => event.kind === "brush-accepted" && event.cause === "move",
      );
    expect(moves).toHaveLength(kind === "partial" ? 1 : 0);
    pointer("pointerup", 192, 128);
    await drainAction();
    expect(bridge.commit).toHaveBeenCalledOnce();
    controller.destroy();
  },
);

it("reuses already submitted terrain once the sealed action actually completes", async () => {
  const {
    controller,
    pointer,
    frame,
    advance,
    bridge,
    drainView,
    drainAction,
  } = await readyController();
  controller.setBrush(16, 400);
  await drainView();
  pointer("pointerdown", 20, 20);
  frame(0);
  const submit = controller.observation
    .read()
    .filter((event) => event.kind === "submit")
    .at(-1)!;
  advance(4);
  pointer("pointerup", 20, 20);
  expect(
    controller.observation.read().some((event) => event.kind === "commit"),
  ).toBe(false);
  expect(controller.state.finishing).toBe(true);
  await drainAction();
  const events = controller.observation.read();
  const commit = events.find((event) => event.kind === "commit")!;
  expect(events.filter((event) => event.kind === "edit-submit")).toMatchObject([
    {
      frame: submit.frame,
      revision: submit.revision,
      submittedAt: submit.at,
      completedAt: commit.at,
    },
  ]);
  expect(
    events.filter((event) => event.kind === "brush-interval"),
  ).toHaveLength(1);
  expect(controller.observe().document!.historyActions).toBe(1);
  expect(bridge.commit).toHaveBeenCalledOnce();
  controller.destroy();
});

it("keeps release unconfirmed until its accepted author work actually draws", async () => {
  const { controller, pointer, frame, advance, drainView, drainAction } =
    await readyController();
  controller.setBrush(16, 400);
  await drainView();
  controller.world.fault = "drop-render";
  pointer("pointerdown", 20, 20);
  advance(4);
  pointer("pointerup", 20, 20);
  await drainAction();
  expect(
    controller.observation
      .read()
      .filter((event) => event.kind === "edit-submit"),
  ).toHaveLength(0);
  expect(controller.observe().document!.historyActions).toBe(1);
  controller.world.fault = "none";
  frame(16);
  const events = controller.observation.read();
  const submit = events.filter((event) => event.kind === "submit").at(-1)!;
  expect(events.filter((event) => event.kind === "edit-submit")).toMatchObject([
    { frame: submit.frame, submittedAt: submit.at, completedAt: submit.at },
  ]);
  expect(
    events.filter((event) => event.kind === "brush-interval"),
  ).toHaveLength(1);
  controller.destroy();
});

it("preserves an accepted corner when the GPU completes between input events", async () => {
  const {
    controller,
    bridge,
    pointer,
    frame,
    advance,
    drainView,
    drainAction,
  } = await readyController(0, { width: 256, height: 256 });
  controller.setBrush(16, 400);
  await drainView();
  pointer("pointerdown", 64, 128);
  frame(0);
  const gl = controller.world.renderer.gl;
  const wait = vi
    .spyOn(gl, "clientWaitSync")
    .mockReturnValue(gl.TIMEOUT_EXPIRED);
  advance(8);
  pointer("pointermove", 128, 64);
  expect(controller.observe().document!.revision).toBe(1);
  expect(controller.observe().renderer.gpuPending).toBe(true);
  wait.mockReturnValue(gl.ALREADY_SIGNALED);
  advance(8);
  pointer("pointermove", 192, 128);
  expect(controller.observe().document!.brushWork!.pendingPoints).toBe(2);
  pointer("pointerup", 192, 128);
  await drainAction();
  expect(bridge.commit).toHaveBeenCalledOnce();
  const reference = prepaidReference(
    controller.currentBrush(),
    [
      [-256, 0],
      [0, -256],
      [256, 0],
    ],
    [
      { from: [-256, 0], to: [0, -256], elapsedMs: 8 },
      { from: [0, -256], to: [256, 0], elapsedMs: 8 },
    ],
  );
  const actual = prepareHeightSampler(
    bridge.commit.mock.calls[0][0].patches.flatMap((patch) =>
      patch.after ? [patch.after] : [],
    ),
  );
  for (const point of [
    [-256, 0],
    [0, -256],
    [0, 0],
    [256, 0],
  ] as const)
    expect(actual(point[0], point[1])).toBeCloseTo(
      reference.sampleHeight(point[0], point[1]),
      10,
    );
  expect(
    wait.mock.calls.every(([, flags, timeout]) => flags === 0 && timeout === 0),
  ).toBe(true);
  controller.destroy();
});

it("bounds unseen held effect locally during GPU timeout without dropping a newly entered path", async () => {
  const { controller, pointer, frame, advance, drainView, drainAction } =
    await readyController();
  controller.setBrush(16, 400);
  await drainView();
  pointer("pointerdown", 20, 20);
  frame(0);
  const gl = controller.world.renderer.gl;
  const wait = vi
    .spyOn(gl, "clientWaitSync")
    .mockReturnValue(gl.TIMEOUT_EXPIRED);
  const submitted = controller.observe().renderer.lastSubmittedFrame;
  for (let i = 0; i < 8; i++) {
    frame(50);
    const work = controller.observe().document!.brushWork!;
    expect(work.maxOutstandingEffect).toBeLessThanOrEqual(
      work.effectLimit + 1e-9,
    );
  }
  const held = controller.observe([[-48, -48]]).samples;
  frame(1000);
  expect(controller.observe([[-48, -48]]).samples).toEqual(held);
  advance(16);
  pointer("pointermove", 56, 20);
  pointer("pointerup", 56, 20);
  await drainAction();
  const complete = controller.observe([
    [0, -48],
    [96, -48],
  ]);
  expect(complete.samples.every((value) => value! > -100)).toBe(true);
  expect(complete.renderer.lastSubmittedFrame).toBe(submitted);
  expect(complete.document!.historyActions).toBe(1);
  wait.mockReturnValue(gl.ALREADY_SIGNALED);
  await drainView();
  expect(
    controller.observe([
      [0, -48],
      [96, -48],
    ]).samples,
  ).toEqual(complete.samples);
  expect(
    wait.mock.calls.every(([, flags, timeout]) => flags === 0 && timeout === 0),
  ).toBe(true);
  controller.destroy();
});

it.each(["pointerdown", "pointermove", "pointerup"])(
  "reports a failed fence during %s without accepting another path or losing prior work",
  async (type) => {
    const { controller, bridge, pointer, frame, drainView, drainAction } =
      await readyController();
    controller.setBrush(16, 400);
    await drainView();
    pointer("pointerdown", 20, 20);
    if (type === "pointerdown") pointer("pointerup", 20, 20);
    frame(0);
    const accepted = controller.observation
      .read()
      .filter((event) => event.kind === "brush-accepted").length;
    const gl = controller.world.renderer.gl;
    vi.spyOn(gl, "clientWaitSync").mockReturnValueOnce(gl.WAIT_FAILED);
    pointer(type, 56, 56);
    expect(controller.state.error).toContain("Grafikabschluss");
    expect(controller.observe().renderer.gpuPending).toBe(true);
    expect(
      controller.observation
        .read()
        .filter((event) => event.kind === "brush-accepted"),
    ).toHaveLength(accepted);
    pointer("pointerup", 20, 20);
    await drainAction();
    await drainView();
    expect(controller.observe().document!.historyActions).toBe(1);
    expect(bridge.commit).toHaveBeenCalledOnce();
    expect(controller.observe([[-48, -48]]).samples[0]).toBeGreaterThan(-100);
    controller.destroy();
  },
);

it("seals input on context loss, finishes accepted work, and invalidates its old receipt", async () => {
  const {
    controller,
    canvas,
    pointer,
    frame,
    advance,
    drainView,
    drainAction,
  } = await readyController();
  controller.setBrush(16, 400);
  await drainView();
  pointer("pointerdown", 20, 20);
  frame(0);
  const frozen = controller.observation
    .read()
    .find((event) => event.kind === "brush-frozen")!;
  advance(16);
  pointer("pointermove", 48, 20);
  canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
  expect(
    controller.world.inspectRenderReceipt(
      frozen.renderReceipt as import("./WorldRenderer").FrozenRenderReceipt,
    ),
  ).toBe("invalid");
  frame(0);
  await drainAction();
  const complete = controller.observe([
    [-48, -48],
    [64, -48],
  ]);
  expect(complete.samples.every((value) => value! > -100)).toBe(true);
  expect(complete.document!.historyActions).toBe(1);
  expect(complete.gesture).toBeNull();
  canvas.dispatchEvent(new Event("webglcontextrestored"));
  pointer("pointerup", 48, 20);
  await drainView();
  frame(1000);
  expect(
    controller.observe([
      [-48, -48],
      [64, -48],
    ]).samples,
  ).toEqual(complete.samples);
  expect(controller.observe().document!.revision).toBe(
    complete.document!.revision,
  );
  controller.destroy();
});

it.each(["destroy", "replacement"] as const)(
  "invalidates unfinished old-session work and rejects a waiting Save after %s",
  async (ending) => {
    const { controller, bridge, pointer, frame } = await readyController();
    pointer("pointerdown", 20, 20);
    pointer("pointermove", 40, 20);
    const oldDocument = controller["doc"];
    const save = controller.save();
    const rejected = expect(save).rejects.toThrow("beendet");
    expect(controller.state.finishing).toBe(true);
    if (ending === "destroy") controller.destroy();
    else
      controller["setProject"]({
        ...(await bridge.status()),
        sessionId: "replacement",
      });
    await rejected;
    expect(oldDocument.disposed).toBe(true);
    const revision = oldDocument.revision;
    oldDocument.advanceBrushGesture();
    frame(1000);
    expect(oldDocument.revision).toBe(revision);
    expect(oldDocument.active).toBe(false);
    expect(bridge.saveProject).not.toHaveBeenCalled();
    expect(bridge.commit).not.toHaveBeenCalled();
    if (ending === "replacement") controller.destroy();
  },
);

it("waits for accepted terminal work before Undo and restores the entire action", async () => {
  const { controller, bridge, pointer, advance, drainView, drainAction } =
    await readyController();
  pointer("pointerdown", 12, 20);
  advance(16);
  pointer("pointermove", 32, 20);
  pointer("pointerup", 52, 20);
  controller.undo();
  expect(controller.observe().document!.sequence).toBe(0);
  await drainAction();
  await drainView();
  expect(
    controller.observe([
      [-80, -48],
      [0, -48],
      [80, -48],
    ]).samples,
  ).toEqual([-100, -100, -100]);
  expect(controller.observe().document!.historyActions).toBe(1);
  expect(controller.state.canUndo).toBe(false);
  expect(controller.state.canRedo).toBe(true);
  expect(bridge.commit).toHaveBeenCalledTimes(2);
  expect(bridge.commit.mock.calls.map(([request]) => request.sequence)).toEqual(
    [1, 2],
  );
  controller.destroy();
});

it("waits for accepted terminal work before Save and preserves its endpoint on reopen", async () => {
  const { controller, bridge, pointer, advance, drainAction } =
    await readyController();
  bridge.saveProject.mockImplementation(
    async (request: import("../bridge").SaveRequest) => ({
      ...request,
      savedSequence: request.sequence,
      path: "/tmp/complete-r2.atlas",
    }),
  );
  pointer("pointerdown", 12, 20);
  advance(16);
  pointer("pointermove", 32, 20);
  pointer("pointerup", 52, 20);
  const save = controller.save();
  expect(bridge.saveProject).not.toHaveBeenCalled();
  expect(controller.state.finishing).toBe(true);
  await drainAction();
  await save;
  expect(bridge.commit).toHaveBeenCalledOnce();
  expect(bridge.saveProject).toHaveBeenCalledWith({
    sessionId: "shared-frame",
    sequence: 1,
    saveAs: false,
  });
  expect(controller.state.saved).toBe(true);
  const reopened = new EditorDocument("reopened", { empty: true, sequence: 1 });
  reopened.acceptCoverage(
    [-512, -512, 512, 512],
    bridge.commit.mock.calls[0][0].patches.flatMap((patch) =>
      patch.after ? [patch.after] : [],
    ),
    1,
    reopened.sessionId,
  );
  const points: [number, number][] = [
    [-80, -48],
    [0, -48],
    [80, -48],
  ];
  expect(points.map((point) => reopened.sampleHeight(...point))).toEqual(
    controller.observe(points).samples,
  );
  expect(reopened.sampleHeight(80, -48)).toBeGreaterThan(-100);
  controller.destroy();
});

it("R3 adopts source snapshots only in individually budgeted preparation steps", async () => {
  const { world, field } = await readyRenderer();
  const snapshots = heightTilesFromControls(0, [
    [1000, 0, 1],
    [1064, 0, 2],
    [1128, 0, 3],
  ]);
  const install = vi.spyOn(world["field"], "updateSources");
  world.updatePresentation(snapshots, [], []);
  expect(install).not.toHaveBeenCalled();
  world.pollCompletion();
  world.moveCamera({ ...world.camera, x: world.camera.x + 1 });
  expect(install).not.toHaveBeenCalled();
  expect(world["drainSources"](performance.now() - 1, 10)).toBe(0);
  expect(install).not.toHaveBeenCalled();
  expect(world["drainSources"](Infinity, 1)).toBe(1);
  expect(install).toHaveBeenCalledTimes(1);
  expect(install.mock.calls[0][0]).toHaveLength(1);
  expect(
    snapshots.filter((source) => field.sources.has(source.key)),
  ).toHaveLength(1);
  expect(world["drainSources"](Infinity, 2)).toBe(2);
  for (const source of snapshots)
    expect(field.sources.get(source.key)?.values).toEqual(source.values);
  world.destroy();
});

it("R3 publishes complete overview snapshots and coalesces changes across superseded preparation", async () => {
  const { world } = await readyRenderer({
    width: 1,
    height: 1,
    x: 32,
    y: 32,
    scale: 1 / 64,
  });
  const key = heightOverviewKey(6, 0, 0);
  const overview = (value: number): HeightOverviewTile => ({
    key,
    power: 6,
    tileX: 0,
    tileY: 0,
    values: new Float64Array(128 * 128).fill(value),
  });
  const first = overview(10);
  world.updatePresentation([], [first], [key]);
  expect(world["drainSources"](Infinity, 1)).toBe(1);
  expect(world["overviews"].has(key)).toBe(false);
  const replacement = overview(20);
  world.updatePresentation([], [replacement], [key]);
  expect(world["drainSources"](Infinity, 1)).toBe(1);
  expect(world["overviews"].has(key)).toBe(false);
  const drain = () => {
    for (
      let step = 0;
      step < 1000 &&
      (world["queuedSources"].size || world["queuedOverviews"].size);
      step++
    )
      expect(world["drainSources"](Infinity, 1)).toBe(1);
    expect(world["queuedSources"].size).toBe(0);
    expect(world["queuedOverviews"].size).toBe(0);
  };
  drain();
  expect(world["overviews"].get(key)?.values).toEqual(replacement.values);
  const before = heightTilesFromControls(0, [[6, 6, 90]])[0];
  const after = heightTilesFromControls(0, [[6, 6, 180]])[0];
  world.updateSourcePatches([{ key: before.key, before: null, after: before }]);
  world["drainSources"](Infinity, 1);
  expect(world["overviews"].get(key)?.values).toEqual(replacement.values);
  world.updateSourcePatches([{ key: after.key, before, after }]);
  drain();
  const sample = prepareHeightSampler([after]);
  const result = world["overviews"].get(key)!;
  for (const [x, y] of [
    [0, 0],
    [1, 0],
    [0, 1],
    [40, 30],
    [127, 127],
  ])
    expect(result.values[y * 128 + x]).toBeCloseTo(
      20 + (sample((x + 0.5) * 64, (y + 0.5) * 64) + 100) / HEIGHT_SUM_SCALE,
      11,
    );
  expect(world["field"].readSource(after.key)?.values).toEqual(after.values);
  world.destroy();
});

it("R3 fences upload-only terrain and admits no further GL work with both slots occupied", async () => {
  const { world, field, frame } = await readyRenderer({ rendered: false });
  const gl = world.renderer.gl;
  const wait = vi
    .spyOn(gl, "clientWaitSync")
    .mockReturnValue(gl.TIMEOUT_EXPIRED);
  const baseFlush = world["field"].flush.bind(world["field"]);
  const flush = vi
    .spyOn(world["field"], "flush")
    .mockImplementation((limit, selected) =>
      baseFlush(Math.min(limit ?? Infinity, 256), selected),
    );
  const render = vi.spyOn(world.renderer, "render");
  const first = world.renderFrame(performance.now())!;
  expect(first.uploadedBytes).toBe(256);
  expect(field.draws).toBe(0);
  expect(first.exactRevision).toBe(-1);
  expect(world.inspectRegion(world.bounds()).status).toBe("missing");
  expect(world.state()).toMatchObject({
    gpuSubmissions: 2,
    terrainPending: true,
    scenePending: true,
  });
  expect(gl.fenceSync).toHaveBeenCalledTimes(2);
  expect(gl.flush).toHaveBeenCalledTimes(2);
  const pending = world.state().pendingUploadBytes;
  world.redraw();
  expect(world.renderFrame(performance.now())).toBeNull();
  expect(world.pollCompletion()).toBeNull();
  expect(flush).toHaveBeenCalledOnce();
  expect(render).toHaveBeenCalledOnce();
  expect(world.state().pendingUploadBytes).toBe(pending);
  expect(world.state().gpuSubmissions).toBe(2);
  wait.mockReturnValue(gl.ALREADY_SIGNALED);
  world.pollCompletion();
  flush.mockRestore();
  frame();
  expect(world.inspectRegion(world.bounds()).status).toBe("current");
});

it("R3 draws only the newest camera from retained colour while terrain is still pending", async () => {
  const { world, field, change } = await readyRenderer();
  const gl = world.renderer.gl;
  const wait = vi
    .spyOn(gl, "clientWaitSync")
    .mockReturnValue(gl.TIMEOUT_EXPIRED);
  world.redraw();
  const oldScene = world.renderFrame(performance.now())!;
  expect(world.state()).toMatchObject({
    gpuSubmissions: 1,
    scenePending: true,
    terrainPending: false,
  });
  change([200, 200]);
  expect(world.renderFrame(performance.now())).toBeNull();
  expect(world.state()).toMatchObject({
    gpuSubmissions: 2,
    scenePending: true,
    terrainPending: true,
  });
  const uploads = field.uploads;
  wait
    .mockReturnValueOnce(gl.ALREADY_SIGNALED)
    .mockReturnValue(gl.TIMEOUT_EXPIRED);
  expect(world.pollCompletion()).toBe(oldScene);
  expect(world.state()).toMatchObject({
    gpuSubmissions: 1,
    scenePending: false,
    terrainPending: true,
  });
  const camera = { ...world.camera };
  world.moveCamera({ ...camera, x: camera.x + 4 });
  world.moveCamera({ ...camera, x: camera.x + 8 });
  world.refresh();
  const render = vi.spyOn(world.renderer, "render");
  const latest = world.renderFrame(performance.now())!;
  expect(latest.viewGeneration).toBe(world.state().viewGeneration);
  expect(world.camera.x).toBe(camera.x + 8);
  expect(render).toHaveBeenCalledOnce();
  expect(field.uploads).toBe(uploads);
  expect(world.state()).toMatchObject({
    gpuSubmissions: 2,
    scenePending: true,
    terrainPending: true,
  });
  expect(world.renderFrame(performance.now())).toBeNull();
  expect(render).toHaveBeenCalledOnce();
  wait.mockReturnValue(gl.ALREADY_SIGNALED);
  expect(world.pollCompletion()).toBe(latest);
  expect(world.inspectRegion(world.bounds()).status).toBe("current");
});

it("R3 updates the DOM cursor while both GL slots wait without submitting any graphics", async () => {
  const { world, field, change } = await readyRenderer();
  change([200, 200]);
  const gl = world.renderer.gl;
  vi.spyOn(gl, "clientWaitSync").mockReturnValue(gl.TIMEOUT_EXPIRED);
  world.renderFrame(performance.now());
  expect(world.state().gpuSubmissions).toBe(2);
  const uploads = field.uploads;
  const draws = field.draws;
  const render = vi.spyOn(world.renderer, "render");
  const cursor = vi.spyOn(world["cursorOverlay"]!, "update");
  world.cursor = { x: 12, y: 18, radius: 8, waiting: true };
  world.redrawCursor();
  expect(cursor).toHaveBeenLastCalledWith(world.cursor);
  world.cursor = { x: 38, y: 40, radius: 24, waiting: false };
  world.redrawCursor();
  expect(cursor).toHaveBeenLastCalledWith(world.cursor);
  expect(world.renderFrame(performance.now())).toBeNull();
  expect(render).not.toHaveBeenCalled();
  expect(field.uploads).toBe(uploads);
  expect(field.draws).toBe(draws);
  expect(world.state().gpuSubmissions).toBe(2);
});

it("R3 retains reset resources until every fence using the old field actually ends", async () => {
  const { world, change } = await readyRenderer();
  change([200, 200]);
  const gl = world.renderer.gl;
  const wait = vi
    .spyOn(gl, "clientWaitSync")
    .mockReturnValue(gl.TIMEOUT_EXPIRED);
  world.renderFrame(performance.now());
  const oldField = world["field"];
  const destroy = vi.spyOn(oldField, "destroy");
  expect(world.state().gpuSubmissions).toBe(2);
  world.reset(new EditorDocument("new-session", { empty: true }));
  expect(world["field"]).not.toBe(oldField);
  expect(destroy).not.toHaveBeenCalled();
  expect(world.state()).toMatchObject({ retiredFields: 1, gpuSubmissions: 2 });
  wait
    .mockReturnValueOnce(gl.ALREADY_SIGNALED)
    .mockReturnValue(gl.TIMEOUT_EXPIRED);
  world.pollCompletion();
  expect(world.state()).toMatchObject({ retiredFields: 1, gpuSubmissions: 1 });
  expect(destroy).not.toHaveBeenCalled();
  wait.mockReturnValue(gl.ALREADY_SIGNALED);
  world.pollCompletion();
  expect(destroy).toHaveBeenCalledOnce();
  expect(world.state()).toMatchObject({ retiredFields: 0, gpuSubmissions: 0 });
});

it("R3 prunes cold tiles only after their last scene fence ends", async () => {
  const { world } = await readyRenderer({ width: 512, height: 512 });
  const original = [...world["tiles"].values()];
  const destructors = original.map((tile) => vi.spyOn(tile.field, "destroy"));
  const gl = world.renderer.gl;
  const wait = vi
    .spyOn(gl, "clientWaitSync")
    .mockReturnValue(gl.TIMEOUT_EXPIRED);
  world.redraw();
  world.renderFrame(performance.now());
  expect(world.state().scenePending).toBe(true);
  for (let location = 1; location <= 6; location++) {
    world.moveCamera({ ...world.camera, x: location * 100_000 });
    world.refresh();
  }
  expect(world.state().tiles).toBeLessThanOrEqual(editorBudgets.retainedTiles);
  for (const tile of original) expect(world["tiles"].get(tile.key)).toBe(tile);
  for (const destroy of destructors) expect(destroy).not.toHaveBeenCalled();
  wait.mockReturnValue(gl.ALREADY_SIGNALED);
  world.pollCompletion();
  for (let location = 7; location <= 12; location++) {
    world.moveCamera({ ...world.camera, x: location * 100_000 });
    world.refresh();
  }
  for (const tile of original) expect(world["tiles"].has(tile.key)).toBe(false);
  for (const destroy of destructors) expect(destroy).toHaveBeenCalledOnce();
  expect(world.state().tiles).toBeLessThanOrEqual(editorBudgets.retainedTiles);
});

it("R3 retains every scene resource after a draw throws until its submitted prefix ends", async () => {
  const { world } = await readyRenderer({ width: 512, height: 512 });
  const original = [...world["tiles"].values()];
  const destructors = original.map((tile) => vi.spyOn(tile.field, "destroy"));
  const gl = world.renderer.gl;
  const wait = vi
    .spyOn(gl, "clientWaitSync")
    .mockReturnValue(gl.TIMEOUT_EXPIRED);
  vi.spyOn(world.renderer, "render").mockImplementationOnce(() => {
    throw new Error("Scene draw failed after a submitted prefix");
  });
  world.redraw();
  expect(() => world.renderFrame(performance.now())).toThrow(
    "submitted prefix",
  );
  expect(world.state().scenePending).toBe(true);
  for (let location = 1; location <= 6; location++) {
    world.moveCamera({ ...world.camera, x: location * 100_000 });
    world.refresh();
  }
  for (const tile of original) expect(world["tiles"].get(tile.key)).toBe(tile);
  for (const destroy of destructors) expect(destroy).not.toHaveBeenCalled();
  expect(world.state().tiles).toBeLessThanOrEqual(editorBudgets.retainedTiles);
  wait.mockReturnValue(gl.ALREADY_SIGNALED);
  world.pollCompletion();
  for (let location = 7; location <= 12; location++) {
    world.moveCamera({ ...world.camera, x: location * 100_000 });
    world.refresh();
  }
  for (const destroy of destructors) expect(destroy).toHaveBeenCalledOnce();
  world.destroy();
});

it("R3 retains unfenced GPU resources across reset until context loss ends their commands", async () => {
  const { world, canvas, change } = await readyRenderer();
  change([200, 200]);
  vi.spyOn(world.renderer.gl, "fenceSync").mockReturnValue(null);
  expect(() => world.renderFrame(performance.now())).toThrow("verfolgt");
  const previous = world["field"];
  const destroy = vi.spyOn(previous, "destroy");
  expect(world.state().graphicsFailed).toBe(true);
  world.reset(new EditorDocument("after-unfenced-draw", { empty: true }));
  expect(world["field"]).not.toBe(previous);
  expect(destroy).not.toHaveBeenCalled();
  expect(world.state().retiredFields).toBe(1);
  world.pollCompletion();
  expect(destroy).not.toHaveBeenCalled();
  expect(world.renderFrame(performance.now())).toBeNull();
  canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
  expect(destroy).toHaveBeenCalledOnce();
  expect(world.state().retiredFields).toBe(0);
  world.destroy();
});

it("R3 cancels queued diagnostic work before a failed worker releases an older slot", async () => {
  const { controller } = await readyController();
  const worker = controller["work"]!;
  const messages = vi.spyOn(worker, "postMessage");
  const terminate = vi.spyOn(worker, "terminate");
  await controller.background();
  let endProjection!: () => void;
  const projection = controller["compute"].request(
    "projection",
    "local",
    1,
    () => ({
      ended: new Promise<void>((resolve) => (endProjection = resolve)),
      cancel() {},
    }),
  );
  expect(controller["compute"].metrics().active).toBe(2);
  controller["backgroundJob"]!.cancel();
  for (let turn = 0; turn < 4; turn++) await Promise.resolve();
  expect(controller.state.background).toBe(false);
  await controller.background();
  expect(controller["compute"].metrics()).toMatchObject({
    active: 2,
    pending: 1,
  });
  const sent = messages.mock.calls.length;
  worker.onerror!({ message: "Diagnostic worker failed" } as ErrorEvent);
  for (let turn = 0; turn < 4; turn++) await Promise.resolve();
  expect(terminate).toHaveBeenCalledOnce();
  expect(messages).toHaveBeenCalledTimes(sent);
  expect(controller["compute"].metrics()).toMatchObject({
    active: 1,
    pending: 0,
  });
  expect(controller.state.background).toBe(false);
  expect(controller.state.error).toBe("Diagnostic worker failed");
  endProjection();
  await projection.result;
  expect(controller["compute"].metrics().active).toBe(0);
  controller.destroy();
});

it("R3 selects the local target before expensive preparation and stops at the CPU deadline", async () => {
  const { world } = await readyRenderer({
    width: 256,
    height: 128,
    x: 512,
    y: 256,
    rendered: false,
  });
  prepareSources(world);
  world.cursor = { x: 192, y: 64, radius: 1 };
  const nearest = world["tiles"].get("2:1:0")!;
  const distant = world["tiles"].get("2:0:0")!;
  const receipt = world.freezeRender(world.bounds());
  expect(receipt).not.toBeNull();
  let now = 1000;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const prepare = nearest.field.prepareStep.bind(nearest.field);
  const nearStep = vi
    .spyOn(nearest.field, "prepareStep")
    .mockImplementation(() => {
      const result = prepare();
      now += editorBudgets.preparationMsPerFrame;
      return result;
    });
  const farUpdate = vi.spyOn(distant.field, "update");
  const farStep = vi.spyOn(distant.field, "prepareStep");
  world.prepareFrame();
  world.renderFrame(now);
  world.pollCompletion();
  expect(nearStep).toHaveBeenCalledOnce();
  expect(farUpdate).not.toHaveBeenCalled();
  expect(farStep).not.toHaveBeenCalled();
  expect(world.inspectRegion([600, 200, 700, 300]).status).toBe("current");
  expect(world.inspectRegion([200, 200, 300, 300]).status).toBe("missing");
  expect(world.inspectRenderReceipt(receipt!)).toBe("pending");
});

it("R3 detaches a remote exception so normal ready terrain can finish independently", async () => {
  const { world, frame } = await readyRenderer({
    width: 256,
    height: 128,
    x: 512,
    y: 256,
    rendered: false,
  });
  prepareSources(world);
  world.cursor = { x: 192, y: 64, radius: 1 };
  const remote = world["tiles"].get("2:1:0")!;
  let waiting = true;
  vi.spyOn(remote.field, "waitingProjection", "get").mockImplementation(
    () => waiting,
  );
  vi.spyOn(remote.field, "hasProjectionTask", "get").mockImplementation(
    () => waiting,
  );
  vi.spyOn(remote.field, "fallback", "get").mockReturnValue(true);
  frame();
  expect(world["exceptionTarget"]?.target.tile).toBe(remote);
  world.cursor = { x: 64, y: 64, radius: 1 };
  frame();
  expect(world.inspectRegion([200, 200, 300, 300]).status).toBe("current");
  expect(world.inspectRegion([600, 200, 700, 300]).status).toBe("missing");
  expect(world["exceptionTarget"]?.target.tile).toBe(remote);
  waiting = false;
  world.redraw();
  frame();
  expect(world.inspectRegion([600, 200, 700, 300]).status).toBe("current");
  expect(world["exceptionTarget"]).toBeNull();
});

it("R3 preserves an own-change foundation when a queued import echoes the same immutable values", async () => {
  const { world, document, change, frame, field } = await readyRenderer();
  const area: Bounds = [180, 180, 240, 240];
  const foundation = world.captureFoundation();
  const first = change([200, 200]);
  const receipt = world.freezeRender(first.bounds)!;
  world.renderFrame(performance.now());
  const next = change([210, 210]);
  const source = next.patches.find((patch) => patch.after)!.after!;
  const echo = { ...source, values: source.values.slice() };
  world.updatePresentation([echo], [], []);
  expect(document.revision).toBeGreaterThan(receipt.revision);
  world.pollCompletion();
  expect(world.inspectRenderReceipt(receipt)).toBe("complete");
  prepareSources(world);
  expect(field.sources.get(source.key)!.values).toEqual(echo.values);
  expect(world.inspectFoundation(area, foundation).status).toBe("current");
  frame();
  expect(world.inspectRegion(next.bounds).status).toBe("current");
});

it("R3 publishes an older complete local scene while a newer author revision remains pending", async () => {
  const { world, change, document, observation } = await readyRenderer({
    width: 256,
    height: 256,
    x: 0,
    y: 0,
  });
  const brush = { level: 0, radius: 64, amount: 400 };
  const first = change([0, 0], brush);
  const receipt = world.freezeRender(first.bounds)!;
  expect(world["frozen"]!.targets).toHaveLength(4);
  for (const target of world["frozen"]!.targets)
    vi.spyOn(target.tile.field, "compositionWork", "get").mockReturnValue(
      editorBudgets.compositionWorkPerFrame,
    );
  const dose = (intervalId: number, bounds: Bounds) =>
    observation.dose({
      sessionId: document.sessionId,
      gestureId: 1,
      intervalId,
      revision: document.revision,
      changed: true,
      bounds,
      at: performance.now(),
      projectedAt: performance.now(),
      inputIds: [],
    });
  const draw = () => {
    world.pollCompletion();
    const submitted = world.renderFrame(performance.now());
    if (submitted)
      observation.submitted(submitted, (bounds, revision) =>
        world.inspectSubmittedRegion(bounds, revision),
      );
    return submitted;
  };
  dose(1, first.bounds);
  draw();
  expect(
    observation.read().filter((event) => event.kind === "brush-submit"),
  ).toHaveLength(0);
  expect(
    world.inspectSubmittedRegion(first.bounds, receipt.revision).status,
  ).not.toBe("current");
  const next = change([8, 0], brush);
  const unrelated: Bounds = [400, 400, 420, 420];
  world.invalidate(unrelated);
  dose(2, next.bounds);
  expect(document.revision).toBeGreaterThan(receipt.revision);
  for (let step = 0; step < 3; step++) {
    draw();
    if (step < 2)
      expect(
        observation.read().filter((event) => event.kind === "brush-submit"),
      ).toHaveLength(0);
  }
  expect(world.inspectSubmittedRegion(first.bounds).status).toBe("stale");
  expect(
    world.inspectSubmittedRegion(first.bounds, document.revision).status,
  ).toBe("stale");
  expect(world.inspectSubmittedRegion(unrelated, receipt.revision).status).toBe(
    "stale",
  );
  expect(
    world.inspectSubmittedRegion([2000, 2000, 2010, 2010], receipt.revision)
      .status,
  ).toBe("outside");
  const published = observation
    .read()
    .filter((event) => event.kind === "brush-submit");
  expect(published).toHaveLength(1);
  expect(published[0]).toMatchObject({
    intervalId: 1,
    revision: receipt.revision,
    sessionId: receipt.sessionId,
    viewGeneration: receipt.viewGeneration,
  });
  world.pollCompletion();
  expect(world.inspectRenderReceipt(receipt)).toBe("complete");
  expect(world.inspectRegion(next.bounds).status).toBe("stale");
  world.destroy();
});

it("R3 keeps a live brush open when a late presentation read echoes its own pinned source values", async () => {
  const {
    controller,
    bridge,
    frame,
    pointer,
    advance,
    drainView,
    drainAction,
  } = await readyController(1);
  controller.setBrush(16, 400);
  await drainView();
  let resume!: (
    reply: Awaited<ReturnType<typeof bridge.readPresentation>>,
  ) => void;
  bridge.readPresentation.mockImplementationOnce(
    () => new Promise((resolve) => (resume = resolve)),
  );
  controller.goTo(new Event("navigate"), 400, 0, 0.25);
  frame(0);
  for (let step = 0; step < 8; step++) await Promise.resolve();
  expect(resume).toBeTypeOf("function");
  const request = bridge.readPresentation.mock.calls.at(-1)![0];
  for (let step = 0; step < 8 && !controller.observe().readiness.ready; step++)
    frame(0);
  expect(controller.observe().readiness.ready).toBe(true);
  const point: [number, number] = [400, 0];
  const reference = prepaidReference(
    controller.currentBrush(),
    [point],
    [{ from: point, to: point, elapsedMs: 16 }],
  );
  pointer("pointerdown");
  frame(0);
  expect(controller.observe().document!.active).toBe(true);
  expect(controller.observe().document!.revision).toBeGreaterThan(0);
  expect(controller.state.finishing).toBe(false);
  const sources = controller.observation
    .read()
    .filter((event) => event.kind === "sources").length;
  resume({
    ...request,
    sequence: 0,
    tiles: [],
    overviews: [],
    overviewKeys: heightOverviewKeys(request.bounds, request.power),
  });
  for (let step = 0; step < 8; step++) await Promise.resolve();
  expect(
    controller.observation.read().filter((event) => event.kind === "sources"),
  ).toHaveLength(sources + 1);
  // The reply is projected through the current pinned document, but no RAF has
  // compared or adopted that immutable read snapshot yet. Live input must still
  // belong to the same gesture in this interval.
  advance(16);
  pointer("pointermove");
  expect(controller.state.finishing).toBe(false);
  expect(controller.observe().gesture).not.toBeNull();
  expect(controller.observe().document!.active).toBe(true);
  expect(controller.state.error).toBeNull();
  expect(bridge.commit).not.toHaveBeenCalled();
  pointer("pointerup");
  await drainAction();
  await drainView();
  expect(controller.observe([point]).samples[0]).toBeCloseTo(
    reference.sampleHeight(...point),
    10,
  );
  expect(controller.observe().document!.historyActions).toBe(1);
  expect(bridge.commit).toHaveBeenCalledOnce();
  expect(
    controller.observation
      .read()
      .filter((event) => event.kind === "brush-start"),
  ).toHaveLength(1);
  expect(
    controller.observation
      .read()
      .filter((event) => event.kind === "brush-accepted")
      .reduce((sum, event) => sum + Number(event.offeredElapsedMs), 0),
  ).toBe(16);
  expect(
    controller.observation
      .read()
      .filter((event) => event.kind === "brush-discard"),
  ).toHaveLength(0);
  controller.destroy();
});

it.each([true, false])(
  "R3 compares a pending own overview with a replacement before classifying foundation provenance (equal: %s)",
  async (equal) => {
    const { world, field } = await readyRenderer({
      width: 1,
      height: 1,
      x: 32,
      y: 32,
      scale: 1 / 64,
    });
    const area = world.bounds();
    const foundation = world.captureFoundation();
    const key = heightOverviewKey(6, 0, 0);
    const source = heightTilesFromControls(0, [[6, 6, 180]])[0];
    const patch = { key: source.key, before: null, after: source };
    world.updateSourcePatches([patch]);
    world.invalidate(heightTileSupport(source));
    expect(world["drainSources"](Infinity, 1)).toBe(1);
    expect(world["overviews"].has(key)).toBe(false);
    const replacement = projectHeightOverviewPatches([], [key], [patch])[0];
    expect(replacement).toBeDefined();
    if (!equal) replacement.values[0] += 1;
    world.updatePresentation([], [replacement], [key]);
    prepareSources(world);
    expect(world["overviews"].get(key)!.values).toEqual(replacement.values);
    expect(field.sources.get(source.key)!.values).toEqual(source.values);
    expect(world.inspectFoundation(area, foundation).status).toBe(
      equal ? "current" : "missing",
    );
    world.destroy();
  },
);

it.each(["cancelled", "failed"] as const)(
  "R3 revisits a detached exception after its worker task has %s",
  async (ending) => {
    const { world, frame } = await readyRenderer({
      width: 256,
      height: 128,
      x: 512,
      y: 256,
      rendered: false,
    });
    prepareSources(world);
    world.cursor = { x: 192, y: 64, radius: 1 };
    const remote = world["tiles"].get("2:1:0")!;
    let hasTask = true;
    vi.spyOn(remote.field, "fallback", "get").mockReturnValue(true);
    vi.spyOn(remote.field, "waitingProjection", "get").mockReturnValue(true);
    vi.spyOn(remote.field, "hasProjectionTask", "get").mockImplementation(
      () => hasTask,
    );
    vi.spyOn(remote.field, "needsPreparation", "get").mockReturnValue(true);
    const prepare = vi
      .spyOn(remote.field, "prepareStep")
      .mockReturnValue(false);
    frame();
    expect(world["exceptionTarget"]?.target.tile).toBe(remote);
    prepare.mockClear();
    // A cancelled result resolves null immediately; an error also clears the
    // task. Neither makes the unpainted exception image ready by itself.
    hasTask = false;
    prepare.mockImplementation(() => {
      if (ending === "failed") throw new Error("Projection failed");
      hasTask = true;
      return false;
    });
    if (ending === "failed") {
      const error = vi.fn();
      world.onError = error;
      frame();
      expect(error).toHaveBeenCalledOnce();
      expect(error.mock.calls[0][0].message).toBe("Projection failed");
      expect(world["frozen"]).toBeNull();
    } else {
      frame();
      expect(hasTask).toBe(true);
      expect(world["exceptionTarget"]?.target.tile).toBe(remote);
    }
    expect(prepare).toHaveBeenCalledOnce();
    world.destroy();
  },
);

it("R3 isolates a failed remote exception so cold local sources and scenes can still finish", async () => {
  const { world, field, frame } = await readyRenderer({
    width: 384,
    height: 128,
    x: 768,
    y: 256,
    rendered: false,
  });
  prepareSources(world);
  world.cursor = { x: 320, y: 64, radius: 1 };
  const remote = world["tiles"].get("2:2:0")!;
  let hasTask = true;
  const fallback = vi
    .spyOn(remote.field, "fallback", "get")
    .mockReturnValue(true);
  const waiting = vi
    .spyOn(remote.field, "waitingProjection", "get")
    .mockReturnValue(true);
  vi.spyOn(remote.field, "hasProjectionTask", "get").mockImplementation(
    () => hasTask,
  );
  const needsPreparation = vi
    .spyOn(remote.field, "needsPreparation", "get")
    .mockReturnValue(true);
  const prepare = vi.spyOn(remote.field, "prepareStep").mockReturnValue(false);
  const error = vi.fn();
  world.onError = error;
  frame();
  expect(world["exceptionTarget"]?.target.tile).toBe(remote);
  hasTask = false;
  prepare.mockImplementation(() => {
    throw new Error("Remote projection failed");
  });
  frame();
  expect(error).toHaveBeenCalledOnce();
  expect(error.mock.calls[0][0].message).toBe("Remote projection failed");
  expect(world["sourcesFrozen"]).toBe(false);
  const failedCalls = prepare.mock.calls.length;
  const source = heightTilesFromControls(0, [[20, 20, 100]])[0];
  world.updatePresentation([source], [], []);
  world.cursor = { x: 64, y: 64, radius: 1 };
  prepareSources(world);
  expect(field.sources.get(source.key)!.values).toEqual(source.values);
  for (let step = 0; step < 4; step++) frame();
  expect(world.inspectRegion([200, 200, 300, 300]).status).toBe("current");
  expect(world.inspectRegion([1200, 200, 1300, 300]).status).toBe("missing");
  expect(prepare).toHaveBeenCalledTimes(failedCalls);
  expect(error).toHaveBeenCalledOnce();

  world.retryPreparation();
  world.cursor = { x: 320, y: 64, radius: 1 };
  frame();
  expect(prepare).toHaveBeenCalledTimes(failedCalls + 1);
  expect(error).toHaveBeenCalledTimes(2);
  for (let step = 0; step < 3; step++) frame();
  expect(error).toHaveBeenCalledTimes(2);

  const changed = heightTilesFromControls(0, [[256, 40, 80]])[0];
  expect(intersectsBounds(heightTileSupport(changed), remote.bounds)).toBe(
    true,
  );
  world.updatePresentation([changed], [], []);
  prepareSources(world);
  frame();
  expect(error).toHaveBeenCalledTimes(3);
  expect(prepare).toHaveBeenCalledTimes(failedCalls + 2);

  // A subsequent user retry can recover the same target when its backend works.
  prepare.mockRestore();
  needsPreparation.mockRestore();
  waiting.mockRestore();
  fallback.mockRestore();
  world.retryPreparation();
  for (let step = 0; step < 4; step++) frame();
  expect(world.inspectRegion([1200, 200, 1300, 300]).status).toBe("current");
  expect(error).toHaveBeenCalledTimes(3);
  world.destroy();
});
