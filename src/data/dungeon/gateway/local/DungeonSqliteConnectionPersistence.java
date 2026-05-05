package src.data.dungeon.gateway.local;

import src.data.dungeon.model.DungeonCorridorAnchorBindingRecord;
import src.data.dungeon.model.DungeonCorridorAnchorRefRecord;
import src.data.dungeon.model.DungeonCorridorDoorBindingRecord;
import src.data.dungeon.model.DungeonCorridorRecord;
import src.data.dungeon.model.DungeonCorridorWaypointRecord;
import src.data.dungeon.model.DungeonMapRecord;
import src.data.dungeon.model.DungeonPersistenceSchema;
import src.data.dungeon.model.DungeonStairExitRecord;
import src.data.dungeon.model.DungeonStairPathNodeRecord;
import src.data.dungeon.model.DungeonStairRecord;
import src.data.dungeon.model.DungeonTransitionRecord;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.LinkedHashSet;
import java.util.Set;

final class DungeonSqliteConnectionPersistence {

    private static final String DELETE_FROM = "DELETE FROM ";
    private static final String INSERT_INTO = "INSERT INTO ";
    private static final String WHERE_CORRIDOR_ID = " WHERE corridor_id=?";
    private static final String WHERE_STAIR_ID = " WHERE stair_id=?";
    private static final String INSERT_STAIR_EXIT_WITH_ID_SQL =
            "INSERT INTO " + DungeonPersistenceSchema.STAIR_EXITS_TABLE
                    + "(stair_exit_id, stair_id, cell_x, cell_y, cell_z, label) VALUES(?,?,?,?,?,?)";
    private static final String INSERT_STAIR_EXIT_SQL =
            "INSERT INTO " + DungeonPersistenceSchema.STAIR_EXITS_TABLE
                    + "(stair_id, cell_x, cell_y, cell_z, label) VALUES(?,?,?,?,?)";

    private DungeonSqliteConnectionPersistence() {
    }

    static void persist(Connection connection, DungeonMapRecord record) throws SQLException {
        persistCorridors(connection, record);
        persistStairs(connection, record);
        persistTransitions(connection, record);
    }

