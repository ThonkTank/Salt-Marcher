package src.features.dungeon.runtime;

import java.util.Objects;
import src.domain.dungeon.published.DungeonEditorMapSurfaceModel;
import src.domain.dungeon.published.DungeonEditorPreview;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
import src.domain.dungeon.published.DungeonEditorTool;
import src.domain.dungeon.published.DungeonEditorViewMode;
import src.domain.dungeon.published.DungeonOverlaySettings;

final class DungeonEditorRuntimeControlController {
    private static final DungeonEditorSelector<DungeonEditorTool> SELECTED_TOOL =
            DungeonEditorSelector.of(DungeonEditorStoreState::selectedTool);
    private static final DungeonEditorSelector<DungeonEditorViewMode> SELECTED_VIEW_MODE =
            DungeonEditorSelector.of(DungeonEditorStoreState::viewMode);
    private static final DungeonEditorSelector<Integer> PROJECTION_LEVEL =
            DungeonEditorSelector.of(DungeonEditorStoreState::projectionLevel);
    private static final DungeonEditorSelector<DungeonOverlaySettings> OVERLAY_SETTINGS =
            DungeonEditorSelector.of(DungeonEditorStoreState::overlaySettings);

    private final DungeonEditorStore store;
    private final DungeonEditorMainViewInteractionState interactionState;
    private final DungeonEditorPointerInteractionOperations pointerOperations;
    private final DungeonEditorRuntimeDraftSession draftSession;
    private final DungeonEditorAuthoredRuntimeOperations operationOwner;
    private final DungeonEditorRuntimeFramePublisher framePublisher;
    private final DungeonEditorMapSurfaceModel mapSurfaceModel;

    DungeonEditorRuntimeControlController(
            DungeonEditorStore store,
            DungeonEditorMainViewInteractionState interactionState,
            DungeonEditorPointerInteractionOperations pointerOperations,
            DungeonEditorRuntimeDraftSession draftSession,
            DungeonEditorAuthoredRuntimeOperations operationOwner,
            DungeonEditorRuntimeFramePublisher framePublisher,
            DungeonEditorMapSurfaceModel mapSurfaceModel
    ) {
        this.store = Objects.requireNonNull(store, "store");
        this.interactionState = Objects.requireNonNull(interactionState, "interactionState");
        this.pointerOperations = Objects.requireNonNull(pointerOperations, "pointerOperations");
        this.draftSession = Objects.requireNonNull(draftSession, "draftSession");
        this.operationOwner = Objects.requireNonNull(operationOwner, "operationOwner");
        this.framePublisher = Objects.requireNonNull(framePublisher, "framePublisher");
        this.mapSurfaceModel = Objects.requireNonNull(mapSurfaceModel, "mapSurfaceModel");
    }

    void selectViewMode(DungeonEditorViewMode viewMode) {
        store.dispatch(new DungeonEditorAction.SelectViewMode(viewMode));
        clearActiveInteraction();
        DungeonEditorRuntimeOperationPublisher.apply(
                store,
                framePublisher,
                () -> operationOwner.setViewMode(freshSelectorValue(SELECTED_VIEW_MODE)));
    }

    void selectTool(DungeonEditorTool tool) {
        store.dispatch(new DungeonEditorAction.SelectTool(tool));
        clearActiveInteraction();
        if (activePublishedMapInteraction()) {
            DungeonEditorRuntimeOperationPublisher.apply(
                    store,
                    framePublisher,
                    () -> operationOwner.setToolAndPublishSnapshot(freshSelectorValue(SELECTED_TOOL)));
            return;
        }
        DungeonEditorRuntimeOperationPublisher.apply(
                store,
                framePublisher,
                () -> operationOwner.setTool(freshSelectorValue(SELECTED_TOOL)));
    }

    void cancelActivePreviewSession() {
        store.dispatch(new DungeonEditorAction.SelectTool(DungeonEditorTool.SELECT));
        clearActiveInteraction();
        if (!activePublishedMapInteraction()) {
            DungeonEditorRuntimeOperationPublisher.apply(
                    store,
                    framePublisher,
                    () -> operationOwner.setTool(DungeonEditorTool.SELECT));
            return;
        }
        DungeonEditorRuntimeOperationPublisher.apply(
                store,
                framePublisher,
                operationOwner::cancelActivePreviewSession);
    }

    void shiftProjectionLevel(int levelShift) {
        dispatchProjectionShift(levelShift);
        DungeonEditorRuntimeOperationPublisher.apply(
                store,
                framePublisher,
                () -> operationOwner.shiftProjectionLevel(levelShift));
    }

    void setOverlay(DungeonEditorOverlaySettings overlaySettings) {
        DungeonEditorOverlaySettings safeOverlaySettings = overlaySettings == null
                ? DungeonEditorOverlaySettings.defaults()
                : overlaySettings;
        store.dispatch(new DungeonEditorAction.SetOverlay(safeOverlaySettings.toPublishedSettings()));
        DungeonEditorOverlaySettings selectedOverlaySettings =
                DungeonEditorOverlaySettings.fromPublishedSettings(freshSelectorValue(OVERLAY_SETTINGS));
        DungeonEditorRuntimeOperationPublisher.apply(
                store,
                framePublisher,
                () -> operationOwner.setOverlay(selectedOverlaySettings));
    }

    void scrollSelection(int levelDelta) {
        var currentInteractionState = interactionState.interactionState();
        if (levelDelta != 0
                && !currentInteractionState.dragSession().present()
                && !currentInteractionState.boundaryStretchSession().present()) {
            dispatchProjectionShift(levelDelta);
        }
        DungeonEditorRuntimeOperationPublisher.apply(
                store,
                framePublisher,
                () -> operationOwner.scrollSelection(levelDelta));
    }

    private void dispatchProjectionShift(int levelShift) {
        int previousProjectionLevel = freshSelectorValue(PROJECTION_LEVEL);
        store.dispatch(new DungeonEditorAction.ShiftProjectionLevel(levelShift));
        int currentProjectionLevel = freshSelectorValue(PROJECTION_LEVEL);
        if (currentProjectionLevel != previousProjectionLevel + levelShift) {
            throw new IllegalStateException("Dungeon editor store projection level shift was not applied");
        }
    }

    private void clearActiveInteraction() {
        interactionState.clear();
        pointerOperations.clearPointerSession();
        draftSession.clearInlineLabelEditSession();
        store.dispatch(new DungeonEditorAction.MarkDraftSessionChanged());
    }

    private boolean activePublishedMapInteraction() {
        return !DungeonEditorPreview.none().equals(mapSurfaceModel.current().preview())
                || !DungeonEditorStateSnapshot.Selection.empty().equals(mapSurfaceModel.current().selection());
    }

    private <T> T freshSelectorValue(DungeonEditorSelector<T> selector) {
        DungeonEditorSelectorResult<T> result = store.select(selector);
        return result.requireFreshAgainst(
                store.state(),
                "Dungeon editor store selector result is stale");
    }

}
