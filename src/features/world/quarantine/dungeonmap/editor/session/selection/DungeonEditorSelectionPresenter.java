package features.world.quarantine.dungeonmap.editor.session.selection;

import features.world.quarantine.dungeonmap.editor.session.DungeonEditorSessionState;
import features.world.quarantine.dungeonmap.editor.selection.CorridorDoorHandle;
import features.world.quarantine.dungeonmap.editor.selection.CorridorWaypointHandle;
import features.world.quarantine.dungeonmap.editor.session.edit.DungeonEditorSessionEditOutcome;
import features.world.quarantine.dungeonmap.editor.session.inspector.DungeonEditorInspectorCoordinator;
import features.world.quarantine.dungeonmap.editor.session.EditorWorkspacePort;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridorEndpoint;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoom;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.quarantine.dungeonmap.layout.model.DungeonSelection;
import java.util.Objects;
import java.util.function.Supplier;

/**
 * Handles selection application logic: applies, routes, and clears selection state,
 * and notifies the inspector and outer update sink on changes.
 */
public final class DungeonEditorSelectionPresenter implements DungeonEditorSelectionController {

    private final DungeonEditorSessionState sessionState;
    private final DungeonEditorSelectionPolicy selectionPolicy;
    private final EditorWorkspacePort workspace;
    private final DungeonEditorInspectorCoordinator inspectorCoordinator;
    private final Runnable emitStatePaneUpdate;
    private final Supplier<DungeonLayout> currentLayoutSupplier;

    public DungeonEditorSelectionPresenter(
            DungeonEditorSessionState sessionState,
            DungeonEditorSelectionPolicy selectionPolicy,
            EditorWorkspacePort workspace,
            DungeonEditorInspectorCoordinator inspectorCoordinator,
            Runnable emitStatePaneUpdate,
            Supplier<DungeonLayout> currentLayoutSupplier
    ) {
        this.sessionState = Objects.requireNonNull(sessionState, "sessionState");
        this.selectionPolicy = Objects.requireNonNull(selectionPolicy, "selectionPolicy");
        this.workspace = Objects.requireNonNull(workspace, "workspace");
        this.inspectorCoordinator = Objects.requireNonNull(inspectorCoordinator, "inspectorCoordinator");
        this.emitStatePaneUpdate = Objects.requireNonNull(emitStatePaneUpdate, "emitStatePaneUpdate");
        this.currentLayoutSupplier = Objects.requireNonNull(currentLayoutSupplier, "currentLayoutSupplier");
    }

    public CorridorWaypointHandle selectedCorridorWaypointHandle() {
        return sessionState.selectedCorridorWaypointHandle();
    }

    public CorridorDoorHandle selectedCorridorDoorHandle() {
        return sessionState.selectedCorridorDoorHandle();
    }

    @Override
    public DungeonSelection selectedTarget() {
        return sessionState.selectedTarget();
    }

    public void clearSelection() {
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

    public void selectCluster(DungeonRoomCluster cluster) {
        showUserTargetSelection(selectionPolicy.selectCluster(sessionState, cluster));
    }

    public void selectRoom(DungeonRoom room) {
        showUserTargetSelection(selectionPolicy.selectRoom(sessionState, currentLayoutSupplier.get(), room));
    }

    public void selectCorridor(DungeonCorridor corridor) {
        showUserTargetSelection(selectionPolicy.selectCorridor(sessionState, corridor));
    }

    public void selectCorridorDoorHandle(CorridorDoorHandle handle) {
        showSelectedCorridorDoorHandle(handle);
    }

    public void selectCorridorWaypointHandle(CorridorWaypointHandle handle) {
        showSelectedCorridorWaypointHandle(handle);
    }

    @Override
    public void selectCorridorTargetSelection(DungeonCorridorEndpoint target) {
        showUserTargetSelection(selectionPolicy.selectCorridorTargetSelection(sessionState, currentLayoutSupplier.get(), target));
    }

    public void onRoomSelected(DungeonRoom room) {
        selectRoom(room);
    }

    public void onClusterSelected(DungeonRoomCluster cluster) {
        selectCluster(cluster);
    }

    public void onCorridorSelected(DungeonCorridor corridor) {
        selectCorridor(corridor);
    }

    public void onCorridorDoorSelected(CorridorDoorHandle handle) {
        selectCorridorDoorHandle(handle);
    }

    public void onCorridorWaypointSelected(CorridorWaypointHandle handle) {
        selectCorridorWaypointHandle(handle);
    }

    public void syncCorridorDoorWorkspaceSelection() {
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
        target.accept(
                cluster -> applyClusterSelection(layout, layout.findCluster(cluster.clusterId())),
                corridor -> applyCorridorSelection(layout, layout.findCorridor(corridor.corridorId())));
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
        DungeonSelection selected = sessionState.selectedTarget();
        if (selected == null || selected.map(cluster -> true, corridor -> false)) {
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
        inspectorCoordinator.publishForCurrentSelection(currentLayoutSupplier.get());
        emitStatePaneUpdate.run();
    }
}
