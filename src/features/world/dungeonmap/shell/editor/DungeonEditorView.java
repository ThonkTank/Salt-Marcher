package features.world.dungeonmap.shell.editor;

import features.world.dungeonmap.catalog.application.DungeonMapCatalogService;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.shell.AbstractDungeonMapView;
import features.world.dungeonmap.shell.editor.interaction.EditorInteraction;
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
            DungeonEditorSessionState sessionState,
            EditorInteraction editorInteraction
    ) {
        super(true, loadingService, state);
        DungeonMapDropdownController mapDropdownController = new DungeonMapDropdownController(
                mapCatalogService,
                new DungeonMapDropdownController.ReloadHandle() {
                    @Override
                    public void reload(Long preferredMapId) {
                        loadingService.reload(preferredMapId);
                    }

                    @Override
                    public Long sessionMapId() {
                        return state.activeMapId();
                    }
                });
        controls.setOnNewMapRequested(mapDropdownController::showCreate);
        controls.setOnEditMapRequested(request ->
                mapDropdownController.showEdit(new DungeonMapDropdownController.EditRequest(request.map(), request.anchor())));
        coordinator = new DungeonEditorCoordinator(
                controls,
                statePane,
                workspace(),
                loadingService,
                state,
                sessionState,
                editorInteraction);
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
