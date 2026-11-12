import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  AtlasDesktop,
  CommitRequest,
  ReadLandscapeRegionRequest,
  ProjectInfo,
  SaveRequest,
} from "./bridge";
import { EditorController } from "./EditorController";
import {
  EditorDocument,
  houseBounds,
  intersectsBounds,
  type Bounds,
  type HouseHeader,
  type Point,
  type LandscapeTile,
  landscapeTileBounds,
  LANDSCAPE_BATCH_CELL_LIMIT,
  LANDSCAPE_BATCH_POINT_LIMIT,
  landscapeSegmentCellCost,
} from "./model";

// Only presentation is substituted. DOM handlers, RAF draining, the document,
// history and ProjectSession's ordered writer all run their production code.
vi.mock("./render/WorldRenderer", () => ({
  WorldRenderer: class {
    camera = { x: 0, y: 0, scale: 0.25 };
    width = 256;
    height = 256;
    cursor = null;
    renderer: { canvas: HTMLCanvasElement | null } = { canvas: null };
    inspectionStatus = "current";
    testDocument!: EditorDocument;
    async init(canvas: HTMLCanvasElement) {
      this.renderer.canvas = canvas;
    }
    reset(document: EditorDocument) {
      this.testDocument = document;
    }
    moveCamera(camera: typeof this.camera) {
      this.camera = { ...camera };
    }
    bounds(): Bounds {
      return [-512, -512, 512, 512];
    }
    sourceBounds() {
      return this.bounds();
    }
    presentationPower() {
      return 0;
    }
    state() {
      return {
        viewGeneration: 1,
        preparationId: 1,
        presentationBytes: 0,
        landscape: { enabled: true },
      };
    }
    captureFoundation() {
      return {
        id: 1,
        sessionId: this.testDocument.sessionId,
        viewGeneration: 1,
        preparationId: 1,
      };
    }
    inspectRegion() {
      return {
        status: this.inspectionStatus,
        sessionId: this.testDocument?.sessionId ?? "",
        frame: 1,
        viewGeneration: 1,
      };
    }
    inspectFoundation() {
      return this.inspectRegion();
    }
    acceptFoundation() {
      return this.inspectionStatus === "current";
    }
    isHeightPresentationReady() {
      return true;
    }
    isLandscapePresentationReady() {
      return true;
    }
    pollCompletion() {
      return null;
    }
    prepareFrame() {
      return false;
    }
    renderFrame() {
      return null;
    }
    resize() {}
    refresh() {}
    setToolLevel() {}
    redrawCursor() {}
    redraw() {}
    selectHouse() {}
    surfaceReadNeed() {
      return null;
    }
    surfaceRetainHeight() {
      return null;
    }
    surfaceRetainWater() {
      return [this.bounds()];
    }
    surfaceState() {
      return null;
    }
    surfaceSample() {
      return null;
    }
    forgetSources() {}
    updateLandscape() {}
    finishFrame() {}
    destroy() {}
  },
}));

