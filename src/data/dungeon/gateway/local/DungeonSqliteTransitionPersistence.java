package src.data.dungeon.gateway.local;

import src.data.dungeon.model.DungeonMapRecord;
import src.data.dungeon.model.DungeonPersistenceSchema;
import src.data.dungeon.model.DungeonTransitionRecord;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.LinkedHashSet;
import java.util.Set;

final class DungeonSqliteTransitionPersistence {

    private static final String INSERT_INTO = "INSERT INTO ";

    private DungeonSqliteTransitionPersistence() {
    }

    static void persist(Connection connection, DungeonMapRecord record) throws SQLException {
        Set<Long> transitionIds = new LinkedHashSet<>();
        for (DungeonTransitionRecord transition : record.transitions()) {
            transitionIds.add(transition.transitionId());
            upsertTransition(connection, transition);
        }
        DungeonSqliteRetainedIdCleanup.deleteObsoleteTransitions(connection, record.mapId(), transitionIds);
    }

    private static void upsertTransition(Connection connection, DungeonTransitionRecord transition) throws SQLException {
        try (PreparedStatement update = connection.prepareStatement(
                "UPDATE " + DungeonPersistenceSchema.TRANSITIONS_TABLE
                        + " SET description=?, cell_x=?, cell_y=?, level_z=?, anchor_type=?,"
                        + " anchor_edge_direction=?, destination_type=?,"
                        + " target_overworld_map_id=?, target_overworld_tile_id=?, target_dungeon_map_id=?,"
                        + " target_transition_id=?, linked_transition_id=?"
                        + " WHERE transition_id=? AND dungeon_map_id=?")) {
            bindTransition(update, transition, false);
            if (update.executeUpdate() > 0) {
                return;
            }
        }
        try (PreparedStatement insert = connection.prepareStatement(
                INSERT_INTO + DungeonPersistenceSchema.TRANSITIONS_TABLE
                        + "(transition_id, dungeon_map_id, description, cell_x, cell_y, level_z,"
                        + " anchor_type, anchor_edge_direction, destination_type,"
                        + " target_overworld_map_id, target_overworld_tile_id,"
                        + " target_dungeon_map_id, target_transition_id, linked_transition_id)"
                        + " VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)")) {
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
        statement.setString(index, transition.anchorType());
        index++;
        statement.setString(index, transition.anchorEdgeDirection());
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
}
