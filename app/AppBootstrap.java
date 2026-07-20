package app;

import features.catalog.CatalogFeature;
import features.catalog.CatalogProviders;
import features.catalog.CatalogRoutes;
import features.creatures.CreaturesServiceAssembly;
import features.creatures.api.RefreshCreatureReferenceIndexCommand;
import features.dungeon.DungeonFeature;
import features.encounter.EncounterServiceAssembly;
import features.encounter.api.ApplyEncounterStateCommand;
import features.encounter.api.EncounterPoolFilters;
import features.encounter.api.OpenSavedEncounterPlanCommand;
import features.encounter.api.UpdateEncounterPoolFiltersCommand;
import features.encountertable.EncounterTableServiceAssembly;
import features.hex.HexServiceAssembly;
import features.items.ItemsServiceAssembly;
import features.party.PartyServiceAssembly;
import features.scene.SceneFeature;
import features.sessiongeneration.SessionGenerationServiceAssembly;
import features.sessiongeneration.api.SessionGenerationApi;
import features.sessionplanner.SessionPlannerServiceAssembly;
import features.travel.TravelFeature;
import features.worldplanner.WorldPlannerServiceAssembly;

import org.jspecify.annotations.Nullable;

import platform.diagnostics.Diagnostics;
import platform.diagnostics.SystemLoggerDiagnostics;
import platform.execution.BoundedExecutionLane;
import platform.execution.ExecutionLane;
import platform.execution.SerialExecutionLane;
import platform.persistence.SqliteDatabase;
import platform.ui.JavaFxUiDispatcher;
import platform.ui.UiDispatcher;

import shell.api.ShellBinding;
import shell.api.ShellContribution;
import shell.api.ShellContributionSpec;
import shell.api.ShellLeftBarTabSpec;
import shell.api.ShellStateTabSpec;
import shell.api.ShellTopBarSpec;
import shell.host.AppShell;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

/** Explicit production composition root. */
public final class AppBootstrap implements AutoCloseable {

    private final Diagnostics diagnostics;
    private final ExecutionLane executionLane;
    private final ExecutionLane creatureReadLane;
    private final ExecutionLane itemReadLane;
    private final ExecutionLane sessionGenerationCpuLane;
    private final ExecutionLane sessionGenerationIoLane;
    private final ExecutionLane encounterGeneratedCpuLane;
    private final ExecutionLane encounterGeneratedIoLane;
    private final ExecutionLane sessionPreparationCpuLane;
    private final ExecutionLane sessionPreparationIoLane;
    private final UiDispatcher uiDispatcher;
    private final SqliteDatabase database;
    private final AtomicBoolean closed = new AtomicBoolean();
    private CatalogFeature.@Nullable Component catalogComponent;

    public AppBootstrap() {
        this(new SystemLoggerDiagnostics());
    }

    private AppBootstrap(Diagnostics diagnostics) {
        this(
                diagnostics,
                new SerialExecutionLane(diagnostics),
                new BoundedExecutionLane(diagnostics, "creatures-read", 2),
                new BoundedExecutionLane(diagnostics, "items-read", 2),
                new BoundedExecutionLane(
                        diagnostics,
                        "session-generation-cpu",
                        Math.max(2, Runtime.getRuntime().availableProcessors() - 1)),
                new BoundedExecutionLane(diagnostics, "session-generation-io", 2),
                new BoundedExecutionLane(
                        diagnostics,
                        "encounter-generated-cpu",
                        Math.max(2, Runtime.getRuntime().availableProcessors() - 1)),
                new BoundedExecutionLane(diagnostics, "encounter-generated-io", 2),
                new BoundedExecutionLane(diagnostics, "session-preparation-cpu", 2),
                new BoundedExecutionLane(diagnostics, "session-preparation-io", 2),
                new JavaFxUiDispatcher(),
                SqliteDatabase.defaultDatabase(SqliteDatabase.DEFAULT_DATABASE_FILE_NAME, diagnostics));
    }

