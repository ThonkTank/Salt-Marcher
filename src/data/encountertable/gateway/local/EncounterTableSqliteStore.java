package src.data.encountertable.gateway.local;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.data.encountertable.model.EncounterTableCandidateRecord;
import src.data.encountertable.model.EncounterTablePersistenceSchema;
import src.data.encountertable.model.EncounterTableSummaryRecord;

final class EncounterTableSqliteStore {

    private static final String TEMP_SELECTED_TABLE_IDS = "sm_temp_selected_encounter_table_ids";
    private static final String CREATE_TEMP_SELECTED_TABLE_IDS_SQL =
            "CREATE TEMP TABLE IF NOT EXISTS " + TEMP_SELECTED_TABLE_IDS + "(table_id INTEGER PRIMARY KEY)";
    private static final String CLEAR_TEMP_SELECTED_TABLE_IDS_SQL =
            "DELETE FROM " + TEMP_SELECTED_TABLE_IDS;
    private static final String INSERT_TEMP_SELECTED_TABLE_ID_SQL =
            "INSERT INTO " + TEMP_SELECTED_TABLE_IDS + "(table_id) VALUES (?)";
    private static final String LOAD_SUMMARIES_SQL =
            "SELECT t.table_id, t.name, l.loot_table_id "
                    + "FROM " + EncounterTablePersistenceSchema.ENCOUNTER_TABLES.name() + " t "
                    + "LEFT JOIN " + EncounterTablePersistenceSchema.ENCOUNTER_TABLE_LOOT_LINKS.name()
                    + " l ON l.table_id = t.table_id "
                    + "ORDER BY LOWER(t.name), t.table_id";

    List<EncounterTableSummaryRecord> loadSummaries(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(LOAD_SUMMARIES_SQL);
                ResultSet resultSet = statement.executeQuery()) {
            List<EncounterTableSummaryRecord> summaries = new ArrayList<>();
            while (resultSet.next()) {
                summaries.add(new EncounterTableSummaryRecord(
                        resultSet.getLong("table_id"),
                        resultSet.getString("name"),
                        getNullableLong(resultSet, "loot_table_id")));
            }
            return summaries;
        }
    }

    List<EncounterTableCandidateRecord> loadGenerationCandidates(
            Connection connection,
            List<Long> tableIds,
            int maximumXp
    ) throws SQLException {
        if (tableIds == null || tableIds.isEmpty()) {
            return List.of();
        }
        prepareSelectedTableIds(connection, tableIds);
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT c.id, c.name, c.creature_type, c.cr, c.xp, c.hp, "
                        + "c.hit_dice_count, c.hit_dice_sides, c.hit_dice_modifier, "
                        + "c.ac, c.initiative_bonus, c.legendary_action_count, MAX(e.weight) AS weight "
                        + "FROM " + EncounterTablePersistenceSchema.ENCOUNTER_TABLE_ENTRIES_TABLE + " e "
                        + "JOIN creatures c ON c.id = e.creature_id "
                        + "WHERE e.table_id IN (SELECT table_id FROM sm_temp_selected_encounter_table_ids) "
                        + "AND c.xp <= ? "
                        + "GROUP BY c.id, c.name, c.creature_type, c.cr, c.xp, c.hp, "
                        + "c.hit_dice_count, c.hit_dice_sides, c.hit_dice_modifier, "
                        + "c.ac, c.initiative_bonus, c.legendary_action_count "
                        + "ORDER BY c.xp ASC, LOWER(c.name) ASC")) {
            statement.setInt(1, maximumXp);
            return readCandidates(statement);
        } finally {
            clearSelectedTableIds(connection);
        }
    }

    private static void prepareSelectedTableIds(Connection connection, List<Long> tableIds) throws SQLException {
        createSelectedTableIds(connection);
        clearSelectedTableIds(connection);
        try (PreparedStatement statement = connection.prepareStatement(INSERT_TEMP_SELECTED_TABLE_ID_SQL)) {
            for (Long tableId : tableIds) {
                statement.setLong(1, tableId);
                statement.addBatch();
            }
            statement.executeBatch();
        }
    }

    private static void createSelectedTableIds(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(CREATE_TEMP_SELECTED_TABLE_IDS_SQL)) {
            statement.executeUpdate();
        }
    }

    private static void clearSelectedTableIds(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(CLEAR_TEMP_SELECTED_TABLE_IDS_SQL)) {
            statement.executeUpdate();
        }
    }

    private static List<EncounterTableCandidateRecord> readCandidates(PreparedStatement statement)
            throws SQLException {
        List<EncounterTableCandidateRecord> candidates = new ArrayList<>();
        try (ResultSet resultSet = statement.executeQuery()) {
            while (resultSet.next()) {
                candidates.add(new EncounterTableCandidateRecord(
                        resultSet.getLong("id"),
                        resultSet.getString("name"),
                        resultSet.getString("creature_type"),
                        resultSet.getString("cr"),
                        resultSet.getInt("xp"),
                        resultSet.getInt("hp"),
                        getNullableInt(resultSet, "hit_dice_count"),
                        getNullableInt(resultSet, "hit_dice_sides"),
                        getNullableInt(resultSet, "hit_dice_modifier"),
                        resultSet.getInt("ac"),
                        resultSet.getInt("initiative_bonus"),
                        resultSet.getInt("legendary_action_count"),
                        resultSet.getInt("weight")));
            }
        }
        return candidates;
    }

    private static @Nullable Integer getNullableInt(ResultSet resultSet, String column) throws SQLException {
        int value = resultSet.getInt(column);
        return resultSet.wasNull() ? null : value;
    }

    private static @Nullable Long getNullableLong(ResultSet resultSet, String column) throws SQLException {
        long value = resultSet.getLong(column);
        return resultSet.wasNull() ? null : value;
    }
}
