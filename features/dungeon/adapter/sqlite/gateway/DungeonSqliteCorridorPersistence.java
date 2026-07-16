package features.dungeon.adapter.sqlite.gateway;

import features.dungeon.adapter.sqlite.model.DungeonCorridorAnchorBindingRecord;
import features.dungeon.adapter.sqlite.model.DungeonCorridorAnchorRefRecord;
import features.dungeon.adapter.sqlite.model.DungeonCorridorDoorBindingRecord;
import features.dungeon.adapter.sqlite.model.DungeonCorridorRecord;
import features.dungeon.adapter.sqlite.model.DungeonCorridorWaypointRecord;
import features.dungeon.adapter.sqlite.model.DungeonMapRecord;
import features.dungeon.adapter.sqlite.model.DungeonPersistenceSchema;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.LinkedHashSet;
import java.util.Set;

final class DungeonSqliteCorridorPersistence {

    private static final String DELETE_FROM = "DELETE FROM ";
    private static final String INSERT_INTO = "INSERT INTO ";
    private static final String WHERE_CORRIDOR_ID = " WHERE corridor_id=?";

    private DungeonSqliteCorridorPersistence() {
    }

    static void persist(Connection connection, DungeonMapRecord record) throws SQLException {
        Set<Long> corridorIds = new LinkedHashSet<>();
        for (DungeonCorridorRecord corridor : record.corridors()) {
            corridorIds.add(corridor.corridorId());
            upsertCorridor(connection, corridor);
            replaceCorridorMembers(connection, corridor);
            replaceCorridorWaypoints(connection, corridor);
            replaceCorridorBindings(connection, corridor);
        }
        DungeonSqliteRetainedIdCleanup.deleteObsoleteCorridors(connection, record.mapId(), corridorIds);
    }

    private static void upsertCorridor(Connection connection, DungeonCorridorRecord corridor) throws SQLException {
        try (PreparedStatement update = connection.prepareStatement(
                "UPDATE " + DungeonPersistenceSchema.CORRIDORS_TABLE
                        + " SET level_z=? WHERE corridor_id=? AND dungeon_map_id=?")) {
            update.setInt(1, corridor.levelZ());
            update.setLong(2, corridor.corridorId());
            update.setLong(3, corridor.mapId());
            if (update.executeUpdate() > 0) {
                return;
            }
        }
        try (PreparedStatement insert = connection.prepareStatement(
                INSERT_INTO + DungeonPersistenceSchema.CORRIDORS_TABLE
                        + "(corridor_id, dungeon_map_id, level_z) VALUES(?,?,?)")) {
            insert.setLong(1, corridor.corridorId());
            insert.setLong(2, corridor.mapId());
            insert.setInt(3, corridor.levelZ());
            insert.executeUpdate();
        }
    }