    AppBootstrap(
            Diagnostics diagnostics,
            ExecutionLane executionLane,
            ExecutionLane creatureReadLane,
            ExecutionLane itemReadLane,
            ExecutionLane sessionGenerationCpuLane,
            ExecutionLane sessionGenerationIoLane,
            ExecutionLane encounterGeneratedCpuLane,
            ExecutionLane encounterGeneratedIoLane,
            ExecutionLane sessionPreparationCpuLane,
            ExecutionLane sessionPreparationIoLane,
            UiDispatcher uiDispatcher,
            SqliteDatabase database
    ) {
        this.diagnostics = java.util.Objects.requireNonNull(diagnostics, "diagnostics");
        this.executionLane = java.util.Objects.requireNonNull(executionLane, "executionLane");
        this.creatureReadLane = java.util.Objects.requireNonNull(creatureReadLane, "creatureReadLane");
        this.itemReadLane = java.util.Objects.requireNonNull(itemReadLane, "itemReadLane");
        this.sessionGenerationCpuLane = java.util.Objects.requireNonNull(
                sessionGenerationCpuLane, "sessionGenerationCpuLane");
        this.sessionGenerationIoLane = java.util.Objects.requireNonNull(
                sessionGenerationIoLane, "sessionGenerationIoLane");
        this.encounterGeneratedCpuLane = java.util.Objects.requireNonNull(
                encounterGeneratedCpuLane, "encounterGeneratedCpuLane");
        this.encounterGeneratedIoLane = java.util.Objects.requireNonNull(
                encounterGeneratedIoLane, "encounterGeneratedIoLane");
        this.sessionPreparationCpuLane = java.util.Objects.requireNonNull(
                sessionPreparationCpuLane, "sessionPreparationCpuLane");
        this.sessionPreparationIoLane = java.util.Objects.requireNonNull(
                sessionPreparationIoLane, "sessionPreparationIoLane");
        this.uiDispatcher = java.util.Objects.requireNonNull(uiDispatcher, "uiDispatcher");
        this.database = java.util.Objects.requireNonNull(database, "database");
    }

    public AppShell createShell() {
        AppShell shell = new AppShell(diagnostics);
        FeatureStoreManifest.Stores stores = FeatureStoreManifest.register(database);
        database.prepareRegisteredStores();
        Components components = createComponents(stores);
        components.start();
        List<ResolvedContribution> contributions = bindContributions(shell, components);
        contributions.stream()
                .sorted(Comparator.comparing(contribution -> contribution.spec().key().value()))
                .forEach(contribution -> register(shell, contribution));
        ShellLeftBarTabSpec startup = resolveStartupView(contributions);
        if (startup != null) {
            shell.navigateTo(startup.key());
        }
        return shell;
    }

    private Components createComponents(FeatureStoreManifest.Stores stores) {
        CreaturesServiceAssembly.Component creatures = CreaturesServiceAssembly.create(
                stores.creatures(), executionLane, creatureReadLane, sessionPreparationIoLane,
                uiDispatcher, diagnostics);
        EncounterTableServiceAssembly.Component encounterTables =
                EncounterTableServiceAssembly.create(
                        stores.encounterTables(), executionLane, uiDispatcher, diagnostics);
        PartyServiceAssembly.Component party = PartyServiceAssembly.create(
                stores.party(), executionLane, sessionPreparationIoLane, uiDispatcher, diagnostics);
        ItemsServiceAssembly.CatalogComponent items = ItemsServiceAssembly.createCatalog(
                stores.items(), itemReadLane, diagnostics);

        WorldPlannerServiceAssembly.Component world = WorldPlannerServiceAssembly.create(
                        stores.worldPlanner(),
                creatures.references(),
                encounterTables.references(),
                executionLane,
                uiDispatcher,
                diagnostics);

        EncounterServiceAssembly.Component encounter = EncounterServiceAssembly.create(
                        stores.encounter(),
                creatures.application(),
                creatures.detail(),
                creatures.encounterCandidates(),
                encounterTables.application(),
                encounterTables.candidates(),
                world.snapshot(),
                party.application(),
                party.activeParty(),
                party.activeComposition(),
                party.adventuringDaySummary(),
                party.mutation(),
                executionLane,
                encounterGeneratedCpuLane,
                encounterGeneratedIoLane,
                uiDispatcher,
                diagnostics);

        DungeonFeature.Component dungeon = DungeonFeature.create(
                        stores.dungeon(),
                party.application(),
                executionLane,
                uiDispatcher,
                diagnostics);
        HexServiceAssembly.Component hex = HexServiceAssembly.create(
                        stores.hex(), party.travelPositions(), party.application(),
                executionLane, uiDispatcher, diagnostics);
        TravelFeature.Component travel = TravelFeature.create(
                party.travelPositions(), dungeon.travelContext(), hex.travelModel(), uiDispatcher);
        SessionGenerationApi generation = SessionGenerationServiceAssembly.create(
                stores.sessionGeneration(), sessionGenerationCpuLane, sessionGenerationIoLane, diagnostics);
        SessionPlannerServiceAssembly session = SessionPlannerServiceAssembly.create(
                        stores.sessionPlanner(),
                party.application(),
                encounter.application(),
                encounter.savedPlans(),
                world.snapshot(),
                generation,
                executionLane,
                sessionPreparationCpuLane,
                sessionPreparationIoLane,
                uiDispatcher,
                diagnostics);
        SceneFeature.Component scene = SceneFeature.create(
                        stores.scene(),
                party.activeParty(),
                world.snapshot(),
                session.preparedScenes(),
                encounter.runtimeContexts(),
                creatures.referenceIndex(),
                executionLane,
                uiDispatcher,
                diagnostics);
        return new Components(
                creatures, encounterTables, party, items, world, encounter, dungeon, hex, travel, session, scene);
    }

