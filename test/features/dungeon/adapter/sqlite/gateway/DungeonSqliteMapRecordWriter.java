package features.dungeon.adapter.sqlite.gateway;

import features.dungeon.adapter.sqlite.model.DungeonMapRecord;
import features.dungeon.adapter.sqlite.model.DungeonPersistenceSchema;
import features.dungeon.adapter.sqlite.model.DungeonRoomClusterRecord;
import features.dungeon.adapter.sqlite.model.DungeonRoomCellRecord;
import features.dungeon.adapter.sqlite.model.DungeonRoomExitDescriptionRecord;
import features.dungeon.adapter.sqlite.model.DungeonRoomRecord;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.LinkedHashSet;
import java.util.Set;

final class DungeonSqliteMapRecordWriter {

    private static final String INSERT_INTO = "INSERT INTO ";
    private static final String DELETE_FROM = "DELETE FROM ";
    private static final String SQL_WHERE = " WHERE ";

    private DungeonSqliteMapRecordWriter() {
    }

    static void persist(Connection connection, DungeonMapRecord record) throws SQLException {
        upsertMap(connection, record);
        persistAuthoredGeometry(connection, record);
        DungeonSqliteChunkWriter.replaceChunkInventory(connection, record);
    }

    static void deleteMap(Connection connection, long mapId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                DELETE_FROM + DungeonPersistenceSchema.MAPS_TABLE + SQL_WHERE + "dungeon_map_id=?")) {
            statement.setLong(1, mapId);
            statement.executeUpdate();
        }
    }

    private static void upsertMap(Connection connection, DungeonMapRecord record) throws SQLException {
        try (PreparedStatement update = connection.prepareStatement(
                "UPDATE " + DungeonPersistenceSchema.MAPS_TABLE
                        + " SET name=?, revision=?" + SQL_WHERE
                        + "dungeon_map_id=? AND revision=?")) {
            update.setString(1, record.name());
            update.setLong(2, record.revision());
            update.setLong(3, record.mapId());
            update.setLong(4, record.revision() - 1L);
            if (update.executeUpdate() > 0) {
                return;
            }
        }
        if (mapExists(connection, record.mapId())) {
            throw new SQLException(
                    "Dungeon map revision mismatch for map " + record.mapId()
                            + "; expected " + (record.revision() - 1L));
        }
        try (PreparedStatement insert = connection.prepareStatement(
                INSERT_INTO + DungeonPersistenceSchema.MAPS_TABLE
                        + "(dungeon_map_id, name, revision) VALUES(?,?,?)")) {
            insert.setLong(1, record.mapId());
            insert.setString(2, record.name());
            insert.setLong(3, record.revision());
            insert.executeUpdate();
        }
    }

    private static boolean mapExists(Connection connection, long mapId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT 1 FROM " + DungeonPersistenceSchema.MAPS_TABLE
                        + SQL_WHERE + "dungeon_map_id=?")) {
            statement.setLong(1, mapId);
            try (var resultSet = statement.executeQuery()) {
                return resultSet.next();
            }
        }
    }

    private static void persistAuthoredGeometry(Connection connection, DungeonMapRecord record) throws SQLException {
        Set<Long> clusterIds = new LinkedHashSet<>();
        for (DungeonRoomClusterRecord cluster : record.roomClusters()) {
            clusterIds.add(cluster.clusterId());
            DungeonSqliteClusterGeometryWriter.persist(connection, cluster);
        }
        Set<Long> roomIds = new LinkedHashSet<>();
        for (DungeonRoomRecord room : record.rooms()) {
            roomIds.add(room.roomId());
            upsertRoom(connection, room);
            replaceRoomCells(connection, room);
            replaceRoomExitDescriptions(connection, room);
        }
        DungeonSqliteRetainedIdCleanup.deleteObsoleteRooms(connection, record.mapId(), roomIds);
        DungeonSqliteRetainedIdCleanup.deleteObsoleteRoomClusters(connection, record.mapId(), clusterIds);
    }

    private static void upsertRoom(Connection connection, DungeonRoomRecord room) throws SQLException {
        try (PreparedStatement update = connection.prepareStatement(
                "UPDATE " + DungeonPersistenceSchema.ROOMS_TABLE
                        + " SET cluster_id=?, name=?, visual_description=?"
                        + SQL_WHERE + "room_id=? AND dungeon_map_id=?")) {
            update.setLong(1, room.clusterId());
            update.setString(2, room.name());
            update.setString(3, room.visualDescription());
            update.setLong(4, room.roomId());
            update.setLong(5, room.mapId());
            if (update.executeUpdate() > 0) {
                return;
            }
        }
        try (PreparedStatement insert = connection.prepareStatement(
                INSERT_INTO + DungeonPersistenceSchema.ROOMS_TABLE
                        + "(room_id, dungeon_map_id, cluster_id, name, visual_description)"
                        + " VALUES(?,?,?,?,?)")) {
            insert.setLong(1, room.roomId());
            insert.setLong(2, room.mapId());
            insert.setLong(3, room.clusterId());
            insert.setString(4, room.name());
            insert.setString(5, room.visualDescription());
            insert.executeUpdate();
        }
    }

    private static void replaceRoomCells(Connection connection, DungeonRoomRecord room) throws SQLException {
        try (PreparedStatement delete = connection.prepareStatement(
                DELETE_FROM + DungeonPersistenceSchema.ROOM_CELLS_TABLE + SQL_WHERE + "room_id=?")) {
            delete.setLong(1, room.roomId());
            delete.executeUpdate();
        }
        try (PreparedStatement insert = connection.prepareStatement(
                INSERT_INTO + DungeonPersistenceSchema.ROOM_CELLS_TABLE
                        + "(room_id, level_z, cell_x, cell_y) VALUES(?,?,?,?)")) {
            for (DungeonRoomCellRecord floor : room.floorCells()) {
                insert.setLong(1, room.roomId());
                insert.setInt(2, floor.levelZ());
                insert.setInt(3, floor.cellX());
                insert.setInt(4, floor.cellY());
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    private static void replaceRoomExitDescriptions(Connection connection, DungeonRoomRecord room) throws SQLException {
        try (PreparedStatement delete = connection.prepareStatement(
                DELETE_FROM + DungeonPersistenceSchema.ROOM_EXIT_DESCRIPTIONS_TABLE + SQL_WHERE + "room_id=?")) {
            delete.setLong(1, room.roomId());
            delete.executeUpdate();
        }
        try (PreparedStatement insert = connection.prepareStatement(
                INSERT_INTO + DungeonPersistenceSchema.ROOM_EXIT_DESCRIPTIONS_TABLE
                        + "(room_id, level_z, cell_x, cell_y, edge_direction, description, sort_order)"
                        + " VALUES(?,?,?,?,?,?,?)")) {
            int sortOrder = 0;
            for (DungeonRoomExitDescriptionRecord exitDescription : room.exitDescriptions()) {
                insert.setLong(1, room.roomId());
                insert.setInt(2, exitDescription.levelZ());
                insert.setInt(3, exitDescription.cellX());
                insert.setInt(4, exitDescription.cellY());
                insert.setString(5, exitDescription.edgeDirection());
                insert.setString(6, exitDescription.description());
                insert.setInt(7, sortOrder);
                sortOrder++;
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }
}
