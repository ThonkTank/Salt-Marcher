import {
  isFeatureBrush,
  featureResolution,
  terrainScreenRadius,
} from "./featureBrush";
import { useDevicePixelRatio } from "./useDevicePixelRatio";
import { landAuthorResolution } from "./lod";
import {
  decideLod,
  viewScale,
  zoomAt,
  MIN_WORLD_SCALE,
  MAX_SCALE,
  type LodDecision,
} from "./lod";
import { prepareCanvasScene } from "./canvasScene";
import { useRivers } from "./useRivers";
import { useRegions } from "./useRegions";
import { groundColorAt } from "./groundView";
import { EDIT_SCALE } from "./cityView";
import {
  brushCursor,
  terrainBrushInfo,
  editorView,
  editorScene,
  editorInput,
  canEdit,
} from "./editorView";
import { parcelIntent, type BoundSource } from "./parcelPlanning";
import type { WorldPoint } from "./model";
import { useCamera } from "./useCamera";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import type { ToolOptions } from "./ToolOptions";
import type { Inspector } from "./Inspector";
import type { AtlasClient } from "./client";
import { useDocumentSession } from "./useDocumentSession";
import { usePresentation } from "./usePresentation";
import { scheduledRead } from "./readScheduler";
import type { AtlasCanvas } from "./AtlasCanvas";
import {
  type Bounds,
  type Camera,
  type Parcel,
  type House,
  type Intent,
  type ScreenPoint,
} from "./model";
import type { CanvasCommand } from "./interaction";
import { useEditorSelection } from "./useEditorSelection";
import {
  useEditorTools,
  planSelectionDelete,
  resizeBrushDiameter,
} from "./useEditorTools";
import { useCanvasInput } from "./useCanvasInput";
import { contextKey } from "./parcelEditor";
import { useEditorWorkflow } from "./useEditorWorkflow";
import { workflowPointer, workflowView } from "./editorWorkflow";
import { sameVersion } from "./documentVersion";

