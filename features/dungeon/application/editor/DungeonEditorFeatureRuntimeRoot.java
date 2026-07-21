package features.dungeon.application.editor;

import java.util.Objects;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;
import features.dungeon.api.DungeonEditorViewMode;
import features.dungeon.api.DungeonOverlaySettings;
import features.dungeon.api.editor.DungeonEditorToolSelection;
import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import features.dungeon.api.editor.DungeonEditorViewportInput;
import features.dungeon.api.editor.DungeonEditorApi;
import features.dungeon.api.editor.DungeonEditorIntent;
import features.dungeon.api.editor.DungeonEditorPointerInput;
import features.dungeon.api.editor.DungeonEditorState;
import platform.ui.UiDispatcher;

public final class DungeonEditorFeatureRuntimeRoot
        implements DungeonEditorApi,
                DungeonEditorMapCatalogOperations,
                DungeonEditorControlOperations,
                DungeonEditorPointerInteractionOperations,
                DungeonEditorStatePanelDraftOperations,
                DungeonEditorInlineLabelOperations,
                DungeonEditorTransitionStairOperations {
    private final DungeonEditorStatePublisher statePublisher;
    private final DungeonEditorRuntimeCommands commands;
    private final DungeonEditorPointerWorkflow pointerWorkflow;
    private final DungeonEditorRuntimeContext context;
    private final UiDispatcher uiDispatcher;
    private final AtomicBoolean initializationRequested = new AtomicBoolean();

    public static DungeonEditorFeatureRuntimeRoot create(DungeonEditorRuntimeDependencies dependencies) {
        DungeonEditorFeatureRuntimeRoot runtime = createUnstarted(dependencies);
        runtime.initialize();
        return runtime;
    }

    public static DungeonEditorFeatureRuntimeRoot createUnstarted(DungeonEditorRuntimeDependencies dependencies) {
        DungeonEditorRuntimeDependencies safeDependencies =
                Objects.requireNonNull(dependencies, "dependencies");
        DungeonEditorMainViewInteractionState interactionState = new DungeonEditorMainViewInteractionState();
        DungeonEditorRuntimeContext context =
                DungeonEditorRuntimeContext.create(safeDependencies, interactionState);
        return new DungeonEditorFeatureRuntimeRoot(
                safeDependencies.editorRuntimeApplicationService().projectionState(),
                interactionState,
                context,
                safeDependencies.requestGeneration(),
                safeDependencies.executionLane(),
                safeDependencies.uiDispatcher());
    }

    private DungeonEditorFeatureRuntimeRoot(
            DungeonEditorProjectionState projectionState,
            DungeonEditorMainViewInteractionState interactionState,
            DungeonEditorRuntimeContext context,
            java.util.function.LongSupplier requestGeneration,
            platform.execution.ExecutionLane executionLane,
            UiDispatcher uiDispatcher
    ) {
        DungeonEditorProjectionState safeProjectionState =
                Objects.requireNonNull(projectionState, "projectionState");
        DungeonEditorMainViewInteractionState safeInteractionState =
                Objects.requireNonNull(interactionState, "interactionState");
        DungeonEditorRuntimeContext safeContext = Objects.requireNonNull(context, "context");
        this.context = safeContext;
        this.uiDispatcher = Objects.requireNonNull(uiDispatcher, "uiDispatcher");
        platform.execution.ExecutionLane safeExecutionLane =
                Objects.requireNonNull(executionLane, "executionLane");
        DungeonEditorRuntimeDraftSession draftSession = new DungeonEditorRuntimeDraftSession();
        statePublisher = new DungeonEditorStatePublisher(
                safeProjectionState,
                draftSession,
                requestGeneration,
                safeExecutionLane);
        DungeonEditorStairDraftRuntimeOperation stairDraftOperation =
                new DungeonEditorStairDraftRuntimeOperation(safeContext);
        DungeonEditorSelectedHandleRuntimeOperation selectedHandleOperation =
                new DungeonEditorSelectedHandleRuntimeOperation(safeContext);
        commands = new DungeonEditorRuntimeCommands(
                safeContext,
                safeProjectionState,
                safeInteractionState,
                draftSession,
                statePublisher,
                stairDraftOperation,
                selectedHandleOperation,
                safeExecutionLane);
        pointerWorkflow = new DungeonEditorPointerWorkflow(
                new DungeonEditorPointerWorkflow.RuntimeFamilies(
                        new DungeonEditorRoomPaintRuntimeOperation(safeContext),
                        new DungeonEditorWallBoundaryDraftRuntimeOperation(safeContext),
                        new DungeonEditorDoorBoundaryDraftRuntimeOperation(safeContext),
                        new DungeonEditorCorridorDraftRuntimeOperation(safeContext),
                        stairDraftOperation,
                        new DungeonEditorStairDeleteRuntimeOperation(safeContext),
                        new DungeonEditorTransitionRuntimeOperation(safeContext),
                        new DungeonEditorFeatureMarkerRuntimeOperation(safeContext),
                        selectedHandleOperation),
                commands,
                safeExecutionLane);
        commands.bindPointerOperations(pointerWorkflow);
    }

    public void initialize() {
        if (initializationRequested.compareAndSet(false, true)) {
            commands.apply(context::publishCurrent);
        }
    }

    public void setViewport(DungeonEditorViewportInput viewport) {
        commands.setViewport(viewport);
    }

    @Override
    public DungeonEditorState current() {
        return statePublisher.currentState();
    }

    @Override
    public Runnable subscribe(Consumer<features.dungeon.api.editor.DungeonEditorState> subscriber) {
        StateDelivery delivery = new StateDelivery(
                Objects.requireNonNull(subscriber, "subscriber"),
                uiDispatcher);
        Runnable unsubscribeRuntime = statePublisher.subscribe(delivery::deliver);
        return () -> {
            delivery.close();
            unsubscribeRuntime.run();
        };
    }

    @Override
    public void dispatch(DungeonEditorIntent intent) {
        DungeonEditorIntent safeIntent = Objects.requireNonNull(intent, "intent");
        if (safeIntent instanceof DungeonEditorIntent.SetViewport value) {
            setViewport(value.viewport());
        } else if (safeIntent instanceof DungeonEditorIntent.SelectMap value) {
            selectMap(value.mapId().value());
        } else if (safeIntent instanceof DungeonEditorIntent.ReloadMap value) {
            reloadMap(value.mapId().value());
        } else if (safeIntent instanceof DungeonEditorIntent.CreateMap value) {
            createMap(value.mapName());
        } else if (safeIntent instanceof DungeonEditorIntent.RenameMap value) {
            renameMap(value.mapId().value(), value.mapName());
        } else if (safeIntent instanceof DungeonEditorIntent.DeleteMap value) {
            deleteMap(value.mapId().value());
        } else if (safeIntent instanceof DungeonEditorIntent.SetViewMode value) {
            setViewMode(value.viewMode());
        } else if (safeIntent instanceof DungeonEditorIntent.SetTool value) {
            setTool(value.selection());
        } else if (safeIntent instanceof DungeonEditorIntent.ShiftProjectionLevel value) {
            shiftProjectionLevel(value.levelShift());
        } else if (safeIntent instanceof DungeonEditorIntent.SetOverlay value) {
            setOverlay(value.overlaySettings());
        } else if (safeIntent instanceof DungeonEditorIntent.ScrollSelection value) {
            scrollSelection(value.levelDelta());
        } else if (safeIntent == DungeonEditorIntent.CancelPreview.INSTANCE) {
            cancelActivePreviewSession();
        } else if (safeIntent == DungeonEditorIntent.Undo.INSTANCE) {
            undo();
        } else if (safeIntent == DungeonEditorIntent.Redo.INSTANCE) {
            redo();
        } else if (safeIntent instanceof DungeonEditorIntent.UpdateRoomNarration value) {
            updateStatePanelRoomNarrationDraft(roomNarrationDraftFrom(value.narration()));
        } else if (safeIntent instanceof DungeonEditorIntent.CommitRoomNarration value) {
            saveRoomNarration(roomNarrationFrom(value.narration()));
        } else if (safeIntent instanceof DungeonEditorIntent.UpdateLabelName value) {
            updateStatePanelLabelNameDraft(labelTargetFrom(value.target()), value.name());
        } else if (safeIntent instanceof DungeonEditorIntent.CommitLabelName value) {
            saveLabelName(labelTargetFrom(value.target()), value.name());
        } else if (safeIntent instanceof DungeonEditorIntent.UpdateCorridorPoint value) {
            updateStatePanelCorridorPointDraft(value.q(), value.r());
        } else if (safeIntent instanceof DungeonEditorIntent.CommitCorridorPoint value) {
            moveStatePanelCorridorPoint(value.q(), value.r());
        } else if (safeIntent instanceof DungeonEditorIntent.UpdateTransitionDescription value) {
            updateStatePanelTransitionDescriptionDraft(value.transitionId(), value.description());
        } else if (safeIntent instanceof DungeonEditorIntent.CommitTransitionDescription value) {
            saveTransitionDescription(value.transitionId(), value.description());
        } else if (safeIntent instanceof DungeonEditorIntent.CommitFeatureMarkerSemantics value) {
            saveFeatureMarkerSemantics(value.markerId(), value.label(), value.description());
        } else if (safeIntent instanceof DungeonEditorIntent.UpdateTransitionDestination value) {
            updateStatePanelTransitionDestinationDraft(destinationFrom(value.destination()));
        } else if (safeIntent instanceof DungeonEditorIntent.CommitTransitionDestination value) {
            saveTransitionLink(value.sourceTransitionId(), destinationFrom(value.destination()));
        } else if (safeIntent instanceof DungeonEditorIntent.UpdateStairGeometry value) {
            updateStatePanelStairGeometryDraft(stairFrom(value.geometry()));
        } else if (safeIntent instanceof DungeonEditorIntent.CommitStairGeometry value) {
            saveStairGeometry(stairFrom(value.geometry()));
        } else if (safeIntent instanceof DungeonEditorIntent.Pointer value) {
            dispatchPointer(value.input());
        } else if (safeIntent == DungeonEditorIntent.ClearPointerSession.INSTANCE) {
            clearPointerSession();
        } else {
            throw new IllegalArgumentException("Unsupported Dungeon Editor intent: " + safeIntent.getClass());
        }
    }

    private void dispatchPointer(DungeonEditorPointerInput input) {
        if (input.sourceRevision() != current().publicationRevision()) {
            rejectCommand(DungeonEditorCommandOutcome.RejectionReason.STALE_REVISION);
            return;
        }
        applyPointerInteraction(new PointerInteractionRequest(
                pointerActionFrom(input.action()),
                input.toolSelection(),
                input.gesture(),
                PointerInteractionTargets.fromTargets(
                        input.sceneX(),
                        input.sceneY(),
                        input.gesture().primary(),
                        input.gesture().secondary(),
                        input.targets(),
                        input.projectionLevel()),
                input.projectionLevel(),
                TransitionDestination.fromDraftInput(destinationFrom(input.transitionDestination()))));
    }

    private static PointerAction pointerActionFrom(DungeonEditorPointerInput.Action action) {
        return switch (action == null ? DungeonEditorPointerInput.Action.MOVED : action) {
            case PRESSED -> PointerAction.PRESSED;
            case DRAGGED -> PointerAction.DRAGGED;
            case RELEASED -> PointerAction.RELEASED;
            case MOVED -> PointerAction.MOVED;
        };
    }

    @Override
    public void selectMap(long mapIdValue) {
        commands.selectMap(mapIdValue);
    }

    @Override
    public void reloadMap(long mapIdValue) {
        commands.reloadMap(mapIdValue);
    }

    @Override
    public void createMap(String mapName) {
        commands.createMap(mapName);
    }

    @Override
    public void renameMap(long mapIdValue, String mapName) {
        commands.renameMap(mapIdValue, mapName);
    }

    @Override
    public void deleteMap(long mapIdValue) {
        commands.deleteMap(mapIdValue);
    }

    @Override
    public void setViewMode(DungeonEditorViewMode viewMode) {
        commands.setViewMode(viewMode);
    }

    @Override
    public void setTool(DungeonEditorToolSelection selection) {
        commands.setTool(selection);
    }

    @Override
    public void cancelActivePreviewSession() {
        commands.cancelActivePreviewSession();
    }

    @Override
    public void undo() {
        commands.undo();
    }

    @Override
    public void redo() {
        commands.redo();
    }

    @Override
    public void shiftProjectionLevel(int levelShift) {
        commands.shiftProjectionLevel(levelShift);
    }

    @Override
    public void setOverlay(DungeonOverlaySettings overlaySettings) {
        commands.setOverlay(overlaySettings);
    }

    @Override
    public void scrollSelection(int levelDelta) {
        commands.scrollSelection(levelDelta);
    }

    @Override
    public PointerInteractionResult applyPointerInteraction(PointerInteractionRequest request) {
        return pointerWorkflow.applyPointerInteraction(request);
    }

    @Override
    public void clearPointerSession() {
        pointerWorkflow.clearPointerSession();
    }

    public void rejectCommand(DungeonEditorCommandOutcome.RejectionReason reason) {
        commands.rejectCommand(reason);
    }

    @Override
    public void updateStatePanelRoomNarrationDraft(RoomNarrationDraftInput input) {
        commands.updateStatePanelRoomNarrationDraft(input);
    }

    @Override
    public void updateStatePanelLabelNameDraft(DungeonEditorRuntimeLabelTarget target, String name) {
        commands.updateStatePanelLabelNameDraft(target, name);
    }

    @Override
    public void updateStatePanelCorridorPointDraft(String q, String r) {
        commands.updateStatePanelCorridorPointDraft(q, r);
    }

    @Override
    public void moveStatePanelCorridorPoint(int q, int r) {
        commands.moveStatePanelCorridorPoint(q, r);
    }

    @Override
    public void updateStatePanelTransitionDescriptionDraft(long transitionId, String description) {
        commands.updateStatePanelTransitionDescriptionDraft(transitionId, description);
    }

    @Override
    public void updateStatePanelTransitionDestinationDraft(TransitionDestinationDraftInput input) {
        commands.updateStatePanelTransitionDestinationDraft(input);
    }

    @Override
    public void updateStatePanelStairGeometryDraft(StairGeometryDraftInput input) {
        commands.updateStatePanelStairGeometryDraft(input);
    }

    @Override
    public void beginInlineLabelEdit(DungeonEditorInlineLabelEditSession session) {
        commands.beginInlineLabelEdit(session);
    }

    @Override
    public void updateInlineLabelEditDraft(String text) {
        commands.updateInlineLabelEditDraft(text);
    }

    @Override
    public void cancelInlineLabelEdit() {
        commands.cancelInlineLabelEdit();
    }

    @Override
    public void commitInlineLabelEdit(String text) {
        commands.commitInlineLabelEdit(text);
    }

    @Override
    public void saveRoomNarration(RoomNarration narration) {
        commands.saveRoomNarration(narration);
    }

    @Override
    public void saveLabelName(DungeonEditorRuntimeLabelTarget target, String name) {
        commands.saveLabelName(target, name);
    }

    @Override
    public void saveTransitionLink(long sourceTransitionId, TransitionDestinationDraftInput input) {
        commands.saveTransitionLink(sourceTransitionId, input);
    }

    @Override
    public void saveTransitionDescription(long transitionId, String description) {
        commands.saveTransitionDescription(transitionId, description);
    }

    public void saveFeatureMarkerSemantics(long markerId, String label, String description) {
        commands.saveFeatureMarkerSemantics(markerId, label, description);
    }

    @Override
    public void saveStairGeometry(StairGeometryDraftInput input) {
        commands.saveStairGeometry(input);
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
