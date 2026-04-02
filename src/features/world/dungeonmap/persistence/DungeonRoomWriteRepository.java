package features.world.dungeonmap.persistence;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.objects.StructureDescriptor;
import features.world.dungeonmap.model.structures.room.RoomExitNarration;
import features.world.dungeonmap.model.structures.room.RoomNarration;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

public final class DungeonRoomWriteRepository {

    public long insertCluster(Connection conn, long mapId, CellCoord center, int levelZ) throws SQLException {
        CellCoord resolvedCenter = center == null ? new CellCoord(0, 0) : center;
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_room_clusters(dungeon_map_id, center_x, center_y, level_z) VALUES(?,?,?,?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, mapId);
            ps.setInt(2, resolvedCenter.x());
            ps.setInt(3, resolvedCenter.y());
            ps.setInt(4, levelZ);
            ps.executeUpdate();
            try (ResultSet rs = ps.getGeneratedKeys()) {
                if (!rs.next()) {
                    throw new SQLException("No key returned for dungeon_room_clusters insert");
                }
                return rs.getLong(1);
            }
        }
    }

    public void updateClusterMetadata(Connection conn, long clusterId, CellCoord center, int levelZ) throws SQLException {
        CellCoord resolvedCenter = center == null ? new CellCoord(0, 0) : center;
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_room_clusters SET center_x=?, center_y=?, level_z=? WHERE cluster_id=?")) {
            ps.setInt(1, resolvedCenter.x());
            ps.setInt(2, resolvedCenter.y());
            ps.setInt(3, levelZ);
            ps.setLong(4, clusterId);
            ps.executeUpdate();
        }
    }

    public void deleteCluster(Connection conn, long clusterId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_room_clusters WHERE cluster_id=?")) {
            ps.setLong(1, clusterId);
            ps.executeUpdate();
        }
    }

    public long insertRoom(
            Connection conn,
            long mapId,
            long clusterId,
            String name,
            StructureDescriptor descriptor
    ) throws SQLException {
        StructureDescriptor resolvedDescriptor = requiredDescriptor(descriptor);
        int primaryLevel = primaryLevel(resolvedDescriptor);
        CellCoord primaryAnchor = primaryAnchorCell(resolvedDescriptor);
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_rooms(dungeon_map_id, cluster_id, name, component_x, component_y, level_z) VALUES(?,?,?,?,?,?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, mapId);
            ps.setLong(2, clusterId);
            ps.setString(3, name);
            ps.setInt(4, primaryAnchor.x());
            ps.setInt(5, primaryAnchor.y());
            ps.setInt(6, primaryLevel);
            ps.executeUpdate();
            try (ResultSet rs = ps.getGeneratedKeys()) {
                if (!rs.next()) {
                    throw new SQLException("No key returned for dungeon_rooms insert");
                }
                long roomId = rs.getLong(1);
                replaceRoomDescriptor(conn, roomId, resolvedDescriptor);
                return roomId;
            }
        }
    }

    public void updateRoom(
            Connection conn,
            long roomId,
            String name,
            StructureDescriptor descriptor
    ) throws SQLException {
        StructureDescriptor resolvedDescriptor = requiredDescriptor(descriptor);
        int primaryLevel = primaryLevel(resolvedDescriptor);
        CellCoord primaryAnchor = primaryAnchorCell(resolvedDescriptor);
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_rooms SET name=?, component_x=?, component_y=?, level_z=? WHERE room_id=?")) {
            ps.setString(1, name);
            ps.setInt(2, primaryAnchor.x());
            ps.setInt(3, primaryAnchor.y());
            ps.setInt(4, primaryLevel);
            ps.setLong(5, roomId);
            ps.executeUpdate();
        }
        replaceRoomDescriptor(conn, roomId, resolvedDescriptor);
    }

    public void replaceRoomNarration(Connection conn, long roomId, RoomNarration narration) throws SQLException {
        RoomNarration resolvedNarration = narration == null ? RoomNarration.empty() : narration;
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_rooms SET visual_description=? WHERE room_id=?")) {
            ps.setString(1, resolvedNarration.visualDescription());
            ps.setLong(2, roomId);
            ps.executeUpdate();
        }
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_room_exit_descriptions WHERE room_id=?")) {
            delete.setLong(1, roomId);
            delete.executeUpdate();
        }
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_room_exit_descriptions(room_id, level_z, cell_x, cell_y, edge_direction, description, sort_order)"
                        + " VALUES(?,?,?,?,?,?,?)")) {
            int sortOrder = 0;
            for (RoomExitNarration exitNarration : resolvedNarration.exitNarrations()) {
                insert.setLong(1, roomId);
                insert.setInt(2, exitNarration.levelZ());
                insert.setInt(3, exitNarration.roomCell().x());
                insert.setInt(4, exitNarration.roomCell().y());
                insert.setString(5, DungeonPersistenceDirections.toPersistedEdgeDirection(exitNarration.direction()));
                insert.setString(6, exitNarration.description());
                insert.setInt(7, sortOrder++);
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    public void reassignRoomCluster(Connection conn, long roomId, long clusterId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_rooms SET cluster_id=? WHERE room_id=?")) {
            ps.setLong(1, clusterId);
            ps.setLong(2, roomId);
            ps.executeUpdate();
        }
    }

    public void deleteRoom(Connection conn, long roomId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_rooms WHERE room_id=?")) {
            ps.setLong(1, roomId);
            ps.executeUpdate();
        }
    }

    public void replaceRoomDescriptor(Connection conn, long roomId, StructureDescriptor descriptor) throws SQLException {
        StructureDescriptor resolvedDescriptor = requiredDescriptor(descriptor);
        try (PreparedStatement deleteSegments = conn.prepareStatement(
                "DELETE FROM dungeon_room_level_segments WHERE room_id=?");
             PreparedStatement deleteSeeds = conn.prepareStatement(
                     "DELETE FROM dungeon_room_level_seeds WHERE room_id=?");
             PreparedStatement deleteLevels = conn.prepareStatement(
                     "DELETE FROM dungeon_room_levels WHERE room_id=?")) {
            deleteSegments.setLong(1, roomId);
            deleteSegments.executeUpdate();
            deleteSeeds.setLong(1, roomId);
            deleteSeeds.executeUpdate();
            deleteLevels.setLong(1, roomId);
            deleteLevels.executeUpdate();
        }
        try (PreparedStatement insertLevel = conn.prepareStatement(
                "INSERT INTO dungeon_room_levels(room_id, level_z, anchor_x2, anchor_y2) VALUES(?,?,?,?)");
             PreparedStatement insertSeed = conn.prepareStatement(
                     "INSERT INTO dungeon_room_level_seeds(room_id, level_z, seed_x2, seed_y2) VALUES(?,?,?,?)");
            PreparedStatement insertSegment = conn.prepareStatement(
                     "INSERT INTO dungeon_room_level_segments("
                             + "room_id, level_z, segment_kind, start_x2, start_y2, end_x2, end_y2"
                             + ") VALUES(?,?,?,?,?,?,?)")) {
            for (var entry : resolvedDescriptor.levels().entrySet()) {
                int levelZ = entry.getKey();
                StructureDescriptor.LevelDescriptor level = entry.getValue();
                insertLevel.setLong(1, roomId);
                insertLevel.setInt(2, levelZ);
                insertLevel.setInt(3, persistedCellX2(level.anchorCell()));
                insertLevel.setInt(4, persistedCellY2(level.anchorCell()));
                insertLevel.addBatch();
                for (CellCoord seed : level.fillSeeds().stream()
                        .sorted(CellCoord.ORDER)
                        .toList()) {
                    insertSeed.setLong(1, roomId);
                    insertSeed.setInt(2, levelZ);
                    insertSeed.setInt(3, persistedCellX2(seed));
                    insertSeed.setInt(4, persistedCellY2(seed));
                    insertSeed.addBatch();
                }
                addSegments(insertSegment, roomId, levelZ, "BOUNDARY", level.boundaryEdges());
                addSegments(insertSegment, roomId, levelZ, "OPENING", level.openingEdges());
            }
            insertLevel.executeBatch();
            insertSeed.executeBatch();
            insertSegment.executeBatch();
        }
    }

    private static void addSegments(
            PreparedStatement insertSegment,
            long roomId,
            int levelZ,
            String kind,
            java.util.Collection<GridSegment2x> segments
    ) throws SQLException {
        for (GridSegment2x persistedSegment : GridSegment2x.boundarySteps(segments).stream()
                .sorted(GridSegment2x.ORDER)
                .toList()) {
            insertSegment.setLong(1, roomId);
            insertSegment.setInt(2, levelZ);
            insertSegment.setString(3, kind);
            insertSegment.setInt(4, persistedSegment.start().x2());
            insertSegment.setInt(5, persistedSegment.start().y2());
            insertSegment.setInt(6, persistedSegment.end().x2());
            insertSegment.setInt(7, persistedSegment.end().y2());
            insertSegment.addBatch();
        }
    }

    private static StructureDescriptor requiredDescriptor(StructureDescriptor descriptor) {
        StructureDescriptor resolvedDescriptor = descriptor == null ? StructureDescriptor.empty() : descriptor;
        if (resolvedDescriptor.levels().isEmpty()) {
            throw new IllegalArgumentException("Room descriptor must not be empty");
        }
        return resolvedDescriptor;
    }

    private static int primaryLevel(StructureDescriptor descriptor) {
        return descriptor.levels().keySet().stream()
                .mapToInt(Integer::intValue)
                .min()
                .orElse(0);
    }

    private static CellCoord primaryAnchorCell(StructureDescriptor descriptor) {
        StructureDescriptor.LevelDescriptor level = descriptor.level(primaryLevel(descriptor));
        if (level == null) {
            return new CellCoord(0, 0);
        }
        return level.anchorCell();
    }

    private static int persistedCellX2(CellCoord cell) {
        CellCoord resolvedCell = cell == null ? new CellCoord(0, 0) : cell;
        return GridPoint2x.cell(resolvedCell).x2();
    }

    private static int persistedCellY2(CellCoord cell) {
        CellCoord resolvedCell = cell == null ? new CellCoord(0, 0) : cell;
        return GridPoint2x.cell(resolvedCell).y2();
    }

}
