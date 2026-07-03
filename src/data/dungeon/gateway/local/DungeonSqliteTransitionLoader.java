package src.data.dungeon.gateway.local;

import src.data.dungeon.model.DungeonPersistenceSchema;
import src.data.dungeon.model.DungeonTransitionRecord;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

final class DungeonSqliteTransitionLoader {

    private static final String COLUMN_CELL_X = "cell_x";
    private static final String COLUMN_CELL_Y = "cell_y";
    private static final String SELECT_PREFIX =
            "SELECT transition_id, dungeon_map_id, description, cell_x, cell_y, level_z,";
    private static final String SELECT_SUFFIX =
            " destination_type,"
                    + " target_overworld_map_id, target_overworld_tile_id, target_dungeon_map_id,"
                    + " target_transition_id, linked_transition_id"
                    + " FROM " + DungeonPersistenceSchema.TRANSITIONS_TABLE
                    + " WHERE dungeon_map_id=? ORDER BY transition_id";
    private static final String SELECT_WITH_ANCHOR_COLUMNS =
            SELECT_PREFIX
                    + " anchor_type AS anchor_type, anchor_edge_direction AS anchor_edge_direction,"
                    + SELECT_SUFFIX;

    private DungeonSqliteTransitionLoader() {
    }

    static List<DungeonTransitionRecord> loadTransitions(Connection connection, long mapId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(SELECT_WITH_ANCHOR_COLUMNS)) {
            return loadTransitionRows(statement, mapId);
        }
    }

    private static List<DungeonTransitionRecord> loadTransitionRows(
            PreparedStatement statement,
            long mapId
    ) throws SQLException {
        statement.setLong(1, mapId);
        try (ResultSet resultSet = statement.executeQuery()) {
            List<DungeonTransitionRecord> records = new ArrayList<>();
            while (resultSet.next()) {
                records.add(new DungeonTransitionRecord(
                        resultSet.getLong("transition_id"),
                        resultSet.getLong("dungeon_map_id"),
                        resultSet.getString("description"),
                        DungeonSqliteStatementSupport.nullableInteger(resultSet, COLUMN_CELL_X),
                        DungeonSqliteStatementSupport.nullableInteger(resultSet, COLUMN_CELL_Y),
                        DungeonSqliteStatementSupport.nullableInteger(resultSet, "level_z"),
                        resultSet.getString("anchor_type"),
                        resultSet.getString("anchor_edge_direction"),
                        resultSet.getString("destination_type"),
                        DungeonSqliteStatementSupport.nullableLong(resultSet, "target_overworld_map_id"),
                        DungeonSqliteStatementSupport.nullableLong(resultSet, "target_overworld_tile_id"),
                        DungeonSqliteStatementSupport.nullableLong(resultSet, "target_dungeon_map_id"),
                        DungeonSqliteStatementSupport.nullableLong(resultSet, "target_transition_id"),
                        DungeonSqliteStatementSupport.nullableLong(resultSet, "linked_transition_id")));
            }
            return List.copyOf(records);
        }
    }
}