    private static void persistCorridors(Connection connection, DungeonMapRecord record) throws SQLException {
        Set<Long> corridorIds = new LinkedHashSet<>();
        for (DungeonCorridorRecord corridor : record.corridors()) {
            corridorIds.add(corridor.corridorId());
            upsertCorridor(connection, corridor);
            replaceCorridorMembers(connection, corridor);
            replaceCorridorWaypoints(connection, corridor);
            replaceCorridorDoorBindings(connection, corridor);
            replaceCorridorAnchorBindings(connection, corridor);
            replaceCorridorAnchorRefs(connection, corridor);
        }
        DungeonSqliteStatementSupport.deleteObsoleteCorridors(connection, record.mapId(), corridorIds);
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
                "INSERT INTO " + DungeonPersistenceSchema.CORRIDORS_TABLE
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
                "DELETE FROM " + DungeonPersistenceSchema.CORRIDOR_MEMBERS_TABLE + " WHERE corridor_id=?")) {
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

    private static void persistStairs(Connection connection, DungeonMapRecord record) throws SQLException {
        Set<Long> stairIds = new LinkedHashSet<>();
        for (DungeonStairRecord stair : record.stairs()) {
            stairIds.add(stair.stairId());
            upsertStair(connection, stair);
            replaceStairPathNodes(connection, stair);
            replaceStairExits(connection, stair);
        }
        DungeonSqliteStatementSupport.deleteObsoleteStairs(connection, record.mapId(), stairIds);
    }

    private static void upsertStair(Connection connection, DungeonStairRecord stair) throws SQLException {
        try (PreparedStatement update = connection.prepareStatement(
                "UPDATE " + DungeonPersistenceSchema.STAIRS_TABLE
                        + " SET name=?, shape=?, direction=?, dimension1=?, dimension2=?, corridor_id=?"
                        + " WHERE stair_id=? AND dungeon_map_id=?")) {
            update.setString(1, stair.name());
            update.setString(2, stair.shape());
            update.setInt(3, stair.direction());
            update.setInt(4, stair.dimension1());
            update.setInt(5, stair.dimension2());
            DungeonSqliteStatementSupport.setNullableLong(update, 6, stair.corridorId());
            update.setLong(7, stair.stairId());
            update.setLong(8, stair.mapId());
            if (update.executeUpdate() > 0) {
                return;
            }
        }
        try (PreparedStatement insert = connection.prepareStatement(
                "INSERT INTO " + DungeonPersistenceSchema.STAIRS_TABLE
                        + "(stair_id, dungeon_map_id, name, shape, direction, dimension1, dimension2, corridor_id)"
                        + " VALUES(?,?,?,?,?,?,?,?)")) {
            insert.setLong(1, stair.stairId());
            insert.setLong(2, stair.mapId());
            insert.setString(3, stair.name());
            insert.setString(4, stair.shape());
            insert.setInt(5, stair.direction());
            insert.setInt(6, stair.dimension1());
            insert.setInt(7, stair.dimension2());
            DungeonSqliteStatementSupport.setNullableLong(insert, 8, stair.corridorId());
            insert.executeUpdate();
        }
    }

    private static void replaceStairPathNodes(Connection connection, DungeonStairRecord stair) throws SQLException {
        try (PreparedStatement delete = connection.prepareStatement(
                DELETE_FROM + DungeonPersistenceSchema.STAIR_PATH_NODES_TABLE + WHERE_STAIR_ID)) {
            delete.setLong(1, stair.stairId());
            delete.executeUpdate();
        }
        try (PreparedStatement insert = connection.prepareStatement(
                INSERT_INTO + DungeonPersistenceSchema.STAIR_PATH_NODES_TABLE
                        + "(stair_id, sort_order, cell_x, cell_y, cell_z) VALUES(?,?,?,?,?)")) {
            int sortOrder = 0;
            for (DungeonStairPathNodeRecord node : stair.pathNodes()) {
                insert.setLong(1, stair.stairId());
                insert.setInt(2, sortOrder);
                sortOrder++;
                insert.setInt(3, node.cellX());
                insert.setInt(4, node.cellY());
                insert.setInt(5, node.cellZ());
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    private static void replaceStairExits(Connection connection, DungeonStairRecord stair) throws SQLException {
        try (PreparedStatement delete = connection.prepareStatement(
                DELETE_FROM + DungeonPersistenceSchema.STAIR_EXITS_TABLE + WHERE_STAIR_ID)) {
            delete.setLong(1, stair.stairId());
            delete.executeUpdate();
        }
        for (DungeonStairExitRecord exit : stair.exits()) {
            insertStairExit(connection, stair.stairId(), exit);
        }
    }

    private static void insertStairExit(
            Connection connection,
            long stairId,
            DungeonStairExitRecord exit
    ) throws SQLException {
        if (hasExplicitExitId(exit)) {
            insertStairExitWithId(connection, stairId, exit);
            return;
        }
        insertGeneratedStairExit(connection, stairId, exit);
    }

    private static void persistTransitions(Connection connection, DungeonMapRecord record) throws SQLException {
        Set<Long> transitionIds = new LinkedHashSet<>();
        for (DungeonTransitionRecord transition : record.transitions()) {
            transitionIds.add(transition.transitionId());
            upsertTransition(connection, transition);
        }
        DungeonSqliteStatementSupport.deleteObsoleteTransitions(connection, record.mapId(), transitionIds);
    }

    private static void upsertTransition(Connection connection, DungeonTransitionRecord transition) throws SQLException {
        try (PreparedStatement update = connection.prepareStatement(
                "UPDATE " + DungeonPersistenceSchema.TRANSITIONS_TABLE
                        + " SET description=?, cell_x=?, cell_y=?, level_z=?, destination_type=?,"
                        + " target_overworld_map_id=?, target_overworld_tile_id=?, target_dungeon_map_id=?,"
                        + " target_transition_id=?, linked_transition_id=?"
                        + " WHERE transition_id=? AND dungeon_map_id=?")) {
            bindTransition(update, transition, false);
            if (update.executeUpdate() > 0) {
                return;
            }
        }
        try (PreparedStatement insert = connection.prepareStatement(
                "INSERT INTO " + DungeonPersistenceSchema.TRANSITIONS_TABLE
                        + "(transition_id, dungeon_map_id, description, cell_x, cell_y, level_z,"
                        + " destination_type, target_overworld_map_id, target_overworld_tile_id,"
                        + " target_dungeon_map_id, target_transition_id, linked_transition_id)"
                        + " VALUES(?,?,?,?,?,?,?,?,?,?,?,?)")) {
            bindTransition(insert, transition, true);
            insert.executeUpdate();
        }
    }

    private static void bindTransition(
            PreparedStatement statement,
            DungeonTransitionRecord transition,
            boolean insert
    ) throws SQLException {
        int index = 1;
        if (insert) {
            statement.setLong(index, transition.transitionId());
            index++;
            statement.setLong(index, transition.mapId());
            index++;
        }
        statement.setString(index, transition.description());
        index++;
        DungeonSqliteStatementSupport.setNullableInteger(statement, index, transition.cellX());
        index++;
        DungeonSqliteStatementSupport.setNullableInteger(statement, index, transition.cellY());
        index++;
        DungeonSqliteStatementSupport.setNullableInteger(statement, index, transition.levelZ());
        index++;
        statement.setString(index, transition.destinationType());
        index++;
        DungeonSqliteStatementSupport.setNullableLong(statement, index, transition.targetOverworldMapId());
        index++;
        DungeonSqliteStatementSupport.setNullableLong(statement, index, transition.targetOverworldTileId());
        index++;
        DungeonSqliteStatementSupport.setNullableLong(statement, index, transition.targetDungeonMapId());
        index++;
        DungeonSqliteStatementSupport.setNullableLong(statement, index, transition.targetTransitionId());
        index++;
        DungeonSqliteStatementSupport.setNullableLong(statement, index, transition.linkedTransitionId());
        index++;
        if (!insert) {
            statement.setLong(index, transition.transitionId());
            index++;
            statement.setLong(index, transition.mapId());
        }
    }

    private static boolean hasExplicitExitId(DungeonStairExitRecord exit) {
        return exit.exitId() > 0L;
    }

    private static void insertStairExitWithId(Connection connection, long stairId, DungeonStairExitRecord exit)
            throws SQLException {
        try (PreparedStatement insert = connection.prepareStatement(INSERT_STAIR_EXIT_WITH_ID_SQL)) {
            insert.setLong(1, exit.exitId());
            insert.setLong(2, stairId);
            insert.setInt(3, exit.cellX());
            insert.setInt(4, exit.cellY());
            insert.setInt(5, exit.cellZ());
            insert.setString(6, exit.label());
            insert.executeUpdate();
        }
    }

    private static void insertGeneratedStairExit(Connection connection, long stairId, DungeonStairExitRecord exit)
            throws SQLException {
        try (PreparedStatement insert = connection.prepareStatement(INSERT_STAIR_EXIT_SQL)) {
            insert.setLong(1, stairId);
            insert.setInt(2, exit.cellX());
            insert.setInt(3, exit.cellY());
            insert.setInt(4, exit.cellZ());
            insert.setString(5, exit.label());
            insert.executeUpdate();
        }
    }

}
