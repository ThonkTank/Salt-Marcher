package features.world.dungeonmap.editor.session.ui;

import features.world.dungeonmap.editor.session.application.CorridorDoorHandle;
import features.world.dungeonmap.editor.session.application.CorridorWaypointHandle;
import features.world.dungeonmap.editor.session.application.DungeonEditorSelectionPolicy;
import features.world.dungeonmap.editor.session.application.DungeonEditorSessionState;
import features.world.dungeonmap.editor.session.ui.edit.DungeonEditorSessionEditOutcome;
import features.world.dungeonmap.editor.session.ui.port.DungeonEditorSessionUpdate;
import features.world.dungeonmap.editor.shell.ui.DungeonEditorInspectorCoordinator;
import features.world.dungeonmap.editor.workspace.ui.DungeonEditorSplitWorkspace;
import features.world.dungeonmap.editor.workspace.ui.base.DungeonEditorTool;
import features.world.dungeonmap.layout.model.DungeonLayout;
import features.world.dungeonmap.corridors.model.DungeonCorridor;
import features.world.dungeonmap.corridors.model.DungeonCorridorEndpoint;
import features.world.dungeonmap.rooms.model.DungeonRoom;
import features.world.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.dungeonmap.view.model.DungeonSelection;
import features.world.dungeonmap.inspector.ui.DungeonInspectorPresenter;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Supplier;

/**
 * Handles selection application logic: applies, routes, and clears selection state,
 * and notifies the inspector and outer update sink on changes.
 */
final class DungeonEditorSelectionPresenter implements DungeonEditorSelectionController {

    private final DungeonEditorSessionState sessionState;
    private final DungeonEditorSelectionPolicy selectionPolicy;
    private final DungeonEditorSplitWorkspace workspace;
    private final DungeonEditorInspectorCoordinator inspectorCoordinator;
    private final Runnable emitStatePaneUpdate;
    private final Supplier<DungeonEditorTool> activeToolSupplier;
    private Consumer<DungeonCorridorEndpoint> corridorTargetSelector;
    private final Supplier<DungeonLayout> currentLayoutSupplier;

    DungeonEditorSelectionPresenter(
            DungeonEditorSessionState sessionState,
            DungeonEditorSelectionPolicy selectionPolicy,
            DungeonEditorSplitWorkspace workspace,
            DungeonEditorInspectorCoordinator inspectorCoordinator,
            Runnable emitStatePaneUpdate,
            Supplier<DungeonEditorTool> activeToolSupplier,
            Supplier<DungeonLayout> currentLayoutSupplier
    ) {
        this.sessionState = Objects.requireNonNull(sessionState, "sessionState");
        this.selectionPolicy = Objects.requireNonNull(selectionPolicy, "selectionPolicy");
        this.workspace = Objects.requireNonNull(workspace, "workspace");
        this.inspectorCoordinator = Objects.requireNonNull(inspectorCoordinator, "inspectorCoordinator");
        this.emitStatePaneUpdate = Objects.requireNonNull(emitStatePaneUpdate, "emitStatePaneUpdate");
        this.activeToolSupplier = Objects.requireNonNull(activeToolSupplier, "activeToolSupplier");
        this.currentLayoutSupplier = Objects.requireNonNull(currentLayoutSupplier, "currentLayoutSupplier");
    }

    void setCorridorTargetSelector(Consumer<DungeonCorridorEndpoint> corridorTargetSelector) {
        this.corridorTargetSelector = Objects.requireNonNull(corridorTargetSelector, "corridorTargetSelector");
    }

    CorridorWaypointHandle selectedCorridorWaypointHandle() {
        return sessionState.selectedCorridorWaypointHandle();
    }

    CorridorDoorHandle selectedCorridorDoorHandle() {
        return sessionState.selectedCorridorDoorHandle();
    }

    @Override
    public DungeonSelection selectedTarget() {
        return sessionState.selectedTarget();
    }

    void clearSelection() {
        clearSelectionAndEmitUpdate();
    }

    @Override
    public void prepareLayoutRefreshSelection(
            DungeonLayout layout,
            DungeonSelection target,
            DungeonEditorSessionEditOutcome.CorridorSelectionIntent corridorSelectionIntent
    ) {
        applyRefreshedTargetInLayout(layout, target);
        applyCorridorSelectionIntent(corridorSelectionIntent);
    }

    void selectCluster(DungeonRoomCluster cluster) {
        showUserTargetSelection(selectionPolicy.selectCluster(sessionState, cluster));
    }

    void selectRoom(DungeonRoom room) {
        showUserTargetSelection(selectionPolicy.selectRoom(sessionState, currentLayoutSupplier.get(), room));
    }

    void selectCorridor(DungeonCorridor corridor) {
        showUserTargetSelection(selectionPolicy.selectCorridor(sessionState, corridor));
    }

    void selectCorridorDoorHandle(CorridorDoorHandle handle) {
        showSelectedCorridorDoorHandle(handle);
    }

    void selectCorridorWaypointHandle(CorridorWaypointHandle handle) {
        showSelectedCorridorWaypointHandle(handle);
    }

    @Override
    public void selectCorridorTargetSelection(DungeonCorridorEndpoint target) {
        showUserTargetSelection(selectionPolicy.selectCorridorTargetSelection(sessionState, currentLayoutSupplier.get(), target));
    }

    void onRoomSelected(DungeonRoom room) {
        if (room != null && room.roomId() != null
                && activeToolSupplier.get() == DungeonEditorTool.CORRIDOR_CREATE) {
            corridorTargetSelector.accept(DungeonCorridorEndpoint.room(room.roomId()));
            return;
        }
        selectRoom(room);
    }

