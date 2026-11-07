import { describe, expect, it } from "vitest";
import {
  initialSelection,
  selectionReducer,
  selectionTransition,
  type EditorSelection,
  type SelectionEvidence,
} from "./editorSelection";
import type { Road, ValidPreview } from "./model";
import type { ExactIntent } from "./editorWorkflow";

const interior = (): EditorSelection => ({
  ...initialSelection,
  context: { kind: "house", houseId: "h" },
  selected: "h",
  floor: -2,
  room: "r",
  connection: "c",
  nodeSelection: 0,
  tool: "assign",
});
const evidence = (state: EditorSelection): SelectionEvidence => ({
  context: state.context,
  selected: state.selected,
  contextState: { exists: true, houseId: "h", parcelId: null },
  selectionState: { exists: true, houseId: "h", parcelId: null },
});
// Completion uses only these projection fields; other preview data stays owned by the workflow.
const result = (
  deletedIds: string[] = [],
): Pick<ValidPreview, "objects" | "deletedIds"> => ({
  objects: [],
  deletedIds,
});

describe("editor selection transitions", () => {
  it("composes pointer sub-selection without cancelling capture, unlike inspector navigation", () => {
    const state = interior();
    const connection = selectionTransition(state, {
      type: "pointerConnection",
      id: "door",
    });
    const room = selectionTransition(connection.state, {
      type: "pointerRoom",
      id: "",
    });
    expect(connection.cancelInteraction || room.cancelInteraction).toBe(false);
    expect(room.state).toMatchObject({
      connection: "door",
      room: "",
      floor: -2,
      tool: "assign",
      nodeSelection: 0,
    });
    const inspect = selectionTransition(state, {
      type: "inspectRoom",
      id: "other",
      floor: 3,
    });
    expect(inspect.cancelInteraction).toBe(true);
    expect(inspect.state).toMatchObject({
      room: "other",
      connection: "",
      floor: 3,
      tool: "select",
      nodeSelection: null,
    });
    const node = selectionTransition(initialSelection, {
      type: "pointerNode",
      value: 0,
    });
    expect(node.state.nodeSelection).toBe(0);
    expect(node.cancelInteraction).toBe(false);
  });
  it("preserves assignment targets across floor changes and composes bounded deltas", () => {
    let state = interior();
    state = selectionReducer(state, { type: "stepFloor", delta: 1 });
    state = selectionReducer(state, { type: "stepFloor", delta: 1 });
    expect(state).toMatchObject({
      floor: 0,
      room: "r",
      connection: "c",
      tool: "assign",
      nodeSelection: null,
    });
    state = selectionReducer(state, {
      type: "changeFloor",
      floor: 2147483650.4,
    });
    expect(selectionReducer(state, { type: "stepFloor", delta: 1 }).floor).toBe(
      2147483647,
    );
    expect(
      selectionReducer(state, { type: "changeFloor", floor: -2147483650 })
        .floor,
    ).toBe(-2147483648);
    expect(
      selectionReducer(state, { type: "changeFloor", floor: -2.9 }).floor,
    ).toBe(-2);
  });
  it("distinguishes leaving, reopening, object selection and recovery from session reset", () => {
    const state = interior();
    expect(selectionReducer(state, { type: "leaveInterior" })).toMatchObject({
      context: { kind: "exterior" },
      floor: -2,
      selected: "h",
      room: "",
      connection: "",
    });
    expect(
      selectionReducer(state, { type: "openParcel", id: "p" }),
    ).toMatchObject({
      context: { kind: "parcel", parcelId: "p" },
      floor: 0,
      selected: "p",
    });
    expect(
      selectionReducer(state, { type: "selectObject", id: "other" }),
    ).toMatchObject({
      context: state.context,
      floor: -2,
      selected: "other",
      tool: "select",
    });
    expect(
      selectionReducer(state, { type: "recoveryCompleted" }),
    ).toMatchObject({
      context: state.context,
      floor: -2,
      tool: "assign",
      selected: "",
      room: "",
      connection: "",
      nodeSelection: null,
    });
    expect(selectionReducer(state, { type: "sessionReplaced" })).toEqual(
      initialSelection,
    );
    expect(
      selectionReducer(state, { type: "chooseTool", tool: "draw" }),
    ).toMatchObject({ room: "r", connection: "c", floor: -2 });
  });
  it("reconciles ownership without confusing empty or offscreen owners with deleted context", () => {
    const state = interior(),
      proof = evidence(state);
    proof.contextState.parcelId = "p";
    const bound = selectionTransition(state, {
      type: "sceneReconciled",
      evidence: proof,
    });
    expect(bound.cancelInteraction).toBe(true);
    expect(bound.state).toMatchObject({
      context: { kind: "parcel", parcelId: "p" },
      selected: "h",
      floor: -2,
      room: "r",
      connection: "c",
      tool: "assign",
    });
    const empty = evidence(bound.state);
    empty.contextState = { exists: true, houseId: null, parcelId: "p" };
    empty.selectionState.exists = false;
    const cleared = selectionTransition(bound.state, {
      type: "sceneReconciled",
      evidence: empty,
    });
    expect(cleared.cancelInteraction).toBe(false);
    expect(cleared.state).toMatchObject({
      context: bound.state.context,
      selected: "p",
      floor: -2,
      room: "",
      connection: "",
      tool: "assign",
    });
    empty.context = cleared.state.context;
    empty.selected = "p";
    empty.contextState.exists = false;
    expect(
      selectionReducer(cleared.state, {
        type: "sceneReconciled",
        evidence: empty,
      }),
    ).toMatchObject({
      context: { kind: "exterior" },
      selected: "",
      floor: -2,
      tool: "select",
    });
  });
  it("rejects stale selection/context evidence and leaves unchanged reconciliation referentially stable", () => {
    const state = interior();
    expect(
      selectionReducer(state, {
        type: "sceneReconciled",
        evidence: evidence(state),
      }),
    ).toBe(state);
    const stale = evidence(state);
    stale.contextState.exists = false;
    stale.selected = "old";
    expect(
      selectionReducer(state, { type: "sceneReconciled", evidence: stale }),
    ).toBe(state);
    stale.selected = state.selected;
    stale.context = { kind: "house", houseId: "other" };
    expect(
      selectionReducer(state, { type: "sceneReconciled", evidence: stale }),
    ).toBe(state);
  });
  it("applies owned delete completion without cancelling newer document work or resetting unrelated context", () => {
    const state = interior();
    const unrelated = selectionTransition(state, {
      type: "exactCompleted",
      intent: { type: "delete", id: "other" },
      result: result(["other"]),
    });
    expect(unrelated.cancelInteraction).toBe(false);
    expect(unrelated.state).toMatchObject({
      context: state.context,
      floor: -2,
      room: "r",
      connection: "c",
      selected: "",
      nodeSelection: null,
    });
    expect(
      selectionReducer(state, {
        type: "exactCompleted",
        intent: { type: "delete", id: "h" },
        result: result(["h"]),
      }),
    ).toMatchObject({
      context: { kind: "exterior" },
      floor: 0,
      room: "",
      connection: "",
    });
  });
  it("selects the road from compound completion, ends extension, and clears node zero on topology edits", () => {
    const road: Road = {
      kind: "road",
      id: "road",
      name: "Road",
      width: 15,
      material: "earth",
      nodes: [
        { id: "n1", point: [0, 0], incoming: null, outgoing: null },
        { id: "n2", point: [10, 0], incoming: null, outgoing: null },
      ],
      path: [
        [0, 0],
        [10, 0],
      ],
      edgeSections: ["s"],
      sections: [{ id: "s", populatedSides: [] }],
      populationRecipe: null,
    };
    const compound: Pick<ValidPreview, "objects" | "deletedIds"> = {
      objects: [
        {
          kind: "area",
          id: "area",
          material: "grass",
          points: [
            [0, 0],
            [1, 0],
            [0, 1],
          ],
          order: 0,
        },
        road,
      ],
      deletedIds: [],
    };
    const state = {
      ...initialSelection,
      tool: "road" as const,
      nodeSelection: 0,
    };
    const extension = selectionTransition(state, {
      type: "exactCompleted",
      intent: {
        type: "extendRoad",
        roadId: "road",
        end: "end",
        nodes: [{ point: [20, 0], incoming: null, outgoing: null }],
        endpointHandle: null,
        population: null,
      },
      result: compound,
    });
    expect(extension.cancelInteraction).toBe(false);
    expect(extension.state).toMatchObject({
      selected: "road",
      tool: "road",
      nodeSelection: 0,
    });
    const edits: ExactIntent[] = [
      { type: "insertRoadNode", roadId: "road", afterNodeId: "n1", t: 0.5 },
      { type: "deleteRoadNode", roadId: "road", nodeId: "n1" },
    ];
    for (const intent of edits) {
      const edited = selectionTransition(state, {
        type: "exactCompleted",
        intent,
        result: compound,
      });
      expect(edited.cancelInteraction).toBe(false);
      expect(edited.state).toMatchObject({
        selected: "road",
        tool: "road",
        nodeSelection: null,
      });
    }
  });
  it("keeps workflow entry tool updates free of implicit cleanup", () => {
    for (const type of ["beginExtension", "beginPopulation"] as const) {
      const transition = selectionTransition(interior(), { type });
      expect(transition.cancelInteraction).toBe(false);
      expect(transition.state).toMatchObject({
        selected: "h",
        floor: -2,
        room: "r",
        nodeSelection: 0,
      });
    }
  });
});

it.each([
  { floor: 2147483647, delta: 1 as const },
  { floor: -2147483648, delta: -1 as const },
])("keeps floor navigation inside i32: %j", ({ floor, delta }) => {
  const state = { ...initialSelection, floor };
  expect(
    selectionTransition(state, { type: "stepFloor", delta }),
  ).toMatchObject({
    state: { floor },
    cancelInteraction: true,
  });
});
