package src.domain.worldplanner;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import shell.api.ServiceRegistry;
import src.data.worldplanner.mapper.WorldPlannerMapper;
import src.data.worldplanner.model.WorldNpcRecord;
import src.data.worldplanner.model.WorldPlannerPersistenceSchema;
import src.data.worldplanner.model.WorldPlannerSnapshotRecord;
import src.domain.worldplanner.model.world.WorldFactionInventoryLimit;
import src.domain.worldplanner.model.world.WorldNpc;
import src.domain.worldplanner.model.world.WorldNpcLifecycleState;
import src.domain.worldplanner.model.world.WorldPlannerState;
import src.domain.worldplanner.model.world.port.WorldPlannerReferencePort;
import src.domain.worldplanner.model.world.repository.WorldPlannerRepository;
import src.domain.worldplanner.published.AddWorldFactionNpcCommand;
import src.domain.worldplanner.published.AddWorldLocationEncounterTableCommand;
import src.domain.worldplanner.published.AddWorldLocationFactionCommand;
import src.domain.worldplanner.published.CreateWorldFactionCommand;
import src.domain.worldplanner.published.CreateWorldLocationCommand;
import src.domain.worldplanner.published.CreateWorldNpcCommand;
import src.domain.worldplanner.published.RefreshWorldPlannerCommand;
import src.domain.worldplanner.published.SetWorldFactionInventoryLimitCommand;
import src.domain.worldplanner.published.SetWorldNpcLifecycleStatusCommand;
import src.domain.worldplanner.published.UpdateWorldNpcNotesCommand;
import src.domain.worldplanner.published.WorldNpcLifecycleStatus;
import src.domain.worldplanner.published.WorldPlannerReadStatus;
import src.domain.worldplanner.published.WorldPlannerSnapshot;
import src.domain.worldplanner.published.WorldPlannerSnapshotModel;

public final class WorldPlannerBackendHarness {

    private WorldPlannerBackendHarness() {
    }

    public static void main(String[] args) {
        ServiceRegistry registry = registry();
        WorldPlannerApplicationService service = registry.require(WorldPlannerApplicationService.class);
        WorldPlannerSnapshotModel model = registry.require(WorldPlannerSnapshotModel.class);

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
    }

    private static WorldPlannerSnapshot reloadedSnapshot() {
        ServiceRegistry registry = registry();
        WorldPlannerApplicationService service = registry.require(WorldPlannerApplicationService.class);
        service.refresh(new RefreshWorldPlannerCommand());
        return registry.require(WorldPlannerSnapshotModel.class).current();
    }

    private static ServiceRegistry registry() {
        ServiceRegistry.Builder builder = new ServiceRegistry.Builder();
        new src.data.worldplanner.WorldPlannerServiceContribution().register(builder);
        registerPositiveReferencePort(builder);
        new WorldPlannerServiceContribution().register(builder);
        return builder.build();
    }

    private static void assertStorageErrorPreservesLastStableSnapshot() {
        ServiceRegistry.Builder builder = new ServiceRegistry.Builder();
        builder.register(WorldPlannerRepository.class, new FailingAfterFirstLoadRepository());
        registerPositiveReferencePort(builder);
        new WorldPlannerServiceContribution().register(builder);
        ServiceRegistry registry = builder.build();
        WorldPlannerSnapshotModel model = registry.require(WorldPlannerSnapshotModel.class);
        WorldPlannerApplicationService service = registry.require(WorldPlannerApplicationService.class);

        assertEquals(1, model.current().npcs().size(), "stable error fixture npc count");
        service.refresh(new RefreshWorldPlannerCommand());
        assertEquals(WorldPlannerReadStatus.STORAGE_ERROR, model.current().status(), "storage error status");
        assertEquals(1, model.current().npcs().size(), "stable snapshot preserved after storage error");
    }

    private static void assertReadbackOnlyConsumerLoadsPersistedSnapshot() {
        ServiceRegistry.Builder builder = new ServiceRegistry.Builder();
        builder.register(WorldPlannerRepository.class, new StableFixtureRepository());
        registerPositiveReferencePort(builder);
        new WorldPlannerServiceContribution().register(builder);
        ServiceRegistry registry = builder.build();
        WorldPlannerSnapshotModel model = registry.require(WorldPlannerSnapshotModel.class);

        assertEquals(1, model.current().npcs().size(), "readback-only fixture npc count");
        assertEquals("Stable NPC", model.current().npcs().get(0).displayName(), "readback-only fixture npc");
    }

