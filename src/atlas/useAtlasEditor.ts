import { terrainRequest } from "./terrainView";
import {
  cityLevel,
  EDIT_SCALE,
  overviewFeatures,
  sceneFeatures,
} from "./cityView";
import { editorView } from "./editorView";
import { parcelIntent, type BoundSource } from "./parcelPlanning";
import type { WorldPoint } from "./model";
import { useCamera } from "./useCamera";
import { useEffect, useRef, useState, type ComponentProps } from "react";
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
import { useEditorTools, planSelectionDelete } from "./useEditorTools";
import { useCanvasInput } from "./useCanvasInput";
import { contextKey, parcelVisibility, resolvedParcel } from "./parcelEditor";
import { useEditorWorkflow } from "./useEditorWorkflow";
import { workflowPointer, workflowView } from "./editorWorkflow";
import { sameVersion } from "./documentVersion";

/** Binds document, workflow and selection lifetimes to the editor view. */
export function useAtlasEditor(client: AtlasClient) {
  const session = useDocumentSession(client),
    [camera, setCameraState] = useState<Camera>({ x: 160, y: 120, scale: 3.2 }),
    [size, setSize] = useState({ width: 800, height: 600 }),
    [lower, setLower] = useState(true);
  const selection = useEditorSelection({
    sessionId: session.status?.sessionId,
    recoveryEpoch: session.recoveryEpoch,
    cleanup: () => {
      cancelFit();
      abortPointer();
      releaseCapture();
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
  });
  const { cancelFit, setCamera } = navigation;
  const [hoverReason, setHoverReason] = useState<{
    point: ScreenPoint;
    reason: string;
  } | null>(null);
  const bounds: Bounds = [
    -camera.x / camera.scale,
    -camera.y / camera.scale,
    (size.width - camera.x) / camera.scale,
    (size.height - camera.y) / camera.scale,
  ];
  const cityLod = useRef<number | undefined>(undefined);
  cityLod.current = cityLevel(camera.scale, cityLod.current);
  const reads = usePresentation({
      client,
      status: session.status,
      bounds,
      editorContext: context,
      selectedId: selected,
      floor,
      detailEnabled: camera.scale >= EDIT_SCALE,
      includeLower: lower,
      cityLevel:
        !interior && camera.scale < EDIT_SCALE ? cityLod.current : null,
      terrainScale: camera.scale,
    }),
    presentation = reads.value;
  const objects = presentation?.scene.objects ?? [],
    currentScene =
      presentation &&
      contextKey(presentation.context) === contextKey(context) &&
      presentation.selectedId === selected
        ? presentation.scene
        : undefined,
    selectedObject = currentScene?.objects.find((o) => o.id === selected),
    active = currentScene?.contextState.houseId ?? "",
    house = currentScene?.objects.find(
      (o): o is House => o.kind === "house" && o.id === active,
    ),
    parcel = currentScene ? resolvedParcel(currentScene, "context") : undefined,
    selectionParcel = currentScene
      ? resolvedParcel(currentScene, "selection")
      : undefined,
    detail = currentScene ? presentation?.detail : null;
  const visibility = parcelVisibility(currentScene, context, tool);
  const fitPending = navigation.pending;
  useEffect(() => {
    if (presentation) session.acknowledge(presentation.scene.status);
  }, [presentation]);
  useEffect(() => {
    cancelFit();
    abortPointer();
  }, [size.width, size.height, cancelFit]);
  const editable =
    (camera.scale >= EDIT_SCALE ||
      (!interior &&
        (tool === "road" || tool === "select" || tool === "terrain"))) &&
    reads.fresh &&
    (!interior || camera.scale >= EDIT_SCALE) &&
    !session.exclusive &&
    !session.uncertain &&
    (session.pending === 0 ||
      ["draw", "erase", "assign", "opening", "stairs"].includes(tool) ||
      (interior && tool === "select"));
  const workflow = useEditorWorkflow({
    gate: session.getGate,
    context: () => `${contextKey(context)}:${floor}`,
    source: () => ({ scene: currentScene }),
    inspect: session.inspect,
    cancelInspect: session.clearPreview,
    commitExact: session.commitExact,
    queue: session.commit,
    read: async (id, version, wanted) => {
      const roadRead = !interior && camera.scale < EDIT_SCALE;
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
    completed: (intent, result) =>
      selectEvent({ type: "exactCompleted", intent, result }),
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
    controller: workflow.controller,
    select: selectEvent,
    cancelInteraction: changeContext,
    selectedObject,
    editable,
    pending: session.pending,
    draft,
  });
  const {
    material,
    roadWidth,
    opening,
    travel,
    settings,
    populateRoad,
    setDraft,
    chooseTool,
  } = tools;
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
    hoverPoint,
  });
  const {
    displayPreview,
    planning,
    layout,
    planItem,
    propertyParcel,
    drawing,
    parcelOverlay,
    visualDraft,
  } = view;
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
  const { releaseCapture, abortPointer, ...canvasInput } = useCanvasInput({
    host,
    canvas,
    controller: workflow.controller,
    snapshot: () => ({
      workflow: workflow.controller.getSnapshot(),
      camera,
      editable,
      terrainView: terrainRequest(bounds, camera.scale),
      brush: tools.brush,
      scenery: tools.scenery,
      scenerySeed: (session.status?.revision ?? 0) >>> 0,
      roughness: tools.roughness,
      overviewRoads: presentation?.overview
        ? [
            ...overviewFeatures(presentation.overview),
            ...(currentScene ? sceneFeatures(currentScene) : []),
          ]
        : undefined,
      deletion: !!deletion,
      tool,
      selected,
      selectedObject,
      context,
      floor,
      room,
      connection,
      scene: currentScene,
      detail,
      house,
      parcel,
      selectionParcel,
      boundaries: visibility.boundaries,
      roadWidth,
      material,
      opening,
      travel,
      populateRoad,
      settings,
      planning,
      stalePlanParcels:
        !preview && (drawing || population) && displayPreview
          ? (displayPreview.valid
              ? displayPreview.objects
              : displayPreview.proposedObjects
            ).filter((o): o is Parcel => o.kind === "parcel")
          : [],
    }),
    dispatch: (command) => dispatchInput(command),
    setSize,
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
  const dispatchInput = (command: CanvasCommand) => {
    switch (command.kind) {
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
      case "nodeSelection":
        selectEvent({ type: "pointerNode", value: command.value });
        break;
      case "roomSelection":
        selectEvent({ type: "pointerRoom", id: command.room });
        break;
      case "connectionSelection":
        selectEvent({ type: "pointerConnection", id: command.id });
        break;
      case "selectRoad":
        selectEvent({ type: "selectObject", id: command.id });
        break;
      case "select":
        select(command.object);
        break;
      case "openHouse":
        openHouse(command.house);
        break;
      case "openParcel":
        openParcel(command.parcel);
        break;
      case "cancelEditor":
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
      case "floor":
        selectEvent({ type: "stepFloor", delta: command.delta });
        break;
      case "tool":
        chooseTool(command.value);
        break;
      case "camera":
        setCamera(command.camera);
        break;
    }
  };
  const toolOptionsProps = {
    tools,
    waterLevel: presentation?.terrain?.waterLevel ?? 0,
    onWaterLevel: (level: number) => {
      void apply({
        type: "setWaterLevel",
        level,
        view: terrainRequest(bounds, camera.scale),
      });
    },
    tool,
    extending: draft?.kind === "extendRoad",
  } satisfies ComponentProps<typeof ToolOptions>;
  const canvasProps = {
    terrainContours: tools.contours,
    brushCursor:
      (tool === "terrain" || tool === "scenery") && hoverPoint
        ? {
            point: hoverPoint,
            height: tool === "terrain",
            radius:
              tool === "scenery" ? tools.scenery.radius : tools.brush.radius,
          }
        : null,
    canvasRef: canvas,
    camera,
    size,
    presentation,
    selected,
    room,
    connection,
    preview: displayPreview ?? session.committed,
    issue,
    draft: visualDraft,
    parcelOverlay,
    automaticCurve: !!drawing,
    guide,
    visibility,
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
    overview: !interior && camera.scale < EDIT_SCALE,
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
    parcelProperties:
      camera.scale < EDIT_SCALE
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
    excludedParcels:
      camera.scale < EDIT_SCALE ? [] : layout.filter((p) => p.excluded),
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
    inspectorProps,
  };
}
