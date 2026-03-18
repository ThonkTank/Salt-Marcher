package features.world.dungeonmap.editor.room.application;

import features.world.dungeonmap.editor.edit.application.DungeonEditCommandHandler;
import features.world.dungeonmap.editor.edit.application.DungeonEditorEditCommand;
import features.world.dungeonmap.rooms.application.DungeonRoomTopologyCoordinator;
import features.world.dungeonmap.layout.model.DungeonLayoutEditResult;
import features.world.dungeonmap.rooms.model.DungeonRoomCluster;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Objects;

public final class DungeonRoomEditHandler implements DungeonEditCommandHandler<DungeonEditorEditCommand> {

    private final DungeonRoomTopologyCoordinator roomTopologySupport;

    public DungeonRoomEditHandler(DungeonRoomTopologyCoordinator roomTopologySupport) {
        this.roomTopologySupport = Objects.requireNonNull(roomTopologySupport, "roomTopologySupport");
    }

    @Override
    public DungeonLayoutEditResult execute(Connection conn, long mapId, DungeonEditorEditCommand command) throws SQLException {
        return switch (command) {
            case DungeonEditorEditCommand.MoveCluster edit ->
                    roomTopologySupport.moveCluster(conn, mapId, edit.clusterId(), edit.center());
            case DungeonEditorEditCommand.PaintRoomCells edit ->
                    roomTopologySupport.paintRoomCells(conn, mapId, edit.cells());
            case DungeonEditorEditCommand.CreateGraphRoom edit ->
                    roomTopologySupport.createGraphRoom(conn, mapId, edit.center());
            case DungeonEditorEditCommand.DeleteRoomsAtCells edit ->
                    roomTopologySupport.deleteRoomsAtCells(conn, mapId, edit.cells());
            case DungeonEditorEditCommand.DeleteGraphCluster edit ->
                    roomTopologySupport.deleteGraphCluster(conn, mapId, edit.clusterId());
            case DungeonEditorEditCommand.ApplyWallPath edit -> edit.deleteMode()
                    ? roomTopologySupport.deleteClusterEdges(conn, mapId, edit.edgeRefs(), DungeonRoomCluster.EdgeType.WALL)
                    : roomTopologySupport.paintClusterEdges(conn, mapId, edit.edgeRefs(), DungeonRoomCluster.EdgeType.WALL);
            case DungeonEditorEditCommand.PaintClusterDoors edit ->
                    roomTopologySupport.paintClusterEdges(conn, mapId, edit.edgeRefs(), DungeonRoomCluster.EdgeType.DOOR);
            case DungeonEditorEditCommand.DeleteClusterDoors edit ->
                    roomTopologySupport.deleteClusterEdges(conn, mapId, edit.edgeRefs(), DungeonRoomCluster.EdgeType.DOOR);
            default -> throw new IllegalArgumentException(
                    "DungeonRoomEditHandler.execute(): unbekannter Befehl: " + command.getClass().getSimpleName());
        };
    }
}
