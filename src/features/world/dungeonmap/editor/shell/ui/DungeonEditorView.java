package features.world.dungeonmap.editor.shell.ui;

import features.world.dungeonmap.editor.application.DungeonEditorService;
import features.world.dungeonmap.editor.session.application.workflow.DungeonEditorSessionWorkflow;
import features.world.dungeonmap.editor.session.ui.DungeonEditorSessionCoordinator;
import features.world.dungeonmap.editor.session.ui.DungeonEditorUiAsyncRunner;
import features.world.dungeonmap.editor.session.ui.tool.DungeonEditorToolSessionController;
import features.world.dungeonmap.editor.shell.ui.DungeonEditorControls;
import features.world.dungeonmap.editor.shell.ui.DungeonEditorLoadController;
import features.world.dungeonmap.editor.shell.ui.DungeonEditorUiCoordinator;
import features.world.dungeonmap.editor.shell.ui.DungeonToolModeState;
import features.world.dungeonmap.editor.workspace.ui.DungeonEditorSplitWorkspace;
import features.world.dungeonmap.catalog.application.DungeonMapCatalogService;
import javafx.scene.Node;
import ui.components.MessageDropdown;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;
import ui.shell.NavigationIcons;

import java.util.Objects;

/**
 * Shell-facing AppView adapter that renders load/session updates into the editor workspace.
 */
public final class DungeonEditorView implements AppView {

    private final DungeonEditorControls controls = new DungeonEditorControls();
    private final DungeonEditorSplitWorkspace workspace = new DungeonEditorSplitWorkspace();
    private final DungeonEditorSessionCoordinator sessionCoordinator;
    private final DungeonEditorToolSessionController toolController;
    private final DungeonEditorUiCoordinator uiCoordinator;

    public DungeonEditorView(
            DetailsNavigator detailsNavigator,
            DungeonMapCatalogService mapCatalogService,
            DungeonEditorService editorService
    ) {
        Objects.requireNonNull(mapCatalogService, "mapCatalogService");
        Objects.requireNonNull(detailsNavigator, "detailsNavigator");
        Objects.requireNonNull(editorService, "editorService");
        DungeonToolModeState toolModeState = new DungeonToolModeState();
        DungeonEditorSessionWorkflow sessionWorkflow = new DungeonEditorSessionWorkflow(
                mapCatalogService, editorService, new DungeonEditorUiAsyncRunner());
        this.sessionCoordinator = DungeonEditorSessionCoordinator.create(
                sessionWorkflow,
                toolModeState,
                controls,
                workspace,
                detailsNavigator);
        this.toolController = sessionCoordinator.toolPort();
        DungeonEditorLoadController loadController = new DungeonEditorLoadController(
                sessionWorkflow,
                sessionCoordinator,
                controls,
                workspace,
                toolController,
                new MessageDropdown());
        sessionCoordinator.setOnExternalUpdate(loadController::handleSessionUpdate);
        this.uiCoordinator = new DungeonEditorUiCoordinator(
                controls,
                workspace,
                mapCatalogService,
                loadController,
                sessionCoordinator,
                toolController);
        loadController.setStatePaneRefresher(uiCoordinator::refreshStatePane);
    }

    @Override
    public Node getMainContent() {
        return workspace;
    }

    @Override
    public String getTitle() {
        return "Dungeon-Editor";
    }

    @Override
    public String getIconText() {
        return "";
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
        return uiCoordinator.stateContent();
    }

    @Override
    public void onShow() {
        toolController.syncEditorTool();
        uiCoordinator.refreshStatePane();
        uiCoordinator.onShow();
    }

    @Override
    public void onHide() {
        uiCoordinator.onHide();
    }
}
