import type { Guide, Gesture } from "./interaction";
import type { GridPose, Intent, Preview, PreviewIssue, Version } from "./model";
import type { EditorDraft, RoadEditDraft } from "./roadDraft";
import { sameVersion } from "./documentVersion";

export type WorkflowGate = {
  version: Version | null;
  pending: number;
  exclusive: boolean;
  uncertain: boolean;
};
export type PlannedAction = { operationId: number; intent: Intent };

export type QueueIntent = Extract<
  Intent,
  { type: "room" | "connection" | "rename" | "roof" | "importantPlace" }
>;
export type ExactIntent = Exclude<Intent, QueueIntent>;
export function intentRoute(intent: Intent): "queue" | "exact" {
  switch (intent.type) {
    case "room":
    case "connection":
    case "rename":
    case "roof":
    case "importantPlace":
      return "queue";
    case "riverEdit":
    case "regionEdit":
    case "regionStroke":
    case "groundStroke":
    case "sceneryStroke":
    case "terrainStroke":
    case "waterStroke":
    case "setFoundation":
    case "createRoad":
    case "roughenRoad":
    case "updateRoad":
    case "insertRoadNode":
    case "deleteRoadNode":
    case "extendRoad":
    case "createParcelHouse":
    case "updateParcel":
    case "detachParcel":
    case "createArea":
    case "updateArea":
    case "createHouse":
    case "transformHouse":
    case "delete":
    case "populate":
      return "exact";
    default:
      return assertNever(intent);
  }
}
export const isQueueIntent = (intent: Intent): intent is QueueIntent =>
  intentRoute(intent) === "queue";
const assertNever = (value: never): never => {
  throw Error(`Unbekannte Operation: ${String(value)}`);
};
export type CandidateToken = {
  workflowId: number;
  candidateId: number;
  version: Version;
};
export type Candidate = {
  token: CandidateToken;
  intent: ExactIntent;
  autoFinish: boolean;
  final: boolean;
};
export type RequestToken = { candidate: CandidateToken; requestId: number };
export const sameCandidate = (
  a: CandidateToken | undefined,
  b: CandidateToken | undefined,
) =>
  !!a &&
  !!b &&
  a.workflowId === b.workflowId &&
  a.candidateId === b.candidateId &&
  sameVersion(a.version, b.version);
export const sameRequest = (a: RequestToken, b: RequestToken) =>
  a.requestId === b.requestId && sameCandidate(a.candidate, b.candidate);
export type CheckedPreview = Preview & { actionId: number };
type Checked = Extract<CheckedPreview, { valid: true }>;
type ExactPhase =
  | { phase: "editing" }
  | { phase: "checking"; request: RequestToken }
  | { phase: "refreshing"; request: RequestToken }
  | { phase: "invalid"; preview: Extract<CheckedPreview, { valid: false }> }
  | { phase: "checked"; preview: Checked }
  | { phase: "committing" }
  | { phase: "stale"; message: string }
  | { phase: "failed"; message: string; issue?: PreviewIssue }
  | { phase: "unchanged"; preview: Checked };
export type DraftOperation =
  | { kind: "newRoad"; draft: Extract<EditorDraft, { kind: "newRoad" }> }
  | {
      kind: "extendRoad";
      draft: Extract<EditorDraft, { kind: "extendRoad" }>;
      nodeIds: string[];
    }
  | { kind: "newArea"; draft: Extract<EditorDraft, { kind: "newArea" }> };
export type GeometryOperation =
  | {
      kind: "river";
      intent: Extract<Intent, { type: "riverEdit" }>;
      append?: "start" | "end" | null;
    }
  | { kind: "region" }
  | { kind: "ground" }
  | { kind: "scenery" }
  | { kind: "terrain" }
  | { kind: "foundation"; houseId: string }
  | {
      kind: "editRoad";
      roadId: string;
      nodeIds: string[];
      draft: RoadEditDraft | null;
    }
  | {
      kind: "houseTransform";
      houseId: string;
      parcelId: string | null;
      gridPose: GridPose | null;
    }
  | { kind: "createHouse"; parcelId: string | null; gridPose: GridPose | null }
  | { kind: "createParcelHouse"; parcelId: string }
  | {
      kind: "updateArea";
      areaId: string;
      draft: Extract<EditorDraft, { kind: "editArea" }> | null;
    }
  | { kind: "updateParcel"; parcelId: string }
  | { kind: "detachParcel"; parcelId: string; houseId: string | null };
