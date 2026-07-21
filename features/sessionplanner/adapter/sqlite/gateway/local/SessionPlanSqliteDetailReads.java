package features.sessionplanner.adapter.sqlite.gateway.local;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import features.sessionplanner.adapter.sqlite.model.SessionEncounterRecord;
import features.sessionplanner.adapter.sqlite.model.SessionTreasureRecord;
import features.sessionplanner.adapter.sqlite.model.SessionTreasureItemRecord;
import features.sessionplanner.adapter.sqlite.model.SessionTreasurePackingRecord;
import features.sessionplanner.adapter.sqlite.model.SessionManualLootNoteRecord;
import features.sessionplanner.adapter.sqlite.model.SessionParticipantRecord;
import features.sessionplanner.adapter.sqlite.model.SessionRestPlacementRecord;
import features.sessionplanner.adapter.sqlite.model.SessionPlannerPersistenceSchema;

final class SessionPlanSqliteDetailReads {

    private static final String SORT_ORDER = "sort_order";

    Map<Long, List<SessionParticipantRecord>> loadAllParticipants(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT session_id, character_id, sort_order FROM "
                        + SessionPlannerPersistenceSchema.SESSION_PARTICIPANTS_TABLE
                        + " ORDER BY session_id, sort_order, character_id");
                ResultSet resultSet = statement.executeQuery()) {
            Map<Long, List<SessionParticipantRecord>> values = new LinkedHashMap<>();
            while (resultSet.next()) {
                add(values, resultSet.getLong("session_id"), new SessionParticipantRecord(
                        resultSet.getLong("character_id"), resultSet.getInt(SORT_ORDER)));
            }
            return immutable(values);
        }
    }

    Map<Long, List<SessionEncounterRecord>> loadAllEncounters(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT session_id, encounter_id, encounter_plan_id, budget_percentage, scene_title, scene_notes, "
                        + "location_id, sort_order FROM "
                        + SessionPlannerPersistenceSchema.SESSION_ENCOUNTERS_TABLE
                        + " ORDER BY session_id, sort_order, encounter_id");
                ResultSet resultSet = statement.executeQuery()) {
            Map<Long, List<SessionEncounterRecord>> values = new LinkedHashMap<>();
            while (resultSet.next()) {
                add(values, resultSet.getLong("session_id"), new SessionEncounterRecord(
                        resultSet.getLong("encounter_id"), resultSet.getLong("encounter_plan_id"),
                        resultSet.getString("budget_percentage"), resultSet.getString("scene_title"),
                        resultSet.getString("scene_notes"), resultSet.getLong("location_id"),
                        resultSet.getInt(SORT_ORDER)));
            }
            return immutable(values);
        }
    }

    Map<Long, List<SessionRestPlacementRecord>> loadAllRests(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT session_id, left_encounter_id, right_encounter_id, rest_kind, sort_order FROM "
                        + SessionPlannerPersistenceSchema.SESSION_RESTS_TABLE
                        + " ORDER BY session_id, sort_order, left_encounter_id, right_encounter_id");
                ResultSet resultSet = statement.executeQuery()) {
            Map<Long, List<SessionRestPlacementRecord>> values = new LinkedHashMap<>();
            while (resultSet.next()) {
                add(values, resultSet.getLong("session_id"), new SessionRestPlacementRecord(
                        resultSet.getLong("left_encounter_id"), resultSet.getLong("right_encounter_id"),
                        resultSet.getString("rest_kind"), resultSet.getInt(SORT_ORDER)));
            }
            return immutable(values);
        }
    }

    Map<Long, List<SessionManualLootNoteRecord>> loadAllManualLootNotes(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT session_id, note_id, scene_id, note_text, sort_order FROM "
                        + SessionPlannerPersistenceSchema.SESSION_MANUAL_LOOT_NOTES_TABLE
                        + " ORDER BY session_id, sort_order, note_id");
                ResultSet resultSet = statement.executeQuery()) {
            Map<Long, List<SessionManualLootNoteRecord>> values = new LinkedHashMap<>();
            while (resultSet.next()) {
                add(values, resultSet.getLong("session_id"), new SessionManualLootNoteRecord(
                        resultSet.getLong("note_id"), resultSet.getLong("scene_id"),
                        resultSet.getString("note_text"), resultSet.getInt(SORT_ORDER)));
            }
            return immutable(values);
        }
    }

    Map<Long, List<SessionTreasureRecord>> loadAllTreasures(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT session_id, treasure_id, scene_id, title, note, stock_class, channel, theme, magic_type, "
                        + "target_cp, non_magic_slots, magic_slots, sort_order FROM "
                        + SessionPlannerPersistenceSchema.SESSION_TREASURES_TABLE
                        + " ORDER BY session_id, sort_order, treasure_id");
                ResultSet resultSet = statement.executeQuery()) {
            Map<Long, List<SessionTreasureRecord>> values = new LinkedHashMap<>();
            while (resultSet.next()) {
                add(values, resultSet.getLong("session_id"), treasureRecord(resultSet));
            }
            return immutable(values);
        }
    }

    Map<Long, List<SessionTreasureItemRecord>> loadAllTreasureItems(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                treasureItemSelect() + " ORDER BY session_id, treasure_id, sort_order, line_id");
                ResultSet resultSet = statement.executeQuery()) {
            Map<Long, List<SessionTreasureItemRecord>> values = new LinkedHashMap<>();
            while (resultSet.next()) {
                add(values, resultSet.getLong("session_id"), treasureItemRecord(resultSet));
            }
            return immutable(values);
        }
    }

    Map<Long, List<SessionTreasurePackingRecord>> loadAllTreasurePacking(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                treasurePackingSelect() + " ORDER BY session_id, treasure_id, sort_order, line_id");
                ResultSet resultSet = statement.executeQuery()) {
            Map<Long, List<SessionTreasurePackingRecord>> values = new LinkedHashMap<>();
            while (resultSet.next()) {
                add(values, resultSet.getLong("session_id"), treasurePackingRecord(resultSet));
            }
            return immutable(values);
        }
    }

    private static <T> void add(Map<Long, List<T>> values, long sessionId, T value) {
        values.computeIfAbsent(sessionId, ignored -> new ArrayList<>()).add(value);
    }

    private static <T> Map<Long, List<T>> immutable(Map<Long, List<T>> values) {
        Map<Long, List<T>> copy = new LinkedHashMap<>();
        values.forEach((key, value) -> copy.put(key, List.copyOf(value)));
        return Map.copyOf(copy);
    }

    List<SessionParticipantRecord> loadParticipants(Connection connection, long sessionId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT character_id, sort_order FROM "
                        + SessionPlannerPersistenceSchema.SESSION_PARTICIPANTS_TABLE
                        + " WHERE session_id = ? ORDER BY sort_order, character_id")) {
            statement.setLong(1, sessionId);
            try (ResultSet resultSet = statement.executeQuery()) {
                List<SessionParticipantRecord> participants = new ArrayList<>();
                while (resultSet.next()) {
                    participants.add(new SessionParticipantRecord(
                            resultSet.getLong("character_id"),
                            resultSet.getInt(SORT_ORDER)));
                }
                return participants;
            }
        }
    }

    List<SessionEncounterRecord> loadEncounters(Connection connection, long sessionId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT encounter_id, encounter_plan_id, budget_percentage, scene_title, scene_notes, location_id, "
                        + "sort_order "
                        + "FROM " + SessionPlannerPersistenceSchema.SESSION_ENCOUNTERS_TABLE + " "
                        + "WHERE session_id = ? ORDER BY sort_order, encounter_id")) {
            statement.setLong(1, sessionId);
            try (ResultSet resultSet = statement.executeQuery()) {
                List<SessionEncounterRecord> encounters = new ArrayList<>();
                while (resultSet.next()) {
                    encounters.add(new SessionEncounterRecord(
                            resultSet.getLong("encounter_id"),
                            resultSet.getLong("encounter_plan_id"),
                            resultSet.getString("budget_percentage"),
                            resultSet.getString("scene_title"),
                            resultSet.getString("scene_notes"),
                            resultSet.getLong("location_id"),
                            resultSet.getInt(SORT_ORDER)));
                }
                return encounters;
            }
        }
    }

    List<SessionRestPlacementRecord> loadRests(Connection connection, long sessionId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT left_encounter_id, right_encounter_id, rest_kind, sort_order "
                        + "FROM " + SessionPlannerPersistenceSchema.SESSION_RESTS_TABLE + " "
                        + "WHERE session_id = ? ORDER BY sort_order, left_encounter_id, right_encounter_id")) {
            statement.setLong(1, sessionId);
            try (ResultSet resultSet = statement.executeQuery()) {
                List<SessionRestPlacementRecord> rests = new ArrayList<>();
                while (resultSet.next()) {
                    rests.add(new SessionRestPlacementRecord(
                            resultSet.getLong("left_encounter_id"),
                            resultSet.getLong("right_encounter_id"),
                            resultSet.getString("rest_kind"),
                            resultSet.getInt(SORT_ORDER)));
                }
                return rests;
            }
        }
    }

    List<SessionManualLootNoteRecord> loadManualLootNotes(Connection connection, long sessionId)
            throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT note_id, scene_id, note_text, sort_order FROM "
                        + SessionPlannerPersistenceSchema.SESSION_MANUAL_LOOT_NOTES_TABLE
                        + " WHERE session_id = ? ORDER BY sort_order, note_id")) {
            statement.setLong(1, sessionId);
            try (ResultSet resultSet = statement.executeQuery()) {
                List<SessionManualLootNoteRecord> notes = new ArrayList<>();
                while (resultSet.next()) {
                    notes.add(new SessionManualLootNoteRecord(
                            resultSet.getLong("note_id"),
                            resultSet.getLong("scene_id"),
                            resultSet.getString("note_text"),
                            resultSet.getInt(SORT_ORDER)));
                }
                return notes;
            }
        }
    }

    List<SessionTreasureRecord> loadTreasures(Connection connection, long sessionId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT treasure_id, scene_id, title, note, stock_class, channel, theme, magic_type, target_cp, "
                        + "non_magic_slots, magic_slots, sort_order FROM "
                        + SessionPlannerPersistenceSchema.SESSION_TREASURES_TABLE
                        + " WHERE session_id = ? ORDER BY sort_order, treasure_id")) {
            statement.setLong(1, sessionId);
            try (ResultSet resultSet = statement.executeQuery()) {
                List<SessionTreasureRecord> values = new ArrayList<>();
                while (resultSet.next()) {
                    values.add(treasureRecord(resultSet));
                }
                return List.copyOf(values);
            }
        }
    }

    List<SessionTreasureItemRecord> loadTreasureItems(Connection connection, long sessionId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                treasureItemSelect() + " WHERE session_id = ? ORDER BY treasure_id, sort_order, line_id")) {
            statement.setLong(1, sessionId);
            try (ResultSet resultSet = statement.executeQuery()) {
                List<SessionTreasureItemRecord> values = new ArrayList<>();
                while (resultSet.next()) {
                    values.add(treasureItemRecord(resultSet));
                }
                return List.copyOf(values);
            }
        }
    }

    List<SessionTreasurePackingRecord> loadTreasurePacking(Connection connection, long sessionId)
            throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                treasurePackingSelect() + " WHERE session_id = ? ORDER BY treasure_id, sort_order, line_id")) {
            statement.setLong(1, sessionId);
            try (ResultSet resultSet = statement.executeQuery()) {
                List<SessionTreasurePackingRecord> values = new ArrayList<>();
                while (resultSet.next()) {
                    values.add(treasurePackingRecord(resultSet));
                }
                return List.copyOf(values);
            }
        }
    }

    private static SessionTreasureRecord treasureRecord(ResultSet resultSet) throws SQLException {
        return new SessionTreasureRecord(
                resultSet.getLong("treasure_id"), resultSet.getLong("scene_id"), resultSet.getString("title"),
                resultSet.getString("note"), resultSet.getString("stock_class"), resultSet.getString("channel"),
                resultSet.getString("theme"), resultSet.getString("magic_type"), resultSet.getLong("target_cp"),
                resultSet.getInt("non_magic_slots"), resultSet.getInt("magic_slots"), resultSet.getInt(SORT_ORDER));
    }

    private static String treasureItemSelect() {
        return "SELECT session_id, treasure_id, line_id, role, item_id, item_text, quantity, unit_cp, actual_cp, "
                + "total_capacity, allowed_containers, magic_rarity, cursed, sort_order FROM "
                + SessionPlannerPersistenceSchema.SESSION_TREASURE_ITEMS_TABLE;
    }

    private static SessionTreasureItemRecord treasureItemRecord(ResultSet resultSet) throws SQLException {
        return new SessionTreasureItemRecord(
                resultSet.getLong("treasure_id"), resultSet.getLong("line_id"), resultSet.getString("role"),
                resultSet.getString("item_id"), resultSet.getString("item_text"), resultSet.getLong("quantity"),
                resultSet.getLong("unit_cp"), resultSet.getLong("actual_cp"),
                resultSet.getString("total_capacity"), resultSet.getString("allowed_containers"),
                resultSet.getString("magic_rarity"), resultSet.getInt("cursed") != 0, resultSet.getInt(SORT_ORDER));
    }

    private static String treasurePackingSelect() {
        return "SELECT session_id, treasure_id, line_id, container_type, container_count, container_id, valid, "
                + "sort_order FROM " + SessionPlannerPersistenceSchema.SESSION_TREASURE_PACKING_TABLE;
    }

    private static SessionTreasurePackingRecord treasurePackingRecord(ResultSet resultSet) throws SQLException {
        return new SessionTreasurePackingRecord(
                resultSet.getLong("treasure_id"), resultSet.getLong("line_id"),
                resultSet.getString("container_type"), resultSet.getInt("container_count"),
                resultSet.getString("container_id"), resultSet.getInt("valid") != 0,
                resultSet.getInt(SORT_ORDER));
    }
}
