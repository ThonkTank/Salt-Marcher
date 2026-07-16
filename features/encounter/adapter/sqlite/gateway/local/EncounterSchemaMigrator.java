package features.encounter.adapter.sqlite.gateway.local;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import features.encounter.adapter.sqlite.model.EncounterPersistenceSchema;

final class EncounterSchemaMigrator {

    void ensureSchema(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute(EncounterPersistenceSchema.CREATE_ENCOUNTER_PLANS_SQL);
            statement.execute(EncounterPersistenceSchema.CREATE_ENCOUNTER_PLAN_CREATURES_SQL);
            statement.execute(EncounterPersistenceSchema.CREATE_ENCOUNTER_PLAN_UPDATED_INDEX_SQL);
            statement.execute(EncounterPersistenceSchema.CREATE_ENCOUNTER_PLAN_CREATURES_PLAN_INDEX_SQL);
        }
    }

    void ensureGeneratedPlanOrigins(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute(EncounterPersistenceSchema.CREATE_GENERATED_ENCOUNTER_PLAN_BATCHES_SQL);
            statement.execute(EncounterPersistenceSchema.CREATE_GENERATED_ENCOUNTER_PLAN_ORIGINS_SQL);
        }
    }
}
