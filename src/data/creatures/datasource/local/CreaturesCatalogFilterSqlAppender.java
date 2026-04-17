package src.data.creatures.datasource.local;

import org.jspecify.annotations.Nullable;
import src.domain.creatures.repository.CreatureCatalogRepository;

import java.util.List;
import java.util.Locale;
import java.util.Objects;

final class CreaturesCatalogFilterSqlAppender {

    private CreaturesCatalogFilterSqlAppender() {
    }

    static void appendCatalogFilters(
            StringBuilder sql,
            List<Object> params,
            CreatureCatalogRepository.CatalogSearchSpec spec
    ) {
        appendContains(sql, params, "name", spec.nameQuery());
        appendBound(sql, params, "xp", spec.minimumXp(), ">=");
        appendBound(sql, params, "xp", spec.maximumXp(), "<=");
        appendStringListEquals(sql, params, "size", spec.sizes());
        appendStringListEquals(sql, params, "creature_type", spec.types());
        appendStringListEquals(sql, params, "alignment", spec.alignments());
        appendStringListInSubquery(sql, params, "creature_subtypes", "subtype", spec.subtypes());
        appendStringListInSubquery(sql, params, "creature_biomes", "biome", spec.biomes());
    }

    static void appendStringListEquals(StringBuilder sql, List<Object> params, String columnName, List<String> values) {
        List<String> filtered = normalizeValues(values);
        if (filtered.isEmpty()) {
            return;
        }
        sql.append(" AND LOWER(").append(columnName).append(") IN (")
                .append(placeholders(filtered.size()))
                .append(")");
        for (String value : filtered) {
            params.add(value.toLowerCase(Locale.ROOT));
        }
    }

    static void appendStringListInSubquery(
            StringBuilder sql,
            List<Object> params,
            String tableName,
            String valueColumn,
            List<String> values
    ) {
        List<String> filtered = normalizeValues(values);
        if (filtered.isEmpty()) {
            return;
        }
        sql.append(" AND id IN (SELECT creature_id FROM ").append(tableName).append(" WHERE LOWER(")
                .append(valueColumn).append(") IN (")
                .append(placeholders(filtered.size()))
                .append("))");
        for (String value : filtered) {
            params.add(value.toLowerCase(Locale.ROOT));
        }
    }

    private static void appendContains(StringBuilder sql, List<Object> params, String columnName, @Nullable String value) {
        if (value == null || value.isBlank()) {
            return;
        }
        sql.append(" AND LOWER(").append(columnName).append(") LIKE LOWER(?)");
        params.add("%" + value.trim() + "%");
    }

    private static void appendBound(
            StringBuilder sql,
            List<Object> params,
            String columnName,
            @Nullable Integer value,
            String operator
    ) {
        if (value == null) {
            return;
        }
        sql.append(" AND ").append(columnName).append(" ").append(operator).append(" ?");
        params.add(value);
    }

    private static void appendEquals(StringBuilder sql, List<Object> params, String columnName, @Nullable String value) {
        if (value == null || value.isBlank()) {
            return;
        }
        sql.append(" AND LOWER(").append(columnName).append(") = LOWER(?)");
        params.add(value.trim());
    }

    private static void appendInSubquery(
            StringBuilder sql,
            List<Object> params,
            String tableName,
            String valueColumn,
            @Nullable String value
    ) {
        if (value == null || value.isBlank()) {
            return;
        }
        sql.append(" AND id IN (SELECT creature_id FROM ").append(tableName).append(" WHERE LOWER(")
                .append(valueColumn).append(") = LOWER(?))");
        params.add(value.trim());
    }

    private static List<String> normalizeValues(List<String> values) {
        if (values == null || values.isEmpty()) {
            return List.of();
        }
        return values.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .distinct()
                .toList();
    }

    private static String placeholders(int count) {
        return String.join(",", java.util.Collections.nCopies(count, "?"));
    }
}
