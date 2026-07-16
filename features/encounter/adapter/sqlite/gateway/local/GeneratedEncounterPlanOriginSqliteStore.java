package features.encounter.adapter.sqlite.gateway.local;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import features.encounter.adapter.sqlite.model.EncounterPersistenceSchema;
import features.encounter.api.GeneratedEncounterPlanSource;
import features.encounter.application.GeneratedEncounterPlanBatchRepository;

final class GeneratedEncounterPlanOriginSqliteStore {

    private static final String LOAD_BATCH_SQL =
            "SELECT batch_fingerprint, encounter_count FROM "
                    + EncounterPersistenceSchema.GENERATED_ENCOUNTER_PLAN_BATCHES_TABLE_NAME
                    + " WHERE engine_version = ? AND generation_id = ?";
    private static final String LOAD_MAPPINGS_SQL =
            "SELECT encounter_number, plan_id, spec_fingerprint FROM "
                    + EncounterPersistenceSchema.GENERATED_ENCOUNTER_PLAN_ORIGINS_TABLE_NAME
                    + " WHERE engine_version = ? AND generation_id = ? ORDER BY batch_order";
    private static final String INSERT_BATCH_SQL =
            "INSERT INTO " + EncounterPersistenceSchema.GENERATED_ENCOUNTER_PLAN_BATCHES_TABLE_NAME
                    + " (engine_version, generation_id, batch_fingerprint, encounter_count) "
                    + "VALUES (?, ?, ?, ?)";
    private static final String INSERT_SQL =
            "INSERT INTO " + EncounterPersistenceSchema.GENERATED_ENCOUNTER_PLAN_ORIGINS_TABLE_NAME
                    + " (engine_version, generation_id, encounter_number, batch_order, "
                    + "spec_fingerprint, plan_id) VALUES (?, ?, ?, ?, ?, ?)";

    Optional<GeneratedEncounterPlanBatchRepository.StoredBatch> loadBatch(
            Connection connection,
            GeneratedEncounterPlanSource source
    ) throws SQLException {
        String fingerprint;
        int encounterCount;
        try (PreparedStatement statement = connection.prepareStatement(LOAD_BATCH_SQL)) {
            setSource(statement, source);
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    return Optional.empty();
                }
                fingerprint = resultSet.getString("batch_fingerprint");
                encounterCount = resultSet.getInt("encounter_count");
            }
        }
        return Optional.of(new GeneratedEncounterPlanBatchRepository.StoredBatch(
                fingerprint,
                encounterCount,
                loadMappings(connection, source)));
    }

    void insertBatch(
            Connection connection,
            GeneratedEncounterPlanSource source,
            String batchFingerprint,
            int encounterCount
    ) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(INSERT_BATCH_SQL)) {
            setSource(statement, source);
            statement.setString(3, batchFingerprint);
            statement.setInt(4, encounterCount);
            statement.executeUpdate();
        }
    }

    void insert(
            Connection connection,
            GeneratedEncounterPlanSource source,
            int encounterNumber,
            int batchOrder,
            String specFingerprint,
            long planId
    ) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(INSERT_SQL)) {
            setSource(statement, source);
            statement.setInt(3, encounterNumber);
            statement.setInt(4, batchOrder);
            statement.setString(5, specFingerprint);
            statement.setLong(6, planId);
            statement.executeUpdate();
        }
    }

    private static List<GeneratedEncounterPlanBatchRepository.StoredMapping> loadMappings(
            Connection connection,
            GeneratedEncounterPlanSource source
    ) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(LOAD_MAPPINGS_SQL)) {
            setSource(statement, source);
            try (ResultSet resultSet = statement.executeQuery()) {
                List<GeneratedEncounterPlanBatchRepository.StoredMapping> mappings = new ArrayList<>();
                while (resultSet.next()) {
                    mappings.add(new GeneratedEncounterPlanBatchRepository.StoredMapping(
                            resultSet.getInt("encounter_number"),
                            resultSet.getLong("plan_id"),
                            resultSet.getString("spec_fingerprint")));
                }
                return List.copyOf(mappings);
            }
        }
    }

    private static void setSource(
            PreparedStatement statement,
            GeneratedEncounterPlanSource source
    ) throws SQLException {
        statement.setString(1, source.engineVersion());
        statement.setString(2, source.generationId());
    }
}
