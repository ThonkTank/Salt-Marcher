package features.dungeon.application.editor;

import features.dungeon.api.DungeonMapId;
import features.dungeon.api.editor.DungeonEditorApi;
import features.dungeon.api.editor.DungeonEditorIntent;
import features.dungeon.api.editor.DungeonEditorPointerInput;
import features.dungeon.api.editor.DungeonEditorState;
import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;
import platform.ui.UiDispatcher;

/** Bridges the existing runtime into the atomic public Editor capability during M1. */
public final class DungeonEditorApiFacade implements DungeonEditorApi {
    private final DungeonEditorFeatureRuntimeRoot runtimeRoot;
    private final UiDispatcher uiDispatcher;

    public DungeonEditorApiFacade(
            DungeonEditorFeatureRuntimeRoot runtimeRoot,
            UiDispatcher uiDispatcher
    ) {
        this.runtimeRoot = Objects.requireNonNull(runtimeRoot, "runtimeRoot");
        this.uiDispatcher = Objects.requireNonNull(uiDispatcher, "uiDispatcher");
    }

    @Override
    public DungeonEditorState current() {
        return runtimeRoot.currentState();
    }

    @Override
    public Runnable subscribe(Consumer<DungeonEditorState> subscriber) {
        StateDelivery delivery = new StateDelivery(
                Objects.requireNonNull(subscriber, "subscriber"),
                uiDispatcher);
        Runnable unsubscribeRuntime = runtimeRoot.subscribe(delivery::deliver);
        return () -> {
            delivery.close();
            unsubscribeRuntime.run();
        };
    }

    @Override
    public void dispatch(DungeonEditorIntent intent) {
        DungeonEditorIntent safeIntent = Objects.requireNonNull(intent, "intent");
        if (safeIntent instanceof DungeonEditorIntent.SelectMap selectMap) {
            runtimeRoot.selectMap(selectMap.mapId().value());
        } else if (safeIntent instanceof DungeonEditorIntent.CreateMap createMap) {
            runtimeRoot.createMap(createMap.mapName());
        } else if (safeIntent instanceof DungeonEditorIntent.RenameMap renameMap) {
            runtimeRoot.renameMap(renameMap.mapId().value(), renameMap.mapName());
        } else if (safeIntent instanceof DungeonEditorIntent.DeleteMap deleteMap) {
            runtimeRoot.deleteMap(deleteMap.mapId().value());
        } else if (safeIntent instanceof DungeonEditorIntent.SetViewMode setViewMode) {
            runtimeRoot.setViewMode(setViewMode.viewMode());
        } else if (safeIntent instanceof DungeonEditorIntent.SetTool setTool) {
            runtimeRoot.setTool(setTool.selection());
        } else if (safeIntent instanceof DungeonEditorIntent.ShiftProjectionLevel shiftLevel) {
            runtimeRoot.shiftProjectionLevel(shiftLevel.levelShift());
        } else if (safeIntent instanceof DungeonEditorIntent.SetOverlay setOverlay) {
            runtimeRoot.setOverlay(setOverlay.overlaySettings());
        } else if (safeIntent instanceof DungeonEditorIntent.ScrollSelection scrollSelection) {
            runtimeRoot.scrollSelection(scrollSelection.levelDelta());
        } else if (safeIntent == DungeonEditorIntent.CancelPreview.INSTANCE) {
            runtimeRoot.cancelActivePreviewSession();
        } else if (safeIntent == DungeonEditorIntent.Undo.INSTANCE) {
            runtimeRoot.undo();
        } else if (safeIntent == DungeonEditorIntent.Redo.INSTANCE) {
            runtimeRoot.redo();
        } else if (safeIntent instanceof DungeonEditorIntent.UpdateRoomNarration update) {
            runtimeRoot.updateStatePanelRoomNarrationDraft(roomNarrationDraftFrom(update.narration()));
        } else if (safeIntent instanceof DungeonEditorIntent.CommitRoomNarration commit) {
            runtimeRoot.saveRoomNarration(roomNarrationFrom(commit.narration()));
        } else if (safeIntent instanceof DungeonEditorIntent.UpdateLabelName update) {
            runtimeRoot.updateStatePanelLabelNameDraft(labelTargetFrom(update.target()), update.name());
        } else if (safeIntent instanceof DungeonEditorIntent.CommitLabelName commit) {
            runtimeRoot.saveLabelName(labelTargetFrom(commit.target()), commit.name());
        } else if (safeIntent instanceof DungeonEditorIntent.UpdateCorridorPoint update) {
            runtimeRoot.updateStatePanelCorridorPointDraft(update.q(), update.r());
        } else if (safeIntent instanceof DungeonEditorIntent.CommitCorridorPoint commit) {
            runtimeRoot.moveStatePanelCorridorPoint(commit.q(), commit.r());
        } else if (safeIntent instanceof DungeonEditorIntent.UpdateTransitionDescription update) {
            runtimeRoot.updateStatePanelTransitionDescriptionDraft(
                    update.transitionId(), update.description());
        } else if (safeIntent instanceof DungeonEditorIntent.CommitTransitionDescription commit) {
            runtimeRoot.saveTransitionDescription(commit.transitionId(), commit.description());
        } else if (safeIntent instanceof DungeonEditorIntent.CommitFeatureMarkerSemantics commit) {
            runtimeRoot.saveFeatureMarkerSemantics(
                    commit.markerId(), commit.label(), commit.description());
        } else if (safeIntent instanceof DungeonEditorIntent.UpdateTransitionDestination update) {
            runtimeRoot.updateStatePanelTransitionDestinationDraft(destinationFrom(update.destination()));
        } else if (safeIntent instanceof DungeonEditorIntent.CommitTransitionDestination commit) {
            runtimeRoot.saveTransitionLink(commit.sourceTransitionId(), destinationFrom(commit.destination()));
        } else if (safeIntent instanceof DungeonEditorIntent.UpdateStairGeometry update) {
            runtimeRoot.updateStatePanelStairGeometryDraft(stairFrom(update.geometry()));
        } else if (safeIntent instanceof DungeonEditorIntent.CommitStairGeometry commit) {
            runtimeRoot.saveStairGeometry(stairFrom(commit.geometry()));
        } else if (safeIntent instanceof DungeonEditorIntent.Pointer pointer) {
            dispatchPointer(pointer.input());
        } else if (safeIntent == DungeonEditorIntent.ClearPointerSession.INSTANCE) {
            runtimeRoot.clearPointerSession();
        } else {
            throw new IllegalArgumentException("Unsupported Dungeon Editor intent: " + safeIntent.getClass());
        }
    }

