package app;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import org.jspecify.annotations.Nullable;
import platform.diagnostics.Diagnostics;
import platform.diagnostics.SystemLoggerDiagnostics;
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
import features.creatures.CreaturesServiceAssembly;
import features.catalog.CatalogServiceAssembly;
import features.dungeon.DungeonFeature;
import features.encounter.EncounterServiceAssembly;
import features.encounter.api.ApplyEncounterStateCommand;
import features.encountertable.EncounterTableServiceAssembly;
import features.hex.HexServiceAssembly;
import features.items.ItemsServiceAssembly;
import features.party.PartyServiceAssembly;
import features.scene.SceneFeature;
import features.sessionplanner.SessionPlannerServiceAssembly;
import features.sessiongeneration.SessionGenerationServiceAssembly;
import features.sessiongeneration.api.SessionGenerationApi;
import features.worldplanner.WorldPlannerServiceAssembly;

/** Explicit production composition root. */
public final class AppBootstrap implements AutoCloseable {

    private final Diagnostics diagnostics;
    private final ExecutionLane executionLane;
    private final UiDispatcher uiDispatcher;
    private final SqliteDatabase database;

    public AppBootstrap() {
        this(new SystemLoggerDiagnostics());
    }

    private AppBootstrap(Diagnostics diagnostics) {
        this(
                diagnostics,
                new SerialExecutionLane(diagnostics),
                new JavaFxUiDispatcher(),
                SqliteDatabase.defaultDatabase(SqliteDatabase.DEFAULT_DATABASE_FILE_NAME, diagnostics));
    }

    AppBootstrap(
            Diagnostics diagnostics,
            ExecutionLane executionLane,
            UiDispatcher uiDispatcher,
            SqliteDatabase database
    ) {
        this.diagnostics = java.util.Objects.requireNonNull(diagnostics, "diagnostics");
        this.executionLane = java.util.Objects.requireNonNull(executionLane, "executionLane");
        this.uiDispatcher = java.util.Objects.requireNonNull(uiDispatcher, "uiDispatcher");
        this.database = java.util.Objects.requireNonNull(database, "database");
    }

    public AppShell createShell() {
        AppShell shell = new AppShell(diagnostics);
        Components components = createComponents();
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

    private Components createComponents() {
        CreaturesServiceAssembly.Component creatures = CreaturesServiceAssembly.create(
                database, executionLane, uiDispatcher, diagnostics);
        EncounterTableServiceAssembly.Component encounterTables =
                EncounterTableServiceAssembly.create(
                        database, executionLane, uiDispatcher, diagnostics);
        PartyServiceAssembly.Component party = PartyServiceAssembly.create(
                database, executionLane, uiDispatcher, diagnostics);
        ItemsServiceAssembly.Component items = ItemsServiceAssembly.create(
                database, executionLane, diagnostics);

        WorldPlannerServiceAssembly.Component world = WorldPlannerServiceAssembly.create(
                database,
                creatures.references(),
                encounterTables.references(),
                executionLane,
                uiDispatcher,
                diagnostics);

        EncounterServiceAssembly.Component encounter = EncounterServiceAssembly.create(
                database,
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
                uiDispatcher,
                diagnostics);

        DungeonFeature.Component dungeon = DungeonFeature.create(
                database,
                party.application(),
                executionLane,
                uiDispatcher,
                diagnostics);
        HexServiceAssembly.Component hex = HexServiceAssembly.create(
                database, party.travelPositions(), party.application(),
                executionLane, uiDispatcher, diagnostics);
        SessionGenerationApi generation = SessionGenerationServiceAssembly.create(database, executionLane);
        SessionPlannerServiceAssembly session = SessionPlannerServiceAssembly.create(
                database,
                party.application(),
                party.activeParty(),
                party.adventuringDayCalculation(),
                encounter.application(),
                encounter.savedPlans(),
                encounter.planBudget(),
                world.snapshot(),
                generation,
                encounter.generatedPlanImport(),
                executionLane,
                uiDispatcher,
                diagnostics);
        SceneFeature.Component scene = SceneFeature.create(
                database,
                party.activeParty(),
                world.snapshot(),
                session.preparedScenes(),
                encounter.runtimeContexts(),
                creatures.catalog(),
                creatures.application(),
                executionLane,
                uiDispatcher,
                diagnostics);
        return new Components(
                creatures, encounterTables, party, items, world, encounter, dungeon, hex, session, scene);
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
        var session = components.session();
        var scene = components.scene();
        var inspector = shell.inspector();
        features.worldplanner.api.WorldPlannerEncounterSink worldEncounter =
                (statblockId, npcId) -> encounter.application().applyState(
                        ApplyEncounterStateCommand.addWorldNpcCreature(statblockId, npcId));

        List<ShellContribution> manifest = List.of(
                party.adventuringDayTopBarContribution(),
                party.partyTopBarContribution(),
                CatalogServiceAssembly.contribution(
                        creatures.application(), tables.application(), encounter.application(),
                        encounter.builderInputs(), creatures.filterOptions(), creatures.catalog(),
                        tables.catalog(), encounter.tuningPreview(), encounter.savedPlans(),
                        items.catalog(), world.snapshot(), inspector,
                        creatureId -> creatures.openInspector(inspector, creatureId),
                        npcId -> world.openNpcInspector(
                                npcId, worldEncounter, creatures.catalog(), tables.catalog(), inspector),
                        factionId -> world.openFactionInspector(
                                factionId, worldEncounter, creatures.catalog(), tables.catalog(), inspector),
                        locationId -> world.openLocationInspector(
                                locationId, worldEncounter, creatures.catalog(), tables.catalog(), inspector),
                        () -> world.openNpcCreator(
                                worldEncounter, creatures.catalog(), tables.catalog(), inspector),
                        () -> world.openFactionCreator(
                                worldEncounter, creatures.catalog(), tables.catalog(), inspector),
                        () -> world.openLocationCreator(
                                worldEncounter, creatures.catalog(), tables.catalog(), inspector),
                        npcId -> assignNpcToFocusedScene(scene, npcId),
                        locationId -> setFocusedSceneLocation(scene, locationId)),
                dungeon.editorContribution(),
                dungeon.travelContribution(),
                hex.mapContribution(),
                session.contribution(),
                scene.contribution(creatureId -> creatures.openInspector(inspector, creatureId)),
                encounter.stateContribution(
                        creatures.application(), world.application(),
                        creatureId -> creatures.openInspector(inspector, creatureId)),
                hex.travelStateContribution());

        List<ResolvedContribution> resolved = new ArrayList<>(manifest.size());
        for (ShellContribution contribution : manifest) {
            resolved.add(new ResolvedContribution(contribution.registrationSpec(), contribution.bind()));
        }
        return List.copyOf(resolved);
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
            ItemsServiceAssembly.Component items,
            WorldPlannerServiceAssembly.Component world,
            EncounterServiceAssembly.Component encounter,
            DungeonFeature.Component dungeon,
            HexServiceAssembly.Component hex,
            SessionPlannerServiceAssembly session,
            SceneFeature.Component scene
    ) {
    }

    private record ResolvedContribution(ShellContributionSpec spec, ShellBinding binding) {
    }

    @Override
    public void close() {
        executionLane.close();
        database.close();
    }

}
