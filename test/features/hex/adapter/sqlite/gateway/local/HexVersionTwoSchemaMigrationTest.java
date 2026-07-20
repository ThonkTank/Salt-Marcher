package features.hex.adapter.sqlite.gateway.local;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.hex.adapter.sqlite.repository.SqliteHexMapRepository;
import features.hex.domain.map.HexCoordinate;
import features.hex.domain.map.HexTerrain;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import platform.diagnostics.NoopDiagnostics;
import platform.persistence.FeatureStoreReadiness;
import platform.persistence.FeatureStoreUnavailableException;
import platform.persistence.SqliteDatabase;

import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

final class HexVersionTwoSchemaMigrationTest {

    @Test
    void migratesKnownHybridVersionOneAndReadsItThroughTheProductionRepository(
            @TempDir Path tempDir
    ) throws Exception {
        Path databasePath = tempDir.resolve("known-hybrid-v1.db");
        createKnownHybridVersionOne(databasePath);

        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            var store = database.featureStore(SqliteHexMapRepository.storeDefinition());
            assertEquals(FeatureStoreReadiness.READY, database.prepareRegisteredStores().get("hex"));

            var loaded = new SqliteHexMapRepository(store).loadSelected().orElseThrow();
            assertEquals(1L, loaded.mapId().value());
            assertEquals("Alte Karte", loaded.displayName());
            assertEquals(2, loaded.radius());
            assertEquals(19, loaded.coordinates().size());
            assertEquals(HexTerrain.FOREST, loaded.terrainAt(new HexCoordinate(0, 0)));
            assertEquals(HexTerrain.MOUNTAINS, loaded.terrainAt(new HexCoordinate(1, 0)));
            assertEquals(1, loaded.markers().size());
            assertEquals("Tor", loaded.markers().getFirst().name());
        }

        assertMigratedTarget(databasePath);

