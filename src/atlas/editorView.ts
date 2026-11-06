import type { LodDecision } from "./lod";
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
import type { Tool, EditorSelection } from "./editorSelection";
import type { Presentation } from "./presentationLoader";
import type { WorkflowGate } from "./editorWorkflow";
import { contextKey, parcelVisibility, resolvedParcel } from "./parcelEditor";
import type { House } from "./model";
import { type EditorWorkflow, type workflowView } from "./editorWorkflow";
import { overviewFeatures, sceneFeatures } from "./cityView";
import { terrainRequest } from "./terrainView";
import { groundRequest } from "./groundView";
import type { CanvasInputSnapshot } from "./interaction";
import type { ToolSettings } from "./useEditorTools";
import type { Bounds } from "./model";

/** Retained drawing data is distinct from the scene eligible for interaction. */
export function editorScene(
  presentation: Presentation | null,
  selection: EditorSelection,
) {
  const { context, selected, tool } = selection;
  const scene =
    presentation &&
    contextKey(presentation.context) === contextKey(context) &&
    presentation.selectedId === selected
      ? presentation.scene
      : undefined;
  const active = scene?.contextState.houseId ?? "";
  return {
    objects: presentation?.scene.objects ?? [],
    scene,
    active,
    selectedObject: scene?.objects.find((o) => o.id === selected),
    house: scene?.objects.find(
      (o): o is House => o.kind === "house" && o.id === active,
    ),
    parcel: scene ? resolvedParcel(scene, "context") : undefined,
    selectionParcel: scene ? resolvedParcel(scene, "selection") : undefined,
    detail: scene ? presentation?.detail : null,
    visibility: parcelVisibility(scene, context, tool),
  };
}

export function toolScaleRestriction(
  tool: Tool,
  interior: boolean,
  lod: LodDecision,
): "detail" | "localBrush" | null {
  if (
    !interior &&
    (tool === "area" || tool === "scenery" || tool === "water") &&
    !lod.policy.detailBrushes
  )
    return "localBrush";
  if (
    !lod.policy.exact &&
    (interior ||
      ![
        "river",
        "road",
        "select",
        "terrain",
        "water",
        "area",
        "regions",
      ].includes(tool))
  )
    return "detail";
  return null;
}

