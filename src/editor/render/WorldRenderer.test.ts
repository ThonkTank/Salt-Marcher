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
  heightOverviewKeys,
  heightOverviewKey,
  heightOverviewBounds,
  HEIGHT_SUM_SCALE,
  heightFromScaledSum,
  heightTileSupport,
  type Bounds,
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
    overviews = new Map<string, HeightOverviewTile>();
    uploads = 0;
    updates = 0;
    draws = 0;
    restores = 0;
    private changedBytes = 0;
    private gestureId: number | string | null = null;
    private tiles = new Set<{
      bytes: number;
      dirty: boolean;
      pixels: number;
      needsPreparation: boolean;
    }>();
    constructor() {
      fields.push(this);
    }
    init() {}
    beginGesture(context: { id: number | string }) {
      if (this.gestureId === context.id) return;
      this.gestureId = context.id;
      for (const tile of this.tiles) tile.needsPreparation = true;
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
      }
    }
    drawDirty() {
      this.draws++;
      return 128 * 128;
    }
    updateSources(
      tiles: readonly HeightTile[],
      removed: readonly string[] = [],
    ) {
      const changed: Bounds[] = [];
      for (const key of removed) {
        const before = this.sources.get(key);
        if (before) changed.push(heightTileSupport(before));
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
      }
      return changed;
    }
    createTile(bounds: Bounds, power: number, overview?: HeightOverviewTile) {
      const state = {
        bytes: 0,
        dirty: true,
        pixels: 128 * 128,
        needsPreparation: false,
      };
      this.tiles.add(state);
      const span = 128 * 2 ** power;
      const key = heightOverviewKey(power, bounds[0] / span, bounds[1] / span);
      const update = (
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
      update(overview ?? null);
      const field = this;
      return {
        mesh: { position: { set() {} }, visible: false, destroy() {} },
        update,
        invalidateAnchor() {},
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
          };
        },
        drawDirty: () => {
          if (!state.dirty) return 0;
          this.drawDirty();
          state.dirty = false;
          return state.pixels;
        },
        destroy: () => {
          this.tiles.delete(state);
          this.overviews.delete(key);
        },
      };
    }
    flush(maxBytes = Infinity) {
      let bytes = Math.min(this.changedBytes, maxBytes);
      this.changedBytes -= bytes;
      this.uploads++;
      for (const tile of this.tiles) {
        const count = Math.min(tile.bytes, maxBytes - bytes);
        tile.bytes -= count;
        bytes += count;
      }
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
      this.gestureId = null;
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
});

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
  const rendered = () =>
    prepareHeightSampler([...field.sources.values()])(320, 0);
  expect(rendered()).toBeCloseTo(lifted, 10);
  const undone = document.undo()!;
  expect(() => document.snapshot(undone.dirtyBounds[0])).toThrow(
    SourcesNotReadyError,
  );
  world.updateSourcePatches(undone.patches);
  expect(rendered()).toBeCloseTo(original, 10);
  expect(undone.patches.every((patch) => !field.sources.has(patch.key))).toBe(
    true,
  );
  const redone = document.redo()!;
  world.updateSourcePatches(redone.patches);
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

