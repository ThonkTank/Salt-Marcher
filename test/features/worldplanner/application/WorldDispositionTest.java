package features.worldplanner.application;

import static org.junit.jupiter.api.Assertions.assertEquals;

import features.worldplanner.WorldPlannerServiceAssembly;
import features.worldplanner.adapter.sqlite.repository.SqliteWorldPlannerRepository;
import features.worldplanner.api.SetWorldFactionDispositionCommand;
import features.worldplanner.api.SetWorldNpcDispositionModifierCommand;
import features.worldplanner.api.WorldDispositionKind;
import features.worldplanner.domain.world.WorldDisposition;
import features.worldplanner.domain.world.WorldFaction;
import features.worldplanner.domain.world.WorldNpc;
import features.worldplanner.domain.world.WorldNpcLifecycleState;
import features.worldplanner.domain.world.WorldPlannerState;
import features.worldplanner.domain.world.port.WorldPlannerReferencePort;
import features.worldplanner.domain.world.repository.WorldPlannerRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteDatabase;
import platform.persistence.TestFeatureStores;

import java.nio.file.Path;
import java.sql.DriverManager;
import java.util.List;

final class WorldDispositionTest {

    @TempDir
    Path temporaryDirectory;

    @Test
    void commandsPublishClampedEffectiveDispositionAndReassignFactionMembership() {
        RecordingRepository repository = new RecordingRepository(fixture());
        WorldPlannerServiceAssembly assembly = new WorldPlannerServiceAssembly(repository, positiveReferences());
        var application = assembly.createApplicationService();
        var snapshot = assembly.snapshotModel();

        application.setFactionDisposition(new SetWorldFactionDispositionCommand(1L, 45));
        application.setNpcDispositionModifier(new SetWorldNpcDispositionModifierCommand(1L, 30));

        assertEquals(45, snapshot.current().factions().getFirst().disposition());
        assertEquals(30, snapshot.current().npcs().getFirst().dispositionModifier());
        assertEquals(50, snapshot.current().npcs().getFirst().effectiveDisposition());
        assertEquals(WorldDispositionKind.FRIENDLY, snapshot.current().npcs().getFirst().disposition());

        application.setFactionDisposition(new SetWorldFactionDispositionCommand(1L, -80));
        application.setNpcDispositionModifier(new SetWorldNpcDispositionModifierCommand(1L, 35));

        assertEquals(-50, snapshot.current().factions().getFirst().disposition());
        assertEquals(-15, snapshot.current().npcs().getFirst().effectiveDisposition());
        assertEquals(WorldDispositionKind.HOSTILE, snapshot.current().npcs().getFirst().disposition());

        application.addFactionNpc(new features.worldplanner.api.AddWorldFactionNpcCommand(2L, 1L));

        assertEquals(List.of(), snapshot.current().factions().get(0).npcIds());
        assertEquals(List.of(1L), snapshot.current().factions().get(1).npcIds());
        assertEquals(2L, snapshot.current().npcs().getFirst().factionId());
    }

    @Test
    void classificationUsesInclusiveThresholds() {
        assertEquals(WorldDisposition.Kind.HOSTILE, WorldDisposition.kind(-15));
        assertEquals(WorldDisposition.Kind.NEUTRAL, WorldDisposition.kind(-14));
        assertEquals(WorldDisposition.Kind.NEUTRAL, WorldDisposition.kind(14));
        assertEquals(WorldDisposition.Kind.FRIENDLY, WorldDisposition.kind(15));
        assertEquals(-50, WorldDisposition.clamp(-80));
        assertEquals(50, WorldDisposition.clamp(80));
    }

