package src.features.dungeon.runtime;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Supplier;
import platform.execution.ExecutionLane;
import src.domain.dungeon.published.DungeonEditorControlsModel;
import src.domain.dungeon.published.DungeonEditorMapSurfaceModel;
import src.domain.dungeon.published.DungeonEditorPreview;
import src.domain.dungeon.published.DungeonEditorStateModel;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
import src.domain.dungeon.published.DungeonEditorTool;
import src.domain.dungeon.published.DungeonEditorViewMode;

final class DungeonEditorRuntimeCommands
        implements DungeonEditorMapCatalogOperations,
                DungeonEditorControlOperations,
                DungeonEditorStatePanelDraftOperations,
                DungeonEditorInlineLabelOperations,
                DungeonEditorTransitionStairOperations {
    private final DungeonEditorRuntimeContext context;
    private final DungeonEditorControlsModel controlsModel;
    private final DungeonEditorMapSurfaceModel mapSurfaceModel;
    private final DungeonEditorStateModel stateModel;
    private final DungeonEditorMainViewInteractionState interactionState;
    private final DungeonEditorRuntimeDraftSession draftSession;
    private final DungeonEditorRuntimeFramePublisher framePublisher;
    private final DungeonEditorStairDraftRuntimeOperation stairDraftOperation;
    private final DungeonEditorSelectedHandleRuntimeOperation selectedHandleOperation;
    private final ExecutionLane executionLane;
    private DungeonEditorPointerInteractionOperations pointerOperations;

    DungeonEditorRuntimeCommands(
            DungeonEditorRuntimeContext context,
            DungeonEditorControlsModel controlsModel,
            DungeonEditorMapSurfaceModel mapSurfaceModel,
            DungeonEditorStateModel stateModel,
            DungeonEditorMainViewInteractionState interactionState,
            DungeonEditorRuntimeDraftSession draftSession,
            DungeonEditorRuntimeFramePublisher framePublisher,
            DungeonEditorStairDraftRuntimeOperation stairDraftOperation,
            DungeonEditorSelectedHandleRuntimeOperation selectedHandleOperation,
            ExecutionLane executionLane
    ) {
        this.context = Objects.requireNonNull(context, "context");
        this.controlsModel = Objects.requireNonNull(controlsModel, "controlsModel");
        this.mapSurfaceModel = Objects.requireNonNull(mapSurfaceModel, "mapSurfaceModel");
        this.stateModel = Objects.requireNonNull(stateModel, "stateModel");
        this.interactionState = Objects.requireNonNull(interactionState, "interactionState");
        this.draftSession = Objects.requireNonNull(draftSession, "draftSession");
        this.framePublisher = Objects.requireNonNull(framePublisher, "framePublisher");
        this.stairDraftOperation = Objects.requireNonNull(stairDraftOperation, "stairDraftOperation");
        this.selectedHandleOperation = Objects.requireNonNull(selectedHandleOperation, "selectedHandleOperation");
        this.executionLane = Objects.requireNonNull(executionLane, "executionLane");
    }

    void bindPointerOperations(DungeonEditorPointerInteractionOperations pointerOperations) {
        this.pointerOperations = Objects.requireNonNull(pointerOperations, "pointerOperations");
    }

    @Override
    public void selectMap(long mapIdValue) {
        execute(() -> {
            interactionState.clear();
            draftSession.clearInlineLabelEditSession();
            framePublisher.markDraftSessionChanged();
            stairDraftOperation.clear();
            applyInExecutionLane(() -> context.selectMap(mapIdValue));
        });
    }

    @Override
    public void createMap(String mapName) {
        execute(() -> {
            interactionState.clear();
            stairDraftOperation.clear();
            applyInExecutionLane(() -> context.createMap(mapName));
        });
    }

    @Override
    public void renameMap(long mapIdValue, String mapName) {
        apply(() -> context.renameMap(mapIdValue, mapName));
    }

    @Override
    public void deleteMap(long mapIdValue) {
        execute(() -> {
            interactionState.clear();
            stairDraftOperation.clear();
            applyInExecutionLane(() -> context.deleteMap(mapIdValue));
        });
    }

    @Override
    public void setViewMode(DungeonEditorViewMode viewMode) {
        execute(() -> {
            clearActiveInteraction();
            stairDraftOperation.clear();
            applyInExecutionLane(() -> context.setViewMode(viewMode));
        });
    }

    @Override
    public void setTool(DungeonEditorTool tool) {
        execute(() -> {
            clearActiveInteraction();
            stairDraftOperation.clear();
            if (activePublishedMapInteraction()) {
                applyInExecutionLane(() -> context.setToolAndPublishSnapshot(tool));
                return;
            }
            applyInExecutionLane(() -> context.setTool(tool));
        });
    }

    @Override
    public void cancelActivePreviewSession() {
        execute(() -> {
            clearActiveInteraction();
            stairDraftOperation.clear();
            if (!activePublishedMapInteraction()) {
                applyInExecutionLane(() -> context.setTool(DungeonEditorTool.SELECT));
                return;
            }
            applyInExecutionLane(context::cancelActivePreviewSession);
        });
    }

    @Override
    public void shiftProjectionLevel(int levelShift) {
        apply(() -> context.shiftProjectionLevel(levelShift)
                .merge(stairDraftOperation.refreshAfterProjectionLevelChanged()));
    }

    @Override
    public void setOverlay(DungeonEditorOverlaySettings overlaySettings) {
        DungeonEditorOverlaySettings safeOverlaySettings = overlaySettings == null
                ? DungeonEditorOverlaySettings.defaults()
                : overlaySettings;
        apply(() -> context.setOverlay(safeOverlaySettings));
    }

    @Override
    public void scrollSelection(int levelDelta) {
        apply(() -> selectedHandleOperation.scroll(levelDelta));
    }

    @Override
    public void updateStatePanelRoomNarrationDraft(RoomNarrationDraftInput input) {
        execute(() -> {
            draftSession.updateRoomNarrationDraft(currentSelectedMapIdValue(), input);
            framePublisher.publishDraftSessionChanged();
        });
    }

    @Override
    public void updateStatePanelLabelNameDraft(DungeonEditorRuntimeLabelTarget target, String name) {
        execute(() -> {
            draftSession.updateLabelNameDraft(currentSelectedMapIdValue(), target, name);
            framePublisher.publishDraftSessionChanged();
        });
    }

    @Override
    public void updateStatePanelCorridorPointDraft(String q, String r) {
        execute(() -> {
            draftSession.updateCorridorPointDraft(currentSelectedMapIdValue(), currentStateSelection(), q, r);
            framePublisher.publishDraftSessionChanged();
        });
    }

    @Override
    public void moveStatePanelCorridorPoint(int q, int r) {
        apply(() -> draftSession.moveCorridorPoint(
                currentSelectedMapIdValue(),
                currentStateSelection(),
                q,
                r,
                selectedHandleOperation));
    }

    @Override
    public void updateStatePanelTransitionDescriptionDraft(long transitionId, String description) {
        execute(() -> {
            draftSession.updateTransitionDescriptionDraft(currentSelectedMapIdValue(), transitionId, description);
            framePublisher.publishDraftSessionChanged();
        });
    }

    @Override
    public void updateStatePanelTransitionDestinationDraft(TransitionDestinationDraftInput input) {
        execute(() -> {
            draftSession.updateTransitionDestinationDraft(
                    currentSelectedMapIdValue(),
                    controlsModel.current(),
                    stateModel.current(),
                    input);
            framePublisher.publishDraftSessionChanged();
        });
    }

    @Override
    public void updateStatePanelStairGeometryDraft(StairGeometryDraftInput input) {
        execute(() -> {
            draftSession.updateStairGeometryDraft(currentSelectedMapIdValue(), input);
            framePublisher.publishDraftSessionChanged();
        });
    }

    @Override
    public void beginInlineLabelEdit(DungeonEditorInlineLabelEditSession session) {
        execute(() -> {
            draftSession.beginInlineLabelEdit(session);
            framePublisher.publishDraftSessionChanged();
        });
    }

    @Override
    public void updateInlineLabelEditDraft(String text) {
        execute(() -> {
            draftSession.updateInlineLabelEditDraft(text);
            framePublisher.publishDraftSessionChanged();
        });
    }

    @Override
    public void cancelInlineLabelEdit() {
        execute(() -> {
            draftSession.clearInlineLabelEditSession();
            framePublisher.publishDraftSessionChanged();
        });
    }

    @Override
    public void commitInlineLabelEdit(String text) {
        execute(() -> {
            DungeonEditorInlineLabelEditSession editSession = draftSession.takeInlineLabelEditSession();
            framePublisher.publishDraftSessionChanged();
            if (!editSession.active() || !editSession.target().present() || text == null || text.isBlank()) {
                return;
            }
            saveLabelNameInExecutionLane(editSession.target(), text);
        });
    }

    @Override
    public void saveRoomNarration(RoomNarration narration) {
        execute(() -> {
            long roomId = narration == null ? 0L : narration.roomId();
            draftSession.clearRoomNarrationDraft(currentSelectedMapIdValue(), roomId);
            framePublisher.markDraftSessionChanged();
            applyInExecutionLane(() -> context.saveRoomNarration(narration));
        });
    }

    @Override
    public void saveLabelName(DungeonEditorRuntimeLabelTarget target, String name) {
        DungeonEditorRuntimeLabelTarget safeTarget = DungeonEditorRuntimeLabelTarget.orEmpty(target);
        execute(() -> saveLabelNameInExecutionLane(safeTarget, name));
    }

    private void saveLabelNameInExecutionLane(DungeonEditorRuntimeLabelTarget target, String name) {
        DungeonEditorRuntimeLabelTarget safeTarget = DungeonEditorRuntimeLabelTarget.orEmpty(target);
        draftSession.clearLabelNameDraft(currentSelectedMapIdValue(), safeTarget);
        framePublisher.markDraftSessionChanged();
        applyInExecutionLane(() -> context.saveLabelName(safeTarget, name));
    }

    @Override
    public void saveTransitionLink(long sourceTransitionId, TransitionDestinationDraftInput input) {
        TransitionDestinationDraftInput safeInput = input == null
                ? TransitionDestinationDraftInput.unlinkedEntrance()
                : input;
        execute(() -> {
            long selectedMapIdValue = currentSelectedMapIdValue();
            applyInExecutionLane(
                    () -> context.saveTransitionLink(sourceTransitionId, safeInput),
                    result -> clearTransitionDestinationDraftWhenCommitted(
                            selectedMapIdValue,
                            sourceTransitionId,
                            result));
        });
    }

    @Override
    public void saveTransitionDescription(long transitionId, String description) {
        execute(() -> {
            draftSession.clearTransitionDescriptionDraft(currentSelectedMapIdValue(), transitionId);
            framePublisher.markDraftSessionChanged();
            applyInExecutionLane(() -> context.saveTransitionDescription(transitionId, description));
        });
    }

    @Override
    public void saveStairGeometry(StairGeometryDraftInput input) {
        StairGeometryDraftInput safeInput = input == null ? StairGeometryDraftInput.empty() : input;
        if (!safeInput.completeForSave()) {
            return;
        }
        execute(() -> {
            draftSession.clearStairGeometryDraft(currentSelectedMapIdValue(), safeInput.stairId());
            framePublisher.markDraftSessionChanged();
            applyInExecutionLane(() -> context.saveStairGeometry(safeInput));
        });
    }

    void apply(Supplier<DungeonEditorRuntimeContext.Result> action) {
        apply(action, ignored -> { });
    }

    void apply(
            Supplier<DungeonEditorRuntimeContext.Result> action,
            Consumer<DungeonEditorRuntimeContext.Result> beforePublish
    ) {
        Supplier<DungeonEditorRuntimeContext.Result> safeAction = Objects.requireNonNull(action, "action");
        Consumer<DungeonEditorRuntimeContext.Result> safeBeforePublish =
                Objects.requireNonNull(beforePublish, "beforePublish");
        execute(() -> applyOnLane(safeAction, safeBeforePublish));
    }

    void applyInExecutionLane(Supplier<DungeonEditorRuntimeContext.Result> action) {
        applyInExecutionLane(action, ignored -> { });
    }

    private void applyInExecutionLane(
            Supplier<DungeonEditorRuntimeContext.Result> action,
            Consumer<DungeonEditorRuntimeContext.Result> beforePublish
    ) {
        applyOnLane(
                Objects.requireNonNull(action, "action"),
                Objects.requireNonNull(beforePublish, "beforePublish"));
    }

    void execute(Runnable command) {
        executionLane.execute(Objects.requireNonNull(command, "command"));
    }

    private void applyOnLane(
            Supplier<DungeonEditorRuntimeContext.Result> action,
            Consumer<DungeonEditorRuntimeContext.Result> beforePublish
    ) {
        DungeonEditorRuntimeFramePublisher.StateModelFrameDeferral<DungeonEditorRuntimeContext.Result> result =
                framePublisher.deferStateModelFramePublication(action);
        DungeonEditorRuntimeContext.Result operationResult = result.result() == null
                ? DungeonEditorRuntimeContext.Result.none()
                : result.result();
        if (operationResult.shouldPublish(result.stateModelFrameSuppressed())) {
            beforePublish.accept(operationResult);
            framePublisher.publishCurrentToSubscribers();
        }
    }

    private void clearActiveInteraction() {
        interactionState.clear();
        if (pointerOperations != null) {
            pointerOperations.clearPointerSession();
        }
        draftSession.clearInlineLabelEditSession();
        framePublisher.markDraftSessionChanged();
    }

    private boolean activePublishedMapInteraction() {
        return !DungeonEditorPreview.none().equals(mapSurfaceModel.current().preview())
                || !DungeonEditorStateSnapshot.Selection.empty().equals(mapSurfaceModel.current().selection());
    }

    private boolean transitionLinkCommitted(
            long sourceTransitionId,
            DungeonEditorRuntimeContext.Result result
    ) {
        DungeonEditorStateSnapshot state = stateModel.current();
        return DungeonEditorRuntimeDraftSession.selectedTransitionId(state == null ? null : state.selection())
                == sourceTransitionId
                && result != null
                && result.shouldPublish(false);
    }

    private void clearTransitionDestinationDraftWhenCommitted(
            long selectedMapIdValue,
            long sourceTransitionId,
            DungeonEditorRuntimeContext.Result result
    ) {
        if (transitionLinkCommitted(sourceTransitionId, result)) {
            draftSession.clearTransitionDestinationDraft(selectedMapIdValue, sourceTransitionId);
            framePublisher.markDraftSessionChanged();
        }
    }

    private DungeonEditorStateSnapshot.Selection currentStateSelection() {
        DungeonEditorStateSnapshot state = stateModel.current();
        return state == null ? DungeonEditorStateSnapshot.Selection.empty() : state.selection();
    }

    private long currentSelectedMapIdValue() {
        return DungeonEditorRuntimeDraftSession.selectedMapIdValue(controlsModel.current());
    }
}
