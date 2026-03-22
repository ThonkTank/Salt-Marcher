package features.world.dungeonmap.shell.editor;

import features.world.dungeonmap.application.corridor.DungeonCorridorEditService;
import features.world.dungeonmap.application.room.DungeonClusterMoveService;
import features.world.dungeonmap.application.room.DungeonRoomEditService;
import features.world.dungeonmap.application.room.DungeonRoomNarrationService;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.catalog.application.DungeonMapCatalogService;
import features.world.dungeonmap.shell.AbstractDungeonMapView;
import features.world.dungeonmap.state.DungeonEditorSessionState;
import features.world.dungeonmap.state.DungeonMapState;
import javafx.scene.Node;
import ui.shell.NavigationIcons;

public final class DungeonEditorView extends AbstractDungeonMapView {

    private final DungeonEditorControls controls = new DungeonEditorControls();
    private final DungeonEditorStatePane statePane = new DungeonEditorStatePane();
    private final DungeonEditorSessionState sessionState = new DungeonEditorSessionState();
    private final DungeonEditorCoordinator coordinator;

    public DungeonEditorView(
            DungeonMapLoadingService loadingService,
            DungeonMapState state,
            DungeonMapCatalogService mapCatalogService,
            DungeonRoomEditService roomEditService,
            DungeonRoomNarrationService roomNarrationService,
            DungeonClusterMoveService clusterMoveService,
            DungeonCorridorEditService corridorEditService
    ) {
        super(true, loadingService, state);
        coordinator = new DungeonEditorCoordinator(
                controls,
                statePane,
                workspace(),
                loadingService,
                state,
                sessionState,
                mapCatalogService,
                roomEditService,
                roomNarrationService,
                clusterMoveService,
                corridorEditService);
    }

    @Override
    public String getTitle() {
        return "Dungeon-Editor";
    }

    @Override
    public Node getNavigationGraphic() {
        return NavigationIcons.dungeonEditor();
    }

    @Override
    public Node getControlsContent() {
        return controls;
    }

    @Override
    public Node getStateContent() {
        return statePane.content();
    }

    @Override
    protected void onStateRefreshed() {
        coordinator.refreshFromMapState();
    }
}
