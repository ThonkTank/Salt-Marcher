package features.creatures.adapter.sqlite.query;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import features.creatures.CreaturesServiceAssembly;
import features.creatures.domain.catalog.CreatureCatalogData.CatalogSearchSpec;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.FeatureStoreReadiness;
import platform.persistence.FeatureStoreUnavailableException;
import platform.persistence.SqliteDatabase;

final class CreatureSchemaCompatibilityTest {

    @TempDir
    Path directory;

    @Test
    void historicalVersionOneProviderSupersetRemainsReadableAndUnchanged() throws Exception {
        Path databasePath = directory.resolve("historical-creatures-v1.db");
        createHistoricalVersionOne(databasePath, true);
        HistoricalState before = historicalState(databasePath);

        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            var store = database.featureStore(CreaturesServiceAssembly.storeDefinition());

            assertEquals(
                    FeatureStoreReadiness.READY,
                    database.prepareRegisteredStores().get("creatures"));

            SqliteCreatureCatalogQueryAdapter adapter = new SqliteCreatureCatalogQueryAdapter(store);
            var page = adapter.searchCatalog(new CatalogSearchSpec(
                    "Historic Beast",
                    null,
                    null,
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    "NAME",
                    true,
                    25,
                    0));
            assertEquals(1, page.totalCount());
            assertEquals(101L, page.rows().getFirst().id());

            var detail = adapter.loadCreatureDetail(101L);
            assertNotNull(detail);
            assertEquals("Historic Beast", detail.name());
            assertEquals(List.of("cavern"), detail.biomes());
            assertEquals(List.of("ancient"), detail.subtypes());
            assertEquals(1, detail.actions().size());
            assertEquals("Claw", detail.actions().getFirst().name());
            assertEquals(Integer.valueOf(7), detail.actions().getFirst().toHitBonus());
        }