export type WorkflowOperation =
  | DraftOperation
  | GeometryOperation
  | { kind: "populate"; roadId: string }
  | { kind: "delete"; id: string };
type Navigation = { navigation: Extract<Gesture, { kind: "pan" }> | null };
type Active = Navigation & {
  id: number;
  context: string;
  sessionId: string;
  guide: Guide | null;
  selectedPlanParcel?: string | null;
  displayPreview?: CheckedPreview | null;
};
type Exact = Active & {
  basis: Version;
  candidate: Candidate | null;
  stage: ExactPhase;
};
type GeometryPointer<Kind extends Gesture["kind"]> = Extract<
  Gesture,
  { kind: Kind }
> | null;
type DraftWorkflow = Exact & {
  kind: "draft";
  rollback: EditorDraft | null;
} & (
    | {
        operation: Extract<DraftOperation, { kind: "newRoad" | "extendRoad" }>;
        pointer: GeometryPointer<"newNode" | "parcel">;
      }
    | { operation: Extract<DraftOperation, { kind: "newArea" }>; pointer: null }
  );
// One operation/gesture relation drives both the state union and runtime checks.
const geometryGestures = {
  region: { pointers: ["region"], message: "Ungültige Regionsgeste" },
  ground: { pointers: ["ground"], message: "Ungültige Bodenpinselgeste" },
  scenery: { pointers: ["scenery"], message: "Ungültige Landschaftsgeste" },
  terrain: { pointers: ["terrain"], message: "Ungültige Höhengeste" },
  river: { pointers: ["river"], message: "Ungültige Flussgeste" },
  foundation: { pointers: [], message: "Keine Pointergeste" },
  editRoad: { pointers: ["node"], message: "Straßenedit benötigt Knotengeste" },
  houseTransform: {
    pointers: ["houseTransform"],
    message: "Hauspose benötigt Transformgeste",
  },
  createHouse: {
    pointers: ["houseRectangle"],
    message: "Hausgründung benötigt Rechteckgeste",
  },
  createParcelHouse: {
    pointers: ["parcelRectangle"],
    message: "Erstzeichnung benötigt Grundstücksgeste",
  },
  updateArea: {
    pointers: ["areaPoint", "moveArea"],
    message: "Fläche benötigt Flächengeste",
  },
  detachParcel: { pointers: [], message: "Lösen besitzt keine Pointergeste" },
  updateParcel: {
    pointers: ["parcel"],
    message: "Parzelle benötigt Grundstücksgeste",
  },
} as const satisfies Record<
  GeometryOperation["kind"],
  {
    pointers: readonly Gesture["kind"][];
    message: string;
  }
>;
type GeometryCheckedWorkflow = Exact & {
  kind: "geometry";
  rollback: null;
} & {
    [K in GeometryOperation["kind"]]: {
      operation: Extract<GeometryOperation, { kind: K }>;
      pointer: GeometryPointer<
        (typeof geometryGestures)[K]["pointers"][number]
      >;
    };
  }[GeometryOperation["kind"]];
// Owner resolution is legal only for the beginning of a house drawing.
type OwnerWorkflow = Active & {
  kind: "geometry";
  pointer: GeometryPointer<"houseRectangle">;
  rollback: null;
  operation: Extract<GeometryOperation, { kind: "createHouse" }>;
  candidate: Candidate | null;
  stage: {
    phase: "resolveParcelOwner";
    version: Version;
    request: number;
    resolved: boolean;
  };
};
type GeometryWorkflow = GeometryCheckedWorkflow | OwnerWorkflow;
export const isOwner = (s: EditorWorkflow): s is OwnerWorkflow =>
  s.kind === "geometry" && s.stage.phase === "resolveParcelOwner";
