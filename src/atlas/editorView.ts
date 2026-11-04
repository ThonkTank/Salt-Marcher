import {
  freezeLayout,
  plannedForParcel,
  parcelHandles,
} from "./parcelPlanning";
import { smoothRoadDraft, drawingNodes, draftGeometry } from "./roadDraft";
import {
  hitObject,
  distance,
  type WorldPoint,
  type Road,
  type Parcel,
  type MapObject,
  type Camera,
  type PopulationSettings,
} from "./model";
import type { Tool } from "./editorSelection";
import { type EditorWorkflow, type workflowView } from "./editorWorkflow";
import { EDIT_SCALE } from "./cityView";

/** One projection for panel precedence, action feedback and retained previews. */
export function editorView(
  state: EditorWorkflow,
  workflow: ReturnType<typeof workflowView>,
  context: {
    tool: Tool;
    selectedObject: MapObject | undefined;
    settings: PopulationSettings;
    objects: MapObject[];
    camera: Camera;
    hoverPoint: WorldPoint | null;
    interior: boolean;
  },
) {
  const { preview, displayPreview, draft, population, planSelection } =
    workflow;
  const { selectedObject, settings, objects, camera, hoverPoint } = context;
  const planObjects = preview
    ? preview.valid
      ? preview.objects
      : preview.proposedObjects
    : [];
  const planRoad = planObjects.find((o): o is Road => o.kind === "road");
  const drawing =
    draft?.kind === "newRoad" || draft?.kind === "extendRoad" ? draft : null;
  const planning =
    planRoad && (drawing?.population || population) && preview?.valid
      ? {
          road: planRoad,
          objects: planObjects,
          settings,
          selectedKey: planSelection,
        }
      : undefined;
  const layout = planning
    ? freezeLayout(planObjects, planning.road, settings)
    : (settings.layout ?? []);
  const planParcel =
    camera.scale < EDIT_SCALE
      ? undefined
      : planning?.objects.find(
          (o): o is Parcel =>
            o.kind === "parcel" &&
            plannedForParcel(layout, o, planning.road)?.key === planSelection,
        );
  const planItem =
    camera.scale < EDIT_SCALE
      ? undefined
      : layout.find((p) => p.key === planSelection);
  const propertyParcel =
    selectedObject?.kind === "parcel" ? selectedObject : null;
  const parcelRoadId =
    propertyParcel?.source.kind === "road"
      ? propertyParcel.source.roadId
      : null;
  const propertyRoad = objects.find(
    (o): o is Road => o.kind === "road" && o.id === parcelRoadId,
  );
  const handleParcel =
    planParcel ?? (!drawing && !population ? propertyParcel : null);
  const handleRoad = planParcel ? planRoad : propertyRoad;
  const parcelOverlay =
    camera.scale >= EDIT_SCALE && handleParcel && handleRoad
      ? {
          parcel: handleParcel,
          handles: parcelHandles(handleParcel, handleRoad),
        }
      : null;
  let visualDraft = draft ? draftGeometry(draft) : null;
  if (
    drawing &&
    hoverPoint &&
    (camera.scale < EDIT_SCALE || !planSelection) &&
    (camera.scale < EDIT_SCALE ||
      !planObjects.some((o) => o.kind === "parcel" && hitObject(o, hoverPoint)))
  ) {
    const nodes = drawingNodes(drawing);
    if (
      nodes.length &&
      !nodes.some((n) => distance(n.point, hoverPoint) * camera.scale < 9)
    ) {
      const ghost = structuredClone(drawing);
      ghost.nodes.push({ point: hoverPoint, incoming: null, outgoing: null });
      visualDraft = draftGeometry(smoothRoadDraft(ghost));
    }
  }
  const panel = !!planItem
    ? "parcel"
    : state.kind === "populate"
      ? "population"
      : state.kind === "draft" || context.tool !== "select"
        ? "tool"
        : selectedObject || context.interior
          ? "selection"
          : "objects";
  return {
    panel,
    displayPreview,
    planning,
    layout,
    planItem,
    propertyParcel,
    drawing,
    parcelOverlay,
    visualDraft,
    actions: {
      ...workflow.actions,
      showGeneration: population || !!drawing?.population,
      preview: displayPreview,
      message: workflow.message || preview?.reason || "",
    },
  };
}
