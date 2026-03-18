package features.world.dungeonmap.editor.shell.ui;

import features.world.dungeonmap.editor.session.ui.DungeonEditorSessionCoordinator;
import features.world.dungeonmap.editor.session.ui.tool.DungeonEditorToolSessionController;
import features.world.dungeonmap.editor.workspace.ui.DungeonEditorSplitWorkspace;
import features.world.dungeonmap.catalog.application.DungeonMapCatalogService;
import javafx.scene.Node;

import java.util.Objects;

/**
 * Wires editor shell controls, shortcuts, dropdowns, and workspace bindings to concrete controllers.
 */
public final class DungeonEditorUiCoordinator {

    private final DungeonEditorControls controls;
    private final DungeonEditorSplitWorkspace workspace;
    private final DungeonEditorLoadController loadController;
    private final DungeonEditorSessionCoordinator sessionCoordinator;
    private final DungeonEditorToolSessionController toolController;
    private final DungeonEditorStatePane statePane;
    private final DungeonEditorShortcutController shortcutController;
    private final DungeonMapDropdownController mapDropdownController;
    private final DungeonMapDropdownController.ReloadHandle mapReloadHandle;
    private boolean initialLoadDone;

    public DungeonEditorUiCoordinator(
            DungeonEditorControls controls,
            DungeonEditorSplitWorkspace workspace,
            DungeonMapCatalogService mapCatalogService,
            DungeonEditorLoadController loadController,
            DungeonEditorSessionCoordinator sessionCoordinator,
            DungeonEditorToolSessionController toolController
    ) {
        this.controls = Objects.requireNonNull(controls, "controls");
        this.workspace = Objects.requireNonNull(workspace, "workspace");
        this.loadController = Objects.requireNonNull(loadController, "loadController");
        this.sessionCoordinator = Objects.requireNonNull(sessionCoordinator, "sessionCoordinator");
        this.toolController = Objects.requireNonNull(toolController, "toolController");
        Objects.requireNonNull(mapCatalogService, "mapCatalogService");
        this.statePane = new DungeonEditorStatePane(
                this.workspace.wallPathState()::cancelWallPath,
                this.sessionCoordinator::resetSelectedCorridorDoor,
                this.sessionCoordinator::deleteSelectedCorridorWaypoint);
        this.shortcutController = new DungeonEditorShortcutController(
                this.controls,
                this.workspace,
                statePane.content(),
                this.toolController::setDeleteOverrideActive,
                this.toolController::switchPersistentToolMode);
        this.mapReloadHandle = new MapReloadHandle();
        this.mapDropdownController = new DungeonMapDropdownController(mapCatalogService, mapReloadHandle);
        installBindings();
    }

    public Node stateContent() {
        return statePane.content();
    }

    public void refreshStatePane() {
        DungeonEditorStatePaneModel model = sessionCoordinator.statePaneModel();
        statePane.refresh(
                model.activeTool(),
                workspace.wallPathState().displayedWallAnchor(),
                model.selectedCorridor(),
                model.selectedDoorHandle(),
                model.selectedWaypointHandle());
    }

    public void onShow() {
        shortcutController.attach(workspace.getScene());
        if (!initialLoadDone) {
            loadController.refreshMapsAndLayout(loadController.sessionMapId(), loadController::showLoadState);
            initialLoadDone = true;
        }
    }

    public void onHide() {
        shortcutController.detach(workspace.getScene());
        toolController.setDeleteOverrideActive(false);
    }

    private void installBindings() {
        workspace.setInteractionSinks(sessionCoordinator.workspaceSink());
        controls.setOnMapSelected(loadController::loadLayoutAsync);
        controls.setOnNewMapRequested(mapDropdownController::showCreate);
        controls.setOnEditMapRequested(request ->
                mapDropdownController.showEdit(new DungeonMapDropdownController.EditRequest(request.map(), request.anchor())));
        controls.setOnViewModeChanged(toolController::setViewMode);
        controls.setOnToolChanged(toolController::setSelectedTool);
        controls.setPreferredToolResolver(toolController::preferredToolFor);
        workspace.sceneProperty().addListener((obs, oldScene, newScene) -> {
            shortcutController.detach(oldScene);
            shortcutController.attach(newScene);
        });
    }

    private final class MapReloadHandle implements DungeonMapDropdownController.ReloadHandle {
        @Override
        public void reloadAfterChange(Long preferredMapId, Runnable afterReload) {
            loadController.refreshMapsAndLayout(preferredMapId, loadState -> {
                afterReload.run();
                loadController.showLoadState(loadState);
            });
        }

        @Override
        public Long sessionMapId() {
            return loadController.sessionMapId();
        }
    }
}