    private List<ResolvedContribution> bindContributions(AppShell shell, Components components) {
        var creatures = components.creatures();
        var tables = components.encounterTables();
        var party = components.party();
        var items = components.items();
        var world = components.world();
        var encounter = components.encounter();
        var dungeon = components.dungeon();
        var hex = components.hex();
        var travel = components.travel();
        var session = components.session();
        var scene = components.scene();
        var inspector = shell.inspector();
        features.worldplanner.api.WorldPlannerEncounterSink worldEncounter =
                (statblockId, npcId) -> encounter.application().applyState(
                        ApplyEncounterStateCommand.addWorldNpcCreature(statblockId, npcId));

        CatalogFeature.Component catalog = CatalogFeature.create(
                new CatalogProviders(
                        new CatalogProviders.MonsterProviders(
                                creatures.catalogQueries(), encounter.poolFilters()),
                        new CatalogProviders.ItemsProviders(items.catalog()),
                        new CatalogProviders.SavedEncounterProviders(encounter.savedPlans()),
                        new CatalogProviders.WorldReferenceProviders(
                                creatures.referenceIndex(), world.snapshot()),
                        new CatalogProviders.EncounterTableProviders(
                                tables.application(), tables.catalog()),
                        uiDispatcher),
                catalogRoutes(
                        inspector, creatures, items, world, worldEncounter, tables, encounter, scene));
        catalogComponent = catalog;

        List<ShellContribution> manifest = List.of(
                party.adventuringDayTopBarContribution(),
                party.partyTopBarContribution(),
                catalog.contribution(),
                dungeon.editorContribution(),
                dungeon.travelContribution(),
                hex.mapContribution(),
                session.contribution(),
                scene.contribution(creatureId -> creatures.openInspector(inspector, creatureId)),
                encounter.stateContribution(
                        creatures.application(), world.application(),
                        creatureId -> creatures.openInspector(inspector, creatureId)),
                travel.contribution());

        List<ResolvedContribution> resolved = new ArrayList<>(manifest.size());
        for (ShellContribution contribution : manifest) {
            resolved.add(new ResolvedContribution(contribution.registrationSpec(), contribution.bind()));
        }
        return List.copyOf(resolved);
    }