    private static void assertServiceFirstMutationSurvivesFirstModelLookup() {
        ServiceRegistry.Builder builder = new ServiceRegistry.Builder();
        builder.register(WorldPlannerRepository.class, new StableFixtureRepository());
        registerPositiveReferencePort(builder);
        new WorldPlannerServiceContribution().register(builder);
        ServiceRegistry registry = builder.build();
        WorldPlannerApplicationService service = registry.require(WorldPlannerApplicationService.class);

        service.createNpc(new CreateWorldNpcCommand("Fresh NPC", 202L, "", "", "", ""));
        WorldPlannerSnapshot current = registry.require(WorldPlannerSnapshotModel.class).current();

        assertEquals(2, current.npcs().size(), "service-first model lookup npc count");
        assertEquals("NPC erstellt.", current.statusText(), "service-first transient status text");
    }

    private static void assertMalformedRowsBecomeStorageErrors() {
        ServiceRegistry.Builder builder = new ServiceRegistry.Builder();
        builder.register(WorldPlannerRepository.class, new MalformedRecordRepository());
        registerPositiveReferencePort(builder);
        new WorldPlannerServiceContribution().register(builder);
        ServiceRegistry registry = builder.build();
        WorldPlannerSnapshotModel model = registry.require(WorldPlannerSnapshotModel.class);

        assertEquals(WorldPlannerReadStatus.STORAGE_ERROR, model.current().status(), "malformed row status");
        assertEquals(0, model.current().npcs().size(), "malformed row does not publish partial npc");
    }

    private static void assertInvalidLifecycleRowsBecomeStorageErrors() {
        ServiceRegistry.Builder builder = new ServiceRegistry.Builder();
        builder.register(WorldPlannerRepository.class, new InvalidLifecycleRecordRepository());
        registerPositiveReferencePort(builder);
        new WorldPlannerServiceContribution().register(builder);
        ServiceRegistry registry = builder.build();
        WorldPlannerSnapshotModel model = registry.require(WorldPlannerSnapshotModel.class);

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

        ServiceRegistry registry = registry();
        WorldPlannerSnapshotModel model = registry.require(WorldPlannerSnapshotModel.class);

        assertEquals(WorldPlannerReadStatus.STORAGE_ERROR, model.current().status(), label);
        assertEquals(0, model.current().factions().size(), label + " does not publish faction");
    }

    private static void assertSaveErrorPreservesLastStableSnapshot() {
        ServiceRegistry.Builder builder = new ServiceRegistry.Builder();
        builder.register(WorldPlannerRepository.class, new FailingSaveRepository());
        registerPositiveReferencePort(builder);
        new WorldPlannerServiceContribution().register(builder);
        ServiceRegistry registry = builder.build();
        WorldPlannerSnapshotModel model = registry.require(WorldPlannerSnapshotModel.class);
        WorldPlannerApplicationService service = registry.require(WorldPlannerApplicationService.class);

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
                () -> new src.domain.worldplanner.published.WorldFactionInventoryLimitSummary(103L, true, -1),
                "published negative finite stock rejected");
    }

    private static void assertForeignReferencesAreRejectedBeforePersistence() {
        CountingRepository repository = new CountingRepository();
        WorldPlannerApplicationService service =
                new WorldPlannerUseCaseServiceAssembly(repository, new RejectingReferenceValidator())
                        .createApplicationService();

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
        ServiceRegistry.Builder builder = new ServiceRegistry.Builder();
        builder.register(WorldPlannerRepository.class, new CountingRepository());
        new WorldPlannerServiceContribution().register(builder);
        ServiceRegistry registry = builder.build();
        WorldPlannerApplicationService service = registry.require(WorldPlannerApplicationService.class);

        service.createNpc(new CreateWorldNpcCommand("Unknown NPC", 101L, "", "", "", ""));
        service.createFaction(new CreateWorldFactionCommand("Unknown Faction", "", 201L));

        WorldPlannerSnapshot current = registry.require(WorldPlannerSnapshotModel.class).current();
        assertEquals(1, current.npcs().size(), "missing creature service rejects new npc reference");
        assertEquals(1, current.factions().size(), "missing encounter table service rejects new faction reference");
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

        @Override
        public WorldPlannerState load() {
            return state;
        }

        @Override
        public WorldPlannerState save(WorldPlannerState state) {
            this.state = state;
            return state;
        }
    }

    private static WorldPlannerState stableWorldFixture() {
        return new WorldPlannerState(
                java.util.List.of(new WorldNpc(1L, "Stable NPC", 101L, "", "", "", "", WorldNpcLifecycleState.ACTIVE)),
                java.util.List.of(new src.domain.worldplanner.model.world.WorldFaction(
                        1L,
                        "Stable Faction",
                        "",
                        201L,
                        java.util.List.of(),
                        java.util.List.of())),
                java.util.List.of(new src.domain.worldplanner.model.world.WorldLocation(
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

    private static void registerPositiveReferencePort(ServiceRegistry.Builder builder) {
        builder.register(WorldPlannerReferencePort.class, new PositiveReferencePort());
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
            throw new AssertionError("XDG_DATA_HOME must be set for WorldPlannerBackendHarness");
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
