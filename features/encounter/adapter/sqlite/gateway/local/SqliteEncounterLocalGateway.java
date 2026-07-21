package features.encounter.adapter.sqlite.gateway.local;

import features.encounter.adapter.sqlite.model.EncounterPlanCreatureRecord;
import features.encounter.adapter.sqlite.model.EncounterPlanRecord;
import features.encounter.adapter.sqlite.model.EncounterPlanSnapshotRecord;
import features.encounter.adapter.sqlite.model.EncounterPersistenceSchema;
import features.encounter.application.GeneratedEncounterBatchRepository;

import platform.persistence.FeatureStoreDefinition;
import platform.persistence.FeatureStoreHandle;
import platform.persistence.SqliteMigration;
import platform.persistence.SqliteSchemaValidator;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

public final class SqliteEncounterLocalGateway {

    public record BatchReadResult(List<EncounterPlanSnapshotRecord> plans, int statementCount) {
        public BatchReadResult {
            plans = List.copyOf(plans);
        }
    }

    private static final String OWNER = "encounter";
    private final FeatureStoreHandle connections;
    private final EncounterPlanSqliteStore store;
    private final GeneratedEncounterBatchSqliteStore generatedBatches;
    private final EncounterPlanBatchReadSqliteStore batchReads;
    private final EncounterPlanSearchSqliteStore searches;

