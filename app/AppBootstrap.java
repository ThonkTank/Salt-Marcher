package app;

import features.catalog.CatalogFeature;
import features.catalog.CatalogProviders;
import features.catalog.CatalogRoutes;
import features.campaign.api.CampaignId;
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
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.atomic.AtomicBoolean;
import javafx.application.Platform;
import javafx.scene.Scene;
import platform.persistence.FeatureStoreReadiness;

/** Explicit production composition root. */
public final class AppBootstrap implements AutoCloseable {

    private static final DiagnosticId CLOSE_FAILURE = new DiagnosticId("campaign-shell.close-failure");
    private static final int COORDINATOR_CLOSE_ATTEMPTS = 3;
    static final String INSTALLATION_DATABASE_FILE_NAME = "installation.sqlite";

    record InstallationOwnershipSnapshot(boolean runtimeRetained, boolean resourcesClosed) {
    }

    private enum InstallationOwnershipState {
        EMPTY_OPEN,
        RUNTIME_OWNED,
        RAW_CLOSE_CLAIMED,
        CLOSED
    }

    private record InstallationOwnership(
            InstallationOwnershipState state,
            @Nullable InstallationRuntime runtime
    ) {
    }

    private final Diagnostics diagnostics;
    private final ExecutionLane startupLane;
    private final UiDispatcher uiDispatcher;
    private final SqliteDatabase installationDatabase;
    private final java.util.concurrent.atomic.AtomicReference<InstallationOwnership>
            installationOwnership = new java.util.concurrent.atomic.AtomicReference<>(
                    new InstallationOwnership(InstallationOwnershipState.EMPTY_OPEN, null));
    private final java.util.concurrent.atomic.AtomicReference<CampaignActivationCoordinator>
            campaignActivationCoordinator = new java.util.concurrent.atomic.AtomicReference<>();
    private final AtomicBoolean closed = new AtomicBoolean();
    private final AtomicBoolean shellCreationStarted = new AtomicBoolean();
    private final AtomicBoolean startupClosed = new AtomicBoolean();
    private final AtomicBoolean installationRetryRegistered = new AtomicBoolean();
    private final AtomicBoolean coordinatorRetryRegistered = new AtomicBoolean();
    private final java.util.concurrent.atomic.AtomicInteger installationRuntimeCloseClaims =
            new java.util.concurrent.atomic.AtomicInteger();
    private final java.util.concurrent.ExecutorService closeExecutor =
            java.util.concurrent.Executors.newSingleThreadExecutor(task -> {
                Thread thread = new Thread(task, "salt-marcher-application-closure");
                thread.setDaemon(true);
                return thread;
            });
    private final java.util.Set<CompletableFuture<?>> pendingStartupCompletions =
            java.util.concurrent.ConcurrentHashMap.newKeySet();
    private final CompletableFuture<Void> termination = new CompletableFuture<>();
    private final Object closeMonitor = new Object();
    private final Object startupHandoffMonitor = new Object();
    private CompletableFuture<Void> closeAttempt;
    private volatile java.util.function.Consumer<String> campaignCloseObserver = ignored -> { };
    private volatile Runnable campaignStartupGate = () -> { };
    private volatile java.time.Duration campaignActivationPhaseTimeout =
            java.time.Duration.ofSeconds(10);
    private volatile java.time.Duration campaignCommitTimeout = java.time.Duration.ofSeconds(10);
    private volatile java.time.Duration startupShutdownTimeout = java.time.Duration.ofSeconds(10);
    private volatile java.time.Duration installationShutdownTimeout = java.time.Duration.ofSeconds(10);
    private volatile Runnable campaignPreCommitGate = () -> { };
    private volatile Runnable campaignCoordinatorHandoffGate = () -> { };
    private volatile Runnable installationRawCloseClaimGate = () -> { };
    private volatile Runnable preInstallationAcquireGate = () -> { };
    private volatile Runnable postInstallationAcquireGate = () -> { };

    public AppBootstrap() {
        this(new SystemLoggerDiagnostics());
    }

    private AppBootstrap(Diagnostics diagnostics) {
        this(
                diagnostics,
                new SerialExecutionLane(diagnostics),
                new JavaFxUiDispatcher(),
                SqliteDatabase.defaultDatabase(INSTALLATION_DATABASE_FILE_NAME, diagnostics));
    }

