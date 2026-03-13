package features.world.dungeonmap.ui.editor.workflow.loading;

import features.world.dungeonmap.model.DungeonArea;
import features.world.dungeonmap.model.DungeonFeature;
import features.world.dungeonmap.model.DungeonMap;
import features.world.dungeonmap.model.DungeonMapState;
import features.world.dungeonmap.service.DungeonMapQueryService;
import features.world.dungeonmap.ui.DungeonUiAsyncSupport;
import features.world.dungeonmap.ui.canvas.DungeonMapPane;
import features.world.dungeonmap.ui.editor.controls.DungeonEditorControls;
import features.world.dungeonmap.ui.editor.panes.DungeonToolSettingsPane;
import features.world.dungeonmap.ui.editor.state.DungeonEditorState;
import features.world.dungeonmap.ui.editor.state.DungeonSelectionRestoreRequest;
import features.world.dungeonmap.ui.editor.workflow.selection.DungeonLinkWorkflowController;
import features.world.dungeonmap.ui.editor.workflow.selection.DungeonSelectionWorkflowController;
import ui.async.UiErrorReporter;

import java.util.List;

public final class DungeonMapLoadingController {

    private final DungeonEditorState state;
    private final DungeonEditorControls controls;
    private final DungeonMapPane canvas;
    private final DungeonToolSettingsPane toolSettingsPane;
    private final DungeonSelectionWorkflowController selectionController;
    private final DungeonLinkWorkflowController linkWorkflowController;
    private final DungeonSelectionRestoreController selectionRestoreController;
    private Runnable onMapLoaded = () -> { };

    public DungeonMapLoadingController(
            DungeonEditorState state,
            DungeonEditorControls controls,
            DungeonMapPane canvas,
            DungeonToolSettingsPane toolSettingsPane,
            DungeonSelectionWorkflowController selectionController,
            DungeonLinkWorkflowController linkWorkflowController,
            DungeonSelectionRestoreController selectionRestoreController
    ) {
        this.state = state;
        this.controls = controls;
        this.canvas = canvas;
        this.toolSettingsPane = toolSettingsPane;
        this.selectionController = selectionController;
        this.linkWorkflowController = linkWorkflowController;
        this.selectionRestoreController = selectionRestoreController;
    }

    public void onShow() {
        loadMapList();
    }

    public void loadMapAsync(Long mapId) {
        if (mapId == null) {
            clearLoadedState();
            return;
        }
        linkWorkflowController.cancelPendingLink();
        state.setCurrentMapId(mapId);
        long requestToken = state.nextLoadRequestToken();
        DungeonUiAsyncSupport.submitValue(
                () -> DungeonMapQueryService.loadMapState(mapId),
                loadedState -> {
                    if (requestToken == state.loadRequestToken() && mapId.equals(state.currentMapId())) {
                        applyLoadedState(loadedState);
                    }
                },
                ex -> {
                    if (requestToken == state.loadRequestToken() && mapId.equals(state.currentMapId())) {
                        handleLoadFailure();
                    }
                    UiErrorReporter.reportBackgroundFailure("DungeonMapLoadingController.loadMapAsync()", ex);
                });
    }

    public void reloadCurrentMap() {
        reloadCurrentMap(null);
    }

    public void reloadCurrentMap(DungeonSelectionRestoreRequest request) {
        selectionRestoreController.setPendingSelectionRestore(request);
        loadMapAsync(state.currentMapId());
    }

    public void setOnMapLoaded(Runnable callback) {
        onMapLoaded = callback == null ? () -> { } : callback;
    }

    void loadMapList() {
        DungeonUiAsyncSupport.submitValue(
                DungeonMapQueryService::getAllMaps,
                maps -> {
                    controls.setMaps(maps);
                    Long mapToSelect = resolveMapSelection(maps);
                    if (mapToSelect == null) {
                        clearLoadedState();
                    } else {
                        toolSettingsPane.setMapLoaded(true);
                        // Keep the toolbar selection in sync with the restored map list.
                        // The interaction state does not own map selection.
                        controls.selectMap(mapToSelect);
                        loadMapAsync(mapToSelect);
                    }
                },
                ex -> {
                    canvas.showLoadError("Dungeonliste konnte nicht geladen werden");
                    UiErrorReporter.reportBackgroundFailure("DungeonMapLoadingController.loadMapList()", ex);
                });
    }

    Long resolveMapSelection(List<DungeonMap> maps) {
        Long mapToSelect = state.currentMapId();
        if (mapToSelect != null) {
            for (DungeonMap map : maps) {
                if (mapToSelect.equals(map.mapId())) {
                    return mapToSelect;
                }
            }
        }
        return maps.isEmpty() ? null : maps.get(0).mapId();
    }

    private void applyLoadedState(DungeonMapState loadedState) {
        state.setCurrentState(loadedState);
        onMapLoaded.run();
        applyEditorState(loadedState);
    }

    private void clearLoadedState() {
        state.setCurrentMapId(null);
        state.setCurrentState(null);
        applyEditorState(null);
    }

    private void handleLoadFailure() {
        state.setCurrentState(null);
        canvas.showLoadError("Dungeon konnte nicht geladen werden");
        toolSettingsPane.setMapLoaded(false);
        toolSettingsPane.setAreas(List.of());
        toolSettingsPane.setFeatures(List.of());
        linkWorkflowController.cancelPendingLink();
        selectionController.clearSelection();
    }

    private void applyEditorState(DungeonMapState loadedState) {
        applyViewData(loadedState);
        resetTransientUiState();
        selectionRestoreController.restoreAfterLoad(loadedState);
    }

    private void applyViewData(DungeonMapState loadedState) {
        canvas.loadState(loadedState);
        List<DungeonArea> areas = loadedState == null ? List.of() : loadedState.areas();
        List<DungeonFeature> features = loadedState == null ? List.of() : loadedState.features();
        toolSettingsPane.setAreas(areas);
        toolSettingsPane.setFeatures(features);
        toolSettingsPane.setMapLoaded(loadedState != null && loadedState.map() != null);
    }

    private void resetTransientUiState() {
        linkWorkflowController.cancelPendingLink();
        selectionController.clearSelection();
    }
}