    public static FeatureStoreDefinition storeDefinition() {
        EncounterSchemaMigrator schemaMigrator = new EncounterSchemaMigrator();
        SqliteSchemaValidator targetSchema = SqliteSchemaValidator.builder()
                .table(EncounterPersistenceSchema.ENCOUNTER_PLANS)
                .primaryKey(EncounterPersistenceSchema.ENCOUNTER_PLANS.name(), "plan_id")
                .table(EncounterPersistenceSchema.ENCOUNTER_PLAN_CREATURES)
                .primaryKey(EncounterPersistenceSchema.ENCOUNTER_PLAN_CREATURES.name(), "plan_id", "creature_id")
                .table(EncounterPersistenceSchema.GENERATED_ENCOUNTER_PLAN_BATCHES_TABLE_NAME,
                        "engine_version", "generation_id", "preparation_id", "batch_fingerprint", "encounter_count")
                .primaryKey(EncounterPersistenceSchema.GENERATED_ENCOUNTER_PLAN_BATCHES_TABLE_NAME,
                        "engine_version", "generation_id")
                .table(EncounterPersistenceSchema.GENERATED_ENCOUNTER_PLAN_ORIGINS_TABLE_NAME,
                        "engine_version", "generation_id", "encounter_number", "batch_order", "spec_fingerprint",
                        "roster_fingerprint", "plan_id")
                .primaryKey(EncounterPersistenceSchema.GENERATED_ENCOUNTER_PLAN_ORIGINS_TABLE_NAME,
                        "engine_version", "generation_id", "encounter_number")
                .table("encounter_runtime_meta", "singleton_id", "source_revision", "focused_context_id")
                .primaryKey("encounter_runtime_meta", "singleton_id")
                .table("encounter_runtime_contexts",
                        "context_id", "mode", "status", "location_id", "initial_plan_id", "active_saved_plan_id",
                        "next_undo_token", "current_turn_index", "round_number", "target_difficulty",
                        "balance_level", "amount_value", "diversity_level", "builder_world_location_id",
                        "result_defeated_count", "result_eligible_xp", "result_per_player_xp",
                        "result_gold_summary", "result_loot_detail", "result_award_status", "result_xp_awarded",
                        "result_can_award_xp", "result_party_size")
                .primaryKey("encounter_runtime_contexts", "context_id")
                .table("encounter_runtime_party", "context_id", "sort_order", "party_member_id")
                .primaryKey("encounter_runtime_party", "context_id", "sort_order")
                .foreignKey("encounter_runtime_party", "encounter_runtime_contexts", "CASCADE",
                        SqliteSchemaValidator.reference("context_id", "context_id"))
                .table("encounter_runtime_npcs",
                        "context_id", "sort_order", "world_npc_id", "statblock_id", "role")
                .primaryKey("encounter_runtime_npcs", "context_id", "sort_order")
                .foreignKey("encounter_runtime_npcs", "encounter_runtime_contexts", "CASCADE",
                        SqliteSchemaValidator.reference("context_id", "context_id"))
                .table("encounter_runtime_builder_values",
                        "context_id", "value_kind", "sort_order", "text_value", "integer_key", "integer_value")
                .primaryKey("encounter_runtime_builder_values", "context_id", "value_kind", "sort_order")
                .foreignKey("encounter_runtime_builder_values", "encounter_runtime_contexts", "CASCADE",
                        SqliteSchemaValidator.reference("context_id", "context_id"))
                .table("encounter_runtime_builder_state",
                        "context_id", "selected_alternative_index", "generated_adjusted_xp", "generated_difficulty",
                        "generated_title", "generation_history_present", "dirty")
                .primaryKey("encounter_runtime_builder_state", "context_id")
                .foreignKey("encounter_runtime_builder_state", "encounter_runtime_contexts", "CASCADE",
                        SqliteSchemaValidator.reference("context_id", "context_id"))
                .table("encounter_runtime_generation_advisories", "context_id", "sort_order", "advisory")
                .primaryKey("encounter_runtime_generation_advisories", "context_id", "sort_order")
                .foreignKey("encounter_runtime_generation_advisories", "encounter_runtime_contexts", "CASCADE",
                        SqliteSchemaValidator.reference("context_id", "context_id"))
                .table("encounter_runtime_generated_alternatives",
                        "context_id", "sort_order", "title", "difficulty_label", "adjusted_xp")
                .primaryKey("encounter_runtime_generated_alternatives", "context_id", "sort_order")
                .foreignKey("encounter_runtime_generated_alternatives", "encounter_runtime_contexts", "CASCADE",
                        SqliteSchemaValidator.reference("context_id", "context_id"))
                .table("encounter_runtime_generated_alternative_advisories",
                        "context_id", "alternative_order", "sort_order", "advisory")
                .primaryKey("encounter_runtime_generated_alternative_advisories",
                        "context_id", "alternative_order", "sort_order")
                .foreignKey("encounter_runtime_generated_alternative_advisories",
                        "encounter_runtime_generated_alternatives", "CASCADE",
                        SqliteSchemaValidator.reference("context_id", "context_id"),
                        SqliteSchemaValidator.reference("alternative_order", "sort_order"))
                .table("encounter_runtime_generated_alternative_roster",
                        "context_id", "alternative_order", "sort_order", "row_id", "creature_id", "world_npc_id",
                        "name", "challenge_rating", "xp", "hp", "armor_class", "initiative_bonus", "creature_type",
                        "encounter_role", "creature_count")
                .primaryKey("encounter_runtime_generated_alternative_roster",
                        "context_id", "alternative_order", "sort_order")
                .foreignKey("encounter_runtime_generated_alternative_roster",
                        "encounter_runtime_generated_alternatives", "CASCADE",
                        SqliteSchemaValidator.reference("context_id", "context_id"),
                        SqliteSchemaValidator.reference("alternative_order", "sort_order"))
                .table("encounter_runtime_generated_alternative_roster_tags",
                        "context_id", "alternative_order", "roster_order", "sort_order", "tag")
                .primaryKey("encounter_runtime_generated_alternative_roster_tags",
                        "context_id", "alternative_order", "roster_order", "sort_order")
                .foreignKey("encounter_runtime_generated_alternative_roster_tags",
                        "encounter_runtime_generated_alternative_roster", "CASCADE",
                        SqliteSchemaValidator.reference("context_id", "context_id"),
                        SqliteSchemaValidator.reference("alternative_order", "alternative_order"),
                        SqliteSchemaValidator.reference("roster_order", "sort_order"))
                .table("encounter_runtime_roster",
                        "context_id", "sort_order", "row_id", "creature_id", "world_npc_id", "name",
                        "challenge_rating", "xp", "hp", "armor_class", "initiative_bonus", "creature_type",
                        "encounter_role", "creature_count")
                .primaryKey("encounter_runtime_roster", "context_id", "sort_order")
                .foreignKey("encounter_runtime_roster", "encounter_runtime_contexts", "CASCADE",
                        SqliteSchemaValidator.reference("context_id", "context_id"))
                .table("encounter_runtime_roster_tags", "context_id", "roster_order", "sort_order", "tag")
                .primaryKey("encounter_runtime_roster_tags", "context_id", "roster_order", "sort_order")
                .foreignKey("encounter_runtime_roster_tags", "encounter_runtime_roster", "CASCADE",
                        SqliteSchemaValidator.reference("context_id", "context_id"),
                        SqliteSchemaValidator.reference("roster_order", "sort_order"))
                .table("encounter_runtime_initiative",
                        "context_id", "sort_order", "row_id", "label", "kind", "initiative")
                .primaryKey("encounter_runtime_initiative", "context_id", "sort_order")
                .foreignKey("encounter_runtime_initiative", "encounter_runtime_contexts", "CASCADE",
                        SqliteSchemaValidator.reference("context_id", "context_id"))
                .table("encounter_runtime_combatants",
                        "context_id", "sort_order", "combatant_id", "name", "kind", "creature_id", "world_npc_id",
                        "current_hp", "max_hp", "armor_class", "initiative", "combatant_count", "xp", "detail",
                        "loot", "turn_order")
                .primaryKey("encounter_runtime_combatants", "context_id", "sort_order")
                .foreignKey("encounter_runtime_combatants", "encounter_runtime_contexts", "CASCADE",
                        SqliteSchemaValidator.reference("context_id", "context_id"))
                .table("encounter_runtime_result_enemies",
                        "context_id", "sort_order", "name", "creature_id", "world_npc_id", "status", "hp_loss", "xp",
                        "defeated_by_default", "loot")
                .primaryKey("encounter_runtime_result_enemies", "context_id", "sort_order")
                .foreignKey("encounter_runtime_result_enemies", "encounter_runtime_contexts", "CASCADE",
                        SqliteSchemaValidator.reference("context_id", "context_id"))
                .index("idx_saved_encounter_plans_updated",
                        EncounterPersistenceSchema.ENCOUNTER_PLANS.name(), false, "updated_at", "plan_id")
                .index("idx_saved_encounter_plan_creatures_plan",
                        EncounterPersistenceSchema.ENCOUNTER_PLAN_CREATURES.name(), false, "plan_id", "sort_order")
                .index("idx_generated_encounter_preparation_identity",
                        EncounterPersistenceSchema.GENERATED_ENCOUNTER_PLAN_BATCHES_TABLE_NAME,
                        true, "engine_version", "preparation_id")
                .build();
        return FeatureStoreDefinition.validated(
                OWNER, targetSchema,
                new SqliteMigration(1, schemaMigrator::ensureSchema),
                new SqliteMigration(2, schemaMigrator::ensureGeneratedPlanOrigins),
                new SqliteMigration(3, schemaMigrator::ensureRuntimeContexts),
                new SqliteMigration(4, schemaMigrator::ensureGeneratedBatchV4),
                new SqliteMigration(5, schemaMigrator::repairTargetSchema));
    }