    @Test
    void versionTwoMigrationDefaultsExistingRowsAndNormalizesMembership() throws Exception {
        Path databasePath = temporaryDirectory.resolve("world-v1.db");
        createLegacyVersionOneDatabase(databasePath);

        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            WorldPlannerState migrated = new SqliteWorldPlannerRepository(
                                    TestFeatureStores.store(
                                            database,
                                            SqliteWorldPlannerRepository.storeDefinition())).load();

            assertEquals(0, migrated.npcs().getFirst().dispositionModifier());
            assertEquals(0, migrated.factions().getFirst().disposition());
            assertEquals(List.of(1L), migrated.factions().get(0).npcIds());
            assertEquals(List.of(), migrated.factions().get(1).npcIds());
        }

        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
                var statement = connection.prepareStatement(
                                "SELECT version FROM sm_schema_versions WHERE owner ="
                                    + " 'world-planner'")) {
            try (var result = statement.executeQuery()) {
                assertEquals(true, result.next());
                assertEquals(2, result.getInt(1));
            }
        }
    }

    private static WorldPlannerState fixture() {
        WorldNpc npc = new WorldNpc(
                1L, "Rivalin", 10L, "", "", "", "", WorldNpcLifecycleState.ACTIVE);
        WorldFaction first = new WorldFaction(1L, "Garde", "", 20L, List.of(1L), List.of());
        WorldFaction second = new WorldFaction(2L, "Bund", "", 21L, List.of(), List.of());
        return new WorldPlannerState(
                List.of(npc), List.of(first, second), List.of(), 2L, 3L, 1L, "");
    }

    private static WorldPlannerReferencePort positiveReferences() {
        return new WorldPlannerReferencePort() {
            @Override
            public boolean creatureStatblockExists(long creatureStatblockId) {
                return creatureStatblockId > 0L;
            }

            @Override
            public boolean encounterTableExists(long encounterTableId) {
                return encounterTableId > 0L;
            }
        };
    }

    private static void createLegacyVersionOneDatabase(Path path) throws Exception {
        Class.forName("org.sqlite.JDBC");
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + path);
                var statement = connection.createStatement()) {
            statement.execute("PRAGMA user_version = 1");
            statement.execute(
                    "CREATE TABLE sm_schema_versions (owner TEXT PRIMARY KEY, version INTEGER NOT"
                        + " NULL)");
            statement.execute("INSERT INTO sm_schema_versions(owner, version) VALUES ('world-planner', 1)");
            statement.execute(
                    "CREATE TABLE world_planner_npcs (npc_id INTEGER PRIMARY KEY, display_name TEXT"
                        + " NOT NULL, creature_statblock_id INTEGER NOT NULL, appearance_notes TEXT"
                        + " NOT NULL, behavior_notes TEXT NOT NULL, history_notes TEXT NOT NULL,"
                        + " general_notes TEXT NOT NULL, status TEXT NOT NULL)");
            statement.execute(
                    "CREATE TABLE world_planner_factions (faction_id INTEGER PRIMARY KEY,"
                        + " display_name TEXT NOT NULL, notes TEXT NOT NULL,"
                        + " primary_encounter_table_id INTEGER NOT NULL)");
            statement.execute(
                    "CREATE TABLE world_planner_faction_npcs (faction_id INTEGER NOT NULL, npc_id"
                        + " INTEGER NOT NULL, sort_order INTEGER NOT NULL, PRIMARY KEY(faction_id,"
                        + " npc_id))");
            statement.execute(
                    "CREATE TABLE world_planner_faction_inventory_limits (faction_id INTEGER NOT"
                        + " NULL, creature_statblock_id INTEGER NOT NULL, finite INTEGER NOT NULL,"
                        + " quantity INTEGER NOT NULL, PRIMARY KEY(faction_id,"
                        + " creature_statblock_id))");
            statement.execute("CREATE TABLE world_planner_locations (location_id INTEGER PRIMARY KEY, "
                    + "display_name TEXT NOT NULL, notes TEXT NOT NULL)");
            statement.execute(
                    "CREATE TABLE world_planner_location_factions (location_id INTEGER NOT NULL,"
                        + " faction_id INTEGER NOT NULL, sort_order INTEGER NOT NULL, PRIMARY"
                        + " KEY(location_id, faction_id))");
            statement.execute(
                    "CREATE TABLE world_planner_location_encounter_tables (location_id INTEGER NOT"
                        + " NULL, encounter_table_id INTEGER NOT NULL, sort_order INTEGER NOT NULL,"
                        + " PRIMARY KEY(location_id, encounter_table_id))");
            statement.execute("INSERT INTO world_planner_npcs VALUES "
                    + "(1, 'Rivalin', 10, '', '', '', '', 'ACTIVE')");
            statement.execute("INSERT INTO world_planner_factions VALUES "
                    + "(1, 'Garde', '', 20), (2, 'Bund', '', 21)");
            statement.execute("INSERT INTO world_planner_faction_npcs VALUES (1, 1, 0), (2, 1, 0)");
        }
    }

    private static final class RecordingRepository implements WorldPlannerRepository {
        private WorldPlannerState state;

        private RecordingRepository(WorldPlannerState state) {
            this.state = state;
        }

        @Override
        public WorldPlannerState load() {
            return state;
        }

        @Override
        public WorldPlannerState save(WorldPlannerState nextState) {
            state = nextState;
            return state;
        }
    }
}