    private void dispatchPointer(DungeonEditorPointerInput input) {
        if (input.sourceRevision() != current().publicationRevision()) {
            runtimeRoot.rejectCommand(DungeonEditorCommandOutcome.RejectionReason.STALE_REVISION);
            return;
        }
        List<DungeonEditorRuntimePointerTarget> targets = input.targets().stream()
                .map(DungeonEditorApiFacade::runtimeTargetFrom)
                .toList();
        runtimeRoot.applyPointerInteraction(new PointerInteractionRequest(
                pointerActionFrom(input.action()),
                input.toolSelection(),
                input.gesture(),
                PointerInteractionTargets.fromRuntimeTargets(
                        input.sceneX(),
                        input.sceneY(),
                        input.gesture().primary(),
                        input.gesture().secondary(),
                        targets,
                        input.projectionLevel()),
                input.projectionLevel(),
                TransitionDestination.fromDraftInput(destinationFrom(input.transitionDestination()))));
    }

    private static DungeonEditorRuntimePointerTarget runtimeTargetFrom(DungeonEditorPointerInput.Target target) {
        DungeonEditorPointerInput.Target safeTarget = target == null
                ? DungeonEditorPointerInput.Target.empty()
                : target;
        DungeonEditorPointerInput.BoundaryTarget boundary = safeTarget.boundary();
        return new DungeonEditorRuntimePointerTarget(
                targetKindFrom(safeTarget.targetKind()),
                labelKindFrom(safeTarget.labelKind()),
                elementKindFrom(safeTarget.elementKind()),
                safeTarget.ownerId(),
                safeTarget.clusterId(),
                topologyKindFrom(safeTarget.topologyKind()),
                safeTarget.topologyId(),
                safeTarget.handleRef(),
                new DungeonEditorRuntimePointerTarget.BoundaryTarget(
                        boundaryKindFrom(boundary.boundaryKind()),
                        boundary.key(),
                        boundary.ownerId(),
                        topologyKindFrom(boundary.topologyKind()),
                        boundary.topologyId(),
                        boundary.startQ(),
                        boundary.startR(),
                        boundary.startLevel(),
                        boundary.endQ(),
                        boundary.endR(),
                        boundary.endLevel()),
                syntheticHoverKindFrom(safeTarget.syntheticHoverKind()),
                new DungeonEditorRuntimePointerTarget.CellTarget(
                        safeTarget.cell().exact(),
                        safeTarget.cell().q(),
                        safeTarget.cell().r(),
                        safeTarget.cell().level()),
                new DungeonEditorRuntimePointerTarget.VertexTarget(
                        safeTarget.vertex().exact(),
                        safeTarget.vertex().q(),
                        safeTarget.vertex().r(),
                        safeTarget.vertex().level()));
    }

