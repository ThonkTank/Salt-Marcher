package features.world.quarantine.dungeonmap.editor;

import features.world.quarantine.dungeonmap.corridors.application.DungeonCorridorCommandService;
import features.world.quarantine.dungeonmap.corridors.application.DungeonCorridorDetailEditService;
import features.world.quarantine.dungeonmap.editor.session.edit.DungeonEditorEditCommand;
import features.world.quarantine.dungeonmap.layout.application.DungeonTopologyEditResultLoader;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayoutEditResult;
import features.world.quarantine.dungeonmap.rooms.application.DungeonRoomTopologyCoordinator;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Objects;

/**
 * Routes editor commands to the appropriate service handler.
 */
final class DungeonEditorCommandRouter {

    private final DungeonRoomTopologyCoordinator roomTopologyCoordinator;
    private final DungeonCorridorCommandService corridorCommandService;
    private final DungeonCorridorDetailEditService corridorDetailEditService;

    DungeonEditorCommandRouter(
            DungeonRoomTopologyCoordinator roomTopologyCoordinator,
            DungeonCorridorCommandService corridorCommandService,
            DungeonCorridorDetailEditService corridorDetailEditService
    ) {
        this.roomTopologyCoordinator = Objects.requireNonNull(roomTopologyCoordinator, "roomTopologyCoordinator");
        this.corridorCommandService = Objects.requireNonNull(corridorCommandService, "corridorCommandService");
        this.corridorDetailEditService = Objects.requireNonNull(corridorDetailEditService, "corridorDetailEditService");
    }

    DungeonLayoutEditResult route(Connection conn, long mapId, DungeonEditorEditCommand command) throws SQLException {
        DungeonLayout layout = DungeonTopologyEditResultLoader.requireLayout(conn, mapId);
        return switch (command) {
            case DungeonEditorEditCommand.MoveCluster edit -> handleMoveCluster(conn, mapId, edit);
            case DungeonEditorEditCommand.PaintRoomCells edit -> handlePaintRoomCells(conn, mapId, edit);
            case DungeonEditorEditCommand.CreateGraphRoom edit -> handleCreateGraphRoom(conn, mapId, edit);
            case DungeonEditorEditCommand.DeleteRoomsAtCells edit -> handleDeleteRoomsAtCells(conn, mapId, edit);
            case DungeonEditorEditCommand.DeleteGraphCluster edit -> handleDeleteGraphCluster(conn, mapId, edit);
            case DungeonEditorEditCommand.ApplyWallPath edit -> handleApplyWallPath(conn, mapId, edit);
            case DungeonEditorEditCommand.PaintClusterDoors edit -> handlePaintClusterDoors(conn, mapId, edit);
            case DungeonEditorEditCommand.DeleteClusterDoors edit -> handleDeleteClusterDoors(conn, mapId, edit);
            case DungeonEditorEditCommand.CreateCorridor edit -> handleCreateCorridor(conn, layout, mapId, edit);
            case DungeonEditorEditCommand.AddRoomToCorridor edit -> handleAddRoomToCorridor(conn, layout, mapId, edit);
            case DungeonEditorEditCommand.MergeCorridors edit -> handleMergeCorridors(conn, layout, mapId, edit);
            case DungeonEditorEditCommand.RemoveRoomFromCorridors edit -> handleRemoveRoomFromCorridors(conn, layout, mapId, edit);
            case DungeonEditorEditCommand.DeleteCorridor edit -> handleDeleteCorridor(conn, layout, mapId, edit);
            case DungeonEditorEditCommand.MoveCorridorDoor edit -> handleMoveCorridorDoor(conn, layout, mapId, edit);
            case DungeonEditorEditCommand.ResetCorridorDoor edit -> handleResetCorridorDoor(conn, layout, mapId, edit);
            case DungeonEditorEditCommand.AddCorridorWaypoint edit -> handleAddCorridorWaypoint(conn, layout, mapId, edit);
            case DungeonEditorEditCommand.MoveCorridorWaypoint edit -> handleMoveCorridorWaypoint(conn, layout, mapId, edit);
            case DungeonEditorEditCommand.DeleteCorridorWaypoint edit -> handleDeleteCorridorWaypoint(conn, layout, mapId, edit);
        };
    }

    private DungeonLayoutEditResult handleMoveCluster(Connection conn, long mapId, DungeonEditorEditCommand.MoveCluster edit) throws SQLException {
        return roomTopologyCoordinator.moveCluster(conn, mapId, edit.clusterId(), edit.center());
    }

    private DungeonLayoutEditResult handlePaintRoomCells(Connection conn, long mapId, DungeonEditorEditCommand.PaintRoomCells edit) throws SQLException {
        return roomTopologyCoordinator.paintRoomCells(conn, mapId, edit.cells());
    }

    private DungeonLayoutEditResult handleCreateGraphRoom(Connection conn, long mapId, DungeonEditorEditCommand.CreateGraphRoom edit) throws SQLException {
        return roomTopologyCoordinator.createGraphRoom(conn, mapId, edit.center());
    }

