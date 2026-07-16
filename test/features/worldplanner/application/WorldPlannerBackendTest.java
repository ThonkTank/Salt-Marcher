package features.worldplanner.application;

import features.worldplanner.WorldPlannerReferenceAssembly;
import features.worldplanner.WorldPlannerServiceAssembly;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;
import org.junit.jupiter.api.Test;
import features.creatures.CreaturesServiceAssembly;
import features.creatures.domain.catalog.CreatureCatalogData;
import features.creatures.domain.catalog.port.CreatureCatalogPort;
import features.encountertable.domain.catalog.EncounterTableCandidateData;
import features.encountertable.domain.catalog.EncounterTableSummaryData;
import features.encountertable.domain.catalog.port.EncounterTableCatalogPort;
import features.encountertable.EncounterTableServiceAssembly;
import features.worldplanner.adapter.sqlite.repository.SqliteWorldPlannerRepository;
import features.worldplanner.adapter.sqlite.mapper.WorldPlannerMapper;
import features.worldplanner.adapter.sqlite.model.WorldNpcRecord;
import features.worldplanner.adapter.sqlite.model.WorldPlannerPersistenceSchema;
import features.worldplanner.adapter.sqlite.model.WorldPlannerSnapshotRecord;
import features.worldplanner.domain.world.WorldFactionInventoryLimit;
import features.worldplanner.domain.world.WorldNpc;
import features.worldplanner.domain.world.WorldNpcLifecycleState;
import features.worldplanner.domain.world.WorldPlannerState;
import features.worldplanner.domain.world.port.WorldPlannerReferencePort;
import features.worldplanner.domain.world.repository.WorldPlannerRepository;
import features.worldplanner.api.AddWorldFactionNpcCommand;
import features.worldplanner.api.AddWorldLocationEncounterTableCommand;
import features.worldplanner.api.AddWorldLocationFactionCommand;
import features.worldplanner.api.CreateWorldFactionCommand;
import features.worldplanner.api.CreateWorldLocationCommand;
import features.worldplanner.api.CreateWorldNpcCommand;
import features.worldplanner.api.RefreshWorldPlannerCommand;
import features.worldplanner.api.SetWorldFactionInventoryLimitCommand;
import features.worldplanner.api.SetWorldNpcLifecycleStatusCommand;
import features.worldplanner.api.UpdateWorldNpcNotesCommand;
import features.worldplanner.api.WorldNpcLifecycleStatus;
import features.worldplanner.api.WorldPlannerReadStatus;
import features.worldplanner.api.WorldPlannerSnapshot;
import features.worldplanner.api.WorldPlannerSnapshotModel;

public final class WorldPlannerBackendTest {

    private WorldPlannerBackendTest() {
    }

