package src.data.dungeon.gateway.local;

import src.data.dungeon.model.DungeonMapRecord;
import src.data.dungeon.model.DungeonPersistenceSchema;
import src.data.dungeon.model.DungeonRoomClusterRecord;
import src.data.dungeon.model.DungeonRoomExitDescriptionRecord;
import src.data.dungeon.model.DungeonRoomFloorRecord;
import src.data.dungeon.model.DungeonRoomRecord;

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
                "UPDATE " + DungeonPersistenceSchema.MAPS_TABLE + " SET name=?" + SQL_WHERE + "dungeon_map_id=?")) {
            update.setString(1, record.name());
            update.setLong(2, record.mapId());
            if (update.executeUpdate() > 0) {
                return;
            }
        }
        try (PreparedStatement insert = connection.prepareStatement(
                INSERT_INTO + DungeonPersistenceSchema.MAPS_TABLE + "(dungeon_map_id, name) VALUES(?,?)")) {
            insert.setLong(1, record.mapId());
            insert.setString(2, record.name());
            insert.executeUpdate();
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
            upsertRoomPosition(connection, room);
            replaceRoomFloors(connection, room);
            replaceRoomExitDescriptions(connection, room);
        }
        DungeonSqliteRetainedIdCleanup.deleteObsoleteRooms(connection, record.mapId(), roomIds);
        DungeonSqliteRetainedIdCleanup.deleteObsoleteRoomClusters(connection, record.mapId(), clusterIds);
    }

    private static void upsertRoomPosition(Connection connection, DungeonRoomRecord room) throws SQLException {
        try (PreparedStatement update = connection.prepareStatement(
                "UPDATE " + DungeonPersistenceSchema.ROOMS_TABLE
                        + " SET cluster_id=?, name=?, visual_description=?, component_x=?, component_y=?, level_z=?"
                        + SQL_WHERE + "room_id=? AND dungeon_map_id=?")) {
            update.setLong(1, room.clusterId());
            update.setString(2, room.name());
            update.setString(3, room.visualDescription());
            update.setInt(4, room.componentX());
            update.setInt(5, room.componentY());
            update.setInt(6, room.levelZ());
            update.setLong(7, room.roomId());
            update.setLong(8, room.mapId());
            if (update.executeUpdate() > 0) {
                return;
            }
        }
        try (PreparedStatement insert = connection.prepareStatement(
                INSERT_INTO + DungeonPersistenceSchema.ROOMS_TABLE
                        + "(room_id, dungeon_map_id, cluster_id, name, visual_description, component_x, component_y, level_z)"
                        + " VALUES(?,?,?,?,?,?,?,?)")) {
            insert.setLong(1, room.roomId());
            insert.setLong(2, room.mapId());
            insert.setLong(3, room.clusterId());
            insert.setString(4, room.name());
            insert.setString(5, room.visualDescription());
            insert.setInt(6, room.componentX());
            insert.setInt(7, room.componentY());
            insert.setInt(8, room.levelZ());
            insert.executeUpdate();
        }
    }

    private static void replaceRoomFloors(Connection connection, DungeonRoomRecord room) throws SQLException {
        try (PreparedStatement delete = connection.prepareStatement(
                DELETE_FROM + DungeonPersistenceSchema.ROOM_FLOORS_TABLE + SQL_WHERE + "room_id=?")) {
            delete.setLong(1, room.roomId());
            delete.executeUpdate();
        }
        try (PreparedStatement insert = connection.prepareStatement(
                INSERT_INTO + DungeonPersistenceSchema.ROOM_FLOORS_TABLE
                        + "(room_id, level_z, anchor_x, anchor_y) VALUES(?,?,?,?)")) {
            for (DungeonRoomFloorRecord floor : room.floors()) {
                insert.setLong(1, room.roomId());
                insert.setInt(2, floor.levelZ());
                insert.setInt(3, floor.anchorX());
                insert.setInt(4, floor.anchorY());
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
                        + "(room_id, cell_x, cell_y, edge_direction, description, sort_order)"
                        + " VALUES(?,?,?,?,?,?)")) {
            int sortOrder = 0;
            for (DungeonRoomExitDescriptionRecord exitDescription : room.exitDescriptions()) {
                insert.setLong(1, room.roomId());
                insert.setInt(2, exitDescription.cellX());
                insert.setInt(3, exitDescription.cellY());
                insert.setString(4, exitDescription.edgeDirection());
                insert.setString(5, exitDescription.description());
                insert.setInt(6, sortOrder);
                sortOrder++;
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }
}
