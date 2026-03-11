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
import features.world.dungeonmap.ui.editor.panes.DungeonDetailsPane;
import features.world.dungeonmap.ui.editor.panes.DungeonToolSettingsPane;
import ui.async.UiErrorReporter;

import java.util.List;

final class DungeonMapLoadingWorkflowController {

    private final DungeonEditorState state;
    private final DungeonEditorApplicationService applicationService;
    private final DungeonEditorControls controls;
    private final DungeonMapPane canvas;
    private final DungeonDetailsPane detailsPane;
    private final DungeonToolSettingsPane toolSettingsPane;
    private final DungeonSelectionWorkflowController selectionController;
    private Runnable onEncounterTablesChanged = () -> { };

    DungeonMapLoadingWorkflowController(
            DungeonEditorState state,
            DungeonEditorApplicationService applicationService,
            DungeonEditorControls controls,
            DungeonMapPane canvas,
            DungeonDetailsPane detailsPane,
            DungeonToolSettingsPane toolSettingsPane,
            DungeonSelectionWorkflowController selectionController
    ) {
        this.state = state;
        this.applicationService = applicationService;
        this.controls = controls;
        this.canvas = canvas;
        this.detailsPane = detailsPane;
        this.toolSettingsPane = toolSettingsPane;
        this.selectionController = selectionController;
    }

    void setOnEncounterTablesChanged(Runnable onEncounterTablesChanged) {
        this.onEncounterTablesChanged = onEncounterTablesChanged == null ? () -> { } : onEncounterTablesChanged;
    }

    void onShow() {
        loadEncounterTables();
        loadMapList();
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
                    toolSettingsPane.setEncounterTables(tables);
                    detailsPane.setEncounterTables(tables);
                    onEncounterTablesChanged.run();
                },
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonMapLoadingWorkflowController.loadEncounterTables()", ex));
    }

    private void loadMapList() {
        applicationService.loadMapList(
                maps -> {
                    controls.setMaps(maps);
                    Long mapToSelect = resolveMapSelection(maps);
                    toolSettingsPane.setMapLoaded(mapToSelect != null);
                    if (mapToSelect != null) {
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
        canvas.loadState(loadedState);
        toolSettingsPane.setRooms(loadedState.rooms());
        toolSettingsPane.setAreas(loadedState.areas());
        toolSettingsPane.setFeatures(loadedState.features());
        detailsPane.setAreas(loadedState.areas());
        detailsPane.setFeatures(loadedState.features());
        detailsPane.setEndpoints(loadedState.endpoints());
        toolSettingsPane.setMapLoaded(loadedState.map() != null);
        selectionController.cancelPendingLink();
        selectionController.clearSelection();
        if (!applyPendingSelection(loadedState)) {
            autoShowForTool(controls.getActiveTool());
        }
        onEncounterTablesChanged.run();
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
        if (state.pendingRoomSelectionId() != null) {
            Long roomId = state.pendingRoomSelectionId();
            state.setPendingRoomSelectionId(null);
            for (DungeonRoom room : loadedState.rooms()) {
                if (roomId.equals(room.roomId())) {
                    selectionController.selectRoom(room);
                    return true;
                }
            }
        }
        if (state.pendingAreaSelectionId() != null) {
            Long areaId = state.pendingAreaSelectionId();
            state.setPendingAreaSelectionId(null);
            for (DungeonArea area : loadedState.areas()) {
                if (areaId.equals(area.areaId())) {
                    selectionController.selectArea(area);
                    return true;
                }
            }
        }
        if (state.pendingPassageSelectionId() != null) {
            Long passageId = state.pendingPassageSelectionId();
            state.setPendingPassageSelectionId(null);
            for (DungeonPassage passage : loadedState.passages()) {
                if (passageId.equals(passage.passageId())) {
                    selectionController.selectPassage(passage);
                    return true;
                }
            }
        }
        if (state.pendingFeatureSelectionId() != null) {
            Long featureId = state.pendingFeatureSelectionId();
            state.setPendingFeatureSelectionId(null);
            for (DungeonFeature feature : loadedState.features()) {
                if (featureId.equals(feature.featureId())) {
                    selectionController.selectFeature(feature);
                    return true;
                }
            }
        }
        return false;
    }
}