    private static PointerAction pointerActionFrom(DungeonEditorPointerInput.Action action) {
        return switch (action == null ? DungeonEditorPointerInput.Action.MOVED : action) {
            case PRESSED -> PointerAction.PRESSED;
            case DRAGGED -> PointerAction.DRAGGED;
            case RELEASED -> PointerAction.RELEASED;
            case MOVED -> PointerAction.MOVED;
        };
    }

    private static DungeonEditorRuntimePointerTarget.TargetKind targetKindFrom(String value) {
        return switch (value == null ? "" : value) {
            case "CELL" -> DungeonEditorRuntimePointerTarget.TargetKind.CELL;
            case "LABEL" -> DungeonEditorRuntimePointerTarget.TargetKind.LABEL;
            case "MARKER" -> DungeonEditorRuntimePointerTarget.TargetKind.MARKER;
            case "GRAPH_NODE" -> DungeonEditorRuntimePointerTarget.TargetKind.GRAPH_NODE;
            case "HANDLE" -> DungeonEditorRuntimePointerTarget.TargetKind.HANDLE;
            case "BOUNDARY" -> DungeonEditorRuntimePointerTarget.TargetKind.BOUNDARY;
            case "VERTEX" -> DungeonEditorRuntimePointerTarget.TargetKind.VERTEX;
            default -> DungeonEditorRuntimePointerTarget.TargetKind.EMPTY;
        };
    }

    private static DungeonEditorRuntimePointerTarget.LabelKind labelKindFrom(String value) {
        return switch (value == null ? "" : value) {
            case "ROOM_LABEL" -> DungeonEditorRuntimePointerTarget.LabelKind.ROOM_LABEL;
            case "CLUSTER_LABEL" -> DungeonEditorRuntimePointerTarget.LabelKind.CLUSTER_LABEL;
            case "FEATURE_LABEL" -> DungeonEditorRuntimePointerTarget.LabelKind.FEATURE_LABEL;
            default -> DungeonEditorRuntimePointerTarget.LabelKind.EMPTY;
        };
    }

    private static DungeonEditorRuntimePointerTarget.ElementKind elementKindFrom(String value) {
        return switch (value == null ? "" : value) {
            case "ROOM" -> DungeonEditorRuntimePointerTarget.ElementKind.ROOM;
            case "CORRIDOR" -> DungeonEditorRuntimePointerTarget.ElementKind.CORRIDOR;
            case "CORRIDOR_ANCHOR" -> DungeonEditorRuntimePointerTarget.ElementKind.CORRIDOR_ANCHOR;
            case "STAIR" -> DungeonEditorRuntimePointerTarget.ElementKind.STAIR;
            case "TRANSITION" -> DungeonEditorRuntimePointerTarget.ElementKind.TRANSITION;
            case "FEATURE_MARKER" -> DungeonEditorRuntimePointerTarget.ElementKind.FEATURE_MARKER;
            case "FEATURE_OBJECT" -> DungeonEditorRuntimePointerTarget.ElementKind.FEATURE_OBJECT;
            case "FEATURE_ENCOUNTER" -> DungeonEditorRuntimePointerTarget.ElementKind.FEATURE_ENCOUNTER;
            case "FEATURE_POI" -> DungeonEditorRuntimePointerTarget.ElementKind.FEATURE_POI;
            case "WALL" -> DungeonEditorRuntimePointerTarget.ElementKind.WALL;
            case "DOOR" -> DungeonEditorRuntimePointerTarget.ElementKind.DOOR;
            case "WALL_VERTEX" -> DungeonEditorRuntimePointerTarget.ElementKind.WALL_VERTEX;
            default -> DungeonEditorRuntimePointerTarget.ElementKind.EMPTY;
        };
    }

