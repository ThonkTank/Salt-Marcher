package app;

import features.catalog.CatalogFeature;
import features.catalog.CatalogProviders;
import features.catalog.CatalogRoutes;
import features.creatures.CreaturesServiceAssembly;
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
import features.sessionplanner.SessionPlannerServiceAssembly;
import features.travel.TravelFeature;
import features.worldplanner.WorldPlannerServiceAssembly;

import org.jspecify.annotations.Nullable;

import platform.diagnostics.Diagnostics;
import platform.diagnostics.DiagnosticId;
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
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.atomic.AtomicBoolean;
import javafx.application.Platform;
import javafx.scene.Scene;
import platform.persistence.FeatureStoreReadiness;

/** Explicit production composition root. */
public final class AppBootstrap implements AutoCloseable {

    private static final DiagnosticId CLOSE_FAILURE = new DiagnosticId("campaign-shell.close-failure");

    private final Diagnostics diagnostics;
    private final ExecutionLane startupLane;
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
    private final AtomicBoolean shellCreationStarted = new AtomicBoolean();
    private final java.util.concurrent.ExecutorService closeExecutor =
            java.util.concurrent.Executors.newSingleThreadExecutor(task ->
                    new Thread(task, "salt-marcher-application-closure"));
    private final CompletableFuture<Void> termination = new CompletableFuture<>();
    private final LifecycleOwnerSlot ownership = new LifecycleOwnerSlot();
    private volatile java.util.function.Consumer<String> campaignCloseObserver = ignored -> { };
    private volatile java.util.function.Consumer<CompletionStage<Void>> activationStageObserver = ignored -> { };
    private volatile java.util.function.Consumer<Runnable> postDrainScheduler = Runnable::run;
    private volatile Runnable preStageGate = () -> { };
    private volatile Runnable preComposeGate = () -> { };
    private volatile Runnable shellHandoffGate = () -> { };
    private volatile Runnable prePublishGate = () -> { };

    public AppBootstrap() {
        this(new SystemLoggerDiagnostics());
    }