    private static void replaceCorridorMembers(Connection connection, DungeonCorridorRecord corridor)
            throws SQLException {
        try (PreparedStatement delete = connection.prepareStatement(
                DELETE_FROM + DungeonPersistenceSchema.CORRIDOR_MEMBERS_TABLE + " WHERE corridor_id=?")) {
            delete.setLong(1, corridor.corridorId());
            delete.executeUpdate();
        }
        try (PreparedStatement insert = connection.prepareStatement(
                INSERT_INTO + DungeonPersistenceSchema.CORRIDOR_MEMBERS_TABLE
                        + "(corridor_id, room_id, member_order) VALUES(?,?,?)")) {
            int sortOrder = 0;
            for (Long roomId : corridor.roomIds()) {
                insert.setLong(1, corridor.corridorId());
                insert.setLong(2, roomId);
                insert.setInt(3, sortOrder);
                sortOrder++;
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    private static void replaceCorridorWaypoints(Connection connection, DungeonCorridorRecord corridor)
            throws SQLException {
        try (PreparedStatement delete = connection.prepareStatement(
                DELETE_FROM + DungeonPersistenceSchema.CORRIDOR_WAYPOINTS_TABLE + WHERE_CORRIDOR_ID)) {
            delete.setLong(1, corridor.corridorId());
            delete.executeUpdate();
        }
        try (PreparedStatement insert = connection.prepareStatement(
                INSERT_INTO + DungeonPersistenceSchema.CORRIDOR_WAYPOINTS_TABLE
                        + "(corridor_id, sort_order, cluster_id, relative_x, relative_y, relative_z)"
                        + " VALUES(?,?,?,?,?,?)")) {
            int sortOrder = 0;
            for (DungeonCorridorWaypointRecord waypoint : corridor.waypoints()) {
                insert.setLong(1, corridor.corridorId());
                insert.setInt(2, sortOrder);
                sortOrder++;
                insert.setLong(3, waypoint.clusterId());
                insert.setInt(4, waypoint.relativeX());
                insert.setInt(5, waypoint.relativeY());
                insert.setInt(6, waypoint.relativeZ());
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    private static void replaceCorridorBindings(Connection connection, DungeonCorridorRecord corridor)
            throws SQLException {
        replaceCorridorDoorBindings(connection, corridor);
        replaceCorridorAnchorBindings(connection, corridor);
        replaceCorridorAnchorRefs(connection, corridor);
    }

    private static void replaceCorridorDoorBindings(Connection connection, DungeonCorridorRecord corridor)
            throws SQLException {
        try (PreparedStatement delete = connection.prepareStatement(
                DELETE_FROM + DungeonPersistenceSchema.CORRIDOR_DOOR_OVERRIDES_TABLE + WHERE_CORRIDOR_ID)) {
            delete.setLong(1, corridor.corridorId());
            delete.executeUpdate();
        }
        try (PreparedStatement insert = connection.prepareStatement(
                INSERT_INTO + DungeonPersistenceSchema.CORRIDOR_DOOR_OVERRIDES_TABLE
                        + "(corridor_id, room_id, cluster_id, relative_cell_x, relative_cell_y,"
                        + " edge_direction, topology_element_id, sort_order)"
                        + " VALUES(?,?,?,?,?,?,?,?)")) {
            int sortOrder = 0;
            for (DungeonCorridorDoorBindingRecord binding : corridor.doorBindings()) {
                insert.setLong(1, corridor.corridorId());
                insert.setLong(2, binding.roomId());
                insert.setLong(3, binding.clusterId());
                insert.setInt(4, binding.relativeCellX());
                insert.setInt(5, binding.relativeCellY());
                insert.setString(6, binding.edgeDirection());
                DungeonSqliteStatementSupport.setNullableLong(insert, 7, binding.topologyElementId());
                insert.setInt(8, sortOrder);
                sortOrder++;
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    private static void replaceCorridorAnchorBindings(Connection connection, DungeonCorridorRecord corridor)
            throws SQLException {
        try (PreparedStatement delete = connection.prepareStatement(
                DELETE_FROM + DungeonPersistenceSchema.CORRIDOR_ANCHORS_TABLE + WHERE_CORRIDOR_ID)) {
            delete.setLong(1, corridor.corridorId());
            delete.executeUpdate();
        }
        try (PreparedStatement insert = connection.prepareStatement(
                INSERT_INTO + DungeonPersistenceSchema.CORRIDOR_ANCHORS_TABLE
                        + "(corridor_id, anchor_id, host_corridor_id, cell_x, cell_y, cell_z,"
                        + " topology_element_id, sort_order)"
                        + " VALUES(?,?,?,?,?,?,?,?)")) {
            int sortOrder = 0;
            for (DungeonCorridorAnchorBindingRecord binding : corridor.anchorBindings()) {
                insert.setLong(1, corridor.corridorId());
                insert.setLong(2, binding.anchorId());
                insert.setLong(3, binding.hostCorridorId());
                insert.setInt(4, binding.cellX());
                insert.setInt(5, binding.cellY());
                insert.setInt(6, binding.cellZ());
                DungeonSqliteStatementSupport.setNullableLong(insert, 7, binding.topologyElementId());
                insert.setInt(8, sortOrder);
                sortOrder++;
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    private static void replaceCorridorAnchorRefs(Connection connection, DungeonCorridorRecord corridor)
            throws SQLException {
        try (PreparedStatement delete = connection.prepareStatement(
                DELETE_FROM + DungeonPersistenceSchema.CORRIDOR_ANCHOR_REFS_TABLE + WHERE_CORRIDOR_ID)) {
            delete.setLong(1, corridor.corridorId());
            delete.executeUpdate();
        }
        try (PreparedStatement insert = connection.prepareStatement(
                INSERT_INTO + DungeonPersistenceSchema.CORRIDOR_ANCHOR_REFS_TABLE
                        + "(corridor_id, host_corridor_id, topology_element_id, sort_order)"
                        + " VALUES(?,?,?,?)")) {
            int sortOrder = 0;
            for (DungeonCorridorAnchorRefRecord ref : corridor.anchorRefs()) {
                insert.setLong(1, corridor.corridorId());
                insert.setLong(2, ref.hostCorridorId());
                DungeonSqliteStatementSupport.setNullableLong(insert, 3, ref.topologyElementId());
                insert.setInt(4, sortOrder);
                sortOrder++;
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }
}