        assertEquals(before, historicalState(databasePath));
    }

    @Test
    void historicalVersionOneProviderMissingRequiredColumnFailsWithoutMutation() throws Exception {
        Path databasePath = directory.resolve("missing-required-action-column.db");
        createHistoricalVersionOne(databasePath, false);
        HistoricalState before = historicalState(databasePath);

        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            var store = database.featureStore(CreaturesServiceAssembly.storeDefinition());

            assertEquals(
                    FeatureStoreReadiness.MIGRATION_FAILED,
                    database.prepareRegisteredStores().get("creatures"));
            assertThrows(FeatureStoreUnavailableException.class, store::openConnection);
        }

        assertEquals(before, historicalState(databasePath));
    }

    private static void createHistoricalVersionOne(Path databasePath, boolean includeToHitBonus)
            throws Exception {
        Class.forName("org.sqlite.JDBC");
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
             var statement = connection.createStatement()) {
            statement.execute("PRAGMA foreign_keys = ON");
            statement.execute("PRAGMA user_version = 1");
            statement.execute(
                    "CREATE TABLE sm_schema_versions(owner TEXT PRIMARY KEY, version INTEGER NOT NULL)");
            statement.execute("INSERT INTO sm_schema_versions(owner, version) VALUES('creatures', 1)");
            statement.execute("""
                    CREATE TABLE creatures (
                        id INTEGER PRIMARY KEY,
                        name TEXT NOT NULL,
                        size TEXT,
                        creature_type TEXT,
                        alignment TEXT,
                        cr TEXT,
                        xp INTEGER DEFAULT 0,
                        hp INTEGER DEFAULT 0,
                        hit_dice TEXT,
                        ac INTEGER DEFAULT 10,
                        ac_notes TEXT,
                        speed INTEGER DEFAULT 0,
                        fly_speed INTEGER DEFAULT 0,
                        swim_speed INTEGER DEFAULT 0,
                        climb_speed INTEGER DEFAULT 0,
                        burrow_speed INTEGER DEFAULT 0,
                        str INTEGER DEFAULT 10,
                        dex INTEGER DEFAULT 10,
                        con INTEGER DEFAULT 10,
                        intel INTEGER DEFAULT 10,
                        wis INTEGER DEFAULT 10,
                        cha INTEGER DEFAULT 10,
                        initiative_bonus INTEGER DEFAULT 0,
                        proficiency_bonus INTEGER DEFAULT 2,
                        saving_throws TEXT,
                        skills TEXT,
                        damage_vulnerabilities TEXT,
                        damage_resistances TEXT,
                        damage_immunities TEXT,
                        condition_immunities TEXT,
                        senses TEXT,
                        passive_perception INTEGER DEFAULT 10,
                        languages TEXT,
                        legendary_action_count INTEGER DEFAULT 0,
                        source_slug TEXT,
                        slug_key TEXT,
                        hit_dice_count INTEGER,
                        hit_dice_sides INTEGER,
                        hit_dice_modifier INTEGER
                    )
                    """);
            statement.execute("""
                    CREATE TABLE creature_biomes (
                        creature_id INTEGER NOT NULL REFERENCES creatures(id) ON DELETE CASCADE,
                        biome TEXT NOT NULL,
                        PRIMARY KEY (creature_id, biome)
                    )
                    """);
            statement.execute("""
                    CREATE TABLE creature_subtypes (
                        creature_id INTEGER NOT NULL REFERENCES creatures(id) ON DELETE CASCADE,
                        subtype TEXT NOT NULL,
                        PRIMARY KEY (creature_id, subtype)
                    )
                    """);
            String toHitBonusColumn = includeToHitBonus ? ", to_hit_bonus INTEGER" : "";
            statement.execute("CREATE TABLE creature_actions ("
                    + "id INTEGER PRIMARY KEY AUTOINCREMENT, "
                    + "creature_id INTEGER NOT NULL REFERENCES creatures(id) ON DELETE CASCADE, "
                    + "action_type TEXT NOT NULL DEFAULT 'action', "
                    + "name TEXT, description TEXT"
                    + toHitBonusColumn
                    + ", summary_line TEXT, on_hit_text TEXT, on_failed_save_text TEXT, "
                    + "on_successful_save_text TEXT, save_dc INTEGER, save_ability TEXT, options_text TEXT)");

            createRequiredIndexes(statement);
            statement.execute("CREATE INDEX idx_actions_creature_id ON creature_actions(creature_id)");
            statement.execute("""
                    INSERT INTO creatures(
                        id, name, size, creature_type, alignment, cr, xp, hp, hit_dice,
                        hit_dice_count, hit_dice_sides, hit_dice_modifier, ac)
                    VALUES(101, 'Historic Beast', 'Large', 'monstrosity', 'neutral', '5', 1800,
                        80, '10d10+20', 10, 10, 20, 15)
                    """);
            statement.execute("INSERT INTO creature_biomes(creature_id, biome) VALUES(101, 'cavern')");
            statement.execute("INSERT INTO creature_subtypes(creature_id, subtype) VALUES(101, 'ancient')");
            if (includeToHitBonus) {
                statement.execute("""
                        INSERT INTO creature_actions(
                            id, creature_id, action_type, name, description, to_hit_bonus,
                            summary_line, on_hit_text, on_failed_save_text, on_successful_save_text,
                            save_dc, save_ability, options_text)
                        VALUES(901, 101, 'action', 'Claw', 'A historical action.', 7,
                            'summary', 'hit', 'failed', 'succeeded', 15, 'DEX', 'option')
                        """);
            } else {
                statement.execute("""
                        INSERT INTO creature_actions(
                            id, creature_id, action_type, name, description,
                            summary_line, on_hit_text, on_failed_save_text, on_successful_save_text,
                            save_dc, save_ability, options_text)
                        VALUES(901, 101, 'action', 'Claw', 'A historical action.',
                            'summary', 'hit', 'failed', 'succeeded', 15, 'DEX', 'option')
                        """);
            }
        }
    }

    private static void createRequiredIndexes(java.sql.Statement statement) throws Exception {
        statement.execute("CREATE INDEX idx_creatures_type ON creatures(creature_type)");
        statement.execute("CREATE INDEX idx_creatures_alignment ON creatures(alignment)");
        statement.execute("CREATE INDEX idx_creatures_xp ON creatures(xp)");
        statement.execute("CREATE INDEX idx_creatures_name ON creatures(name)");
        statement.execute("CREATE INDEX idx_creature_biomes_biome ON creature_biomes(biome)");
        statement.execute("CREATE INDEX idx_creature_biomes_creature ON creature_biomes(creature_id)");
        statement.execute("CREATE INDEX idx_creature_subtypes_subtype ON creature_subtypes(subtype)");
        statement.execute("CREATE INDEX idx_creature_subtypes_creature ON creature_subtypes(creature_id)");
        statement.execute("CREATE INDEX idx_creature_actions_creature ON creature_actions(creature_id)");
    }

    private static HistoricalState historicalState(Path databasePath) throws Exception {
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
             var statement = connection.createStatement()) {
            statement.execute("PRAGMA query_only = ON");
            List<String> columns = new ArrayList<>();
            try (var rows = statement.executeQuery("PRAGMA table_info(creature_actions)")) {
                while (rows.next()) {
                    columns.add(rows.getString("name"));
                }
            }
            int ownerVersion;
            try (var row = statement.executeQuery(
                    "SELECT version FROM sm_schema_versions WHERE owner='creatures'")) {
                row.next();
                ownerVersion = row.getInt(1);
            }
            String actionTableSql;
            try (var row = statement.executeQuery(
                    "SELECT sql FROM sqlite_schema WHERE type='table' AND name='creature_actions'")) {
                row.next();
                actionTableSql = row.getString(1);
            }
            List<String> ownerTables = List.of(
                    "creatures", "creature_biomes", "creature_subtypes", "creature_actions");
            List<String> ownerTableSql = new ArrayList<>();
            List<Long> ownerRowCounts = new ArrayList<>();
            for (String table : ownerTables) {
                try (var row = statement.executeQuery(
                        "SELECT sql FROM sqlite_schema WHERE type='table' AND name='" + table + "'")) {
                    row.next();
                    ownerTableSql.add(row.getString(1));
                }
                try (var row = statement.executeQuery("SELECT COUNT(*) FROM " + table)) {
                    row.next();
                    ownerRowCounts.add(row.getLong(1));
                }
            }
            String toHitBonusProjection = columns.contains("to_hit_bonus")
                    ? "to_hit_bonus"
                    : "NULL AS to_hit_bonus";
            try (var row = statement.executeQuery("""
                    SELECT COUNT(*) OVER() AS row_count, id, creature_id, action_type, name, description,
                           %s,
                           summary_line, on_hit_text, on_failed_save_text,
                           on_successful_save_text, save_dc, save_ability, options_text
                    FROM creature_actions
                    """.formatted(toHitBonusProjection))) {
                row.next();
                return new HistoricalState(
                        ownerVersion,
                        List.copyOf(columns),
                        actionTableSql,
                        List.copyOf(ownerTableSql),
                        List.copyOf(ownerRowCounts),
                        row.getLong("row_count"),
                        row.getLong("id"),
                        row.getLong("creature_id"),
                        row.getString("action_type"),
                        row.getString("name"),
                        row.getString("description"),
                        (Integer) row.getObject("to_hit_bonus"),
                        row.getString("summary_line"),
                        row.getString("on_hit_text"),
                        row.getString("on_failed_save_text"),
                        row.getString("on_successful_save_text"),
                        row.getInt("save_dc"),
                        row.getString("save_ability"),
                        row.getString("options_text"));
            }
        }
    }

    private record HistoricalState(
            int ownerVersion,
            List<String> actionColumns,
            String actionTableSql,
            List<String> ownerTableSql,
            List<Long> ownerRowCounts,
            long actionRows,
            long actionId,
            long creatureId,
            String actionType,
            String name,
            String description,
            Integer toHitBonus,
            String summaryLine,
            String onHitText,
            String onFailedSaveText,
            String onSuccessfulSaveText,
            int saveDc,
            String saveAbility,
            String optionsText
    ) {
    }
}