    private AppBootstrap(Diagnostics diagnostics) {
        this(
                diagnostics,
                new SerialExecutionLane(diagnostics),
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
            ExecutionLane startupLane,
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
        this.startupLane = java.util.Objects.requireNonNull(startupLane, "startupLane");
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

    public CompletionStage<AppShell> createShellAsync() {
        CompletableFuture<AppShell> completion = new CompletableFuture<>();
        if (closed.get()) {
            return CompletableFuture.failedFuture(
                    new IllegalStateException("Application bootstrap is closed"));
        }
        if (!shellCreationStarted.compareAndSet(false, true)) {
            return CompletableFuture.failedFuture(
                    new IllegalStateException("Application shell is already composed"));
        }
        try {
            startupLane.execute(() -> prepareRuntime(completion));
        } catch (RuntimeException | Error failure) {
            completion.completeExceptionally(failure);
        }
        return completion;
    }

    private void prepareRuntime(CompletableFuture<AppShell> completion) {
        RevocableUiDispatcher campaignUi = new RevocableUiDispatcher(uiDispatcher);
        if (closed.get()) {
            campaignUi.revoke();
            completion.completeExceptionally(new IllegalStateException("Application bootstrap is closed"));
            return;
        }
        if (!ownership.beginPreparation(campaignUi)) {
            campaignUi.revoke();
            completion.completeExceptionally(new IllegalStateException("Application bootstrap is closed"));
            return;
        }
        CampaignRuntime runtime;
        try {
            runtime = CampaignRuntime.open(
                    diagnostics,
                    executionLane,
                    creatureReadLane,
                    itemReadLane,
                    sessionGenerationCpuLane,
                    sessionGenerationIoLane,
                    encounterGeneratedCpuLane,
                    encounterGeneratedIoLane,
                    sessionPreparationCpuLane,
                    sessionPreparationIoLane,
                    campaignUi,
                    database);
        } catch (RuntimeException | Error failure) {
            campaignUi.revokeAndDrain().whenComplete((ignored, uiFailure) -> {
                ownership.openFailedAndReleasedResources();
                completion.completeExceptionally(accumulate(failure, uiFailure));
                ownership.settlePreparation(uiFailure);
            });
            return;
        }
        if (!ownership.acquireRuntime(runtime)) {
            failRuntime(
                    runtime,
                    campaignUi,
                    completion,
                    new IllegalStateException("Application bootstrap is closed"));
            return;
        }
        runtime.foundationReadiness().whenComplete((readiness, failure) -> {
            if (failure != null) {
                failRuntime(runtime, campaignUi, completion, failure);
                return;
            }
            campaignUi.dispatchTracked(
                    () -> composePreparedShell(runtime, readiness, campaignUi, completion),
                    dispatchFailure -> {
                        if (dispatchFailure != null) {
                            failRuntime(runtime, campaignUi, completion, dispatchFailure);
                        }
                    });
        });
    }

    private void composePreparedShell(
            CampaignRuntime runtime,
            CampaignRuntime.FoundationReadiness readiness,
            RevocableUiDispatcher campaignUi,
            CompletableFuture<AppShell> completion
    ) {
        preComposeGate.run();
        if (closed.get()) {
            failRuntime(
                    runtime,
                    campaignUi,
                    completion,
                    new IllegalStateException("Application bootstrap is closed"));
            return;
        }
        CampaignRuntime.CandidatePreparation<PreparedShellCandidate> preparation;
        try {
            preparation = runtime.prepareCandidate(() ->
                    buildPreparedCandidate(runtime, readiness, campaignUi));
        } catch (RuntimeException | Error failure) {
            failRuntime(runtime, campaignUi, completion, failure);
            return;
        }
        PreparedShellCandidate candidate = preparation.value();
        CampaignShell owner = new CampaignShell(
                candidate.shell(), candidate.catalog(), runtime, campaignUi, campaignCloseObserver);
        preStageGate.run();
        if (!ownership.stageShell(runtime, owner)) {
            failOwner(
                    owner,
                    completion,
                    new IllegalStateException("Application bootstrap closed before candidate handoff"));
            return;
        }
        preparation.drained().whenComplete((ignored, drainFailure) -> {
            postDrainScheduler.accept(() -> campaignUi.dispatchTracked(
                    () -> finishPreparedCandidate(
                            candidate, owner, runtime, completion, drainFailure),
                    dispatchFailure -> {
                        if (dispatchFailure != null) {
                            failOwner(owner, completion, dispatchFailure);
                        }
                    }));
        });
    }

    private void finishPreparedCandidate(
            PreparedShellCandidate candidate,
            CampaignShell owner,
            CampaignRuntime runtime,
            CompletableFuture<AppShell> completion,
            @Nullable Throwable drainFailure
    ) {
        if (drainFailure != null || closed.get()) {
            Throwable rejection = drainFailure == null
                    ? new IllegalStateException("Application bootstrap is closed") : drainFailure;
            failOwner(owner, completion, rejection);
            return;
        }
        try {
            runtime.prepareBoundShell(candidate.shell(), candidate.scene());
            candidate.shell().setDisable(true);
            candidate.shell().setAccessibleHelp(
                    "Campaign ist vorbereitet und wartet auf sichtbare Aktivierung.");
            shellHandoffGate.run();
            if (closed.get()) {
                failOwner(
                        owner,
                        completion,
                        new IllegalStateException("Application bootstrap closed during shell handoff"));
                return;
            }
            prePublishGate.run();
            if (ownership.publishShell(runtime, owner)) {
                completion.complete(candidate.shell());
            } else {
                failOwner(
                        owner,
                        completion,
                        new IllegalStateException("Application bootstrap closed during shell handoff"));
            }
        } catch (RuntimeException | Error failure) {
            failOwner(owner, completion, failure);
        }
    }

    private void failOwner(
            CampaignShell owner,
            CompletableFuture<AppShell> completion,
            Throwable initialFailure
    ) {
        owner.closeAsync().whenComplete((ignored, closeFailure) -> {
            completion.completeExceptionally(accumulate(initialFailure, closeFailure));
            ownership.settlePreparation(closeFailure);
        });
    }

    private void failRuntime(
            CampaignRuntime runtime,
            RevocableUiDispatcher campaignUi,
            CompletableFuture<AppShell> completion,
            Throwable initialFailure
    ) {
        campaignUi.revokeAndDrain().whenComplete((ignored, uiFailure) -> {
            finishRuntimeFailure(runtime, completion, initialFailure, uiFailure);
        });
    }

    private void finishRuntimeFailure(
            CampaignRuntime runtime,
            CompletableFuture<AppShell> completion,
            Throwable initialFailure,
            @Nullable Throwable priorCleanupFailure
    ) {
        CompletionStage<Void> runtimeClose;
        Throwable cleanupFailure = priorCleanupFailure;
        try {
            runtimeClose = runtime.quiesceAsync();
        } catch (RuntimeException | Error closeFailure) {
            cleanupFailure = accumulate(cleanupFailure, closeFailure);
            runtimeClose = CompletableFuture.completedFuture(null);
        }
        Throwable cleanupBeforeRuntime = cleanupFailure;
        runtimeClose.whenComplete((ignoredRuntime, runtimeFailure) -> {
            Throwable completedCleanupFailure = accumulate(cleanupBeforeRuntime, runtimeFailure);
            completion.completeExceptionally(accumulate(initialFailure, completedCleanupFailure));
            ownership.settlePreparation(completedCleanupFailure);
        });
    }

    private PreparedShellCandidate buildPreparedCandidate(
            CampaignRuntime runtime,
            CampaignRuntime.FoundationReadiness readiness,
            RevocableUiDispatcher campaignUi
    ) {
        AppShell shell = new AppShell(diagnostics);
        CatalogFeature.Component catalog = null;
        try {
            BoundContributions bound = bindContributions(
                    shell, runtime.components(), readiness.stores(), campaignUi);
            catalog = bound.catalog();
            List<ResolvedContribution> contributions = bound.contributions();
            contributions.stream()
                    .sorted(Comparator.comparing(contribution -> contribution.spec().key().value()))
                    .forEach(contribution -> register(shell, contribution));
            ShellLeftBarTabSpec startup = resolveStartupView(contributions);
            if (startup != null) {
                shell.navigateTo(startup.key());
            }
            Scene qualificationScene = new Scene(shell, 1_150, 700);
            qualificationScene.getStylesheets().add(
                    SaltMarcherApp.class.getResource("/salt-marcher.css").toExternalForm());
            shell.applyCss();
            shell.layout();
            return new PreparedShellCandidate(shell, qualificationScene, catalog);
        } catch (RuntimeException | Error failure) {
            if (catalog != null) {
                try {
                    catalog.close();
                } catch (RuntimeException | Error catalogFailure) {
                    failure.addSuppressed(catalogFailure);
                }
            }
            throw failure;
        }
    }

    private BoundContributions bindContributions(
            AppShell shell,
            CampaignRuntime.Components components,
            Map<String, FeatureStoreReadiness> stores,
            UiDispatcher campaignUi
    ) {
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
                        campaignUi),
                catalogRoutes(
                        inspector, creatures, items, world, worldEncounter, tables, encounter, scene));

        List<ShellContribution> manifest = new ArrayList<>();
        manifest.add(party.adventuringDayTopBarContribution());
        manifest.add(party.partyTopBarContribution());
        manifest.add(catalog.contribution());
        if (stores.get("dungeon") == FeatureStoreReadiness.READY) {
            DungeonFeature.Component readyDungeon = java.util.Objects.requireNonNull(dungeon);
            manifest.add(readyDungeon.editorContribution());
            manifest.add(readyDungeon.travelContribution());
        }
        if (stores.get("hex") == FeatureStoreReadiness.READY) {
            manifest.add(java.util.Objects.requireNonNull(hex).mapContribution());
        }
        manifest.add(session.contribution());
        manifest.add(scene.contribution(creatureId -> creatures.openInspector(inspector, creatureId)));
        manifest.add(encounter.stateContribution(
                creatures.application(), world.application(),
                creatureId -> creatures.openInspector(inspector, creatureId)));
        if (stores.get("dungeon") == FeatureStoreReadiness.READY
                && stores.get("hex") == FeatureStoreReadiness.READY) {
            manifest.add(java.util.Objects.requireNonNull(travel).contribution());
        }

        List<ResolvedContribution> resolved = new ArrayList<>(manifest.size());
        for (ShellContribution contribution : manifest) {
            resolved.add(new ResolvedContribution(contribution.registrationSpec(), contribution.bind()));
        }
        return new BoundContributions(List.copyOf(resolved), catalog);
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

    private record ResolvedContribution(ShellContributionSpec spec, ShellBinding binding) {
    }

    private record BoundContributions(
            List<ResolvedContribution> contributions,
            CatalogFeature.Component catalog
    ) {
    }

    private record PreparedShellCandidate(
            AppShell shell,
            Scene scene,
            CatalogFeature.Component catalog
    ) {
    }

    CampaignRuntime campaignRuntimeForTesting() {
        CampaignShell owner = ownership.shell();
        if (owner == null) {
            throw new IllegalStateException("Campaign runtime is not published");
        }
        return owner.runtime();
    }

    CompletionStage<Void> publishAndActivateShell(AppShell shell, Runnable visiblePublication) {
        CampaignShell owner = ownership.shell();
        if (owner == null || owner.shell() != shell) {
            throw new IllegalStateException("Published shell is not the prepared Campaign shell");
        }
        CampaignRuntime.CandidatePreparation<AppShell> publication = owner.runtime().prepareCandidate(() -> {
            shell.setDisable(true);
            shell.setAccessibleHelp("Campaign wird aktiviert.");
            visiblePublication.run();
            return shell;
        });
        CompletableFuture<Void> activated = new CompletableFuture<>();
        activationStageObserver.accept(activated);
        publication.drained().whenComplete((ignored, failure) -> {
            if (failure != null) {
                activated.completeExceptionally(failure);
                return;
            }
            owner.dispatchUiTracked(() -> {
                owner.activateVisibleShell();
                shell.setDisable(false);
                shell.setAccessibleHelp("Campaign ist aktiv.");
            }, dispatchFailure -> {
                if (dispatchFailure == null) {
                    activated.complete(null);
                } else {
                    activated.completeExceptionally(dispatchFailure);
                }
            });
        });
        return activated;
    }

    @Override
    public void close() {
        if (closed.compareAndSet(false, true)) {
            ownership.requestClose();
            closeExecutor.execute(this::performClose);
        }
        if (!Platform.isFxApplicationThread()) {
            termination.join();
        }
    }

    CompletionStage<Void> termination() {
        return termination;
    }

    void installShellHandoffGateForTesting(Runnable gate) {
        shellHandoffGate = java.util.Objects.requireNonNull(gate, "gate");
    }

    void installPreComposeGateForTesting(Runnable gate) {
        preComposeGate = java.util.Objects.requireNonNull(gate, "gate");
    }

    void installCampaignCloseObserverForTesting(java.util.function.Consumer<String> observer) {
        campaignCloseObserver = java.util.Objects.requireNonNull(observer, "observer");
    }

    void installActivationStageObserverForTesting(
            java.util.function.Consumer<CompletionStage<Void>> observer
    ) {
        activationStageObserver = java.util.Objects.requireNonNull(observer, "observer");
    }

    void installPostDrainSchedulerForTesting(java.util.function.Consumer<Runnable> scheduler) {
        postDrainScheduler = java.util.Objects.requireNonNull(scheduler, "scheduler");
    }

    void installPreStageGateForTesting(Runnable gate) {
        preStageGate = java.util.Objects.requireNonNull(gate, "gate");
    }

    void installPrePublishGateForTesting(Runnable gate) {
        prePublishGate = java.util.Objects.requireNonNull(gate, "gate");
    }

    boolean closeClaimedForTesting() {
        return ownership.closeClaimed();
    }

    boolean preparatoryUiRevokedForTesting() {
        RevocableUiDispatcher preparatoryUi = ownership.preparatoryUi();
        return preparatoryUi == null || preparatoryUi.revokedForTesting();
    }

    private void performClose() {
        Throwable failure = null;
        try {
            startupLane.close();
        } catch (RuntimeException | Error startupFailure) {
            failure = startupFailure;
        }
        RevocableUiDispatcher preparatoryUi = ownership.preparatoryUi();
        if (preparatoryUi != null) {
            try {
                preparatoryUi.revokeAndDrain().toCompletableFuture().join();
            } catch (RuntimeException uiFailure) {
                failure = accumulate(failure, uiFailure);
            }
        }
        LifecycleOwnerSlot.CloseClaim claim = ownership.claimForClose();
        CampaignShell owner = claim.shell();
        if (owner != null) {
            failure = awaitPreparationSettlement(claim, failure);
            try {
                owner.closeAsync().toCompletableFuture().join();
            } catch (RuntimeException closeFailure) {
                failure = accumulate(failure, closeFailure);
            }
        } else {
            CampaignRuntime runtime = claim.runtime();
            if (runtime != null) {
                try {
                    runtime.quiesceAsync().toCompletableFuture().join();
                } catch (RuntimeException closeFailure) {
                    failure = accumulate(failure, closeFailure);
                }
            } else if (claim.closeRawResources()) {
                failure = CampaignRuntime.closeOwnedResources(
                        executionLane,
                        java.util.List.of(
                                creatureReadLane,
                                itemReadLane,
                                sessionGenerationCpuLane,
                                sessionGenerationIoLane,
                                encounterGeneratedCpuLane,
                                encounterGeneratedIoLane,
                                sessionPreparationCpuLane,
                                sessionPreparationIoLane),
                        database,
                        failure);
            }
            failure = awaitPreparationSettlement(claim, failure);
        }
        if (failure == null) {
            termination.complete(null);
        } else {
            diagnostics.failure(CLOSE_FAILURE, failure.getClass());
            termination.completeExceptionally(failure);
        }
        closeExecutor.shutdown();
    }

    private static Throwable awaitPreparationSettlement(
            LifecycleOwnerSlot.CloseClaim claim,
            Throwable currentFailure
    ) {
        try {
            claim.preparationSettled().toCompletableFuture().join();
        } catch (RuntimeException preparationFailure) {
            return accumulate(currentFailure, preparationFailure);
        }
        return currentFailure;
    }

    private static Throwable accumulate(Throwable current, Throwable next) {
        if (next == null || current == next) {
            return current;
        }
        if (current == null) {
            return next;
        }
        current.addSuppressed(next);
        return current;
    }

    private static final class LifecycleOwnerSlot {
        private enum State { RAW, OPENING, PREPARING, SHELL, RELEASED, CLOSE_CLAIMED }

        private State state = State.RAW;
        private CampaignRuntime runtime;
        private CampaignShell shell;
        private RevocableUiDispatcher uiDispatcher;
        private boolean closeRequested;
        private CompletableFuture<Void> preparationSettled = CompletableFuture.completedFuture(null);

        synchronized boolean beginPreparation(RevocableUiDispatcher preparatoryUi) {
            if (closeRequested || state != State.RAW) {
                return false;
            }
            uiDispatcher = java.util.Objects.requireNonNull(preparatoryUi, "preparatoryUi");
            preparationSettled = new CompletableFuture<>();
            state = State.OPENING;
            return true;
        }

        synchronized boolean acquireRuntime(CampaignRuntime acquired) {
            if (closeRequested || state != State.OPENING) {
                return false;
            }
            runtime = java.util.Objects.requireNonNull(acquired, "acquired");
            state = State.PREPARING;
            return true;
        }

        synchronized void openFailedAndReleasedResources() {
            if (state == State.OPENING) {
                state = State.RELEASED;
            }
        }

        synchronized boolean stageShell(CampaignRuntime expected, CampaignShell staged) {
            if (state != State.PREPARING || runtime != expected || shell != null) {
                return false;
            }
            shell = java.util.Objects.requireNonNull(staged, "staged");
            return true;
        }

        synchronized boolean publishShell(CampaignRuntime expected, CampaignShell published) {
            if (closeRequested || state != State.PREPARING
                    || runtime != expected || shell != published) {
                return false;
            }
            runtime = null;
            state = State.SHELL;
            preparationSettled.complete(null);
            return true;
        }

        synchronized void settlePreparation() {
            preparationSettled.complete(null);
        }

        synchronized void settlePreparation(@Nullable Throwable failure) {
            if (failure == null) {
                preparationSettled.complete(null);
            } else {
                preparationSettled.completeExceptionally(failure);
            }
        }

        synchronized CampaignShell shell() {
            return !closeRequested && state == State.SHELL ? shell : null;
        }

        synchronized void requestClose() {
            closeRequested = true;
        }

        synchronized RevocableUiDispatcher preparatoryUi() {
            return uiDispatcher;
        }

        synchronized CloseClaim claimForClose() {
            CloseClaim claim = switch (state) {
                case RAW -> new CloseClaim(true, null, null);
                case OPENING -> new CloseClaim(false, null, null);
                case PREPARING -> shell == null
                        ? new CloseClaim(false, runtime, null)
                        : new CloseClaim(false, null, shell);
                case SHELL -> new CloseClaim(false, null, shell);
                case RELEASED, CLOSE_CLAIMED -> new CloseClaim(false, null, null);
            };
            runtime = null;
            shell = null;
            uiDispatcher = null;
            state = State.CLOSE_CLAIMED;
            return new CloseClaim(
                    claim.closeRawResources(), claim.runtime(), claim.shell(), preparationSettled);
        }

        synchronized boolean closeClaimed() {
            return state == State.CLOSE_CLAIMED;
        }

        private record CloseClaim(
                boolean closeRawResources,
                CampaignRuntime runtime,
                CampaignShell shell,
                CompletionStage<Void> preparationSettled
        ) {
            private CloseClaim(boolean closeRawResources, CampaignRuntime runtime, CampaignShell shell) {
                this(closeRawResources, runtime, shell, CompletableFuture.completedFuture(null));
            }
        }
    }

}
