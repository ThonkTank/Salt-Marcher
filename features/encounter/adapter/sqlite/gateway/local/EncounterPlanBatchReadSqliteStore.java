package features.encounter.adapter.sqlite.gateway.local;

import features.encounter.adapter.sqlite.model.EncounterPersistenceSchema;
import features.encounter.adapter.sqlite.model.EncounterPlanCreatureRecord;
import features.encounter.adapter.sqlite.model.EncounterPlanRecord;
import features.encounter.adapter.sqlite.model.EncounterPlanSnapshotRecord;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class EncounterPlanBatchReadSqliteStore {

    private static final String REQUESTS = "temp_encounter_plan_requests";

    List<EncounterPlanSnapshotRecord> load(Connection connection, List<Long> planIds) throws SQLException {
        prepare(connection, planIds);
        try {
            Map<Long, EncounterPlanRecord> roots = roots(connection);
            Map<Long, List<EncounterPlanCreatureRecord>> creatures = creatures(connection);
            List<EncounterPlanSnapshotRecord> result = new ArrayList<>();
            for (Long planId : planIds) {
                EncounterPlanRecord root = roots.get(planId);
                if (root != null) {
                    result.add(new EncounterPlanSnapshotRecord(
                            root, creatures.getOrDefault(planId, List.of())));
                }
            }
            return List.copyOf(result);
        } finally {
            clear(connection);
        }
    }

    private static Map<Long, EncounterPlanRecord> roots(Connection connection) throws SQLException {
        String sql = "SELECT p.plan_id, p.name, p.generated_label, COALESCE(SUM(c.quantity),0) creature_count "
                + "FROM saved_encounter_plans p JOIN " + REQUESTS + " r ON r.plan_id=p.plan_id "
                + "LEFT JOIN saved_encounter_plan_creatures c ON c.plan_id=p.plan_id "
                + "GROUP BY p.plan_id, p.name, p.generated_label ORDER BY r.request_order";
        try (PreparedStatement statement = connection.prepareStatement(sql);
                ResultSet rows = statement.executeQuery()) {
            Map<Long, EncounterPlanRecord> result = new LinkedHashMap<>();
            while (rows.next()) {
                long id = rows.getLong("plan_id");
                result.put(Long.valueOf(id), new EncounterPlanRecord(
                        id, rows.getString("name"), rows.getString("generated_label"),
                        rows.getInt("creature_count")));
            }
            return result;
        }
    }

    private static Map<Long, List<EncounterPlanCreatureRecord>> creatures(Connection connection) throws SQLException {
        String sql = "SELECT c.plan_id, c.creature_id, c.quantity, c.sort_order, c.last_known_display_name "
                + "FROM saved_encounter_plan_creatures c JOIN " + REQUESTS + " r ON r.plan_id=c.plan_id "
                + "ORDER BY r.request_order, c.sort_order, c.creature_id";
        try (PreparedStatement statement = connection.prepareStatement(sql);
                ResultSet rows = statement.executeQuery()) {
            Map<Long, List<EncounterPlanCreatureRecord>> result = new LinkedHashMap<>();
            while (rows.next()) {
                long planId = rows.getLong("plan_id");
                result.computeIfAbsent(Long.valueOf(planId), ignored -> new ArrayList<>())
                        .add(new EncounterPlanCreatureRecord(
                                rows.getLong("creature_id"), rows.getInt("quantity"),
                                rows.getInt("sort_order"), rows.getString("last_known_display_name")));
            }
            return result;
        }
    }

    private static void prepare(Connection connection, List<Long> planIds) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute("CREATE TEMP TABLE IF NOT EXISTS " + REQUESTS
                    + " (plan_id INTEGER PRIMARY KEY, request_order INTEGER NOT NULL)");
            statement.executeUpdate("DELETE FROM " + REQUESTS);
        }
        try (PreparedStatement insert = connection.prepareStatement(
                "INSERT INTO " + REQUESTS + " (plan_id, request_order) VALUES (?, ?)")) {
            for (int index = 0; index < planIds.size(); index++) {
                insert.setLong(1, planIds.get(index).longValue());
                insert.setInt(2, index);
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    private static void clear(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.executeUpdate("DELETE FROM " + REQUESTS);
        }
    }
}
