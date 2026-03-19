package features.world.quarantine.dungeonmap.editor.shell;

import features.world.quarantine.dungeonmap.catalog.application.DungeonMapCatalogService;
import features.world.quarantine.dungeonmap.editor.DungeonEditorService;
import features.world.quarantine.dungeonmap.editor.session.DungeonEditorSessionState;
import features.world.quarantine.dungeonmap.editor.session.edit.DungeonCorridorEditPortBridge;
import features.world.quarantine.dungeonmap.editor.session.edit.DungeonEditorEditController;
import features.world.quarantine.dungeonmap.editor.session.inspector.DungeonEditorInspectorCoordinator;
import features.world.quarantine.dungeonmap.editor.session.inspector.DungeonEditorInspectorPublisher;
import features.world.quarantine.dungeonmap.editor.session.selection.DungeonEditorSelectionPolicy;
import features.world.quarantine.dungeonmap.editor.session.selection.DungeonEditorSelectionPresenter;
import features.world.quarantine.dungeonmap.editor.session.tool.DungeonCorridorDraftController;
import features.world.quarantine.dungeonmap.editor.session.tool.DungeonEditorToolSessionController;
import features.world.quarantine.dungeonmap.editor.session.tool.DungeonToolModeState;
import features.world.quarantine.dungeonmap.foundation.async.DungeonAsyncRunner;
import features.world.quarantine.dungeonmap.foundation.async.DungeonUiAsyncRunner;
import features.world.quarantine.dungeonmap.inspector.DungeonInspectorPort;
import features.world.quarantine.dungeonmap.editor.workspace.DungeonEditorSplitWorkspace;
import features.world.quarantine.dungeonmap.loading.DungeonLoadingCapability;
import features.world.quarantine.dungeonmap.mapstate.DungeonMapState;
import javafx.scene.Node;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;
import ui.shell.NavigationIcons;

import java.util.Objects;

public final class DungeonEditorView implements AppView {

    private final DungeonEditorControls controls = new DungeonEditorControls();
    private final DungeonEditorSplitWorkspace workspace = new DungeonEditorSplitWorkspace();
    private final DungeonEditorUiCoordinator uiCoordinator;

    public DungeonEditorView(
            DetailsNavigator detailsNavigator,
            DungeonMapCatalogService mapCatalogService,
            DungeonEditorService editorService
    ) {
        Objects.requireNonNull(mapCatalogService, "mapCatalogService");
        Objects.requireNonNull(detailsNavigator, "detailsNavigator");
        Objects.requireNonNull(editorService, "editorService");
        DungeonAsyncRunner asyncRunner = new DungeonUiAsyncRunner();
        DungeonMapState mapState = new DungeonMapState();
        DungeonLoadingCapability loadingCapability = new DungeonLoadingCapability(
                mapCatalogService,
                editorService,
                asyncRunner);
        DungeonEditorSessionState sessionState = new DungeonEditorSessionState();
        DungeonInspectorPort inspectorPort = DungeonInspectorPort.fromNavigator(detailsNavigator);
        DungeonEditorInspectorCoordinator inspectorCoordinator = new DungeonEditorInspectorCoordinator(
                new DungeonEditorInspectorPublisher(inspectorPort),
                sessionState::selectedTarget);
        DungeonEditorUiFeedbackBridge uiFeedbackBridge = new DungeonEditorUiFeedbackBridge();
        DungeonEditorSelectionPresenter selectionPresenter = new DungeonEditorSelectionPresenter(
                sessionState,
                new DungeonEditorSelectionPolicy(),
                workspace,
                inspectorCoordinator,
                uiFeedbackBridge::onSelectionChanged,
                mapState::currentLayout);
        DungeonCorridorEditPortBridge corridorEditPortBridge = new DungeonCorridorEditPortBridge();
        DungeonCorridorDraftController corridorDraftController = new DungeonCorridorDraftController(
                sessionState,
                corridorEditPortBridge,
                selectionPresenter);
        DungeonToolModeState toolModeState = new DungeonToolModeState();
        DungeonEditorToolSessionController toolController = new DungeonEditorToolSessionController(
                toolModeState,
                controls::showDisplayedTool,
                workspace,
                sessionState,
                loadingCapability::editingEnabled,
                mapState::currentLayout,
                uiFeedbackBridge::onStatePaneChanged,
                corridorDraftController);
        DungeonEditorEditController editController = new DungeonEditorEditController(
                workspace,
                sessionState,
                selectionPresenter,
                toolController::clearTransientState,
                mapState::currentLayout,
                loadingCapability,
                uiFeedbackBridge);
        corridorEditPortBridge.bind(editController);
        DungeonEditorWorkspaceController workspaceController = new DungeonEditorWorkspaceController(
                selectionPresenter,
                editController,
                handle -> {
                    sessionState.selectCorridorDoorHandle(handle);
                    selectionPresenter.syncCorridorDoorWorkspaceSelection();
                    uiFeedbackBridge.onStatePaneChanged();
                },
                toolController::selectCorridorTarget,
                toolController::activeTool);
        this.uiCoordinator = new DungeonEditorUiCoordinator(
                controls,
                workspace,
                loadingCapability,
                mapState,
                sessionState,
                selectionPresenter,
                inspectorCoordinator,
                toolController,
                editController,
                workspaceController,
                mapCatalogService,
                asyncRunner);
        uiFeedbackBridge.bind(uiCoordinator);
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
        uiCoordinator.onShow();
    }

    @Override
    public void onHide() {
        uiCoordinator.onHide();
    }
}
