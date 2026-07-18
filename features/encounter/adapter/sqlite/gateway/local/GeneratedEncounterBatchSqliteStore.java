package features.encounter.adapter.sqlite.gateway.local;

import features.encounter.adapter.sqlite.model.EncounterPersistenceSchema;
import features.encounter.adapter.sqlite.model.EncounterPlanCreatureRecord;
import features.encounter.adapter.sqlite.model.GeneratedEncounterOriginRecord;
import features.encounter.api.PreparedEncounterBatch;
import features.encounter.api.PreparedEncounterRoster;
import features.encounter.application.GeneratedEncounterBatchRepository;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;

final class GeneratedEncounterBatchSqliteStore {

    private static final String FIND_BATCH = "SELECT generation_id, preparation_id, batch_fingerprint, "
            + "encounter_count FROM "
            + EncounterPersistenceSchema.GENERATED_ENCOUNTER_PLAN_BATCHES_TABLE_NAME
            + " WHERE engine_version=? AND COALESCE(preparation_id, generation_id)=?";
    private static final String FIND_ORIGINS = "SELECT o.encounter_number, o.batch_order, o.spec_fingerprint, "
            + "o.roster_fingerprint, o.plan_id, p.name display_name, p.generated_label, "
            + "COALESCE((SELECT GROUP_CONCAT(row_value, '') FROM "
            + "(SELECT '|' || c.creature_id || ':' || c.quantity AS row_value FROM "
            + "saved_encounter_plan_creatures c WHERE c.plan_id=o.plan_id "
            + "ORDER BY c.sort_order, c.creature_id)), '') AS derived_roster FROM "
            + EncounterPersistenceSchema.GENERATED_ENCOUNTER_PLAN_ORIGINS_TABLE_NAME
            + " o JOIN saved_encounter_plans p ON p.plan_id=o.plan_id "
            + "WHERE o.engine_version=? AND o.generation_id=? ORDER BY o.batch_order";
    private static final String INSERT_BATCH = "INSERT INTO "
            + EncounterPersistenceSchema.GENERATED_ENCOUNTER_PLAN_BATCHES_TABLE_NAME
            + " (engine_version, generation_id, preparation_id, batch_fingerprint, encounter_count) "
            + "VALUES (?, ?, ?, ?, ?)";
    private static final String INSERT_ORIGIN = "INSERT INTO "
            + EncounterPersistenceSchema.GENERATED_ENCOUNTER_PLAN_ORIGINS_TABLE_NAME
            + " (engine_version, generation_id, encounter_number, batch_order, spec_fingerprint, "
            + "roster_fingerprint, plan_id) VALUES (?, ?, ?, ?, ?, ?, ?)";
    private static final String FIND_ORIGIN_BY_PLAN = "SELECT b.engine_version, b.generation_id, "
            + "COALESCE(b.preparation_id,b.generation_id) preparation_id, b.batch_fingerprint, "
            + "b.encounter_count, o.batch_order, o.encounter_number, o.spec_fingerprint, "
            + "o.roster_fingerprint FROM generated_encounter_plan_origins o JOIN "
            + "generated_encounter_plan_batches b ON b.engine_version=o.engine_version "
            + "AND b.generation_id=o.generation_id WHERE o.plan_id=?";

    Optional<StoredBatch> load(Connection connection, PreparedEncounterBatch requested) throws SQLException {
        String storedRun;
        String storedFingerprint;
        int storedCount;
        boolean canonicalRepresentation;
        try (PreparedStatement statement = connection.prepareStatement(FIND_BATCH)) {
            statement.setString(1, requested.source().engineVersion());
            statement.setString(2, requested.source().preparationIdentity());
            try (ResultSet rows = statement.executeQuery()) {
                if (!rows.next()) {
                    return Optional.empty();
                }
                storedRun = rows.getString("generation_id");
                canonicalRepresentation = rows.getString("preparation_id") != null;
                storedFingerprint = rows.getString("batch_fingerprint");
                storedCount = rows.getInt("encounter_count");
            }
        }
        return Optional.of(new StoredBatch(
                storedRun, storedFingerprint, storedCount, canonicalRepresentation,
                loadOrigins(connection, requested.source().engineVersion(), storedRun)));
    }

