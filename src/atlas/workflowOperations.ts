import type { Guide } from "./interaction";
import type { Gesture } from "./interaction";
import type { GridPose, Scene } from "./model";
import { toLocal, toWorld } from "./model";
import { parcelTransform, polygonBounds } from "./parcelEditor";
import { editAreaDraft, roadEditInput, type EditorDraft } from "./roadDraft";
import type {
  Candidate,
  DraftOperation,
  GeometryOperation,
  ExactIntent,
  WorkflowOperation,
} from "./editorWorkflow";

export type OperationSource = Readonly<{ scene: Scene | undefined }>;
type OperationResult<T = WorkflowOperation> =
  { ok: true; operation: T } | { ok: false; message: string };
const missing =
  "Aktueller Header konnte nicht gelesen werden. Bitte neue Aktion beginnen.";
const ownerChanged = "Parzellenzuordnung geändert. Bitte neue Aktion beginnen.";
const ok = <T extends WorkflowOperation>(operation: T) => ({
  ok: true as const,
  operation: structuredClone(operation),
});
const fail = (message = missing) => ({ ok: false as const, message });
function relativePose(
  transform: { x: number; y: number; angle: number },
  frame: { x: number; y: number; angle: number },
): GridPose {
  const p = toLocal([transform.x, transform.y], frame),
    q = Math.round((transform.angle - frame.angle) / (Math.PI / 2));
  return {
    xCells: Math.round(p[0]),
    yCells: Math.round(p[1]),
    quarterTurns: (((q % 4) + 4) % 4) as GridPose["quarterTurns"],
  };
}
function parcelClosure(
  scene: Scene | undefined,
  id: string,
  houseId: string | null,
) {
  return (
    !!scene &&
    [scene.selectionState, scene.contextState].some(
      (s) => s.exists && s.parcelId === id && s.houseId === houseId,
    )
  );
}
function emptyParcel(source: OperationSource, id: string) {
  const parcel = source.scene?.objects.find((o) => o.id === id);
  return parcel?.kind === "parcel" && parcelClosure(source.scene, id, null)
    ? parcel
    : null;
}
export function captureOperation(
  intent: ExactIntent,
  source: OperationSource,
  draft: EditorDraft | null = null,
): OperationResult {
  switch (intent.type) {
    case "createRoad":
    case "extendRoad":
    case "createArea":
      return draft ? captureDraftOperation(draft, source) : fail();
    case "populate":
      return source.scene?.objects.some(
        (o) => o.kind === "road" && o.id === intent.roadId,
      )
        ? ok({ kind: "populate", roadId: intent.roadId })
        : fail();
    case "delete":
      return source.scene?.objects.some((o) => o.id === intent.id)
        ? ok({ kind: "delete", id: intent.id })
        : fail();
    default:
      return captureGeometryOperation(intent, source, draft);
  }
}
function captureGeometryOperation(
  intent: Exclude<
    ExactIntent,
    { type: "createRoad" | "extendRoad" | "createArea" | "populate" | "delete" }
  >,
  source: OperationSource,
  draft: EditorDraft | null = null,
): OperationResult<GeometryOperation> {
  const objects = source.scene?.objects ?? [];
  switch (intent.type) {
    case "riverEdit":
      return ok({ kind: "river", intent });
    case "regionEdit":
    case "regionStroke":
      return ok({ kind: "region" });
    case "groundStroke":
      return ok({ kind: "ground" });
    case "sceneryStroke":
      return ok({ kind: "scenery" });
    case "waterStroke":
    case "terrainStroke":
      return ok({ kind: "terrain" });
    case "setFoundation":
      return ok({ kind: "foundation", houseId: intent.id });
    case "roughenRoad":
    case "updateRoad":
    case "insertRoadNode":
    case "deleteRoadNode": {
      const road = objects.find((o) => o.id === intent.roadId);
      if (road?.kind !== "road") return fail();
      return ok({
        kind: "editRoad",
        roadId: road.id,
        nodeIds: road.nodes.map((n) => n.id),
        draft:
          intent.type === "updateRoad"
            ? { kind: "editRoad", roadId: road.id, ...intent.road }
            : null,
      });
    }
    case "transformHouse": {
      const house = objects.find((o) => o.id === intent.id);
      if (house?.kind !== "house") return fail();
      if (house.placement.kind === "free")
        return ok({
          kind: "houseTransform",
          houseId: house.id,
          parcelId: null,
          gridPose: null,
        });
      const id = house.placement.parcelId,
        parcel = objects.find((o) => o.id === id);
      if (
        parcel?.kind !== "parcel" ||
        !parcelClosure(source.scene, id, house.id)
      )
        return fail();
      return ok({
        kind: "houseTransform",
        houseId: house.id,
        parcelId: id,
        gridPose: relativePose(intent.transform, parcel.frame),
      });
    }
    case "createHouse": {
      if (!intent.parcelId)
        return ok({ kind: "createHouse", parcelId: null, gridPose: null });
      const parcel = emptyParcel(source, intent.parcelId);
      return parcel
        ? ok({
            kind: "createHouse",
            parcelId: parcel.id,
            gridPose: relativePose(intent.transform, parcel.frame),
          })
        : fail();
    }
    case "createParcelHouse":
      return emptyParcel(source, intent.parcelId)
        ? ok({ kind: "createParcelHouse", parcelId: intent.parcelId })
        : fail();
    case "updateArea":
      return objects.some((o) => o.kind === "area" && o.id === intent.areaId)
        ? ok({
            kind: "updateArea",
            areaId: intent.areaId,
            draft:
              draft?.kind === "editArea"
                ? draft
                : { kind: "editArea", areaId: intent.areaId, ...intent.area },
          })
        : fail();
    case "updateParcel":
      return objects.some((o) => o.kind === "parcel" && o.id === intent.id)
        ? ok({ kind: "updateParcel", parcelId: intent.id })
        : fail();
    case "detachParcel": {
      const parcel = objects.find((o) => o.id === intent.id),
        closure = [
          source.scene?.selectionState,
          source.scene?.contextState,
        ].find((s) => s?.exists && s.parcelId === intent.id);
      return parcel?.kind === "parcel" && closure
        ? ok({
            kind: "detachParcel",
            parcelId: intent.id,
            houseId: closure.houseId,
          })
        : fail();
    }
  }
}
export function captureDraftOperation(
  draft: EditorDraft,
  source: OperationSource,
  previous?: DraftOperation,
): OperationResult<DraftOperation> {
  switch (draft.kind) {
    case "newRoad":
      return ok({ kind: "newRoad", draft });
    case "newArea":
      return ok({ kind: "newArea", draft });
    case "extendRoad": {
      const road = source.scene?.objects.find((o) => o.id === draft.roadId);
      const nodeIds =
        previous?.kind === "extendRoad" &&
        previous.draft.roadId === draft.roadId
          ? previous.nodeIds
          : road?.kind === "road"
            ? road.nodes.map((n) => n.id)
            : null;
      return nodeIds ? ok({ kind: "extendRoad", draft, nodeIds }) : fail();
    }
    default:
      return fail("Bestandsänderung ist kein neuer Entwurf");
  }
}
export function captureGestureOperation(
  gesture: Exclude<
    Gesture,
    { kind: "pan" | "newNode" | "roomMove" | "interiorRectangle" | "stairs" }
  >,
  source: OperationSource,
): OperationResult<GeometryOperation> {
  switch (gesture.kind) {
    case "river":
      return ok({ kind: "river", intent: gesture.intent });
    case "region":
      return ok({ kind: "region" });
    case "ground":
      return ok({ kind: "ground" });
    case "scenery":
      return ok({ kind: "scenery" });
    case "terrain":
      return ok({ kind: "terrain" });
    case "parcel":
      return captureGeometryOperation(
        {
          type: "updateParcel",
          id: gesture.parcel.id,
          start: 0,
          end: 1,
          setback: 0,
          depth: 5,
        },
        source,
      );
    case "node":
      return captureGeometryOperation(
        {
          type: "updateRoad",
          roadId: gesture.object.roadId,
          road: roadEditInput(gesture.object),
        },
        source,
      );
    case "areaPoint":
    case "moveArea":
      return captureGeometryOperation(
        {
          type: "updateArea",
          areaId: gesture.object.id,
          area: {
            material: gesture.object.material,
            points: gesture.object.points,
          },
        },
        source,
        editAreaDraft(gesture.object),
      );
    case "houseTransform":
      return captureGeometryOperation(
        {
          type: "transformHouse",
          id: gesture.object.id,
          transform: gesture.object.transform,
        },
        source,
      );
    // Owner is deliberately resolved by the controller's dedicated read phase.
    case "houseRectangle":
      return ok({
        kind: "createHouse",
        parcelId: gesture.parcel?.id ?? null,
        gridPose: null,
      });
    case "parcelRectangle":
      return captureGeometryOperation(
        {
          type: "createParcelHouse",
          parcelId: gesture.parcel.id,
          floor: gesture.floor,
          cells: [],
        },
        source,
      );
  }
}
// The dedicated owner phase has already checked the parcel at the drawing basis.
// Its immutable pointer frame remains the geometry basis until explicit recheck.
export function captureHouseDrawingOperation(
  intent: ExactIntent,
  gesture: Extract<Gesture, { kind: "houseRectangle" }>,
): OperationResult {
  if (intent.type !== "createHouse") return fail();
  return ok({
    kind: "createHouse",
    parcelId: gesture.parcel?.id ?? null,
    gridPose: gesture.parcel
      ? relativePose(intent.transform, gesture.parcel.frame)
      : null,
  });
}
export function operationTarget(operation: WorkflowOperation): string | null {
  switch (operation.kind) {
    case "region":
    case "ground":
    case "scenery":
    case "terrain":
    case "river":
      return null;
    case "foundation":
      return operation.houseId;
    case "newRoad":
    case "newArea":
      return null;
    case "extendRoad":
      return operation.draft.roadId;
    case "editRoad":
    case "populate":
      return operation.roadId;
    case "houseTransform":
      return operation.houseId;
    case "createHouse":
    case "createParcelHouse":
    case "updateParcel":
    case "detachParcel":
      return operation.parcelId;
    case "updateArea":
      return operation.areaId;
    case "delete":
      return operation.id;
  }
}
export function recheckOperation(
  operation: WorkflowOperation,
  candidate: Candidate,
  guide: Guide | null,
  freshScene: Scene | undefined,
):
  | { kind: "ready"; intent: ExactIntent; guide: Guide | null }
  | { kind: "gone" | "restart"; message: string } {
  let intent = structuredClone(candidate.intent);
  const target = operationTarget(operation),
    restart = (message = ownerChanged) => ({
      kind: "restart" as const,
      message,
    });
  if (target) {
    if (!freshScene) return restart(missing);
    const object = freshScene.objects.find((o) => o.id === target);
    if (!freshScene.selectionState.exists || !object)
      return {
        kind: "gone",
        message:
          operation.kind === "delete"
            ? "Bereits entfernt."
            : "Objekt fehlt. Bitte neue Aktion beginnen.",
      };
    switch (operation.kind) {
      case "editRoad":
      case "extendRoad":
        if (
          object.kind !== "road" ||
          JSON.stringify(object.nodes.map((n) => n.id)) !==
            JSON.stringify(operation.nodeIds)
        )
          return restart("Straßenknoten geändert. Bitte neue Aktion beginnen.");
        if (
          intent.type === "insertRoadNode" &&
          !object.nodes.map((n) => n.id).includes(intent.afterNodeId)
        )
          return restart("Straßenabschnitt fehlt. Bitte neue Aktion beginnen.");
        break;
      case "houseTransform": {
        if (
          object.kind !== "house" ||
          (object.placement.kind === "parcel"
            ? object.placement.parcelId
            : null) !== operation.parcelId
        )
          return restart("Hauszuordnung geändert. Bitte neue Aktion beginnen.");
        if (operation.parcelId) {
          const parcel = freshScene.objects.find(
              (o) => o.id === operation.parcelId,
            ),
            s = freshScene.selectionState;
          if (
            !operation.gridPose ||
            parcel?.kind !== "parcel" ||
            s.parcelId !== operation.parcelId ||
            s.houseId !== operation.houseId
          )
            return restart();
          if (intent.type === "transformHouse")
            intent = {
              ...intent,
              transform: parcelTransform(parcel.frame, operation.gridPose),
            };
        }
        break;
      }
      case "createHouse":
      case "createParcelHouse": {
        const s = freshScene.selectionState;
        if (
          object.kind !== "parcel" ||
          s.parcelId !== operation.parcelId ||
          s.houseId !== null
        )
          return restart();
        if (operation.kind === "createHouse" && intent.type === "createHouse") {
          if (!operation.gridPose)
            return restart("Rasterpose fehlt. Bitte neue Aktion beginnen.");
          intent = {
            ...intent,
            transform: parcelTransform(object.frame, operation.gridPose),
          };
          const transform = intent.transform;
          guide = {
            closed: true,
            points: (
              [
                [0, 0],
                [intent.width, 0],
                [intent.width, intent.depth],
                [0, intent.depth],
              ] as [number, number][]
            ).map((p) => toWorld(p, transform)),
          };
        }
        if (
          operation.kind === "createParcelHouse" &&
          intent.type === "createParcelHouse" &&
          intent.cells.length
        ) {
          const [x, y, X, Y] = polygonBounds(intent.cells)!;
          guide = {
            closed: true,
            points: (
              [
                [x, y],
                [X + 1, y],
                [X + 1, Y + 1],
                [x, Y + 1],
              ] as [number, number][]
            ).map((p) => toWorld(p, object.frame)),
          };
        }
        break;
      }
      case "updateParcel":
        if (object.kind !== "parcel" || object.source.kind !== "road")
          return restart();
        break;
      case "detachParcel":
        if (
          object.kind !== "parcel" ||
          freshScene.selectionState.parcelId !== operation.parcelId ||
          freshScene.selectionState.houseId !== operation.houseId
        )
          return restart();
        break;
      case "populate":
        if (object.kind !== "road") return restart(missing);
        break;
      case "updateArea":
        if (object.kind !== "area") return restart(missing);
        break;
    }
  }
  return { kind: "ready", intent, guide };
}
