package features.world.dungeonmap.editor.session.ui;

import features.world.dungeonmap.editor.edit.application.DungeonEditorEditCommand;
import features.world.dungeonmap.editor.session.application.CorridorDoorHandle;
import features.world.dungeonmap.editor.session.application.CorridorWaypointHandle;
import features.world.dungeonmap.editor.session.ui.edit.DungeonEditorEditController;
import features.world.dungeonmap.editor.workspace.ui.wallpath.DungeonWallPathCommit;
import features.world.dungeonmap.editor.workspace.ui.port.DungeonEditorWorkspaceSink;
import features.world.dungeonmap.corridors.model.DungeonCorridor;
import features.world.dungeonmap.corridors.model.DungeonCorridorEndpoint;
import features.world.dungeonmap.rooms.model.DungeonRoom;
import features.world.dungeonmap.rooms.model.DungeonRoomCluster;

import java.util.function.Consumer;

final class DungeonEditorSessionWorkspaceSink implements DungeonEditorWorkspaceSink {

    private final DungeonEditorSelectionPresenter selectionPresenter;
    private final DungeonEditorEditController editController;
    private final Consumer<CorridorDoorHandle> corridorDoorSelectionChangedHandler;

    DungeonEditorSessionWorkspaceSink(
            DungeonEditorSelectionPresenter selectionPresenter,
            DungeonEditorEditController editController,
            Consumer<CorridorDoorHandle> corridorDoorSelectionChangedHandler
    ) {
        this.selectionPresenter = selectionPresenter;
        this.editController = editController;
        this.corridorDoorSelectionChangedHandler = corridorDoorSelectionChangedHandler;
    }

    @Override
    public void onRoomSelected(DungeonRoom room) {
        selectionPresenter.onRoomSelected(room);
    }

    @Override
    public void onClusterSelected(DungeonRoomCluster cluster) {
        selectionPresenter.onClusterSelected(cluster);
    }

    @Override
    public void onCorridorSelected(DungeonCorridor corridor) {
        selectionPresenter.onCorridorSelected(corridor);
    }

    @Override
    public void onCorridorEndpointSelected(DungeonCorridorEndpoint endpoint) {
        selectionPresenter.onCorridorEndpointSelected(endpoint);
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