    AppBootstrap(
            Diagnostics diagnostics,
            ExecutionLane startupLane,
            UiDispatcher uiDispatcher,
            SqliteDatabase installationDatabase
    ) {
        this.diagnostics = java.util.Objects.requireNonNull(diagnostics, "diagnostics");
        this.startupLane = java.util.Objects.requireNonNull(startupLane, "startupLane");
        this.uiDispatcher = java.util.Objects.requireNonNull(uiDispatcher, "uiDispatcher");
        this.installationDatabase = java.util.Objects.requireNonNull(
                installationDatabase, "installationDatabase");
    }

    private boolean acquireInstallation(InstallationRuntime installation) {
        InstallationRuntime safeInstallation = java.util.Objects.requireNonNull(
                installation, "installation");
        while (true) {
            InstallationOwnership current = installationOwnership.get();
            if (current.state() != InstallationOwnershipState.EMPTY_OPEN) {
                return false;
            }
            if (installationOwnership.compareAndSet(
                    current,
                    new InstallationOwnership(
                            InstallationOwnershipState.RUNTIME_OWNED,
                            safeInstallation))) {
                return true;
            }
        }
    }

    /** Opens the single production Campaign-activation composition route. */
    CompletionStage<CampaignActivationCoordinator> openCampaignActivationAsync(
            java.nio.file.Path campaignRoot,
            CampaignActivationCoordinator.SwitchingHost host
    ) {
        CompletableFuture<CampaignActivationCoordinator> completion = new CompletableFuture<>();
        if (!registerStartupCompletion(completion)) {
            completion.completeExceptionally(
                    new IllegalStateException("Application bootstrap is closed"));
            return completion;
        }
        if (!shellCreationStarted.compareAndSet(false, true)) {
            completion.completeExceptionally(
                    new IllegalStateException("Application shell composition is already owned"));
            return completion;
        }
        try {
            startupLane.execute(() -> {
                InstallationRuntime installation = null;
                CampaignActivationCoordinator coordinator = null;
                try {
                    if (closed.get()) {
                        completion.completeExceptionally(
                                new IllegalStateException("Application bootstrap is closed"));
                        return;
                    }
                    campaignStartupGate.run();
                    synchronized (startupHandoffMonitor) {
                        if (closed.get()) {
                            completion.completeExceptionally(
                                    new IllegalStateException("Application bootstrap is closed"));
                            return;
                        }
                    }
                    installation = InstallationRuntime.open(
                            diagnostics, installationDatabase, installationShutdownTimeout);
                    preInstallationAcquireGate.run();
                    if (!acquireInstallation(installation)) {
                        installation.close();
                        throw new IllegalStateException("Installation runtime is already composed");
                    }
                    postInstallationAcquireGate.run();
                    boolean rejectedAfterInstallation;
                    synchronized (startupHandoffMonitor) {
                        rejectedAfterInstallation = closed.get();
                    }
                    if (rejectedAfterInstallation) {
                        Throwable cleanupFailure = closeClaimedInstallation(installation);
                        IllegalStateException handoffFailure = new IllegalStateException(
                                "Application bootstrap closed during installation handoff");
                        if (cleanupFailure != null) {
                            handoffFailure.addSuppressed(cleanupFailure);
                        }
                        completion.completeExceptionally(handoffFailure);
                        return;
                    }
                    coordinator = new CampaignActivationCoordinator(
                            diagnostics,
                            installation.campaigns(),
                            campaignRoot,
                            (campaignId, campaignPath, intent) -> prepareCampaignCandidate(
                                    campaignId, campaignPath, intent, campaignRoot, host),
                            host,
                            java.util.UUID::randomUUID,
                            campaignActivationPhaseTimeout,
                            campaignCommitTimeout,
                            campaignPreCommitGate);
                    campaignCoordinatorHandoffGate.run();
                    boolean rejectedByClose;
                    synchronized (startupHandoffMonitor) {
                        rejectedByClose = closed.get();
                        if (!rejectedByClose
                                && campaignActivationCoordinator.compareAndSet(null, coordinator)) {
                            completion.complete(coordinator);
                            return;
                        }
                    }
                    Throwable cleanupFailure = closeLocalCampaignActivation(
                            coordinator, installation);
                    IllegalStateException handoffFailure = new IllegalStateException(
                            rejectedByClose
                                    ? "Application bootstrap is closed"
                                    : "Campaign activation is already composed");
                    if (cleanupFailure != null) {
                        handoffFailure.addSuppressed(cleanupFailure);
                    }
                    completion.completeExceptionally(handoffFailure);
                } catch (RuntimeException | Error failure) {
                    Throwable cleanupFailure = coordinator != null
                            ? closeLocalCampaignActivation(coordinator, installation)
                            : installation == null ? null : closeClaimedInstallation(installation);
                    completion.completeExceptionally(accumulate(failure, cleanupFailure));
                }
            });
        } catch (RuntimeException | Error failure) {
            completion.completeExceptionally(failure);
        }
        return completion;
    }

