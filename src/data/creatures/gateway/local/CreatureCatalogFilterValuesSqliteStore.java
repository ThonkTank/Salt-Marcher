package src.data.creatures.gateway.local;

import src.data.creatures.model.CreatureFilterValuesRecord;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

final class CreatureCatalogFilterValuesSqliteStore {

    private static final List<String> DEFAULT_SIZES =
            List.of("Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan");

    private static final String LOAD_DISTINCT_SIZES_SQL =
            "SELECT DISTINCT size FROM creatures WHERE size IS NOT NULL AND TRIM(size) != '' ORDER BY size";
    private static final String LOAD_DISTINCT_TYPES_SQL =
            "SELECT DISTINCT creature_type FROM creatures "
                    + "WHERE creature_type IS NOT NULL AND TRIM(creature_type) != '' ORDER BY creature_type";
    private static final String LOAD_DISTINCT_SUBTYPES_SQL =
            "SELECT DISTINCT subtype FROM creature_subtypes "
                    + "WHERE subtype IS NOT NULL AND TRIM(subtype) != '' ORDER BY subtype";
    private static final String LOAD_DISTINCT_BIOMES_SQL =
            "SELECT DISTINCT biome FROM creature_biomes "
                    + "WHERE biome IS NOT NULL AND TRIM(biome) != '' ORDER BY biome";
    private static final String LOAD_DISTINCT_ALIGNMENTS_SQL =
            "SELECT DISTINCT alignment FROM creatures "
                    + "WHERE alignment IS NOT NULL AND TRIM(alignment) != '' ORDER BY alignment";

    CreatureFilterValuesRecord loadFilterValues(Connection connection) throws SQLException {
        return new CreatureFilterValuesRecord(
                loadDistinctSizes(connection),
                loadDistinctTypes(connection),
                loadDistinctSubtypes(connection),
                loadDistinctBiomes(connection),
                loadDistinctAlignments(connection));
    }

    private List<String> loadDistinctSizes(Connection connection) throws SQLException {
        List<String> sizes;
        try (Statement statement = connection.createStatement();
             ResultSet resultSet = statement.executeQuery(LOAD_DISTINCT_SIZES_SQL)) {
            sizes = readValues(resultSet);
        }
        return sizes.isEmpty() ? DEFAULT_SIZES : sizes;
    }

    private List<String> loadDistinctTypes(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement();
             ResultSet resultSet = statement.executeQuery(LOAD_DISTINCT_TYPES_SQL)) {
            return readValues(resultSet);
        }
    }

    private List<String> loadDistinctSubtypes(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement();
             ResultSet resultSet = statement.executeQuery(LOAD_DISTINCT_SUBTYPES_SQL)) {
            return readValues(resultSet);
        }
    }

    private List<String> loadDistinctBiomes(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement();
             ResultSet resultSet = statement.executeQuery(LOAD_DISTINCT_BIOMES_SQL)) {
            return readValues(resultSet);
        }
    }

    private List<String> loadDistinctAlignments(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement();
             ResultSet resultSet = statement.executeQuery(LOAD_DISTINCT_ALIGNMENTS_SQL)) {
            return readValues(resultSet);
        }
    }

    private List<String> readValues(ResultSet resultSet) throws SQLException {
        List<String> values = new ArrayList<>();
        while (resultSet.next()) {
            values.add(resultSet.getString(1));
        }
        return values;
    }
}
