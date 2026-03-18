package features.world.dungeonmap.editor.shell.ui;

import features.world.dungeonmap.editor.loading.application.DungeonEditorLoadState;
import features.world.dungeonmap.editor.session.application.workflow.DungeonEditorSessionWorkflow;
import features.world.dungeonmap.editor.session.ui.DungeonEditorSessionCoordinator;
import features.world.dungeonmap.editor.session.ui.port.DungeonEditorSessionUpdate;
import features.world.dungeonmap.editor.session.ui.tool.DungeonEditorToolSessionController;
import features.world.dungeonmap.editor.workspace.ui.DungeonEditorSplitWorkspace;
import features.world.dungeonmap.editor.workspace.ui.base.DungeonViewMode;
import features.world.dungeonmap.view.model.DungeonViewState;
import ui.async.UiErrorReporter;
import ui.components.MessageDropdown;

import java.util.Objects;
import java.util.function.Consumer;

/**
 * Manages view mode state and handles rendering in response to load operations and session updates.
 */
public final class DungeonEditorLoadController {

    private final DungeonEditorSessionWorkflow sessionWorkflow;
    private final DungeonEditorSessionCoordinator sessionCoordinator;
    private final DungeonEditorControls controls;
    private final DungeonEditorSplitWorkspace workspace;
    private final DungeonEditorToolSessionController toolController;
    private final MessageDropdown messageDropdown;
    private Runnable statePaneRefresher;
    private DungeonViewMode viewMode = DungeonViewMode.GRID;

    public DungeonEditorLoadController(
            DungeonEditorSessionWorkflow sessionWorkflow,
            DungeonEditorSessionCoordinator sessionCoordinator,
            DungeonEditorControls controls,
            DungeonEditorSplitWorkspace workspace,
            DungeonEditorToolSessionController toolController,
            MessageDropdown messageDropdown
    ) {
        this.sessionWorkflow = Objects.requireNonNull(sessionWorkflow, "sessionWorkflow");
        this.sessionCoordinator = Objects.requireNonNull(sessionCoordinator, "sessionCoordinator");
        this.controls = Objects.requireNonNull(controls, "controls");
        this.workspace = Objects.requireNonNull(workspace, "workspace");
        this.toolController = Objects.requireNonNull(toolController, "toolController");
        this.messageDropdown = Objects.requireNonNull(messageDropdown, "messageDropdown");
    }

    public void setStatePaneRefresher(Runnable statePaneRefresher) {
        this.statePaneRefresher = Objects.requireNonNull(statePaneRefresher, "statePaneRefresher");
    }

    public void setViewMode(DungeonViewMode viewMode) {
        this.viewMode = viewMode == null ? DungeonViewMode.GRID : viewMode;
        toolController.setViewMode(this.viewMode);
    }

    public void handleSessionUpdate(DungeonEditorSessionUpdate update) {
        switch (update.kind()) {
            case LAYOUT_CHANGED -> renderLayoutFromState();
            case SELECTION_CHANGED -> renderSelectionFromState();
            case STATE_PANE_CHANGED -> refreshStatePaneFromState();
            case RELOAD_LAYOUT -> refreshMapsAndLayout(update.preferredMapId());
        }
    }

    public void loadLayoutAsync(Long mapId) {
        if (mapId == null) {
            return;
        }
        refreshMapsAndLayout(mapId);
    }

    public void showLoadState(DungeonEditorLoadState loadState) {
        controls.setMaps(loadState.maps());
        if (loadState.layout() == null || loadState.selectedMapId() == null) {
            clearLayout();
            return;
        }
        sessionCoordinator.updateLayout(loadState.layout());
        sessionCoordinator.clearSelectionAndTransientState();
        controls.selectMap(loadState.selectedMapId());
        renderLayoutFromState();
    }

    public void refreshMapsAndLayout(Long preferredMapId, Consumer<DungeonEditorLoadState> onSuccess) {
        sessionWorkflow.refreshMapsAndLayout(preferredMapId, onSuccess, this::handleLoadFailure);
        enterLoadingState();
    }

    public Long sessionMapId() {
        return sessionCoordinator.sessionMapId();
    }

    private void refreshMapsAndLayout(Long preferredMapId) {
        refreshMapsAndLayout(preferredMapId, this::showLoadState);
    }

    private void handleLoadFailure(Throwable throwable) {
        UiErrorReporter.reportBackgroundFailure("DungeonEditorLoadController.handleLoadFailure()", throwable);
        messageDropdown.show(controls, "Dungeon konnte nicht geladen werden", "Bitte Datenbankstatus prüfen.");
    }

    private void clearLayout() {
        sessionCoordinator.updateLayout(null);
        sessionCoordinator.clearSelectionAndTransientState();
        controls.selectMap(null);
        renderLayoutFromState();
    }

    private void enterLoadingState() {
        clearLayout();
    }

    private void renderLayoutFromState() {
        workspace.setEditable(sessionCoordinator.editingEnabled());
        controls.selectViewMode(viewMode);
        toolController.syncEditorTool();
        workspace.setViewMode(viewMode);
        workspace.showLayout(new DungeonViewState(sessionCoordinator.currentLayout(), sessionCoordinator.selectedTarget(), null));
        refreshStatePaneFromState();
    }

    private void renderSelectionFromState() {
        workspace.updateSelection(new DungeonViewState(sessionCoordinator.currentLayout(), sessionCoordinator.selectedTarget(), null));
        refreshStatePaneFromState();
    }

    private void refreshStatePaneFromState() {
        if (statePaneRefresher != null) {
            statePaneRefresher.run();
        }
    }
}
