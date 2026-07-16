package features.creatures.adapter.sqlite.gateway.local;

import java.sql.Connection;
import java.sql.SQLException;

final class CreatureTraitColumnMigrator {

    private final CreatureTraitSkillColumnMigrator skillColumnMigrator = new CreatureTraitSkillColumnMigrator();
    private final CreatureDefenseColumnMigrator defenseColumnMigrator = new CreatureDefenseColumnMigrator();
    private final CreatureSenseColumnMigrator senseColumnMigrator = new CreatureSenseColumnMigrator();

    void ensureColumns(Connection connection) throws SQLException {
        skillColumnMigrator.ensureColumns(connection);
        defenseColumnMigrator.ensureColumns(connection);
        senseColumnMigrator.ensureColumns(connection);
    }
}
