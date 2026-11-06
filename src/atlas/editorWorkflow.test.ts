import { deferred } from "../../tests/support/deferred";
import {
  status,
  workflowObjects,
  preview,
} from "../../tests/support/atlasFixtures";
import type { WorkflowGate } from "./editorWorkflow";
import { WireError } from "../wireError";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EditorWorkflowController,
  type WorkflowPorts,
} from "./editorWorkflowController";
import {
  intentRoute,
  isExact,
  isOwner,
  sameCandidate,
  transition,
  workflowPointer,
  workflowPreview,
  type EditorWorkflow,
  type ExactWorkflow,
} from "./editorWorkflow";
import { evaluateGesture, type Gesture } from "./interaction";
import {
  defaultPopulation,
  toWorld,
  type Intent,
  type MapObject,
  type Preview,
  type Scene,
  type ValidPreview,
  type WorldPoint,
} from "./model";
import { editRoadDraft, extensionRoadDraft, newRoadDraft } from "./roadDraft";
import { parcelTransform } from "./parcelEditor";

const { road, parcel, house } = workflowObjects();

const flush = async () => {
  for (let n = 0; n < 8; n++) await Promise.resolve();
};
function harness() {
  let gate: WorkflowGate = {
    version: status(),
    pending: 0,
    exclusive: false,
    uncertain: false,
  };
  let objects: MapObject[] = structuredClone([road, parcel, house]);
  let context = "exterior:0";
  const ports: WorkflowPorts = {
    gate: () => gate,
    context: () => context,
    source: () => ({
      scene: {
        status: { ...status(), ...gate.version },
        objects,
        contextState: { exists: false, houseId: null, parcelId: null },
        selectionState: {
          exists: true,
          houseId: objects.some((o) => o.id === house.id && o.kind === "house")
            ? house.id
            : null,
          parcelId: parcel.id,
        },
      },
    }),
    inspect: vi.fn(async (action, version) => ({
      ...preview(version),
      actionId: action.operationId,
    })),
    cancelInspect: vi.fn(),
    commitExact: vi.fn(async (_action, version, owns) =>
      owns() ? preview(version) : null,
    ),
    queue: vi.fn(async () => preview()),
    read: vi.fn(async (id, version) => ({
      status: { ...status(), ...version },
      objects,
      contextState: { exists: false, houseId: null, parcelId: null },
      selectionState: {
        exists: objects.some((o) => o.id === id),
        houseId: id === house.id ? house.id : null,
        parcelId: id === house.id || id === parcel.id ? parcel.id : null,
      },
    })),
    completed: vi.fn(),
    error: vi.fn(),
  };
  const c = new EditorWorkflowController(ports);
  const exact = () => {
    const s = c.getSnapshot();
    if (!isExact(s)) throw Error(`Expected exact, got ${s.kind}`);
    return s;
  };
  const update = () => {
    c.sync();
  };
  const node = (pointer = 1): Gesture => ({
    pointer,
    start: [80, 0],
    screen: [0, 0],
    kind: "node",
    object: editRoadDraft(road),
    index: 1,
    handle: "point",
  });
  const evaluate = (
    g: Gesture,
    point: WorldPoint,
    finish = true,
    screen: [number, number] = [30, 30],
  ) =>
    c.evaluate(
      evaluateGesture(g, {
        pointer: g.pointer,
        point,
        screen,
        snapped: point,
        finish,
      })!,
      finish,
    );
  c.sync();
  return {
    c,
    ports,
    exact,
    node,
    evaluate,
    update,
    get gate() {
      return gate;
    },
    set gate(g) {
      gate = g;
    },
    get objects() {
      return objects;
    },
    set objects(v) {
      objects = v;
    },
    set context(v: string) {
      context = v;
    },
  };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("pure workflow transitions", () => {
  it("keeps rejection and recheck transitions bound to their candidate and request", () => {
    const h = harness();
    h.c.beginGesture(h.node());
    h.evaluate(h.node(), [90, 0], false);
    const editing = h.exact();
    if (!editing.candidate) throw Error("missing candidate");
    const candidate = editing.candidate;
    const committing: ExactWorkflow = {
      ...editing,
      pointer: null,
      stage: { phase: "committing" },
    };
    expect(
      transition(committing, {
        type: "commitRejected",
        candidate: { ...candidate.token, candidateId: -1 },
        message: "old",
      }),
    ).toBe(committing);
    const rejected = transition(committing, {
      type: "commitRejected",
      candidate: candidate.token,
      message: "collision",
    });
    expect(isExact(rejected) && rejected.stage.phase).toBe("failed");
    expect(isExact(rejected) && rejected.candidate?.autoFinish).toBe(false);
    const fresh = {
      ...candidate,
      token: {
        ...candidate.token,
        candidateId: candidate.token.candidateId + 1,
        version: status(1),
      },
      autoFinish: false,
    };
    const request = { candidate: fresh.token, requestId: 42 };
    const refreshing = transition(rejected, {
      type: "refresh",
      candidate: fresh,
      request,
    });
    expect(isExact(refreshing) && refreshing.basis).toEqual(status(1));
    expect(
      transition(refreshing, {
        type: "refreshed",
        request: { ...request, requestId: 41 },
        candidate: fresh,
        guide: null,
      }),
    ).toBe(refreshing);
    const refreshed = transition(refreshing, {
      type: "refreshed",
      request,
      candidate: fresh,
      guide: null,
    });
    expect(isExact(refreshed) && refreshed.stage.phase).toBe("checking");
    h.c.dispose();
  });
  it("routes every wire intent explicitly, with metadata and interiors on the queue", () => {
    const types: Intent["type"][] = [
      "createRoad",
      "updateRoad",
      "insertRoadNode",
      "deleteRoadNode",
      "extendRoad",
      "createParcelHouse",
      "detachParcel",
      "createArea",
      "updateArea",
      "createHouse",
      "transformHouse",
      "delete",
      "populate",
      "room",
      "connection",
      "rename",
      "roof",
    ];
    for (const type of types)
      expect(intentRoute({ type } as Intent)).toBe(
        ["room", "connection", "rename", "roof"].includes(type)
          ? "queue"
          : "exact",
      );
  });
  it("rejects every wrong workflow, candidate, request and version identity, including old no-ops", async () => {
    const h = harness();
    const held = deferred<Preview>();
    h.ports.inspect = vi.fn(async (action) => ({
      ...(await held.promise),
      actionId: action.operationId,
    }));
    h.c.beginGesture(h.node());
    h.evaluate(h.node(), [90, 0], false);
    await vi.advanceTimersByTimeAsync(100);
    const s = h.exact();
    if (s.stage.phase !== "checking") throw Error();
    const request = s.stage.request;
    for (const wrong of [
      { ...request, requestId: request.requestId + 1 },
      {
        ...request,
        candidate: {
          ...request.candidate,
          workflowId: request.candidate.workflowId + 1,
        },
      },
      {
        ...request,
        candidate: {
          ...request.candidate,
          candidateId: request.candidate.candidateId + 1,
        },
      },
      { ...request, candidate: { ...request.candidate, version: status(1) } },
    ]) {
      expect(
        transition(s, {
          type: "preview",
          request: wrong,
          preview: { ...preview(status(), false), actionId: 0 },
        }),
      ).toBe(s);
      expect(
        transition(s, { type: "failure", request: wrong, message: "old" }),
      ).toBe(s);
    }
    expect(
      transition(s, {
        type: "preview",
        request,
        preview: { ...preview(status(1)), actionId: 0 },
      }),
    ).toBe(s);
    h.c.cancel();
    h.c.beginGesture(h.node());
    h.evaluate(h.node(), [90, 0], false);
    await vi.advanceTimersByTimeAsync(100);
    expect(sameCandidate(h.exact().candidate!.token, request.candidate)).toBe(
      false,
    );
    held.resolve(preview(status(), false));
    await flush();
    expect(h.exact().stage.phase).toBe("unchanged");
  });
  it("requires a checked ConfirmDelete and never accepts a pointer-active checked proposal", async () => {
    const h = harness();
    h.c.beginGesture(h.node());
    h.evaluate(h.node(), [90, 0], false);
    await vi.advanceTimersByTimeAsync(100);

    const moving = h.exact();
    expect(moving.stage.phase).toBe("checked");
    expect(transition(moving, { type: "accept", deletion: false })).toBe(
      moving,
    );
    h.c.cancel();
    void h.c.beginIntent({ type: "delete", id: road.id }, false);
    await flush();

    const deleting = h.exact();
    expect(transition(deleting, { type: "accept", deletion: false })).toBe(
      deleting,
    );
    expect(
      (
        transition(deleting, {
          type: "accept",
          deletion: true,
        }) as ExactWorkflow
      ).stage.phase,
    ).toBe("committing");
  });
});

describe("single workflow owner and effect boundaries", () => {
  it("uses pointerup's own immutable final geometry and ignores a late valid move response", async () => {
    const h = harness(),
      held = deferred<Preview>();
    h.ports.inspect = vi.fn(async (action) => ({
      ...(await held.promise),
      actionId: action.operationId,
    }));
    const g = h.node();
    h.c.beginGesture(g);
    h.evaluate(g, [90, 0], false);
    await vi.advanceTimersByTimeAsync(100);
    const previous = h.exact().candidate!;
    h.evaluate(g, [80, 150], true);
    expect(h.exact().candidate!.intent).toMatchObject({
      type: "updateRoad",
      road: { nodes: [{}, { point: [80, 150] }] },
    });
    expect(previous.intent).toMatchObject({
      road: { nodes: [{}, { point: [90, 0] }] },
    });
    expect(h.exact().candidate!.token.candidateId).toBeGreaterThan(
      previous.token.candidateId,
    );
    expect(h.ports.commitExact).toHaveBeenCalledTimes(1);
    held.resolve(preview());
    await flush();

    await flush();
    expect(h.ports.commitExact).toHaveBeenCalledTimes(1);
  });
  it("accepts Enter during checking and atomically rejects double accept before held transport returns", async () => {
    const h = harness(),
      held = deferred<ValidPreview | null>();
    const draft = newRoadDraft({
      name: "Straße",
      width: 10,
      material: "earth",
    });
    draft.nodes = road.nodes.map(({ point, incoming, outgoing }) => ({
      point,
      incoming,
      outgoing,
    }));
    h.c.beginDraft(draft);
    h.ports.inspect = vi.fn(() => new Promise<null>(() => {}));
    await vi.advanceTimersByTimeAsync(100);

    expect(h.c.canAccept()).toBe(true);
    expect(h.ports.commitExact).not.toHaveBeenCalled();
    h.ports.commitExact = vi.fn(() => held.promise);
    void h.c.accept();
    void h.c.accept();
    expect(h.exact().stage.phase).toBe("committing");
    expect(h.ports.commitExact).toHaveBeenCalledTimes(1);
    held.resolve(preview());
    await flush();
    expect(h.c.getSnapshot().kind).toBe("idle");
  });
  it("finishes final no-ops with one core validation and no repeated write, keeps manual no-ops editable, and closes missing delete targets", async () => {
    const h = harness();
    h.ports.inspect = vi.fn(async (action, v) => ({
      ...preview(v, false),
      actionId: action.operationId,
    }));
    h.ports.commitExact = vi.fn(async () => preview(status(), false));
    h.c.beginGesture(h.node());
    h.evaluate(h.node(), [90, 0]);
    await flush();
    expect(h.c.getSnapshot().kind).toBe("idle");
    expect(h.ports.commitExact).toHaveBeenCalledTimes(1);
    void h.c.beginIntent(
      { type: "populate", roadId: road.id, settings: defaultPopulation },
      false,
    );
    await vi.advanceTimersByTimeAsync(100);
    expect(h.exact().stage.phase).toBe("unchanged");
    expect(h.c.canAccept()).toBe(false);
    void h.c.beginIntent({ type: "delete", id: road.id }, false);
    await flush();
    expect(h.c.getSnapshot().kind).toBe("idle");
    expect(h.ports.error).toHaveBeenCalledWith("Bereits entfernt.");
  });
  it("normal capture release after pointerup preserves the admitted commit; matching active capture loss aborts", async () => {
    const h = harness(),
      held = deferred<Preview>();
    h.ports.inspect = vi.fn(async (a) => ({
      ...(await held.promise),
      actionId: a.operationId,
    }));
    const g = h.node();
    h.c.beginGesture(g);
    h.evaluate(g, [90, 0]);
    const final = h.c.getSnapshot();
    h.c.abortPointer(g.pointer);
    expect(h.c.getSnapshot()).toBe(final);
    h.c.beginGesture(h.node(2));
    h.c.abortPointer(1);
    expect(workflowPointer(h.c.getSnapshot())?.pointer).toBe(2);
    h.c.abortPointer(2);
    expect(h.c.getSnapshot().kind).toBe("idle");
    held.resolve(preview());
    await flush();
    expect(h.ports.commitExact).toHaveBeenCalledTimes(1);
  });
  it("restores the last completed new-road node on abort and retains it through pan", async () => {
    const h = harness();
    const draft = newRoadDraft({
      name: "Straße",
      width: 10,
      material: "earth",
    });
    draft.nodes = [{ point: [0, 0], incoming: null, outgoing: null }];
    h.c.beginDraft(draft);
    const next = {
      ...draft,
      nodes: [
        ...draft.nodes,
        { point: [80, 0] as WorldPoint, incoming: null, outgoing: null },
      ],
    };
    h.c.beginGesture(
      {
        kind: "newNode",
        pointer: 1,
        start: [80, 0],
        screen: [0, 0],
        draft: next,
        index: 1,
      },
      draft,
    );
    h.c.abortPointer(1);
    const s = h.c.getSnapshot();
    expect(
      s.kind === "draft" &&
        s.operation.kind === "newRoad" &&
        s.operation.draft.nodes,
    ).toHaveLength(1);
    h.c.beginGesture({
      kind: "pan",
      pointer: 2,
      start: [0, 0],
      screen: [0, 0],
      camera: { x: 0, y: 0, scale: 1 },
    });
    h.c.abortPointer(2);
    expect(h.c.getSnapshot().kind).toBe("draft");
  });
  it("accepts complete drafts without any rendering dependency", async () => {
    const h = harness();
    void h.c.beginIntent(
      { type: "populate", roadId: road.id, settings: defaultPopulation },
      false,
    );
    expect(h.c.canAccept()).toBe(true);
    await h.c.accept();
    expect(h.ports.inspect).not.toHaveBeenCalled();
    expect(h.ports.commitExact).toHaveBeenCalledTimes(1);
  });
  it("turns exact actions stale on foreign versions, reads fresh headers and never re-enables auto finish", async () => {
    const h = harness();
    h.c.beginGesture(h.node());
    void h.c.beginIntent(
      {
        type: "updateRoad",
        roadId: road.id,
        road: {
          name: road.name,
          width: 12,
          material: road.material,
          nodes: road.nodes,
        },
      },
      false,
    );
    await vi.advanceTimersByTimeAsync(100);
    await flush();
    h.gate = { ...h.gate, version: status(1) };
    h.update();
    expect(h.exact().stage.phase).toBe("stale");
    expect(workflowPreview(h.c.getSnapshot())).toBeNull();
    await h.c.recheck();
    await flush();
    expect(h.ports.read).toHaveBeenCalledWith(
      road.id,
      status(1),
      expect.any(Function),
    );
    expect(h.exact().candidate!.token.version.revision).toBe(1);

    await flush();
    expect(h.c.canAccept()).toBe(true);
    expect(h.ports.commitExact).not.toHaveBeenCalled();
    h.gate = { ...h.gate, version: status(2) };
    h.update();
    // The visible header deliberately stays old; only the fresh read sees topology.
    h.ports.read = vi.fn(async () => ({
      status: status(2),
      objects: [{ ...road, nodes: [...road.nodes].reverse() }],
      contextState: { exists: false, houseId: null, parcelId: null },
      selectionState: { exists: true, houseId: null, parcelId: null },
    }));
    await h.c.recheck();
    expect(h.c.getSnapshot().kind).toBe("idle");
    expect(h.ports.error).toHaveBeenCalledWith(
      expect.stringContaining("Straßenknoten geändert"),
    );
  });
  it("rejects stale header results after A→B→A, context changes and unmount", async () => {
    const h = harness(),
      held = deferred<Scene | undefined>();
    h.c.beginGesture(h.node());
    void h.c.beginIntent(
      {
        type: "updateRoad",
        roadId: road.id,
        road: {
          name: road.name,
          width: 12,
          material: road.material,
          nodes: road.nodes,
        },
      },
      false,
    );
    await vi.advanceTimersByTimeAsync(100);
    await flush();
    h.gate = { ...h.gate, version: status(1) };
    h.update();
    h.ports.read = vi.fn(() => held.promise);
    const read = h.c.recheck();
    expect(h.c.canAccept()).toBe(false);
    await h.c.accept();
    expect(h.ports.commitExact).not.toHaveBeenCalled();
    h.c.cancel();
    h.c.beginGesture(h.node());
    h.evaluate(h.node(), [100, 0]);
    await flush();
    const newer = h.c.getSnapshot();
    held.resolve({
      status: status(1),
      objects: [road],
      contextState: { exists: false, houseId: null, parcelId: null },
      selectionState: { exists: true, houseId: null, parcelId: null },
    });
    await read;
    expect(h.c.getSnapshot()).toBe(newer);
    h.context = "parcel:other:0";
    h.update();
    expect(h.c.getSnapshot().kind).toBe("idle");
    h.c.dispose();
    void h.c.beginIntent({ type: "detachParcel", id: parcel.id });
    expect(h.c.getSnapshot().kind).toBe("idle");
  });
  it("preserves desired parcel-relative grid pose when rechecking on a new frame; owner changes require a new action", async () => {
    const h = harness(),
      pose = { xCells: 1, yCells: 2, quarterTurns: 3 as const };
    void h.c.beginIntent(
      {
        type: "transformHouse",
        id: house.id,
        transform: parcelTransform(parcel.frame, pose),
      },
      false,
    );
    await flush();
    h.gate = { ...h.gate, version: status(1) };
    const fresh = { ...parcel, frame: { x: 42, y: 73, angle: -0.68 } };
    h.ports.read = vi.fn(async () => ({
      status: status(1),
      objects: [road, fresh, house],
      contextState: { exists: false, houseId: null, parcelId: null },
      selectionState: { exists: true, houseId: house.id, parcelId: parcel.id },
    }));
    h.update();
    await h.c.recheck();
    await flush();
    expect(h.exact().candidate!.intent).toEqual({
      type: "transformHouse",
      id: house.id,
      transform: parcelTransform(fresh.frame, pose),
    });
    expect(
      h.exact().kind === "geometry" && h.exact().candidate!.autoFinish,
    ).toBe(false);
    h.gate = { ...h.gate, version: status(2) };
    h.ports.read = vi.fn(async () => ({
      status: status(2),
      objects: [
        road,
        fresh,
        { ...house, placement: { kind: "free" as const } },
      ],
      contextState: { exists: false, houseId: null, parcelId: null },
      selectionState: { exists: true, houseId: house.id, parcelId: null },
    }));
    h.update();
    await h.c.recheck();
    expect(h.c.getSnapshot().kind).toBe("idle");
    expect(h.ports.error).toHaveBeenCalledWith(
      expect.stringContaining("Hauszuordnung geändert"),
    );
  });
  it("keeps detached parcel gestures on integer 5-foot cells and all four turns despite unsnapped Alt points", () => {
    for (const quarterTurns of [0, 1, 2, 3] as const) {
      const h = harness();
      const object = {
        ...house,
        placement: {
          kind: "parcel" as const,
          parcelId: parcel.id,
          gridPose: { xCells: -2, yCells: 1, quarterTurns },
        },
      };
      const g: Gesture = {
        kind: "houseTransform",
        pointer: 1,
        start: toWorld([0.2, 0.3], parcel.frame),
        screen: [0, 0],
        object,
        parcel,
        mode: "move",
      };
      h.c.beginGesture(g);
      h.evaluate(g, toWorld([2.69, -0.21], parcel.frame));
      expect(h.exact().candidate!.intent).toEqual({
        type: "transformHouse",
        id: house.id,
        transform: parcelTransform(parcel.frame, {
          xCells: 0,
          yCells: 0,
          quarterTurns,
        }),
      });
    }
  });
  it("keeps a newer interior gesture through an older accepted write's completion and revision", async () => {
    const h = harness(),
      held = deferred<ValidPreview | null>();
    h.ports.queue = vi.fn(() => held.promise);
    const g: Gesture = {
      kind: "interiorRectangle",
      pointer: 1,
      start: house.transform ? toWorld([0, 0], house.transform) : [0, 0],
      screen: [0, 0],
      house,
      floor: 0,
      tool: "draw",
      room: "",
    };
    h.c.beginGesture(g);
    h.evaluate(g, g.start, true, [0, 0]);
    expect(h.c.getSnapshot().kind).toBe("idle");
    h.gate = { ...h.gate, pending: 1 };
    const newer = { ...g, pointer: 2 };
    h.c.beginGesture(newer);
    const s = h.c.getSnapshot();
    h.gate = { ...h.gate, version: status(1) };
    held.resolve(preview(status(1)));
    await flush();
    h.update();
    expect(h.c.getSnapshot()).toBe(s);
    expect(h.ports.completed).not.toHaveBeenCalled();
    h.evaluate(newer, newer.start, true, [0, 0]);
    expect(h.ports.queue).toHaveBeenCalledTimes(2);
  });
  it("metadata queue writes invalidate an exact action while preserving its desired candidate", async () => {
    const h = harness();
    h.c.beginGesture(h.node());
    void h.c.beginIntent(
      {
        type: "updateRoad",
        roadId: road.id,
        road: {
          name: road.name,
          width: 12,
          material: road.material,
          nodes: road.nodes,
        },
      },
      false,
    );
    await vi.advanceTimersByTimeAsync(100);
    await flush();
    const candidate = h.exact().candidate!;
    void h.c.beginIntent({ type: "rename", id: road.id, name: "Anders" });
    expect(h.exact().stage.phase).toBe("stale");
    expect(h.exact().candidate!.intent).toEqual(candidate.intent);
    expect(h.ports.queue).toHaveBeenCalledTimes(1);
  });
  it("holds first drawing through its owner read and cancels it on Escape/unmount without late queue admission", async () => {
    for (const disposal of ["cancel", "dispose", "blur"]) {
      const h = harness(),
        held = deferred<Scene | undefined>();
      h.ports.read = vi.fn(() => held.promise);
      const g: Gesture = {
        kind: "houseRectangle",
        pointer: 1,
        start: toWorld([0, 0], parcel.frame),
        screen: [0, 0],
        parcel,
      };
      h.c.beginGesture(g);
      h.evaluate(g, toWorld([2, 2], parcel.frame));
      expect(isOwner(h.c.getSnapshot())).toBe(true);
      expect(h.ports.inspect).not.toHaveBeenCalled();
      if (disposal === "dispose") h.c.dispose();
      else if (disposal === "blur") h.c.abortPointer();
      else h.c.cancel();
      held.resolve({
        status: status(),
        objects: [parcel],
        contextState: { exists: false, houseId: null, parcelId: null },
        selectionState: { exists: true, houseId: null, parcelId: parcel.id },
      });
      await flush();
      expect(h.c.getSnapshot().kind).toBe("idle");
      expect(h.ports.queue).not.toHaveBeenCalled();
      expect(h.ports.commitExact).not.toHaveBeenCalled();
    }
  });
  it("blocks exact actions on a busy queue and document reservation, then requires explicit recheck after cancellation", async () => {
    const h = harness();
    h.gate = { ...h.gate, pending: 1 };
    void h.c.beginIntent({ type: "detachParcel", id: parcel.id });
    expect(h.c.getSnapshot().kind).toBe("idle");
    h.gate = { ...h.gate, pending: 0 };
    h.c.beginGesture(h.node());
    void h.c.beginIntent(
      {
        type: "updateRoad",
        roadId: road.id,
        road: {
          name: road.name,
          width: 12,
          material: road.material,
          nodes: road.nodes,
        },
      },
      false,
    );
    await vi.advanceTimersByTimeAsync(100);
    await flush();
    h.gate = { ...h.gate, exclusive: true };
    h.update();
    expect(h.exact().stage.phase).toBe("stale");
    await h.c.accept();
    expect(h.ports.commitExact).not.toHaveBeenCalled();
    h.gate = { ...h.gate, exclusive: false };
    h.update();
    expect(h.exact().stage.phase).toBe("stale");
    await h.c.recheck();
    await flush();

    expect(h.c.canAccept()).toBe(true);
    expect(h.ports.commitExact).not.toHaveBeenCalled();
  });
  it.each(["extension", "populate", "roughening"] as const)(
    "keeps edited stale %s settings stale until explicit fresh-header recheck",
    async (mode) => {
      const h = harness();
      const draft = extensionRoadDraft(road, "end", defaultPopulation);
      draft.nodes = [{ point: [120, 0], incoming: null, outgoing: null }];
      const begin = (value: number) => {
        switch (mode) {
          case "extension":
            return h.c.beginDraft({
              ...draft,
              population: { ...defaultPopulation, gap: value },
            });
          case "populate":
            return h.c.beginIntent(
              {
                type: "populate",
                roadId: road.id,
                settings: { ...defaultPopulation, gap: value },
              },
              false,
            );
          case "roughening":
            return h.c.beginIntent(
              {
                type: "roughenRoad",
                roadId: road.id,
                roughness: { amount: value / 100, seed: 1 },
              },
              false,
            );
        }
      };
      begin(10);
      await flush();
      h.gate = { ...h.gate, version: status(1) };
      h.update();
      const count = vi.mocked(h.ports.inspect).mock.calls.length;
      begin(15);
      await flush();
      expect(h.exact().stage.phase).toBe("stale");
      expect(h.exact().basis.revision).toBe(0);
      expect(h.exact().candidate!.token.version.revision).toBe(0);
      expect(h.ports.inspect).toHaveBeenCalledTimes(count);
      expect(h.c.canAccept()).toBe(false);
      await h.c.recheck();
      await flush();
      expect(h.ports.read).toHaveBeenCalledWith(
        road.id,
        status(1),
        expect.any(Function),
      );
      expect(h.exact().candidate!.token.version.revision).toBe(1);
      expect(h.exact().candidate!.autoFinish).toBe(false);
      const intent = h.exact().candidate!.intent;
      expect(
        intent.type === "populate"
          ? intent.settings.gap
          : intent.type === "extendRoad"
            ? intent.population?.gap
            : intent.type === "roughenRoad"
              ? intent.roughness.amount * 100
              : null,
      ).toBe(15);
      expect(h.ports.commitExact).not.toHaveBeenCalled();
      h.c.dispose();
    },
  );
  it("never leaves an uncertain commit as a sendable draft after reconciliation", async () => {
    const h = harness(),
      held = deferred<ValidPreview | null>();
    h.ports.commitExact = vi.fn(() => held.promise);
    h.c.beginGesture(h.node());
    h.evaluate(h.node(), [90, 0]);
    await flush();

    h.gate = { ...h.gate, uncertain: true };
    h.update();
    expect(h.c.getSnapshot().kind).toBe("idle");
    held.resolve(null);
    await flush();
    h.gate = { ...h.gate, uncertain: false, version: status(1) };
    h.update();
    await h.c.accept();
    expect(h.ports.commitExact).toHaveBeenCalledTimes(1);
    expect(h.ports.completed).not.toHaveBeenCalled();
  });
  it("keeps a rejected final value editable and commits its correction independently", async () => {
    const h = harness();
    h.ports.commitExact = vi
      .fn()
      .mockRejectedValueOnce(new WireError("invalidInput", "Kollision"))
      .mockResolvedValueOnce(preview());
    h.c.beginGesture(h.node());
    h.evaluate(h.node(), [90, 0]);
    await flush();
    expect(h.exact().stage.phase).toBe("failed");
    expect(h.exact().candidate!.intent).toMatchObject({
      road: { nodes: [{}, { point: [90, 0] }] },
    });
    expect(h.c.canAccept()).toBe(false);
    h.c.beginGesture(h.node());
    h.evaluate(h.node(), [100, 0]);
    await flush();
    expect(h.c.getSnapshot().kind).toBe("idle");
    expect(h.ports.commitExact).toHaveBeenCalledTimes(2);
    expect(h.ports.inspect).not.toHaveBeenCalled();
  });
  it("publishes a failed check once, allows explicit retry and rejects late failure from its superseded request", async () => {
    const h = harness();
    h.ports.inspect = vi.fn(async () => null);
    h.c.beginGesture(h.node());
    void h.c.beginIntent(
      {
        type: "updateRoad",
        roadId: road.id,
        road: {
          name: road.name,
          width: 12,
          material: road.material,
          nodes: road.nodes,
        },
      },
      false,
    );
    await vi.advanceTimersByTimeAsync(100);
    await flush();
    expect(h.exact().stage.phase).toBe("failed");
    h.ports.inspect = vi.fn(async (action, version) => ({
      ...preview(version),
      actionId: action.operationId,
    }));
    await h.c.recheck();
    await flush();

    expect(h.c.canAccept()).toBe(true);
    expect(h.ports.commitExact).not.toHaveBeenCalled();
  });
  it("invalidates a gesture even when the foreign revision arrives before its first candidate", () => {
    const h = harness();
    h.c.beginGesture(h.node());
    h.gate = { ...h.gate, version: status(1) };
    h.update();
    expect(h.exact().stage.phase).toBe("stale");
    h.evaluate(h.node(), [90, 0]);
    expect(h.c.getSnapshot().kind).toBe("idle");
    expect(h.ports.inspect).not.toHaveBeenCalled();
    h.c.beginGesture(h.node());
    h.gate = { ...h.gate, version: { ...status(), sessionId: "new-session" } };
    h.update();
    expect(h.c.getSnapshot().kind).toBe("idle");
  });
  it.each([
    ["read first", "commit"],
    ["pointer first", "commit"],
    ["read first", "no-op"],
    ["pointer first", "no-op"],
    ["read first", "cancel"],
    ["pointer first", "cancel"],
  ] as const)("house owner resolution: %s, %s", async (order, outcome) => {
    const h = harness(),
      held = deferred<Scene | undefined>();
    h.ports.read = vi.fn(() => held.promise);
    const g: Gesture = {
      kind: "houseRectangle",
      pointer: 1,
      start: toWorld([0, 0], parcel.frame),
      screen: [0, 0],
      parcel,
    };
    const resolveOwner = async () => {
      held.resolve({
        status: status(),
        objects: [parcel],
        contextState: { exists: false, houseId: null, parcelId: null },
        selectionState: { exists: true, houseId: null, parcelId: parcel.id },
      });
      await flush();
    };
    h.c.beginGesture(g);
    if (order === "read first") await resolveOwner();
    expect(isOwner(h.c.getSnapshot())).toBe(true);
    expect(h.ports.commitExact).not.toHaveBeenCalled();
    h.evaluate(
      g,
      toWorld([2, 2], parcel.frame),
      true,
      outcome === "no-op" ? [0, 0] : [30, 30],
    );
    if (outcome === "cancel") h.c.cancel();
    if (order === "pointer first") {
      expect(h.ports.commitExact).not.toHaveBeenCalled();
      expect(isOwner(h.c.getSnapshot())).toBe(outcome === "commit");
      await resolveOwner();
    }
    await flush();
    expect(h.c.getSnapshot().kind).toBe("idle");
    expect(h.ports.queue).not.toHaveBeenCalled();
    expect(h.ports.inspect).not.toHaveBeenCalled();
    // Once the exact write is accepted, cancellation cannot retract it.
    expect(h.ports.commitExact).toHaveBeenCalledTimes(
      outcome === "commit" || (outcome === "cancel" && order === "read first")
        ? 1
        : 0,
    );
  });
  it("owns queued-gesture previews and clears a held old stair result when returning to its start", async () => {
    const h = harness(),
      held = deferred<Preview>();
    h.ports.inspect = vi.fn(async (action) => ({
      ...(await held.promise),
      actionId: action.operationId,
    }));
    const g: Gesture = {
      kind: "stairs",
      pointer: 1,
      start: toWorld([0, 0], house.transform),
      screen: [0, 0],
      house,
      floor: 0,
      travel: "up",
      axis: null,
    };
    h.c.beginGesture(g);
    h.evaluate(g, toWorld([2, 0], house.transform), false);
    await vi.advanceTimersByTimeAsync(100);
    expect(h.ports.inspect).toHaveBeenCalledTimes(1);
    h.evaluate(g, toWorld([0.1, 0], house.transform), false, [1, 1]);
    held.resolve(preview());
    await flush();
    expect(workflowPreview(h.c.getSnapshot())).toBeNull();
    h.evaluate(g, toWorld([0.1, 0], house.transform), true, [1, 1]);
    expect(h.ports.queue).not.toHaveBeenCalled();
  });
  it("drops only a queued preview on a queue revision advance and preserves its pointer owner", async () => {
    const h = harness();
    const g: Gesture = {
      kind: "interiorRectangle",
      pointer: 1,
      start: toWorld([0, 0], house.transform),
      screen: [0, 0],
      house,
      floor: 0,
      tool: "draw",
      room: "",
    };
    h.c.beginGesture(g);
    h.evaluate(g, toWorld([2, 2], house.transform), false);
    await vi.advanceTimersByTimeAsync(100);
    expect(workflowPreview(h.c.getSnapshot())).not.toBeNull();
    h.gate = { ...h.gate, version: status(1) };
    h.update();
    expect(workflowPreview(h.c.getSnapshot())).toBeNull();
    expect(workflowPointer(h.c.getSnapshot())?.pointer).toBe(1);
    h.evaluate(g, toWorld([3, 3], house.transform));
    expect(h.ports.queue).toHaveBeenCalledTimes(1);
  });
});

// Compile-time contracts: delete has no editing/pointer state and owner resolving
// cannot be attached to a population operation.
function negativeTypes(state: EditorWorkflow) {
  if (state.kind === "delete") {
    // @ts-expect-error A delete workflow has no pointer data.
    state.pointer;
    // @ts-expect-error Delete never edits geometry.
    state.stage = { phase: "editing" };
  }
  if (state.kind === "populate") {
    // @ts-expect-error Owner resolution belongs to house creation.
    const phase: typeof state.stage.phase = "resolveParcelOwner";
    void phase;
  }
}
void negativeTypes;

import { previewCounts } from "./editorWorkflow";
it("counts compound headers by kind, including safe candidates of an invalid preview", () => {
  const objects = [
    road,
    { kind: "parcel" },
    { kind: "house" },
    { kind: "house" },
  ];
  expect(previewCounts({ valid: true, objects } as Preview)).toEqual({
    roads: 1,
    parcels: 1,
    houses: 2,
  });
  expect(
    previewCounts({
      valid: false,
      objects: [],
      proposedObjects: objects,
    } as unknown as Preview),
  ).toEqual({ roads: 1, parcels: 1, houses: 2 });
});

it("completes a successful exact commit at the advanced revision once, even with its own pending write and reservation", async () => {
  const h = harness(),
    held = deferred<ValidPreview | null>();
  vi.mocked(h.ports.commitExact).mockImplementation(
    async (_action, _version, owns) => {
      h.gate = { ...h.gate, pending: 1, exclusive: true };
      expect(owns()).toBe(true);
      return held.promise;
    },
  );
  await h.c.beginIntent({ type: "delete", id: road.id });
  await flush();

  const accepted = h.c.accept(true);
  h.gate = { ...h.gate, version: status(1) };
  h.update();
  held.resolve(preview(status(1)));
  await accepted;
  expect(h.c.getSnapshot().kind).toBe("idle");
  expect(h.ports.completed).toHaveBeenCalledTimes(1);
  expect(h.ports.commitExact).toHaveBeenCalledTimes(1);
});
it("an obsolete exact completion cannot clear a newer gesture, and a rejecting current write port terminates without retry", async () => {
  const h = harness(),
    held = deferred<ValidPreview | null>();
  vi.mocked(h.ports.commitExact).mockReturnValueOnce(held.promise);
  await h.c.beginIntent({ type: "delete", id: road.id });
  await flush();

  const accepted = h.c.accept(true);
  h.c.cancel();
  h.c.beginGesture(h.node(2));
  const newer = h.c.getSnapshot();
  held.resolve(preview(status(1)));
  await accepted;
  expect(h.c.getSnapshot()).toBe(newer);
  expect(h.ports.completed).not.toHaveBeenCalled();
  h.c.cancel();
  vi.mocked(h.ports.commitExact).mockRejectedValueOnce(Error("broken port"));
  await h.c.beginIntent({ type: "delete", id: road.id });
  await flush();

  await h.c.accept(true);
  expect(h.c.getSnapshot().kind).toBe("idle");
  expect(h.ports.error).toHaveBeenCalledWith("Error: broken port");
  expect(h.ports.commitExact).toHaveBeenCalledTimes(2);
});
it("does not capture a bound exact action from a scene at another revision", async () => {
  const h = harness(); // The source deliberately supplies an old header closure.
  const source = h.ports.source();
  h.ports.source = () => source;
  h.gate = { ...h.gate, version: status(1) };
  await h.c.beginIntent({
    type: "transformHouse",
    id: house.id,
    transform: house.transform,
  });
  expect(h.c.getSnapshot().kind).toBe("idle");
  expect(h.ports.inspect).not.toHaveBeenCalled();
  expect(h.ports.error).toHaveBeenCalledTimes(1);
});

it("rechecks commit ownership in the consumer microtask before clearing the workflow", async () => {
  const h = harness(),
    held = deferred<ValidPreview | null>();
  vi.mocked(h.ports.commitExact).mockReturnValueOnce(held.promise);
  await h.c.beginIntent({ type: "delete", id: road.id });
  await flush();

  const accepted = h.c.accept(true);
  held.resolve(preview(status(1)));
  // The effect validates its result first; a separate queued continuation can
  // replace the workflow before the controller consumes that result.
  await Promise.resolve();
  h.c.cancel();
  h.c.beginGesture(h.node(2));
  const newer = h.c.getSnapshot();
  await accepted;
  expect(h.c.getSnapshot()).toBe(newer);
  expect(h.ports.completed).not.toHaveBeenCalled();
});

// Both preview routes use the same request ownership boundary but retain their
// distinct failure behavior: exact actions fail, queued gestures remain editable.
it.each(["exact", "queued"] as const)(
  "keeps %s preview errors with their request owner",
  async (route) => {
    const h = harness();
    const start = () => {
      const gesture: Gesture =
        route === "exact"
          ? h.node()
          : {
              kind: "interiorRectangle",
              pointer: 1,
              start: toWorld([0, 0], house.transform),
              screen: [0, 0],
              house,
              floor: 0,
              tool: "draw",
              room: "",
            };
      h.c.beginGesture(gesture);
      h.evaluate(
        gesture,
        route === "exact" ? [100, 0] : toWorld([2, 2], house.transform),
        false,
      );
    };
    let reject!: (error: Error) => void;
    h.ports.inspect = vi.fn(
      () =>
        new Promise<never>((_, fail) => {
          reject = fail;
        }),
    );
    start();
    await vi.advanceTimersByTimeAsync(100);
    h.c.cancel();
    reject(Error("obsolete"));
    await flush();
    expect(h.c.getSnapshot().kind).toBe("idle");
    expect(h.ports.error).not.toHaveBeenCalled();

    start();
    await vi.advanceTimersByTimeAsync(100);
    reject(Error("current"));
    await flush();
    if (route === "exact") {
      expect(h.exact().stage).toEqual({
        phase: "failed",
        message: "Error: current",
      });
      expect(h.ports.error).not.toHaveBeenCalled();
    } else {
      expect(h.c.getSnapshot().kind).toBe("queuedGesture");
      expect(workflowPointer(h.c.getSnapshot())?.pointer).toBe(1);
      expect(h.ports.error).toHaveBeenCalledExactlyOnceWith("Error: current");
    }
  },
);

it("retains preview and parcel selection only for the owning plan, including population edits", async () => {
  const h = harness();
  const intent = {
    type: "populate" as const,
    roadId: road.id,
    settings: structuredClone(defaultPopulation),
  };
  await h.c.beginIntent(intent, false);
  await vi.advanceTimersByTimeAsync(100);
  const first = h.exact();
  expect(first.displayPreview).toEqual(workflowPreview(first));
  h.c.dispatch({ type: "selectPlanParcel", key: "slot-1" });
  await h.c.beginIntent(
    { ...intent, settings: { ...intent.settings, gap: 15 } },
    false,
  );
  expect(h.exact().id).toBe(first.id);
  expect(h.exact().selectedPlanParcel).toBe("slot-1");
  expect(h.exact().displayPreview).toEqual(first.displayPreview);
  expect(workflowPreview(h.exact())).toBeNull();
  h.c.cancel();
  await h.c.beginIntent(intent, false);
  expect(h.exact().selectedPlanParcel).toBeNull();
  expect(h.exact().displayPreview).toBeNull();
});

type BrushKind = "ground" | "terrain" | "water" | "region";
function brushGesture(kind: BrushKind): Gesture {
  const base = {
    pointer: 1,
    start: [0, 0] as WorldPoint,
    screen: [0, 0] as [number, number],
  };
  if (kind === "region")
    return {
      ...base,
      kind,
      id: "region-1",
      points: [[0, 0]],
      radius: 25,
      erase: false,
    };
  if (kind === "ground")
    return {
      ...base,
      kind,
      started: 0,
      brush: {
        mode: "paint",
        tip: "soft",
        color: [157, 181, 139],
        diameter: 60,
        opacity: 1,
        flow: 1,
        seed: 1,
        points: [[0, 0, 0]],
      },
    };
  return {
    ...base,
    kind: "terrain",
    water: kind === "water",
    brush: {
      mode: "raise",
      radius: 25,
      amount: 1,
      strength: 0.25,
      target: 10,
      points: [[0, 0]],
    },
  };
}

it.each(["ground", "terrain", "water", "region"] as const)(
  "coalesces %s previews, retains a visual result and rejects it after abort",
  async (kind) => {
    const h = harness();
    const first = deferred<Awaited<ReturnType<WorkflowPorts["inspect"]>>>();
    const second = deferred<Awaited<ReturnType<WorkflowPorts["inspect"]>>>();
    vi.mocked(h.ports.inspect)
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const gesture = brushGesture(kind);
    h.c.beginGesture(gesture);
    h.evaluate(gesture, [10, 0], false);
    const firstId = h.exact().candidate!.token.candidateId;
    h.evaluate(gesture, [20, 0], false);
    expect(h.ports.inspect).toHaveBeenCalledTimes(1);
    first.resolve({ ...preview(), actionId: firstId });
    await flush();
    expect(h.exact().displayPreview?.actionId).toBe(firstId);
    expect(workflowPreview(h.exact())).toBeNull();
    expect(h.ports.inspect).toHaveBeenCalledTimes(2);
    const secondId = h.exact().candidate!.token.candidateId;
    h.c.abortPointer();
    second.resolve({ ...preview(), actionId: secondId });
    await flush();
    expect(h.c.getSnapshot().kind).toBe("idle");
    expect(h.ports.commitExact).not.toHaveBeenCalled();
  },
);

it.each(["context", "revision", "document", "unmount"] as const)(
  "rejects held terrain display after %s replacement",
  async (replacement) => {
    const h = harness();
    const pending = deferred<Awaited<ReturnType<WorkflowPorts["inspect"]>>>();
    vi.mocked(h.ports.inspect).mockImplementationOnce(() => pending.promise);
    const gesture = brushGesture("terrain");
    h.c.beginGesture(gesture);
    h.evaluate(gesture, [10, 0], false);
    const id = h.exact().candidate!.token.candidateId;
    if (replacement === "context") h.context = "interior:house:0";
    if (replacement === "revision") h.gate = { ...h.gate, version: status(1) };
    if (replacement === "document")
      h.gate = { ...h.gate, version: { ...status(), sessionId: "new" } };
    if (replacement === "unmount") h.c.dispose();
    else h.update();
    pending.resolve({ ...preview(), actionId: id });
    await flush();
    const state = h.c.getSnapshot();
    expect("displayPreview" in state ? state.displayPreview : null).toBeNull();
    expect(h.ports.commitExact).not.toHaveBeenCalled();
  },
);

it.each(["ground", "terrain", "water", "region"] as const)(
  "commits the final %s path once while a preview is held, without resurrecting it",
  async (kind) => {
    const h = harness(),
      gesture = brushGesture(kind);
    const pending = deferred<Awaited<ReturnType<WorkflowPorts["inspect"]>>>();
    vi.mocked(h.ports.inspect).mockImplementationOnce(() => pending.promise);
    h.c.beginGesture(gesture);
    h.evaluate(gesture, [10, 0], false);
    const previewId = h.exact().candidate!.token.candidateId;
    h.evaluate(gesture, [20, 0], true);
    await flush();
    expect(h.ports.commitExact).toHaveBeenCalledTimes(1);
    const intent = vi.mocked(h.ports.commitExact).mock.calls[0][0].intent;
    const points =
      "brush" in intent
        ? intent.brush.points
        : intent.type === "regionStroke"
          ? intent.points
          : [];
    expect(points.at(-1)?.slice(0, 2)).toEqual([20, 0]);
    expect(h.c.getSnapshot().kind).toBe("idle");
    pending.resolve({ ...preview(), actionId: previewId });
    await flush();
    expect(h.c.getSnapshot().kind).toBe("idle");
    expect(h.ports.inspect).toHaveBeenCalledTimes(1);
    expect(h.ports.completed).toHaveBeenCalledTimes(1);
  },
);

describe("river workflow ownership", () => {
  const riverIntent = (): Extract<Intent, { type: "riverEdit" }> => ({
    type: "riverEdit",
    view: null,
    action: {
      kind: "put",
      id: null,
      name: "Fluss",
      nodes: [
        { id: "", point: [0, 0], width: 20 },
        { id: "", point: [80, 0], width: 20 },
      ],
      settings: {
        tolerance: 0.1,
        roughness: 0.5,
        meander: 40,
        sourceFade: true,
        seed: 1,
      },
      automatic: true,
      reverse: false,
      snap: 1,
    },
  });
  it("keeps incomplete drafts and does not silently rebase stale edits", () => {
    const h = harness(),
      intent = riverIntent();
    if (intent.action.kind !== "put") throw Error("put expected");
    intent.action.nodes.pop();
    h.c.editRiver(intent);
    expect(h.exact().candidate).toBeNull();
    expect(h.c.canAccept()).toBe(false);
    h.gate = { ...h.gate, version: status(1) };
    h.update();
    h.c.editRiver(riverIntent());
    expect(h.exact().basis.revision).toBe(0);
    expect(h.exact().stage.phase).toBe("stale");
    expect(h.c.canAccept()).toBe(false);
    h.c.dispose();
  });
  it("finishes a node gesture without committing and accepts exactly once", async () => {
    const h = harness(),
      intent = riverIntent();
    const gesture: Extract<Gesture, { kind: "river" }> = {
      kind: "river",
      intent,
      index: 1,
      pointer: 1,
      start: [80, 0],
      screen: [0, 0],
    };
    h.c.editRiver(intent, gesture);
    h.evaluate(gesture, [90, 20], true);
    expect(h.ports.commitExact).not.toHaveBeenCalled();
    expect(workflowPointer(h.c.getSnapshot())).toBeNull();
    const pending = deferred<ValidPreview>();
    vi.mocked(h.ports.commitExact).mockImplementation(() => pending.promise);
    const accepted = h.c.accept();
    void h.c.accept();
    expect(h.ports.commitExact).toHaveBeenCalledTimes(1);
    h.c.cancel();
    h.c.editRiver(riverIntent());
    const newer = h.c.getSnapshot();
    pending.resolve(preview());
    await accepted;
    expect(h.c.getSnapshot()).toBe(newer);
    expect(h.ports.completed).not.toHaveBeenCalled();
    h.c.dispose();
  });
  it("owns extension mode and drops it with a cancelled draft", () => {
    const h = harness();
    h.c.editRiver(riverIntent(), null, "start");
    h.c.editRiver(riverIntent());
    expect(h.exact().operation).toMatchObject({
      kind: "river",
      append: "start",
    });
    h.c.cancel();
    h.c.editRiver(riverIntent());
    expect(h.exact().operation).toMatchObject({ kind: "river", append: null });
    h.c.dispose();
  });
  it("discards a preview arriving after cancellation", async () => {
    const h = harness(),
      pending = deferred<ReturnType<typeof preview> & { actionId: number }>();
    vi.mocked(h.ports.inspect).mockImplementation(() => pending.promise);
    h.c.editRiver(riverIntent());
    await vi.advanceTimersByTimeAsync(120);
    const candidate = h.exact().candidate!;
    h.c.cancel();
    pending.resolve({ ...preview(), actionId: candidate.token.candidateId });
    await flush();
    expect(h.c.getSnapshot().kind).toBe("idle");
    h.c.dispose();
  });
});