const controllers: EditorController[] = [];
afterEach(() => {
  for (const controller of controllers.splice(0)) controller.destroy();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function settle() {
  for (let turn = 0; turn < 16; turn++) await Promise.resolve();
}

async function readyController(houses: HouseHeader[] = []) {
  let now = 1000,
    nextFrame = 0;
  let resized!: () => void;
  let fileAction!: Parameters<AtlasDesktop["onFileAction"]>[0];
  const frames = new Map<number, FrameRequestCallback>();
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.stubGlobal("location", { search: "" });
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal(
    "document",
    Object.assign(new EventTarget(), { visibilityState: "visible" }),
  );
  vi.stubGlobal("HTMLInputElement", class {});
  vi.stubGlobal("HTMLSelectElement", class {});
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
  class Canvas extends EventTarget {
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 256, height: 256 };
    }
    focus() {}
    setPointerCapture() {}
  }
  const canvas = new Canvas();
  const info: ProjectInfo = {
    sessionId: "landscape-controller",
    projectId: "landscape-controller",
    format: 27,
    title: "Controller test",
    sequence: 0,
    savedSequence: 0,
    path: null,
    activeLevels: [],
    sourceTiles: 0,
    landscapeTiles: 0,
    houses: houses.length,
    waters: 0,
    activeLandscapeLevels: [],
  };
  const unexpectedRead = async () => {
    throw new Error("The empty, resident test document needs no source read");
  };
  const storedLandscape = new Map<string, LandscapeTile>();
  const bridge = {
    diagnostics: false,
    onFileAction: vi.fn((handler: typeof fileAction) => {
      fileAction = handler;
      return () => {};
    }),
    status: async () => info,
    readRegion: vi.fn(unexpectedRead),
    readPresentation: vi.fn(unexpectedRead),
    readLandscapeRegion: vi.fn(async (request: ReadLandscapeRegionRequest) => ({
      ...request,
      sequence: info.sequence,
      tiles: [...storedLandscape.values()].filter(
        (tile) =>
          tile.level >= request.minLevel &&
          intersectsBounds(landscapeTileBounds(tile), request.bounds),
      ),
    })),
    readLandscapePresentation: vi.fn(unexpectedRead),
    readHouseRegion: vi.fn(
      async (request: { sessionId: string; bounds: Bounds }) => ({
        ...request,
        sequence: info.sequence,
        headers: houses.filter((house) =>
          intersectsBounds(houseBounds(house), request.bounds),
        ),
      }),
    ),
    readWaterRegion: vi.fn(unexpectedRead),
    commit: vi.fn(async (request: CommitRequest) => {
      info.sequence = request.sequence;
      for (const patch of request.patches)
        if (patch.kind === "landscape") {
          if (patch.after) storedLandscape.set(patch.key, patch.after);
          else storedLandscape.delete(patch.key);
        }
      return {
        sessionId: request.sessionId,
        sequence: request.sequence,
        transactionId: request.transactionId,
      };
    }),
    saveProject: vi.fn(async (request: SaveRequest) => ({
      sessionId: request.sessionId,
      sequence: request.sequence,
      savedSequence: request.sequence,
      path: "/test/landscape.atlas",
    })),
    newProject: vi.fn(async () => null),
    openProject: vi.fn(async () => null),
    metrics: vi.fn(async () => ({
      reads: 0,
      returnedTiles: 0,
      returnedBytes: 0,
      commits: 0,
      committedTiles: 0,
      snapshots: 0,
    })),
  } satisfies AtlasDesktop;
  const controller = new EditorController(
    canvas as unknown as HTMLCanvasElement,
    bridge,
  );
  controllers.push(controller);
  await controller.init();
  controller.setMode("forest");
  controller.setBrush(8, 20);
  controller.setLandscape(2, 100);
  const world = controller.world as typeof controller.world & {
    testDocument: EditorDocument;
    inspectionStatus: string;
  };
  const doc = world.testDocument;
  expect(doc).toBeInstanceOf(EditorDocument);
  expect(controller.state.error).toBeNull();
  expect(controller.state.loading).toBe(false);
  const frame = () => {
    now += 16;
    const pending = [...frames.values()];
    frames.clear();
    for (const callback of pending) callback(now);
  };
  const pointer = (type: string, x = 0, y = 0, coalesced: Point[] = []) => {
    const sample = (point: Point) =>
      Object.assign(new Event(type), {
        button: 0,
        pointerId: 1,
        clientX: 128 + point[0] * 0.25,
        clientY: 128 + point[1] * 0.25,
      });
    const event = sample([x, y]);
    Object.assign(event, { getCoalescedEvents: () => coalesced.map(sample) });
    Object.defineProperty(event, "timeStamp", { value: now });
    canvas.dispatchEvent(event);
  };
  const interrupt = (reason: string) => {
    if (reason === "escape")
      window.dispatchEvent(
        Object.assign(new Event("keydown"), { key: "Escape" }),
      );
    else if (reason === "blur") window.dispatchEvent(new Event("blur"));
    else if (reason === "cancel") pointer("pointercancel");
    else if (reason === "tool-change") controller.setMode("clearing");
    else if (reason === "resize") resized();
    else if (reason === "visibility") {
      Object.assign(document, { visibilityState: "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
    } else throw new Error(`Unknown test interruption: ${reason}`);
  };
  const drain = async () => {
    for (let step = 0; step < 40; step++) {
      frame();
      await settle();
      if (!doc.active && !controller.state.writing) return;
    }
    throw new Error("The accepted landscape action did not drain");
  };
  return {
    controller,
    doc,
    world,
    bridge,
    frame,
    pointer,
    interrupt,
    drain,
    fileAction: (request: Parameters<typeof fileAction>[0]) =>
      fileAction(request),
  };
}

const FOREST = [0, 0, 255, 0];
const CLEAR = [0, 0, 0, 0];

describe("house gestures through the shared controller and writer", () => {
  it.each([false, true])(
    "keeps the captured surface through its own pending foundation colour (drag=%s)",
    async (drag) => {
      const test = await readyController();
      test.controller.setMode("house");
      const capture = vi.spyOn(test.world, "captureFoundation");
      const begin = vi.spyOn(test.doc, "beginHouseGesture");
      vi.spyOn(test.world, "inspectFoundation").mockImplementation(() => ({
        ...test.world.inspectRegion([-100, -100, 100, 100]),
        status: "current",
      }));
      const accept = vi
        .spyOn(test.world, "acceptFoundation")
        .mockImplementation(
          (bounds, receipt) =>
            test.world.inspectFoundation(bounds as Bounds, receipt).status ===
            "current",
        );
      test.pointer("pointerdown");
      expect(test.doc.active).toBe(true);
      expect(capture).toHaveBeenCalledOnce();
      expect(capture.mock.invocationCallOrder[0]).toBeLessThan(
        begin.mock.invocationCallOrder[0],
      );
      // The preview invalidates the colour pass before immediate Up or movement.
      test.world.inspectionStatus = "stale";
      if (drag) {
        test.pointer("pointermove", 40, 20);
        expect(
          test.doc.housesInBounds([-100, -100, 100, 100])[0],
        ).toMatchObject({
          x: 40,
          y: 20,
        });
      }
      test.pointer("pointerup", drag ? 80 : 0, drag ? 40 : 0);
      await test.drain();
      expect(test.doc.housesInBounds([-100, -100, 150, 100])[0]).toMatchObject({
        x: drag ? 80 : 0,
        y: drag ? 40 : 0,
      });
      expect(accept).toHaveBeenCalledTimes(drag ? 3 : 2);
      expect(test.doc.sequence).toBe(1);
      expect(test.doc.metrics.historyActions).toBe(1);
      expect(test.bridge.commit).toHaveBeenCalledOnce();
      expect(test.controller.state.error).toBeNull();
      expect(test.controller["foundation"]).toBeNull();
    },
  );

  it("loads the offscreen part of a selected header and a rotated property edit through the shared read slot", async () => {
    const header: HouseHeader = {
      id: "wide-cold-house",
      revision: 0,
      x: 0,
      y: 0,
      // Remain partly cold beyond the 500ft foundation-transition halo.
      width: 4000,
      depth: 100,
      rotation: 0,
      foundationHeight: 1,
      foundationTransition: 10,
    };
    const test = await readyController([header]);
    test.controller.setMode("select");
    expect(test.doc.isHouseRegionReady(houseBounds(header))).toBe(false);
    test.pointer("pointerdown");
    expect(test.doc.active).toBe(false);
    test.frame();
    await settle();
    expect(test.doc.isHouseRegionReady(houseBounds(header))).toBe(true);
    test.pointer("pointerup");
    test.pointer("pointerdown");
    expect(test.doc.active).toBe(true);
    test.pointer("pointerup");
    expect(test.controller.state.selectedHouse?.id).toBe(header.id);
    expect(test.doc.sequence).toBe(0);
    await test.controller.setHouseSettings({ rotation: 90 });
    await test.drain();
    expect(test.doc.house(header.id)).toMatchObject({ rotation: 90 });
    expect(
      test.bridge.readHouseRegion.mock.calls.some(
        ([request]) => request.bounds[1] <= -2000 && request.bounds[3] >= 2000,
      ),
    ).toBe(true);
    expect(test.doc.sequence).toBe(1);
    expect(test.controller.state.error).toBeNull();
  });
  it.each([
    "escape",
    "blur",
    "visibility",
    "tool-change",
    "resize",
    "pointercancel",
  ])(
    "%s restores a live move, and late Up cannot commit it",
    async (reason) => {
      const test = await readyController();
      test.controller.setMode("house");
      test.pointer("pointerdown");
      expect(test.doc.housesInBounds([-100, -100, 100, 100])).toHaveLength(1);
      expect(test.doc.sequence).toBe(0);
      test.pointer("pointerup");
      await test.drain();
      const original = test.doc.housesInBounds([-100, -100, 100, 100])[0];
      test.controller.setMode("select");
      test.pointer("pointerdown");
      test.pointer("pointermove", 80, 40);
      expect(test.doc.house(original.id)).toMatchObject({ x: 80, y: 40 });
      if (reason === "pointercancel") test.pointer("pointercancel", 80, 40);
      else test.interrupt(reason);
      expect(test.doc.house(original.id)).toEqual(original);
      test.pointer("pointerup", 120, 60);
      await test.drain();
      expect(test.doc.house(original.id)).toEqual(original);
      expect(test.doc.sequence).toBe(1);
      expect(test.bridge.commit).toHaveBeenCalledTimes(1);
      expect(test.controller.state.error).toBeNull();
    },
  );

  it("commits the terminal pose once, and Undo/Redo and Save preserve the identity", async () => {
    const test = await readyController();
    test.controller.setMode("house");
    test.pointer("pointerdown");
    test.pointer("pointerup");
    await test.drain();
    const placed = test.doc.housesInBounds([-100, -100, 100, 100])[0];
    test.controller.setMode("select");
    test.pointer("pointerdown");
    test.pointer("pointermove", 40, 20);
    test.pointer("pointerup", 80, 40);
    test.interrupt("blur");
    test.pointer("pointerup", 160, 80);
    await test.drain();
    expect(test.doc.house(placed.id)).toMatchObject({ x: 80, y: 40 });
    expect(test.doc.sequence).toBe(2);
    expect(test.doc.metrics.historyActions).toBe(2);
    test.controller.undo();
    await test.drain();
    expect(test.doc.house(placed.id)).toEqual(placed);
    test.controller.redo();
    await test.drain();
    expect(test.doc.house(placed.id)).toMatchObject({
      id: placed.id,
      x: 80,
      y: 40,
    });
    await test.controller.save();
    expect(test.bridge.saveProject).toHaveBeenCalledWith(
      expect.objectContaining({ sequence: 4 }),
    );
    expect(test.controller.state.saved).toBe(true);
    expect(
      test.bridge.commit.mock.calls.every(([request]) =>
        request.patches.every((patch) => patch.kind === "house"),
      ),
    ).toBe(true);
  });

  it("selection and a zero-distance drag are no-ops; rotated AABB corners miss", async () => {
    const test = await readyController();
    test.controller.setMode("house");
    test.controller.setHouseSettings({ width: 40, depth: 10, rotation: 45 });
    test.pointer("pointerdown");
    test.pointer("pointerup");
    await test.drain();
    const placed = test.doc.housesInBounds([-100, -100, 100, 100])[0];
    test.controller.setMode("select");
    test.pointer("pointerdown");
    test.pointer("pointerup");
    await test.drain();
    expect(test.controller.state.selectedHouse?.id).toBe(placed.id);
    expect(test.doc.sequence).toBe(1);
    test.pointer("pointerdown", 16, 16);
    test.pointer("pointerup", 16, 16);
    expect(test.controller.state.selectedHouse).toBeNull();
    expect(test.doc.sequence).toBe(1);
    expect(test.bridge.commit).toHaveBeenCalledTimes(1);
  });

  it("mixed landscape, house and setting edits use one history in author order", async () => {
    const test = await readyController();
    test.pointer("pointerdown");
    test.pointer("pointerup");
    await test.drain();
    test.controller.setMode("house");
    test.pointer("pointerdown");
    test.pointer("pointerup");
    await test.drain();
    const id = test.doc.housesInBounds([-100, -100, 100, 100])[0].id;
    test.controller.setMode("select");
    test.controller.setHouseSettings({ rotation: 90, foundationHeight: 5 });
    await test.drain();
    expect(test.doc.house(id)).toMatchObject({
      rotation: 90,
      foundationHeight: 5,
    });
    test.controller.undo();
    await test.drain();
    expect(test.doc.house(id)).toMatchObject({
      rotation: 0,
      foundationHeight: 1,
    });
    test.controller.undo();
    await test.drain();
    expect(test.doc.house(id)).toBeNull();
    expect(test.doc.sampleLandscape(0, 0)).toEqual(FOREST);
    test.controller.undo();
    await test.drain();
    expect(test.doc.sampleLandscape(0, 0)).toEqual(CLEAR);
    for (let step = 0; step < 3; step++) {
      test.controller.redo();
      await test.drain();
    }
    expect(test.doc.house(id)).toMatchObject({
      rotation: 90,
      foundationHeight: 5,
    });
    expect(test.doc.sampleLandscape(0, 0)).toEqual(FOREST);
  });

  it("a missing terminal surface cancels the whole move instead of saving an older pose", async () => {
    const test = await readyController();
    test.controller.setMode("house");
    test.pointer("pointerdown");
    test.pointer("pointerup");
    await test.drain();
    const placed = test.doc.housesInBounds([-100, -100, 100, 100])[0];
    test.controller.setMode("select");
    test.pointer("pointerdown");
    test.pointer("pointermove", 40, 20);
    test.world.inspectionStatus = "missing";
    test.pointer("pointerup", 80, 40);
    await test.drain();
    expect(test.doc.house(placed.id)).toEqual(placed);
    expect(test.doc.sequence).toBe(1);
    expect(test.controller.state.error).toMatch(/Hausbewegung abgebrochen/);
  });

  it("Save during a drag takes its completed current pose and ignores subsequent pointer events", async () => {
    const test = await readyController();
    test.controller.setMode("house");
    test.pointer("pointerdown");
    test.pointer("pointermove", 40, 20);
    await test.controller.save();
    const placed = test.doc.housesInBounds([-100, -100, 100, 100])[0];
    test.pointer("pointerup", 80, 40);
    await test.drain();
    expect(test.doc.house(placed.id)).toMatchObject({ x: 40, y: 20 });
    expect(test.doc.sequence).toBe(1);
    expect(test.bridge.saveProject).toHaveBeenCalledWith(
      expect.objectContaining({ sequence: 1 }),
    );
    expect(test.controller.state.saved).toBe(true);
  });
});

describe("landscape input completion through the actual controller", () => {
  it("explicit Escape before Up rolls back the active stroke", async () => {
    const test = await readyController();
    test.pointer("pointerdown");
    test.frame();
    expect(test.controller.state.error).toBeNull();
    expect(test.doc.sampleLandscape(0, 0)).toEqual(FOREST);
    test.pointer("pointermove", 48);
    test.interrupt("escape");
    expect(test.doc.active).toBe(false);
    expect(test.doc.finishing).toBe(false);
    expect(test.doc.sampleLandscape(0, 0)).toEqual(CLEAR);
    test.pointer("pointerup", 96);
    await test.drain();
    expect(test.doc.sampleLandscape(48, 0)).toEqual(CLEAR);
    expect(test.doc.sampleLandscape(96, 0)).toEqual(CLEAR);
    expect(test.doc.sequence).toBe(0);
    expect(test.doc.metrics.historyActions).toBe(0);
    expect(test.bridge.commit).not.toHaveBeenCalled();
    expect(test.controller.state.error).toBeNull();
  });

  it.each(["blur", "cancel", "tool-change", "resize", "visibility"])(
    "%s before Up preserves accepted painting and seals eligible geometry",
    async (reason) => {
      const test = await readyController();
      test.pointer("pointerdown");
      test.frame();
      test.pointer("pointermove", 48);
      test.interrupt(reason);
      expect(test.doc.sampleLandscape(0, 0)).toEqual(FOREST);
      expect(test.doc.finishing).toBe(true);
      test.pointer("pointerup", 96);
      await test.drain();
      expect(test.doc.sampleLandscape(48, 0)).toEqual(FOREST);
      expect(test.doc.sampleLandscape(96, 0)).toEqual(CLEAR);
      expect(test.doc.sequence).toBe(1);
      expect(test.doc.metrics.historyActions).toBe(1);
      expect(test.bridge.commit).toHaveBeenCalledTimes(1);
      expect(test.controller.state.error).toBeNull();
    },
  );

  it.each(["escape", "blur", "tool-change", "resize", "visibility"])(
    "%s after Up preserves the captured endpoint and one history action",
    async (reason) => {
      const test = await readyController();
      test.pointer("pointerdown");
      test.frame();
      test.pointer("pointermove", 48);
      test.pointer("pointerup", 96);
      expect(test.doc.active).toBe(true);
      expect(test.doc.finishing).toBe(true);
      expect(test.doc.sampleLandscape(96, 0)).toEqual(CLEAR);
      test.interrupt(reason);
      // Presentation becoming stale after admission cannot revoke accepted geometry.
      test.world.inspectionStatus = "stale";
      expect(test.doc.active).toBe(true);
      expect(test.doc.finishing).toBe(true);
      test.frame();
      expect(test.doc.sampleLandscape(48, 0)).toEqual(FOREST);
      await settle();
      expect(test.doc.sampleLandscape(96, 0)).toEqual(FOREST);
      expect(test.doc.active).toBe(false);
      expect(test.doc.finishing).toBe(false);
      expect(test.doc.sequence).toBe(1);
      expect(test.doc.metrics.historyActions).toBe(1);
      expect(test.doc.canUndo).toBe(true);
      expect(test.bridge.commit).toHaveBeenCalledTimes(1);
      expect(
        test.bridge.commit.mock.calls[0][0].patches.every(
          (patch) => patch.kind === "landscape",
        ),
      ).toBe(true);
      expect(test.controller.state.error).toBeNull();
    },
  );

  it("repeated Up cannot extend the sealed path or commit it twice", async () => {
    const test = await readyController();
    test.pointer("pointerdown");
    test.frame();
    test.pointer("pointermove", 48);
    test.pointer("pointerup", 96);
    test.pointer("pointerup", 192);
    test.pointer("pointerup", 240);
    await test.drain();
    test.pointer("pointerup", 288);
    await test.drain();
    expect(test.doc.sampleLandscape(96, 0)).toEqual(FOREST);
    expect(test.doc.sampleLandscape(192, 0)).toEqual(CLEAR);
    expect(test.doc.sampleLandscape(240, 0)).toEqual(CLEAR);
    expect(test.doc.sampleLandscape(288, 0)).toEqual(CLEAR);
    expect(test.doc.sequence).toBe(1);
    expect(test.doc.metrics.historyActions).toBe(1);
    expect(test.bridge.commit).toHaveBeenCalledTimes(1);
    expect(test.controller.state.error).toBeNull();
  });

  it("keeps a thousand collinear input samples without an event-rate backlog", async () => {
    const test = await readyController();
    const materialize = vi.spyOn(test.doc, "applyLandscapeSegments");
    test.pointer("pointerdown");
    for (let step = 1; step <= 1000; step++)
      test.pointer("pointermove", step * 0.4);
    test.pointer("pointerup", 400);
    expect(test.controller.state.error).toBeNull();
    await test.drain();
    expect(materialize).toHaveBeenCalledTimes(1);
    for (const x of [0, 64, 128, 256, 400])
      expect(test.doc.sampleLandscape(x, 0)).toEqual(FOREST);
    expect(test.doc.sampleLandscape(200, 40)).toEqual(CLEAR);
    expect(test.doc.metrics.historyActions).toBe(1);
    expect(test.bridge.commit).toHaveBeenCalledTimes(1);
    expect(test.controller.state.error).toBeNull();
  });

  it("drains high-rate coalesced curves in bounded batches while retaining corners and the terminal point", async () => {
    const test = await readyController();
    const materialize = vi.spyOn(test.doc, "applyLandscapeSegments");
    const brush = test.controller.currentLandscapeBrush();
    const points: Point[] = [];
    test.pointer("pointerdown");
    test.frame();
    for (let frame = 0; frame < 12; frame++) {
      const samples: Point[] = Array.from({ length: 16 }, (_, index) => {
        const ordinal = frame * 16 + index + 1;
        return [ordinal * 1.8, ordinal % 2 ? 24 : -24];
      });
      points.push(...samples);
      const last = samples.at(-1)!;
      test.pointer("pointermove", last[0], last[1], samples);
      test.frame();
      await settle();
      expect(test.controller.state.error).toBeNull();
      expect(test.doc.sampleLandscape(...last)).toEqual(FOREST);
    }
    // Coalesced samples need not contain the dispatch event's final location.
    test.pointer("pointermove", 400, 48, [
      [360, -24],
      [380, 24],
    ]);
    test.pointer("pointerup", 416, 64);
    await test.drain();
    for (const point of [...points, [380, 24], [400, 48], [416, 64]] as Point[])
      expect(test.doc.sampleLandscape(...point)).toEqual(FOREST);
    expect(test.doc.sampleLandscape(200, 96)).toEqual(CLEAR);
    expect(materialize.mock.calls.some(([path]) => path.length > 3)).toBe(true);
    for (const [path] of materialize.mock.calls) {
      expect(path.length).toBeLessThanOrEqual(LANDSCAPE_BATCH_POINT_LIMIT + 1);
      const cells = path
        .slice(1)
        .reduce(
          (sum, point, index) =>
            sum + landscapeSegmentCellCost(brush, path[index], point),
          0,
        );
      expect(cells).toBeLessThanOrEqual(LANDSCAPE_BATCH_CELL_LIMIT);
    }
    expect(test.doc.metrics.historyActions).toBe(1);
    expect(test.bridge.commit).toHaveBeenCalledTimes(1);
  });

  it("splits a long diagonal into bounded work without changing its footprint or endpoint", async () => {
    const test = await readyController();
    const materialize = vi.spyOn(test.doc, "applyLandscapeSegments");
    const brush = test.controller.currentLandscapeBrush();
    test.pointer("pointerdown");
    test.pointer("pointerup", 400, 400);
    await test.drain();
    expect(materialize.mock.calls.length).toBeGreaterThan(1);
    for (const [path] of materialize.mock.calls) {
      const cost = path
        .slice(1)
        .reduce(
          (sum, point, index) =>
            sum + landscapeSegmentCellCost(brush, path[index], point),
          0,
        );
      expect(cost).toBeLessThanOrEqual(LANDSCAPE_BATCH_CELL_LIMIT);
    }
    for (const x of [0, 64, 128, 256, 400])
      expect(test.doc.sampleLandscape(x, x)).toEqual(FOREST);
    expect(test.doc.sampleLandscape(100, 200)).toEqual(CLEAR);
    expect(test.doc.metrics.historyActions).toBe(1);
    expect(test.controller.state.error).toBeNull();
  });

  it("does not turn a ready diagonal corridor into a larger unavailable source rectangle", async () => {
    const test = await readyController();
    const brush = test.controller.currentLandscapeBrush();
    test.pointer("pointerdown");
    test.frame();
    test.doc.retainLandscapeSources([
      { bounds: [-16, -16, 16, 16], minLevel: brush.level },
    ]);
    const points: Point[] = [];
    for (let value = 8; value <= 160; value += 8) {
      test.doc.acceptLandscapeCoverage(
        [value - 24, value - 24, value + 16, value + 16],
        [],
        0,
        test.doc.sessionId,
        brush.level,
      );
      points.push([value, value]);
    }
    expect(test.doc.isLandscapeReady([-16, -16, 176, 176], brush.level)).toBe(
      false,
    );
    test.pointer("pointermove", 160, 160, points);
    test.pointer("pointerup", 160, 160);
    await test.drain();
    expect(test.controller.state.error).toBeNull();
    for (const point of [
      [0, 0],
      [64, 64],
      [128, 128],
      [160, 160],
    ] as Point[])
      expect(test.doc.readLandscapeCell(brush.level, ...point)).toEqual(FOREST);
    expect(test.doc.metrics.historyActions).toBe(1);
  });

  it("pressure seals eligible geometry without erasing its materialized prefix or replaying rejected movement", async () => {
    const test = await readyController();
    test.pointer("pointerdown");
    test.frame();
    for (let index = 0; index < 160; index++)
      test.pointer("pointermove", index % 2 ? -48 : 48);
    expect(test.controller.state.error).toMatch(/Arbeitsgrenze/);
    expect(test.doc.sampleLandscape(0, 0)).toEqual(FOREST);
    test.pointer("pointerup", 200);
    await test.drain();
    for (const x of [-48, 0, 48])
      expect(test.doc.sampleLandscape(x, 0)).toEqual(FOREST);
    expect(test.doc.sampleLandscape(200, 0)).toEqual(CLEAR);
    expect(test.doc.metrics.historyActions).toBe(1);
    expect(test.bridge.commit).toHaveBeenCalledTimes(1);
    await test.controller.save();
    expect(test.bridge.saveProject).toHaveBeenCalledWith(
      expect.objectContaining({ sequence: 1 }),
    );
  });

  it("a failed batch after Up keeps prior strokes and the materialized prefix through Save and Undo", async () => {
    const test = await readyController();
    test.pointer("pointerdown", -180);
    test.pointer("pointerup", -180);
    await test.drain();
    test.pointer("pointerdown");
    test.frame();
    test.pointer("pointermove", 48);
    test.pointer("pointerup", 96);
    vi.spyOn(test.doc, "applyLandscapeSegments").mockImplementationOnce(() => {
      throw new RangeError("Injected source capacity failure");
    });
    await test.drain();
    expect(test.controller.state.error).toMatch(/source capacity failure/);
    expect(test.doc.sampleLandscape(-180, 0)).toEqual(FOREST);
    expect(test.doc.sampleLandscape(0, 0)).toEqual(FOREST);
    expect(test.doc.sampleLandscape(96, 0)).toEqual(CLEAR);
    expect(test.doc.sequence).toBe(2);
    expect(test.doc.metrics.historyActions).toBe(2);
    await test.controller.save();
    expect(test.bridge.saveProject).toHaveBeenCalledWith(
      expect.objectContaining({ sequence: 2 }),
    );
    test.controller.undo();
    await test.drain();
    expect(test.doc.sampleLandscape(0, 0)).toEqual(CLEAR);
    expect(test.doc.sampleLandscape(-180, 0)).toEqual(FOREST);
    test.controller.redo();
    await test.drain();
    expect(test.doc.sampleLandscape(0, 0)).toEqual(FOREST);
    expect(test.doc.sampleLandscape(96, 0)).toEqual(CLEAR);
  });

  it("a landscape projection failure cannot erase a successfully materialized batch", async () => {
    const test = await readyController();
    test.pointer("pointerdown");
    test.frame();
    test.pointer("pointerup", 96);
    vi.spyOn(test.world, "updateLandscape").mockImplementationOnce(() => {
      throw new Error("Injected presentation failure");
    });
    await test.drain();
    expect(test.controller.state.error).toMatch(/presentation failure/);
    expect(test.doc.sampleLandscape(0, 0)).toEqual(FOREST);
    expect(test.doc.sampleLandscape(96, 0)).toEqual(FOREST);
    expect(test.doc.metrics.historyActions).toBe(1);
    expect(test.bridge.commit).toHaveBeenCalledTimes(1);
    test.controller.undo();
    await test.drain();
    expect(test.doc.sampleLandscape(96, 0)).toEqual(CLEAR);
  });

  it("a permanently failed GPU fence releases the sealed action and Save barrier while retaining its painted prefix", async () => {
    const test = await readyController();
    test.pointer("pointerdown");
    test.frame();
    test.pointer("pointermove", 48);
    test.pointer("pointerup", 96);
    expect(test.doc.sampleLandscape(0, 0)).toEqual(FOREST);
    expect(test.doc.finishing).toBe(true);
    const reset = vi.spyOn(test.world, "reset");
    const poll = vi
      .spyOn(test.world, "pollCompletion")
      .mockImplementation(() => {
        throw new Error("Permanent WAIT_FAILED");
      });
    let acknowledge!: () => void;
    const commit = test.bridge.commit.getMockImplementation()!;
    test.bridge.commit.mockImplementationOnce(async (request) => {
      const receipt = await commit(request);
      return new Promise((resolve) => {
        acknowledge = () => resolve(receipt);
      });
    });
    let saved = false;
    const saving = test.controller.save().then(() => {
      saved = true;
    });
    await settle();
    expect(test.bridge.saveProject).not.toHaveBeenCalled();
    test.frame();
    await settle();
    expect(test.doc.active).toBe(false);
    expect(test.doc.finishing).toBe(false);
    expect(test.doc.sampleLandscape(0, 0)).toEqual(FOREST);
    expect(test.doc.sampleLandscape(48, 0)).toEqual(CLEAR);
    expect(test.doc.sampleLandscape(96, 0)).toEqual(CLEAR);
    expect(test.doc.metrics.historyActions).toBe(1);
    expect(test.doc.pendingChanges()).toHaveLength(1);
    expect(test.bridge.commit).toHaveBeenCalledTimes(1);
    expect(test.bridge.saveProject).not.toHaveBeenCalled();
    expect(saved).toBe(false);
    // Repeated failures cannot resurrect the tail, re-commit, or replace more
    // renderer fields. The existing reset path retains the outstanding fences.
    test.frame();
    test.frame();
    await settle();
    expect(poll).toHaveBeenCalledTimes(3);
    expect(reset).toHaveBeenCalledTimes(1);
    expect(test.doc.pendingChanges()).toHaveLength(1);
    expect(test.controller.state.error).toBe("Permanent WAIT_FAILED");
    acknowledge();
    await saving;
    expect(saved).toBe(true);
    expect(test.bridge.saveProject).toHaveBeenCalledExactlyOnceWith({
      sessionId: test.doc.sessionId,
      sequence: 1,
      saveAs: false,
    });
    expect(test.doc.pendingChanges()).toEqual([]);
    test.controller.undo();
    await test.drain();
    expect(test.doc.sampleLandscape(0, 0)).toEqual(CLEAR);
    expect(test.doc.sequence).toBe(2);
    expect(test.doc.canRedo).toBe(true);
    expect(test.doc.sampleLandscape(96, 0)).toEqual(CLEAR);
  });

  it("prefetches and retains a bounded author neighborhood across a warm source-tile boundary", async () => {
    const test = await readyController();
    test.doc.retainLandscapeSources([
      { bounds: [-32, -32, 32, 32], minLevel: 0 },
    ]);
    test.pointer("pointermove", 48);
    test.frame();
    await settle();
    const request = test.bridge.readLandscapeRegion.mock.calls.at(-1)![0];
    const span = 64 * 2 ** request.minLevel;
    expect(request.bounds[0]).toBeLessThan(0);
    expect(request.bounds[2]).toBeGreaterThan(128);
    expect(request.bounds[2] - request.bounds[0]).toBeLessThanOrEqual(span * 4);
    expect(request.bounds[3] - request.bounds[1]).toBeLessThanOrEqual(span * 4);
    expect(
      test.doc.isLandscapeReady([160, -16, 192, 16], request.minLevel),
    ).toBe(true);
    test.pointer("pointerdown", 48);
    test.frame();
    test.pointer("pointermove", 128);
    test.frame();
    test.pointer("pointerup", 176);
    await test.drain();
    for (const x of [48, 96, 128, 176])
      expect(test.doc.readLandscapeCell(request.minLevel, x, 0)).toEqual(
        FOREST,
      );
    expect(test.controller.state.error).toBeNull();
  });

  it("a cold source boundary keeps the accepted prefix and never paints the rejected gap after loading", async () => {
    const test = await readyController();
    const level = test.controller.currentLandscapeBrush().level;
    test.pointer("pointerdown");
    test.frame();
    test.doc.retainLandscapeSources([
      { bounds: [-32, -32, 32, 32], minLevel: 0 },
    ]);
    test.pointer("pointermove", 128);
    test.pointer("pointerup", 128);
    await test.drain();
    expect(test.controller.state.error).toMatch(/noch nicht bereit/);
    expect(test.doc.readLandscapeCell(level, 0, 0)).toEqual(FOREST);
    expect(test.doc.readLandscapeCell(level, 64, 0)).toBeNull();
    expect(test.doc.readLandscapeCell(level, 128, 0)).toBeNull();
    test.pointer("pointerdown", 128);
    test.pointer("pointerup", 128);
    await test.drain();
    expect(test.doc.readLandscapeCell(level, 128, 0)).toEqual(FOREST);
    expect(test.doc.readLandscapeCell(level, 64, 0)).toBeNull();
    expect(test.doc.metrics.historyActions).toBe(2);
  });

  it.each(["move-then-up", "terminal-up"])(
    "%s rejects unavailable terrain while preserving the accepted prefix",
    async (ending) => {
      const test = await readyController();
      test.pointer("pointerdown");
      test.frame();
      expect(test.doc.sampleLandscape(0, 0)).toEqual(FOREST);
      test.world.inspectionStatus = "stale";
      if (ending === "move-then-up") test.pointer("pointermove", 96);
      test.pointer("pointerup", 96);
      await test.drain();
      expect(test.doc.active).toBe(false);
      expect(test.doc.sampleLandscape(0, 0)).toEqual(FOREST);
      expect(test.doc.sampleLandscape(96, 0)).toEqual(CLEAR);
      expect(test.doc.sequence).toBe(1);
      expect(test.doc.metrics.historyActions).toBe(1);
      expect(test.bridge.commit).toHaveBeenCalledTimes(1);
      expect(test.controller.state.error).toMatch(/noch nicht bereit/);
      test.world.inspectionStatus = "current";
      test.pointer("pointermove", 96);
      await test.drain();
      expect(test.doc.sampleLandscape(96, 0)).toEqual(CLEAR);
      test.controller.undo();
      await test.drain();
      expect(test.doc.sampleLandscape(0, 0)).toEqual(CLEAR);
    },
  );

  it("retains the accepted foundation of a region that became ready during the stroke", async () => {
    const test = await readyController();
    const accepted: Bounds[] = [];
    let lateRegionCurrent = false;
    const inspect = (bounds: Bounds) => ({
      status:
        bounds[2] <= 32 ||
        lateRegionCurrent ||
        accepted.some(
          (proof) =>
            bounds[0] >= proof[0] &&
            bounds[1] >= proof[1] &&
            bounds[2] <= proof[2] &&
            bounds[3] <= proof[3],
        )
          ? ("current" as const)
          : ("missing" as const),
      sessionId: test.doc.sessionId,
      frame: 1,
      viewGeneration: 1,
    });
    vi.spyOn(test.world, "inspectFoundation").mockImplementation(inspect);
    vi.spyOn(test.world, "acceptFoundation").mockImplementation((influence) => {
      const bounds = influence as Bounds;
      if (inspect(bounds).status !== "current") return false;
      accepted.push([...bounds]);
      return true;
    });
    vi.spyOn(test.world, "updateLandscape").mockImplementation(() => {
      if (test.doc.sampleLandscape(48, 0)[2] > 0) lateRegionCurrent = false;
    });
    test.pointer("pointerdown");
    test.frame();
    lateRegionCurrent = true;
    test.pointer("pointermove", 48);
    test.frame();
    expect(test.doc.sampleLandscape(48, 0)).toEqual(FOREST);
    expect(lateRegionCurrent).toBe(false);
    // This second footprint is inside the newly captured proof, now dirty from
    // our own materialization. Observing readiness alone must not lose it.
    test.pointer("pointermove", 40);
    expect(test.doc.active).toBe(true);
    expect(test.controller.state.error).toBeNull();
    test.pointer("pointerup", 40);
    await test.drain();
    expect(test.doc.sampleLandscape(40, 0)).toEqual(FOREST);
    expect(test.doc.sampleLandscape(48, 0)).toEqual(FOREST);
    expect(test.doc.sequence).toBe(1);
    expect(test.doc.metrics.historyActions).toBe(1);
    expect(test.bridge.commit).toHaveBeenCalledTimes(1);
  });

  it("Save waits for the final RAF and its durable commit receipt", async () => {
    const test = await readyController();
    let acknowledge!: () => void;
    test.bridge.commit.mockImplementationOnce(
      (request) =>
        new Promise((resolve) => {
          acknowledge = () =>
            resolve({
              sessionId: request.sessionId,
              sequence: request.sequence,
              transactionId: request.transactionId,
            });
        }),
    );
    test.pointer("pointerdown");
    test.frame();
    test.pointer("pointermove", 48);
    test.pointer("pointerup", 96);
    let saved = false;
    const saving = test.controller.save().then(() => {
      saved = true;
    });
    await settle();
    expect(saved).toBe(false);
    expect(test.bridge.commit).not.toHaveBeenCalled();
    expect(test.bridge.saveProject).not.toHaveBeenCalled();
    test.frame();
    await settle();
    expect(test.doc.sampleLandscape(96, 0)).toEqual(FOREST);
    expect(test.doc.active).toBe(false);
    expect(test.bridge.commit).toHaveBeenCalledTimes(1);
    expect(test.bridge.saveProject).not.toHaveBeenCalled();
    expect(saved).toBe(false);
    acknowledge();
    await saving;
    expect(test.bridge.saveProject).toHaveBeenCalledExactlyOnceWith({
      sessionId: test.doc.sessionId,
      sequence: 1,
      saveAs: false,
    });
    expect(test.controller.state.saved).toBe(true);
    expect(test.controller.state.error).toBeNull();
  });

  it("native file preparation waits while its input lock preserves the sealed path", async () => {
    const test = await readyController();
    test.pointer("pointerdown");
    test.frame();
    test.pointer("pointermove", 48);
    test.pointer("pointerup", 96);
    let prepared = false;
    const preparation = test.fileAction({ kind: "prepare" }).then((result) => {
      prepared = true;
      return result;
    });
    await settle();
    expect(test.controller.state.fileAction).toBe(true);
    expect(prepared).toBe(false);
    expect(test.doc.finishing).toBe(true);
    await test.drain();
    expect(await preparation).toEqual({
      sessionId: test.doc.sessionId,
      sequence: 1,
      persistenceError: null,
    });
    expect(test.doc.sampleLandscape(96, 0)).toEqual(FOREST);
    expect(test.doc.metrics.historyActions).toBe(1);
    expect(test.bridge.commit).toHaveBeenCalledTimes(1);
    await test.fileAction({ kind: "resume" });
    expect(test.controller.state.fileAction).toBe(false);
    expect(test.controller.state.error).toBeNull();
  });

  it("Undo waits for Up's endpoint and Redo restores that entire action", async () => {
    const test = await readyController();
    test.pointer("pointerdown");
    test.frame();
    test.pointer("pointermove", 48);
    test.pointer("pointerup", 96);
    test.controller.undo();
    await settle();
    expect(test.doc.finishing).toBe(true);
    expect(test.doc.sequence).toBe(0);
    expect(test.doc.sampleLandscape(0, 0)).toEqual(FOREST);
    await test.drain();
    expect(test.doc.sequence).toBe(2);
    expect(test.doc.canUndo).toBe(false);
    expect(test.doc.canRedo).toBe(true);
    expect(test.doc.sampleLandscape(0, 0)).toEqual(CLEAR);
    expect(test.doc.sampleLandscape(96, 0)).toEqual(CLEAR);
    expect(
      test.bridge.commit.mock.calls.map(([request]) => request.sequence),
    ).toEqual([1, 2]);
    test.controller.redo();
    await settle();
    expect(test.doc.sequence).toBe(3);
    expect(test.doc.sampleLandscape(0, 0)).toEqual(FOREST);
    expect(test.doc.sampleLandscape(48, 0)).toEqual(FOREST);
    expect(test.doc.sampleLandscape(96, 0)).toEqual(FOREST);
    expect(test.doc.metrics.historyActions).toBe(1);
    expect(
      test.bridge.commit.mock.calls.map(([request]) => request.sequence),
    ).toEqual([1, 2, 3]);
    expect(test.controller.state.error).toBeNull();
  });
});