    @Test
    void WORLD_PLANNER_BACKEND_001() {
        WorldPlannerRuntime runtime = productionRuntime();
        WorldPlannerApplicationService service = runtime.application();
        WorldPlannerSnapshotModel model = runtime.snapshot();

        service.createNpc(new CreateWorldNpcCommand(
                "Captain Vale",
                101L,
                "scarred",
                "watchful",
                "former scout",
                "knows the pass"));
        service.createFaction(new CreateWorldFactionCommand("Ash Guard", "border patrol", 201L));
        service.addFactionNpc(new AddWorldFactionNpcCommand(1L, 1L));
        service.setFactionInventoryLimit(new SetWorldFactionInventoryLimitCommand(
                1L,
                101L,
                true,
                3));
        service.setFactionInventoryLimit(new SetWorldFactionInventoryLimitCommand(
                1L,
                102L,
                false,
                0));
        service.setFactionInventoryLimit(new SetWorldFactionInventoryLimitCommand(
                1L,
                103L,
                true,
                -1));
        service.createLocation(new CreateWorldLocationCommand("Old Gate", "wind-cut ruins"));
        service.addLocationFaction(new AddWorldLocationFactionCommand(1L, 1L));
        service.addLocationEncounterTable(new AddWorldLocationEncounterTableCommand(1L, 201L));
        service.createNpc(new CreateWorldNpcCommand("Invalid", -1L, "", "", "", ""));
        service.addFactionNpc(new AddWorldFactionNpcCommand(1L, 1L));
        service.addLocationFaction(new AddWorldLocationFactionCommand(1L, 1L));
        service.addLocationEncounterTable(new AddWorldLocationEncounterTableCommand(1L, 201L));
        service.setNpcLifecycleStatus(SetWorldNpcLifecycleStatusCommand.defeated(1L));
        service.setNpcLifecycleStatus(SetWorldNpcLifecycleStatusCommand.active(1L));
        service.setNpcLifecycleStatus(SetWorldNpcLifecycleStatusCommand.defeated(1L, 999L));
        service.setNpcLifecycleStatus(new SetWorldNpcLifecycleStatusCommand(1L, null, 0L));

        WorldPlannerSnapshot current = model.current();
        assertEquals(1, current.npcs().size(), "npc count");
        assertEquals("Captain Vale", current.npcs().get(0).displayName(), "npc name");
        assertEquals(WorldNpcLifecycleStatus.ACTIVE, current.npcs().get(0).status(), "npc lifecycle");
        assertEquals("NPC Status nicht gefunden.", current.statusText(), "transient null lifecycle status");
        assertEquals(1, current.factions().size(), "faction count");
        assertEquals(1, current.factions().get(0).npcIds().size(), "duplicate faction npc rejected");
        assertEquals(1L, current.factions().get(0).npcIds().get(0), "faction npc membership");
        assertEquals(3, current.factions().get(0).inventoryLimits().get(0).quantity(), "finite stock");
        assertEquals(2, current.factions().get(0).inventoryLimits().size(), "explicit unlimited stock retained");
        assertEquals(false, current.factions().get(0).inventoryLimits().get(1).finite(), "explicit unlimited finite flag");
        assertEquals(0, current.factions().get(0).inventoryLimits().get(1).quantity(), "explicit unlimited quantity");
        assertEquals(1, current.locations().size(), "location count");
        assertEquals(1, current.locations().get(0).factionIds().size(), "duplicate location faction rejected");
        assertEquals(1L, current.locations().get(0).factionIds().get(0), "location faction link");
        assertEquals(1, current.locations().get(0).encounterTableIds().size(), "duplicate location table rejected");
        assertEquals(201L, current.locations().get(0).encounterTableIds().get(0), "location table link");

        WorldPlannerSnapshot reloaded = reloadedSnapshot();
        assertEquals("Captain Vale", reloaded.npcs().get(0).displayName(), "persisted npc name");
        assertEquals(WorldNpcLifecycleStatus.ACTIVE, reloaded.npcs().get(0).status(), "persisted lifecycle");
        assertEquals(201L, reloaded.factions().get(0).primaryEncounterTableId(), "persisted faction table");
        assertEquals(2, reloaded.factions().get(0).inventoryLimits().size(), "persisted inventory limits");
        assertEquals(false, reloaded.factions().get(0).inventoryLimits().get(1).finite(), "persisted unlimited flag");
        assertEquals(201L, reloaded.locations().get(0).encounterTableIds().get(0), "persisted location table");
        assertReadbackOnlyConsumerLoadsPersistedSnapshot();
        assertStorageErrorPreservesLastStableSnapshot();
        assertSaveErrorPreservesLastStableSnapshot();
        assertServiceFirstMutationSurvivesFirstModelLookup();
        assertMalformedRowsBecomeStorageErrors();
        assertInvalidLifecycleRowsBecomeStorageErrors();
        assertMalformedFiniteRowsBecomeStorageErrors();
        assertInvalidFiniteInventoryRejected();
        assertForeignReferencesAreRejectedBeforePersistence();
        assertMissingReferenceServicesFailClosed();
        assertReferenceProviderFailuresSurfaceWithoutWrite();
    }

    private static WorldPlannerSnapshot reloadedSnapshot() {
        WorldPlannerRuntime runtime = productionRuntime();
        runtime.application().refresh(new RefreshWorldPlannerCommand());
        return runtime.snapshot().current();
    }

    private static WorldPlannerRuntime productionRuntime() {
        return runtime(new SqliteWorldPlannerRepository(), new PositiveReferencePort());
    }

    private static WorldPlannerRuntime runtime(
            WorldPlannerRepository repository,
            WorldPlannerReferencePort referencePort
    ) {
        WorldPlannerServiceAssembly assembly = new WorldPlannerServiceAssembly(repository, referencePort);
        return new WorldPlannerRuntime(assembly.createApplicationService(), assembly.snapshotModel());
    }

