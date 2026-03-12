package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.ui.editor.controls.DungeonEditorControls;
import javafx.scene.Node;
import ui.async.UiErrorReporter;

final class DungeonMapEditingController {

    private final DungeonEditorState state;
    private final DungeonEditorApplicationService applicationService;
    private final DungeonMapDropdowns mapDropdowns;
    private Runnable reloadMapList = () -> { };

    DungeonMapEditingController(
            DungeonEditorState state,
            DungeonEditorApplicationService applicationService,
            DungeonMapDropdowns mapDropdowns
    ) {
        this.state = state;
        this.applicationService = applicationService;
        this.mapDropdowns = mapDropdowns;
    }

    void setReloadMapList(Runnable reloadMapList) {
        this.reloadMapList = reloadMapList == null ? () -> { } : reloadMapList;
    }

    void showNewMapDropdown(Node anchor) {
        mapDropdowns.showNewMapDropdown(anchor, result -> applicationService.createMap(
                result.name(),
                result.width(),
                result.height(),
                mapId -> {
                    state.setCurrentMapId(mapId);
                    reloadMapList.run();
                },
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonMapEditingController.createMap()", ex)));
    }

    void showEditMapDropdown(DungeonEditorControls.MapActionRequest request) {
        mapDropdowns.showEditMapDropdown(
                request.anchor(),
                request.map(),
                state.currentState(),
                result -> applicationService.updateMap(
                        request.map().mapId(),
                        result.name(),
                        result.width(),
                        result.height(),
                        () -> {
                            state.setCurrentMapId(request.map().mapId());
                            reloadMapList.run();
                        },
                        ex -> UiErrorReporter.reportBackgroundFailure("DungeonMapEditingController.updateMap()", ex)),
                () -> applicationService.deleteMap(
                        request.map().mapId(),
                        () -> {
                            state.setCurrentMapId(null);
                            state.setCurrentState(null);
                            reloadMapList.run();
                        },
                        ex -> UiErrorReporter.reportBackgroundFailure("DungeonMapEditingController.deleteMap()", ex)));
    }
}
