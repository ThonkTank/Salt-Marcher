package src.data.creatures.gateway.local;

import org.jspecify.annotations.Nullable;
import src.data.creatures.model.CreatureCatalogPageRecord;
import src.data.creatures.model.CreatureCatalogRecord;
import src.domain.creatures.published.CreatureCatalogSortField;
import src.domain.creatures.published.CreatureSortDirection;
import src.domain.creatures.catalog.repository.CreatureCatalogRepository;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.util.ArrayList;
import java.util.List;

final class CreatureCatalogSearchSqliteStore {

    private static final String SEARCH_SELECT_SQL =
            "SELECT id, name, size, creature_type, alignment, cr, xp, hp, ac, COUNT(*) OVER() AS total_count "
                    + "FROM creatures WHERE "
                    + "(? IS NULL OR LOWER(name) LIKE LOWER(?)) "
                    + "AND (? IS NULL OR xp >= ?) "
                    + "AND (? IS NULL OR xp <= ?) "
                    + "AND ((SELECT COUNT(*) FROM sm_temp_filter_sizes) = 0 "
                    + "OR LOWER(size) IN (SELECT value FROM sm_temp_filter_sizes)) "
                    + "AND ((SELECT COUNT(*) FROM sm_temp_filter_types) = 0 "
                    + "OR LOWER(creature_type) IN (SELECT value FROM sm_temp_filter_types)) "
                    + "AND ((SELECT COUNT(*) FROM sm_temp_filter_alignments) = 0 "
                    + "OR LOWER(alignment) IN (SELECT value FROM sm_temp_filter_alignments)) "
                    + "AND ((SELECT COUNT(*) FROM sm_temp_filter_subtypes) = 0 "
                    + "OR id IN (SELECT creature_id FROM creature_subtypes "
                    + "WHERE LOWER(subtype) IN (SELECT value FROM sm_temp_filter_subtypes))) "
                    + "AND ((SELECT COUNT(*) FROM sm_temp_filter_biomes) = 0 "
                    + "OR id IN (SELECT creature_id FROM creature_biomes "
                    + "WHERE LOWER(biome) IN (SELECT value FROM sm_temp_filter_biomes))) ";

    private static final String SEARCH_NAME_ASC_SQL =
            SEARCH_SELECT_SQL + "ORDER BY name ASC LIMIT ? OFFSET ?";
    private static final String SEARCH_NAME_DESC_SQL =
            SEARCH_SELECT_SQL + "ORDER BY name DESC LIMIT ? OFFSET ?";
    private static final String SEARCH_XP_ASC_SQL =
            SEARCH_SELECT_SQL + "ORDER BY xp ASC, name ASC LIMIT ? OFFSET ?";
    private static final String SEARCH_XP_DESC_SQL =
            SEARCH_SELECT_SQL + "ORDER BY xp DESC, name ASC LIMIT ? OFFSET ?";
    private static final String SEARCH_TYPE_ASC_SQL =
            SEARCH_SELECT_SQL + "ORDER BY creature_type ASC, name ASC LIMIT ? OFFSET ?";
    private static final String SEARCH_TYPE_DESC_SQL =
            SEARCH_SELECT_SQL + "ORDER BY creature_type DESC, name ASC LIMIT ? OFFSET ?";
    private static final String SEARCH_SIZE_ASC_SQL =
            SEARCH_SELECT_SQL + "ORDER BY size ASC, name ASC LIMIT ? OFFSET ?";
    private static final String SEARCH_SIZE_DESC_SQL =
            SEARCH_SELECT_SQL + "ORDER BY size DESC, name ASC LIMIT ? OFFSET ?";

    CreatureCatalogPageRecord searchCatalog(Connection connection, CreatureCatalogRepository.CatalogSearchSpec spec)
            throws SQLException {
        CreatureFilterTempTables.prepareCatalogFilters(connection, spec);
        try (PreparedStatement statement = CatalogSearchStatement.resolve(
                spec.sortField(),
                spec.sortDirection(),
                connection)) {
            return executeSearch(statement, spec);
        } finally {
            CreatureFilterTempTables.clearFilters(connection);
        }
    }

