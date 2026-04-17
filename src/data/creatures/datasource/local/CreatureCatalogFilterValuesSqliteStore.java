package src.data.creatures.datasource.local;

import src.domain.creatures.repository.CreatureCatalogRepository;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

final class CreatureCatalogFilterValuesSqliteStore {

    private static final List<String> DEFAULT_SIZES =
            List.of("Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan");

    CreatureCatalogRepository.DistinctFilterValues loadFilterValues(Connection connection) throws SQLException {
        return new CreatureCatalogRepository.DistinctFilterValues(
                loadDistinctSizes(connection),
                loadDistinctColumn(connection, "creature_type"),
                loadDistinctFromTable(connection, "creature_subtypes", "subtype"),
                loadDistinctFromTable(connection, "creature_biomes", "biome"),
                loadDistinctColumn(connection, "alignment"));
    }

    private List<String> loadDistinctSizes(Connection connection) throws SQLException {
        List<String> sizes = loadDistinctColumn(connection, "size");
        return sizes.isEmpty() ? DEFAULT_SIZES : sizes;
    }

    private List<String> loadDistinctColumn(Connection connection, String columnName) throws SQLException {
        List<String> values = new ArrayList<>();
        String sql = "SELECT DISTINCT " + columnName + " FROM creatures WHERE " + columnName
                + " IS NOT NULL AND TRIM(" + columnName + ") != '' ORDER BY " + columnName;
        try (Statement statement = connection.createStatement();
             ResultSet resultSet = statement.executeQuery(sql)) {
            while (resultSet.next()) {
                values.add(resultSet.getString(1));
            }
        }
        return values;
    }

    private List<String> loadDistinctFromTable(Connection connection, String tableName, String columnName) throws SQLException {
        List<String> values = new ArrayList<>();
        String sql = "SELECT DISTINCT " + columnName + " FROM " + tableName + " WHERE " + columnName
                + " IS NOT NULL AND TRIM(" + columnName + ") != '' ORDER BY " + columnName;
        try (Statement statement = connection.createStatement();
             ResultSet resultSet = statement.executeQuery(sql)) {
            while (resultSet.next()) {
                values.add(resultSet.getString(1));
            }
        }
        return values;
    }
}
