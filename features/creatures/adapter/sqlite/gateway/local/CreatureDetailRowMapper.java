package features.creatures.adapter.sqlite.gateway.local;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import features.creatures.adapter.sqlite.model.CreatureActionRecord;
import features.creatures.adapter.sqlite.model.CreatureDetailRecord;

final class CreatureDetailRowMapper {

    private final CreatureDetailIdentityRowMapper identityMapper;
    private final CreatureDetailVitalsRowMapper vitalsMapper = new CreatureDetailVitalsRowMapper();
    private final CreatureDetailTraitsRowMapper traitsMapper = new CreatureDetailTraitsRowMapper();

    CreatureDetailRowMapper(CreatureDetailStringValuesSqliteStore stringValuesStore) {
        identityMapper = new CreatureDetailIdentityRowMapper(stringValuesStore);
    }

    CreatureDetailRecord toRecord(
            Connection connection,
            ResultSet resultSet,
            long creatureId,
            List<CreatureActionRecord> actions
    ) throws SQLException {
        return new CreatureDetailRecord(
                identityMapper.identity(connection, resultSet, creatureId),
                vitalsMapper.vitals(resultSet),
                traitsMapper.traits(resultSet),
                actions);
    }
}