    private CreatureCatalogPageRecord executeSearch(
            PreparedStatement statement,
            CreatureCatalogRepository.CatalogSearchSpec spec
    ) throws SQLException {
        bindSearchParameters(statement, spec);
        List<CreatureCatalogRecord> rows = new ArrayList<>();
        int totalCount = 0;
        try (ResultSet resultSet = statement.executeQuery()) {
            while (resultSet.next()) {
                if (rows.isEmpty()) {
                    totalCount = resultSet.getInt("total_count");
                }
                rows.add(new CreatureCatalogRecord(
                        new CreatureCatalogRecord.Identity(
                                resultSet.getLong("id"),
                                resultSet.getString("name"),
                                resultSet.getString("size"),
                                resultSet.getString("creature_type"),
                                resultSet.getString("alignment")),
                        new CreatureCatalogRecord.CombatStats(
                                resultSet.getString("cr"),
                                resultSet.getInt("xp"),
                                resultSet.getInt("hp"),
                                resultSet.getInt("ac"))));
            }
        }
        return new CreatureCatalogPageRecord(rows, totalCount, spec.pageSize(), spec.pageOffset());
    }

    private void bindSearchParameters(
            PreparedStatement statement,
            CreatureCatalogRepository.CatalogSearchSpec spec
    ) throws SQLException {
        String nameQuery = likeSearchTerm(spec.nameQuery());
        bindNullableString(statement, 1, nameQuery);
        bindNullableString(statement, 2, nameQuery);
        bindNullableInteger(statement, 3, spec.minimumXp());
        bindNullableInteger(statement, 4, spec.minimumXp());
        bindNullableInteger(statement, 5, spec.maximumXp());
        bindNullableInteger(statement, 6, spec.maximumXp());
        statement.setInt(7, spec.pageSize());
        statement.setInt(8, spec.pageOffset());
    }

    private static @Nullable String likeSearchTerm(@Nullable String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return "%" + value.trim() + "%";
    }

    private static void bindNullableString(PreparedStatement statement, int index, @Nullable String value)
            throws SQLException {
        if (value == null) {
            statement.setNull(index, Types.VARCHAR);
            return;
        }
        statement.setString(index, value);
    }

    private static void bindNullableInteger(PreparedStatement statement, int index, @Nullable Integer value)
            throws SQLException {
        if (value == null) {
            statement.setNull(index, Types.INTEGER);
            return;
        }
        statement.setInt(index, value);
    }

    private static final class CatalogSearchStatement {

        static PreparedStatement resolve(
                @Nullable CreatureCatalogSortField sortField,
                @Nullable CreatureSortDirection sortDirection,
                Connection connection
        ) throws SQLException {
            if (sortField == null) {
                return name(sortDirection, connection);
            }
            return switch (sortField) {
                case NAME -> name(sortDirection, connection);
                case CHALLENGE_RATING, XP -> xp(sortDirection, connection);
                case TYPE -> type(sortDirection, connection);
                case SIZE -> size(sortDirection, connection);
            };
        }

        private static PreparedStatement name(
                @Nullable CreatureSortDirection sortDirection,
                Connection connection
        ) throws SQLException {
            if (isDescending(sortDirection)) {
                return connection.prepareStatement(SEARCH_NAME_DESC_SQL);
            }
            return connection.prepareStatement(SEARCH_NAME_ASC_SQL);
        }

        private static PreparedStatement xp(
                @Nullable CreatureSortDirection sortDirection,
                Connection connection
        ) throws SQLException {
            if (isDescending(sortDirection)) {
                return connection.prepareStatement(SEARCH_XP_DESC_SQL);
            }
            return connection.prepareStatement(SEARCH_XP_ASC_SQL);
        }

        private static PreparedStatement type(
                @Nullable CreatureSortDirection sortDirection,
                Connection connection
        ) throws SQLException {
            if (isDescending(sortDirection)) {
                return connection.prepareStatement(SEARCH_TYPE_DESC_SQL);
            }
            return connection.prepareStatement(SEARCH_TYPE_ASC_SQL);
        }

        private static PreparedStatement size(
                @Nullable CreatureSortDirection sortDirection,
                Connection connection
        ) throws SQLException {
            if (isDescending(sortDirection)) {
                return connection.prepareStatement(SEARCH_SIZE_DESC_SQL);
            }
            return connection.prepareStatement(SEARCH_SIZE_ASC_SQL);
        }

        private static boolean isDescending(@Nullable CreatureSortDirection sortDirection) {
            return sortDirection == CreatureSortDirection.DESCENDING;
        }
    }
}
