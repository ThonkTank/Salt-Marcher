package features.encounter.adapter.sqlite.gateway.local;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import platform.persistence.SqliteConnectionSource;
import platform.persistence.SqliteDatabase;
import platform.persistence.SqliteMigration;
import features.encounter.api.EncounterRuntimeContextId;
import features.encounter.api.EncounterRuntimeContextSpec;
import features.encounter.api.EncounterRuntimeNpcRole;
import features.encounter.api.EncounterRuntimeNpcSpec;
import features.encounter.application.EncounterRuntimeContextRepository;
import features.encounter.domain.generation.EncounterGenerationInputs;
import features.encounter.domain.generation.EncounterRequestedDifficulty;
import features.encounter.domain.generation.EncounterTuningIntent;
import features.encounter.domain.session.Combatant;
import features.encounter.domain.session.CombatantKind;
import features.encounter.domain.session.EncounterCreatureData;
import features.encounter.domain.session.EncounterSessionMemento;
import features.encounter.domain.session.GeneratedEncounterData;
import features.encounter.domain.session.InitiativeEntryData;
import features.encounter.domain.session.ResultEnemyData;
import features.encounter.domain.session.ResultStateData;

/** Relational persistence for every Scene-scoped Encounter runtime. */
public final class SqliteEncounterRuntimeContextRepository implements EncounterRuntimeContextRepository {

    private final SqliteConnectionSource connections;

    public SqliteEncounterRuntimeContextRepository(SqliteDatabase database) {
        EncounterSchemaMigrator migrations = new EncounterSchemaMigrator();
        connections = database.connections(
                "encounter",
                new SqliteMigration(1, migrations::ensureSchema),
                new SqliteMigration(2, migrations::ensureGeneratedPlanOrigins),
                new SqliteMigration(3, migrations::ensureRuntimeContexts));
    }