    public SqliteEncounterLocalGateway(FeatureStoreHandle store) {
        this.connections = FeatureStoreHandle.requireOwner(store, OWNER);
        this.store = new EncounterPlanSqliteStore();
        this.generatedBatches = new GeneratedEncounterBatchSqliteStore();
        this.batchReads = new EncounterPlanBatchReadSqliteStore();
        this.searches = new EncounterPlanSearchSqliteStore();
    }

    public EncounterPlanSnapshotRecord save(
            EncounterPlanRecord plan,
            List<EncounterPlanCreatureRecord> creatures
    ) {
        Objects.requireNonNull(plan, "plan");
        Objects.requireNonNull(creatures, "creatures");
        try (Connection connection = openReadyConnection()) {
            return saveInTransaction(connection, plan, creatures);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to save encounter plan to SQLite.", exception);
        }
    }

    public Optional<EncounterPlanSnapshotRecord> load(long planId) {
        try (Connection connection = openReadyConnection()) {
            Optional<EncounterPlanRecord> plan = store.loadPlan(connection, planId);
            if (plan.isEmpty()) {
                return Optional.empty();
            }
            List<EncounterPlanCreatureRecord> creatures = store.loadCreatures(connection, planId);
            return Optional.of(new EncounterPlanSnapshotRecord(
                    plan.get(),
                    creatures,
                    generatedBatches.loadOrigin(connection, planId, creatures)));
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to load encounter plan from SQLite.", exception);
        }
    }

    public List<EncounterPlanRecord> list() {
        try (Connection connection = openReadyConnection()) {
            return store.listPlans(connection);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to list encounter plans from SQLite.", exception);
        }
    }

