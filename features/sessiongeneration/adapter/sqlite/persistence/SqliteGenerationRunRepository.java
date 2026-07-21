package features.sessiongeneration.adapter.sqlite.persistence;

import features.sessiongeneration.adapter.sqlite.persistence.GenerationRunSqliteReader.StoredGeneratedRun;
import features.sessiongeneration.domain.generation.GeneratedRunDraft;
import features.sessiongeneration.domain.generation.GeneratedRunValidator;
import features.sessiongeneration.domain.generation.GenerationContentFingerprint;
import features.sessiongeneration.domain.generation.GenerationRewardBatch;
import features.sessiongeneration.domain.generation.GenerationRewardReference;
import features.sessiongeneration.domain.generation.GenerationRunCommitResult;
import features.sessiongeneration.domain.generation.GenerationRunIdentityConflictException;
import features.sessiongeneration.domain.generation.GenerationRunRepository;
import platform.persistence.FeatureStoreDefinition;
import platform.persistence.FeatureStoreHandle;
import platform.persistence.SqliteMigration;
import platform.persistence.SqliteSchemaValidator;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Diagnostics;
import platform.diagnostics.Measurement;
import platform.diagnostics.NoopDiagnostics;

public final class SqliteGenerationRunRepository implements GenerationRunRepository {

    public static final String OWNER = "session-generation";
    public static final int SCHEMA_VERSION = 2;
    static final int RUN_SCHEMA_VERSION = 1;

    private final ConnectionSource connections;
    private final GenerationRunSqliteReader reader = new GenerationRunSqliteReader();
    private final GenerationRunSqliteWriter writer = new GenerationRunSqliteWriter();
    private final GenerationRewardSqliteReader rewardReader = new GenerationRewardSqliteReader();
    private final GeneratedRunValidator validator = new GeneratedRunValidator();
    private final Diagnostics diagnostics;
    private static final DiagnosticId REWARD_READ = new DiagnosticId("sessiongeneration.reward.read");

    public static FeatureStoreDefinition storeDefinition() {
        SessionGenerationSchema schema = new SessionGenerationSchema();
        SqliteSchemaValidator targetSchema = SqliteSchemaValidator.builder()
                .table(SessionGenerationSchema.RUNS,
                        "run_id", "owner", "schema_version", "engine_version", "catalog_version", "catalog_hash",
                        "seed", "adventure_fraction", "encounter_count", "party_count", "day_xp_budget",
                        "session_xp_target", "average_level", "normal_budget_cp", "overstock_budget_cp",
                        "nonmagic_slots", "normal_magic", "overstock_magic", "treasure_count", "normal_actual_cp",
                        "overstock_actual_cp", "magic_count", "formatted_text", "created_at", "content_fingerprint")
                .primaryKey(SessionGenerationSchema.RUNS, "run_id")
                .table(SessionGenerationSchema.PARTY, "run_id", "level", "players", "sort_order")
                .primaryKey(SessionGenerationSchema.PARTY, "run_id", "level")
                .table(SessionGenerationSchema.TARGETS, "run_id", "encounter_no", "target_xp", "sort_order")
                .primaryKey(SessionGenerationSchema.TARGETS, "run_id", "encounter_no")
                .table(SessionGenerationSchema.ENCOUNTERS,
                        "run_id", "encounter_no", "target_xp", "adjusted_xp", "difficulty", "candidate_id",
                        "monster_summary", "monster_count", "multiplier", "max_challenge_code", "boss_score",
                        "sort_order")
                .primaryKey(SessionGenerationSchema.ENCOUNTERS, "run_id", "encounter_no")
                .table(SessionGenerationSchema.ENCOUNTER_BLOCKS,
                        "run_id", "encounter_no", "block_order", "block_id", "role", "challenge_code",
                        "challenge_label", "unit_xp", "quantity")
                .primaryKey(SessionGenerationSchema.ENCOUNTER_BLOCKS, "run_id", "encounter_no", "block_order")
                .table(SessionGenerationSchema.TREASURES,
                        "run_id", "treasure_id", "stock_class", "reward_channel", "anchor_encounter_no", "theme",
                        "magic_type", "target_cp", "nonmagic_slots", "magic_slots", "sort_order")
                .primaryKey(SessionGenerationSchema.TREASURES, "run_id", "treasure_id")
                .table(SessionGenerationSchema.LOOT,
                        "run_id", "line_id", "treasure_id", "role", "item_id", "display_text", "quantity",
                        "unit_cp", "actual_cp", "total_capacity", "allowed_containers", "magic_rarity", "cursed",
                        "sort_order")
                .primaryKey(SessionGenerationSchema.LOOT, "run_id", "line_id")
                .table(SessionGenerationSchema.PACKING,
                        "run_id", "line_id", "treasure_id", "container_type", "container_count", "container_id",
                        "valid", "sort_order")
                .primaryKey(SessionGenerationSchema.PACKING, "run_id", "line_id")
                .table(SessionGenerationSchema.AUDITS, "run_id", "audit_order", "code", "status", "detail")
                .primaryKey(SessionGenerationSchema.AUDITS, "run_id", "audit_order")
                .build();
        return FeatureStoreDefinition.validated(
                OWNER, targetSchema,
                new SqliteMigration(1, schema::migrateV1),
                new SqliteMigration(2, schema::migrateV2));
    }