    @Override
    public StoredRuntimeContexts load() {
        try (Connection connection = connections.openConnection()) {
            Meta meta = loadMeta(connection);
            if (meta == null) {
                return StoredRuntimeContexts.empty();
            }
            List<StoredRuntimeContext> contexts = new ArrayList<>();
            try (PreparedStatement statement = connection.prepareStatement(
                    "SELECT * FROM encounter_runtime_contexts ORDER BY context_id");
                 ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    contexts.add(readContext(connection, rows));
                }
            }
            return new StoredRuntimeContexts(
                    meta.sourceRevision(),
                    new EncounterRuntimeContextId(meta.focusedContextId()),
                    contexts);
        } catch (SQLException | RuntimeException exception) {
            throw new IllegalStateException("Failed to load Encounter runtime contexts.", exception);
        }
    }

    @Override
    public void replace(StoredRuntimeContexts contexts) {
        try (Connection connection = connections.openConnection()) {
            boolean autoCommit = connection.getAutoCommit();
            connection.setAutoCommit(false);
            try {
                connection.createStatement().executeUpdate("DELETE FROM encounter_runtime_meta");
                connection.createStatement().executeUpdate("DELETE FROM encounter_runtime_contexts");
                for (StoredRuntimeContext context : contexts.contexts()) {
                    writeContext(connection, context);
                }
                if (contexts.focusedContextId() != null) {
                    try (PreparedStatement statement = connection.prepareStatement(
                            "INSERT INTO encounter_runtime_meta(singleton_id, source_revision, focused_context_id) "
                                    + "VALUES(1, ?, ?)")) {
                        statement.setLong(1, contexts.sourceRevision());
                        statement.setString(2, contexts.focusedContextId().value());
                        statement.executeUpdate();
                    }
                }
                connection.commit();
            } catch (SQLException | RuntimeException exception) {
                connection.rollback();
                throw exception;
            } finally {
                connection.setAutoCommit(autoCommit);
            }
        } catch (SQLException | RuntimeException exception) {
            throw new IllegalStateException("Failed to save Encounter runtime contexts.", exception);
        }
    }

    private static Meta loadMeta(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT source_revision, focused_context_id FROM encounter_runtime_meta WHERE singleton_id=1");
             ResultSet rows = statement.executeQuery()) {
            return rows.next() ? new Meta(rows.getLong(1), rows.getString(2)) : null;
        }
    }

    private static StoredRuntimeContext readContext(Connection connection, ResultSet root) throws SQLException {
        String contextId = root.getString("context_id");
        EncounterRuntimeContextSpec specification = new EncounterRuntimeContextSpec(
                new EncounterRuntimeContextId(contextId),
                loadLongs(connection, "encounter_runtime_party", "party_member_id", contextId),
                root.getLong("location_id"),
                root.getLong("initial_plan_id"),
                loadNpcs(connection, contextId));
        EncounterGenerationInputs inputs = loadInputs(connection, root, contextId);
        GenerationState generation = loadGenerationState(connection, contextId);
        ResultStateData result = new ResultStateData(
                loadResultEnemies(connection, contextId),
                root.getLong("result_defeated_count"),
                root.getInt("result_eligible_xp"),
                root.getInt("result_per_player_xp"),
                root.getString("result_gold_summary"),
                root.getString("result_loot_detail"),
                root.getString("result_award_status"),
                root.getInt("result_xp_awarded") != 0,
                root.getInt("result_can_award_xp") != 0,
                root.getInt("result_party_size"));
        EncounterSessionMemento memento = new EncounterSessionMemento(
                root.getInt("mode"),
                root.getString("status"),
                inputs,
                generation.alternatives(),
                generation.advisories(),
                generation.selectedAlternativeIndex(),
                generation.adjustedXp(),
                generation.difficulty(),
                generation.title(),
                generation.historyPresent(),
                generation.dirty(),
                loadRoster(connection, contextId),
                Optional.empty(),
                root.getLong("next_undo_token"),
                root.getLong("active_saved_plan_id"),
                loadInitiative(connection, contextId),
                loadCombatants(connection, contextId),
                root.getInt("current_turn_index"),
                root.getInt("round_number"),
                result);
        return new StoredRuntimeContext(specification, memento);
    }

    private static void writeContext(Connection connection, StoredRuntimeContext stored) throws SQLException {
        EncounterRuntimeContextSpec spec = stored.specification();
        EncounterSessionMemento session = stored.session();
        EncounterGenerationInputs inputs = session.builderInputs();
        ResultStateData result = session.resultState();
        try (PreparedStatement statement = connection.prepareStatement(
                "INSERT INTO encounter_runtime_contexts VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")) {
            int index = 1;
            statement.setString(index++, spec.contextId().value());
            statement.setInt(index++, session.mode());
            statement.setString(index++, session.status());
            statement.setLong(index++, spec.locationId());
            statement.setLong(index++, spec.initialEncounterPlanId());
            statement.setLong(index++, session.activeSavedPlanId());
            statement.setLong(index++, session.nextUndoToken());
            statement.setInt(index++, session.currentTurnIndex());
            statement.setInt(index++, session.round());
            statement.setString(index++, inputs.targetDifficulty().name());
            statement.setInt(index++, inputs.tuning().balanceLevel());
            statement.setDouble(index++, inputs.tuning().amountValue());
            statement.setInt(index++, inputs.tuning().diversityLevel());
            statement.setLong(index++, inputs.worldLocationId());
            statement.setLong(index++, result.defeatedCount());
            statement.setInt(index++, result.eligibleXp());
            statement.setInt(index++, result.perPlayerXp());
            statement.setString(index++, result.goldSummary());
            statement.setString(index++, result.lootDetail());
            statement.setString(index++, result.awardStatus());
            statement.setInt(index++, result.xpAwarded() ? 1 : 0);
            statement.setInt(index++, result.canAwardXp() ? 1 : 0);
            statement.setInt(index++, result.partySize());
            statement.executeUpdate();
        }
        writeLongs(connection, "encounter_runtime_party", "party_member_id", spec.contextId().value(), spec.partyMemberIds());
        writeNpcs(connection, spec);
        writeInputs(connection, spec.contextId().value(), inputs);
        writeGenerationState(connection, spec.contextId().value(), session);
        writeRoster(connection, spec.contextId().value(), session.roster());
        writeInitiative(connection, spec.contextId().value(), session.initiativeEntries());
        writeCombatants(connection, spec.contextId().value(), session.combatants());
        writeResultEnemies(connection, spec.contextId().value(), result.enemies());
    }

    private static EncounterGenerationInputs loadInputs(Connection connection, ResultSet root, String contextId)
            throws SQLException {
        Map<String, List<ValueRow>> values = loadValues(connection, contextId);
        Map<Long, Integer> caps = new LinkedHashMap<>();
        for (ValueRow row : values.getOrDefault("stock-cap", List.of())) {
            caps.put(row.integerKey(), row.integerValue());
        }
        return new EncounterGenerationInputs(
                texts(values, "creature-type"),
                texts(values, "creature-subtype"),
                texts(values, "biome"),
                EncounterRequestedDifficulty.valueOf(root.getString("target_difficulty")),
                new EncounterTuningIntent(
                        root.getInt("balance_level"),
                        root.getDouble("amount_value"),
                        root.getInt("diversity_level")),
                integers(values, "encounter-table"),
                integers(values, "world-faction"),
                root.getLong("builder_world_location_id"),
                firstText(values, "name-query"),
                firstText(values, "challenge-rating-min"),
                firstText(values, "challenge-rating-max"),
                texts(values, "size"),
                texts(values, "alignment"),
                caps);
    }

    private static GenerationState loadGenerationState(Connection connection, String contextId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT selected_alternative_index, generated_adjusted_xp, generated_difficulty, generated_title, "
                        + "generation_history_present, dirty FROM encounter_runtime_builder_state WHERE context_id=?")) {
            statement.setString(1, contextId);
            try (ResultSet rows = statement.executeQuery()) {
                if (!rows.next()) {
                    return GenerationState.empty();
                }
                return new GenerationState(
                        loadGeneratedAlternatives(connection, contextId),
                        loadStrings(connection, "encounter_runtime_generation_advisories", "advisory", contextId),
                        rows.getInt("selected_alternative_index"),
                        rows.getInt("generated_adjusted_xp"),
                        rows.getString("generated_difficulty"),
                        rows.getString("generated_title"),
                        rows.getInt("generation_history_present") != 0,
                        rows.getInt("dirty") != 0);
            }
        }
    }

    private static void writeGenerationState(
            Connection connection,
            String contextId,
            EncounterSessionMemento session
    ) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "INSERT INTO encounter_runtime_builder_state VALUES(?,?,?,?,?,?,?)")) {
            statement.setString(1, contextId);
            statement.setInt(2, session.selectedAlternativeIndex());
            statement.setInt(3, session.generatedAdjustedXp());
            statement.setString(4, session.generatedDifficulty());
            statement.setString(5, session.generatedTitle());
            statement.setInt(6, session.generationHistoryPresent() ? 1 : 0);
            statement.setInt(7, session.dirty() ? 1 : 0);
            statement.executeUpdate();
        }
        writeStrings(
                connection,
                "encounter_runtime_generation_advisories",
                "advisory",
                contextId,
                session.generatedAdvisories());
        writeGeneratedAlternatives(connection, contextId, session.generatedAlternatives());
    }

    private static void writeInputs(Connection connection, String contextId, EncounterGenerationInputs inputs)
            throws SQLException {
        writeTextValues(connection, contextId, "creature-type", inputs.creatureTypes());
        writeTextValues(connection, contextId, "creature-subtype", inputs.creatureSubtypes());
        writeTextValues(connection, contextId, "biome", inputs.biomes());
        writeTextValues(connection, contextId, "name-query", List.of(inputs.nameQuery()));
        writeTextValues(connection, contextId, "challenge-rating-min", List.of(inputs.challengeRatingMin()));
        writeTextValues(connection, contextId, "challenge-rating-max", List.of(inputs.challengeRatingMax()));
        writeTextValues(connection, contextId, "size", inputs.sizes());
        writeTextValues(connection, contextId, "alignment", inputs.alignments());
        writeIntegerValues(connection, contextId, "encounter-table", inputs.encounterTableIds());
        writeIntegerValues(connection, contextId, "world-faction", inputs.worldFactionIds());
        int order = 0;
        for (Map.Entry<Long, Integer> cap : inputs.finiteCreatureStockCaps().entrySet()) {
            writeValue(connection, contextId, "stock-cap", order++, "", cap.getKey(), cap.getValue());
        }
    }

    private static Map<String, List<ValueRow>> loadValues(Connection connection, String contextId) throws SQLException {
        Map<String, List<ValueRow>> values = new LinkedHashMap<>();
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT value_kind, text_value, integer_key, integer_value "
                        + "FROM encounter_runtime_builder_values WHERE context_id=? ORDER BY value_kind, sort_order")) {
            statement.setString(1, contextId);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    values.computeIfAbsent(rows.getString(1), ignored -> new ArrayList<>())
                            .add(new ValueRow(rows.getString(2), rows.getLong(3), rows.getInt(4)));
                }
            }
        }
        return values;
    }

    private static List<String> texts(Map<String, List<ValueRow>> values, String kind) {
        return values.getOrDefault(kind, List.of()).stream().map(ValueRow::textValue).toList();
    }

    private static String firstText(Map<String, List<ValueRow>> values, String kind) {
        List<ValueRow> rows = values.getOrDefault(kind, List.of());
        return rows.isEmpty() ? "" : rows.getFirst().textValue();
    }

    private static List<Long> integers(Map<String, List<ValueRow>> values, String kind) {
        return values.getOrDefault(kind, List.of()).stream().map(ValueRow::integerKey).toList();
    }

    private static void writeTextValues(Connection connection, String contextId, String kind, List<String> values)
            throws SQLException {
        for (int index = 0; index < values.size(); index++) {
            writeValue(connection, contextId, kind, index, values.get(index), 0L, 0);
        }
    }

    private static void writeIntegerValues(Connection connection, String contextId, String kind, List<Long> values)
            throws SQLException {
        for (int index = 0; index < values.size(); index++) {
            writeValue(connection, contextId, kind, index, "", values.get(index), 0);
        }
    }

    private static void writeValue(
            Connection connection,
            String contextId,
            String kind,
            int order,
            String text,
            long key,
            int value
    ) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "INSERT INTO encounter_runtime_builder_values VALUES(?,?,?,?,?,?)")) {
            statement.setString(1, contextId);
            statement.setString(2, kind);
            statement.setInt(3, order);
            statement.setString(4, text);
            statement.setLong(5, key);
            statement.setInt(6, value);
            statement.executeUpdate();
        }
    }

    private static List<String> loadStrings(
            Connection connection,
            String table,
            String column,
            String contextId
    ) throws SQLException {
        List<String> values = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT " + column + " FROM " + table + " WHERE context_id=? ORDER BY sort_order")) {
            statement.setString(1, contextId);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    values.add(rows.getString(1));
                }
            }
        }
        return List.copyOf(values);
    }

    private static void writeStrings(
            Connection connection,
            String table,
            String column,
            String contextId,
            List<String> values
    ) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "INSERT INTO " + table + "(context_id, sort_order, " + column + ") VALUES(?,?,?)")) {
            for (int index = 0; index < values.size(); index++) {
                statement.setString(1, contextId);
                statement.setInt(2, index);
                statement.setString(3, values.get(index));
                statement.addBatch();
            }
            statement.executeBatch();
        }
    }

    private static List<GeneratedEncounterData> loadGeneratedAlternatives(
            Connection connection,
            String contextId
    ) throws SQLException {
        List<GeneratedEncounterData> alternatives = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT sort_order, title, difficulty_label, adjusted_xp "
                        + "FROM encounter_runtime_generated_alternatives WHERE context_id=? ORDER BY sort_order")) {
            statement.setString(1, contextId);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    int alternativeOrder = rows.getInt("sort_order");
                    alternatives.add(new GeneratedEncounterData(
                            rows.getString("title"),
                            rows.getString("difficulty_label"),
                            rows.getInt("adjusted_xp"),
                            loadGeneratedAlternativeRoster(connection, contextId, alternativeOrder),
                            loadGeneratedAlternativeAdvisories(connection, contextId, alternativeOrder)));
                }
            }
        }
        return List.copyOf(alternatives);
    }

    private static List<String> loadGeneratedAlternativeAdvisories(
            Connection connection,
            String contextId,
            int alternativeOrder
    ) throws SQLException {
        List<String> advisories = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT advisory FROM encounter_runtime_generated_alternative_advisories "
                        + "WHERE context_id=? AND alternative_order=? ORDER BY sort_order")) {
            statement.setString(1, contextId);
            statement.setInt(2, alternativeOrder);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    advisories.add(rows.getString(1));
                }
            }
        }
        return List.copyOf(advisories);
    }

    private static List<EncounterCreatureData> loadGeneratedAlternativeRoster(
            Connection connection,
            String contextId,
            int alternativeOrder
    ) throws SQLException {
        List<EncounterCreatureData> roster = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT * FROM encounter_runtime_generated_alternative_roster "
                        + "WHERE context_id=? AND alternative_order=? ORDER BY sort_order")) {
            statement.setString(1, contextId);
            statement.setInt(2, alternativeOrder);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    int rosterOrder = rows.getInt("sort_order");
                    roster.add(new EncounterCreatureData(
                            rows.getString("row_id"),
                            rows.getLong("creature_id"),
                            rows.getLong("world_npc_id"),
                            rows.getString("name"),
                            rows.getString("challenge_rating"),
                            rows.getInt("xp"),
                            rows.getInt("hp"),
                            rows.getInt("armor_class"),
                            rows.getInt("initiative_bonus"),
                            rows.getString("creature_type"),
                            rows.getString("encounter_role"),
                            rows.getInt("creature_count"),
                            loadGeneratedAlternativeTags(connection, contextId, alternativeOrder, rosterOrder)));
                }
            }
        }
        return List.copyOf(roster);
    }

    private static List<String> loadGeneratedAlternativeTags(
            Connection connection,
            String contextId,
            int alternativeOrder,
            int rosterOrder
    ) throws SQLException {
        List<String> tags = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT tag FROM encounter_runtime_generated_alternative_roster_tags "
                        + "WHERE context_id=? AND alternative_order=? AND roster_order=? ORDER BY sort_order")) {
            statement.setString(1, contextId);
            statement.setInt(2, alternativeOrder);
            statement.setInt(3, rosterOrder);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    tags.add(rows.getString(1));
                }
            }
        }
        return List.copyOf(tags);
    }

    private static void writeGeneratedAlternatives(
            Connection connection,
            String contextId,
            List<GeneratedEncounterData> alternatives
    ) throws SQLException {
        try (PreparedStatement alternative = connection.prepareStatement(
                "INSERT INTO encounter_runtime_generated_alternatives VALUES(?,?,?,?,?)");
             PreparedStatement roster = connection.prepareStatement(
                     "INSERT INTO encounter_runtime_generated_alternative_roster "
                             + "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
             PreparedStatement tag = connection.prepareStatement(
                     "INSERT INTO encounter_runtime_generated_alternative_roster_tags VALUES(?,?,?,?,?)");
             PreparedStatement advisory = connection.prepareStatement(
                     "INSERT INTO encounter_runtime_generated_alternative_advisories VALUES(?,?,?,?)")) {
            for (int alternativeIndex = 0; alternativeIndex < alternatives.size(); alternativeIndex++) {
                GeneratedEncounterData value = alternatives.get(alternativeIndex);
                alternative.setString(1, contextId);
                alternative.setInt(2, alternativeIndex);
                alternative.setString(3, value.title());
                alternative.setString(4, value.difficultyLabel());
                alternative.setInt(5, value.adjustedXp());
                alternative.addBatch();
                writeGeneratedAlternativeRosterRows(
                        roster,
                        tag,
                        contextId,
                        alternativeIndex,
                        value.roster());
                for (int advisoryIndex = 0; advisoryIndex < value.advisoryMessages().size(); advisoryIndex++) {
                    advisory.setString(1, contextId);
                    advisory.setInt(2, alternativeIndex);
                    advisory.setInt(3, advisoryIndex);
                    advisory.setString(4, value.advisoryMessages().get(advisoryIndex));
                    advisory.addBatch();
                }
            }
            alternative.executeBatch();
            roster.executeBatch();
            tag.executeBatch();
            advisory.executeBatch();
        }
    }

    private static void writeGeneratedAlternativeRosterRows(
            PreparedStatement row,
            PreparedStatement tag,
            String contextId,
            int alternativeOrder,
            List<EncounterCreatureData> roster
    ) throws SQLException {
        for (int rosterIndex = 0; rosterIndex < roster.size(); rosterIndex++) {
            EncounterCreatureData creature = roster.get(rosterIndex);
            int column = 1;
            row.setString(column++, contextId);
            row.setInt(column++, alternativeOrder);
            row.setInt(column++, rosterIndex);
            row.setString(column++, creature.id());
            row.setLong(column++, creature.creatureId());
            row.setLong(column++, creature.worldNpcId());
            row.setString(column++, creature.name());
            row.setString(column++, creature.challengeRating());
            row.setInt(column++, creature.xp());
            row.setInt(column++, creature.hp());
            row.setInt(column++, creature.armorClass());
            row.setInt(column++, creature.initiativeBonus());
            row.setString(column++, creature.creatureType());
            row.setString(column++, creature.encounterRole());
            row.setInt(column, creature.count());
            row.addBatch();
            for (int tagIndex = 0; tagIndex < creature.tags().size(); tagIndex++) {
                tag.setString(1, contextId);
                tag.setInt(2, alternativeOrder);
                tag.setInt(3, rosterIndex);
                tag.setInt(4, tagIndex);
                tag.setString(5, creature.tags().get(tagIndex));
                tag.addBatch();
            }
        }
    }

    private static List<Long> loadLongs(Connection connection, String table, String column, String contextId)
            throws SQLException {
        List<Long> values = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT " + column + " FROM " + table + " WHERE context_id=? ORDER BY sort_order")) {
            statement.setString(1, contextId);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    values.add(rows.getLong(1));
                }
            }
        }
        return List.copyOf(values);
    }

    private static void writeLongs(
            Connection connection,
            String table,
            String column,
            String contextId,
            List<Long> values
    ) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "INSERT INTO " + table + "(context_id, sort_order, " + column + ") VALUES(?,?,?)")) {
            for (int index = 0; index < values.size(); index++) {
                statement.setString(1, contextId);
                statement.setInt(2, index);
                statement.setLong(3, values.get(index));
                statement.addBatch();
            }
            statement.executeBatch();
        }
    }

    private static List<EncounterRuntimeNpcSpec> loadNpcs(Connection connection, String contextId) throws SQLException {
        List<EncounterRuntimeNpcSpec> values = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT world_npc_id, statblock_id, role FROM encounter_runtime_npcs "
                        + "WHERE context_id=? ORDER BY sort_order")) {
            statement.setString(1, contextId);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    values.add(new EncounterRuntimeNpcSpec(
                            rows.getLong(1),
                            rows.getLong(2),
                            EncounterRuntimeNpcRole.valueOf(rows.getString(3))));
                }
            }
        }
        return List.copyOf(values);
    }

    private static void writeNpcs(Connection connection, EncounterRuntimeContextSpec spec) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "INSERT INTO encounter_runtime_npcs VALUES(?,?,?,?,?)")) {
            for (int index = 0; index < spec.npcs().size(); index++) {
                EncounterRuntimeNpcSpec npc = spec.npcs().get(index);
                statement.setString(1, spec.contextId().value());
                statement.setInt(2, index);
                statement.setLong(3, npc.worldNpcId());
                statement.setLong(4, npc.statblockId());
                statement.setString(5, npc.role().name());
                statement.addBatch();
            }
            statement.executeBatch();
        }
    }

    private static List<EncounterCreatureData> loadRoster(Connection connection, String contextId) throws SQLException {
        List<EncounterCreatureData> values = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT * FROM encounter_runtime_roster WHERE context_id=? ORDER BY sort_order")) {
            statement.setString(1, contextId);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    int order = rows.getInt("sort_order");
                    values.add(new EncounterCreatureData(
                            rows.getString("row_id"), rows.getLong("creature_id"), rows.getLong("world_npc_id"),
                            rows.getString("name"), rows.getString("challenge_rating"), rows.getInt("xp"),
                            rows.getInt("hp"), rows.getInt("armor_class"), rows.getInt("initiative_bonus"),
                            rows.getString("creature_type"), rows.getString("encounter_role"),
                            rows.getInt("creature_count"), loadTags(connection, contextId, order)));
                }
            }
        }
        return List.copyOf(values);
    }

    private static List<String> loadTags(Connection connection, String contextId, int rosterOrder) throws SQLException {
        List<String> values = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT tag FROM encounter_runtime_roster_tags "
                        + "WHERE context_id=? AND roster_order=? ORDER BY sort_order")) {
            statement.setString(1, contextId);
            statement.setInt(2, rosterOrder);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    values.add(rows.getString(1));
                }
            }
        }
        return List.copyOf(values);
    }

    private static void writeRoster(Connection connection, String contextId, List<EncounterCreatureData> roster)
            throws SQLException {
        try (PreparedStatement row = connection.prepareStatement(
                "INSERT INTO encounter_runtime_roster VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
             PreparedStatement tag = connection.prepareStatement(
                     "INSERT INTO encounter_runtime_roster_tags VALUES(?,?,?,?)")) {
            for (int index = 0; index < roster.size(); index++) {
                EncounterCreatureData creature = roster.get(index);
                int column = 1;
                row.setString(column++, contextId);
                row.setInt(column++, index);
                row.setString(column++, creature.id());
                row.setLong(column++, creature.creatureId());
                row.setLong(column++, creature.worldNpcId());
                row.setString(column++, creature.name());
                row.setString(column++, creature.challengeRating());
                row.setInt(column++, creature.xp());
                row.setInt(column++, creature.hp());
                row.setInt(column++, creature.armorClass());
                row.setInt(column++, creature.initiativeBonus());
                row.setString(column++, creature.creatureType());
                row.setString(column++, creature.encounterRole());
                row.setInt(column, creature.count());
                row.addBatch();
                for (int tagIndex = 0; tagIndex < creature.tags().size(); tagIndex++) {
                    tag.setString(1, contextId);
                    tag.setInt(2, index);
                    tag.setInt(3, tagIndex);
                    tag.setString(4, creature.tags().get(tagIndex));
                    tag.addBatch();
                }
            }
            row.executeBatch();
            tag.executeBatch();
        }
    }

    private static List<InitiativeEntryData> loadInitiative(Connection connection, String contextId) throws SQLException {
        List<InitiativeEntryData> values = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT row_id, label, kind, initiative FROM encounter_runtime_initiative "
                        + "WHERE context_id=? ORDER BY sort_order")) {
            statement.setString(1, contextId);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    values.add(new InitiativeEntryData(
                            rows.getString(1), rows.getString(2), CombatantKind.valueOf(rows.getString(3)), rows.getInt(4)));
                }
            }
        }
        return List.copyOf(values);
    }

    private static void writeInitiative(Connection connection, String contextId, List<InitiativeEntryData> values)
            throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "INSERT INTO encounter_runtime_initiative VALUES(?,?,?,?,?,?)")) {
            for (int index = 0; index < values.size(); index++) {
                InitiativeEntryData value = values.get(index);
                statement.setString(1, contextId);
                statement.setInt(2, index);
                statement.setString(3, value.id());
                statement.setString(4, value.label());
                statement.setString(5, value.kind().name());
                statement.setInt(6, value.initiative());
                statement.addBatch();
            }
            statement.executeBatch();
        }
    }

    private static List<Combatant> loadCombatants(Connection connection, String contextId) throws SQLException {
        List<Combatant> values = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT * FROM encounter_runtime_combatants WHERE context_id=? ORDER BY sort_order")) {
            statement.setString(1, contextId);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    values.add(new Combatant(
                            rows.getString("combatant_id"), rows.getString("name"),
                            CombatantKind.valueOf(rows.getString("kind")), rows.getLong("creature_id"),
                            rows.getLong("world_npc_id"), rows.getInt("current_hp"), rows.getInt("max_hp"),
                            rows.getInt("armor_class"), rows.getInt("initiative"), rows.getInt("combatant_count"),
                            rows.getInt("xp"), rows.getString("detail"), rows.getString("loot"),
                            rows.getInt("turn_order")));
                }
            }
        }
        return List.copyOf(values);
    }

    private static void writeCombatants(Connection connection, String contextId, List<Combatant> values)
            throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "INSERT INTO encounter_runtime_combatants VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")) {
            for (int index = 0; index < values.size(); index++) {
                Combatant value = values.get(index);
                int column = 1;
                statement.setString(column++, contextId);
                statement.setInt(column++, index);
                statement.setString(column++, value.id());
                statement.setString(column++, value.name());
                statement.setString(column++, value.kind().name());
                statement.setLong(column++, value.creatureId());
                statement.setLong(column++, value.worldNpcId());
                statement.setInt(column++, value.currentHp());
                statement.setInt(column++, value.maxHp());
                statement.setInt(column++, value.ac());
                statement.setInt(column++, value.initiative());
                statement.setInt(column++, value.count());
                statement.setInt(column++, value.xp());
                statement.setString(column++, value.detail());
                statement.setString(column++, value.loot());
                statement.setInt(column, value.order());
                statement.addBatch();
            }
            statement.executeBatch();
        }
    }

    private static List<ResultEnemyData> loadResultEnemies(Connection connection, String contextId) throws SQLException {
        List<ResultEnemyData> values = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT * FROM encounter_runtime_result_enemies WHERE context_id=? ORDER BY sort_order")) {
            statement.setString(1, contextId);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    values.add(new ResultEnemyData(
                            rows.getString("name"), rows.getLong("creature_id"), rows.getLong("world_npc_id"),
                            rows.getString("status"), rows.getInt("hp_loss"), rows.getInt("xp"),
                            rows.getInt("defeated_by_default") != 0, rows.getString("loot")));
                }
            }
        }
        return List.copyOf(values);
    }

    private static void writeResultEnemies(Connection connection, String contextId, List<ResultEnemyData> values)
            throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "INSERT INTO encounter_runtime_result_enemies VALUES(?,?,?,?,?,?,?,?,?,?)")) {
            for (int index = 0; index < values.size(); index++) {
                ResultEnemyData value = values.get(index);
                statement.setString(1, contextId);
                statement.setInt(2, index);
                statement.setString(3, value.name());
                statement.setLong(4, value.creatureId());
                statement.setLong(5, value.worldNpcId());
                statement.setString(6, value.status());
                statement.setInt(7, value.hpLoss());
                statement.setInt(8, value.xp());
                statement.setInt(9, value.defeatedByDefault() ? 1 : 0);
                statement.setString(10, value.loot());
                statement.addBatch();
            }
            statement.executeBatch();
        }
    }

    private record Meta(long sourceRevision, String focusedContextId) { }

    private record ValueRow(String textValue, long integerKey, int integerValue) { }

    private record GenerationState(
            List<GeneratedEncounterData> alternatives,
            List<String> advisories,
            int selectedAlternativeIndex,
            int adjustedXp,
            String difficulty,
            String title,
            boolean historyPresent,
            boolean dirty
    ) {
        private static GenerationState empty() {
            return new GenerationState(List.of(), List.of(), 0, 0, "", "", false, false);
        }
    }
}