export function canEdit(
  tool: Tool,
  interior: boolean,
  lod: LodDecision,
  fresh: boolean,
  gate: Pick<WorkflowGate, "exclusive" | "uncertain" | "pending">,
) {
  if (!fresh || gate.exclusive || gate.uncertain) return false;
  if (toolScaleRestriction(tool, interior, lod) !== null) return false;
  return (
    gate.pending === 0 ||
    ["draw", "erase", "assign", "opening", "stairs"].includes(tool) ||
    (interior && tool === "select")
  );
}

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
    lod: LodDecision;
    hoverPoint: WorldPoint | null;
    interior: boolean;
  },
) {
  const { preview, displayPreview, draft, population, planSelection } =
    workflow;
  const { selectedObject, settings, objects, camera, lod, hoverPoint } =
    context;
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
  const planParcel = !lod.policy.exact
    ? undefined
    : planning?.objects.find(
        (o): o is Parcel =>
          o.kind === "parcel" &&
          plannedForParcel(layout, o, planning.road)?.key === planSelection,
      );
  const planItem = !lod.policy.exact
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
    lod.policy.exact && handleParcel && handleRoad
      ? {
          parcel: handleParcel,
          handles: parcelHandles(handleParcel, handleRoad),
        }
      : null;
  let visualDraft = draft ? draftGeometry(draft) : null;
  if (
    drawing &&
    hoverPoint &&
    (!lod.policy.exact || !planSelection) &&
    (!lod.policy.exact ||
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
    stalePlanParcels:
      !preview && (drawing || population) && displayPreview
        ? (displayPreview.valid
            ? displayPreview.objects
            : displayPreview.proposedObjects
          ).filter((o): o is Parcel => o.kind === "parcel")
        : [],
    actions: {
      ...workflow.actions,
      showGeneration: population || !!drawing?.population,
      preview: displayPreview,
      message: workflow.message || preview?.reason || "",
    },
  };
}

/** Idle sizes are screen pixels; an active stroke retains its world radius while zooming. */
export function brushCursor(
  tool: Tool,
  pointer: import("./interaction").Gesture | null,
  point: WorldPoint | null,
  scale: number,
  radii: { region: number; ground: number; scenery: number; terrain: number },
) {
  if (!point) return null;
  let radius: number;
  switch (tool) {
    case "regions":
      radius =
        pointer?.kind === "region" ? pointer.radius : radii.region / scale;
      break;
    case "area":
      radius =
        pointer?.kind === "ground"
          ? pointer.brush.diameter / 2
          : radii.ground / scale;
      break;
    case "scenery":
      radius =
        pointer?.kind === "scenery"
          ? pointer.brush.radius
          : radii.scenery / scale;
      break;
    case "terrain":
    case "water":
      radius =
        pointer?.kind === "terrain"
          ? pointer.brush.radius
          : radii.terrain / scale;
      break;
    default:
      return null;
  }
  return { point, radius, height: tool === "terrain" || tool === "water" };
}

/** Height sampling information follows the captured gesture, never display requests. */
export function terrainBrushInfo(
  tool: Tool,
  pointer: import("./interaction").Gesture | null,
  scale: number,
  screenRadius: number,
  authorTerrainLevel: number,
) {
  if (tool !== "terrain" && tool !== "water") return null;
  const captured =
    pointer?.kind === "terrain" && !!pointer.water === (tool === "water")
      ? pointer.brush
      : null;
  const diameter = captured ? 2 * captured.radius : (2 * screenRadius) / scale;
  const spacing =
    5 *
    2 **
      (captured
        ? (captured.resolution ?? 0)
        : tool === "water"
          ? 0
          : authorTerrainLevel);
  return { diameter, spacing, subgrid: diameter < spacing };
}

/** A borrowed input snapshot: projections only, no effects or retained state. */
export function editorInput(input: {
  selection: EditorSelection;
  scene: ReturnType<typeof editorScene>;
  tools: ToolSettings;
  view: Pick<ReturnType<typeof editorView>, "planning" | "stalePlanParcels">;
  presentation: Presentation | null;
  camera: Camera;
  lod: LodDecision;
  bounds: Bounds;
  editable: boolean;
  deletion: boolean;
  revision: number;
  regions: {
    selected: string;
    diameter: number;
    mode: NonNullable<CanvasInputSnapshot["region"]>["mode"];
    fresh: boolean;
  };
  river: CanvasInputSnapshot["river"];
}): Omit<CanvasInputSnapshot, "workflow"> {
  const {
    selection,
    scene,
    tools,
    view,
    presentation,
    camera,
    lod,
    bounds,
    regions,
  } = input;
  return {
    ...tools,
    ...selection,
    ...scene,
    camera,
    lod,
    editable: input.editable && (selection.tool !== "regions" || regions.fresh),
    river: input.river,
    region: {
      id: regions.selected,
      diameter: regions.diameter,
      mode: regions.mode,
    },
    terrainView: terrainRequest(bounds, lod.terrainLevel),
    groundView: presentation?.ground
      ? {
          level: presentation.ground.level,
          tiles: presentation.ground.tiles.map((t) => [t.x, t.y]),
        }
      : groundRequest(bounds, lod.groundLevel),
    scenerySeed: input.revision >>> 0,
    overviewRoads: presentation?.overview
      ? [
          ...overviewFeatures(presentation.overview),
          ...(scene.scene ? sceneFeatures(scene.scene) : []),
        ]
      : undefined,
    deletion: input.deletion,
    boundaries: scene.visibility.boundaries,
    planning: view.planning,
    stalePlanParcels: view.stalePlanParcels,
  };
}