    public GeneratedEncounterBatchRepository.CommitOutcome commitGeneratedBatch(
            features.encounter.api.PreparedEncounterBatch batch
    ) {
        Objects.requireNonNull(batch, "batch");
        try (Connection connection = openReadyConnection()) {
            boolean previousAutoCommit = connection.getAutoCommit();
            connection.setAutoCommit(false);
            try {
                // Insert-first acquires SQLite write intent before any read snapshot exists.
                // A concurrent canonical identity is resolved after rollback by rereading
                // the winner's committed semantic batch.
                generatedBatches.insertBatch(connection, batch);
                List<GeneratedEncounterBatchRepository.Mapping> mappings =
                        store.insertGeneratedPlans(connection, batch.rosters());
                store.insertGeneratedCreatures(connection, batch.rosters(), mappings);
                generatedBatches.insertOrigins(connection, batch, mappings);
                connection.commit();
                return new GeneratedEncounterBatchRepository.CommitOutcome(
                        GeneratedEncounterBatchRepository.CommitOutcome.Status.COMMITTED, mappings);
            } catch (SQLException exception) {
                connection.rollback();
                Optional<GeneratedEncounterBatchSqliteStore.StoredBatch> raced = generatedBatches.load(connection, batch);
                if (raced.isPresent()) {
                    return retryOutcome(batch, raced.orElseThrow());
                }
                throw exception;
            } finally {
                connection.setAutoCommit(previousAutoCommit);
            }
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to commit generated encounter batch to SQLite.", exception);
        }
    }

    public List<EncounterPlanSnapshotRecord> loadPlansByIds(List<Long> planIds) {
        return loadPlansByIdsWithCount(planIds).plans();
    }

    public BatchReadResult loadPlansByIdsWithCount(List<Long> planIds) {
        Objects.requireNonNull(planIds, "planIds");
        try (Connection connection = openReadyConnection()) {
            EncounterPlanBatchReadSqliteStore.ReadResult read = batchReads.load(connection, planIds);
            return new BatchReadResult(read.plans(), read.statementCount());
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to load encounter plans by IDs from SQLite.", exception);
        }
    }

    public features.encounter.application.SavedEncounterPlanSearchRepository.SearchRead searchSavedPlans(
            String normalizedQuery,
            int rootLimit
    ) {
        Objects.requireNonNull(normalizedQuery, "normalizedQuery");
        if (rootLimit <= 0) {
            throw new IllegalArgumentException("rootLimit must be positive");
        }
        try (Connection connection = openReadyConnection()) {
            List<features.encounter.domain.plan.EncounterPlanSummary> plans = searches.search(
                    connection, normalizedQuery, rootLimit).stream()
                    .map(features.encounter.adapter.sqlite.mapper.EncounterPlanMapper::toDomainSummary)
                    .toList();
            return new features.encounter.application.SavedEncounterPlanSearchRepository.SearchRead(plans, 1);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to search saved encounter plans in SQLite.", exception);
        }
    }

    private GeneratedEncounterBatchRepository.CommitOutcome retryOutcome(
            features.encounter.api.PreparedEncounterBatch batch,
            GeneratedEncounterBatchSqliteStore.StoredBatch stored
    ) {
        if (!generatedBatches.equalsRequested(stored, batch)) {
            return new GeneratedEncounterBatchRepository.CommitOutcome(
                    GeneratedEncounterBatchRepository.CommitOutcome.Status.CONFLICT, List.of());
        }
        return new GeneratedEncounterBatchRepository.CommitOutcome(
                GeneratedEncounterBatchRepository.CommitOutcome.Status.EQUAL_RETRY,
                generatedBatches.mappings(stored));
    }

    private Optional<EncounterPlanSnapshotRecord> loadSaved(Connection connection, long planId) throws SQLException {
        Optional<EncounterPlanRecord> plan = store.loadPlan(connection, planId);
        if (plan.isEmpty()) {
            return Optional.empty();
        }
        List<EncounterPlanCreatureRecord> creatures = store.loadCreatures(connection, planId);
        return Optional.of(new EncounterPlanSnapshotRecord(
                plan.get(), creatures, generatedBatches.loadOrigin(connection, planId, creatures)));
    }

    private EncounterPlanSnapshotRecord saveInTransaction(
            Connection connection,
            EncounterPlanRecord plan,
            List<EncounterPlanCreatureRecord> creatures
    ) throws SQLException {
        boolean previousAutoCommit = connection.getAutoCommit();
        connection.setAutoCommit(false);
        try {
            long planId = store.savePlan(connection, plan);
            store.replaceCreatures(connection, planId, creatures);
            connection.commit();
            return loadSaved(connection, planId)
                    .orElseThrow(() -> new IllegalStateException("Saved encounter plan vanished after save."));
        } catch (SQLException exception) {
            connection.rollback();
            throw exception;
        } finally {
            connection.setAutoCommit(previousAutoCommit);
        }
    }

    private Connection openReadyConnection() throws SQLException {
        return connections.openConnection();
    }
}