    private static CatalogRoutes catalogRoutes(
            shell.api.InspectorSink inspector,
            CreaturesServiceAssembly.Component creatures,
            ItemsServiceAssembly.CatalogComponent items,
            WorldPlannerServiceAssembly.Component world,
            features.worldplanner.api.WorldPlannerEncounterSink worldEncounter,
            EncounterTableServiceAssembly.Component tables,
            EncounterServiceAssembly.Component encounter,
            SceneFeature.Component scene
    ) {
        CatalogRoutes.WorldInspectorRoutes worldInspectors = new CatalogRoutes.WorldInspectorRoutes() {
            @Override
            public void openNpc(long npcId) {
                world.openNpcInspector(npcId, worldEncounter, creatures.referenceIndex(), tables.catalog(), inspector);
            }

            @Override
            public void openFaction(long factionId) {
                world.openFactionInspector(
                        factionId, worldEncounter, creatures.referenceIndex(), tables.catalog(), inspector);
            }

            @Override
            public void openLocation(long locationId) {
                world.openLocationInspector(
                        locationId, worldEncounter, creatures.referenceIndex(), tables.catalog(), inspector);
            }

            @Override
            public void createNpc() {
                world.openNpcCreator(worldEncounter, creatures.referenceIndex(), tables.catalog(), inspector);
            }

            @Override
            public void createFaction() {
                world.openFactionCreator(worldEncounter, creatures.referenceIndex(), tables.catalog(), inspector);
            }

            @Override
            public void createLocation() {
                world.openLocationCreator(worldEncounter, creatures.referenceIndex(), tables.catalog(), inspector);
            }
        };
        CatalogRoutes.EncounterHandoff encounterHandoff = new CatalogRoutes.EncounterHandoff() {
            @Override
            public void updatePoolFilters(EncounterPoolFilters filters) {
                encounter.application().updatePoolFilters(new UpdateEncounterPoolFiltersCommand(filters));
            }

            @Override
            public void addCreature(long creatureId) {
                encounter.application().applyState(ApplyEncounterStateCommand.addCreature(creatureId));
            }

            @Override
            public void addWorldNpc(long creatureId, long npcId) {
                encounter.application().applyState(ApplyEncounterStateCommand.addWorldNpcCreature(creatureId, npcId));
            }

            @Override
            public void useFactionSource(long factionId) {
                updatePoolFilters(withFaction(encounter.poolFilters().current(), factionId));
            }

            @Override
            public void useLocationSource(long locationId) {
                updatePoolFilters(withLocation(encounter.poolFilters().current(), locationId));
            }

            @Override
            public void useEncounterTableSource(long tableId) {
                updatePoolFilters(withTable(encounter.poolFilters().current(), tableId));
            }

            @Override
            public java.util.concurrent.CompletionStage<features.encounter.api.OpenSavedEncounterPlanResult>
                    openSavedEncounter(long planId, boolean discardUnsavedChanges) {
                return encounter.application().openSavedPlan(
                        new OpenSavedEncounterPlanCommand(planId, discardUnsavedChanges));
            }
        };
        CatalogRoutes.SceneHandoff sceneHandoff = new CatalogRoutes.SceneHandoff() {
            @Override
            public void addCreature(long creatureId) {
                assignMobToFocusedScene(scene, creatureId);
            }

            @Override
            public void addNpc(long npcId) {
                assignNpcToFocusedScene(scene, npcId);
            }

            @Override
            public void setLocation(long locationId) {
                setFocusedSceneLocation(scene, locationId);
            }
        };
        return new CatalogRoutes(
                creatureId -> creatures.openInspector(inspector, creatureId),
                detail -> items.openInspector(inspector, detail),
                worldInspectors,
                encounterHandoff,
                sceneHandoff);
    }

    private static EncounterPoolFilters withFaction(EncounterPoolFilters source, long factionId) {
        EncounterPoolFilters safe = source == null ? EncounterPoolFilters.empty() : source;
        return new EncounterPoolFilters(safe.nameQuery(), safe.challengeRatingMin(), safe.challengeRatingMax(),
                safe.sizes(), safe.creatureTypes(), safe.creatureSubtypes(), safe.biomes(), safe.alignments(),
                safe.encounterTableIds(), List.of(factionId), safe.worldLocationId());
    }

    private static EncounterPoolFilters withLocation(EncounterPoolFilters source, long locationId) {
        EncounterPoolFilters safe = source == null ? EncounterPoolFilters.empty() : source;
        return new EncounterPoolFilters(safe.nameQuery(), safe.challengeRatingMin(), safe.challengeRatingMax(),
                safe.sizes(), safe.creatureTypes(), safe.creatureSubtypes(), safe.biomes(), safe.alignments(),
                safe.encounterTableIds(), safe.worldFactionIds(), locationId);
    }

    private static EncounterPoolFilters withTable(EncounterPoolFilters source, long tableId) {
        EncounterPoolFilters safe = source == null ? EncounterPoolFilters.empty() : source;
        java.util.LinkedHashSet<Long> ids = new java.util.LinkedHashSet<>(safe.encounterTableIds());
        ids.add(tableId);
        return new EncounterPoolFilters(safe.nameQuery(), safe.challengeRatingMin(), safe.challengeRatingMax(),
                safe.sizes(), safe.creatureTypes(), safe.creatureSubtypes(), safe.biomes(), safe.alignments(),
                List.copyOf(ids), safe.worldFactionIds(), safe.worldLocationId());
    }