    private static void assertStorageErrorPreservesLastStableSnapshot() {
        WorldPlannerRuntime runtime = runtime(new FailingAfterFirstLoadRepository(), new PositiveReferencePort());
        WorldPlannerSnapshotModel model = runtime.snapshot();
        WorldPlannerApplicationService service = runtime.application();

        assertEquals(1, model.current().npcs().size(), "stable error fixture npc count");
        service.refresh(new RefreshWorldPlannerCommand());
        assertEquals(WorldPlannerReadStatus.STORAGE_ERROR, model.current().status(), "storage error status");
        assertEquals(1, model.current().npcs().size(), "stable snapshot preserved after storage error");
    }

    private static void assertReadbackOnlyConsumerLoadsPersistedSnapshot() {
        WorldPlannerSnapshotModel model = runtime(
                new StableFixtureRepository(), new PositiveReferencePort()).snapshot();

        assertEquals(1, model.current().npcs().size(), "readback-only fixture npc count");
        assertEquals("Stable NPC", model.current().npcs().get(0).displayName(), "readback-only fixture npc");
    }

    private static void assertServiceFirstMutationSurvivesFirstModelLookup() {
        WorldPlannerRuntime runtime = runtime(new StableFixtureRepository(), new PositiveReferencePort());
        WorldPlannerApplicationService service = runtime.application();

        service.createNpc(new CreateWorldNpcCommand("Fresh NPC", 202L, "", "", "", ""));
        WorldPlannerSnapshot current = runtime.snapshot().current();

        assertEquals(2, current.npcs().size(), "service-first model lookup npc count");
        assertEquals("NPC erstellt.", current.statusText(), "service-first transient status text");
    }

    private static void assertMalformedRowsBecomeStorageErrors() {
        WorldPlannerSnapshotModel model = runtime(
                new MalformedRecordRepository(), new PositiveReferencePort()).snapshot();

        assertEquals(WorldPlannerReadStatus.STORAGE_ERROR, model.current().status(), "malformed row status");
        assertEquals(0, model.current().npcs().size(), "malformed row does not publish partial npc");
    }

    private static void assertInvalidLifecycleRowsBecomeStorageErrors() {
        WorldPlannerSnapshotModel model = runtime(
                new InvalidLifecycleRecordRepository(), new PositiveReferencePort()).snapshot();

        assertEquals(WorldPlannerReadStatus.STORAGE_ERROR, model.current().status(), "invalid lifecycle row status");
        assertEquals(0, model.current().npcs().size(), "invalid lifecycle does not publish active npc");
    }

    private static void assertMalformedFiniteRowsBecomeStorageErrors() {
        assertMalformedFiniteRowBecomesStorageError("2", "invalid finite row status");
        assertMalformedFiniteRowBecomesStorageError("NULL", "null finite row status");
        assertMalformedLimitRowBecomesStorageError("1", "NULL", "null finite quantity row status");
    }

    private static void assertMalformedFiniteRowBecomesStorageError(String finiteValueSql, String label) {
        assertMalformedLimitRowBecomesStorageError(finiteValueSql, "3", label);
    }

    private static void assertMalformedLimitRowBecomesStorageError(
            String finiteValueSql,
            String quantityValueSql,
            String label
    ) {
        resetDatabase();
        createLegacyMalformedFiniteDatabase(finiteValueSql, quantityValueSql);

        WorldPlannerSnapshotModel model = productionRuntime().snapshot();

        assertEquals(WorldPlannerReadStatus.STORAGE_ERROR, model.current().status(), label);
        assertEquals(0, model.current().factions().size(), label + " does not publish faction");
    }

    private static void assertSaveErrorPreservesLastStableSnapshot() {
        WorldPlannerRuntime runtime = runtime(new FailingSaveRepository(), new PositiveReferencePort());
        WorldPlannerSnapshotModel model = runtime.snapshot();
        WorldPlannerApplicationService service = runtime.application();

        assertEquals(1, model.current().npcs().size(), "stable save-error fixture npc count");
        service.createLocation(new CreateWorldLocationCommand("Blocked", "save fails"));
        assertEquals(WorldPlannerReadStatus.STORAGE_ERROR, model.current().status(), "save error status");
        assertEquals(1, model.current().npcs().size(), "stable snapshot preserved after save error");
    }