    private boolean registerStartupCompletion(CompletableFuture<?> completion) {
        synchronized (startupHandoffMonitor) {
            if (closed.get()) {
                return false;
            }
            pendingStartupCompletions.add(completion);
        }
        completion.whenComplete((ignored, failure) -> pendingStartupCompletions.remove(completion));
        return true;
    }

    private Throwable closeLocalCampaignActivation(
            CampaignActivationCoordinator coordinator,
            InstallationRuntime installation
    ) {
        Throwable failure = null;
        try {
            coordinator.close();
        } catch (RuntimeException | Error closeFailure) {
            failure = closeFailure;
        }
        return accumulate(failure, closeClaimedInstallation(installation));
    }

    private Throwable closeClaimedInstallation(InstallationRuntime installation) {
        if (installationOwnership.get().runtime() != installation) {
            return null;
        }
        return attemptInstallationClose(installation, true);
    }

    private CompletionStage<CampaignShell> prepareCampaignCandidate(
            CampaignId campaignId,
            java.nio.file.Path campaignPath,
            CampaignActivationCoordinator.OpenIntent intent,
            java.nio.file.Path campaignRoot,
            CampaignActivationCoordinator.SwitchingHost host
    ) {
        java.util.Objects.requireNonNull(campaignId, "campaignId");
        java.nio.file.Path safePath = java.util.Objects.requireNonNull(
                campaignPath, "campaignPath").toAbsolutePath().normalize();
        InstallationRuntime installation = installationOwnership.get().runtime();
        if (installation == null || closed.get()) {
            return CompletableFuture.failedFuture(
                    new IllegalStateException("Installation runtime is not available"));
        }

        RevocableUiDispatcher campaignUi = new RevocableUiDispatcher(uiDispatcher);
        CampaignRuntime runtime;
        try {
            runtime = CampaignRuntime.open(
                    diagnostics,
                    new SerialExecutionLane(diagnostics),
                    new BoundedExecutionLane(diagnostics, "campaign-creatures-read", 2),
                    new BoundedExecutionLane(diagnostics, "campaign-items-read", 2),
                    new BoundedExecutionLane(
                            diagnostics,
                            "campaign-session-generation-cpu",
                            Math.max(2, Runtime.getRuntime().availableProcessors() - 1)),
                    new BoundedExecutionLane(diagnostics, "campaign-session-generation-io", 2),
                    new BoundedExecutionLane(
                            diagnostics,
                            "campaign-encounter-generated-cpu",
                            Math.max(2, Runtime.getRuntime().availableProcessors() - 1)),
                    new BoundedExecutionLane(diagnostics, "campaign-encounter-generated-io", 2),
                    new BoundedExecutionLane(diagnostics, "campaign-session-preparation-cpu", 2),
                    new BoundedExecutionLane(diagnostics, "campaign-session-preparation-io", 2),
                    campaignUi,
                    installation.references(),
                    new SqliteDatabase(
                            safePath,
                            diagnostics,
                            intent == CampaignActivationCoordinator.OpenIntent.EXISTING_ONLY
                                    ? SqliteDatabase.OpenMode.EXISTING_ONLY
                                    : SqliteDatabase.OpenMode.RESERVED_NEW,
                            campaignRoot));
        } catch (RuntimeException | Error failure) {
            campaignUi.revoke();
            return CompletableFuture.failedFuture(failure);
        }

        CompletableFuture<CampaignShell> completion = new CompletableFuture<>();
        runtime.foundationReadiness().whenComplete((readiness, foundationFailure) -> {
            if (foundationFailure != null) {
                failCampaignCandidate(runtime, campaignUi, completion, foundationFailure);
                return;
            }
            campaignUi.dispatchTracked(() -> {
                CampaignRuntime.CandidatePreparation<PreparedShellCandidate> preparation;
                try {
                    preparation = runtime.prepareCandidate(
                            () -> buildPreparedCandidate(runtime, readiness, Optional.of(host)));
                } catch (RuntimeException | Error failure) {
                    failCampaignCandidate(runtime, campaignUi, completion, failure);
                    return;
                }
                PreparedShellCandidate candidate = preparation.value();
                CampaignShell owner = new CampaignShell(
                        candidate.shell(), candidate.scene(), candidate.catalog(), runtime,
                        campaignUi, campaignCloseObserver);
                preparation.drained().whenComplete((ignored, drainFailure) -> {
                    if (drainFailure != null) {
                        failCampaignCandidate(owner, completion, drainFailure);
                        return;
                    }
                    campaignUi.dispatchTracked(() -> {
                        try {
                            runtime.prepareBoundShell(candidate.shell(), candidate.scene());
                            candidate.shell().setDisable(true);
                            candidate.shell().setAccessibleHelp(
                                    "Campaign ist vorbereitet und wartet auf sichtbare Aktivierung.");
                            completion.complete(owner);
                        } catch (RuntimeException | Error failure) {
                            failCampaignCandidate(owner, completion, failure);
                        }
                    }, dispatchFailure -> {
                        if (dispatchFailure != null) {
                            failCampaignCandidate(owner, completion, dispatchFailure);
                        }
                    });
                });
            }, dispatchFailure -> {
                if (dispatchFailure != null) {
                    failCampaignCandidate(runtime, campaignUi, completion, dispatchFailure);
                }
            });
        });
        return completion;
    }

