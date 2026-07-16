package features.creatures.adapter.sqlite.gateway.local;

import java.sql.Connection;
import java.sql.SQLException;

final class CreatureIdentityColumnMigrator {

    private final CreatureIdentityTextColumnMigrator textColumnMigrator = new CreatureIdentityTextColumnMigrator();
    private final CreatureCatalogIdentityColumnMigrator catalogColumnMigrator =
            new CreatureCatalogIdentityColumnMigrator();

    void ensureColumns(Connection connection) throws SQLException {
        textColumnMigrator.ensureColumns(connection);
        catalogColumnMigrator.ensureColumns(connection);
    }
}
