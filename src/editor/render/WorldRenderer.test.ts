import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Graphics } from "pixi.js";
import { EditorController } from "../EditorController";
import { editorBudgets } from "../budgets";
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
    private tileCount = 0;
    constructor() {
      fields.push(this);
    }
    init() {}
    rebuildAfterContextRestore() {
      this.restores++;
      this.changedBytes =
        [...this.sources.values()].reduce(
          (bytes, tile) => bytes + tile.values.byteLength,
          0,
        ) +
        this.tileCount * 128 * 128 * 2 * 4;
    }
    drawDirty() {
      this.draws++;
      return 128 * 128;
    }
    replaceSources(tiles: readonly HeightTile[]) {
      this.sources.clear();
      this.updateSources(tiles);
    }
    updateSources(
      tiles: readonly HeightTile[],
      removed: readonly string[] = [],
    ) {
      for (const key of removed) this.sources.delete(key);
      for (const tile of tiles) {
        this.sources.set(tile.key, { ...tile, values: tile.values.slice() });
        this.changedBytes += tile.values.byteLength;
      }
    }
    createTile(bounds: Bounds, power: number, overview?: HeightOverviewTile) {
      this.tileCount++;
      const span = 128 * 2 ** power;
      const key = heightOverviewKey(power, bounds[0] / span, bounds[1] / span);
      const update = (next?: HeightOverviewTile | null) => {
        this.updates++;
        if (next)
          this.overviews.set(key, { ...next, values: next.values.slice() });
        else if (next === null) this.overviews.delete(key);
        this.changedBytes +=
          HEIGHT_DESCRIPTOR_WIDTH * HEIGHT_DESCRIPTOR_HEIGHT * 4 * 4;
        if (next !== undefined) this.changedBytes += 128 * 128 * 2 * 4;
      };
      update(overview ?? null);
      return {
        mesh: { position: { set() {} }, visible: false, destroy() {} },
        update,
        drawDirty: () => this.drawDirty(),
        destroy: () => {
          this.tileCount--;
          this.overviews.delete(key);
        },
      };
    }
    flush(maxBytes = Infinity) {
      const bytes = Math.min(this.changedBytes, maxBytes);
      this.uploads++;
      this.changedBytes -= bytes;
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
        pendingUploadBytes: this.changedBytes,
      };
    }
    reset() {
      this.sources.clear();
      this.overviews.clear();
      this.changedBytes = 0;
      this.tileCount = 0;
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
    true,
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
    true,
  );
  world.refresh();
  const frame = (afterSubmit?: () => void) => {
    const submitted = world.renderFrame(performance.now());
    afterSubmit?.();
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
  expect(field.draws).toBe(0);
  expect(first.exactRevision).toBe(-1);
  expect(world.inspectRegion(world.bounds()).status).toBe("missing");
  const updates = field.updates;
  for (
    let step = 0;
    step < 20 && world.state().pendingUploadBytes > 0;
    step++
  ) {
    const receipt = frame()!;
    expect(receipt.uploadedBytes).toBeLessThanOrEqual(
      editorBudgets.uploadBytesPerFrame,
    );
    expect(field.updates).toBe(updates);
    if (world.state().pendingUploadBytes > 0) {
      expect(field.draws).toBe(0);
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
  expect(field.draws).toBe(composed);
  expect(world.inspectRegion(update.bounds).status).toBe("missing");
  for (let step = 0; step < 20 && world.state().pendingUploadBytes; step++) {
    const receipt = frame()!;
    expect(receipt.uploadedBytes).toBeLessThanOrEqual(
      editorBudgets.uploadBytesPerFrame,
    );
    if (world.state().pendingUploadBytes)
      expect(world.inspectRegion(update.bounds).status).toBe("missing");
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
  world.updatePresentation([], [overview], [key], true);
  expect(world.inspectRegion([200, 200, 240, 240]).status).not.toBe("current");
  frame();
  expect(field.overviews.get(key)?.values[0]).toBe(2);
  expect(world.inspectRegion([200, 200, 240, 240]).status).toBe("current");
  world.updatePresentation([], [], [key], true);
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
  const { world, frame, change } = await readyRenderer({
    width: 320,
    x: 768,
    rendered: false,
  });
  const left: Bounds = [240, 240, 272, 272];
  const right: Bounds = [1264, 240, 1296, 272];
  world.updatePresentation(
    [],
    [],
    [heightOverviewKey(2, 0, 0), heightOverviewKey(2, 2, 0)],
    true,
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
  const pointer = (type: string, x = 32, y = 32, at = now) => {
    const event = new Event(type);
    Object.assign(event, {
      button: 0,
      pointerId: 1,
      clientX: x,
      clientY: y,
      getCoalescedEvents: () => [],
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
  expect(intervals).toHaveLength(9);
  expect(
    intervals
      .slice(1)
      .every(
        (event) =>
          event.cause === "hold" &&
          event.acceptedElapsedMs === 16 &&
          (event.inputIds as number[]).length === 0,
      ),
  ).toBe(true);
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
  const { controller, frame, pointer } = await readyController();
  controller.setBrush(16, 400);
  controller.world.fault = "drop-render";
  pointer("pointerdown", 20, 20);
  const oldAt = Number(
    controller.observation.read().find((event) => event.kind === "brush-start")!
      .inputAt,
  );
  frame(16);
  controller.world.fault = "none";
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
  pointer("pointermove", 44, 20);
  frame();
  pointer("pointermove", 10, 20, oldAt);
  frame();
  expect(
    controller.observation
      .read()
      .filter((event) => event.kind === "brush-interval"),
  ).toHaveLength(2);
  controller.world.fault = "none";
  frame();
  intervals = controller.observation
    .read()
    .filter((event) => event.kind === "brush-interval");
  expect(intervals.at(-1)).toMatchObject({
    from: [48, -48],
    to: [48, -48],
    acceptedElapsedMs: 16,
  });
  // The same late event after result receipt is rejected by the consumed window.
  pointer("pointermove", 10, 20, oldAt);
  frame();
  expect(
    controller.observation
      .read()
      .filter((event) => event.kind === "brush-interval"),
  ).toHaveLength(3);
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
  pointer("pointermove", 52, 20);
  frame();
  expect(
    controller.observation
      .read()
      .filter((event) => event.kind === "brush-interval")
      .at(-1),
  ).toMatchObject({ from: [48, -48], to: [80, -48], acceptedElapsedMs: 16 });
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
      .filter((event) => event.kind === "noop" && event.reason === "coalesced"),
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
    for (let step = 0; step < 5; step++) await Promise.resolve();
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
  for (let step = 0; step < 5; step++) await Promise.resolve();
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
  const apply = vi.spyOn(EditorDocument.prototype, "applySegment");
  const replay = async (diagnostics: boolean) => {
    apply.mockClear();
    const { controller, bridge, pointer, frame, drainView } =
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