type PopulateWorkflow = Exact & {
  pointer?: GeometryPointer<"parcel">;
  rollbackIntent?: ExactIntent;
  kind: "populate";
  operation: Extract<WorkflowOperation, { kind: "populate" }>;
};
type DeleteWorkflow = Omit<Exact, "candidate" | "stage"> & {
  kind: "delete";
  operation: Extract<WorkflowOperation, { kind: "delete" }>;
  candidate: Candidate;
  stage: Exclude<ExactPhase, { phase: "editing" }>;
};
type QueuedGestureWorkflow = Active & {
  kind: "queuedGesture";
  owner: string;
  inspection: {
    request: RequestToken;
    intent: Intent;
    preview: CheckedPreview | null;
  } | null;
  pointer: Extract<
    Gesture,
    { kind: "roomMove" | "interiorRectangle" | "stairs" }
  >;
};
// Confirmed terrain writes belong to the document queue, not preview phases.
type TerrainGestureWorkflow = Active & {
  kind: "terrainGesture";
  pointer: Extract<Gesture, { kind: "terrain" }> & { water: false };
};
export type ExactWorkflow =
  DraftWorkflow | GeometryCheckedWorkflow | PopulateWorkflow | DeleteWorkflow;
export type EditorWorkflow = Navigation &
  (
    | { kind: "idle" }
    | DraftWorkflow
    | GeometryWorkflow
    | PopulateWorkflow
    | DeleteWorkflow
    | QueuedGestureWorkflow
    | TerrainGestureWorkflow
  );
export const idleWorkflow = (): EditorWorkflow => ({
  kind: "idle",
  navigation: null,
});
export function isExact(s: EditorWorkflow): s is ExactWorkflow {
  return (
    s.kind === "draft" ||
    (s.kind === "geometry" && !isOwner(s)) ||
    s.kind === "populate" ||
    s.kind === "delete"
  );
}
/** These brushes show exact intermediate surfaces while the pointer is held. */
export const isLiveBrush = (
  gesture:
    { kind: Gesture["kind"] | GeometryOperation["kind"] } | null | undefined,
) =>
  gesture?.kind === "ground" ||
  gesture?.kind === "terrain" ||
  gesture?.kind === "region";
export function isSurfaceWorkflow(
  s: EditorWorkflow,
): s is GeometryCheckedWorkflow & { pointer: Gesture } {
  return (
    s.kind === "geometry" &&
    isExact(s) &&
    isLiveBrush(s.operation) &&
    isLiveBrush(s.pointer)
  );
}
export const workflowPointer = (s: EditorWorkflow): Gesture | null =>
  s.navigation ??
  (s.kind === "draft" ||
  s.kind === "geometry" ||
  s.kind === "queuedGesture" ||
  s.kind === "terrainGesture" ||
  s.kind === "populate"
    ? (s.pointer ?? null)
    : null);
export const workflowDraft = (s: EditorWorkflow): EditorDraft | null =>
  s.kind === "draft"
    ? s.operation.draft
    : s.kind === "geometry" &&
        (s.operation.kind === "editRoad" || s.operation.kind === "updateArea")
      ? s.operation.draft
      : null;
export const workflowPreview = (s: EditorWorkflow): CheckedPreview | null =>
  s.kind === "queuedGesture"
    ? (s.inspection?.preview ?? null)
    : isExact(s) && "preview" in s.stage
      ? s.stage.preview
      : null;
const workflowMessage = (s: EditorWorkflow): string =>
  isExact(s) && "message" in s.stage
    ? s.stage.message
    : isExact(s) && s.stage.phase === "unchanged"
      ? "Keine Änderung."
      : "";
/** Shared UI projection; components never interpret lifecycle phases themselves. */
export function workflowView(state: EditorWorkflow) {
  const preview = workflowPreview(state);
  const exact = isExact(state);
  const issue =
    exact && state.stage.phase === "failed" ? state.stage.issue : undefined;
  return {
    draft: workflowDraft(state),
    preview,
    issue,
    guide:
      state.kind === "idle" || !state.guide
        ? null
        : {
            ...state.guide,
            invalid: state.guide.invalid || preview?.valid === false || !!issue,
          },
    plannedAction: exact ? state.candidate : null,
    population: state.kind === "populate",
    deletion:
      state.kind === "delete" && state.stage.phase !== "committing"
        ? state
        : null,
    message: workflowMessage(state),
    displayPreview:
      state.kind === "idle" ? null : (state.displayPreview ?? preview),
    planSelection:
      state.kind === "idle" ? null : (state.selectedPlanParcel ?? null),
    actions: {
      visible:
        (exact &&
          state.kind !== "delete" &&
          state.operation.kind !== "river") ||
        (state.kind === "queuedGesture" && !!preview?.reason),
      controls: exact && state.kind !== "delete",
      pending:
        exact &&
        ["editing", "checking", "refreshing"].includes(state.stage.phase) &&
        !!state.candidate,
      committing: exact && state.stage.phase === "committing",
      recheck: exact && ["stale", "failed"].includes(state.stage.phase),
    },
  };
}

