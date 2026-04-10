package clean.creatures.catalog.repository;

import clean.creatures.catalog.state.CatalogState;

import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Stateless clean creature persistence boundary.
 */
public final class CatalogRepository {
    private CatalogRepository() {
        throw new AssertionError("No instances");
    }

    public static CatalogState.FilterOptionsState loadFilterOptions() throws SQLException {
        try (Connection connection = openConnection()) {
            return new CatalogState.FilterOptionsState(
                    List.of("Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"),
                    getDistinctColumn(connection, "creature_type"),
                    getDistinctFromTable(connection, "creature_subtypes", "subtype"),
                    getDistinctFromTable(connection, "creature_biomes", "biome"),
                    getDistinctColumn(connection, "alignment")
            );
        }
    }

    public static CatalogState.SearchResultState searchCreatures(
            String nameQuery,
            Integer xpMin,
            Integer xpMax,
            List<String> sizes,
            List<String> types,
            List<String> subtypes,
            List<String> biomes,
            List<String> alignments,
            List<Long> excludeIds,
            List<Long> tableIds,
            String sortColumn,
            String sortDirection,
            int limit,
            int offset
    ) throws SQLException {
        StringBuilder where = new StringBuilder(" WHERE 1=1");
        List<Object> params = new ArrayList<>();

        appendNameClause(where, params, nameQuery);
        appendXpRangeClause(where, params, xpMin, xpMax);
        appendSizeClause(where, params, sizes);
        appendTypeClause(where, params, types);
        appendSubtypeClause(where, params, subtypes);
        appendBiomesClause(where, params, biomes);
        appendAlignmentClause(where, params, alignments);
        appendExcludeIdsClause(where, params, excludeIds);
        if (tableIds != null && !tableIds.isEmpty()) {
            where.append(" AND id IN (SELECT creature_id FROM encounter_table_entries WHERE ");
            appendLongInClause(where, params, "table_id", tableIds);
            where.append(")");
        }

        String actualSortColumn = switch (sortColumn) {
            case "cr", "xp" -> "xp";
            case "type" -> "creature_type";
            case "size" -> "size";
            default -> "name";
        };
        String actualSortDirection = "DESC".equalsIgnoreCase(sortDirection) ? "DESC" : "ASC";

        String sql = "SELECT id, name, cr, xp, size, creature_type, alignment, COUNT(*) OVER() AS total_count "
                + "FROM creatures" + where
                + " ORDER BY " + actualSortColumn + " " + actualSortDirection
                + " LIMIT ? OFFSET ?";

        List<CatalogState.CreatureSummaryState> creatures = new ArrayList<>();
        try (Connection connection = openConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            int parameterIndex = bindParams(statement, params);
            statement.setInt(parameterIndex++, limit);
            statement.setInt(parameterIndex, offset);
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    return new CatalogState.SearchResultState(0, List.of());
                }
                int totalCount = resultSet.getInt("total_count");
                do {
                    creatures.add(new CatalogState.CreatureSummaryState(
                            resultSet.getLong("id"),
                            resultSet.getString("name"),
                            resultSet.getString("cr"),
                            resultSet.getInt("xp"),
                            resultSet.getString("size"),
                            resultSet.getString("creature_type"),
                            resultSet.getString("alignment")
                    ));
                } while (resultSet.next());
                return new CatalogState.SearchResultState(totalCount, List.copyOf(creatures));
            }
        }
    }

    public static CatalogState.CreatureDetailsState loadCreature(long creatureId) throws SQLException {
        String sql = "SELECT * FROM creatures WHERE id = ?";
        try (Connection connection = openConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setLong(1, creatureId);
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    return null;
                }
                CatalogState.CreatureDetailsState details = mapCreatureDetails(resultSet);
                Map<String, List<CatalogState.CreatureActionState>> actionsByType =
                        loadActionsForCreature(connection, creatureId);
                List<String> biomes = loadRelationValues(connection, List.of(creatureId), "creature_biomes", "biome")
                        .getOrDefault(creatureId, List.of());
                List<String> subtypes = loadRelationValues(connection, List.of(creatureId), "creature_subtypes", "subtype")
                        .getOrDefault(creatureId, List.of());
                return new CatalogState.CreatureDetailsState(
                        details.creatureId(),
                        details.name(),
                        details.size(),
                        details.creatureType(),
                        subtypes,
                        details.alignment(),
                        details.cr(),
                        details.xp(),
                        details.hp(),
                        details.hitDice(),
                        details.hitDiceCount(),
                        details.hitDiceSides(),
                        details.hitDiceModifier(),
                        details.ac(),
                        details.acNotes(),
                        details.speed(),
                        details.flySpeed(),
                        details.swimSpeed(),
                        details.climbSpeed(),
                        details.burrowSpeed(),
                        details.strength(),
                        details.dexterity(),
                        details.constitution(),
                        details.intelligence(),
                        details.wisdom(),
                        details.charisma(),
                        details.initiativeBonus(),
                        details.proficiencyBonus(),
                        details.savingThrows(),
                        details.skills(),
                        details.damageVulnerabilities(),
                        details.damageResistances(),
                        details.damageImmunities(),
                        details.conditionImmunities(),
                        details.senses(),
                        details.passivePerception(),
                        details.languages(),
                        details.legendaryActionCount(),
                        biomes,
                        List.copyOf(actionsByType.getOrDefault("trait", List.of())),
                        List.copyOf(actionsByType.getOrDefault("action", List.of())),
                        List.copyOf(actionsByType.getOrDefault("bonus_action", List.of())),
                        List.copyOf(actionsByType.getOrDefault("reaction", List.of())),
                        List.copyOf(actionsByType.getOrDefault("legendary_action", List.of()))
                );
            }
        }
    }

    private static CatalogState.CreatureDetailsState mapCreatureDetails(ResultSet resultSet) throws SQLException {
        return new CatalogState.CreatureDetailsState(
                resultSet.getLong("id"),
                resultSet.getString("name"),
                resultSet.getString("size"),
                resultSet.getString("creature_type"),
                List.of(),
                resultSet.getString("alignment"),
                resultSet.getString("cr"),
                resultSet.getInt("xp"),
                resultSet.getInt("hp"),
                resultSet.getString("hit_dice"),
                nullableInteger(resultSet, "hit_dice_count"),
                nullableInteger(resultSet, "hit_dice_sides"),
                nullableInteger(resultSet, "hit_dice_modifier"),
                resultSet.getInt("ac"),
                resultSet.getString("ac_notes"),
                resultSet.getInt("speed"),
                resultSet.getInt("fly_speed"),
                resultSet.getInt("swim_speed"),
                resultSet.getInt("climb_speed"),
                resultSet.getInt("burrow_speed"),
                resultSet.getInt("str"),
                resultSet.getInt("dex"),
                resultSet.getInt("con"),
                resultSet.getInt("intel"),
                resultSet.getInt("wis"),
                resultSet.getInt("cha"),
                resultSet.getInt("initiative_bonus"),
                resultSet.getInt("proficiency_bonus"),
                resultSet.getString("saving_throws"),
                resultSet.getString("skills"),
                resultSet.getString("damage_vulnerabilities"),
                resultSet.getString("damage_resistances"),
                resultSet.getString("damage_immunities"),
                resultSet.getString("condition_immunities"),
                resultSet.getString("senses"),
                resultSet.getInt("passive_perception"),
                resultSet.getString("languages"),
                resultSet.getInt("legendary_action_count"),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of()
        );
    }

    private static Map<String, List<CatalogState.CreatureActionState>> loadActionsForCreature(
            Connection connection,
            long creatureId
    ) throws SQLException {
        Map<String, List<CatalogState.CreatureActionState>> actionsByType = new LinkedHashMap<>();
        String sql = "SELECT action_type, name, description, to_hit_bonus FROM creature_actions WHERE creature_id = ?";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setLong(1, creatureId);
            try (ResultSet resultSet = statement.executeQuery()) {
                while (resultSet.next()) {
                    CatalogState.CreatureActionState action = new CatalogState.CreatureActionState(
                            resultSet.getString("action_type"),
                            resultSet.getString("name"),
                            resultSet.getString("description"),
                            nullableInteger(resultSet, "to_hit_bonus")
                    );
                    String type = normalizeActionType(action.actionType());
                    actionsByType.computeIfAbsent(type, ignored -> new ArrayList<>()).add(action);
                }
            }
        }
        return actionsByType;
    }

    private static Map<Long, List<String>> loadRelationValues(
            Connection connection,
            List<Long> creatureIds,
            String table,
            String valueColumn
    ) throws SQLException {
        Map<Long, List<String>> valuesByCreature = new HashMap<>();
        if (!allowedDistinctTables().contains(table + ":" + valueColumn) || creatureIds.isEmpty()) {
            return valuesByCreature;
        }
        for (int start = 0; start < creatureIds.size(); start += inClauseBatchSize()) {
            int end = Math.min(start + inClauseBatchSize(), creatureIds.size());
            List<Long> batch = creatureIds.subList(start, end);
            String sql = "SELECT creature_id, " + valueColumn + " FROM " + table + " WHERE creature_id IN ("
                    + placeholders(batch.size()) + ")";
            try (PreparedStatement statement = connection.prepareStatement(sql)) {
                for (int index = 0; index < batch.size(); index++) {
                    statement.setLong(index + 1, batch.get(index));
                }
                try (ResultSet resultSet = statement.executeQuery()) {
                    while (resultSet.next()) {
                        valuesByCreature.computeIfAbsent(
                                resultSet.getLong("creature_id"),
                                ignored -> new ArrayList<>()
                        ).add(resultSet.getString(valueColumn));
                    }
                }
            }
        }
        return valuesByCreature;
    }

    private static List<String> getDistinctFromTable(Connection connection, String table, String column)
            throws SQLException {
        if (!allowedDistinctTables().contains(table + ":" + column)) {
            throw new IllegalArgumentException("Invalid table/column for distinct query: " + table + "." + column);
        }
        List<String> values = new ArrayList<>();
        String sql = "SELECT DISTINCT " + column + " FROM " + table + " ORDER BY " + column;
        try (Statement statement = connection.createStatement();
             ResultSet resultSet = statement.executeQuery(sql)) {
            while (resultSet.next()) {
                values.add(resultSet.getString(1));
            }
        }
        return values;
    }

    private static List<String> getDistinctColumn(Connection connection, String column) throws SQLException {
        if (!allowedDistinctColumns().contains(column)) {
            throw new IllegalArgumentException("Invalid column: " + column);
        }
        List<String> values = new ArrayList<>();
        String sql = "SELECT DISTINCT " + column + " FROM creatures WHERE "
                + column + " IS NOT NULL AND " + column + " != '' ORDER BY " + column;
        try (Statement statement = connection.createStatement();
             ResultSet resultSet = statement.executeQuery(sql)) {
            while (resultSet.next()) {
                values.add(resultSet.getString(1));
            }
        }
        return values;
    }

    private static int bindParams(PreparedStatement statement, List<Object> params) throws SQLException {
        int index = 1;
        for (Object param : params) {
            if (param instanceof String stringValue) {
                statement.setString(index++, stringValue);
            } else if (param instanceof Integer integerValue) {
                statement.setInt(index++, integerValue);
            } else if (param instanceof Long longValue) {
                statement.setLong(index++, longValue);
            } else {
                throw new IllegalArgumentException("Unsupported parameter type: " + param.getClass().getName());
            }
        }
        return index;
    }

    private static void appendNameClause(StringBuilder sql, List<Object> params, String nameQuery) {
        if (nameQuery == null || nameQuery.isBlank()) {
            return;
        }
        sql.append(" AND LOWER(name) LIKE LOWER(?)");
        params.add("%" + nameQuery.trim() + "%");
    }

    private static void appendXpRangeClause(StringBuilder sql, List<Object> params, Integer xpMin, Integer xpMax) {
        if (xpMin != null) {
            sql.append(" AND xp >= ?");
            params.add(xpMin);
        }
        if (xpMax != null) {
            sql.append(" AND xp <= ?");
            params.add(xpMax);
        }
    }

    private static void appendSizeClause(StringBuilder sql, List<Object> params, List<String> sizes) {
        if (sizes == null || sizes.isEmpty()) {
            return;
        }
        sql.append(" AND (");
        for (int index = 0; index < sizes.size(); index++) {
            if (index > 0) {
                sql.append(" OR ");
            }
            sql.append("LOWER(size) LIKE LOWER(?)");
        }
        sql.append(")");
        for (String size : sizes) {
            params.add("%" + size + "%");
        }
    }

    private static void appendAlignmentClause(StringBuilder sql, List<Object> params, List<String> alignments) {
        appendLowerInClause(sql, params, "alignment", alignments);
    }

    private static void appendTypeClause(StringBuilder sql, List<Object> params, List<String> types) {
        appendLowerInClause(sql, params, "creature_type", types);
    }

    private static void appendSubtypeClause(StringBuilder sql, List<Object> params, List<String> subtypes) {
        if (subtypes == null || subtypes.isEmpty()) {
            return;
        }
        sql.append(" AND id IN (SELECT creature_id FROM creature_subtypes WHERE ");
        appendStringInClause(sql, params, "LOWER(subtype)", subtypes, true);
        sql.append(")");
    }

    private static void appendBiomesClause(StringBuilder sql, List<Object> params, List<String> biomes) {
        if (biomes == null || biomes.isEmpty()) {
            return;
        }
        sql.append(" AND id IN (SELECT creature_id FROM creature_biomes WHERE ");
        appendStringInClause(sql, params, "LOWER(biome)", biomes, true);
        sql.append(")");
    }

    private static void appendExcludeIdsClause(StringBuilder sql, List<Object> params, List<Long> excludeIds) {
        if (excludeIds == null || excludeIds.isEmpty()) {
            return;
        }
        sql.append(" AND ");
        appendLongInClause(sql, params, "id", excludeIds, true);
    }

    private static void appendLowerInClause(StringBuilder sql, List<Object> params, String column, List<String> values) {
        if (values == null || values.isEmpty()) {
            return;
        }
        if (!allowedInClauseColumns().contains(column)) {
            throw new IllegalArgumentException("Invalid column for IN clause: " + column);
        }
        sql.append(" AND ");
        appendStringInClause(sql, params, "LOWER(" + column + ")", values, true);
    }

    private static void appendStringInClause(
            StringBuilder sql,
            List<Object> params,
            String leftExpression,
            List<String> values,
            boolean lowerParam
    ) {
        sql.append("(");
        for (int start = 0; start < values.size(); start += inClauseBatchSize()) {
            if (start > 0) {
                sql.append(" OR ");
            }
            int end = Math.min(start + inClauseBatchSize(), values.size());
            int batchSize = end - start;
            sql.append(leftExpression).append(" IN (");
            sql.append(String.join(", ", Collections.nCopies(batchSize, lowerParam ? "LOWER(?)" : "?")));
            sql.append(")");
            params.addAll(values.subList(start, end));
        }
        sql.append(")");
    }

    private static void appendLongInClause(
            StringBuilder sql,
            List<Object> params,
            String column,
            List<Long> values
    ) {
        appendLongInClause(sql, params, column, values, false);
    }

    private static void appendLongInClause(
            StringBuilder sql,
            List<Object> params,
            String column,
            List<Long> values,
            boolean negated
    ) {
        sql.append("(");
        for (int start = 0; start < values.size(); start += inClauseBatchSize()) {
            if (start > 0) {
                sql.append(negated ? " AND " : " OR ");
            }
            int end = Math.min(start + inClauseBatchSize(), values.size());
            int batchSize = end - start;
            sql.append(column).append(negated ? " NOT IN (" : " IN (");
            sql.append(String.join(", ", Collections.nCopies(batchSize, "?")));
            sql.append(")");
            params.addAll(values.subList(start, end));
        }
        sql.append(")");
    }

    private static Connection openConnection() throws SQLException {
        Path databasePath = resolveDatabasePath();
        Connection connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
        try (Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA foreign_keys=ON");
            statement.execute("PRAGMA journal_mode=WAL");
        }
        return connection;
    }

    private static Path resolveDatabasePath() {
        String xdgDataHome = System.getenv("XDG_DATA_HOME");
        if (xdgDataHome != null && !xdgDataHome.isBlank()) {
            return Path.of(xdgDataHome, "salt-marcher", "game.db");
        }
        return Path.of(System.getProperty("user.home"), ".local", "share", "salt-marcher", "game.db");
    }

    private static String placeholders(int count) {
        return String.join(",", Collections.nCopies(count, "?"));
    }

    private static Integer nullableInteger(ResultSet resultSet, String column) throws SQLException {
        Number value = (Number) resultSet.getObject(column);
        return value == null ? null : value.intValue();
    }

    private static String normalizeActionType(String value) {
        String normalized = value == null ? "" : value.trim();
        return switch (normalized) {
            case "trait", "bonus_action", "reaction", "legendary_action" -> normalized;
            default -> "action";
        };
    }

    private static int inClauseBatchSize() {
        return 400;
    }

    private static Set<String> allowedDistinctTables() {
        return Set.of("creature_subtypes:subtype", "creature_biomes:biome");
    }

    private static Set<String> allowedDistinctColumns() {
        return Set.of("creature_type", "alignment");
    }

    private static Set<String> allowedInClauseColumns() {
        return Set.of("creature_type", "alignment", "size");
    }
}
