package features.sessionplanner.adapter.sqlite.gateway.local;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.List;
import features.sessionplanner.adapter.sqlite.model.SessionEncounterRecord;
import features.sessionplanner.adapter.sqlite.model.SessionTreasureRecord;
import features.sessionplanner.adapter.sqlite.model.SessionTreasureItemRecord;
import features.sessionplanner.adapter.sqlite.model.SessionTreasurePackingRecord;
import features.sessionplanner.adapter.sqlite.model.SessionManualLootNoteRecord;
import features.sessionplanner.adapter.sqlite.model.SessionParticipantRecord;
import features.sessionplanner.adapter.sqlite.model.SessionRestPlacementRecord;
import features.sessionplanner.adapter.sqlite.model.SessionPlannerPersistenceSchema;

final class SessionPlanChildTableSqliteWrites {

    private static final String DELETE_FROM = "DELETE FROM ";
    private static final String INSERT_INTO = "INSERT INTO ";
    private static final String WHERE_SESSION_ID = " WHERE session_id = ?";

    void replaceParticipants(Connection connection, long sessionId, List<SessionParticipantRecord> participants)
            throws SQLException {
        deleteSessionParticipants(connection, sessionId);
        if (participants == null || participants.isEmpty()) {
            return;
        }
        try (PreparedStatement insert = connection.prepareStatement(
                INSERT_INTO
                        + SessionPlannerPersistenceSchema.SESSION_PARTICIPANTS_TABLE
                        + " (session_id, character_id, sort_order) VALUES (?, ?, ?)")) {
            for (SessionParticipantRecord record : participants) {
                insert.setLong(1, sessionId);
                insert.setLong(2, record.characterId());
                insert.setInt(3, record.sortOrder());
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    void replaceEncounters(Connection connection, long sessionId, List<SessionEncounterRecord> encounters)
            throws SQLException {
        deleteSessionEncounters(connection, sessionId);
        if (encounters == null || encounters.isEmpty()) {
            return;
        }
        try (PreparedStatement insert = connection.prepareStatement(
                INSERT_INTO
                        + SessionPlannerPersistenceSchema.SESSION_ENCOUNTERS_TABLE
                        + " "
                        + "(session_id, encounter_id, encounter_plan_id, budget_percentage, scene_title, scene_notes, "
                        + "location_id, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")) {
            for (SessionEncounterRecord record : encounters) {
                insert.setLong(1, sessionId);
                insert.setLong(2, record.encounterId());
                insert.setLong(3, record.encounterPlanId());
                insert.setString(4, record.budgetPercentage());
                insert.setString(5, record.sceneTitle());
                insert.setString(6, record.sceneNotes());
                insert.setLong(7, record.locationId());
                insert.setInt(8, record.sortOrder());
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    void replaceRests(Connection connection, long sessionId, List<SessionRestPlacementRecord> rests)
            throws SQLException {
        deleteSessionRests(connection, sessionId);
        if (rests == null || rests.isEmpty()) {
            return;
        }
        try (PreparedStatement insert = connection.prepareStatement(
                INSERT_INTO
                        + SessionPlannerPersistenceSchema.SESSION_RESTS_TABLE
                        + " "
                        + "(session_id, left_encounter_id, right_encounter_id, rest_kind, sort_order) "
                        + "VALUES (?, ?, ?, ?, ?)")) {
            for (SessionRestPlacementRecord record : rests) {
                insert.setLong(1, sessionId);
                insert.setLong(2, record.leftEncounterId());
                insert.setLong(3, record.rightEncounterId());
                insert.setString(4, record.restKind());
                insert.setInt(5, record.sortOrder());
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    void replaceManualLootNotes(
            Connection connection,
            long sessionId,
            List<SessionManualLootNoteRecord> manualLootNotes
    ) throws SQLException {
        deleteSessionManualLootNotes(connection, sessionId);
        if (manualLootNotes == null || manualLootNotes.isEmpty()) {
            return;
        }
        try (PreparedStatement insert = connection.prepareStatement(
                INSERT_INTO
                        + SessionPlannerPersistenceSchema.SESSION_MANUAL_LOOT_NOTES_TABLE
                        + " "
                        + "(session_id, note_id, scene_id, note_text, sort_order) VALUES (?, ?, ?, ?, ?)")) {
            for (SessionManualLootNoteRecord record : manualLootNotes) {
                insert.setLong(1, sessionId);
                insert.setLong(2, record.noteId());
                insert.setLong(3, record.sceneId());
                insert.setString(4, record.noteText());
                insert.setInt(5, record.sortOrder());
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    void replaceTreasures(
            Connection connection,
            long sessionId,
            List<SessionTreasureRecord> treasures,
            List<SessionTreasureItemRecord> items,
            List<SessionTreasurePackingRecord> packing
    ) throws SQLException {
        deleteTreasures(connection, sessionId);
        if (treasures == null || treasures.isEmpty()) {
            return;
        }
        try (PreparedStatement insert = connection.prepareStatement(
                INSERT_INTO
                        + SessionPlannerPersistenceSchema.SESSION_TREASURES_TABLE
                        + " (session_id, treasure_id, scene_id, title, note, stock_class, channel, theme, magic_type, "
                        + "target_cp, non_magic_slots, magic_slots, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")) {
            for (SessionTreasureRecord record : treasures) {
                insert.setLong(1, sessionId);
                insert.setLong(2, record.treasureId());
                insert.setLong(3, record.sceneId());
                insert.setString(4, record.title());
                insert.setString(5, record.note());
                insert.setString(6, record.stockClass());
                insert.setString(7, record.channel());
                insert.setString(8, record.theme());
                insert.setString(9, record.magicType());
                insert.setLong(10, record.targetCp());
                insert.setInt(11, record.nonMagicSlots());
                insert.setInt(12, record.magicSlots());
                insert.setInt(13, record.sortOrder());
                insert.addBatch();
            }
            insert.executeBatch();
        }
        if (items != null && !items.isEmpty()) {
            try (PreparedStatement insert = connection.prepareStatement(
                    INSERT_INTO + SessionPlannerPersistenceSchema.SESSION_TREASURE_ITEMS_TABLE
                            + " (session_id, treasure_id, line_id, role, item_id, item_text, quantity, unit_cp, actual_cp, "
                            + "total_capacity, allowed_containers, magic_rarity, cursed, sort_order) "
                            + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")) {
                for (SessionTreasureItemRecord record : items) {
                    insert.setLong(1, sessionId);
                    insert.setLong(2, record.treasureId());
                    insert.setLong(3, record.lineId());
                    insert.setString(4, record.role());
                    insert.setString(5, record.itemId());
                    insert.setString(6, record.text());
                    insert.setLong(7, record.quantity());
                    insert.setLong(8, record.unitCp());
                    insert.setLong(9, record.actualCp());
                    insert.setString(10, record.totalCapacity());
                    insert.setString(11, record.allowedContainers());
                    insert.setString(12, record.magicRarity());
                    insert.setInt(13, record.cursed() ? 1 : 0);
                    insert.setInt(14, record.sortOrder());
                    insert.addBatch();
                }
                insert.executeBatch();
            }
        }
        if (packing == null || packing.isEmpty()) {
            return;
        }
        try (PreparedStatement insert = connection.prepareStatement(
                INSERT_INTO + SessionPlannerPersistenceSchema.SESSION_TREASURE_PACKING_TABLE
                        + " (session_id, treasure_id, line_id, container_type, container_count, container_id, valid, "
                        + "sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")) {
            for (SessionTreasurePackingRecord record : packing) {
                insert.setLong(1, sessionId);
                insert.setLong(2, record.treasureId());
                insert.setLong(3, record.lineId());
                insert.setString(4, record.containerType());
                insert.setInt(5, record.containerCount());
                insert.setString(6, record.containerId());
                insert.setInt(7, record.valid() ? 1 : 0);
                insert.setInt(8, record.sortOrder());
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    private static void deleteSessionParticipants(Connection connection, long sessionId) throws SQLException {
        try (PreparedStatement delete = connection.prepareStatement(
                DELETE_FROM + SessionPlannerPersistenceSchema.SESSION_PARTICIPANTS_TABLE + WHERE_SESSION_ID)) {
            delete.setLong(1, sessionId);
            delete.executeUpdate();
        }
    }

    private static void deleteSessionEncounters(Connection connection, long sessionId) throws SQLException {
        try (PreparedStatement delete = connection.prepareStatement(
                DELETE_FROM + SessionPlannerPersistenceSchema.SESSION_ENCOUNTERS_TABLE + WHERE_SESSION_ID)) {
            delete.setLong(1, sessionId);
            delete.executeUpdate();
        }
    }

    private static void deleteSessionRests(Connection connection, long sessionId) throws SQLException {
        try (PreparedStatement delete = connection.prepareStatement(
                DELETE_FROM + SessionPlannerPersistenceSchema.SESSION_RESTS_TABLE + WHERE_SESSION_ID)) {
            delete.setLong(1, sessionId);
            delete.executeUpdate();
        }
    }

    private static void deleteSessionManualLootNotes(Connection connection, long sessionId) throws SQLException {
        try (PreparedStatement delete = connection.prepareStatement(
                DELETE_FROM + SessionPlannerPersistenceSchema.SESSION_MANUAL_LOOT_NOTES_TABLE + WHERE_SESSION_ID)) {
            delete.setLong(1, sessionId);
            delete.executeUpdate();
        }
    }

    private static void deleteTreasures(Connection connection, long sessionId) throws SQLException {
        try (PreparedStatement delete = connection.prepareStatement(
                DELETE_FROM + SessionPlannerPersistenceSchema.SESSION_TREASURE_PACKING_TABLE + WHERE_SESSION_ID)) {
            delete.setLong(1, sessionId);
            delete.executeUpdate();
        }
        try (PreparedStatement delete = connection.prepareStatement(
                DELETE_FROM + SessionPlannerPersistenceSchema.SESSION_TREASURE_ITEMS_TABLE + WHERE_SESSION_ID)) {
            delete.setLong(1, sessionId);
            delete.executeUpdate();
        }
        try (PreparedStatement delete = connection.prepareStatement(
                DELETE_FROM + SessionPlannerPersistenceSchema.SESSION_TREASURES_TABLE + WHERE_SESSION_ID)) {
            delete.setLong(1, sessionId);
            delete.executeUpdate();
        }
    }
}