    private static final class FailingAfterFirstLoadRepository implements WorldPlannerRepository {

        private int loadCount;

        @Override
        public WorldPlannerState load() {
            loadCount++;
            if (loadCount > 1) {
                throw new IllegalStateException("fixture storage failure");
            }
            return new WorldPlannerState(
                    java.util.List.of(new WorldNpc(1L, "Stable NPC", 101L, "", "", "", "", WorldNpcLifecycleState.ACTIVE)),
                    java.util.List.of(),
                    java.util.List.of(),
                    2L,
                    1L,
                    1L,
                    "");
        }

        @Override
        public WorldPlannerState save(WorldPlannerState state) {
            return state;
        }
    }

    private static final class FailingSaveRepository implements WorldPlannerRepository {

        @Override
        public WorldPlannerState load() {
            return stableFixture();
        }

        @Override
        public WorldPlannerState save(WorldPlannerState state) {
            throw new IllegalStateException("fixture save failure");
        }
    }

    private static final class StableFixtureRepository implements WorldPlannerRepository {

        @Override
        public WorldPlannerState load() {
            return stableFixture();
        }

        @Override
        public WorldPlannerState save(WorldPlannerState state) {
            return state;
        }
    }

    private static final class MalformedRecordRepository implements WorldPlannerRepository {

        @Override
        public WorldPlannerState load() {
            return WorldPlannerMapper.toDomain(new WorldPlannerSnapshotRecord(
                    java.util.List.of(new WorldNpcRecord(-1L, "Broken", 101L, "", "", "", "", "ACTIVE")),
                    java.util.List.of(),
                    java.util.List.of()));
        }

        @Override
        public WorldPlannerState save(WorldPlannerState state) {
            return state;
        }
    }

    private static final class InvalidLifecycleRecordRepository implements WorldPlannerRepository {

        @Override
        public WorldPlannerState load() {
            return WorldPlannerMapper.toDomain(new WorldPlannerSnapshotRecord(
                    java.util.List.of(new WorldNpcRecord(1L, "Broken", 101L, "", "", "", "", "UNKNOWN")),
                    java.util.List.of(),
                    java.util.List.of()));
        }

        @Override
        public WorldPlannerState save(WorldPlannerState state) {
            return state;
        }
    }

    private static void assertInvalidFiniteInventoryRejected() {
        assertThrows(
                () -> new WorldFactionInventoryLimit(103L, true, -1),
                "domain negative finite stock rejected");
        assertThrows(
                () -> new features.worldplanner.api.WorldFactionInventoryLimitSummary(103L, true, -1),
                "published negative finite stock rejected");
    }

    private static void assertForeignReferencesAreRejectedBeforePersistence() {
        CountingRepository repository = new CountingRepository();
        WorldPlannerApplicationService service = runtime(repository, new RejectingReferenceValidator()).application();

        service.createNpc(new CreateWorldNpcCommand("Foreign NPC", 999L, "", "", "", ""));
        service.createFaction(new CreateWorldFactionCommand("Foreign Table", "", 999L));
        service.setFactionInventoryLimit(new SetWorldFactionInventoryLimitCommand(1L, 999L, true, 1));
        service.addLocationEncounterTable(new AddWorldLocationEncounterTableCommand(1L, 999L));

        WorldPlannerState state = repository.state;
        assertEquals(1, state.npcs().size(), "foreign npc statblock rejected");
        assertEquals(1, state.factions().size(), "foreign faction table rejected");
        assertEquals(0, state.factions().getFirst().inventoryLimits().size(), "foreign stock statblock rejected");
        assertEquals(0, state.locations().getFirst().encounterTableIds().size(), "foreign location table rejected");
    }

    private static void assertMissingReferenceServicesFailClosed() {
        WorldPlannerRuntime runtime = runtime(new CountingRepository(), new MissingReferencePort());
        WorldPlannerApplicationService service = runtime.application();

        service.createNpc(new CreateWorldNpcCommand("Unknown NPC", 101L, "", "", "", ""));
        service.createFaction(new CreateWorldFactionCommand("Unknown Faction", "", 201L));

        WorldPlannerSnapshot current = runtime.snapshot().current();
        assertEquals(1, current.npcs().size(), "missing creature service rejects new npc reference");
        assertEquals(1, current.factions().size(), "missing encounter table service rejects new faction reference");
    }

