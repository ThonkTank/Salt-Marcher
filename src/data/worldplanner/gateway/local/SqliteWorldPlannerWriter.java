package src.data.worldplanner.gateway.local;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.List;
import src.data.worldplanner.model.WorldFactionInventoryLimitRecord;
import src.data.worldplanner.model.WorldFactionRecord;
import src.data.worldplanner.model.WorldLocationRecord;
import src.data.worldplanner.model.WorldNpcRecord;
import src.data.worldplanner.model.WorldPlannerPersistenceSchema;
import src.data.worldplanner.model.WorldPlannerSnapshotRecord;

final class SqliteWorldPlannerWriter {

    private static final String DELETE_PREFIX = "DELETE FROM ";
    private static final String INSERT_PREFIX = "INSERT INTO ";
    private static final String FACTION_ID = "faction_id";
    private static final String LOCATION_ID = "location_id";

    void save(Connection connection, WorldPlannerSnapshotRecord snapshot) throws SQLException {
        boolean previousAutoCommit = connection.getAutoCommit();
        connection.setAutoCommit(false);
        try {
            clearTables(connection);
            saveNpcs(connection, snapshot.npcs());
            saveFactions(connection, snapshot.factions());
            saveLocations(connection, snapshot.locations());
            connection.commit();
        } catch (SQLException exception) {
            connection.rollback();
            throw exception;
        } finally {
            connection.setAutoCommit(previousAutoCommit);
        }
    }

    private void clearTables(Connection connection) throws SQLException {
        execute(connection, DELETE_PREFIX + WorldPlannerPersistenceSchema.LOCATION_TABLES_TABLE);
        execute(connection, DELETE_PREFIX + WorldPlannerPersistenceSchema.LOCATION_FACTIONS_TABLE);
        execute(connection, DELETE_PREFIX + WorldPlannerPersistenceSchema.FACTION_LIMITS_TABLE);
        execute(connection, DELETE_PREFIX + WorldPlannerPersistenceSchema.FACTION_NPCS_TABLE);
        execute(connection, DELETE_PREFIX + WorldPlannerPersistenceSchema.LOCATIONS_TABLE);
        execute(connection, DELETE_PREFIX + WorldPlannerPersistenceSchema.FACTIONS_TABLE);
        execute(connection, DELETE_PREFIX + WorldPlannerPersistenceSchema.NPCS_TABLE);
    }

    private void execute(Connection connection, String sql) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.executeUpdate();
        }
    }

    private void saveNpcs(
            Connection connection,
            List<WorldNpcRecord> npcs
    ) throws SQLException {
        String sql = INSERT_PREFIX + WorldPlannerPersistenceSchema.NPCS_TABLE
                + " (npc_id, display_name, creature_statblock_id, appearance_notes, behavior_notes, "
                + "history_notes, general_notes, disposition_modifier, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            for (WorldNpcRecord npc : npcs) {
                statement.setLong(1, npc.npcId());
                statement.setString(2, npc.displayName());
                statement.setLong(3, npc.creatureStatblockId());
                statement.setString(4, npc.appearanceNotes());
                statement.setString(5, npc.behaviorNotes());
                statement.setString(6, npc.historyNotes());
                statement.setString(7, npc.generalNotes());
                statement.setInt(8, npc.dispositionModifier());
                statement.setString(9, npc.status());
                statement.addBatch();
            }
            statement.executeBatch();
        }
    }

    private void saveFactions(
            Connection connection,
            List<WorldFactionRecord> factions
    ) throws SQLException {
        String sql = INSERT_PREFIX + WorldPlannerPersistenceSchema.FACTIONS_TABLE
                + " (faction_id, display_name, notes, primary_encounter_table_id, disposition) VALUES (?, ?, ?, ?, ?)";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            for (WorldFactionRecord faction : factions) {
                statement.setLong(1, faction.factionId());
                statement.setString(2, faction.displayName());
                statement.setString(3, faction.notes());
                statement.setLong(4, faction.primaryEncounterTableId());
                statement.setInt(5, faction.disposition());
                statement.addBatch();
            }
            statement.executeBatch();
        }
        for (WorldFactionRecord faction : factions) {
            saveFactionNpcIds(connection, faction.factionId(), faction.npcIds());
            saveFactionLimits(connection, faction);
        }
    }

    private void saveFactionLimits(
            Connection connection,
            WorldFactionRecord faction
    ) throws SQLException {
        String sql = INSERT_PREFIX + WorldPlannerPersistenceSchema.FACTION_LIMITS_TABLE
                + " (faction_id, creature_statblock_id, finite, quantity) VALUES (?, ?, ?, ?)";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            for (WorldFactionInventoryLimitRecord limit : faction.inventoryLimits()) {
                statement.setLong(1, faction.factionId());
                statement.setLong(2, limit.creatureStatblockId());
                statement.setInt(3, limit.finite() ? 1 : 0);
                statement.setInt(4, limit.quantity());
                statement.addBatch();
            }
            statement.executeBatch();
        }
    }

    private void saveLocations(
            Connection connection,
            List<WorldLocationRecord> locations
    ) throws SQLException {
        String sql = INSERT_PREFIX + WorldPlannerPersistenceSchema.LOCATIONS_TABLE
                + " (location_id, display_name, notes) VALUES (?, ?, ?)";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            for (WorldLocationRecord location : locations) {
                statement.setLong(1, location.locationId());
                statement.setString(2, location.displayName());
                statement.setString(3, location.notes());
                statement.addBatch();
            }
            statement.executeBatch();
        }
        for (WorldLocationRecord location : locations) {
            saveLocationFactionIds(connection, location.locationId(), location.factionIds());
            saveLocationEncounterTableIds(connection, location.locationId(), location.encounterTableIds());
        }
    }

    private void saveFactionNpcIds(Connection connection, long factionId, List<Long> values) throws SQLException {
        String sql = INSERT_PREFIX + WorldPlannerPersistenceSchema.FACTION_NPCS_TABLE
                + " (faction_id, npc_id, sort_order) VALUES (?, ?, ?)";
        saveOrderedIds(connection, sql, factionId, values);
    }

    private void saveLocationFactionIds(Connection connection, long locationId, List<Long> values) throws SQLException {
        String sql = INSERT_PREFIX + WorldPlannerPersistenceSchema.LOCATION_FACTIONS_TABLE
                + " (location_id, faction_id, sort_order) VALUES (?, ?, ?)";
        saveOrderedIds(connection, sql, locationId, values);
    }

    private void saveLocationEncounterTableIds(
            Connection connection,
            long locationId,
            List<Long> values
    ) throws SQLException {
        String sql = INSERT_PREFIX + WorldPlannerPersistenceSchema.LOCATION_TABLES_TABLE
                + " (location_id, encounter_table_id, sort_order) VALUES (?, ?, ?)";
        saveOrderedIds(connection, sql, locationId, values);
    }

    private void saveOrderedIds(Connection connection, String sql, long ownerId, List<Long> values) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            for (int index = 0; index < values.size(); index++) {
                statement.setLong(1, ownerId);
                statement.setLong(2, values.get(index));
                statement.setInt(3, index);
                statement.addBatch();
            }
            statement.executeBatch();
        }
    }
}