function withStage(s: ExactWorkflow, stage: ExactPhase): ExactWorkflow {
  if (s.kind === "delete") {
    if (stage.phase === "editing") return s;
    return { ...s, stage };
  }
  return { ...s, stage };
}
export type WorkflowEvent =
  | {
      type: "commitRejected";
      candidate: CandidateToken;
      message: string;
      issue?: PreviewIssue;
    }
  | { type: "clearInspection" }
  | { type: "refresh"; candidate: Candidate; request: RequestToken }
  | {
      type: "refreshed";
      request: RequestToken;
      candidate: Candidate;
      guide: Guide | null;
    }
  | { type: "begin"; state: EditorWorkflow }
  | { type: "cancel" }
  | { type: "selectPlanParcel"; key: string | null }
  | { type: "queuePreview"; request: RequestToken; preview: CheckedPreview }
  | { type: "checking"; request: RequestToken }
  | { type: "preview"; request: RequestToken; preview: CheckedPreview }
  | { type: "surfacePreview"; workflowId: number; preview: CheckedPreview }
  | { type: "failure"; request: RequestToken; message: string }
  | { type: "stale"; message: string }
  | { type: "accept"; deletion: boolean }
  | { type: "pan"; gesture: Extract<Gesture, { kind: "pan" }> | null };
