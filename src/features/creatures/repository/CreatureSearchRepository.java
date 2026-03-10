package features.creatures.repository;

import features.creatures.model.Creature;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Set;

public final class CreatureSearchRepository {
    private static final int IN_CLAUSE_BATCH_SIZE = 400;

    private CreatureSearchRepository() {
        throw new AssertionError("No instances");
    }

    public static List<Creature> getCreaturesByFilters(Connection conn, List<String> creatureTypes, int minXP, int maxXP,
                                                        List<String> biomes, List<String> subtypes) throws SQLException {
        List<Creature> creatures = new ArrayList<>();
        StringBuilder sql = new StringBuilder("SELECT * FROM creatures WHERE xp >= ? AND xp <= ?");
        List<Object> params = new ArrayList<>();
        params.add(minXP);
        params.add(maxXP);
        appendTypeClause(sql, params, creatureTypes);
        appendSubtypeClause(sql, params, subtypes);
        appendBiomesClause(sql, params, biomes);

        try (PreparedStatement ps = conn.prepareStatement(sql.toString())) {
            bindParams(ps, params);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) creatures.add(CreatureHydrator.mapRow(rs));
            }
            CreatureHydrator.loadBiomes(conn, creatures);
            CreatureHydrator.loadSubtypes(conn, creatures);
        }
        return creatures;
    }

    /**
     * Returns creatures with base stats only - {@code Biomes}, {@code Actions}, {@code Subtypes},
     * and {@code Traits} are empty lists (not null, but not loaded). Suitable for autocomplete
     * and name-only lookups. Use {@link #searchByName(Connection, String, int, boolean)} with
     * {@code loadRelations=true} for any display use case.
     */
    public static List<Creature> searchByName(Connection conn, String query, int limit) throws SQLException {
        return searchByName(conn, query, limit, false);
    }

    /**
     * @param loadRelations if {@code false}, skips loading actions/biomes/subtypes -
     *                      useful for autocomplete or name-only lookups where full
     *                      creature data is not needed (avoids N+1 relation queries).
     *                      Pass {@code true} for any display use case.
     */
    public static List<Creature> searchByName(Connection conn, String query, int limit, boolean loadRelations) throws SQLException {
        List<Creature> creatures = new ArrayList<>();
        String sql = "SELECT * FROM creatures WHERE LOWER(name) LIKE LOWER(?) LIMIT ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, "%" + query + "%");
            ps.setInt(2, limit);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) creatures.add(CreatureHydrator.mapRow(rs));
            }
            if (loadRelations) {
                CreatureRepository.loadActions(conn, creatures);
                CreatureHydrator.loadBiomes(conn, creatures);
                CreatureHydrator.loadSubtypes(conn, creatures);
            }
        }
        return creatures;
    }

    public static int countAll(Connection conn) throws SQLException {
        try (Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery("SELECT COUNT(*) FROM creatures")) {
            return rs.next() ? rs.getInt(1) : 0;
        }
    }

    public record SearchResult(int totalCount, List<Creature> creatures) {}

    public static SearchResult searchWithFiltersAndCount(
            Connection conn,
            String nameQuery,
            Integer xpMin, Integer xpMax,
            List<String> sizes,
            List<String> types,
            List<String> subtypes,
            List<String> biomes,
            List<String> alignments,
            List<Long> excludeIds,
            List<Long> tableIds,
            String sortColumn, String sortDirection,
            int limit, int offset) throws SQLException {

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

        String col = switch (sortColumn != null ? sortColumn : "name") {
            case "name" -> "name";
            case "cr", "xp"   -> "xp";  // Both CR and XP sort by the xp column value
            case "type"       -> "creature_type";
            case "size"       -> "size";
            default           -> throw new IllegalArgumentException("Invalid sort column: " + sortColumn);
        };
        String dir = "DESC".equalsIgnoreCase(sortDirection) ? "DESC" : "ASC";

        int totalCount = 0;
        List<Creature> creatures = new ArrayList<>();

        // Single query: COUNT(*) OVER() gives total matches before LIMIT (SQLite 3.25+)
        String sql = "SELECT *, COUNT(*) OVER() AS total_count FROM creatures" + where
                + " ORDER BY " + col + " " + dir + " LIMIT ? OFFSET ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            int idx = bindParams(ps, params);
            ps.setInt(idx++, limit);
            ps.setInt(idx, offset);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    if (creatures.isEmpty()) totalCount = rs.getInt("total_count");
                    creatures.add(CreatureHydrator.mapRow(rs));
                }
            }
        }
        return new SearchResult(totalCount, creatures);
    }

    public static List<String> getDistinctTypes(Connection conn) throws SQLException {
        return getDistinctColumn(conn, "creature_type");
    }

    public static List<String> getDistinctSubtypes(Connection conn) throws SQLException {
        return getDistinctFromTable(conn, "creature_subtypes", "subtype");
    }

    public static List<String> getDistinctSizes(Connection conn) {
        // Base sizes in stable order. Composite values like "Medium or Small"
        // are matched by the LIKE-based filter (conn accepted for API uniformity).
        return List.of("Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan");
    }

    public static List<String> getDistinctAlignments(Connection conn) throws SQLException {
        return getDistinctColumn(conn, "alignment");
    }

    public static List<String> getDistinctBiomes(Connection conn) throws SQLException {
        return getDistinctFromTable(conn, "creature_biomes", "biome");
    }

    private static int bindParams(PreparedStatement ps, List<Object> params) throws SQLException {
        int idx = 1;
        for (Object p : params) {
            if (p instanceof String s) ps.setString(idx++, s);
            else if (p instanceof Integer i) ps.setInt(idx++, i);
            else if (p instanceof Long l) ps.setLong(idx++, l);
            else throw new IllegalArgumentException("bindParams: unsupported param type: " + p.getClass().getName());
        }
        return idx;
    }

    private static final Set<String> ALLOWED_DISTINCT_TABLES =
            Set.of("creature_subtypes:subtype", "creature_biomes:biome");

    private static List<String> getDistinctFromTable(Connection conn, String table, String column)
            throws SQLException {
        if (!ALLOWED_DISTINCT_TABLES.contains(table + ":" + column))
            throw new IllegalArgumentException("Invalid table/column for distinct query: " + table + "." + column);
        List<String> values = new ArrayList<>();
        String sql = "SELECT DISTINCT " + column + " FROM " + table + " ORDER BY " + column;
        try (Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            while (rs.next()) values.add(rs.getString(1));
        }
        return values;
    }

    private static final Set<String> ALLOWED_DISTINCT_COLUMNS =
            Set.of("creature_type", "alignment");

    private static List<String> getDistinctColumn(Connection conn, String column) throws SQLException {
        if (!ALLOWED_DISTINCT_COLUMNS.contains(column))
            throw new IllegalArgumentException("Invalid column: " + column);
        List<String> values = new ArrayList<>();
        String sql = "SELECT DISTINCT " + column + " FROM creatures WHERE "
                + column + " IS NOT NULL AND " + column + " != '' ORDER BY " + column;
        try (Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            while (rs.next()) values.add(rs.getString(1));
        }
        return values;
    }

    private static void appendNameClause(StringBuilder sql, List<Object> params, String nameQuery) {
        if (nameQuery == null || nameQuery.isBlank()) return;
        sql.append(" AND LOWER(name) LIKE LOWER(?)");
        params.add("%" + nameQuery.trim() + "%");
    }

    private static void appendXpRangeClause(StringBuilder sql, List<Object> params,
                                            Integer xpMin, Integer xpMax) {
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
        if (sizes == null || sizes.isEmpty()) return;
        // LIKE-based so values like "Medium or Small" still match a "Small" filter.
        sql.append(" AND (");
        for (int i = 0; i < sizes.size(); i++) {
            if (i > 0) sql.append(" OR ");
            sql.append("LOWER(size) LIKE LOWER(?)");
        }
        sql.append(")");
        for (String s : sizes) params.add("%" + s + "%");
    }

    private static final Set<String> ALLOWED_IN_CLAUSE_COLUMNS =
            Set.of("creature_type", "alignment", "size");

    private static void appendLowerInClause(StringBuilder sql, List<Object> params,
                                            String column, List<String> values) {
        if (values == null || values.isEmpty()) return;
        if (!ALLOWED_IN_CLAUSE_COLUMNS.contains(column))
            throw new IllegalArgumentException("Invalid column for IN clause: " + column);
        sql.append(" AND ");
        appendStringInClause(sql, params, "LOWER(" + column + ")", values, true);
    }

    private static void appendAlignmentClause(StringBuilder sql, List<Object> params, List<String> alignments) {
        appendLowerInClause(sql, params, "alignment", alignments);
    }

    private static void appendTypeClause(StringBuilder sql, List<Object> params, List<String> types) {
        appendLowerInClause(sql, params, "creature_type", types);
    }

    private static void appendSubtypeClause(StringBuilder sql, List<Object> params, List<String> subtypes) {
        if (subtypes == null || subtypes.isEmpty()) return;
        sql.append(" AND id IN (SELECT creature_id FROM creature_subtypes WHERE ");
        appendStringInClause(sql, params, "LOWER(subtype)", subtypes, true);
        sql.append(")");
    }

    private static void appendBiomesClause(StringBuilder sql, List<Object> params, List<String> biomes) {
        if (biomes == null || biomes.isEmpty()) return;
        sql.append(" AND id IN (SELECT creature_id FROM creature_biomes WHERE ");
        appendStringInClause(sql, params, "LOWER(biome)", biomes, true);
        sql.append(")");
    }

    private static void appendExcludeIdsClause(StringBuilder sql, List<Object> params, List<Long> excludeIds) {
        if (excludeIds == null || excludeIds.isEmpty()) return;
        sql.append(" AND ");
        appendLongInClause(sql, params, "id", excludeIds, true);
    }

    private static void appendStringInClause(StringBuilder sql, List<Object> params,
                                             String leftExpr, List<String> values, boolean lowerParam) {
        sql.append("(");
        for (int start = 0; start < values.size(); start += IN_CLAUSE_BATCH_SIZE) {
            if (start > 0) sql.append(" OR ");
            int end = Math.min(start + IN_CLAUSE_BATCH_SIZE, values.size());
            int batchSize = end - start;
            sql.append(leftExpr).append(" IN (");
            sql.append(String.join(", ", Collections.nCopies(batchSize, lowerParam ? "LOWER(?)" : "?")));
            sql.append(")");
            params.addAll(values.subList(start, end));
        }
        sql.append(")");
    }

    private static void appendLongInClause(StringBuilder sql, List<Object> params,
                                           String column, List<Long> values) {
        appendLongInClause(sql, params, column, values, false);
    }

    private static void appendLongInClause(StringBuilder sql, List<Object> params,
                                           String column, List<Long> values, boolean negated) {
        sql.append("(");
        for (int start = 0; start < values.size(); start += IN_CLAUSE_BATCH_SIZE) {
            if (start > 0) {
                sql.append(negated ? " AND " : " OR ");
            }
            int end = Math.min(start + IN_CLAUSE_BATCH_SIZE, values.size());
            int batchSize = end - start;
            sql.append(column).append(negated ? " NOT IN (" : " IN (");
            sql.append(String.join(", ", Collections.nCopies(batchSize, "?")));
            sql.append(")");
            params.addAll(values.subList(start, end));
        }
        sql.append(")");
    }
}
