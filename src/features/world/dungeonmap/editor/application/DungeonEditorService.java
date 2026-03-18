package features.world.dungeonmap.editor.application;

import features.world.dungeonmap.editor.corridor.application.DungeonCorridorDetailEditHandler;
import features.world.dungeonmap.editor.corridor.application.DungeonCorridorEditHandler;
import features.world.dungeonmap.editor.edit.application.DungeonEditCommandHandler;
import features.world.dungeonmap.editor.edit.application.DungeonEditorEditCommand;
import features.world.dungeonmap.editor.room.application.DungeonRoomEditHandler;
import features.world.dungeonmap.foundation.db.DungeonConnectionFactory;
import features.world.dungeonmap.layout.application.support.DungeonRuntimeStateSupport;
import features.world.dungeonmap.corridors.application.DungeonCorridorCommandService;
import features.world.dungeonmap.corridors.application.DungeonCorridorDetailEditService;
import features.world.dungeonmap.rooms.application.DungeonRoomTopologyCoordinator;
import features.world.dungeonmap.layout.model.DungeonLayout;
import features.world.dungeonmap.layout.model.DungeonLayoutEditResult;
import features.world.dungeonmap.layout.persistence.DungeonLayoutReadRepository;
import features.world.dungeonmap.foundation.db.DungeonTransactionSupport;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Objects;

/**
 * Public facade for dungeon editor read/write workflows.
 */
public final class DungeonEditorService {

    private final DungeonConnectionFactory connectionFactory;
    private final DungeonRoomEditHandler roomEdits;
    private final DungeonCorridorEditHandler corridorEdits;
    private final DungeonCorridorDetailEditHandler corridorDetailEdits;

    public DungeonEditorService(
            DungeonConnectionFactory connectionFactory,
            DungeonRoomTopologyCoordinator roomTopologySupport,
            DungeonCorridorCommandService corridorCommandService,
            DungeonCorridorDetailEditService corridorDetailEditService
    ) {
        this.connectionFactory = Objects.requireNonNull(connectionFactory, "connectionFactory");
        this.roomEdits = new DungeonRoomEditHandler(
                Objects.requireNonNull(roomTopologySupport, "roomTopologySupport"));
        this.corridorEdits = new DungeonCorridorEditHandler(
                Objects.requireNonNull(corridorCommandService, "corridorCommandService"));
        this.corridorDetailEdits = new DungeonCorridorDetailEditHandler(
                Objects.requireNonNull(corridorDetailEditService, "corridorDetailEditService"));
    }

    public DungeonLayout loadLayout(long mapId) throws SQLException {
        try (Connection conn = connectionFactory.getConnection()) {
            return DungeonLayoutReadRepository.loadLayout(conn, mapId)
                    .orElseThrow(() -> new IllegalArgumentException("Unbekannte Dungeon-Map: " + mapId));
        }
    }

    public DungeonLayoutEditResult applyEdit(long mapId, DungeonEditorEditCommand command) throws SQLException {
        Objects.requireNonNull(command, "command");
        return mutate(conn -> applyEdit(conn, mapId, command));
    }

    private DungeonLayoutEditResult mutate(SqlEditWork work) throws SQLException {
        try (Connection conn = connectionFactory.getConnection()) {
            return DungeonTransactionSupport.inTransaction(conn, () -> {
                DungeonLayoutEditResult result = work.apply(conn);
                // Persisted layout and stored runtime location must commit as one invariant.
                DungeonRuntimeStateSupport.repairStoredRuntimeState(conn);
                return result;
            });
        }
    }

    @FunctionalInterface
    private interface SqlEditWork {
        DungeonLayoutEditResult apply(Connection conn) throws SQLException;
    }

    private DungeonLayoutEditResult applyEdit(Connection conn, long mapId, DungeonEditorEditCommand command) throws SQLException {
        DungeonEditCommandHandler<DungeonEditorEditCommand> handler = switch (command) {
            case DungeonEditorEditCommand.MoveCluster moveCluster -> roomEdits;
            case DungeonEditorEditCommand.PaintRoomCells paintRoomCells -> roomEdits;
            case DungeonEditorEditCommand.CreateGraphRoom createGraphRoom -> roomEdits;
            case DungeonEditorEditCommand.DeleteRoomsAtCells deleteRoomsAtCells -> roomEdits;
            case DungeonEditorEditCommand.DeleteGraphCluster deleteGraphCluster -> roomEdits;
            case DungeonEditorEditCommand.ApplyWallPath applyWallPath -> roomEdits;
            case DungeonEditorEditCommand.PaintClusterDoors paintClusterDoors -> roomEdits;
            case DungeonEditorEditCommand.DeleteClusterDoors deleteClusterDoors -> roomEdits;
            case DungeonEditorEditCommand.CreateCorridor createCorridor -> corridorEdits;
            case DungeonEditorEditCommand.AddRoomToCorridor addRoomToCorridor -> corridorEdits;
            case DungeonEditorEditCommand.MergeCorridors mergeCorridors -> corridorEdits;
            case DungeonEditorEditCommand.RemoveRoomFromCorridors removeRoomFromCorridors -> corridorEdits;
            case DungeonEditorEditCommand.DeleteCorridor deleteCorridor -> corridorEdits;
            case DungeonEditorEditCommand.MoveCorridorDoor moveCorridorDoor -> corridorDetailEdits;
            case DungeonEditorEditCommand.ResetCorridorDoor resetCorridorDoor -> corridorDetailEdits;
            case DungeonEditorEditCommand.AddCorridorWaypoint addCorridorWaypoint -> corridorDetailEdits;
            case DungeonEditorEditCommand.MoveCorridorWaypoint moveCorridorWaypoint -> corridorDetailEdits;
            case DungeonEditorEditCommand.DeleteCorridorWaypoint deleteCorridorWaypoint -> corridorDetailEdits;
        };
        return handler.execute(conn, mapId, command);
    }
}
