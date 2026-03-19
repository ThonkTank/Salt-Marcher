package features.world.quarantine.dungeonmap.editor.shell;

import features.world.quarantine.dungeonmap.canvas.state.DungeonViewState;
import features.world.quarantine.dungeonmap.catalog.application.DungeonMapCatalogService;
import features.world.quarantine.dungeonmap.editor.session.DungeonEditorSessionState;
import features.world.quarantine.dungeonmap.editor.session.edit.DungeonEditorEditController;
import features.world.quarantine.dungeonmap.editor.session.inspector.DungeonEditorInspectorCoordinator;
import features.world.quarantine.dungeonmap.editor.session.selection.DungeonEditorSelectionPresenter;
import features.world.quarantine.dungeonmap.editor.session.selection.DungeonEditorStatePaneModel;
import features.world.quarantine.dungeonmap.editor.session.tool.DungeonEditorToolSessionController;
import features.world.quarantine.dungeonmap.editor.workspace.DungeonEditorSplitWorkspace;
import features.world.quarantine.dungeonmap.editor.workspace.DungeonViewMode;
import features.world.quarantine.dungeonmap.foundation.async.DungeonAsyncRunner;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.loading.DungeonLoadingCapability;
import features.world.quarantine.dungeonmap.loading.DungeonLoadingState;
import features.world.quarantine.dungeonmap.mapstate.DungeonMapState;
import ui.async.UiErrorReporter;
import ui.components.MessageDropdown;
import javafx.scene.Node;

import java.util.Objects;

public final class DungeonEditorUiCoordinator implements DungeonEditorUiFeedback {

    private final DungeonEditorControls controls;
    private final DungeonEditorSplitWorkspace workspace;
    private final DungeonLoadingCapability loadingCapability;
    private final DungeonMapState mapState;
    private final DungeonEditorSessionState sessionState;
    private final DungeonEditorSelectionPresenter selectionPresenter;
    private final DungeonEditorInspectorCoordinator inspectorCoordinator;
    private final DungeonEditorToolSessionController toolController;
    private final DungeonEditorStatePane statePane;
    private final DungeonEditorShortcutController shortcutController;
    private final DungeonMapDropdownController mapDropdownController;
    private final DungeonEditorWorkspaceController workspaceController;
    private final MessageDropdown messageDropdown = new MessageDropdown();

    private boolean initialLoadDone;
    private DungeonViewMode viewMode = DungeonViewMode.GRID;

    public DungeonEditorUiCoordinator(
            DungeonEditorControls controls,
            DungeonEditorSplitWorkspace workspace,
            DungeonLoadingCapability loadingCapability,
            DungeonMapState mapState,
            DungeonEditorSessionState sessionState,
            DungeonEditorSelectionPresenter selectionPresenter,
            DungeonEditorInspectorCoordinator inspectorCoordinator,
            DungeonEditorToolSessionController toolController,
            DungeonEditorEditController editController,
            DungeonEditorWorkspaceController workspaceController,
            DungeonMapCatalogService mapCatalogService,
            DungeonAsyncRunner asyncRunner
    ) {
        this.controls = Objects.requireNonNull(controls, "controls");
        this.workspace = Objects.requireNonNull(workspace, "workspace");
        this.loadingCapability = Objects.requireNonNull(loadingCapability, "loadingCapability");
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.sessionState = Objects.requireNonNull(sessionState, "sessionState");
        this.selectionPresenter = Objects.requireNonNull(selectionPresenter, "selectionPresenter");
        this.inspectorCoordinator = Objects.requireNonNull(inspectorCoordinator, "inspectorCoordinator");
        this.toolController = Objects.requireNonNull(toolController, "toolController");
        Objects.requireNonNull(editController, "editController");
        this.workspaceController = Objects.requireNonNull(workspaceController, "workspaceController");
        Objects.requireNonNull(mapCatalogService, "mapCatalogService");
        Objects.requireNonNull(asyncRunner, "asyncRunner");
        this.statePane = new DungeonEditorStatePane(
                this.workspace.wallPathState()::cancelWallPath,
                editController::resetSelectedCorridorDoor,
                editController::deleteSelectedCorridorWaypoint);
        this.shortcutController = new DungeonEditorShortcutController(
                this.controls,
                this.workspace,
                statePane.content(),
                this.toolController::setDeleteOverrideActive,
                this.toolController::switchPersistentToolMode);
        this.mapDropdownController = new DungeonMapDropdownController(
                mapCatalogService,
                new MapReloadHandle(),
                asyncRunner);
        installBindings();
    }

    public Node stateContent() {
        return statePane.content();
    }