    private static void failCampaignCandidate(
            CampaignShell owner,
            CompletableFuture<CampaignShell> completion,
            Throwable failure
    ) {
        owner.closeAsync().whenComplete((ignored, closeFailure) ->
                completion.completeExceptionally(accumulate(failure, closeFailure)));
    }

    private static void failCampaignCandidate(
            CampaignRuntime runtime,
            RevocableUiDispatcher campaignUi,
            CompletableFuture<CampaignShell> completion,
            Throwable failure
    ) {
        campaignUi.revokeAndDrain().whenComplete((ignored, uiFailure) ->
                runtime.quiesceAsync().whenComplete((ignoredRuntime, runtimeFailure) ->
                        completion.completeExceptionally(accumulate(
                                failure, accumulate(uiFailure, runtimeFailure)))));
    }

    private PreparedShellCandidate buildPreparedCandidate(
            CampaignRuntime runtime,
            CampaignRuntime.FoundationReadiness readiness,
            Optional<CampaignActivationCoordinator.SwitchingHost> host
    ) {
        AppShell shell = new AppShell(diagnostics);
        CatalogFeature.Component catalog = null;
        try {
            BoundContributions bound = bindContributions(
                    shell, runtime.components(), readiness.stores(), runtime.uiDispatcher());
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
            host.ifPresent(owner -> owner.installSelectorAccess(shell));
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
                        inspector, creatures, items, world, worldEncounter, tables, encounter));

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
            EncounterServiceAssembly.Component encounter
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
        return new CatalogRoutes(
                creatureId -> creatures.openInspector(inspector, creatureId),
                detail -> items.openInspector(inspector, detail),
                worldInspectors,
                encounterHandoff);
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
        CampaignActivationCoordinator coordinator = campaignActivationCoordinator.get();
        if (coordinator != null) {
            return coordinator.activeRuntimeForTesting();
        }
        throw new IllegalStateException("Campaign runtime is not published");
    }

    @Override
    public void close() {
        java.util.List<CompletableFuture<?>> startupToReject = java.util.List.of();
        synchronized (startupHandoffMonitor) {
            if (closed.compareAndSet(false, true)) {
                startupToReject = java.util.List.copyOf(pendingStartupCompletions);
            }
        }
        IllegalStateException closedFailure =
                new IllegalStateException("Application bootstrap is closed");
        startupToReject.forEach(completion -> completion.completeExceptionally(closedFailure));
        CompletableFuture<Void> attempt;
        synchronized (closeMonitor) {
            if (termination.isDone()) {
                attempt = termination;
            } else if (closeAttempt != null) {
                attempt = closeAttempt;
            } else {
                attempt = new CompletableFuture<>();
                closeAttempt = attempt;
                CompletableFuture<Void> ownedAttempt = attempt;
                closeExecutor.execute(() -> performClose(ownedAttempt));
            }
        }
        if (!Platform.isFxApplicationThread()) {
            attempt.join();
        }
    }

    CompletionStage<Void> termination() {
        return termination;
    }

    void installCampaignCloseObserverForTesting(java.util.function.Consumer<String> observer) {
        campaignCloseObserver = java.util.Objects.requireNonNull(observer, "observer");
    }

    void installCampaignStartupGateForTesting(Runnable gate) {
        campaignStartupGate = java.util.Objects.requireNonNull(gate, "gate");
    }

    void installCampaignActivationPhaseTimeoutForTesting(java.time.Duration timeout) {
        campaignActivationPhaseTimeout = java.util.Objects.requireNonNull(timeout, "timeout");
    }

    void installCampaignPreCommitGateForTesting(Runnable gate) {
        campaignPreCommitGate = java.util.Objects.requireNonNull(gate, "gate");
    }

    void installCampaignCommitTimeoutForTesting(java.time.Duration timeout) {
        campaignCommitTimeout = java.util.Objects.requireNonNull(timeout, "timeout");
    }

    void installStartupShutdownTimeoutForTesting(java.time.Duration timeout) {
        java.time.Duration safeTimeout = java.util.Objects.requireNonNull(timeout, "timeout");
        if (safeTimeout.isNegative() || safeTimeout.isZero()) {
            throw new IllegalArgumentException("timeout must be positive");
        }
        startupShutdownTimeout = safeTimeout;
    }

    void installInstallationShutdownTimeoutForTesting(java.time.Duration timeout) {
        java.time.Duration safeTimeout = java.util.Objects.requireNonNull(timeout, "timeout");
        if (safeTimeout.isNegative()) {
            throw new IllegalArgumentException("timeout must not be negative");
        }
        installationShutdownTimeout = safeTimeout;
    }

    void installCampaignCoordinatorHandoffGateForTesting(Runnable gate) {
        campaignCoordinatorHandoffGate = java.util.Objects.requireNonNull(gate, "gate");
    }

    void installInstallationRawCloseClaimGateForTesting(Runnable gate) {
        installationRawCloseClaimGate = java.util.Objects.requireNonNull(gate, "gate");
    }

    void installPreInstallationAcquireGateForTesting(Runnable gate) {
        preInstallationAcquireGate = java.util.Objects.requireNonNull(gate, "gate");
    }

    void installPostInstallationAcquireGateForTesting(Runnable gate) {
        postInstallationAcquireGate = java.util.Objects.requireNonNull(gate, "gate");
    }

    boolean closeRequestedForTesting() {
        return closed.get();
    }

    boolean campaignActivationRetainedForTesting() {
        return campaignActivationCoordinator.get() != null;
    }

    boolean installationRuntimeRetainedForTesting() {
        return installationOwnership.get().runtime() != null;
    }

    boolean installationResourcesClosedForTesting() {
        return installationOwnership.get().state() == InstallationOwnershipState.CLOSED;
    }

    InstallationOwnershipSnapshot installationOwnershipForTesting() {
        InstallationOwnership ownership = installationOwnership.get();
        return new InstallationOwnershipSnapshot(
                ownership.runtime() != null,
                ownership.state() == InstallationOwnershipState.CLOSED);
    }

    void runInstallationRegistryTaskForTesting(Runnable task) {
        InstallationRuntime installation = installationOwnership.get().runtime();
        if (installation == null) {
            throw new IllegalStateException("Installation runtime is not available");
        }
        installation.runRegistryTaskForTesting(task);
    }

    boolean closeExecutorShutdownForTesting() {
        return closeExecutor.isShutdown();
    }

    boolean closeExecutorTerminatedForTesting() {
        return closeExecutor.isTerminated();
    }

    boolean installationRegistryOperationActiveForTesting() {
        InstallationRuntime installation = installationOwnership.get().runtime();
        return installation != null && installation.registryOperationActiveForTesting();
    }

    int installationRuntimeCloseClaimsForTesting() {
        return installationRuntimeCloseClaims.get();
    }

    private void performClose(CompletableFuture<Void> attempt) {
        Throwable failure = null;
        CampaignActivationCoordinator coordinatorNeedingRetry = null;
        Throwable coordinatorFailure = null;
        if (startupClosed.compareAndSet(false, true)) {
            failure = terminateStartupOwner();
        }
        CampaignActivationCoordinator coordinator = campaignActivationCoordinator.get();
        if (coordinator != null) {
            Throwable lastCoordinatorFailure = null;
            for (int closeAttemptNumber = 0;
                    closeAttemptNumber < COORDINATOR_CLOSE_ATTEMPTS;
                    closeAttemptNumber++) {
                try {
                    coordinator.close();
                    campaignActivationCoordinator.compareAndSet(coordinator, null);
                    lastCoordinatorFailure = null;
                    break;
                } catch (RuntimeException | Error closeFailure) {
                    lastCoordinatorFailure = closeFailure;
                    diagnostics.failure(CLOSE_FAILURE, closeFailure.getClass());
                }
            }
            if (lastCoordinatorFailure != null) {
                coordinatorNeedingRetry = coordinator;
                coordinatorFailure = lastCoordinatorFailure;
            }
        }
        failure = closeInstallationResources(failure);
        if (coordinatorNeedingRetry != null) {
            CampaignActivationCoordinator retained = coordinatorNeedingRetry;
            if (campaignActivationCoordinator.get() == retained) {
                try {
                    retained.close();
                    campaignActivationCoordinator.compareAndSet(retained, null);
                    coordinatorFailure = null;
                } catch (RuntimeException | Error terminalCoordinatorFailure) {
                    coordinatorFailure = terminalCoordinatorFailure;
                    diagnostics.failure(CLOSE_FAILURE, terminalCoordinatorFailure.getClass());
                }
            } else {
                coordinatorFailure = null;
            }
            failure = accumulate(failure, coordinatorFailure);
            if (coordinatorFailure != null) {
                registerCoordinatorRetry(retained);
            }
        }
        closeExecutor.shutdown();
        if (failure == null) {
            termination.complete(null);
            attempt.complete(null);
        } else {
            diagnostics.failure(CLOSE_FAILURE, failure.getClass());
            termination.completeExceptionally(failure);
            attempt.completeExceptionally(failure);
        }
        synchronized (closeMonitor) {
            closeAttempt = null;
        }
    }

    private synchronized Throwable closeInstallationResources(Throwable initialFailure) {
        Throwable failure = initialFailure;
        while (true) {
            InstallationOwnership ownership = installationOwnership.get();
            if (ownership.state() == InstallationOwnershipState.RUNTIME_OWNED) {
                return accumulate(
                        failure,
                        attemptInstallationClose(
                                java.util.Objects.requireNonNull(ownership.runtime()), true));
            }
            if (ownership.state() == InstallationOwnershipState.CLOSED
                    || ownership.state() == InstallationOwnershipState.RAW_CLOSE_CLAIMED) {
                return failure;
            }
            installationRawCloseClaimGate.run();
            InstallationOwnership claimed = new InstallationOwnership(
                    InstallationOwnershipState.RAW_CLOSE_CLAIMED, null);
            if (!installationOwnership.compareAndSet(ownership, claimed)) {
                continue;
            }
            try {
                installationDatabase.close();
                installationOwnership.compareAndSet(
                        claimed,
                        new InstallationOwnership(InstallationOwnershipState.CLOSED, null));
            } catch (RuntimeException | Error closeFailure) {
                failure = accumulate(failure, closeFailure);
            }
            return failure;
        }
    }

    private Throwable attemptInstallationClose(
            InstallationRuntime installation,
            boolean registerLateRetry
    ) {
        installationRuntimeCloseClaims.incrementAndGet();
        try {
            installation.close();
        } catch (RuntimeException | Error closeFailure) {
            if (registerLateRetry) {
                registerInstallationRetry(installation);
            }
            return closeFailure;
        }
        clearClosedInstallation(installation);
        return null;
    }

    private void clearClosedInstallation(InstallationRuntime installation) {
        while (true) {
            InstallationOwnership current = installationOwnership.get();
            if (current.runtime() != installation) {
                return;
            }
            if (installationOwnership.compareAndSet(
                    current,
                    new InstallationOwnership(InstallationOwnershipState.CLOSED, null))) {
                return;
            }
        }
    }

    private void registerInstallationRetry(InstallationRuntime installation) {
        if (!installationRetryRegistered.compareAndSet(false, true)) {
            return;
        }
        installation.shutdownSettlement().whenComplete((ignored, settlementFailure) -> {
            if (installationOwnership.get().runtime() != installation) {
                return;
            }
            Throwable retryFailure = settlementFailure;
            if (retryFailure == null) {
                retryFailure = attemptInstallationClose(installation, false);
            }
            if (retryFailure != null) {
                diagnostics.failure(CLOSE_FAILURE, retryFailure.getClass());
            }
        });
    }

    private void registerCoordinatorRetry(CampaignActivationCoordinator coordinator) {
        if (!coordinatorRetryRegistered.compareAndSet(false, true)) {
            return;
        }
        runDaemonLateCleanup("salt-marcher-coordinator-late-cleanup", () -> {
            long backoffNanos = java.util.concurrent.TimeUnit.MILLISECONDS.toNanos(10);
            long maximumBackoffNanos = java.util.concurrent.TimeUnit.MILLISECONDS.toNanos(250);
            while (campaignActivationCoordinator.get() == coordinator) {
                CompletionStage<Void> settlement = coordinator.terminalCloseSettlement();
                try {
                    if (settlement != null) {
                        settlement.toCompletableFuture().join();
                    }
                    coordinator.close();
                    campaignActivationCoordinator.compareAndSet(coordinator, null);
                    return;
                } catch (RuntimeException | Error closeFailure) {
                    diagnostics.failure(CLOSE_FAILURE, closeFailure.getClass());
                }
                java.util.concurrent.locks.LockSupport.parkNanos(backoffNanos);
                backoffNanos = Math.min(maximumBackoffNanos, backoffNanos * 2L);
            }
        });
    }

    private static void runDaemonLateCleanup(String name, Runnable cleanup) {
        Thread owner = new Thread(cleanup, name);
        owner.setDaemon(true);
        owner.start();
    }

    private Throwable terminateStartupOwner() {
        java.time.Duration timeout = startupShutdownTimeout;
        if (startupLane instanceof SerialExecutionLane serialLane) {
            SerialExecutionLane.TerminationResult result = serialLane.terminateNow(timeout);
            if (result == SerialExecutionLane.TerminationResult.TERMINATED) {
                return null;
            }
            return new IllegalStateException(
                    "Startup execution lane did not terminate within its close budget: " + result);
        }
        CompletableFuture<Void> stopped = new CompletableFuture<>();
        Thread terminator = new Thread(() -> {
            try {
                startupLane.close();
                stopped.complete(null);
            } catch (RuntimeException | Error failure) {
                stopped.completeExceptionally(failure);
            }
        }, "salt-marcher-startup-termination");
        terminator.setDaemon(true);
        terminator.start();
        try {
            stopped.get(timeout.toNanos(), java.util.concurrent.TimeUnit.NANOSECONDS);
            return null;
        } catch (java.util.concurrent.TimeoutException timeoutFailure) {
            terminator.interrupt();
            return new IllegalStateException(
                    "Startup execution lane did not terminate within its close budget",
                    timeoutFailure);
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            terminator.interrupt();
            return new IllegalStateException("Interrupted while terminating startup execution", interrupted);
        } catch (java.util.concurrent.ExecutionException failure) {
            return failure.getCause();
        }
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

}
