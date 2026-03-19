package features.world.quarantine.dungeonmap.editor.quarantine.state;

import features.world.quarantine.dungeonmap.editor.session.edit.DungeonEditorEditCommand;
import features.world.quarantine.dungeonmap.editor.session.edit.DungeonEditorEditController;
import features.world.quarantine.dungeonmap.editor.session.selection.DungeonEditorSelectionPresenter;
import features.world.quarantine.dungeonmap.editor.selection.CorridorDoorHandle;
import features.world.quarantine.dungeonmap.editor.selection.CorridorWaypointHandle;
import features.world.quarantine.dungeonmap.editor.workspace.wallpath.DungeonWallPathCommit;
import features.world.quarantine.dungeonmap.editor.workspace.DungeonEditorTool;
import features.world.quarantine.dungeonmap.editor.workspace.contract.DungeonEditorWorkspaceSink;
import features.world.quarantine.dungeonmap.editor.workspace.contract.DungeonPaneInteractionSinkAdapter;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridorEndpoint;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoom;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster;

import java.util.function.Consumer;
import java.util.function.Supplier;

public final class DungeonEditorSessionWorkspaceSink extends DungeonPaneInteractionSinkAdapter implements DungeonEditorWorkspaceSink {

    private final DungeonEditorSelectionPresenter selectionPresenter;
    private final DungeonEditorEditController editController;
    private final Consumer<CorridorDoorHandle> corridorDoorSelectionChangedHandler;
    private final Consumer<DungeonCorridorEndpoint> corridorTargetSelector;
    private final Supplier<DungeonEditorTool> activeToolSupplier;

    public DungeonEditorSessionWorkspaceSink(
            DungeonEditorSelectionPresenter selectionPresenter,
            DungeonEditorEditController editController,
            Consumer<CorridorDoorHandle> corridorDoorSelectionChangedHandler,
            Consumer<DungeonCorridorEndpoint> corridorTargetSelector,
            Supplier<DungeonEditorTool> activeToolSupplier
    ) {
        this.selectionPresenter = selectionPresenter;
        this.editController = editController;
        this.corridorDoorSelectionChangedHandler = corridorDoorSelectionChangedHandler;
        this.corridorTargetSelector = corridorTargetSelector;
        this.activeToolSupplier = activeToolSupplier;
    }

    @Override
    public void onRoomSelected(DungeonRoom room) {
        if (room != null && room.roomId() != null
                && activeToolSupplier.get() == DungeonEditorTool.CORRIDOR_CREATE) {
            corridorTargetSelector.accept(DungeonCorridorEndpoint.room(room.roomId()));
            return;
        }
        selectionPresenter.onRoomSelected(room);
    }

    @Override
    public void onClusterSelected(DungeonRoomCluster cluster) {
        selectionPresenter.onClusterSelected(cluster);
    }

    @Override
    public void onCorridorSelected(DungeonCorridor corridor) {
        if (corridor != null && corridor.corridorId() != null
                && activeToolSupplier.get() == DungeonEditorTool.CORRIDOR_CREATE) {
            corridorTargetSelector.accept(DungeonCorridorEndpoint.corridor(corridor.corridorId()));
            return;
        }
        selectionPresenter.onCorridorSelected(corridor);
    }

    @Override
    public void onCorridorEndpointSelected(DungeonCorridorEndpoint endpoint) {
        corridorTargetSelector.accept(endpoint);
    }

    @Override
    public void onCorridorDoorSelected(CorridorDoorHandle handle) {
        selectionPresenter.onCorridorDoorSelected(handle);
    }

    @Override
    public void onCorridorDoorSelectionChanged(CorridorDoorHandle handle) {
        corridorDoorSelectionChangedHandler.accept(handle);
    }

    @Override
    public void onCorridorWaypointSelected(CorridorWaypointHandle handle) {
        selectionPresenter.onCorridorWaypointSelected(handle);
    }

    @Override
    public void onEditRequested(DungeonEditorEditCommand command) {
        editController.onEditRequested(command);
    }

    @Override
    public void onWallPathStateChanged() {
        editController.onWallPathStateChanged();
    }

    @Override
    public void onWallPathCommitRequested(DungeonWallPathCommit request, boolean deleteMode) {
        editController.onWallPathCommitRequested(request, deleteMode);
    }
}
