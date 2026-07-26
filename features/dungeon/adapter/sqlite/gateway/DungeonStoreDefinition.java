package features.dungeon.adapter.sqlite.gateway;

import features.dungeon.adapter.sqlite.model.DungeonPersistenceSchema;
import platform.persistence.FeatureStoreDefinition;
import platform.persistence.SqliteMigration;
import platform.persistence.SqliteSchemaValidator;

import java.util.List;

/** Canonical schema plan for the Dungeon-owned store. */
public final class DungeonStoreDefinition {

    public static final String OWNER = "dungeon";

    private DungeonStoreDefinition() {}

    public static FeatureStoreDefinition create() {
        DungeonSqliteSchemaManager schema = new DungeonSqliteSchemaManager();
        SqliteSchemaValidator targetSchema = SqliteSchemaValidator.exactSchema(
                DungeonPersistenceSchema.CREATE_TABLE_SQL,
                DungeonPersistenceSchema.CREATE_INDEX_SQL,
                List.of("dungeon_", "idx_dungeon_"),
                List.of());
        return FeatureStoreDefinition.validated(
                OWNER, targetSchema,
                new SqliteMigration(
                        DungeonSqliteSchemaManager.CURRENT_SCHEMA_VERSION,
                        schema::initializeCurrentTarget));
    }
}
