package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.api.DungeonEncounterTableSummary;
import features.world.dungeonmap.model.DungeonArea;
import features.world.dungeonmap.model.DungeonFeature;
import features.world.dungeonmap.model.DungeonMap;
import features.world.dungeonmap.model.DungeonMapState;
import features.world.dungeonmap.model.DungeonPassage;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.ui.canvas.DungeonMapPane;
import features.world.dungeonmap.ui.editor.controls.DungeonEditorControls;
import features.world.dungeonmap.ui.editor.controls.DungeonEditorTool;
import features.world.dungeonmap.ui.editor.panes.DungeonSelectionEditorPane;
import features.world.dungeonmap.ui.editor.panes.DungeonToolSettingsPane;
import ui.async.UiErrorReporter;

import java.util.List;

final class DungeonMapLoadingWorkflowController {

    private final DungeonEditorState state;
    private final DungeonEditorApplicationService applicationService;
    private final DungeonEditorControls controls;
    private final DungeonMapPane canvas;
    private final DungeonSelectionEditorPane selectionEditorPane;
    private final DungeonToolSettingsPane toolSettingsPane;
    private final DungeonSelectionWorkflowController selectionController;
    private Runnable onEncounterTablesChanged = () -> { };
    private Runnable onStoredEncountersChanged = () -> { };
    private Runnable onMapLoaded = () -> { };

    DungeonMapLoadingWorkflowController(
            DungeonEditorState state,
            DungeonEditorApplicationService applicationService,
            DungeonEditorControls controls,
            DungeonMapPane canvas,
            DungeonSelectionEditorPane selectionEditorPane,
            DungeonToolSettingsPane toolSettingsPane,
            DungeonSelectionWorkflowController selectionController
    ) {
        this.state = state;
        this.applicationService = applicationService;
        this.controls = controls;
        this.canvas = canvas;
        this.selectionEditorPane = selectionEditorPane;
        this.toolSettingsPane = toolSettingsPane;
        this.selectionController = selectionController;
    }

    void setOnEncounterTablesChanged(Runnable onEncounterTablesChanged) {
        this.onEncounterTablesChanged = onEncounterTablesChanged == null ? () -> { } : onEncounterTablesChanged;
    }

    void setOnStoredEncountersChanged(Runnable onStoredEncountersChanged) {
        this.onStoredEncountersChanged = onStoredEncountersChanged == null ? () -> { } : onStoredEncountersChanged;
    }

    void setOnMapLoaded(Runnable onMapLoaded) {
        this.onMapLoaded = onMapLoaded == null ? () -> { } : onMapLoaded;
    }

    void onShow() {
        loadEncounterTables();
        loadStoredEncounters();
        loadMapList();
    }

    void reloadCurrentMap() {
        reloadCurrentMap(null);
    }

    void reloadCurrentMap(DungeonSelectionRestoreRequest selectionRestoreRequest) {
        state.setPendingSelectionRestore(selectionRestoreRequest);
        loadMapAsync(state.currentMapId());
    }

