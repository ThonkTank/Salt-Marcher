package features.creatures.adapter.sqlite.gateway.local;

import features.creatures.adapter.sqlite.model.CreaturesPersistenceSchema;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;

final class CreatureFilterTempTableSchema {

    private static final String DELETE_FROM = "DELETE FROM ";

    private static final String CLEAR_TEMP_FILTER_SIZES_SQL =
            DELETE_FROM + CreaturesPersistenceSchema.TEMP_FILTER_SIZES_TABLE;
    private static final String CLEAR_TEMP_FILTER_TYPES_SQL =
            DELETE_FROM + CreaturesPersistenceSchema.TEMP_FILTER_TYPES_TABLE;
    private static final String CLEAR_TEMP_FILTER_ALIGNMENTS_SQL =
            DELETE_FROM + CreaturesPersistenceSchema.TEMP_FILTER_ALIGNMENTS_TABLE;
    private static final String CLEAR_TEMP_FILTER_SUBTYPES_SQL =
            DELETE_FROM + CreaturesPersistenceSchema.TEMP_FILTER_SUBTYPES_TABLE;
    private static final String CLEAR_TEMP_FILTER_BIOMES_SQL =
            DELETE_FROM + CreaturesPersistenceSchema.TEMP_FILTER_BIOMES_TABLE;

    private CreatureFilterTempTableSchema() {
    }

    static void createTempTables(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute(CreaturesPersistenceSchema.CREATE_TEMP_FILTER_SIZES_TABLE_SQL);
            statement.execute(CreaturesPersistenceSchema.CREATE_TEMP_FILTER_TYPES_TABLE_SQL);
            statement.execute(CreaturesPersistenceSchema.CREATE_TEMP_FILTER_ALIGNMENTS_TABLE_SQL);
            statement.execute(CreaturesPersistenceSchema.CREATE_TEMP_FILTER_SUBTYPES_TABLE_SQL);
            statement.execute(CreaturesPersistenceSchema.CREATE_TEMP_FILTER_BIOMES_TABLE_SQL);
        }
    }

    static void clearTempTables(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.executeUpdate(CLEAR_TEMP_FILTER_SIZES_SQL);
            statement.executeUpdate(CLEAR_TEMP_FILTER_TYPES_SQL);
            statement.executeUpdate(CLEAR_TEMP_FILTER_ALIGNMENTS_SQL);
            statement.executeUpdate(CLEAR_TEMP_FILTER_SUBTYPES_SQL);
            statement.executeUpdate(CLEAR_TEMP_FILTER_BIOMES_SQL);
        }
    }
}