        try (SqliteDatabase reopened = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            var store = reopened.featureStore(SqliteHexMapRepository.storeDefinition());
            assertEquals(FeatureStoreReadiness.READY, reopened.prepareRegisteredStores().get("hex"));
            assertEquals("Alte Karte",
                    new SqliteHexMapRepository(store).loadSelected().orElseThrow().displayName());
        }
    }

    @Test
    void advancesAnAlreadyCurrentVersionOneTargetWithoutRebuildingItsRows(
            @TempDir Path tempDir
    ) throws Exception {
        Path databasePath = tempDir.resolve("current-v1.db");
        createCurrentVersionOne(databasePath);

        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            var store = database.featureStore(SqliteHexMapRepository.storeDefinition());
            assertEquals(FeatureStoreReadiness.READY, database.prepareRegisteredStores().get("hex"));
            assertEquals("Current", new SqliteHexMapRepository(store).loadSelected().orElseThrow().displayName());
        }

        try (Connection connection = open(databasePath)) {
            assertEquals(2, scalarInt(connection,
                    "SELECT version FROM sm_schema_versions WHERE owner='hex'"));
            assertEquals("2026-06-19T00:00:00Z", scalarText(connection,
                    "SELECT updated_at FROM hex_maps WHERE map_id=1"));
        }
    }

    @Test
    void rejectsCurrentVersionOneTargetWithoutTheDeclaredCurrentMapForeignKey(
            @TempDir Path tempDir
    ) throws Exception {
        Path databasePath = tempDir.resolve("current-v1-missing-fk.db");
        createCurrentVersionOne(databasePath);
        replaceCurrentMapForeignKey(databasePath, "");

        assertMigrationFails(databasePath);
        assertCurrentVersionOneWasNotChanged(databasePath);
    }

    @Test
    void rejectsCurrentVersionOneTargetWithTheWrongCurrentMapDeleteSemantics(
            @TempDir Path tempDir
    ) throws Exception {
        Path databasePath = tempDir.resolve("current-v1-wrong-fk.db");
        createCurrentVersionOne(databasePath);
        replaceCurrentMapForeignKey(
                databasePath, " REFERENCES hex_maps(map_id) ON DELETE CASCADE");

        assertMigrationFails(databasePath);
        assertCurrentVersionOneWasNotChanged(databasePath);
    }

    @Test
    void rollsBackWhenLegacyTilesContainTruthTheTargetCannotRepresent(
            @TempDir Path tempDir
    ) throws Exception {
        Path databasePath = tempDir.resolve("unrepresentable-v1.db");
        createKnownHybridVersionOne(databasePath);
        try (Connection connection = open(databasePath)) {
            connection.createStatement().execute(
                    "UPDATE hex_tiles SET elevation=3, notes='kept' WHERE map_id=1 AND q=0 AND r=0");
        }

        assertMigrationFails(databasePath);

        try (Connection connection = open(databasePath)) {
            assertEquals(1, scalarInt(connection,
                    "SELECT version FROM sm_schema_versions WHERE owner='hex'"));
            assertEquals(3, scalarInt(connection,
                    "SELECT elevation FROM hex_tiles WHERE map_id=1 AND q=0 AND r=0"));
            assertEquals("kept", scalarText(connection,
                    "SELECT notes FROM hex_tiles WHERE map_id=1 AND q=0 AND r=0"));
            assertTrue(columns(connection, "hex_tiles").contains("tile_id"));
            assertFalse(tableExists(connection, "sm_hex_v2_maps"));
        }
    }

    @Test
    void rejectsAnUnknownVersionOneSignatureWithoutChangingIt(
            @TempDir Path tempDir
    ) throws Exception {
        Path databasePath = tempDir.resolve("unknown-v1.db");
        createKnownHybridVersionOne(databasePath);
        try (Connection connection = open(databasePath)) {
            connection.createStatement().execute("ALTER TABLE hex_maps ADD COLUMN unknown_truth TEXT");
        }

        assertMigrationFails(databasePath);

        try (Connection connection = open(databasePath)) {
            assertEquals(1, scalarInt(connection,
                    "SELECT version FROM sm_schema_versions WHERE owner='hex'"));
            assertTrue(columns(connection, "hex_maps").contains("unknown_truth"));
            assertEquals(1, scalarInt(connection, "SELECT COUNT(*) FROM hex_maps"));
            assertFalse(tableExists(connection, "sm_hex_v2_maps"));
        }
    }

    @Test
    void rejectsUnknownInboundHexOwnerBeforeCreatingStagingTables(
            @TempDir Path tempDir
    ) throws Exception {
        Path databasePath = tempDir.resolve("unknown-inbound-owner.db");
        createKnownHybridVersionOne(databasePath);
        try (Connection connection = open(databasePath); Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA foreign_keys=ON");
            statement.execute("CREATE TABLE unknown_hex_consumer (consumer_id INTEGER PRIMARY KEY, "
                    + "tile_id INTEGER NOT NULL REFERENCES HEX_TILES(tile_id), payload TEXT NOT NULL)");
            statement.execute("INSERT INTO unknown_hex_consumer(consumer_id,tile_id,payload) "
                    + "SELECT 1,tile_id,'unknown-kept' FROM hex_tiles WHERE map_id=1 AND q=0 AND r=0");
        }

        assertMigrationFails(databasePath);

        try (Connection connection = open(databasePath)) {
            assertEquals(1, scalarInt(connection,
                    "SELECT version FROM sm_schema_versions WHERE owner='hex'"));
            assertEquals("unknown-kept", scalarText(connection,
                    "SELECT payload FROM unknown_hex_consumer WHERE consumer_id=1"));
            assertTrue(tableExists(connection, "hex_maps"));
            assertTrue(tableExists(connection, "hex_tiles"));
            assertFalse(tableExists(connection, "sm_hex_v1_maps_archive"));
            assertFalse(tableExists(connection, "sm_hex_v2_maps"));
        }
    }

    @Test
    void rejectsInboundReferenceToAHexChildTableThatMigrationWouldDrop(
            @TempDir Path tempDir
    ) throws Exception {
        Path databasePath = tempDir.resolve("inbound-current-map-owner.db");
        createKnownHybridVersionOne(databasePath);
        try (Connection connection = open(databasePath); Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA foreign_keys=ON");
            statement.execute("CREATE TABLE current_map_consumer (consumer_id INTEGER PRIMARY KEY, "
                    + "singleton_id INTEGER NOT NULL REFERENCES HEX_CURRENT_MAP(singleton_id), "
                    + "payload TEXT NOT NULL)");
            statement.execute("INSERT INTO current_map_consumer(consumer_id,singleton_id,payload) "
                    + "VALUES(1,1,'child-reference-kept')");
        }

        assertMigrationFails(databasePath);

        try (Connection connection = open(databasePath)) {
            assertEquals(1, scalarInt(connection,
                    "SELECT version FROM sm_schema_versions WHERE owner='hex'"));
            assertEquals("child-reference-kept", scalarText(connection,
                    "SELECT payload FROM current_map_consumer WHERE consumer_id=1"));
            assertTrue(tableExists(connection, "hex_current_map"));
            assertFalse(tableExists(connection, "sm_hex_v1_maps_archive"));
            assertFalse(tableExists(connection, "sm_hex_v2_maps"));
        }
    }

    @Test
    void rejectsAViewThatRenameWouldRetargetToTheHexArchive(
            @TempDir Path tempDir
    ) throws Exception {
        Path databasePath = tempDir.resolve("inbound-hex-view.db");
        createKnownHybridVersionOne(databasePath);
        String viewSql = "CREATE VIEW foreign_hex_map_view AS "
                + "SELECT map_id,name FROM hex_maps";
        try (Connection connection = open(databasePath)) {
            connection.createStatement().execute(viewSql);
        }

        assertMigrationFails(databasePath);

        try (Connection connection = open(databasePath)) {
            assertEquals(1, scalarInt(connection,
                    "SELECT version FROM sm_schema_versions WHERE owner='hex'"));
            assertEquals(viewSql, scalarText(connection,
                    "SELECT sql FROM sqlite_master WHERE type='view' AND name='foreign_hex_map_view'"));
            assertEquals(1, scalarInt(connection, "SELECT COUNT(*) FROM foreign_hex_map_view"));
            assertFalse(tableExists(connection, "sm_hex_v1_maps_archive"));
            assertFalse(tableExists(connection, "sm_hex_v2_maps"));
        }
    }

    private static void assertMigrationFails(Path databasePath) {
        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            var store = database.featureStore(SqliteHexMapRepository.storeDefinition());
            assertEquals(FeatureStoreReadiness.MIGRATION_FAILED,
                    database.prepareRegisteredStores().get("hex"));
            assertThrows(FeatureStoreUnavailableException.class, store::openConnection);
        }
    }

    private static void assertMigratedTarget(Path databasePath) throws Exception {
        try (Connection connection = open(databasePath)) {
            assertEquals(2, scalarInt(connection,
                    "SELECT version FROM sm_schema_versions WHERE owner='hex'"));
            assertEquals(List.of("map_id", "display_name", "radius", "updated_at"),
                    columns(connection, "hex_maps"));
            assertEquals(List.of("map_id", "q", "r"), columns(connection, "hex_tiles"));
            assertEquals(19, scalarInt(connection, "SELECT COUNT(*) FROM hex_tiles"));
            assertEquals(2, scalarInt(connection, "SELECT COUNT(*) FROM hex_terrain_overrides"));
            assertEquals("MOUNTAINS", scalarText(connection,
                    "SELECT terrain FROM hex_terrain_overrides WHERE map_id=1 AND q=1 AND r=0"));
            assertEquals(1, scalarInt(connection, "SELECT map_id FROM hex_current_map WHERE singleton_id=1"));
            assertEquals(1, scalarInt(connection, "SELECT COUNT(*) FROM hex_markers"));
            assertEquals(1, scalarInt(connection,
                    "SELECT COUNT(*) FROM campaign_state WHERE notes='cross-owner-kept'"));
            assertEquals(List.of("sm_hex_v1_maps_archive", "sm_hex_v1_tiles_archive"),
                    hexArchiveForeignKeyTargets(connection, "campaign_state"));
            assertEquals(List.of("sm_hex_v1_tiles_archive"),
                    hexArchiveForeignKeyTargets(connection, "world_locations"));
            assertEquals(List.of("sm_hex_v1_tiles_archive"),
                    hexArchiveForeignKeyTargets(connection, "tile_faction_influence"));
            assertEquals("Ort", scalarText(connection,
                    "SELECT name FROM world_locations WHERE location_id=1"));
            assertEquals("presence", scalarText(connection,
                    "SELECT control_type FROM tile_faction_influence WHERE faction_id=1"));
            assertEquals(1, scalarInt(connection, "SELECT COUNT(*) FROM sm_hex_v1_maps_archive"));
            assertEquals(19, scalarInt(connection, "SELECT COUNT(*) FROM sm_hex_v1_tiles_archive"));
            assertFalse(connection.createStatement().executeQuery("PRAGMA foreign_key_check").next());
        }
    }

    private static void createKnownHybridVersionOne(Path databasePath) throws Exception {
        Class.forName("org.sqlite.JDBC");
        try (Connection connection = open(databasePath); Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA foreign_keys=ON");
            createPlatformMetadata(statement);
            statement.execute("CREATE TABLE hex_maps (map_id INTEGER PRIMARY KEY AUTOINCREMENT, "
                    + "name TEXT NOT NULL, is_bounded INTEGER NOT NULL DEFAULT 0, radius INTEGER)");
            statement.execute("CREATE TABLE hex_current_map (singleton_id INTEGER PRIMARY KEY "
                    + "CHECK (singleton_id=1), map_id INTEGER REFERENCES hex_maps(map_id) ON DELETE SET NULL)");
            statement.execute("CREATE TABLE hex_tiles (tile_id INTEGER PRIMARY KEY AUTOINCREMENT, "
                    + "map_id INTEGER NOT NULL REFERENCES hex_maps(map_id) ON DELETE CASCADE, "
                    + "q INTEGER NOT NULL, r INTEGER NOT NULL, terrain_type TEXT NOT NULL DEFAULT 'grassland', "
                    + "elevation INTEGER NOT NULL DEFAULT 0, biome TEXT, is_explored INTEGER NOT NULL DEFAULT 0, "
                    + "dominant_faction_id INTEGER, notes TEXT, UNIQUE(map_id,q,r))");
            statement.execute("CREATE INDEX idx_hex_tiles_map ON hex_tiles(map_id)");
            statement.execute("CREATE INDEX idx_hex_tiles_faction ON hex_tiles(dominant_faction_id)");
            statement.execute("CREATE INDEX idx_hex_tiles_order ON hex_tiles(map_id,q,r)");
            statement.execute("CREATE TABLE hex_terrain_overrides (map_id INTEGER NOT NULL REFERENCES "
                    + "hex_maps(map_id) ON DELETE CASCADE, q INTEGER NOT NULL, r INTEGER NOT NULL, "
                    + "terrain TEXT NOT NULL, PRIMARY KEY(map_id,q,r), FOREIGN KEY(map_id,q,r) REFERENCES "
                    + "hex_tiles(map_id,q,r) ON DELETE CASCADE)");
            statement.execute("CREATE TABLE hex_markers (map_id INTEGER NOT NULL REFERENCES hex_maps(map_id) "
                    + "ON DELETE CASCADE, marker_id INTEGER NOT NULL, q INTEGER NOT NULL, r INTEGER NOT NULL, "
                    + "name TEXT NOT NULL, marker_type TEXT NOT NULL, note TEXT, PRIMARY KEY(map_id,marker_id), "
                    + "FOREIGN KEY(map_id,q,r) REFERENCES hex_tiles(map_id,q,r) ON DELETE CASCADE)");
            statement.execute("CREATE INDEX idx_hex_terrain_order ON hex_terrain_overrides(map_id,q,r)");
            statement.execute("CREATE INDEX idx_hex_markers_tile ON hex_markers(map_id,q,r)");
            createKnownInboundConsumers(statement);
            statement.execute("INSERT INTO hex_maps(map_id,name,is_bounded,radius) "
                    + "VALUES(1,'Alte Karte',1,2)");
            insertLegacyTiles(connection);
            statement.execute("INSERT INTO factions(faction_id) VALUES(1)");
            statement.execute("INSERT INTO world_locations(location_id,tile_id,name,location_type,description) "
                    + "SELECT 1,tile_id,'Ort','LANDMARK','kept' FROM hex_tiles "
                    + "WHERE map_id=1 AND q=0 AND r=1");
            statement.execute("INSERT INTO tile_faction_influence(tile_id,faction_id) "
                    + "SELECT tile_id,1 FROM hex_tiles WHERE map_id=1 AND q=0 AND r=1");
            statement.execute("INSERT INTO campaign_state(campaign_id,map_id,party_tile_id,notes) "
                    + "SELECT 1,1,tile_id,'cross-owner-kept' FROM hex_tiles "
                    + "WHERE map_id=1 AND q=0 AND r=1");
            statement.execute("INSERT INTO hex_current_map(singleton_id,map_id) VALUES(1,1)");
            statement.execute("INSERT INTO hex_terrain_overrides(map_id,q,r,terrain) VALUES(1,0,0,'FOREST')");
            statement.execute("INSERT INTO hex_markers(map_id,marker_id,q,r,name,marker_type,note) "
                    + "VALUES(1,1,0,1,'Tor','LANDMARK','Kept')");
        }
    }

    private static void insertLegacyTiles(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "INSERT INTO hex_tiles(map_id,q,r,terrain_type) VALUES(1,?,?,?)")) {
            for (int q = -2; q <= 2; q++) {
                for (int r = -2; r <= 2; r++) {
                    if (Math.max(Math.max(Math.abs(q), Math.abs(r)), Math.abs(q + r)) > 2) {
                        continue;
                    }
                    statement.setInt(1, q);
                    statement.setInt(2, r);
                    statement.setString(3, terrain(q, r));
                    statement.addBatch();
                }
            }
            statement.executeBatch();
        }
    }

    private static String terrain(int q, int r) {
        if (q == 0 && r == 0) {
            return "forest";
        }
        return q == 1 && r == 0 ? "mountain" : "grassland";
    }

    private static void createCurrentVersionOne(Path databasePath) throws Exception {
        Class.forName("org.sqlite.JDBC");
        try (Connection connection = open(databasePath); Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA foreign_keys=ON");
            createPlatformMetadata(statement);
            new HexSqliteSchemaMigrator().ensureSchema(connection);
            statement.execute("INSERT INTO hex_maps(map_id,display_name,radius,updated_at) "
                    + "VALUES(1,'Current',0,'2026-06-19T00:00:00Z')");
            statement.execute("INSERT INTO hex_tiles(map_id,q,r) VALUES(1,0,0)");
            statement.execute("INSERT INTO hex_current_map(singleton_id,map_id) VALUES(1,1)");
        }
    }

    private static void createKnownInboundConsumers(Statement statement) throws SQLException {
        statement.execute("CREATE TABLE factions(faction_id INTEGER PRIMARY KEY)");
        statement.execute("CREATE TABLE calendar_config(calendar_id INTEGER PRIMARY KEY)");
        statement.execute("CREATE TABLE time_of_day_phases(phase_id INTEGER PRIMARY KEY)");
        statement.execute("CREATE TABLE dungeon_maps(dungeon_map_id INTEGER PRIMARY KEY)");
        statement.execute("CREATE TABLE dungeon_rooms(room_id INTEGER PRIMARY KEY)");
        statement.execute("CREATE TABLE dungeon_corridors(corridor_id INTEGER PRIMARY KEY)");
        statement.execute("CREATE TABLE world_locations (location_id INTEGER PRIMARY KEY AUTOINCREMENT, "
                + "tile_id INTEGER NOT NULL REFERENCES hex_tiles(tile_id) ON DELETE CASCADE, "
                + "name TEXT NOT NULL, location_type TEXT NOT NULL, description TEXT, "
                + "is_discovered INTEGER NOT NULL DEFAULT 0)");
        statement.execute("CREATE INDEX idx_world_locations_tile ON world_locations(tile_id)");
        statement.execute("CREATE TABLE tile_faction_influence (tile_id INTEGER NOT NULL REFERENCES "
                + "hex_tiles(tile_id) ON DELETE CASCADE, faction_id INTEGER NOT NULL REFERENCES "
                + "factions(faction_id) ON DELETE CASCADE, influence INTEGER NOT NULL DEFAULT 0, "
                + "control_type TEXT NOT NULL DEFAULT 'presence', PRIMARY KEY(tile_id,faction_id), "
                + "CHECK(influence BETWEEN 0 AND 100))");
        statement.execute("CREATE INDEX idx_tile_influence_faction "
                + "ON tile_faction_influence(faction_id)");
        statement.execute("CREATE TABLE campaign_state (campaign_id INTEGER PRIMARY KEY DEFAULT 1, "
                + "map_id INTEGER REFERENCES hex_maps(map_id), "
                + "party_tile_id INTEGER REFERENCES hex_tiles(tile_id), "
                + "calendar_id INTEGER REFERENCES calendar_config(calendar_id), "
                + "current_epoch_day INTEGER NOT NULL DEFAULT 0, "
                + "current_phase_id INTEGER REFERENCES time_of_day_phases(phase_id), "
                + "current_weather TEXT, notes TEXT, "
                + "dungeon_map_id INTEGER REFERENCES dungeon_maps(dungeon_map_id) ON DELETE SET NULL, "
                + "dungeon_room_id INTEGER REFERENCES dungeon_rooms(room_id) ON DELETE SET NULL, "
                + "dungeon_location_type TEXT, "
                + "dungeon_corridor_id INTEGER REFERENCES dungeon_corridors(corridor_id) ON DELETE SET NULL, "
                + "dungeon_location_key TEXT)");
    }

    private static void replaceCurrentMapForeignKey(Path databasePath, String referenceClause) throws Exception {
        try (Connection connection = open(databasePath); Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA foreign_keys=OFF");
            statement.execute("DROP TABLE hex_current_map");
            statement.execute("CREATE TABLE hex_current_map (singleton_id INTEGER PRIMARY KEY "
                    + "CHECK(singleton_id=1), map_id INTEGER" + referenceClause + ")");
            statement.execute("INSERT INTO hex_current_map(singleton_id,map_id) VALUES(1,1)");
        }
    }

    private static void assertCurrentVersionOneWasNotChanged(Path databasePath) throws Exception {
        try (Connection connection = open(databasePath)) {
            assertEquals(1, scalarInt(connection,
                    "SELECT version FROM sm_schema_versions WHERE owner='hex'"));
            assertEquals("Current", scalarText(connection,
                    "SELECT display_name FROM hex_maps WHERE map_id=1"));
            assertFalse(tableExists(connection, "sm_hex_v2_maps"));
        }
    }

    private static void createPlatformMetadata(Statement statement) throws SQLException {
        statement.execute("PRAGMA user_version=1");
        statement.execute("CREATE TABLE sm_schema_versions (owner TEXT PRIMARY KEY, "
                + "version INTEGER NOT NULL CHECK(version>=0))");
        statement.execute("INSERT INTO sm_schema_versions(owner,version) VALUES('hex',1)");
    }

    private static Connection open(Path databasePath) throws SQLException {
        return DriverManager.getConnection("jdbc:sqlite:" + databasePath);
    }

    private static boolean tableExists(Connection connection, String table) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?")) {
            statement.setString(1, table);
            try (ResultSet result = statement.executeQuery()) {
                return result.next();
            }
        }
    }

    private static List<String> columns(Connection connection, String table) throws SQLException {
        List<String> columns = new ArrayList<>();
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("PRAGMA table_info(" + table + ")")) {
            while (result.next()) {
                columns.add(result.getString("name"));
            }
        }
        return List.copyOf(columns);
    }

    private static List<String> hexArchiveForeignKeyTargets(Connection connection, String table)
            throws SQLException {
        List<String> targets = new ArrayList<>();
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("PRAGMA foreign_key_list(" + table + ")")) {
            while (result.next()) {
                String target = result.getString("table");
                if (target.startsWith("sm_hex_v1_")) {
                    targets.add(target);
                }
            }
        }
        targets.sort(String::compareTo);
        return List.copyOf(targets);
    }

    private static int scalarInt(Connection connection, String query) throws SQLException {
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery(query)) {
            assertTrue(result.next());
            return result.getInt(1);
        }
    }

    private static String scalarText(Connection connection, String query) throws SQLException {
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery(query)) {
            assertTrue(result.next());
            return result.getString(1);
        }
    }
}
