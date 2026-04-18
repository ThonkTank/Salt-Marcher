package src.data.creatures.gateway.local;

import src.data.creatures.model.CreatureCatalogPageRecord;
import src.data.creatures.model.CreatureCatalogRecord;
import src.domain.creatures.api.CreatureCatalogSortField;
import src.domain.creatures.api.CreatureSortDirection;
import src.domain.creatures.catalog.CreatureCatalogQueryPort;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

final class CreatureCatalogSearchSqliteStore {

    CreatureCatalogPageRecord searchCatalog(Connection connection, CreatureCatalogQueryPort.CatalogSearchSpec spec)
            throws SQLException {
        StringBuilder sql = new StringBuilder(
                "SELECT id, name, size, creature_type, alignment, cr, xp, hp, ac, COUNT(*) OVER() AS total_count"
                        + " FROM creatures WHERE 1=1");
        List<Object> params = new ArrayList<>();
        CreaturesCatalogFilterSqlAppender.appendCatalogFilters(sql, params, spec);
        sql.append(" ORDER BY ").append(resolveSortColumn(spec.sortField())).append(" ")
                .append(spec.sortDirection() == CreatureSortDirection.DESCENDING ? "DESC" : "ASC")
                .append(", name ASC LIMIT ? OFFSET ?");
        params.add(spec.pageSize());
        params.add(spec.pageOffset());

        List<CreatureCatalogRecord> rows = new ArrayList<>();
        int totalCount = 0;
        try (PreparedStatement statement = connection.prepareStatement(sql.toString())) {
            CreaturesSqliteQuerySupport.bindParams(statement, params);
            try (ResultSet resultSet = statement.executeQuery()) {
                while (resultSet.next()) {
                    if (rows.isEmpty()) {
                        totalCount = resultSet.getInt("total_count");
                    }
                    rows.add(new CreatureCatalogRecord(
                            resultSet.getLong("id"),
                            resultSet.getString("name"),
                            resultSet.getString("size"),
                            resultSet.getString("creature_type"),
                            resultSet.getString("alignment"),
                            resultSet.getString("cr"),
                            resultSet.getInt("xp"),
                            resultSet.getInt("hp"),
                            resultSet.getInt("ac")));
                }
            }
        }
        return new CreatureCatalogPageRecord(rows, totalCount, spec.pageSize(), spec.pageOffset());
    }

    private String resolveSortColumn(CreatureCatalogSortField sortField) {
        if (sortField == null) {
            return "name";
        }
        return switch (sortField) {
            case NAME -> "name";
            case CHALLENGE_RATING, XP -> "xp";
            case TYPE -> "creature_type";
            case SIZE -> "size";
        };
    }
}
