package features.creatures.adapter.sqlite.gateway.local;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import features.creatures.adapter.sqlite.model.CreatureDetailRecord;

final class CreatureDetailIdentityRowMapper {

    private final CreatureDetailStringValuesSqliteStore stringValuesStore;

    CreatureDetailIdentityRowMapper(CreatureDetailStringValuesSqliteStore stringValuesStore) {
        this.stringValuesStore = stringValuesStore;
    }

    CreatureDetailRecord.Identity identity(Connection connection, ResultSet resultSet, long creatureId)
            throws SQLException {
        return new CreatureDetailRecord.Identity(
                resultSet.getLong("id"),
                resultSet.getString("name"),
                classification(connection, resultSet, creatureId),
                resultSet.getString("cr"),
                resultSet.getInt("xp"));
    }

    private CreatureDetailRecord.Classification classification(
            Connection connection,
            ResultSet resultSet,
            long creatureId
    ) throws SQLException {
        return new CreatureDetailRecord.Classification(
                resultSet.getString("size"),
                resultSet.getString("creature_type"),
                stringValuesStore.loadSubtypes(connection, creatureId),
                stringValuesStore.loadBiomes(connection, creatureId),
                resultSet.getString("alignment"));
    }
}