it("reprepares a budget-queued tile when a new gesture releases its source bindings", async () => {
  const { world, frame, change } = await readyRenderer({
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
  frame();
  expect(queued.dirty).not.toBeNull();
  expect(queued.preparedRevision).toBe(queued.revision);
  expect(prepare).toHaveBeenCalledTimes(1);
  const previousRevision = queued.revision;
  change([200, 200]);
  expect(queued.revision).toBe(previousRevision);
  expect(queued.preparedRevision).toBe(previousRevision);
  expect(queued.field.needsPreparation).toBe(true);
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
  expect(world.state().gpuPending).toBe(false);
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
  const { world, field, frame } = await readyRenderer({
    width: 1180,
    height: 894,
    rendered: false,
  });
  const first = frame()!;
  expect(first.uploadedBytes).toBeLessThanOrEqual(
    editorBudgets.uploadBytesPerFrame,
  );
  expect(world.state().pendingUploadBytes).toBeGreaterThan(0);
  expect(field.draws).toBeGreaterThan(0);
  expect(first.exactRevision).toBe(-1);
  expect(world.inspectRegion(world.bounds()).status).toBe("missing");
  const updates = field.updates;
  for (
    let step = 0;
    step < 20 &&
    (world.state().pendingUploadBytes > 0 || world.state().queuedTiles > 0);
    step++
  ) {
    const receipt = frame()!;
    expect(receipt.uploadedBytes).toBeLessThanOrEqual(
      editorBudgets.uploadBytesPerFrame,
    );
    expect(field.updates).toBe(updates);
    if (world.state().pendingUploadBytes > 0) {
      expect(field.draws).toBeGreaterThan(0);
      expect(world.inspectRegion(world.bounds()).status).not.toBe("current");
    }
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
  frame();
  expect(field.overviews.get(key)?.values[0]).toBe(2);
  expect(world.inspectRegion([200, 200, 240, 240]).status).toBe("current");
  world.updatePresentation([], [], [key]);
  expect(world.inspectRegion([200, 200, 240, 240]).status).not.toBe("current");
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
  frame();
  expect(world.state().submittedRevision).toBe(3);
  expect(
    prepareHeightSampler([...field.sources.values()])(160, 160),
  ).toBeCloseTo(firstHeight, 10);
  const redone = document.redo()!;
  world.updateSourcePatches(redone.patches);
  for (const bounds of redone.dirtyBounds) world.invalidate(bounds);
  expect(world.inspectRegion(first.bounds).status).toBe("stale");
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

it("keeps visible progress and the frame loop after a slow or failed brush decision", async () => {
  const { controller, frame, pointer, advance } = await readyController();
  controller.setBrush(16, 400);
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
    readPresentation: vi.fn(async (request: ReadPresentationRequest) => ({
      ...request,
      sequence: info.sequence,
      tiles: [],
      overviews: [],
      overviewKeys: heightOverviewKeys(request.bounds, request.power),
    })),
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
        !controller.state.loading &&
        controller.world.inspectRegion(controller.world.bounds()).status ===
          "current"
      )
        return;
    }
    throw new Error("Actual numeric terrain view did not finish");
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
    advance,
    resize,
  };
}

it.each([16, 512])(
  "keeps a %ipx short click and prevents invisible impulses from stacking across gestures",
  async (diameter) => {
    const { controller, bridge, frame, pointer } = await readyController(0, {
      width: 1180,
      height: 894,
    });
    controller.setBrush(diameter, 400);
    pointer("pointerdown", 20, 20);
    expect(controller.observe().document!.revision).toBe(1);
    pointer("pointerup", 20, 20);
    pointer("pointerdown", 20, 20);
    pointer("pointerup", 20, 20);
    expect(controller.observe().document!.revision).toBe(1);
    await Promise.resolve();
    expect(bridge.commit).toHaveBeenCalledOnce();
    const intervals = controller.observation
      .read()
      .filter((event) => event.kind === "brush-interval");
    expect(intervals).toHaveLength(1);
    expect(intervals[0]).toMatchObject({
      cause: "press",
      nominalDose: true,
      acceptedElapsedMs: 1000 / 60,
      rawElapsedMs: 0,
    });
    expect(intervals[0].fromAt).toBe(intervals[0].toAt);
    frame();
    frame();
    for (let step = 0; step < 3; step++) frame(50);
    expect(controller.observe().document!.revision).toBe(1);
    expect(
      controller.observation
        .read()
        .filter((event) => event.kind === "brush-submit"),
    ).toHaveLength(1);
    expect(
      controller.observation
        .read()
        .filter((event) => event.kind === "edit-submit")
        .map((event) => event.input),
    ).toEqual([2]);
    expect(
      controller.observation
        .read()
        .filter((event) => event.kind === "noop")
        .map((event) => event.input),
    ).toEqual([3, 4]);
    controller.destroy();
  },
);

it.each(["drop-render", "delay-render", "pointerup-render"] as const)(
  "keeps one accepted large dose through %s and never paints a waiting path after release",
  async (fault) => {
    const { controller, frame, pointer, advance } = await readyController(0, {
      width: 1180,
      height: 894,
    });
    controller.setBrush(512, 400);
    controller.world.fault = fault;
    pointer("pointerdown", 190, 372);
    frame(24);
    advance(24);
    pointer("pointermove", 330, 372);
    frame(24);
    advance(24);
    pointer("pointermove", 610, 372);
    frame(24);
    expect(controller.observe().document!.revision).toBe(1);
    expect(
      controller.observation
        .read()
        .filter((event) => event.kind === "brush-submit"),
    ).toHaveLength(0);
    pointer("pointerup", 610, 372);
    const values = controller.observe([
      [-1600, -300],
      [80, -300],
    ]).samples;
    controller.world.fault = "none";
    frame(1000);
    expect(controller.observe().document!.revision).toBe(1);
    expect(
      controller.observe([
        [-1600, -300],
        [80, -300],
      ]).samples,
    ).toEqual(values);
    expect(
      controller.observation
        .read()
        .filter((event) => event.kind === "brush-interval"),
    ).toHaveLength(1);
    expect(
      controller.observation
        .read()
        .filter((event) => event.kind === "brush-submit"),
    ).toHaveLength(1);
    expect(controller.observe().readiness.ready).toBe(false);
    frame(0);
    expect(controller.observe().readiness.ready).toBe(true);
    controller.destroy();
  },
);

it("retains an accepted press and its dose fact when presentation projection fails", async () => {
  const { controller, bridge, frame, pointer, drainView } =
    await readyController();
  controller.setBrush(16, 400);
  const original = controller.observe([[-48, -48]]).samples[0]!;
  const previousFrame = controller.world.state().lastSubmittedFrame;
  const projection = vi
    .spyOn(controller.world, "updateSourcePatches")
    .mockImplementationOnce(() => {
      throw new Error("Darstellungsbudget überschritten");
    });

  pointer("pointerdown", 20, 20);
  const accepted = controller.observe([[-48, -48]]);
  expect(controller.state.error).toBe("Darstellungsbudget überschritten");
  expect(accepted.gesture).toBeNull();
  expect(accepted.document).toMatchObject({
    revision: 1,
    sequence: 1,
    historyActions: 1,
  });
  expect(accepted.samples[0]).toBeGreaterThan(original);
  expect(controller.state.canUndo).toBe(true);
  expect(controller.state.needsPress).toBe(true);
  const intervals = controller.observation
    .read()
    .filter((event) => event.kind === "brush-interval");
  expect(intervals).toHaveLength(1);
  expect(intervals[0]).toMatchObject({
    cause: "press",
    changed: true,
    revision: 1,
    acceptedElapsedMs: 1000 / 60,
    projectedAt: null,
  });

  // Redrawing the old terrain must not certify this failed projection.
  frame();
  expect(controller.world.state().lastSubmittedFrame).toBeGreaterThan(
    previousFrame,
  );
  pointer("pointerup", 20, 20);
  await drainView();
  expect(bridge.commit).toHaveBeenCalledOnce();
  const committed = bridge.commit.mock.calls[0][0];
  expect(committed.sequence).toBe(1);
  expect(committed.patches.length).toBeGreaterThan(0);
  expect(
    prepareHeightSampler(
      committed.patches.flatMap((patch) => (patch.after ? [patch.after] : [])),
    )(-48, -48),
  ).toBeCloseTo(accepted.samples[0]!, 10);

  controller.undo();
  await drainView();
  for (let step = 0; step < 20 && controller.state.writing; step++)
    await Promise.resolve();
  expect(controller.state.writing).toBe(false);
  expect(projection).toHaveBeenCalledTimes(2);
  expect(controller.observe([[-48, -48]]).samples[0]).toBe(original);
  expect(controller.state.canRedo).toBe(true);
  expect(bridge.commit).toHaveBeenCalledTimes(2);
  expect(bridge.commit.mock.calls[1][0].sequence).toBe(2);
  expect(
    controller.observation
      .read()
      .filter((event) => event.kind === "brush-submit"),
  ).toHaveLength(0);
  expect(
    controller.observation
      .read()
      .filter((event) => event.kind === "brush-interval"),
  ).toHaveLength(1);
  controller.destroy();
});

it("ends without evaluating an unaccepted queued path", async () => {
  const { controller, frame, pointer } = await readyController();
  pointer("pointerdown", 20, 20);
  pointer("pointermove", 30_000_000, 20);
  pointer("pointerup", 30_000_000, 20);
  expect(controller.observe().gesture).toBeNull();
  expect(controller.observe().document!.revision).toBe(1);
  frame(1000);
  expect(controller.observe().document!.revision).toBe(1);
  expect(
    controller.observation
      .read()
      .filter((event) => event.kind === "brush-interval"),
  ).toHaveLength(1);
  controller.destroy();
});

it("deepens while held only after each actual current frame, without synthetic pointer inputs or repeated UI state", async () => {
  const { controller, frame, pointer, drainView } = await readyController();
  controller.setBrush(16, 400);
  pointer("pointerdown", 20, 20);
  const pressHeight = controller.observe([[-48, -48]]).samples[0]!;
  controller.onChange = vi.fn();
  for (let step = 0; step < 8; step++) {
    frame(16);
  }
  expect(controller.onChange).not.toHaveBeenCalled();
  expect(controller.observe([[-48, -48]]).samples[0]).toBeGreaterThan(
    pressHeight,
  );
  const events = controller.observation.read();
  const intervals = events.filter((event) => event.kind === "brush-interval");
  expect(intervals.length).toBeGreaterThan(2);
  expect(
    intervals
      .slice(1)
      .every(
        (event) =>
          event.cause === "hold" &&
          Number(event.acceptedElapsedMs) > 0 &&
          Number(event.acceptedElapsedMs) <= 50 &&
          (event.inputIds as number[]).length === 0,
      ),
  ).toBe(true);
  expect(
    intervals
      .slice(1)
      .reduce((total, event) => total + Number(event.acceptedElapsedMs), 0),
  ).toBe(128);
  expect(controller.observe().renderer.submittedRevision).toBe(
    controller.observe().document!.revision,
  );
  expect(
    events.filter(
      (event) => event.kind === "input" && event.inputKind === "edit",
    ),
  ).toHaveLength(1);
  for (let index = 1; index < intervals.length; index++) {
    const previous = events.findIndex(
      (event) =>
        event.kind === "brush-submit" &&
        event.intervalId === intervals[index - 1].intervalId,
    );
    expect(previous).toBeGreaterThan(-1);
    expect(previous).toBeLessThan(events.indexOf(intervals[index]));
  }
  pointer("pointerup", 20, 20);
  const revision = controller.observe().document!.revision;
  await drainView();
  expect(controller.observe().document!.revision).toBe(revision);
  expect(
    controller.observation
      .read()
      .filter((event) => event.kind === "brush-interval"),
  ).toHaveLength(intervals.length);
  controller.undo();
  await drainView();
  expect(controller.observe([[-48, -48]]).samples[0]).toBeCloseTo(-100, 10);
  controller.destroy();
});

it("caps a stalled frame once and discards late movement without restoring an older anchor", async () => {
  const { controller, frame, pointer, advance } = await readyController();
  controller.setBrush(16, 400);
  pointer("pointerdown", 20, 20);
  const oldAt = Number(
    controller.observation.read().find((event) => event.kind === "brush-start")!
      .inputAt,
  );
  frame(0);
  frame(1000);
  let intervals = controller.observation
    .read()
    .filter((event) => event.kind === "brush-interval");
  expect(intervals).toHaveLength(2);
  expect(intervals[1]).toMatchObject({
    acceptedElapsedMs: 50,
    rawElapsedMs: 1000,
  });
  expect(Number(intervals[1].toAt) - Number(intervals[1].fromAt)).toBe(50);
  expect(
    controller.observation
      .read()
      .some(
        (event) =>
          event.kind === "brush-discard" &&
          event.reason === "cap" &&
          Number(event.toAt) - Number(event.fromAt) === 950,
      ),
  ).toBe(true);
  // A fresh position is tracked during feedback wait; an older event cannot undo it.
  controller.world.fault = "drop-render";
  advance(16);
  pointer("pointermove", 44, 20);
  const accepted = controller.observe().document!.revision;
  pointer("pointermove", 52, 20);
  frame();
  pointer("pointermove", 10, 20, oldAt);
  frame();
  expect(controller.observe().document!.revision).toBe(accepted);
  controller.world.fault = "none";
  frame();
  expect(controller.observe().document!.revision).toBe(accepted);
  frame();
  intervals = controller.observation
    .read()
    .filter((event) => event.kind === "brush-interval");
  expect(intervals.at(-1)).toMatchObject({
    from: [80, -48],
    to: [80, -48],
    acceptedElapsedMs: 32,
  });
  // A late event cannot move the anchor or suppress current held-time work.
  pointer("pointermove", 10, 20, oldAt);
  frame();
  expect(
    controller.observation
      .read()
      .filter((event) => event.kind === "brush-interval"),
  ).toHaveLength(intervals.length + 1);
  expect(
    controller.observation
      .read()
      .filter((event) => event.kind === "brush-interval")
      .at(-1),
  ).toMatchObject({ from: [80, -48], to: [80, -48], acceptedElapsedMs: 16 });
  expect(
    controller.observation
      .read()
      .some(
        (event) =>
          event.kind === "noop" &&
          event.reason === "stale" &&
          event.accepted === false,
      ),
  ).toBe(true);
  advance(16);
  pointer("pointermove", 56, 20);
  expect(
    controller.observation
      .read()
      .filter((event) => event.kind === "brush-interval")
      .at(-1),
  ).toMatchObject({ from: [80, -48], to: [96, -48], acceptedElapsedMs: 16 });
  pointer("pointerup");
  controller.destroy();
});

it("accepts at most one bounded dose from many queued moves", async () => {
  const { controller, frame, pointer } = await readyController();
  controller.setBrush(16, 400);
  controller.world.fault = "drop-render";
  pointer("pointerdown", 20, 20);
  frame();
  for (let x = 21; x <= 40; x++) pointer("pointermove", x, 20);
  controller.world.fault = "none";
  frame(500);
  expect(controller.observe().document!.revision).toBe(1);
  frame(16);
  const intervals = controller.observation
    .read()
    .filter((event) => event.kind === "brush-interval");
  expect(intervals).toHaveLength(2);
  expect(intervals[1]).toMatchObject({
    from: [32, -48],
    to: [32, -48],
    acceptedElapsedMs: 50,
  });
  expect(
    controller.observation
      .read()
      .filter((event) => event.kind === "noop" && event.reason === "stale"),
  ).toHaveLength(19);
  pointer("pointerup");
  controller.destroy();
});

it("ends obsolete feedback only after navigating completely away, then waits for the new displayed basis", async () => {
  const { controller, frame, pointer, drainView } = await readyController();
  controller.setBrush(16, 400);
  pointer("pointerdown", 20, 20);
  pointer("pointerup", 20, 20);
  controller.goTo(new Event("navigate"), 4, 0, 0.25);
  pointer("pointerdown", 20, 20);
  pointer("pointerup", 20, 20);
  expect(controller.observe().document!.revision).toBe(1);
  expect(
    controller.observation
      .read()
      .some((event) => event.kind === "brush-feedback-obsolete"),
  ).toBe(false);
  controller.goTo(new Event("navigate"), 10_000, 0, 0.25);
  pointer("pointerdown", 20, 20);
  expect(controller.observe().document!.revision).toBe(1);
  const obsolete = controller.observation
    .read()
    .filter((event) => event.kind === "brush-feedback-obsolete");
  expect(obsolete).toHaveLength(1);
  expect(obsolete[0]).toMatchObject({
    intervalId: 1,
    gestureId: 1,
    reason: "outside-view",
  });
  pointer("pointerup", 20, 20);
  await drainView();
  pointer("pointerdown", 20, 20);
  expect(controller.observe().document!.revision).toBe(2);
  pointer("pointerup", 20, 20);
  frame();
  controller.destroy();
});

it("releases offscreen feedback on resize without accepting the not-yet-drawn view", async () => {
  const { controller, pointer, resize, drainView } = await readyController();
  controller.setBrush(8, 400);
  pointer("pointerdown", 2, 32);
  pointer("pointerup", 2, 32);
  resize(8);
  pointer("pointerdown", 4, 32);
  expect(controller.observe().document!.revision).toBe(1);
  expect(
    controller.observation
      .read()
      .filter((event) => event.kind === "brush-feedback-obsolete"),
  ).toHaveLength(1);
  pointer("pointerup", 4, 32);
  await drainView();
  pointer("pointerdown", 4, 32);
  expect(controller.observe().document!.revision).toBe(2);
  pointer("pointerup", 4, 32);
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
      .filter((event) => event.kind === "brush-interval"),
  ).toHaveLength(1);
  expect(
    controller.observation
      .read()
      .find((event) => event.kind === "brush-interval"),
  ).toMatchObject({
    cause: "press",
    acceptedElapsedMs: 1000 / 60,
    rawElapsedMs: 0,
  });
  pointer("pointerup");
  frame(200);
  expect(controller.observe().document!.revision).toBe(1);
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
  expect(controller.observe().document!.revision).toBe(1);
  await drainView();
  expect(bridge.commit).toHaveBeenCalledOnce();
  expect(controller.state.canUndo).toBe(true);
  expect(controller.observation.read()).toEqual([]);
  controller.undo();
  await drainView();
  expect(controller.observe([[-32, -48]]).samples[0]).toBe(-100);
  controller.destroy();
});

it("keeps input decisions, terrain and history identical with diagnostics enabled or disabled", async () => {
  const apply = vi.spyOn(EditorDocument.prototype, "applySegments");
  const replay = async (diagnostics: boolean) => {
    apply.mockClear();
    const { controller, bridge, pointer, frame, drainView, advance } =
      await readyController(0, { diagnostics, ready: false });
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

    // A cold press remains blocked after loading while its physical button is held.
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
    frame(24);
    capture();
    expect(controller.observe().document!.revision).toBe(1);
    controller.world.fault = "none";
    frame(16);
    capture();
    expect(controller.observe().document!.revision).toBe(1);
    advance(16);
    pointer("pointermove", 36, 20);
    capture();
    expect(controller.observe().document!.revision).toBe(2);

    // The accepted dose survives Up, so a second unseen press cannot stack it.
    pointer("pointerup", 32, 20);
    pointer("pointerdown", 32, 20);
    pointer("pointerup", 32, 20);
    expect(controller.observe().document!.revision).toBe(2);
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
      segments: structuredClone(apply.mock.calls),
      commits: structuredClone(bridge.commit.mock.calls),
    };
    expect(result.segments).toHaveLength(2);
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
  expect(controller.observe().document!.revision).toBe(1);
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
  expect(controller.observe().document!.revision).toBe(1);
  controller.destroy();
});

it("ends a stroke before an unseen gap even when its two endpoints are visible", async () => {
  const { controller, bridge, frame, pointer, drainView } =
    await readyController(0, { width: 512 });
  controller.setBrush(16, 400);
  const inspect = controller.world.inspectRegion.bind(controller.world);
  const gap = vi
    .spyOn(controller.world, "inspectRegion")
    .mockImplementation((bounds) => {
      const region = inspect(bounds);
      return bounds[0] < 0 && bounds[2] > 0
        ? { ...region, status: "missing" }
        : region;
    });
  pointer("pointerdown", 64, 32);
  const accepted = controller.observe().document!.revision;
  pointer("pointermove", 448, 32);
  frame();
  expect(controller.observe().gesture).toBeNull();
  expect(controller.observe().document!.revision).toBe(accepted);
  expect(controller.state.needsPress).toBe(true);
  for (let step = 0; step < 4; step++) await Promise.resolve();
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
  const { controller, bridge, pointer, frame, drainView } =
    await readyController();
  controller.setBrush(16, 400);
  pointer("pointerdown", 1, 32);
  expect(controller.observe().document!.revision).toBe(1);
  pointer("pointermove", 1000, 32);
  frame();
  expect(controller.observe().gesture).toBeNull();
  expect(controller.observe().document!.revision).toBe(1);
  expect(controller.observe().readiness.reason).toBe("outside");
  expect(controller.state.loading).toBe(false);
  pointer("pointermove", 32, 32);
  await drainView();
  frame(500);
  expect(controller.state.needsPress).toBe(true);
  expect(controller.observe().document!.revision).toBe(1);
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
  expect(controller.observe().document!.revision).toBe(1);
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
  frame(0); // Local GPU completion does not wait for the unrelated outer read.
  expect(controller.observe().readiness.ready).toBe(true);
  expect(controller.state.loading).toBe(false);
  pointer("pointerdown");
  pointer("pointerup");
  expect(controller.observe().document!.revision).toBe(1);
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
  controller.retryLoad();
  await drainView();
  expect(controller.state.error).toBeNull();
  expect(controller.observe().readiness.ready).toBe(true);
  expect(controller.observe().document!.revision).toBe(0);
  pointer("pointerdown");
  pointer("pointerup");
  expect(controller.observe().document!.revision).toBe(1);
  controller.destroy();
});

it("ends a held stroke on resize instead of painting at a world point different from its cursor", async () => {
  const { controller, pointer, resize, frame, drainView } =
    await readyController();
  controller.setBrush(16, 400);
  pointer("pointerdown", 32, 32);
  expect(controller.observe().document!.revision).toBe(1);
  resize(128);
  expect(controller.observe().gesture).toBeNull();
  await drainView();
  frame(500);
  expect(controller.observe().document!.revision).toBe(1);
  expect(controller.state.needsPress).toBe(true);
  pointer("pointerup", 32, 32);
  pointer("pointerdown", 32, 32);
  pointer("pointerup", 32, 32);
  expect(controller.observe().document!.revision).toBe(2);
  expect(
    controller.observation
      .read()
      .filter((event) => event.kind === "brush-interval")
      .at(-1),
  ).toMatchObject({ from: [-128, 0], to: [-128, 0] });
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
  frame();
  expect(rendered()).toBeCloseTo(document.sampleHeight(32, 32), 10);
  const second = document.applySegment([48, 32], [48, 32], 1000)!;
  world.updateSourcePatches(second.patches);
  world.invalidate(second.bounds);
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
  frame();
  expect(rendered()).toBeCloseTo(-100, 10);
  const redone = document.redo()!;
  world.updateSourcePatches(redone.patches);
  for (const bounds of redone.dirtyBounds) world.invalidate(bounds);
  frame();
  expect(rendered()).toBeCloseTo(document.sampleHeight(32, 32), 10);
});

// Controller regressions use the real author model and presentation readiness.
// Only the existing GL boundary is mocked; a revision alone is not a draw receipt.
it.each([16, 512])(
  "accepts a ready final %ipx movement before pointerup between frames",
  async (diameter) => {
    const { controller, bridge, pointer, frame, advance } =
      await readyController(0, { width: 1180, height: 894 });
    controller.setBrush(diameter, 4000);
    const endX = diameter === 512 ? 610 : 230;
    const endpoint: [number, number] = [(endX - 590) / 0.25, -300];
    const original = controller.observe([endpoint]).samples[0]!;
    pointer("pointerdown", 190, 372);
    frame(0);
    expect(controller.observe().readiness).toMatchObject({
      ready: false,
      reason: "feedback",
    });

    advance(24);
    pointer("pointermove", endX, 372);
    const accepted = controller.observe([endpoint]);
    expect(accepted.samples[0]).toBeGreaterThan(original);
    pointer("pointerup", endX, 372);
    expect(controller.observe([endpoint]).samples).toEqual(accepted.samples);
    frame(16);
    frame(200);
    const completed = controller.observe([endpoint]);
    expect(completed.samples).toEqual(accepted.samples);
    expect(completed.document!.revision).toBe(accepted.document!.revision);
    expect(completed.renderer.submittedRevision).toBe(
      completed.document!.revision,
    );
    expect(completed.document!.historyActions).toBe(1);
    await Promise.resolve();
    expect(bridge.commit).toHaveBeenCalledOnce();
    const stored = prepareHeightSampler(
      bridge.commit.mock.calls[0][0].patches.flatMap((patch) =>
        patch.after ? [patch.after] : [],
      ),
    );
    expect(stored(...endpoint)).toBeCloseTo(accepted.samples[0]!, 10);
    controller.destroy();
  },
);

it("shows a newly accepted held dose in the same frame while preserving one pending dose", async () => {
  const { controller, pointer, frame } = await readyController();
  controller.setBrush(16, 400);
  const point: [number, number] = [-48, -48];
  pointer("pointerdown", 20, 20);
  frame(0);
  const press = controller.observe([point]);

  frame(16);
  const held = controller.observe([point]);
  expect(held.samples[0]).toBeGreaterThan(press.samples[0]!);
  expect(held.renderer.submittedRevision).toBe(held.document!.revision);
  expect(held.readiness).toMatchObject({ ready: false, reason: "feedback" });

  controller.world.fault = "drop-render";
  frame(16);
  const waiting = controller.observe([point]);
  expect(waiting.samples[0]).toBeGreaterThan(held.samples[0]!);
  for (let index = 0; index < 5; index++) {
    pointer("pointermove", 20 + index, 20);
    frame(16);
  }
  expect(controller.observe([point]).samples).toEqual(waiting.samples);
  expect(controller.observe().document!.revision).toBe(
    waiting.document!.revision,
  );
  pointer("pointerup", 24, 20);
  controller.world.fault = "none";
  frame(200);
  expect(controller.observe([point]).samples).toEqual(waiting.samples);
  expect(controller.observe().renderer.submittedRevision).toBe(
    waiting.document!.revision,
  );
  controller.destroy();
});

it.each(["pointerup", "pointercancel", "blur"])(
  "adds no dose on %s or later frames after a ready accepted move",
  async (end) => {
    const { controller, pointer, frame, advance } = await readyController();
    controller.setBrush(16, 400);
    pointer("pointerdown", 20, 20);
    frame(0);
    advance(16);
    pointer("pointermove", 40, 20);
    const beforeEnd = controller.observe([
      [-48, -48],
      [32, -48],
    ]);
    advance(200);
    if (end === "blur") window.dispatchEvent(new Event("blur"));
    else pointer(end, 40, 20);
    frame(1000);
    frame(1000);
    const afterEnd = controller.observe([
      [-48, -48],
      [32, -48],
    ]);
    expect(afterEnd.gesture).toBeNull();
    expect(afterEnd.samples).toEqual(beforeEnd.samples);
    expect(afterEnd.document!.revision).toBe(beforeEnd.document!.revision);
    expect(afterEnd.document!.historyActions).toBe(1);
    controller.destroy();
  },
);

/** Same physical motion and 60Hz rendering, with independent pointer delivery. */
async function timedControllerStroke(
  inputHz: 30 | 60 | 120,
  durationMs = 1000,
  corner = false,
) {
  const { controller, bridge, pointer, frame, advance } = await readyController(
    0,
    { width: 256, height: 128 },
  );
  controller.setBrush(64, 400);
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
  frame(0);
  const observed = controller.observe([
    [-128, 0],
    [0, corner ? -128 : 0],
    [128, 0],
  ]);
  expect(observed.renderer.submittedRevision).toBe(observed.document!.revision);
  expect(controller.state.error).toBeNull();
  const intervals = observed.events.filter(
    (event) => event.kind === "brush-interval" && event.cause !== "press",
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
      (sum, event) => sum + Number(event.acceptedElapsedMs),
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

it("drops the old path and excess time after a stalled ready move", async () => {
  const { controller, pointer, frame, advance } = await readyController(0, {
    width: 256,
    height: 128,
  });
  controller.setBrush(16, 400);
  pointer("pointerdown", 48, 64);
  frame(0);
  advance(250);
  pointer("pointermove", 208, 64);
  frame(0);
  const observed = controller.observe([
    [0, 0],
    [320, 0],
  ]);
  expect(observed.samples[0]).toBe(-100);
  expect(observed.samples[1]).toBeGreaterThan(-100);
  const last = observed.events
    .filter((event) => event.kind === "brush-interval")
    .at(-1)!;
  expect(last).toMatchObject({
    from: [320, 0],
    to: [320, 0],
    acceptedElapsedMs: 50,
    rawElapsedMs: 250,
  });
  const discarded = observed.events
    .filter((event) => event.kind === "brush-discard")
    .reduce((sum, event) => sum + Number(event.toAt) - Number(event.fromAt), 0);
  expect(discarded).toBe(200);
  pointer("pointerup", 208, 64);
  frame(1000);
  expect(
    controller.observe([
      [0, 0],
      [320, 0],
    ]).samples,
  ).toEqual(observed.samples);
  controller.destroy();
});

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
    const { controller, bridge, pointer, advance, frame, drainView } =
      await readyController(0, { width, height });
    controller.setBrush(diameter, 400);
    pointer("pointermove", width / 2 - offset, height / 2);
    await drainView();
    const from: [number, number] = [-offset * 4, 0];
    const corner: [number, number] = [0, -offset * 4];
    const to: [number, number] = [offset * 4, 0];
    const probes: [number, number][] = [corner, [0, 0], from, to];
    const reference = new EditorDocument("corner-reference", { empty: true });
    reference.beginGesture(controller.currentBrush());
    reference.applySegment(from, from, 1000 / 60);
    reference.applySegment(from, corner, 8);
    reference.applySegment(corner, to, 8);
    reference.applySegment(to, to, 16);
    reference.finishGesture();

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
    frame(0);
    await Promise.resolve();

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
    expect(time.timedDoseMs).toBe(32);
    expect(
      observed.events.filter(
        (event) => event.kind === "noop" && event.reason === "coalesced",
      ),
    ).toHaveLength(0);
    controller.destroy();
  },
);

it("discards an overloaded point buffer explicitly and resumes only new time", async () => {
  const { controller, pointer, advance, frame } = await readyController();
  controller.setBrush(16, 400);
  pointer("pointerdown", 20, 20);
  for (let index = 0; index <= MAX_BRUSH_POINTS; index++) {
    advance(0.1);
    pointer("pointermove", 20 + (index % 2), 20);
  }
  expect(controller.observe().document!.revision).toBe(1);
  frame(3.1);
  frame(16);
  pointer("pointerup", 20, 20);
  frame(0);
  const observed = controller.observe();
  expect(
    observed.events.filter(
      (event) => event.kind === "noop" && event.reason === "overflow",
    ),
  ).toHaveLength(MAX_BRUSH_POINTS + 1);
  const time = evaluateBrushTime(
    observed.events,
    observed.events
      .filter((event) => event.kind === "input")
      .map((event) => event.id),
    observed.sessionId,
  );
  expect(time.passed).toBe(true);
  expect((time.discardMs as Record<string, number>).overflow).toBeCloseTo(
    12.9,
    7,
  );
  expect(time.timedDoseMs).toBeCloseTo(19.1, 7);
  const dose = observed.events
    .filter((event) => event.kind === "brush-interval")
    .at(-1)!;
  expect(dose.segments).toEqual([
    { from: [-48, -48], to: [-48, -48], elapsedMs: time.timedDoseMs },
  ]);
  controller.destroy();
});

it.each(["sources", "outside", "partial"] as const)(
  "validates every coalesced corner before accepting its path (%s)",
  async (kind) => {
    const { controller, pointer, advance, frame, bridge } =
      await readyController(0, { width: 256, height: 256 });
    controller.setBrush(16, 400);
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
    expect(controller.observe().document!.revision).toBe(
      kind === "partial" ? 2 : 1,
    );
    expect(controller.state.needsPress).toBe(kind !== "partial");
    pointer("pointerup", 192, 128);
    frame(0);
    await Promise.resolve();
    expect(bridge.commit).toHaveBeenCalledOnce();
    controller.destroy();
  },
);

it("confirms release against already submitted terrain without waiting for another frame", async () => {
  const { controller, pointer, frame, advance, bridge } =
    await readyController();
  controller.setBrush(16, 400);
  pointer("pointerdown", 20, 20);
  frame(0);
  const before = controller.observation.read();
  const submit = before.filter((event) => event.kind === "submit").at(-1)!;
  advance(4);
  pointer("pointerup", 20, 20);
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
  expect(events.filter((event) => event.kind === "submit")).toHaveLength(
    before.filter((event) => event.kind === "submit").length,
  );
  expect(
    events.filter((event) => event.kind === "brush-interval"),
  ).toHaveLength(1);
  expect(controller.observe().document!.historyActions).toBe(1);
  await Promise.resolve();
  expect(bridge.commit).toHaveBeenCalledOnce();
  controller.destroy();
});

it("keeps release unconfirmed until its outstanding dose actually draws", async () => {
  const { controller, pointer, frame, advance } = await readyController();
  controller.setBrush(16, 400);
  pointer("pointerdown", 20, 20);
  advance(4);
  pointer("pointerup", 20, 20);
  expect(
    controller.observation
      .read()
      .filter((event) => event.kind === "edit-submit"),
  ).toHaveLength(0);
  frame(16);
  const events = controller.observation.read();
  const submit = events.filter((event) => event.kind === "submit").at(-1)!;
  expect(events.filter((event) => event.kind === "edit-submit")).toMatchObject([
    {
      frame: submit.frame,
      submittedAt: submit.at,
      completedAt: submit.at,
    },
  ]);
  expect(
    events.filter((event) => event.kind === "brush-interval"),
  ).toHaveLength(1);
  controller.destroy();
});

it("preserves a normal queued corner when the GPU completes between input events", async () => {
  const { controller, bridge, pointer, frame, advance } = await readyController(
    0,
    {
      width: 256,
      height: 256,
    },
  );
  controller.setBrush(16, 400);
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
  expect(controller.observe().document!.revision).toBe(2);
  pointer("pointerup", 192, 128);
  await Promise.resolve();
  expect(bridge.commit).toHaveBeenCalledOnce();
  const reference = new EditorDocument("input-fence-reference", {
    empty: true,
  });
  reference.beginGesture(controller.currentBrush());
  reference.applySegment([-256, 0], [-256, 0], 1000 / 60);
  reference.applySegment([-256, 0], [0, -256], 8);
  reference.applySegment([0, -256], [256, 0], 8);
  reference.finishGesture();
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
    controller.observation
      .read()
      .filter((event) => event.kind === "brush-discard"),
  ).toHaveLength(0);
  expect(
    wait.mock.calls.every(([, flags, timeout]) => flags === 0 && timeout === 0),
  ).toBe(true);
  controller.destroy();
});

it("never queues a second dose during GPU timeout and discards failed-frame travel without catch-up", async () => {
  const { controller, pointer, frame, advance } = await readyController();
  controller.setBrush(16, 400);
  pointer("pointerdown", 20, 20);
  frame(0);
  const gl = controller.world.renderer.gl;
  const wait = vi
    .spyOn(gl, "clientWaitSync")
    .mockReturnValue(gl.TIMEOUT_EXPIRED);
  const submitted = controller.observe().renderer.lastSubmittedFrame;
  advance(16);
  pointer("pointermove", 52, 20);
  frame(0);
  frame(200);
  expect(controller.observe().document!.revision).toBe(1);
  expect(controller.observe().renderer.lastSubmittedFrame).toBe(submitted);
  expect(controller.observe().renderer.gpuPending).toBe(true);
  wait.mockReturnValue(gl.ALREADY_SIGNALED);
  advance(16);
  pointer("pointermove", 56, 20);
  const accepted = controller.observe([
    [0, -48],
    [88, -48],
  ]);
  expect(accepted.document!.revision).toBe(2);
  expect(accepted.samples[0]).toBe(-100);
  expect(accepted.samples[1]).toBeGreaterThan(-100);
  expect(
    accepted.events.filter((event) => event.kind === "brush-interval").at(-1),
  ).toMatchObject({
    from: [80, -48],
    to: [96, -48],
    acceptedElapsedMs: 16,
  });
  pointer("pointerup", 56, 20);
  frame(1000);
  expect(
    controller.observe([
      [0, -48],
      [88, -48],
    ]).samples,
  ).toEqual(accepted.samples);
  expect(
    wait.mock.calls.every(([, flags, timeout]) => flags === 0 && timeout === 0),
  ).toBe(true);
  controller.destroy();
});

it.each(["pointerdown", "pointermove", "pointerup"])(
  "reports a failed fence during %s without accepting that input or losing its prior dose",
  async (type) => {
    const { controller, bridge, pointer, frame } = await readyController();
    controller.setBrush(16, 400);
    pointer("pointerdown", 20, 20);
    if (type === "pointerdown") pointer("pointerup", 20, 20);
    frame(0);
    const inputs = controller.observation
      .read()
      .filter((event) => event.kind === "input").length;
    const gl = controller.world.renderer.gl;
    vi.spyOn(gl, "clientWaitSync").mockReturnValueOnce(gl.WAIT_FAILED);
    pointer(type, 56, 56);
    expect(controller.state.error).toContain("Grafikabschluss");
    expect(controller.observe().document!.revision).toBe(1);
    expect(controller.observe().renderer.gpuPending).toBe(false);
    expect(
      controller.observation.read().filter((event) => event.kind === "input"),
    ).toHaveLength(inputs);
    frame(0);
    frame(0);
    pointer("pointerup", 20, 20);
    await Promise.resolve();
    expect(controller.observe().document!.historyActions).toBe(1);
    expect(bridge.commit).toHaveBeenCalledOnce();
    expect(controller.observe([[-48, -48]]).samples[0]).toBeGreaterThan(-100);
    controller.destroy();
  },
);
