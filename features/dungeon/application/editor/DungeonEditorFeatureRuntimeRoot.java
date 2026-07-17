package features.dungeon.application.editor;

import java.util.Objects;
import java.util.function.Consumer;
import features.dungeon.api.DungeonEditorViewMode;
import features.dungeon.api.DungeonOverlaySettings;
import features.dungeon.api.editor.DungeonEditorToolSelection;
import features.dungeon.api.editor.DungeonEditorCommandOutcome;

public final class DungeonEditorFeatureRuntimeRoot
        implements DungeonEditorMapCatalogOperations,
                DungeonEditorControlOperations,
                DungeonEditorPointerInteractionOperations,
                DungeonEditorStatePanelDraftOperations,
                DungeonEditorInlineLabelOperations,
                DungeonEditorTransitionStairOperations {
    private final DungeonEditorStatePublisher statePublisher;
    private final DungeonEditorRuntimeCommands commands;
    private final DungeonEditorPointerWorkflow pointerWorkflow;

    public static DungeonEditorFeatureRuntimeRoot create(DungeonEditorRuntimeDependencies dependencies) {
        DungeonEditorRuntimeDependencies safeDependencies =
                Objects.requireNonNull(dependencies, "dependencies");
        DungeonEditorMainViewInteractionState interactionState = new DungeonEditorMainViewInteractionState();
        DungeonEditorRuntimeContext context =
                DungeonEditorRuntimeContext.create(safeDependencies, interactionState);
        return new DungeonEditorFeatureRuntimeRoot(
                safeDependencies.controlsModel(),
                safeDependencies.mapSurfaceModel(),
                safeDependencies.stateModel(),
                interactionState,
                context,
                safeDependencies.executionLane());
    }

    private DungeonEditorFeatureRuntimeRoot(
            features.dungeon.api.DungeonEditorControlsModel controlsModel,
            features.dungeon.api.DungeonEditorMapSurfaceModel mapSurfaceModel,
            features.dungeon.api.DungeonEditorStateModel stateModel,
            DungeonEditorMainViewInteractionState interactionState,
            DungeonEditorRuntimeContext context,
            platform.execution.ExecutionLane executionLane
    ) {
        features.dungeon.api.DungeonEditorControlsModel safeControlsModel =
                Objects.requireNonNull(controlsModel, "controlsModel");
        features.dungeon.api.DungeonEditorMapSurfaceModel safeMapSurfaceModel =
                Objects.requireNonNull(mapSurfaceModel, "mapSurfaceModel");
        features.dungeon.api.DungeonEditorStateModel safeStateModel =
                Objects.requireNonNull(stateModel, "stateModel");
        DungeonEditorMainViewInteractionState safeInteractionState =
                Objects.requireNonNull(interactionState, "interactionState");
        DungeonEditorRuntimeContext safeContext = Objects.requireNonNull(context, "context");
        platform.execution.ExecutionLane safeExecutionLane =
                Objects.requireNonNull(executionLane, "executionLane");
        DungeonEditorRuntimeDraftSession draftSession = new DungeonEditorRuntimeDraftSession();
        statePublisher = new DungeonEditorStatePublisher(
                safeControlsModel,
                safeMapSurfaceModel,
                safeStateModel,
                draftSession,
                safeExecutionLane);
        DungeonEditorStairDraftRuntimeOperation stairDraftOperation =
                new DungeonEditorStairDraftRuntimeOperation(safeContext);
        DungeonEditorSelectedHandleRuntimeOperation selectedHandleOperation =
                new DungeonEditorSelectedHandleRuntimeOperation(safeContext);
        commands = new DungeonEditorRuntimeCommands(
                safeContext,
                safeControlsModel,
                safeMapSurfaceModel,
                safeStateModel,
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
        commands.apply(safeContext::publishCurrent);
    }

    public features.dungeon.api.editor.DungeonEditorState currentState() {
        return statePublisher.currentState();
    }

    public Runnable subscribe(Consumer<features.dungeon.api.editor.DungeonEditorState> subscriber) {
        return statePublisher.subscribe(subscriber);
    }

    @Override
    public void selectMap(long mapIdValue) {
        commands.selectMap(mapIdValue);
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

    @Override
    public void saveStairGeometry(StairGeometryDraftInput input) {
        commands.saveStairGeometry(input);
    }
}