    private static void assertReferenceProviderFailuresSurfaceWithoutWrite() {
        CountingRepository repository = new CountingRepository();
        WorldPlannerRuntime runtime = runtime(
                repository,
                WorldPlannerReferenceAssembly.catalogReferences(
                        CreaturesServiceAssembly.create(new FailingCreatureCatalogPort()).references(),
                        EncounterTableServiceAssembly.create(new FailingEncounterTableCatalogPort()).references()));
        WorldPlannerApplicationService service = runtime.application();

        service.createNpc(new CreateWorldNpcCommand("Unavailable Creature", 101L, "", "", "", ""));
        assertReferenceStorageError(runtime.snapshot().current(), repository, "creature provider failure");

        service.createFaction(new CreateWorldFactionCommand("Unavailable Table", "", 201L));
        assertReferenceStorageError(runtime.snapshot().current(), repository, "table provider failure");
    }

    private static void assertReferenceStorageError(
            WorldPlannerSnapshot snapshot,
            CountingRepository repository,
            String label
    ) {
        assertEquals(WorldPlannerReadStatus.STORAGE_ERROR, snapshot.status(), label + " status");
        assertEquals("World Planner Referenzen konnten nicht geladen werden.", snapshot.statusText(), label + " text");
        assertEquals(1, snapshot.npcs().size(), label + " preserves npc state");
        assertEquals(1, snapshot.factions().size(), label + " preserves faction state");
        assertEquals(0, repository.saveCount, label + " performs no write");
    }

    private static WorldPlannerState stableFixture() {
        return new WorldPlannerState(
                java.util.List.of(new WorldNpc(1L, "Stable NPC", 101L, "", "", "", "", WorldNpcLifecycleState.ACTIVE)),
                java.util.List.of(),
                java.util.List.of(),
                2L,
                1L,
                1L,
                "");
    }

    private static final class CountingRepository implements WorldPlannerRepository {

        private WorldPlannerState state = stableWorldFixture();
        private int saveCount;

        @Override
        public WorldPlannerState load() {
            return state;
        }

        @Override
        public WorldPlannerState save(WorldPlannerState state) {
            saveCount++;
            this.state = state;
            return state;
        }
    }

    private static final class FailingCreatureCatalogPort implements CreatureCatalogPort {

        @Override
        public CreatureCatalogData.DistinctFilterValues loadFilterValues() {
            throw unavailable();
        }

        @Override
        public CreatureCatalogData.CatalogPageData searchCatalog(CreatureCatalogData.CatalogSearchSpec spec) {
            throw unavailable();
        }

        @Override
        public CreatureCatalogData.CreatureProfile loadCreatureDetail(long creatureId) {
            throw unavailable();
        }

        @Override
        public List<CreatureCatalogData.EncounterCandidateProfile> loadEncounterCandidates(
                CreatureCatalogData.EncounterCandidateSpec spec
        ) {
            throw unavailable();
        }
    }

    private static final class FailingEncounterTableCatalogPort implements EncounterTableCatalogPort {

        @Override
        public List<EncounterTableSummaryData> loadSummaries() {
            throw unavailable();
        }

        @Override
        public List<EncounterTableCandidateData> loadGenerationCandidates(List<Long> tableIds, int maximumXp) {
            throw unavailable();
        }
    }

    private static IllegalStateException unavailable() {
        return new IllegalStateException("fixture catalog unavailable");
    }

    private static WorldPlannerState stableWorldFixture() {
        return new WorldPlannerState(
                java.util.List.of(new WorldNpc(1L, "Stable NPC", 101L, "", "", "", "", WorldNpcLifecycleState.ACTIVE)),
                java.util.List.of(new features.worldplanner.domain.world.WorldFaction(
                        1L,
                        "Stable Faction",
                        "",
                        201L,
                        java.util.List.of(),
                        java.util.List.of())),
                java.util.List.of(new features.worldplanner.domain.world.WorldLocation(
                        1L,
                        "Stable Location",
                        "",
                        java.util.List.of(),
                        java.util.List.of())),
                2L,
                2L,
                2L,
                "");
    }

    private static final class RejectingReferenceValidator implements WorldPlannerReferencePort {
        @Override
        public boolean creatureStatblockExists(long creatureStatblockId) {
            return creatureStatblockId == 101L;
        }