    private static DungeonEditorRuntimePointerTarget.TopologyKind topologyKindFrom(String value) {
        return switch (value == null ? "" : value) {
            case "ROOM" -> DungeonEditorRuntimePointerTarget.TopologyKind.ROOM;
            case "CORRIDOR" -> DungeonEditorRuntimePointerTarget.TopologyKind.CORRIDOR;
            case "CORRIDOR_ANCHOR" -> DungeonEditorRuntimePointerTarget.TopologyKind.CORRIDOR_ANCHOR;
            case "DOOR" -> DungeonEditorRuntimePointerTarget.TopologyKind.DOOR;
            case "WALL" -> DungeonEditorRuntimePointerTarget.TopologyKind.WALL;
            case "STAIR" -> DungeonEditorRuntimePointerTarget.TopologyKind.STAIR;
            case "TRANSITION" -> DungeonEditorRuntimePointerTarget.TopologyKind.TRANSITION;
            case "FEATURE_MARKER" -> DungeonEditorRuntimePointerTarget.TopologyKind.FEATURE_MARKER;
            default -> DungeonEditorRuntimePointerTarget.TopologyKind.EMPTY;
        };
    }

    private static DungeonEditorRuntimePointerTarget.BoundaryKind boundaryKindFrom(String value) {
        return "DOOR".equals(value)
                ? DungeonEditorRuntimePointerTarget.BoundaryKind.DOOR
                : DungeonEditorRuntimePointerTarget.BoundaryKind.WALL;
    }

    private static DungeonEditorRuntimePointerTarget.SyntheticHoverKind syntheticHoverKindFrom(String value) {
        return switch (value == null ? "" : value) {
            case "CELL" -> DungeonEditorRuntimePointerTarget.SyntheticHoverKind.CELL;
            case "BOUNDARY" -> DungeonEditorRuntimePointerTarget.SyntheticHoverKind.BOUNDARY;
            case "VERTEX" -> DungeonEditorRuntimePointerTarget.SyntheticHoverKind.VERTEX;
            default -> DungeonEditorRuntimePointerTarget.SyntheticHoverKind.NONE;
        };
    }

    private static RoomNarrationDraftInput roomNarrationDraftFrom(
            DungeonEditorIntent.RoomNarrationInput input
    ) {
        return new RoomNarrationDraftInput(
                input.roomId(),
                input.visualDescription(),
                input.exits().stream()
                        .map(exit -> new ExitNarrationDraftInput(
                                exit.label(), exit.q(), exit.r(), exit.level(),
                                exit.direction(), exit.description()))
                        .toList());
    }

    private static RoomNarration roomNarrationFrom(DungeonEditorIntent.RoomNarrationInput input) {
        return new RoomNarration(
                input.roomId(),
                input.visualDescription(),
                input.exits().stream()
                        .map(exit -> new ExitNarration(
                                exit.label(), exit.q(), exit.r(), exit.level(),
                                exit.direction(), exit.description()))
                        .toList());
    }

    private static DungeonEditorRuntimeLabelTarget labelTargetFrom(DungeonEditorIntent.LabelTarget target) {
        return switch (target.kind()) {
            case ROOM -> DungeonEditorRuntimeLabelTarget.room(target.id());
            case CLUSTER -> DungeonEditorRuntimeLabelTarget.cluster(target.id());
            case EMPTY -> DungeonEditorRuntimeLabelTarget.empty();
        };
    }

    private static TransitionDestinationDraftInput destinationFrom(
            DungeonEditorIntent.TransitionDestinationInput input
    ) {
        return TransitionDestinationDraftInput.fromExternalName(
                new TransitionDestinationDraftInput.ExternalFields(
                        input.destinationTypeKey(),
                        input.mapId(),
                        input.tileId(),
                        input.transitionId(),
                        input.bidirectional()));
    }

    private static StairGeometryDraftInput stairFrom(DungeonEditorIntent.StairGeometryInput input) {
        return new StairGeometryDraftInput(
                input.stairId(),
                input.shapeName(),
                input.directionName(),
                input.dimension1(),
                input.dimension2());
    }

    static final class StateDelivery {
        private final Consumer<DungeonEditorState> subscriber;
        private final UiDispatcher uiDispatcher;
        private final AtomicBoolean open = new AtomicBoolean(true);
        private final AtomicLong deliveryRevision = new AtomicLong();

        StateDelivery(Consumer<DungeonEditorState> subscriber, UiDispatcher uiDispatcher) {
            this.subscriber = subscriber;
            this.uiDispatcher = uiDispatcher;
        }

        void deliver(DungeonEditorState state) {
            long revision = deliveryRevision.incrementAndGet();
            uiDispatcher.dispatch(() -> applyIfCurrent(revision, state));
        }

        private void applyIfCurrent(long revision, DungeonEditorState state) {
            if (open.get() && revision == deliveryRevision.get()) {
                subscriber.accept(state);
            }
        }

        void close() {
            open.set(false);
            deliveryRevision.incrementAndGet();
        }
    }
}