/** No effects, clocks, React state or mutable owners are read by the transition. */
type CandidateWorkflow = ExactWorkflow & { candidate: Candidate };
export function canAcceptWorkflow(s: EditorWorkflow): s is CandidateWorkflow {
  return (
    isExact(s) &&
    !!s.candidate &&
    !workflowPointer(s) &&
    ![
      "committing",
      "refreshing",
      "stale",
      "failed",
      "invalid",
      "unchanged",
    ].includes(s.stage.phase) &&
    (s.kind !== "delete" || s.stage.phase === "checked")
  );
}
/** The active request is shared by effect ownership and pure response admission. */
export function workflowRequest(s: EditorWorkflow): RequestToken | undefined {
  if (s.kind === "queuedGesture") return s.inspection?.request;
  return isExact(s) &&
    (s.stage.phase === "checking" || s.stage.phase === "refreshing")
    ? s.stage.request
    : undefined;
}
export function canRecheckWorkflow(s: EditorWorkflow): s is CandidateWorkflow {
  return (
    isExact(s) &&
    !!s.candidate &&
    !workflowPointer(s) &&
    ["stale", "failed", "invalid", "unchanged"].includes(s.stage.phase)
  );
}
export function transition(
  s: EditorWorkflow,
  event: WorkflowEvent,
): EditorWorkflow {
  const next = reduceWorkflow(s, event);
  if (next === s || next.kind === "idle") return next;
  const previous = s.kind !== "idle" && s.id === next.id ? s : null;
  return {
    ...next,
    selectedPlanParcel:
      event.type === "selectPlanParcel"
        ? event.key
        : (previous?.selectedPlanParcel ?? null),
    displayPreview:
      event.type === "surfacePreview"
        ? next.displayPreview
        : (workflowPreview(next) ?? previous?.displayPreview ?? null),
  };
}
function reduceWorkflow(
  s: EditorWorkflow,
  event: WorkflowEvent,
): EditorWorkflow {
  switch (event.type) {
    case "clearInspection":
      return s.kind === "queuedGesture" ? { ...s, inspection: null } : s;
    case "commitRejected":
      return isExact(s) &&
        s.stage.phase === "committing" &&
        sameCandidate(s.candidate?.token, event.candidate)
        ? withStage(
            { ...s, candidate: { ...s.candidate!, autoFinish: false } },
            { phase: "failed", message: event.message, issue: event.issue },
          )
        : s;
    case "refresh":
      return canRecheckWorkflow(s)
        ? withStage(
            {
              ...s,
              basis: event.candidate.token.version,
              candidate: event.candidate,
            },
            { phase: "refreshing", request: event.request },
          )
        : s;
    case "refreshed":
      return isExact(s) &&
        s.stage.phase === "refreshing" &&
        sameRequest(s.stage.request, event.request)
        ? withStage(
            { ...s, candidate: event.candidate, guide: event.guide },
            {
              phase: "checking",
              request: {
                candidate: event.candidate.token,
                requestId: event.request.requestId,
              },
            },
          )
        : s;
    case "surfacePreview":
      return isSurfaceWorkflow(s) &&
        s.id === event.workflowId &&
        sameVersion(s.basis, event.preview.version) &&
        event.preview.valid &&
        (!s.displayPreview ||
          s.displayPreview.actionId < event.preview.actionId)
        ? { ...s, displayPreview: event.preview }
        : s;
    case "begin":
      return event.state;
    case "cancel":
      return idleWorkflow();
    case "selectPlanParcel":
      return s.kind === "draft" || s.kind === "populate"
        ? { ...s, selectedPlanParcel: event.key }
        : s;
    case "pan":
      return { ...s, navigation: event.gesture };
    case "checking":
      return isExact(s) &&
        sameCandidate(s.candidate?.token, event.request.candidate) &&
        s.stage.phase !== "committing" &&
        s.stage.phase !== "stale"
        ? withStage(s, { phase: "checking", request: event.request })
        : s;
    case "queuePreview":
    case "preview": {
      const request = workflowRequest(s);
      if (
        !request ||
        !sameRequest(request, event.request) ||
        !sameVersion(event.preview.version, request.candidate.version) ||
        event.preview.actionId !== request.candidate.candidateId
      )
        return s;
      if (event.type === "queuePreview") {
        return s.kind === "queuedGesture" && s.inspection
          ? { ...s, inspection: { ...s.inspection, preview: event.preview } }
          : s;
      }
      if (
        !isExact(s) ||
        s.stage.phase !== "checking" ||
        !sameCandidate(s.candidate?.token, request.candidate)
      )
        return s;
      if (!event.preview.valid)
        return withStage(s, { phase: "invalid", preview: event.preview });
      if (!event.preview.changed) {
        if (s.kind === "geometry" && !s.pointer && s.candidate?.final)
          return idleWorkflow();
        if (s.kind === "delete") return idleWorkflow();
        return withStage(s, { phase: "unchanged", preview: event.preview });
      }
      return withStage(s, { phase: "checked", preview: event.preview });
    }
    case "failure":
      return isExact(s) &&
        s.stage.phase === "checking" &&
        sameRequest(s.stage.request, event.request)
        ? withStage(s, { phase: "failed", message: event.message })
        : s;
    case "stale":
      if (
        isExact(s) &&
        s.stage.phase === "stale" &&
        s.stage.message === event.message
      )
        return s;
      return isExact(s) && s.stage.phase !== "committing"
        ? withStage(
            {
              ...s,
              candidate: s.candidate
                ? { ...s.candidate, autoFinish: false }
                : null,
            } as ExactWorkflow,
            { phase: "stale", message: event.message },
          )
        : s;
    case "accept":
      return canAcceptWorkflow(s) && (s.kind === "delete") === event.deletion
        ? withStage(s, { phase: "committing" })
        : s;
    default:
      return assertNever(event);
  }
}

export function geometryState(
  base: Omit<GeometryCheckedWorkflow, "operation" | "pointer">,
  operation: GeometryOperation,
  pointer: Gesture | null,
): GeometryCheckedWorkflow {
  const { pointers, message } = geometryGestures[operation.kind];
  if (
    pointer &&
    !(pointers as readonly Gesture["kind"][]).includes(pointer.kind)
  )
    throw Error(message);
  // The table above validates the correlation TypeScript cannot infer here.
  return { ...base, operation, pointer } as GeometryCheckedWorkflow;
}
export function draftState(
  base: Omit<DraftWorkflow, "operation" | "pointer">,
  operation: DraftOperation,
  pointer: Gesture | null,
): DraftWorkflow {
  if (operation.kind === "newArea") {
    if (pointer) throw Error("Flächenentwurf besitzt keine Ziehgeste");
    return { ...base, operation, pointer };
  }
  if (pointer && pointer.kind !== "newNode" && pointer.kind !== "parcel")
    throw Error("Straßenentwurf benötigt neue Knotengeste");
  return { ...base, operation, pointer };
}

export function previewCounts(preview: Preview) {
  const objects = preview.valid ? preview.objects : preview.proposedObjects;
  return {
    roads: objects.filter((o) => o.kind === "road").length,
    parcels: objects.filter((o) => o.kind === "parcel").length,
    houses: objects.filter((o) => o.kind === "house").length,
  };
}