    public SqliteGenerationRunRepository(FeatureStoreHandle store) {
        this(store, NoopDiagnostics.INSTANCE);
    }

    public SqliteGenerationRunRepository(FeatureStoreHandle store, Diagnostics diagnostics) {
        this.connections = FeatureStoreHandle.requireOwner(store, OWNER)::openConnection;
        this.diagnostics = Objects.requireNonNull(diagnostics, "diagnostics");
    }

    SqliteGenerationRunRepository(ConnectionSource connections) {
        this.connections = Objects.requireNonNull(connections, "connections");
        this.diagnostics = NoopDiagnostics.INSTANCE;
    }

    @Override
    public GenerationRunCommitResult commit(GeneratedRunDraft draft) {
        validateDraft(draft);
        try (Connection connection = connections.openConnection()) {
            return commitTransaction(connection, draft);
        } catch (GenerationRunIdentityConflictException exception) {
            throw exception;
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to commit session-generation run.", exception);
        }
    }

    @Override
    public Optional<GeneratedRunDraft> load(String runId) {
        Objects.requireNonNull(runId, "runId");
        try (Connection connection = connections.openConnection()) {
            return reader.loadStored(connection, runId).map(this::validatedDraft);
        } catch (SQLException | IllegalArgumentException exception) {
            throw new IllegalStateException("Failed to load session-generation run.", exception);
        }
    }

    @Override
    public GenerationRewardBatch loadRewards(List<GenerationRewardReference> references) {
        List<GenerationRewardReference> safeReferences = List.copyOf(references);
        if (safeReferences.isEmpty()) {
            return new GenerationRewardBatch(List.of(), List.of());
        }
        try (Connection connection = connections.openConnection()) {
            long startedNanos = System.nanoTime();
            GenerationRewardSqliteReader.ReadResult read = rewardReader.load(connection, safeReferences);
            diagnostics.measurement(new Measurement(
                    REWARD_READ, 0L, Math.max(0L, System.nanoTime() - startedNanos),
                    safeReferences.size(), read.statementCount()));
            return read.batch();
        } catch (SQLException | IllegalArgumentException exception) {
            throw new IllegalStateException("Failed to load session-generation rewards.", exception);
        }
    }

    @FunctionalInterface
    interface ConnectionSource {
        Connection openConnection() throws SQLException;
    }

    private GenerationRunCommitResult commitTransaction(Connection connection, GeneratedRunDraft draft)
            throws SQLException {
        boolean autoCommit = connection.getAutoCommit();
        connection.setAutoCommit(false);
        try {
            try {
                // Insert-first acquires SQLite write intent without creating a stale read snapshot.
                // A concurrent/equal identity resolves through the root uniqueness constraint,
                // after which rollback plus canonical reread decides already-present vs conflict.
                writer.insert(connection, draft);
                connection.commit();
                return new GenerationRunCommitResult(draft, GenerationRunCommitResult.Outcome.INSERTED);
            } catch (SQLException insertionFailure) {
                connection.rollback();
                Optional<StoredGeneratedRun> raced = reader.loadStored(connection, draft.run().runId());
                if (raced.isPresent()) {
                    return decideExisting(raced.orElseThrow(), draft);
                }
                throw insertionFailure;
            }
        } catch (SQLException | RuntimeException exception) {
            connection.rollback();
            throw exception;
        } finally {
            connection.setAutoCommit(autoCommit);
        }
    }

    private GenerationRunCommitResult decideExisting(StoredGeneratedRun stored, GeneratedRunDraft requested) {
        GeneratedRunDraft existing = validatedDraft(stored);
        if (!existing.contentFingerprint().equals(requested.contentFingerprint())) {
            throw new GenerationRunIdentityConflictException(requested.run().runId());
        }
        return new GenerationRunCommitResult(existing, GenerationRunCommitResult.Outcome.ALREADY_PRESENT);
    }

    private GeneratedRunDraft validatedDraft(StoredGeneratedRun stored) {
        validator.validate(stored.run());
        String derived = GenerationContentFingerprint.v1(stored.run());
        if (stored.storedFingerprint() != null && !stored.storedFingerprint().equals(derived)) {
            throw new IllegalStateException("stored generation content fingerprint does not match semantic rows");
        }
        return new GeneratedRunDraft(stored.run(), derived);
    }

    private void validateDraft(GeneratedRunDraft draft) {
        Objects.requireNonNull(draft, "draft");
        validator.validate(draft.run());
        String derived = GenerationContentFingerprint.v1(draft.run());
        if (!draft.contentFingerprint().equals(derived)) {
            throw new IllegalStateException("generation draft content fingerprint does not match semantic content");
        }
    }
}
