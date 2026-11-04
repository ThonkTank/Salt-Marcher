export type Tool =
  | "select"
  | "road"
  | "area"
  | "terrain"
  | "scenery"
  | "house"
  | "draw"
  | "erase"
  | "assign"
  | "opening"
  | "stairs";
import type { ExactIntent } from "./editorWorkflow";
import type { EditorContext, OwnerState, ValidPreview } from "./model";
import { contextKey } from "./parcelEditor";

export type EditorSelection = {
  tool: Tool;
  selected: string;
  context: EditorContext;
  floor: number;
  room: string;
  connection: string;
  nodeSelection: string | number | null;
};
export const initialSelection: EditorSelection = {
  tool: "select",
  selected: "",
  context: { kind: "exterior" },
  floor: 0,
  room: "",
  connection: "",
  nodeSelection: null,
};
export type SelectionEvidence = {
  context: EditorContext;
  selected: string;
  contextState: OwnerState;
  selectionState: OwnerState;
};
export type SelectionEvent =
  | { type: "cancelInteraction" }
  | { type: "selectObject"; id: string }
  | { type: "openHouse"; id: string }
  | { type: "openParcel"; id: string }
  | { type: "leaveInterior" }
  | { type: "chooseTool"; tool: Tool }
  | { type: "stepFloor"; delta: -1 | 1 }
  | { type: "changeFloor"; floor: number }
  | { type: "inspectRoom"; id: string; floor: number }
  | { type: "inspectConnection"; id: string; floor: number }
  // Canvas commands compose within one pointer event without revoking capture.
  | { type: "pointerRoom"; id: string }
  | { type: "pointerConnection"; id: string }
  | { type: "pointerNode"; value: string | number | null }
  | { type: "clearNode" }
  | { type: "clearConnection" }
  | { type: "beginExtension" }
  | { type: "beginPopulation" }
  | { type: "sessionReplaced" }
  | { type: "recoveryCompleted" }
  | { type: "sceneReconciled"; evidence: SelectionEvidence }
  | {
      type: "exactCompleted";
      intent: ExactIntent;
      result: Pick<ValidPreview, "objects" | "deletedIds">;
    };

const clampFloor = (floor: number) =>
  Math.max(-2147483648, Math.min(2147483647, Math.trunc(floor)));

/** One decision for both state and imperative cleanup; no workflow ownership here. */
export function selectionTransition(
  state: EditorSelection,
  event: SelectionEvent,
): {
  state: EditorSelection;
  cancelInteraction: boolean;
} {
  let next = state;
  let cancelInteraction = false;
  const navigate = (changes: Partial<EditorSelection>) => {
    cancelInteraction = true;
    next = { ...state, nodeSelection: null, ...changes };
  };
  switch (event.type) {
    case "cancelInteraction":
      navigate({});
      break;
    case "selectObject":
      navigate({
        selected: event.id,
        room: "",
        connection: "",
        tool: "select",
      });
      break;
    case "openHouse":
    case "openParcel":
      navigate({
        selected: event.id,
        context:
          event.type === "openHouse"
            ? { kind: "house", houseId: event.id }
            : { kind: "parcel", parcelId: event.id },
        floor: 0,
        room: "",
        connection: "",
        tool: "select",
      });
      break;
    case "leaveInterior":
      navigate({
        context: { kind: "exterior" },
        room: "",
        connection: "",
        tool: "select",
      });
      break;
    case "chooseTool":
      navigate({ tool: event.tool });
      break;
    case "stepFloor":
      navigate({ floor: clampFloor(state.floor + event.delta) });
      break;
    case "changeFloor":
      navigate({ floor: clampFloor(event.floor) });
      break;
    case "inspectRoom":
      navigate({
        room: event.id,
        connection: "",
        tool: "select",
        floor: event.floor,
      });
      break;
    case "inspectConnection":
      navigate({
        connection: event.id,
        room: "",
        tool: "select",
        floor: event.floor,
      });
      break;
    case "pointerRoom":
      next = { ...state, room: event.id };
      break;
    case "pointerConnection":
      next = { ...state, connection: event.id };
      break;
    case "pointerNode":
      next = { ...state, nodeSelection: event.value };
      break;
    case "clearNode":
      next = { ...state, nodeSelection: null };
      break;
    case "clearConnection":
      next = { ...state, connection: "" };
      break;
    case "beginExtension":
      next = { ...state, tool: "road" };
      break;
    case "beginPopulation":
      next = { ...state, tool: "select" };
      break;
    case "sessionReplaced":
      navigate(initialSelection);
      break;
    case "recoveryCompleted":
      navigate({ selected: "", room: "", connection: "" });
      break;
    case "sceneReconciled": {
      const evidence = event.evidence;
      if (
        contextKey(state.context) !== contextKey(evidence.context) ||
        state.selected !== evidence.selected
      )
        break;
      const owner = evidence.contextState;
      if (state.context.kind !== "exterior" && !owner.exists)
        navigate({
          context: { kind: "exterior" },
          room: "",
          connection: "",
          tool: "select",
        });
      else if (state.context.kind === "house" && owner.parcelId)
        navigate({ context: { kind: "parcel", parcelId: owner.parcelId } });
      if (state.selected && !evidence.selectionState.exists)
        next = {
          ...next,
          selected:
            state.context.kind === "parcel" && owner.exists
              ? state.context.parcelId
              : "",
        };
      if (!owner.houseId) next = { ...next, room: "", connection: "" };
      break;
    }
    case "exactCompleted": {
      const { intent, result } = event;
      if (intent.type === "delete") {
        next = { ...state, nodeSelection: null, selected: "" };
        if (
          state.context.kind !== "exterior" &&
          result.deletedIds.includes(
            state.context.kind === "parcel"
              ? state.context.parcelId
              : state.context.houseId,
          )
        )
          next = {
            ...next,
            context: { kind: "exterior" },
            floor: 0,
            room: "",
            connection: "",
          };
      } else {
        const road = result.objects.find((object) => object.kind === "road");
        if (road)
          next = {
            ...state,
            selected: road.id,
            nodeSelection:
              intent.type === "deleteRoadNode" ||
              intent.type === "insertRoadNode"
                ? null
                : state.nodeSelection,
            tool: state.tool,
          };
        else if (
          result.objects.length === 1 &&
          state.context.kind === "exterior"
        )
          next = { ...state, selected: result.objects[0].id };
      }
      break;
    }
  }
  // Reconciliation and repeated pointer commands must not create render loops.
  if (
    Object.keys(state).every(
      (key) =>
        state[key as keyof EditorSelection] ===
        next[key as keyof EditorSelection],
    )
  )
    next = state;
  return { state: next, cancelInteraction };
}
export function selectionReducer(
  state: EditorSelection,
  event: SelectionEvent,
): EditorSelection {
  return selectionTransition(state, event).state;
}
