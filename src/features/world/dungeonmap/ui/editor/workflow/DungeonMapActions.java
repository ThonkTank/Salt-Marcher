package features.world.dungeonmap.ui.editor.workflow;

import features.world.dungeonmap.service.DungeonMapCommands;
import features.world.dungeonmap.ui.DungeonUiAsyncSupport;
import features.world.dungeonmap.ui.editor.DungeonMapDropdowns;
import features.world.dungeonmap.ui.editor.controls.DungeonEditorControls;
import features.world.dungeonmap.ui.editor.state.DungeonEditorState;
import javafx.scene.Node;
import ui.async.UiErrorReporter;

final class DungeonMapActions {

    private final DungeonEditorState state;
    private final DungeonMapDropdowns mapDropdowns;
    private final DungeonMapCommands commands;
    private final Runnable reloadMapList;

    public DungeonMapActions(
            DungeonEditorState state,
            DungeonMapDropdowns mapDropdowns,
            DungeonMapCommands commands,
            Runnable reloadMapList
    ) {
        this.state = state;
        this.mapDropdowns = mapDropdowns;
        this.commands = commands;
        this.reloadMapList = reloadMapList == null ? () -> { } : reloadMapList;
    }

    public void showNewMapDropdown(Node anchor) {
        mapDropdowns.showNewMapDropdown(anchor, result -> DungeonUiAsyncSupport.submitValue(
                () -> commands.createMap(result.name(), result.width(), result.height()),
                mapId -> {
                    state.setCurrentMapId(mapId);
                    reloadMapList.run();
                },
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonMapActions.createMap()", ex)));
    }

    public void showEditMapDropdown(DungeonEditorControls.MapActionRequest request) {
        mapDropdowns.showEditMapDropdown(
                request.anchor(),
                request.map(),
                state.currentState(),
                result -> DungeonUiAsyncSupport.submitAction(
                        () -> commands.updateMap(
                                request.map().mapId(),
                                result.name(),
                                result.width(),
                                result.height()),
                        () -> {
                            state.setCurrentMapId(request.map().mapId());
                            reloadMapList.run();
                        },
                        ex -> UiErrorReporter.reportBackgroundFailure("DungeonMapActions.updateMap()", ex)),
                () -> DungeonUiAsyncSupport.submitAction(
                        () -> commands.deleteMap(request.map().mapId()),
                        () -> {
                            state.setCurrentMapId(null);
                            state.setCurrentState(null);
                            reloadMapList.run();
                        },
                        ex -> UiErrorReporter.reportBackgroundFailure("DungeonMapActions.deleteMap()", ex)));
    }
}