        @Override
        public boolean encounterTableExists(long encounterTableId) {
            return encounterTableId == 201L;
        }
    }

    private static final class PositiveReferencePort implements WorldPlannerReferencePort {
        @Override
        public boolean creatureStatblockExists(long creatureStatblockId) {
            return creatureStatblockId > 0L;
        }

        @Override
        public boolean encounterTableExists(long encounterTableId) {
            return encounterTableId > 0L;
        }
    }

    private static final class MissingReferencePort implements WorldPlannerReferencePort {
        @Override
        public boolean creatureStatblockExists(long creatureStatblockId) {
            return false;
        }

        @Override
        public boolean encounterTableExists(long encounterTableId) {
            return false;
        }
    }

    private record WorldPlannerRuntime(
            WorldPlannerApplicationService application,
            WorldPlannerSnapshotModel snapshot
    ) {
    }

    private static void createLegacyMalformedFiniteDatabase(String finiteValueSql, String quantityValueSql) {
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath());
                Statement statement = connection.createStatement()) {
            statement.execute(WorldPlannerPersistenceSchema.CREATE_NPCS_SQL);
            statement.execute(WorldPlannerPersistenceSchema.CREATE_FACTIONS_SQL);
            statement.execute(WorldPlannerPersistenceSchema.CREATE_FACTION_NPCS_SQL);
            statement.execute(WorldPlannerPersistenceSchema.CREATE_FACTION_LIMITS_SQL);
            statement.execute(WorldPlannerPersistenceSchema.CREATE_LOCATIONS_SQL);
            statement.execute(WorldPlannerPersistenceSchema.CREATE_LOCATION_FACTIONS_SQL);
            statement.execute(WorldPlannerPersistenceSchema.CREATE_LOCATION_TABLES_SQL);
            statement.execute("DROP TABLE " + WorldPlannerPersistenceSchema.FACTION_LIMITS_TABLE);
            statement.execute("CREATE TABLE IF NOT EXISTS " + WorldPlannerPersistenceSchema.FACTION_LIMITS_TABLE + " ("
                    + "faction_id INTEGER NOT NULL, "
                    + "creature_statblock_id INTEGER NOT NULL, "
                    + "finite INTEGER, "
                    + "quantity INTEGER, "
                    + "PRIMARY KEY(faction_id, creature_statblock_id)"
                    + ")");
            statement.execute("INSERT INTO " + WorldPlannerPersistenceSchema.FACTIONS_TABLE
                    + " (faction_id, display_name, notes, primary_encounter_table_id)"
                    + " VALUES (1, 'Broken Faction', '', 201)");
            statement.execute("INSERT INTO " + WorldPlannerPersistenceSchema.FACTION_LIMITS_TABLE
                    + " (faction_id, creature_statblock_id, finite, quantity)"
                    + " VALUES (1, 101, " + finiteValueSql + ", " + quantityValueSql + ")");
        } catch (SQLException exception) {
            throw new AssertionError("could not create malformed inventory limit fixture", exception);
        }
    }

    private static void resetDatabase() {
        Path path = databasePath();
        try {
            Files.deleteIfExists(path);
            Files.deleteIfExists(Path.of(path.toString() + "-wal"));
            Files.deleteIfExists(Path.of(path.toString() + "-shm"));
        } catch (IOException exception) {
            throw new AssertionError("could not reset world planner database", exception);
        }
    }

    private static Path databasePath() {
        String xdgDataHome = System.getenv("XDG_DATA_HOME");
        if (xdgDataHome == null || xdgDataHome.isBlank()) {
            throw new AssertionError("XDG_DATA_HOME must be set for WorldPlannerBackendTest");
        }
        return Path.of(xdgDataHome, "salt-marcher", WorldPlannerPersistenceSchema.databaseFileName());
    }

    private static void assertEquals(Object expected, Object actual, String label) {
        if (!java.util.Objects.equals(expected, actual)) {
            throw new AssertionError(label + ": expected <" + expected + "> but was <" + actual + ">");
        }
    }

    private static void assertThrows(Runnable action, String label) {
        try {
            action.run();
        } catch (IllegalArgumentException exception) {
            return;
        }
        throw new AssertionError(label + ": expected IllegalArgumentException");
    }
}