/** Binds document, workflow and selection lifetimes to the editor view. */
export function useAtlasEditor(client: AtlasClient) {
  const terrainDpr = useDevicePixelRatio();
  const session = useDocumentSession(client),
    [physicalCamera, setCameraState] = useState<Camera>({
      x: 160,
      y: 120,
      scale: 3.2,
    }),
    [size, setSize] = useState({ width: 800, height: 600 }),
    [lower, setLower] = useState(true);
  const lodRef = useRef<LodDecision | undefined>(undefined);
  const lod = useMemo(
    () => (lodRef.current = decideLod(physicalCamera.scale, lodRef.current)),
    [physicalCamera.scale],
  );
  const camera = physicalCamera;
  const selection = useEditorSelection({
    sessionId: session.status?.sessionId,
    recoveryEpoch: session.recoveryEpoch,
    cleanup: () => {
      cancelFit();
      abortPointer();
      workflow.controller.cancel();
    },
  });
  const { tool, selected, context, floor, room, connection, nodeSelection } =
    selection.state;
  const {
    send: selectEvent,
    cancelInteraction: changeContext,
    selectObject: select,
  } = selection;
  const interior = context.kind !== "exterior";
  const host = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null);
  const navigation = useCamera({
    status: session.status,
    context,
    floor,
    setCameraState,
    size,
  });
  const { cancelFit, setCamera } = navigation;
  const [hoverReason, setHoverReason] = useState<{
    point: ScreenPoint;
    reason: string;
    outsideWorld?: boolean;
  } | null>(null);
  const bounds: Bounds = [
    -camera.x / camera.scale,
    -camera.y / camera.scale,
    (size.width - camera.x) / camera.scale,
    (size.height - camera.y) / camera.scale,
  ];
  const reads = usePresentation({
      terrainScale: camera.scale,
      terrainDpr,
      client,
      status: session.status,
      bounds,
      editorContext: context,
      selectedId: selected,
      floor,
      detailEnabled: lod.policy.exact,
      includeLower: lower,
      cityLevel: !interior && !lod.policy.exact ? lod.cityLevel : null,
      terrainLevel: lod.terrainLevel,
      groundLevel: lod.groundLevel,
    }),
    presentation = reads.value;
  const sceneState = editorScene(presentation, selection.state);
  const {
    objects,
    scene: currentScene,
    selectedObject,
    active,
    house,
    selectionParcel,
    detail,
    visibility,
  } = sceneState;
  const fitPending = navigation.pending;
  useEffect(() => {
    if (presentation && reads.fresh)
      session.acknowledge(presentation.scene.status);
  }, [presentation, reads.fresh]);
  const editable = canEdit(tool, interior, lod, reads.fresh, session);
  const workflow = useEditorWorkflow({
    gate: session.getGate,
    context: () => `${contextKey(context)}:${floor}`,
    source: () => ({ scene: currentScene }),
    inspect: session.inspect,
    cancelInspect: session.clearPreview,
    commitExact: session.commitExact,
    queue: session.commit,
    terrain: {
      begin: session.beginTerrain,
      append: session.appendTerrain,
      finish: session.finishTerrain,
    },
    read: async (id, version, wanted) => {
      const roadRead = !interior && !lod.policy.exact;
      const scene = roadRead
        ? await scheduledRead(client, "roadHeader", { roadId: id }, wanted)
        : await scheduledRead(
            client,
            "scene",
            {
              bounds,
              context,
              selectedId: id,
            },
            wanted,
          );
      if (scene && !sameVersion(scene.status, version))
        throw Error(
          "Dokumentstand während Headerprüfung geändert. Bitte erneut prüfen.",
        );
      return scene;
    },
    completed: (intent, result) => {
      if (intent.type === "riverEdit") rivers.completed(intent, result);
      else selectEvent({ type: "exactCompleted", intent, result });
    },
    error: session.setError,
  });
  const workflowDisplay = workflowView(workflow.state);
  const {
    draft,
    preview,
    issue,
    guide,
    plannedAction,
    population,
    deletion,
    planSelection,
    message: workflowError,
  } = workflowDisplay;
  const canAccept = workflow.controller.canAccept();
  const tools = useEditorTools({
    viewScale: camera.scale,
    controller: workflow.controller,
    select: selectEvent,
    cancelInteraction: changeContext,
    selectedObject,
    editable,
    pending: session.pending,
    draft,
  });
  const { settings, setDraft, chooseTool } = tools;
  const setPlanSelection = (key: string | null) =>
    workflow.controller.dispatch({ type: "selectPlanParcel", key });
  const [hoverPoint, setHoverPoint] = useState<WorldPoint | null>(null);
  useEffect(() => {
    if (workflow.state.kind === "idle") setHoverPoint(null);
  }, [workflow.state.kind]);
  const view = editorView(workflow.state, workflowDisplay, {
    tool,
    selectedObject,
    interior,
    settings,
    objects,
    camera,
    lod,
    hoverPoint,
  });
  const {
    displayPreview,
    layout,
    planItem,
    propertyParcel,
    drawing,
    parcelOverlay,
    visualDraft,
  } = view;
  const regions = useRegions(
    reads.loader,
    client,
    session.status,
    bounds,
    camera,
    { visible: !interior, active: tool === "regions" && !interior },
    (intent) => workflow.controller.beginIntent(intent),
    changeContext,
  );
  const rivers = useRivers(
    reads.loader,
    client,
    session.status,
    bounds,
    camera,
    lod,
    { visible: !interior, active: tool === "river" && !interior },
    editable,
    workflow.controller,
  );
  const editPlanParcel = (
    patch: Partial<BoundSource> & { excluded?: boolean },
  ) => {
    if (!planSelection || !planItem) return;
    tools.changePopulationSettings({
      ...settings,
      layout: layout.map((p) =>
        p.key === planSelection ? { ...p, ...patch } : p,
      ),
    });
  };
  const { abortPointer, ...canvasInput } = useCanvasInput({
    host,
    layout: view.panel,
    canvas,
    controller: workflow.controller,
    snapshot: () =>
      editorInput({
        selection: selection.state,
        scene: sceneState,
        tools: tools.input,
        view,
        presentation,
        navigation:
          !interior &&
          presentation?.context.kind === "exterior" &&
          sameVersion(presentation.scene.status, session.status) &&
          !session.pending &&
          !session.exclusive &&
          !session.uncertain
            ? presentation
            : undefined,
        camera,
        lod,
        bounds,
        editable,
        deletion: !!deletion,
        revision: session.status?.revision ?? 0,
        regions,
        river: rivers.input,
      }),
    dispatch: dispatchInput,
    setSize: (next) => {
      cancelFit();
      setSize(next);
    },
    setHover: setHoverReason,
    setHoverPoint,
  });
  useEffect(() => {
    if (!reads.fresh || !currentScene) return;
    selectEvent({
      type: "sceneReconciled",
      evidence: {
        context,
        selected,
        contextState: currentScene.contextState,
        selectionState: currentScene.selectionState,
      },
    });
  }, [reads.fresh, currentScene, context, selected, selectEvent]);
  const apply = (intent: Intent) => workflow.controller.beginIntent(intent);
  const finish = () => {
    if (tool === "river") {
      void rivers.accept();
      return;
    }
    if (!deletion) void workflow.controller.accept(false);
  };
  const openHouse = (house: House) =>
    selectEvent({ type: "openHouse", id: house.id });
  const openParcel = (parcel: Parcel) =>
    selectEvent({ type: "openParcel", id: parcel.id });
  const leave = () => selectEvent({ type: "leaveInterior" });
  const fit = () => {
    changeContext();
    void navigation
      .fit(client, currentScene, size)
      .catch((error) => session.setError(String(error)));
  };
  const history = (redo: boolean) => {
    changeContext();
    void session.history(redo);
  };
  const requestDeleteObject = () => {
    if (!selectedObject || !editable || !session.status || session.pending)
      return;
    changeContext();
    void workflow.controller.beginIntent(
      { type: "delete", id: selectedObject.id },
      false,
    );
  };
  const deleteSelection = () => {
    if (tool === "river") {
      rivers.remove();
      return;
    }
    if (deletion || !editable) return;
    const action = planSelectionDelete({
      selectedObject,
      nodeSelection,
      connection,
      active,
    });
    if (action.kind === "objectConfirmation") requestDeleteObject();
    else {
      void apply(action.intent);
      if (action.clear) selectEvent({ type: action.clear });
    }
  };
  function dispatchInput(command: CanvasCommand) {
    switch (command.kind) {
      case "riverSelection":
        rivers.select(command.id);
        break;
      case "riverDraft":
        workflow.controller.editRiver(command.intent, command.pointer);
        rivers.setNode(command.node);
        break;
      case "regionPick":
        regions.pick(command.point, command.label);
        break;
      case "groundSize": {
        if (workflowPointer(workflow.controller.getSnapshot())) break;
        if (tool === "regions")
          regions.setDiameter(
            resizeBrushDiameter(regions.diameter, command.factor),
          );
        else tools.resizeBrush(tool, command.factor);
        break;
      }
      case "groundPick": {
        const color = groundColorAt(presentation?.ground, command.point);
        if (color) {
          tools.changeGround({ ...tools.ground, color, mode: "paint" });
          tools.changeGroundPicker(false);
        }
        break;
      }

      case "planParcel":
        setPlanSelection(command.key);
        break;
      case "extend":
        tools.beginExtension(command.end);
        break;
      case "beginGesture":
        workflow.controller.beginGesture(command.gesture, command.rollback);
        break;
      case "draft":
        setDraft(command.draft);
        break;
      case "intent":
        void apply(command.intent);
        break;
      case "selection":
        selectEvent(command.event);
        break;
      case "cancelEditor":
        if (tool === "river") rivers.cancel();
        if (tools.groundPicker) {
          tools.changeGroundPicker(false);
          break;
        }
        if (workflowPointer(workflow.controller.getSnapshot())) abortPointer();
        else changeContext();
        break;
      case "accept":
        finish();
        break;
      case "deleteSelection":
        deleteSelection();
        break;
      case "history":
        history(command.redo);
        break;
      case "document":
        void session.document(command.kindOfDocument);
        break;
      case "tool":
        chooseTool(command.value);
        break;
      case "camera":
        setCamera(command.camera);
        break;
    }
  }
  const toolOptionsProps = {
    tools,
    tool,
    extending: draft?.kind === "extendRoad",
    focusTerrainBrush: (radius: number) => {
      if (workflowPointer(workflow.controller.getSnapshot())) return;
      setCamera(
        zoomAt(
          camera,
          [
            (size.width / 2 - camera.x) / camera.scale,
            (size.height / 2 - camera.y) / camera.scale,
          ],
          Math.max(MIN_WORLD_SCALE, Math.min(MAX_SCALE, 80 / radius)),
        ),
      );
    },
    terrainBrushInfo: terrainBrushInfo(
      tool,
      workflowPointer(workflow.state),
      camera.scale,
      terrainScreenRadius(tools.brush, camera.scale, tool === "water"),
      isFeatureBrush(tools.brush.mode)
        ? featureResolution(tools.brush.radius)
        : tools.brush.mode === "land" || tools.brush.mode === "sea"
          ? landAuthorResolution(camera.scale)
          : lod.authorTerrainLevel,
    ),
  } satisfies ComponentProps<typeof ToolOptions>;
  const canvasPreview = rivers.preview ?? displayPreview ?? session.committed;
  const scene = useMemo(
    () =>
      prepareCanvasScene(presentation, canvasPreview, selected, visibility, {
        rivers: interior ? [] : rivers.views,
        regions: interior ? [] : regions.regions,
      }),
    [
      presentation,
      canvasPreview,
      selected,
      JSON.stringify(visibility),
      interior,
      rivers.views,
      regions.regions,
    ],
  );
  const canvasProps = {
    presentationFresh:
      reads.fresh &&
      !reads.loading &&
      !fitPending &&
      (interior || (regions.fresh && rivers.fresh)),
    writesPending:
      session.pending > 0 || session.exclusive || session.uncertain,
    client,
    documentStatus: session.status,
    scene,
    selectedRiver: tool === "river" ? rivers.selected : "",
    riverHandles: rivers.handles,
    riverPreview: !!rivers.draft,
    regionSummaries: regions.displaySummaries,
    regionMarkerRanks: regions.markerRanks,
    selectedRegion: tool === "regions" ? regions.selected : "",
    terrainContours: tools.contours,
    brushCursor: brushCursor(
      tool,
      workflowPointer(workflow.state),
      hoverPoint,
      camera.scale,
      {
        region: regions.diameter / 2,
        ground: tools.ground.diameter / 2,
        scenery: tools.scenery.radius,
        terrain: terrainScreenRadius(
          tools.brush,
          camera.scale,
          tool === "water",
        ),
      },
    ),
    canvasRef: canvas,
    camera,
    lod,
    size,
    presentation,
    selected,
    room,
    connection,
    preview: canvasPreview,
    issue,
    draft: visualDraft,
    parcelOverlay,
    automaticCurve: !!drawing,
    guide,
    ...canvasInput,
  } satisfies ComponentProps<typeof AtlasCanvas>;
  const inspectorProps = {
    selectedObject,
    roadEdit:
      draft?.kind === "editRoad" && draft.roadId === selected ? draft : null,
    active,
    context,
    parcel: selectionParcel,
    ownerState: currentScene?.selectionState,
    onOpenParcel: openParcel,
    detail,
    room,
    connection,
    lower,
    nodeSelection,
    objects,
    selected,
    onSelectObject: select,
    apply,
    onLeave: leave,
    onOpenHouse: openHouse,
    onPopulate: tools.beginPopulation,
    onRoughen: tools.beginRoughening,
    roughening: tools.roughening,
    onRoughness: tools.changeRoughness,
    onVariation: tools.newVariation,
    overview: !interior && !lod.policy.exact,
    onExtend: tools.beginExtension,
    onDeleteSelection: deleteSelection,
    onDeleteObject: requestDeleteObject,
    onLower: setLower,
    onSelectRoom: (id, floor) =>
      selectEvent({ type: "inspectRoom", id, floor }),
    onSelectConnection: (id, floor) =>
      selectEvent({ type: "inspectConnection", id, floor }),
    onOtherFloor: (targetFloor) =>
      selectEvent({
        type: "changeFloor",
        floor:
          presentation?.floor === targetFloor ? targetFloor + 1 : targetFloor,
      }),
  } satisfies ComponentProps<typeof Inspector>;
  return {
    view,
    actions: {
      ...view.actions,
      canAccept,
      onAccept: finish,
      onCancel: changeContext,
      onRecheck: () => void workflow.controller.recheck(),
    },
    populationProps: {
      settings,
      updateSettings: tools.changePopulationSettings,
    },
    session,
    parcelProperties: !lod.policy.exact
      ? null
      : planItem
        ? {
            source: planItem,
            excluded: planItem.excluded,
            onChange: editPlanParcel,
            onExcluded: (excluded: boolean) => editPlanParcel({ excluded }),
            onBack: () => setPlanSelection(null),
            disabled: !preview && !settings.layout,
          }
        : propertyParcel?.source.kind === "road" &&
            !drawing &&
            !population &&
            tool === "select"
          ? {
              source: propertyParcel.source,
              disabled: !editable,
              onChange: (patch: Partial<BoundSource>) => {
                if (propertyParcel.source.kind === "road")
                  void apply(
                    parcelIntent(propertyParcel, {
                      ...propertyParcel.source,
                      ...patch,
                    }),
                  );
              },
            }
          : null,
    excludedParcels: !lod.policy.exact ? [] : layout.filter((p) => p.excluded),
    selectPlanParcel: setPlanSelection,

    deletion,
    changeContext,
    context,
    interior,
    tool,
    chooseTool,
    host,
    hoverReason,
    plannedAction,
    house,
    presentation,
    floor,
    camera,
    atlasLevel: lod.atlasLevel,
    lod,
    zoomToLevel: (level: number) =>
      !workflowPointer(workflow.controller.getSnapshot()) &&
      setCamera(
        zoomAt(
          camera,
          [
            (size.width / 2 - camera.x) / camera.scale,
            (size.height / 2 - camera.y) / camera.scale,
          ],
          viewScale(level),
        ),
      ),
    zoomToEdit: () =>
      setCamera({
        scale: EDIT_SCALE,
        x:
          size.width / 2 -
          ((size.width / 2 - camera.x) / camera.scale) * EDIT_SCALE,
        y:
          size.height / 2 -
          ((size.height / 2 - camera.y) / camera.scale) * EDIT_SCALE,
      }),
    fit,
    history,
    selectEvent,
    leave,
    reads,
    fitPending,
    workflowError,
    preview: displayPreview,
    canAccept,
    workflow,
    canvasProps,
    toolOptionsProps,
    regions,
    rivers,
    inspectorProps,
  };
}
