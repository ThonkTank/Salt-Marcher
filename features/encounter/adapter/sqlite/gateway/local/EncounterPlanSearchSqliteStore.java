package features.encounter.adapter.sqlite.gateway.local;

import features.encounter.adapter.sqlite.model.EncounterPersistenceSchema;
import features.encounter.adapter.sqlite.model.EncounterPlanRecord;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

final class EncounterPlanSearchSqliteStore {

    List<EncounterPlanRecord> search(Connection connection, String normalizedQuery, int rootLimit)
            throws SQLException {
        String sql = "SELECT p.plan_id, p.name, p.generated_label, "
                + "COALESCE(SUM(c.quantity), 0) AS creature_count "
                + "FROM " + EncounterPersistenceSchema.ENCOUNTER_PLANS.name() + " p "
                + "LEFT JOIN " + EncounterPersistenceSchema.ENCOUNTER_PLAN_CREATURES.name()
                + " c ON c.plan_id = p.plan_id "
                + "WHERE instr(lower(p.name), ?) > 0 OR instr(lower(p.generated_label), ?) > 0 "
                + "GROUP BY p.plan_id, p.name, p.generated_label, p.updated_at "
                + "ORDER BY p.updated_at DESC, p.plan_id DESC LIMIT ?";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, normalizedQuery);
            statement.setString(2, normalizedQuery);
            statement.setInt(3, rootLimit);
            try (ResultSet rows = statement.executeQuery()) {
                List<EncounterPlanRecord> result = new ArrayList<>();
                while (rows.next()) {
                    result.add(new EncounterPlanRecord(
                            rows.getLong("plan_id"), rows.getString("name"),
                            rows.getString("generated_label"), rows.getInt("creature_count")));
                }
                return List.copyOf(result);
            }
        }
    }
}
