package features.creatures.adapter.sqlite.gateway.local;

import features.creatures.adapter.sqlite.model.CreaturesPersistenceSchema;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

final class CreatureDetailStringValuesSqliteStore {

    private static final String LOAD_CREATURE_SUBTYPES_SQL =
            "SELECT subtype FROM " + CreaturesPersistenceSchema.CREATURE_SUBTYPES.name()
                    + " WHERE creature_id = ? ORDER BY subtype";
    private static final String LOAD_CREATURE_BIOMES_SQL =
            "SELECT biome FROM " + CreaturesPersistenceSchema.CREATURE_BIOMES.name()
                    + " WHERE creature_id = ? ORDER BY biome";

    List<String> loadSubtypes(Connection connection, long creatureId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(LOAD_CREATURE_SUBTYPES_SQL)) {
            return loadStrings(statement, creatureId);
        }
    }

    List<String> loadBiomes(Connection connection, long creatureId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(LOAD_CREATURE_BIOMES_SQL)) {
            return loadStrings(statement, creatureId);
        }
    }

    private List<String> loadStrings(PreparedStatement statement, long creatureId) throws SQLException {
        List<String> values = new ArrayList<>();
        statement.setLong(1, creatureId);
        try (ResultSet resultSet = statement.executeQuery()) {
            while (resultSet.next()) {
                values.add(resultSet.getString(1));
            }
        }
        return values;
    }
}