    private DungeonLayoutEditResult handleDeleteRoomsAtCells(Connection conn, long mapId, DungeonEditorEditCommand.DeleteRoomsAtCells edit) throws SQLException {
        return roomTopologyCoordinator.deleteRoomsAtCells(conn, mapId, edit.cells());
    }

    private DungeonLayoutEditResult handleDeleteGraphCluster(Connection conn, long mapId, DungeonEditorEditCommand.DeleteGraphCluster edit) throws SQLException {
        return roomTopologyCoordinator.deleteGraphCluster(conn, mapId, edit.clusterId());
    }

    private DungeonLayoutEditResult handleApplyWallPath(Connection conn, long mapId, DungeonEditorEditCommand.ApplyWallPath edit) throws SQLException {
        return edit.deleteMode()
                ? roomTopologyCoordinator.deleteClusterEdges(conn, mapId, edit.edgeRefs(), DungeonRoomCluster.EdgeType.WALL)
                : roomTopologyCoordinator.paintClusterEdges(conn, mapId, edit.edgeRefs(), DungeonRoomCluster.EdgeType.WALL);
    }

    private DungeonLayoutEditResult handlePaintClusterDoors(Connection conn, long mapId, DungeonEditorEditCommand.PaintClusterDoors edit) throws SQLException {
        return roomTopologyCoordinator.paintClusterEdges(conn, mapId, edit.edgeRefs(), DungeonRoomCluster.EdgeType.DOOR);
    }

    private DungeonLayoutEditResult handleDeleteClusterDoors(Connection conn, long mapId, DungeonEditorEditCommand.DeleteClusterDoors edit) throws SQLException {
        return roomTopologyCoordinator.deleteClusterEdges(conn, mapId, edit.edgeRefs(), DungeonRoomCluster.EdgeType.DOOR);
    }

    private DungeonLayoutEditResult handleCreateCorridor(Connection conn, DungeonLayout layout, long mapId, DungeonEditorEditCommand.CreateCorridor edit) throws SQLException {
        return corridorCommandService.createCorridor(conn, layout, mapId, edit.roomIds());
    }

    private DungeonLayoutEditResult handleAddRoomToCorridor(Connection conn, DungeonLayout layout, long mapId, DungeonEditorEditCommand.AddRoomToCorridor edit) throws SQLException {
        return corridorCommandService.addRoomToCorridor(conn, layout, mapId, edit.corridorId(), edit.roomId());
    }

    private DungeonLayoutEditResult handleMergeCorridors(Connection conn, DungeonLayout layout, long mapId, DungeonEditorEditCommand.MergeCorridors edit) throws SQLException {
        return corridorCommandService.mergeCorridors(conn, layout, mapId, edit.keptCorridorId(), edit.mergedCorridorId());
    }

    private DungeonLayoutEditResult handleRemoveRoomFromCorridors(Connection conn, DungeonLayout layout, long mapId, DungeonEditorEditCommand.RemoveRoomFromCorridors edit) throws SQLException {
        return corridorCommandService.removeRoomFromCorridors(conn, layout, mapId, edit.corridorIds(), edit.roomId());
    }

    private DungeonLayoutEditResult handleDeleteCorridor(Connection conn, DungeonLayout layout, long mapId, DungeonEditorEditCommand.DeleteCorridor edit) throws SQLException {
        return corridorCommandService.deleteCorridor(conn, layout, mapId, edit.corridorId());
    }

    private DungeonLayoutEditResult handleMoveCorridorDoor(Connection conn, DungeonLayout layout, long mapId, DungeonEditorEditCommand.MoveCorridorDoor edit) throws SQLException {
        return corridorDetailEditService.moveCorridorDoor(conn, layout, mapId, edit.corridorId(), edit.roomId(), edit.cell(), edit.direction());
    }

    private DungeonLayoutEditResult handleResetCorridorDoor(Connection conn, DungeonLayout layout, long mapId, DungeonEditorEditCommand.ResetCorridorDoor edit) throws SQLException {
        return corridorDetailEditService.resetCorridorDoor(conn, layout, mapId, edit.corridorId(), edit.roomId());
    }

    private DungeonLayoutEditResult handleAddCorridorWaypoint(Connection conn, DungeonLayout layout, long mapId, DungeonEditorEditCommand.AddCorridorWaypoint edit) throws SQLException {
        return corridorDetailEditService.addCorridorWaypoint(conn, layout, mapId, edit.corridorId(), edit.insertIndex(), edit.cell());
    }

    private DungeonLayoutEditResult handleMoveCorridorWaypoint(Connection conn, DungeonLayout layout, long mapId, DungeonEditorEditCommand.MoveCorridorWaypoint edit) throws SQLException {
        return corridorDetailEditService.moveCorridorWaypoint(conn, layout, mapId, edit.corridorId(), edit.waypointIndex(), edit.cell());
    }

    private DungeonLayoutEditResult handleDeleteCorridorWaypoint(Connection conn, DungeonLayout layout, long mapId, DungeonEditorEditCommand.DeleteCorridorWaypoint edit) throws SQLException {
        return corridorDetailEditService.deleteCorridorWaypoint(conn, layout, mapId, edit.corridorId(), edit.waypointIndex());
    }
}