    public void refreshStatePane() {
        DungeonEditorStatePaneModel model = new DungeonEditorStatePaneModel(
                toolController.activeTool(),
                sessionState.selectedCorridor(mapState.currentLayout()),
                selectionPresenter.selectedCorridorDoorHandle(),
                selectionPresenter.selectedCorridorWaypointHandle());
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
            refreshMapsAndLayout(loadingCapability.sessionMapId());
            initialLoadDone = true;
        }
    }

    public void onHide() {
        shortcutController.detach(workspace.getScene());
        toolController.setDeleteOverrideActive(false);
    }

    @Override
    public void onLayoutChanged(DungeonLayout layout) {
        mapState.setLayout(layout);
        inspectorCoordinator.refreshIfShowing(layout);
        renderLayoutFromState();
    }

    @Override
    public void onSelectionChanged() {
        renderSelectionFromState();
    }

    @Override
    public void onStatePaneChanged() {
        refreshStatePane();
    }

    @Override
    public void onReloadRequested(Long preferredMapId) {
        refreshMapsAndLayout(preferredMapId);
    }

    private void installBindings() {
        workspace.setInteractionSinks(workspaceController);
        controls.setOnMapSelected(this::loadLayoutAsync);
        controls.setOnNewMapRequested(mapDropdownController::showCreate);
        controls.setOnEditMapRequested(request ->
                mapDropdownController.showEdit(new DungeonMapDropdownController.EditRequest(request.map(), request.anchor())));
        controls.setOnViewModeChanged(this::setViewMode);
        controls.setOnToolChanged(toolController::setSelectedTool);
        controls.setPreferredToolResolver(toolController::preferredToolFor);
        workspace.sceneProperty().addListener((obs, oldScene, newScene) -> {
            shortcutController.detach(oldScene);
            shortcutController.attach(newScene);
        });
    }

    private void setViewMode(DungeonViewMode viewMode) {
        this.viewMode = viewMode == null ? DungeonViewMode.GRID : viewMode;
        toolController.setViewMode(this.viewMode);
    }

    private void loadLayoutAsync(Long mapId) {
        if (mapId == null) {
            return;
        }
        refreshMapsAndLayout(mapId);
    }

    private void showLoadState(DungeonLoadingState loadState) {
        controls.setMaps(loadState.maps());
        if (loadState.layout() == null || loadState.selectedMapId() == null) {
            clearLayout();
            return;
        }
        mapState.setLayout(loadState.layout());
        resetForLoadedLayout();
        controls.selectMap(loadState.selectedMapId());
        renderPreparedLayout(loadState);
        showDegradedCorridorWarning(loadState);
    }

    private void refreshMapsAndLayout(Long preferredMapId) {
        loadingCapability.load(preferredMapId, this::showLoadState, this::handleLoadFailure);
    }

    private void handleLoadFailure(Throwable throwable) {
        UiErrorReporter.reportBackgroundFailure("DungeonEditorUiCoordinator.handleLoadFailure()", throwable);
        messageDropdown.show(controls, "Dungeon konnte nicht geladen werden", "Bitte Datenbankstatus prüfen.");
    }

    private void clearLayout() {
        mapState.clearLayout();
        resetForLoadedLayout();
        controls.selectMap(null);
        renderLayoutFromState();
    }

    private void resetForLoadedLayout() {
        sessionState.setSelectedTarget(null);
        sessionState.clearTransientState();
        selectionPresenter.syncCorridorDoorWorkspaceSelection();
    }

    private void renderLayoutFromState() {
        workspace.setEditable(loadingCapability.editingEnabled());
        controls.selectViewMode(viewMode);
        controls.showDisplayedTool(toolController.activeTool());
        workspace.showLayout(
                DungeonViewState.editor(mapState.currentLayout(), sessionState.selectedTarget()),
                viewMode,
                toolController.activeTool());
        refreshStatePane();
    }

    private void renderPreparedLayout(DungeonLoadingState loadState) {
        workspace.setEditable(loadingCapability.editingEnabled());
        controls.selectViewMode(viewMode);
        controls.showDisplayedTool(toolController.activeTool());
        workspace.showPreparedLayout(
                DungeonViewState.editor(mapState.currentLayout(), sessionState.selectedTarget()),
                loadState.renderState(),
                viewMode,
                toolController.activeTool());
        refreshStatePane();
    }

    private void renderSelectionFromState() {
        workspace.updateSelection(
                DungeonViewState.editor(mapState.currentLayout(), sessionState.selectedTarget()),
                viewMode);
        refreshStatePane();
    }

    private void showDegradedCorridorWarning(DungeonLoadingState loadState) {
        if (loadState == null || loadState.degradedCorridorIds().isEmpty()) {
            return;
        }
        messageDropdown.show(
                controls,
                "Korridor vereinfacht dargestellt",
                "Korridore " + loadState.degradedCorridorIds() + " konnten nicht vollstaendig berechnet werden und werden als Direktverbindung angezeigt.");
    }

    private final class MapReloadHandle implements DungeonMapDropdownController.ReloadHandle {
        @Override
        public void reloadAfterChange(Long preferredMapId, Runnable afterReload) {
            loadingCapability.load(preferredMapId, loadState -> {
                afterReload.run();
                showLoadState(loadState);
            }, DungeonEditorUiCoordinator.this::handleLoadFailure);
        }

        @Override
        public Long sessionMapId() {
            return loadingCapability.sessionMapId();
        }
    }
}
