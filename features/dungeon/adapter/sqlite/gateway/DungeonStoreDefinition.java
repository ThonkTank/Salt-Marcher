package features.dungeon.adapter.sqlite.gateway;

import platform.persistence.FeatureStoreDefinition;
import platform.persistence.SqliteMigration;

/** Canonical schema plan for the Dungeon-owned store. */
public final class DungeonStoreDefinition {

    public static final String OWNER = "dungeon";

    private DungeonStoreDefinition() {}

    public static FeatureStoreDefinition create() {
        DungeonSqliteSchemaManager schema = new DungeonSqliteSchemaManager();
        return FeatureStoreDefinition.of(
                OWNER,
                new SqliteMigration(1, schema::ensureSchema),
                new SqliteMigration(2, schema::ensureSchema),
                new SqliteMigration(3, schema::replaceWithCanonicalSchema),
                new SqliteMigration(4, schema::addCorridorDoorLevel),
                new SqliteMigration(5, schema::addCorridorRouteCellIndex),
                new SqliteMigration(6, schema::addCorridorRouteDependencyIndex));
    }
}
