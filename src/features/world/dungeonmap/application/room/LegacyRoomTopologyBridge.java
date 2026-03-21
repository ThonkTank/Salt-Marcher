package features.world.dungeonmap.application.room;

import database.DatabaseManager;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.quarantine.dungeonmap.foundation.db.DungeonTransactionSupport;
import features.world.quarantine.dungeonmap.rooms.application.DungeonRoomTopologyCoordinator;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;

public final class LegacyRoomTopologyBridge {

    private final DungeonRoomTopologyCoordinator roomTopologyCoordinator;

    public LegacyRoomTopologyBridge(DungeonRoomTopologyCoordinator roomTopologyCoordinator) {
        this.roomTopologyCoordinator = Objects.requireNonNull(roomTopologyCoordinator, "roomTopologyCoordinator");
    }

    public void paint(long mapId, TileShape shape) throws SQLException {
        execute(mapId, shape, false);
    }

    public void delete(long mapId, TileShape shape) throws SQLException {
        execute(mapId, shape, true);
    }

    private void execute(long mapId, TileShape shape, boolean deleteMode) throws SQLException {
        Set<features.world.quarantine.dungeonmap.foundation.geometry.Point2i> convertedCells = toQuarantineCells(
                shape == null ? Set.of() : shape.absoluteCells());
        if (convertedCells.isEmpty()) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionSupport.inTransaction(conn, () -> {
                if (deleteMode) {
                    roomTopologyCoordinator.deleteRoomsAtCells(conn, mapId, convertedCells);
                } else {
                    roomTopologyCoordinator.paintRoomCells(conn, mapId, convertedCells);
                }
                return null;
            });
        }
    }

    private static Set<features.world.quarantine.dungeonmap.foundation.geometry.Point2i> toQuarantineCells(Set<Point2i> cells) {
        Set<features.world.quarantine.dungeonmap.foundation.geometry.Point2i> result = new LinkedHashSet<>();
        for (Point2i cell : cells == null ? Set.<Point2i>of() : cells) {
            if (cell != null) {
                result.add(new features.world.quarantine.dungeonmap.foundation.geometry.Point2i(cell.x(), cell.y()));
            }
        }
        return Set.copyOf(result);
    }
}
