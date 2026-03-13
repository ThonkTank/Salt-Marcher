package features.world.dungeonmap.ui.editor.workflow.map;

import features.world.dungeonmap.model.domain.DungeonArea;
import features.world.dungeonmap.model.domain.DungeonFeature;
import features.world.dungeonmap.model.domain.DungeonMap;
import features.world.dungeonmap.model.projection.DungeonMapState;
import features.world.dungeonmap.service.DungeonMapQueryService;
import features.world.dungeonmap.ui.shared.async.DungeonUiAsyncSupport;
import features.world.dungeonmap.ui.shared.canvas.DungeonMapPane;
import features.world.dungeonmap.ui.editor.chrome.controls.DungeonEditorControls;
import features.world.dungeonmap.ui.editor.chrome.sidebar.DungeonToolSettingsPane;
import features.world.dungeonmap.ui.editor.state.DungeonEditorState;
import features.world.dungeonmap.ui.editor.state.DungeonSelectionRestoreRequest;
import features.world.dungeonmap.ui.editor.workflow.connection.DungeonLinkFlow;
import features.world.dungeonmap.ui.editor.workflow.selection.DungeonSelectionController;
import features.world.dungeonmap.ui.editor.workflow.selection.DungeonSelectionRestorer;
import ui.async.UiErrorReporter;

import java.util.List;

public final class DungeonMapLoader {

    private final DungeonEditorState state;
    private final DungeonEditorControls controls;
    private final DungeonMapPane canvas;
    private final DungeonToolSettingsPane toolSettingsPane;
    private final DungeonSelectionController selectionController;
    private final DungeonLinkFlow linkFlow;
    private final DungeonSelectionRestorer selectionRestorer;
    private final DungeonMapQueryService queries;
    private final Runnable onMapLoaded;

    public DungeonMapLoader(
            DungeonEditorState state,
            DungeonEditorControls controls,
            DungeonMapPane canvas,
            DungeonToolSettingsPane toolSettingsPane,
            DungeonSelectionController selectionController,
            DungeonLinkFlow linkFlow,
            DungeonSelectionRestorer selectionRestorer,
            DungeonMapQueryService queries,
            Runnable onMapLoaded
    ) {
        this.state = state;
        this.controls = controls;
        this.canvas = canvas;
        this.toolSettingsPane = toolSettingsPane;
        this.selectionController = selectionController;
        this.linkFlow = linkFlow;
        this.selectionRestorer = selectionRestorer;
        this.queries = queries;
        this.onMapLoaded = onMapLoaded == null ? () -> { } : onMapLoaded;
    }

    public void onShow() {
        loadMapList();
    }

    public void loadMapAsync(Long mapId) {
        if (mapId == null) {
            clearLoadedState();
            return;
        }
        linkFlow.cancelPendingLink();
        state.setCurrentMapId(mapId);
        long requestToken = state.nextLoadRequestToken();
        DungeonUiAsyncSupport.submitValue(
                () -> queries.loadMapState(mapId),
                loadedState -> {
                    if (requestToken == state.loadRequestToken() && mapId.equals(state.currentMapId())) {
                        applyLoadedState(loadedState);
                    }
                },
                ex -> {
                    if (requestToken == state.loadRequestToken() && mapId.equals(state.currentMapId())) {
                        handleLoadFailure();
                    }
                    UiErrorReporter.reportBackgroundFailure("DungeonMapLoader.loadMapAsync()", ex);
                });
    }

    public void reloadCurrentMap() {
        reloadCurrentMap(null);
    }

    public void reloadCurrentMap(DungeonSelectionRestoreRequest request) {
        selectionRestorer.setPendingSelectionRestore(request);
        loadMapAsync(state.currentMapId());
    }

    private void loadMapList() {
        DungeonUiAsyncSupport.submitValue(
                queries::getAllMaps,
                maps -> {
                    controls.setMaps(maps);
                    Long mapToSelect = resolveMapSelection(maps);
                    if (mapToSelect == null) {
                        clearLoadedState();
                    } else {
                        toolSettingsPane.setMapLoaded(true);
                        controls.selectMap(mapToSelect);
                        loadMapAsync(mapToSelect);
                    }
                },
                ex -> {
                    canvas.showLoadError("Dungeonliste konnte nicht geladen werden");
                    UiErrorReporter.reportBackgroundFailure("DungeonMapLoader.loadMapList()", ex);
                });
    }

    private Long resolveMapSelection(List<DungeonMap> maps) {
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
        linkFlow.cancelPendingLink();
        selectionController.clearSelection();
    }

    private void applyEditorState(DungeonMapState loadedState) {
        canvas.loadState(loadedState);
        List<DungeonArea> areas = loadedState == null ? List.of() : loadedState.areas();
        List<DungeonFeature> features = loadedState == null ? List.of() : loadedState.features();
        toolSettingsPane.setAreas(areas);
        toolSettingsPane.setFeatures(features);
        toolSettingsPane.setMapLoaded(loadedState != null && loadedState.map() != null);
        linkFlow.cancelPendingLink();
        selectionController.clearSelection();
        selectionRestorer.restoreAfterLoad(loadedState);
    }
}
