package features.creatures.adapter.sqlite.gateway.local;

import java.sql.Connection;
import java.sql.SQLException;

final class CreaturesSchemaTableManager {

    private final CreaturesBaseTableManager baseTableManager = new CreaturesBaseTableManager();
    private final CreatureIdentityColumnMigrator identityColumnMigrator = new CreatureIdentityColumnMigrator();
    private final CreatureVitalsColumnMigrator vitalsColumnMigrator = new CreatureVitalsColumnMigrator();
    private final CreatureMovementColumnMigrator movementColumnMigrator = new CreatureMovementColumnMigrator();
    private final CreatureAbilityColumnMigrator abilityColumnMigrator = new CreatureAbilityColumnMigrator();
    private final CreatureCombatFeatureColumnMigrator combatFeatureColumnMigrator =
            new CreatureCombatFeatureColumnMigrator();
    private final CreatureTraitColumnMigrator traitColumnMigrator = new CreatureTraitColumnMigrator();
    private final CreatureBiomeColumnMigrator biomeColumnMigrator = new CreatureBiomeColumnMigrator();
    private final CreatureSubtypeColumnMigrator subtypeColumnMigrator = new CreatureSubtypeColumnMigrator();
    private final CreatureActionColumnMigrator actionColumnMigrator = new CreatureActionColumnMigrator();

    void createBaseTables(Connection connection) throws SQLException {
        baseTableManager.createBaseTables(connection);
    }

    void ensureCreatureColumns(Connection connection) throws SQLException {
        identityColumnMigrator.ensureColumns(connection);
        vitalsColumnMigrator.ensureColumns(connection);
        movementColumnMigrator.ensureColumns(connection);
        abilityColumnMigrator.ensureColumns(connection);
        combatFeatureColumnMigrator.ensureColumns(connection);
        traitColumnMigrator.ensureColumns(connection);
    }

    void ensureCreatureBiomeColumns(Connection connection) throws SQLException {
        biomeColumnMigrator.ensureColumns(connection);
    }

    void ensureCreatureSubtypeColumns(Connection connection) throws SQLException {
        subtypeColumnMigrator.ensureColumns(connection);
    }

    void ensureCreatureActionColumns(Connection connection) throws SQLException {
        actionColumnMigrator.ensureColumns(connection);
    }
}
