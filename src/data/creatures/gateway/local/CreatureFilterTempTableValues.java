package src.data.creatures.gateway.local;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

final class CreatureFilterTempTableValues {

    private static final String INSERT_TEMP_FILTER_SIZE_SQL =
            "INSERT INTO sm_temp_filter_sizes(value) VALUES (?)";
    private static final String INSERT_TEMP_FILTER_TYPE_SQL =
            "INSERT INTO sm_temp_filter_types(value) VALUES (?)";
    private static final String INSERT_TEMP_FILTER_ALIGNMENT_SQL =
            "INSERT INTO sm_temp_filter_alignments(value) VALUES (?)";
    private static final String INSERT_TEMP_FILTER_SUBTYPE_SQL =
            "INSERT INTO sm_temp_filter_subtypes(value) VALUES (?)";
    private static final String INSERT_TEMP_FILTER_BIOME_SQL =
            "INSERT INTO sm_temp_filter_biomes(value) VALUES (?)";

    private CreatureFilterTempTableValues() {
    }

    static void insertSizes(Connection connection, List<String> values) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(INSERT_TEMP_FILTER_SIZE_SQL)) {
            insertValues(statement, values);
        }
    }

    static void insertTypes(Connection connection, List<String> values) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(INSERT_TEMP_FILTER_TYPE_SQL)) {
            insertValues(statement, values);
        }
    }

    static void insertAlignments(Connection connection, List<String> values) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(INSERT_TEMP_FILTER_ALIGNMENT_SQL)) {
            insertValues(statement, values);
        }
    }

    static void insertSubtypes(Connection connection, List<String> values) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(INSERT_TEMP_FILTER_SUBTYPE_SQL)) {
            insertValues(statement, values);
        }
    }

    static void insertBiomes(Connection connection, List<String> values) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(INSERT_TEMP_FILTER_BIOME_SQL)) {
            insertValues(statement, values);
        }
    }

    private static void insertValues(PreparedStatement statement, List<String> values) throws SQLException {
        for (String value : normalizeValues(values)) {
            statement.setString(1, value);
            statement.addBatch();
        }
        statement.executeBatch();
    }

    private static List<String> normalizeValues(List<String> values) {
        if (values == null || values.isEmpty()) {
            return List.of();
        }
        return values.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .map(value -> value.toLowerCase(Locale.ROOT))
                .distinct()
                .toList();
    }
}