    void onClusterSelected(DungeonRoomCluster cluster) {
        selectCluster(cluster);
    }

    void onCorridorSelected(DungeonCorridor corridor) {
        if (corridor != null && corridor.corridorId() != null
                && activeToolSupplier.get() == DungeonEditorTool.CORRIDOR_CREATE) {
            corridorTargetSelector.accept(DungeonCorridorEndpoint.corridor(corridor.corridorId()));
            return;
        }
        selectCorridor(corridor);
    }

    void onCorridorEndpointSelected(DungeonCorridorEndpoint endpoint) {
        corridorTargetSelector.accept(endpoint);
    }

    void onCorridorDoorSelected(CorridorDoorHandle handle) {
        selectCorridorDoorHandle(handle);
    }

    void onCorridorWaypointSelected(CorridorWaypointHandle handle) {
        selectCorridorWaypointHandle(handle);
    }

    void syncCorridorDoorWorkspaceSelection() {
        workspace.setSelectedCorridorDoorHandle(sessionState.selectedCorridorDoorHandle());
    }

    private void showUserTargetSelection(DungeonSelection target) {
        DungeonLayout layout = currentLayoutSupplier.get();
        if (target == null) {
            clearSelectionAndEmitUpdate();
            return;
        }
        if (layout == null) {
            return;
        }
        applyTargetSelection(layout, target);
        emitSelectionChanged();
    }

    private void applyRefreshedTargetInLayout(DungeonLayout layout, DungeonSelection target) {
        if (target == null) {
            clearSelectionState();
            return;
        }
        applyTargetSelection(layout, target);
    }

    private void showSelectedCorridorDoorHandle(CorridorDoorHandle handle) {
        DungeonSelection target = selectionPolicy.selectCorridorDoorHandle(sessionState, handle);
        showCorridorHandleSelection(target);
    }

    private void showSelectedCorridorWaypointHandle(CorridorWaypointHandle handle) {
        DungeonSelection target = selectionPolicy.selectCorridorWaypointHandle(sessionState, handle);
        showCorridorHandleSelection(target);
    }

    private void showCorridorHandleSelection(DungeonSelection target) {
        if (target == null) {
            clearSelectionAndEmitUpdate();
            return;
        }
        DungeonLayout layout = currentLayoutSupplier.get();
        if (layout == null) {
            return;
        }
        applyTargetSelection(layout, target);
        emitSelectionChanged();
    }

    private void applyTargetSelection(DungeonLayout layout, DungeonSelection target) {
        if (layout == null) {
            return;
        }
        if (target instanceof DungeonSelection.RoomCluster cluster) {
            applyClusterSelection(layout, DungeonInspectorPresenter.findCluster(layout, cluster.clusterId()));
            return;
        }
        if (target instanceof DungeonSelection.Corridor corridor) {
            applyCorridorSelection(layout, DungeonInspectorPresenter.findCorridor(layout, corridor.corridorId()));
        }
    }

    private void applyCorridorSelection(DungeonLayout layout, DungeonCorridor corridor) {
        if (corridor == null || corridor.corridorId() == null || layout == null) {
            clearSelectionState();
            return;
        }
        sessionState.setSelectedTarget(DungeonSelection.corridor(corridor.corridorId()));
        syncCorridorDoorWorkspaceSelection();
    }

    private void applyClusterSelection(DungeonLayout layout, DungeonRoomCluster cluster) {
        sessionState.setSelectedTarget(cluster == null || cluster.clusterId() == null ? null : DungeonSelection.roomCluster(cluster.clusterId()));
        sessionState.clearCorridorEditSelection();
        syncCorridorDoorWorkspaceSelection();
    }

    private void applyCorridorSelectionIntent(DungeonEditorSessionEditOutcome.CorridorSelectionIntent selectionIntent) {
        if (!(sessionState.selectedTarget() instanceof DungeonSelection.Corridor)) {
            clearCorridorEditSelection();
            return;
        }
        if (selectionIntent == null) {
            clearCorridorEditSelection();
            return;
        }
        switch (selectionIntent) {
            case DungeonEditorSessionEditOutcome.CorridorSelectionIntent.Door door -> {
                sessionState.selectCorridorDoorHandle(new CorridorDoorHandle(door.corridorId(), door.roomId()));
                syncCorridorDoorWorkspaceSelection();
            }
            case DungeonEditorSessionEditOutcome.CorridorSelectionIntent.Waypoint waypoint -> {
                sessionState.selectCorridorWaypointHandle(new CorridorWaypointHandle(waypoint.corridorId(), waypoint.waypointIndex()));
                syncCorridorDoorWorkspaceSelection();
            }
            case DungeonEditorSessionEditOutcome.CorridorSelectionIntent.None none -> clearCorridorEditSelection();
        }
    }

    private void clearSelectionAndEmitUpdate() {
        clearSelectionState();
        emitSelectionChanged();
    }

    private void clearSelectionState() {
        sessionState.setSelectedTarget(null);
        clearCorridorEditSelection();
    }

    private void clearCorridorEditSelection() {
        sessionState.clearCorridorEditSelection();
        syncCorridorDoorWorkspaceSelection();
    }

    private void emitSelectionChanged() {
        inspectorCoordinator.onSessionUpdate(DungeonEditorSessionUpdate.selectionChanged());
        emitStatePaneUpdate.run();
    }
}