    void loadMapAsync(Long mapId) {
        if (mapId == null) {
            return;
        }
        selectionController.cancelPendingLink();
        state.setCurrentMapId(mapId);
        long requestToken = state.nextLoadRequestToken();
        applicationService.loadMap(
                mapId,
                loadedState -> {
                    if (requestToken == state.loadRequestToken() && mapId.equals(state.currentMapId())) {
                        applyLoadedState(loadedState);
                    }
                },
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonMapLoadingWorkflowController.loadMapAsync()", ex));
    }

    private void loadEncounterTables() {
        applicationService.loadEncounterTables(
                tables -> {
                    state.setEncounterTables(tables);
                    toolSettingsPane.setEncounterTables(tables);
                    selectionEditorPane.setEncounterTables(tables);
                    onEncounterTablesChanged.run();
                },
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonMapLoadingWorkflowController.loadEncounterTables()", ex));
    }

    private void loadStoredEncounters() {
        applicationService.loadStoredEncounters(
                encounters -> {
                    state.setEncounters(encounters);
                    toolSettingsPane.setStoredEncounters(encounters);
                    selectionEditorPane.setEncounterSummaries(encounters);
                    onStoredEncountersChanged.run();
                },
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonMapLoadingWorkflowController.loadStoredEncounters()", ex));
    }

    private void loadMapList() {
        applicationService.loadMapList(
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
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonMapLoadingWorkflowController.loadMapList()", ex));
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

    void autoShowForTool(DungeonEditorTool tool) {
        DungeonEditorTool effectiveTool = tool == null ? DungeonEditorTool.SELECT : tool;
        if (effectiveTool.autoShowsSelectedRoom()) {
            DungeonRoom room = toolSettingsPane.roomComboBox().getValue();
            if (room != null) selectionController.selectRoom(room);
        } else if (effectiveTool.autoShowsSelectedArea()) {
            DungeonArea area = toolSettingsPane.areaComboBox().getValue();
            if (area != null) selectionController.selectArea(area);
        }
    }

    private boolean applyPendingSelection(DungeonMapState loadedState) {
        DungeonSelectionRestoreRequest restoreRequest = state.pendingSelectionRestore();
        state.setPendingSelectionRestore(null);
        if (restoreRequest == null || restoreRequest.entityId() == null) {
            return false;
        }
        return switch (restoreRequest.type()) {
            case ROOM -> restoreRoomSelection(loadedState, restoreRequest.entityId());
            case AREA -> restoreAreaSelection(loadedState, restoreRequest.entityId());
            case FEATURE -> restoreFeatureSelection(loadedState, restoreRequest.entityId());
            case PASSAGE -> restorePassageSelection(loadedState, restoreRequest.entityId());
        };
    }

    private void clearLoadedState() {
        state.setCurrentMapId(null);
        state.setCurrentState(null);
        applyEditorState(null);
    }

    private void applyEditorState(DungeonMapState loadedState) {
        applyViewData(loadedState);
        resetTransientUiState();
        restoreSelection(loadedState);
        onEncounterTablesChanged.run();
    }

    private void applyViewData(DungeonMapState loadedState) {
        canvas.loadState(loadedState);
        List<DungeonRoom> rooms = loadedState == null ? List.of() : loadedState.rooms();
        List<DungeonArea> areas = loadedState == null ? List.of() : loadedState.areas();
        List<DungeonFeature> features = loadedState == null ? List.of() : loadedState.features();
        toolSettingsPane.setRooms(rooms);
        toolSettingsPane.setAreas(areas);
        toolSettingsPane.setFeatures(features);
        selectionEditorPane.setAreas(areas);
        selectionEditorPane.setEndpoints(loadedState == null ? List.of() : loadedState.endpoints());
        toolSettingsPane.setMapLoaded(loadedState != null && loadedState.map() != null);
    }

    private void resetTransientUiState() {
        selectionController.cancelPendingLink();
        selectionController.clearSelection();
    }

    private void restoreSelection(DungeonMapState loadedState) {
        if (loadedState != null && applyPendingSelection(loadedState)) {
            return;
        }
        if (loadedState != null) {
            autoShowForTool(controls.getActiveTool());
        }
    }

    private boolean restoreRoomSelection(DungeonMapState loadedState, Long roomId) {
        for (DungeonRoom room : loadedState.rooms()) {
            if (roomId.equals(room.roomId())) {
                selectionController.restoreRoomSelection(room);
                return true;
            }
        }
        return false;
    }

    private boolean restoreAreaSelection(DungeonMapState loadedState, Long areaId) {
        for (DungeonArea area : loadedState.areas()) {
            if (areaId.equals(area.areaId())) {
                selectionController.restoreAreaSelection(area);
                return true;
            }
        }
        return false;
    }

    private boolean restoreFeatureSelection(DungeonMapState loadedState, Long featureId) {
        for (DungeonFeature feature : loadedState.features()) {
            if (featureId.equals(feature.featureId())) {
                selectionController.restoreFeatureSelection(feature);
                return true;
            }
        }
        return false;
    }

    private boolean restorePassageSelection(DungeonMapState loadedState, Long passageId) {
        for (DungeonPassage passage : loadedState.passages()) {
            if (passageId.equals(passage.passageId())) {
                selectionController.restorePassageSelection(passage);
                return true;
            }
        }
        return false;
    }
}