    void insertBatch(Connection connection, PreparedEncounterBatch batch) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(INSERT_BATCH)) {
            statement.setString(1, batch.source().engineVersion());
            statement.setString(2, batch.source().generationRunIdentity());
            statement.setString(3, batch.source().preparationIdentity());
            statement.setString(4, batch.batchFingerprint());
            statement.setInt(5, batch.rosters().size());
            statement.executeUpdate();
        }
    }

    void insertOrigins(
            Connection connection,
            PreparedEncounterBatch batch,
            List<GeneratedEncounterBatchRepository.Mapping> mappings
    ) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(INSERT_ORIGIN)) {
            for (int index = 0; index < batch.rosters().size(); index++) {
                PreparedEncounterRoster roster = batch.rosters().get(index);
                GeneratedEncounterBatchRepository.Mapping mapping = mappings.get(index);
                statement.setString(1, batch.source().engineVersion());
                statement.setString(2, batch.source().generationRunIdentity());
                statement.setInt(3, roster.encounterNumber());
                statement.setInt(4, index);
                statement.setString(5, roster.intentFingerprint());
                statement.setString(6, roster.rosterFingerprint());
                statement.setLong(7, mapping.planId());
                statement.addBatch();
            }
            statement.executeBatch();
        }
    }

    Optional<GeneratedEncounterOriginRecord> loadOrigin(
            Connection connection,
            long planId,
            List<EncounterPlanCreatureRecord> creatures
    ) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(FIND_ORIGIN_BY_PLAN)) {
            statement.setLong(1, planId);
            try (ResultSet rows = statement.executeQuery()) {
                if (!rows.next()) {
                    return Optional.empty();
                }
                String rosterFingerprint = rows.getString("roster_fingerprint");
                if (rosterFingerprint == null || rosterFingerprint.isBlank()) {
                    rosterFingerprint = fingerprint(creatures.stream()
                            .map(creature -> "|" + creature.creatureId() + ':' + creature.quantity())
                            .reduce("", String::concat));
                }
                return Optional.of(new GeneratedEncounterOriginRecord(
                        rows.getString("engine_version"),
                        rows.getString("preparation_id"),
                        rows.getString("generation_id"),
                        rows.getString("batch_fingerprint"),
                        rows.getInt("encounter_count"),
                        rows.getInt("batch_order"),
                        rows.getInt("encounter_number"),
                        rows.getString("spec_fingerprint"),
                        rosterFingerprint));
            }
        }
    }

    boolean equalsRequested(StoredBatch stored, PreparedEncounterBatch requested) {
        if (!stored.generationRunIdentity().equals(requested.source().generationRunIdentity())
                || !stored.batchFingerprint().equals(requested.batchFingerprint())
                || stored.cardinality() != requested.rosters().size()
                || stored.origins().size() != requested.rosters().size()) {
            return false;
        }
        for (int index = 0; index < requested.rosters().size(); index++) {
            PreparedEncounterRoster roster = requested.rosters().get(index);
            StoredOrigin origin = stored.origins().get(index);
            if (origin.order() != index || origin.encounterNumber() != roster.encounterNumber()
                    || !origin.displayName().equals(roster.displayLabel())
                    || !origin.generatedLabel().equals(roster.displayLabel())
                    || !origin.intentFingerprint().equals(roster.intentFingerprint())
                    || !origin.derivedRosterFingerprint().equals(roster.rosterFingerprint())
                    || (stored.canonicalRepresentation()
                            && !origin.rosterFingerprint().equals(roster.rosterFingerprint()))
                    || (!stored.canonicalRepresentation() && !origin.rosterFingerprint().isBlank()
                            && !origin.rosterFingerprint().equals(roster.rosterFingerprint()))) {
                return false;
            }
        }
        return true;
    }

    List<GeneratedEncounterBatchRepository.Mapping> mappings(StoredBatch stored) {
        return stored.origins().stream()
                .map(origin -> new GeneratedEncounterBatchRepository.Mapping(
                        origin.encounterNumber(), origin.planId()))
                .toList();
    }

    private static List<StoredOrigin> loadOrigins(
            Connection connection,
            String engineVersion,
            String runIdentity
    ) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(FIND_ORIGINS)) {
            statement.setString(1, engineVersion);
            statement.setString(2, runIdentity);
            try (ResultSet rows = statement.executeQuery()) {
                List<StoredOrigin> result = new ArrayList<>();
                while (rows.next()) {
                    result.add(new StoredOrigin(
                            rows.getInt("encounter_number"),
                            rows.getInt("batch_order"),
                            rows.getString("spec_fingerprint"),
                            rows.getString("roster_fingerprint"),
                            fingerprint(rows.getString("derived_roster")),
                            rows.getString("display_name"),
                            rows.getString("generated_label"),
                            rows.getLong("plan_id")));
                }
                return List.copyOf(result);
            }
        }
    }

    record StoredBatch(
            String generationRunIdentity,
            String batchFingerprint,
            int cardinality,
            boolean canonicalRepresentation,
            List<StoredOrigin> origins
    ) {
        StoredBatch {
            origins = List.copyOf(origins);
        }
    }

    record StoredOrigin(
            int encounterNumber,
            int order,
            String intentFingerprint,
            String rosterFingerprint,
            String derivedRosterFingerprint,
            String displayName,
            String generatedLabel,
            long planId
    ) {
        StoredOrigin {
            rosterFingerprint = rosterFingerprint == null ? "" : rosterFingerprint;
        }
    }

    private static String fingerprint(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }
}
