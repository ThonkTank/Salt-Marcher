package features.world.quarantine.dungeonmap.editor.quarantine.state;

import features.world.quarantine.dungeonmap.editor.session.edit.DungeonEditorEditController;
import features.world.quarantine.dungeonmap.editor.quarantine.loading.DungeonEditorSessionWorkflow;
import features.world.quarantine.dungeonmap.editor.session.selection.DungeonEditorSelectionPresenter;
import features.world.quarantine.dungeonmap.editor.session.selection.DungeonEditorStatePaneModel;
import features.world.quarantine.dungeonmap.editor.session.tool.DungeonEditorToolSessionController;
import features.world.quarantine.dungeonmap.editor.workspace.contract.DungeonEditorWorkspaceSink;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.layout.model.DungeonSelection;
import features.world.quarantine.dungeonmap.editor.session.DungeonEditorSessionState;

import java.util.Objects;
import java.util.function.Consumer;

/**
 * Coordinates mutable editor interaction state. Holds current layout and session workflow
 * access, and exposes session and workspace interaction methods directly.
 *
 * <p>Use {@link DungeonEditorSessionFactory#create} to construct.
 */
public final class DungeonEditorSessionCoordinator implements DungeonEditorSessionReadModel {

    private final DungeonEditorSessionWorkflow sessionWorkflow;
    private final DungeonEditorSessionState sessionState;

    private final DungeonEditorSelectionPresenter selectionPresenter;
    private final DungeonEditorToolSessionController toolSessionController;
    private final DungeonEditorEditController editController;
    private final DungeonEditorWorkspaceSink workspaceSink;

    private final DungeonEditorMutableReadModel readModel;

    DungeonEditorSessionCoordinator(
            DungeonEditorSessionWorkflow sessionWorkflow,
            DungeonEditorSessionState sessionState,
            DungeonEditorSelectionPresenter selectionPresenter,
            DungeonEditorToolSessionController toolSessionController,
            DungeonEditorEditController editController,
            DungeonEditorWorkspaceSink workspaceSink,
            DungeonEditorMutableReadModel readModel
    ) {
        this.sessionWorkflow = sessionWorkflow;
        this.sessionState = sessionState;
        this.selectionPresenter = selectionPresenter;
        this.toolSessionController = toolSessionController;
        this.editController = editController;
        this.workspaceSink = workspaceSink;
        this.readModel = readModel;
    }

    // --- Layout state ---

    /** Updates the current layout; called by the editor shell when load completes. */
    public void updateLayout(DungeonLayout layout) {
        readModel.updateLayout(layout);
    }

    public void setOnExternalUpdate(Consumer<DungeonEditorSessionUpdate> onExternalUpdate) {
        readModel.setOnExternalUpdate(Objects.requireNonNull(onExternalUpdate, "onExternalUpdate"));
    }

    // --- DungeonEditorSessionReadModel ---

    @Override
    public DungeonLayout currentLayout() {
        return readModel.currentLayout();
    }

    @Override
    public Long sessionMapId() {
        return sessionWorkflow.sessionMapId();
    }

    @Override
    public Long activeEditSessionId() {
        return sessionWorkflow.activeEditSessionId();
    }

    @Override
    public boolean editingEnabled() {
        return sessionWorkflow.editingEnabled();
    }

    // --- Session actions ---

    public void clearSelectionAndTransientState() {
        selectionPresenter.clearSelection();
        toolSessionController.clearTransientState();
    }

    public void resetForLoadedLayout() {
        sessionState.setSelectedTarget(null);
        sessionState.clearTransientState();
        selectionPresenter.syncCorridorDoorWorkspaceSelection();
    }

    public DungeonSelection selectedTarget() {
        return sessionState.selectedTarget();
    }

    public DungeonCorridor selectedCorridor() {
        return sessionState.selectedCorridor(readModel.currentLayout());
    }

    /** Returns the tool controller for direct use by shell components. */
    public DungeonEditorToolSessionController toolPort() {
        return toolSessionController;
    }

    public DungeonEditorWorkspaceSink workspaceSink() {
        return workspaceSink;
    }

    public void resetSelectedCorridorDoor() {
        editController.resetSelectedCorridorDoor();
    }

    public void deleteSelectedCorridorWaypoint() {
        editController.deleteSelectedCorridorWaypoint();
    }

    public DungeonEditorStatePaneModel statePaneModel() {
        return buildStatePaneModel();
    }

    // --- Internal ---

    private DungeonEditorStatePaneModel buildStatePaneModel() {
        return new DungeonEditorStatePaneModel(
                toolSessionController.activeTool(),
                selectedCorridor(),
                selectionPresenter.selectedCorridorDoorHandle(),
                selectionPresenter.selectedCorridorWaypointHandle());
    }
}