    private static void assignNpcToFocusedScene(SceneFeature.Component scene, long npcId) {
        long sceneId = scene.model().current().focusedSceneId();
        if (sceneId > 0L && npcId > 0L) {
            scene.application().execute(new features.scene.api.SceneCommand.AssignNpc(sceneId, npcId));
        }
    }

    private static void setFocusedSceneLocation(SceneFeature.Component scene, long locationId) {
        long sceneId = scene.model().current().focusedSceneId();
        if (sceneId > 0L && locationId > 0L) {
            scene.application().execute(new features.scene.api.SceneCommand.SetLocation(sceneId, locationId));
        }
    }

    private static void assignMobToFocusedScene(SceneFeature.Component scene, long creatureId) {
        long sceneId = scene.model().current().focusedSceneId();
        if (sceneId > 0L && creatureId > 0L) {
            scene.application().execute(new features.scene.api.SceneCommand.AssignMob(sceneId, creatureId, 1));
        }
    }

    private void register(AppShell shell, ResolvedContribution contribution) {
        ShellContributionSpec spec = contribution.spec();
        if (spec instanceof ShellLeftBarTabSpec leftBarTabSpec) {
            shell.registerLeftBarTab(leftBarTabSpec, contribution.binding());
        } else if (spec instanceof ShellTopBarSpec topBarSpec) {
            shell.registerTopBar(topBarSpec, contribution.binding());
        } else if (spec instanceof ShellStateTabSpec stateTabSpec) {
            shell.registerStateTab(stateTabSpec, contribution.binding());
        } else {
            throw new IllegalStateException("Unsupported shell contribution type: " + spec.getClass().getName());
        }
    }

    private @Nullable ShellLeftBarTabSpec resolveStartupView(List<ResolvedContribution> contributions) {
        ShellLeftBarTabSpec startup = null;
        for (ResolvedContribution contribution : contributions) {
            if (!(contribution.spec() instanceof ShellLeftBarTabSpec leftBar) || !leftBar.defaultLanding()) {
                continue;
            }
            if (startup != null) {
                throw new IllegalStateException("Multiple shell left-bar tabs declare defaultLanding=true.");
            }
            startup = leftBar;
        }
        if (startup != null) {
            return startup;
        }
        return contributions.stream()
                .map(ResolvedContribution::spec)
                .filter(ShellLeftBarTabSpec.class::isInstance)
                .map(ShellLeftBarTabSpec.class::cast)
                .sorted(Comparator
                        .comparingInt((ShellLeftBarTabSpec tab) -> tab.navigationGroup().order())
                        .thenComparing(tab -> tab.navigationGroup().label(), String.CASE_INSENSITIVE_ORDER)
                        .thenComparingInt(ShellLeftBarTabSpec::viewOrder)
                        .thenComparing(tab -> tab.key().value()))
                .findFirst()
                .orElse(null);
    }

    private record Components(
            CreaturesServiceAssembly.Component creatures,
            EncounterTableServiceAssembly.Component encounterTables,
            PartyServiceAssembly.Component party,
            ItemsServiceAssembly.CatalogComponent items,
            WorldPlannerServiceAssembly.Component world,
            EncounterServiceAssembly.Component encounter,
            DungeonFeature.Component dungeon,
            HexServiceAssembly.Component hex,
            TravelFeature.Component travel,
            SessionPlannerServiceAssembly session,
            SceneFeature.Component scene
    ) {
        private void start() {
            creatures.application().refreshReferenceIndex(new RefreshCreatureReferenceIndexCommand());
            PartyServiceAssembly.start(party);
            world.start();
            encounter.start();
            dungeon.start();
            hex.start();
            travel.start();
        }
    }

    private record ResolvedContribution(ShellContributionSpec spec, ShellBinding binding) {
    }

    @Override
    public void close() {
        if (!closed.compareAndSet(false, true)) {
            return;
        }
        CatalogFeature.Component catalog = catalogComponent;
        if (catalog != null) {
            catalog.close();
            catalogComponent = null;
        }
        java.util.Set<ExecutionLane> lanes = java.util.Collections.newSetFromMap(
                new java.util.IdentityHashMap<>());
        java.util.List.of(
                sessionGenerationCpuLane,
                sessionGenerationIoLane,
                encounterGeneratedCpuLane,
                encounterGeneratedIoLane,
                sessionPreparationCpuLane,
                sessionPreparationIoLane,
                creatureReadLane,
                itemReadLane,
                executionLane).stream().filter(lanes::add).forEach(ExecutionLane::close);
        database.close();
    }

}
