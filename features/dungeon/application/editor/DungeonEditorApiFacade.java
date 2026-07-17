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
                enumValue(PointerAction.class, input.action().name(), PointerAction.MOVED),
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
                enumValue(DungeonEditorRuntimePointerTarget.TargetKind.class,
                        safeTarget.targetKind(), DungeonEditorRuntimePointerTarget.TargetKind.EMPTY),
                enumValue(DungeonEditorRuntimePointerTarget.LabelKind.class,
                        safeTarget.labelKind(), DungeonEditorRuntimePointerTarget.LabelKind.EMPTY),
                enumValue(DungeonEditorRuntimePointerTarget.ElementKind.class,
                        safeTarget.elementKind(), DungeonEditorRuntimePointerTarget.ElementKind.EMPTY),
                safeTarget.ownerId(),
                safeTarget.clusterId(),
                enumValue(DungeonEditorRuntimePointerTarget.TopologyKind.class,
                        safeTarget.topologyKind(), DungeonEditorRuntimePointerTarget.TopologyKind.EMPTY),
                safeTarget.topologyId(),
                safeTarget.handleRef(),
                new DungeonEditorRuntimePointerTarget.BoundaryTarget(
                        enumValue(DungeonEditorRuntimePointerTarget.BoundaryKind.class,
                                boundary.boundaryKind(), DungeonEditorRuntimePointerTarget.BoundaryKind.WALL),
                        boundary.key(),
                        boundary.ownerId(),
                        enumValue(DungeonEditorRuntimePointerTarget.TopologyKind.class,
                                boundary.topologyKind(), DungeonEditorRuntimePointerTarget.TopologyKind.EMPTY),
                        boundary.topologyId(),
                        boundary.startQ(),
                        boundary.startR(),
                        boundary.startLevel(),
                        boundary.endQ(),
                        boundary.endR(),
                        boundary.endLevel()),
                enumValue(DungeonEditorRuntimePointerTarget.SyntheticHoverKind.class,
                        safeTarget.syntheticHoverKind(), DungeonEditorRuntimePointerTarget.SyntheticHoverKind.NONE),
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

    private static <E extends Enum<E>> E enumValue(Class<E> type, String name, E fallback) {
        try {
            return Enum.valueOf(type, name == null ? "" : name);
        } catch (IllegalArgumentException ignored) {
            return fallback;
        }
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
