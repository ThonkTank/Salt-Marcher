package src.data.worldplanner.gateway.local;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import src.data.worldplanner.model.WorldFactionInventoryLimitRecord;
import src.data.worldplanner.model.WorldFactionRecord;
import src.data.worldplanner.model.WorldLocationRecord;
import src.data.worldplanner.model.WorldNpcRecord;
import src.data.worldplanner.model.WorldPlannerPersistenceSchema;
import src.data.worldplanner.model.WorldPlannerSnapshotRecord;

final class SqliteWorldPlannerReader {

    private static final String FACTION_ID = "faction_id";
    private static final String LOCATION_ID = "location_id";
    private static final int SQLITE_FALSE = 0;
    private static final int SQLITE_TRUE = 1;

    WorldPlannerSnapshotRecord load(Connection connection) throws SQLException {
        return new WorldPlannerSnapshotRecord(
                loadNpcs(connection),
                loadFactions(connection),
                loadLocations(connection));
    }

    private List<WorldNpcRecord> loadNpcs(Connection connection) throws SQLException {
        String sql = "SELECT npc_id, display_name, creature_statblock_id, appearance_notes, behavior_notes, "
                + "history_notes, general_notes, disposition_modifier, status FROM "
                + WorldPlannerPersistenceSchema.NPCS_TABLE
                + " ORDER BY npc_id";
        try (PreparedStatement statement = connection.prepareStatement(sql);
                ResultSet result = statement.executeQuery()) {
            List<WorldNpcRecord> records = new ArrayList<>();
            while (result.next()) {
                records.add(new WorldNpcRecord(
                        result.getLong("npc_id"),
                        result.getString("display_name"),
                        result.getLong("creature_statblock_id"),
                        result.getString("appearance_notes"),
                        result.getString("behavior_notes"),
                        result.getString("history_notes"),
                        result.getString("general_notes"),
                        result.getInt("disposition_modifier"),
                        result.getString("status")));
            }
            return records;
        }
    }

    private List<WorldFactionRecord> loadFactions(Connection connection) throws SQLException {
        String sql = "SELECT faction_id, display_name, notes, primary_encounter_table_id, disposition FROM "
                + WorldPlannerPersistenceSchema.FACTIONS_TABLE
                + " ORDER BY faction_id";
        try (PreparedStatement statement = connection.prepareStatement(sql);
                ResultSet result = statement.executeQuery()) {
            List<WorldFactionRecord> records = new ArrayList<>();
            while (result.next()) {
                long factionId = result.getLong(FACTION_ID);
                records.add(new WorldFactionRecord(
                        factionId,
                        result.getString("display_name"),
                        result.getString("notes"),
                        result.getLong("primary_encounter_table_id"),
                        result.getInt("disposition"),
                        loadFactionNpcIds(connection, factionId),
                        loadFactionLimits(connection, factionId)));
            }
            return records;
        }
    }

    private List<WorldLocationRecord> loadLocations(Connection connection) throws SQLException {
        String sql = "SELECT location_id, display_name, notes FROM "
                + WorldPlannerPersistenceSchema.LOCATIONS_TABLE
                + " ORDER BY location_id";
        try (PreparedStatement statement = connection.prepareStatement(sql);
                ResultSet result = statement.executeQuery()) {
            List<WorldLocationRecord> records = new ArrayList<>();
            while (result.next()) {
                long locationId = result.getLong(LOCATION_ID);
                records.add(new WorldLocationRecord(
                        locationId,
                        result.getString("display_name"),
                        result.getString("notes"),
                        loadLocationFactionIds(connection, locationId),
                        loadLocationEncounterTableIds(connection, locationId)));
            }
            return records;
        }
    }

    private List<Long> loadFactionNpcIds(Connection connection, long factionId) throws SQLException {
        String sql = "SELECT npc_id FROM " + WorldPlannerPersistenceSchema.FACTION_NPCS_TABLE
                + " WHERE faction_id = ? ORDER BY sort_order";
        return loadIds(connection, sql, factionId, "npc_id");
    }

    private List<Long> loadLocationFactionIds(Connection connection, long locationId) throws SQLException {
        String sql = "SELECT faction_id FROM " + WorldPlannerPersistenceSchema.LOCATION_FACTIONS_TABLE
                + " WHERE location_id = ? ORDER BY sort_order";
        return loadIds(connection, sql, locationId, FACTION_ID);
    }

    private List<Long> loadLocationEncounterTableIds(Connection connection, long locationId) throws SQLException {
        String sql = "SELECT encounter_table_id FROM " + WorldPlannerPersistenceSchema.LOCATION_TABLES_TABLE
                + " WHERE location_id = ? ORDER BY sort_order";
        return loadIds(connection, sql, locationId, "encounter_table_id");
    }

    private List<Long> loadIds(Connection connection, String sql, long ownerId, String valueColumn) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setLong(1, ownerId);
            try (ResultSet result = statement.executeQuery()) {
                List<Long> ids = new ArrayList<>();
                while (result.next()) {
                    ids.add(result.getLong(valueColumn));
                }
                return ids;
            }
        }
    }

    private List<WorldFactionInventoryLimitRecord> loadFactionLimits(
            Connection connection,
            long factionId
    ) throws SQLException {
        String sql = "SELECT creature_statblock_id, finite, quantity FROM "
                + WorldPlannerPersistenceSchema.FACTION_LIMITS_TABLE
                + " WHERE faction_id = ? ORDER BY creature_statblock_id";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setLong(1, factionId);
            try (ResultSet result = statement.executeQuery()) {
                List<WorldFactionInventoryLimitRecord> records = new ArrayList<>();
                while (result.next()) {
                    records.add(new WorldFactionInventoryLimitRecord(
                            result.getLong("creature_statblock_id"),
                            readFinite(result),
                            readQuantity(result)));
                }
                return records;
            }
        }
    }

    private static boolean readFinite(ResultSet result) throws SQLException {
        int value = result.getInt("finite");
        if (result.wasNull()) {
            throw new SQLException("World Planner finite inventory flag must be 0 or 1.");
        }
        if (value == SQLITE_FALSE) {
            return false;
        }
        if (value == SQLITE_TRUE) {
            return true;
        }
        throw new SQLException("World Planner finite inventory flag must be 0 or 1.");
    }

    private static int readQuantity(ResultSet result) throws SQLException {
        int value = result.getInt("quantity");
        if (result.wasNull()) {
            throw new SQLException("World Planner finite inventory quantity must be present.");
        }
        return value;
    }
}
