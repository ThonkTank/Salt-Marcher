package features.encounter.adapter.sqlite.gateway.local;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import features.encounter.adapter.sqlite.model.EncounterPersistenceSchema;
import features.encounter.adapter.sqlite.model.EncounterPlanCreatureRecord;
import features.encounter.adapter.sqlite.model.EncounterPlanRecord;

final class EncounterPlanSqliteStore {

    private static final String LOAD_PLAN_SQL =
            "SELECT p.plan_id, p.name, p.generated_label, COALESCE(SUM(c.quantity), 0) AS creature_count "
                    + "FROM " + EncounterPersistenceSchema.ENCOUNTER_PLANS.name() + " p "
                    + "LEFT JOIN " + EncounterPersistenceSchema.ENCOUNTER_PLAN_CREATURES.name()
                    + " c ON c.plan_id = p.plan_id "
                    + "WHERE p.plan_id = ? "
                    + "GROUP BY p.plan_id, p.name, p.generated_label";
    private static final String LIST_PLANS_SQL =
            "SELECT p.plan_id, p.name, p.generated_label, COALESCE(SUM(c.quantity), 0) AS creature_count "
                    + "FROM " + EncounterPersistenceSchema.ENCOUNTER_PLANS.name() + " p "
                    + "LEFT JOIN " + EncounterPersistenceSchema.ENCOUNTER_PLAN_CREATURES.name()
                    + " c ON c.plan_id = p.plan_id "
                    + "GROUP BY p.plan_id, p.name, p.generated_label, p.updated_at "
                    + "ORDER BY p.updated_at DESC, p.plan_id DESC";
    private static final String LOAD_CREATURES_SQL =
            "SELECT creature_id, quantity, sort_order FROM "
                    + EncounterPersistenceSchema.ENCOUNTER_PLAN_CREATURES.name()
                    + " WHERE plan_id = ? ORDER BY sort_order, creature_id";
    private static final String DELETE_CREATURES_SQL =
            "DELETE FROM " + EncounterPersistenceSchema.ENCOUNTER_PLAN_CREATURES.name() + " WHERE plan_id = ?";
    private static final String INSERT_CREATURE_SQL =
            "INSERT INTO " + EncounterPersistenceSchema.ENCOUNTER_PLAN_CREATURES.name()
                    + " (plan_id, creature_id, quantity, sort_order) VALUES (?, ?, ?, ?)";
    private static final String UPDATE_PLAN_SQL =
            "UPDATE " + EncounterPersistenceSchema.ENCOUNTER_PLANS.name()
                    + " SET name = ?, generated_label = ?, updated_at = CURRENT_TIMESTAMP WHERE plan_id = ?";
    private static final String INSERT_PLAN_SQL =
            "INSERT INTO " + EncounterPersistenceSchema.ENCOUNTER_PLANS.name()
                    + " (name, generated_label) VALUES (?, ?)";
    private static final String EXISTS_SQL =
            "SELECT 1 FROM " + EncounterPersistenceSchema.ENCOUNTER_PLANS.name() + " WHERE plan_id = ?";

    long savePlan(Connection connection, EncounterPlanRecord plan) throws SQLException {
        if (plan.id() > 0 && exists(connection, plan.id())) {
            return updatePlan(connection, plan);
        }
        return insertPlan(connection, plan);
    }

    Optional<EncounterPlanRecord> loadPlan(Connection connection, long planId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(LOAD_PLAN_SQL)) {
            statement.setLong(1, planId);
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    return Optional.empty();
                }
                return Optional.of(readPlan(resultSet));
            }
        }
    }

    List<EncounterPlanRecord> listPlans(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(LIST_PLANS_SQL);
                ResultSet resultSet = statement.executeQuery()) {
            List<EncounterPlanRecord> plans = new ArrayList<>();
            while (resultSet.next()) {
                plans.add(readPlan(resultSet));
            }
            return plans;
        }
    }

    List<EncounterPlanCreatureRecord> loadCreatures(Connection connection, long planId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(LOAD_CREATURES_SQL)) {
            statement.setLong(1, planId);
            try (ResultSet resultSet = statement.executeQuery()) {
                List<EncounterPlanCreatureRecord> creatures = new ArrayList<>();
                while (resultSet.next()) {
                    creatures.add(new EncounterPlanCreatureRecord(
                            resultSet.getLong("creature_id"),
                            resultSet.getInt("quantity"),
                            resultSet.getInt("sort_order")));
                }
                return creatures;
            }
        }
    }

    void replaceCreatures(
            Connection connection,
            long planId,
            List<EncounterPlanCreatureRecord> creatures
    ) throws SQLException {
        try (PreparedStatement delete = connection.prepareStatement(DELETE_CREATURES_SQL)) {
            delete.setLong(1, planId);
            delete.executeUpdate();
        }
        try (PreparedStatement insert = connection.prepareStatement(INSERT_CREATURE_SQL)) {
            for (int index = 0; index < creatures.size(); index++) {
                EncounterPlanCreatureRecord creature = creatures.get(index);
                insert.setLong(1, planId);
                insert.setLong(2, creature.creatureId());
                insert.setInt(3, creature.quantity());
                insert.setInt(4, index);
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    private static EncounterPlanRecord readPlan(ResultSet resultSet) throws SQLException {
        return new EncounterPlanRecord(
                resultSet.getLong("plan_id"),
                resultSet.getString("name"),
                resultSet.getString("generated_label"),
                resultSet.getInt("creature_count"));
    }

    private static long updatePlan(Connection connection, EncounterPlanRecord plan) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(UPDATE_PLAN_SQL)) {
            statement.setString(1, plan.name());
            statement.setString(2, plan.generatedLabel());
            statement.setLong(3, plan.id());
            statement.executeUpdate();
            return plan.id();
        }
    }

    private static long insertPlan(Connection connection, EncounterPlanRecord plan) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                INSERT_PLAN_SQL,
                Statement.RETURN_GENERATED_KEYS)) {
            statement.setString(1, plan.name());
            statement.setString(2, plan.generatedLabel());
            statement.executeUpdate();
            try (ResultSet generatedKeys = statement.getGeneratedKeys()) {
                if (generatedKeys.next()) {
                    return generatedKeys.getLong(1);
                }
            }
        }
        throw new SQLException("Saved encounter plan insert did not return a generated id.");
    }

    private static boolean exists(Connection connection, long planId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(EXISTS_SQL)) {
            statement.setLong(1, planId);
            try (ResultSet resultSet = statement.executeQuery()) {
                return resultSet.next();
            }
        }
    }
}
