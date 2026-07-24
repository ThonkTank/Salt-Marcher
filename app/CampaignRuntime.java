package app;

import features.creatures.CreaturesServiceAssembly;
import features.creatures.api.RefreshCreatureReferenceIndexCommand;
import features.dungeon.DungeonFeature;
import features.encounter.EncounterServiceAssembly;
import features.encountertable.EncounterTableServiceAssembly;
import features.hex.HexServiceAssembly;
import features.items.ItemsServiceAssembly;
import features.party.PartyServiceAssembly;
import features.scene.SceneFeature;
import features.scene.api.SceneCommand;
import features.scene.api.SceneMutationResult;
import features.sessiongeneration.SessionGenerationServiceAssembly;
import features.sessiongeneration.api.SessionGenerationApi;
import features.sessionplanner.SessionPlannerServiceAssembly;
import features.travel.TravelFeature;
import features.worldplanner.WorldPlannerServiceAssembly;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Supplier;
import javafx.scene.Scene;
import javafx.scene.control.ToggleButton;
import javafx.scene.layout.Pane;
import platform.diagnostics.Diagnostics;
import platform.diagnostics.DiagnosticId;
import platform.execution.ExecutionLane;
import platform.execution.WorkflowAdmissionController;
import platform.persistence.FeatureStoreReadiness;
import platform.persistence.SqliteDatabase;
import platform.ui.UiDispatcher;
import shell.host.AppShell;

/**
 * One Campaign-owned persistence and feature-graph lifetime foundation.
 *
 * <p>The runtime owns no Campaign selection behavior and no shell nodes. It is the atomic unit a
 * later switch coordinator can prepare, qualify, activate, quiesce, and close.
 */
final class CampaignRuntime implements AutoCloseable {

    enum State {
        STARTING,
        FOUNDATION_PREPARED,
        PREPARED,
        ACTIVE,
        FAILED,
        QUIESCING,
        CLOSED
    }

    record FoundationReadiness(
            Map<String, FeatureStoreReadiness> stores,
            Set<String> coreRequiredStores,
            SceneMutationResult.Status sceneStatus,
            boolean encounterInitialized,
            boolean persistenceWriteRollbackVerified
    ) {
        FoundationReadiness {
            stores = Map.copyOf(Objects.requireNonNull(stores, "stores"));
            coreRequiredStores = Set.copyOf(
                    Objects.requireNonNull(coreRequiredStores, "coreRequiredStores"));
            sceneStatus = Objects.requireNonNull(sceneStatus, "sceneStatus");
        }

        boolean foundationPrepared() {
            return sceneStatus == SceneMutationResult.Status.SUCCESS
                    && encounterInitialized
                    && persistenceWriteRollbackVerified
                    && coreRequiredStores.stream()
                            .allMatch(owner -> stores.get(owner) == FeatureStoreReadiness.READY);
        }

        Map<String, FeatureStoreReadiness> degradedStores() {
            return stores.entrySet().stream()
                    .filter(entry -> entry.getValue() != FeatureStoreReadiness.READY)
                    .collect(java.util.stream.Collectors.toUnmodifiableMap(
                            Map.Entry::getKey, Map.Entry::getValue));
        }
    }

    record PreparedReadiness(
            FoundationReadiness foundation,
            PreparedShellFacts shell,
            SemanticSurvivorFacts survivors,
            boolean persistenceWriteRollbackVerified
    ) {
        PreparedReadiness {
            foundation = Objects.requireNonNull(foundation, "foundation");
            shell = Objects.requireNonNull(shell, "shell");
            survivors = Objects.requireNonNull(survivors, "survivors");
        }

        boolean ready() {
            return foundation.foundationPrepared()
                    && shell.ready()
                    && survivors.ready()
                    && persistenceWriteRollbackVerified;
        }
    }

    record SemanticSurvivorFacts(
            boolean focusedSceneReadable,
            boolean encounterStateReadable,
            boolean partyReadable,
            boolean travelPositionsReadable
    ) {
        boolean ready() {
            return focusedSceneReadable
                    && encounterStateReadable
                    && partyReadable
                    && travelPositionsReadable;
        }
    }

    record PreparedShellFacts(
            int navigationEntries,
            boolean requiredSceneJourneyPresent,
            boolean attachedToScene,
            boolean laidOut
    ) {
        boolean ready() {
            return navigationEntries > 0
                    && requiredSceneJourneyPresent
                    && attachedToScene
                    && laidOut;
        }
    }

    private static final Set<String> SUPPORTING_STORE_OWNERS =
            Set.of("dungeon", "hex", "session-generation");

    private final WorkflowAdmissionController admission;
    private final ExecutionLane persistenceProbeLane;
    private final java.util.concurrent.ExecutorService closureExecutor;
    private final SqliteDatabase database;
    private final Components components;
    private final CompletableFuture<FoundationReadiness> foundationReadiness =
            new CompletableFuture<>();
    private final CompletableFuture<PreparedReadiness> preparedReadiness = new CompletableFuture<>();
    private volatile FoundationReadiness preparedFoundation;
    private final CompletableFuture<Void> quiescence = new CompletableFuture<>();
    private final AtomicReference<State> state = new AtomicReference<>(State.STARTING);

    private CampaignRuntime(
            WorkflowAdmissionController admission,
            ExecutionLane persistenceProbeLane,
            SqliteDatabase database,
            Components components
    ) {
        this.admission = Objects.requireNonNull(admission, "admission");
        this.persistenceProbeLane = Objects.requireNonNull(persistenceProbeLane, "persistenceProbeLane");
        closureExecutor = java.util.concurrent.Executors.newSingleThreadExecutor(task ->
                new Thread(task, "salt-marcher-campaign-closure"));
        this.database = Objects.requireNonNull(database, "database");
        this.components = Objects.requireNonNull(components, "components");
    }

    static CampaignRuntime open(
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
            InstallationRuntime.SharedReferences sharedReferences,
            SqliteDatabase database
    ) {
        Diagnostics safeDiagnostics = Objects.requireNonNull(diagnostics, "diagnostics");
        ExecutionLane safeExecutionLane = Objects.requireNonNull(executionLane, "executionLane");
        List<ExecutionLane> supportingLanes = List.of(
                Objects.requireNonNull(creatureReadLane, "creatureReadLane"),
                Objects.requireNonNull(itemReadLane, "itemReadLane"),
                Objects.requireNonNull(sessionGenerationCpuLane, "sessionGenerationCpuLane"),
                Objects.requireNonNull(sessionGenerationIoLane, "sessionGenerationIoLane"),
                Objects.requireNonNull(encounterGeneratedCpuLane, "encounterGeneratedCpuLane"),
                Objects.requireNonNull(encounterGeneratedIoLane, "encounterGeneratedIoLane"),
                Objects.requireNonNull(sessionPreparationCpuLane, "sessionPreparationCpuLane"),
                Objects.requireNonNull(sessionPreparationIoLane, "sessionPreparationIoLane"));
        UiDispatcher safeUiDispatcher = Objects.requireNonNull(uiDispatcher, "uiDispatcher");
        InstallationRuntime.SharedReferences safeSharedReferences =
                Objects.requireNonNull(sharedReferences, "sharedReferences");
        SqliteDatabase safeDatabase = Objects.requireNonNull(database, "database");

        CampaignRuntime runtime = null;
        WorkflowAdmissionController admission = null;
        try {
            CampaignStoreManifest.Stores stores = CampaignStoreManifest.register(safeDatabase);
            Map<String, FeatureStoreReadiness> storeReadiness = safeDatabase.prepareRegisteredStores();
            Set<String> coreRequiredStores = requireReadyStores(stores, storeReadiness);
            admission = new WorkflowAdmissionController();
            ExecutionLane admittedExecutionLane = admission.admit(safeExecutionLane);
            ExecutionLane admittedCreatureReadLane = admission.admit(creatureReadLane);
            ExecutionLane admittedItemReadLane = admission.admit(itemReadLane);
            ExecutionLane admittedSessionGenerationCpuLane = admission.admit(sessionGenerationCpuLane);
            ExecutionLane admittedSessionGenerationIoLane = admission.admit(sessionGenerationIoLane);
            ExecutionLane admittedEncounterGeneratedCpuLane = admission.admit(encounterGeneratedCpuLane);
            ExecutionLane admittedEncounterGeneratedIoLane = admission.admit(encounterGeneratedIoLane);
            ExecutionLane admittedSessionPreparationCpuLane = admission.admit(sessionPreparationCpuLane);
            ExecutionLane admittedSessionPreparationIoLane = admission.admit(sessionPreparationIoLane);
            Components components = createComponents(
                    stores,
                    storeReadiness,
                    safeSharedReferences,
                    safeDiagnostics,
                    admittedExecutionLane,
                    admittedCreatureReadLane,
                    admittedItemReadLane,
                    admittedSessionGenerationCpuLane,
                    admittedSessionGenerationIoLane,
                    admittedEncounterGeneratedCpuLane,
                    admittedEncounterGeneratedIoLane,
                    admittedSessionPreparationCpuLane,
                    admittedSessionPreparationIoLane,
                    safeUiDispatcher);
            runtime = new CampaignRuntime(
                    admission, admittedSessionPreparationIoLane, safeDatabase, components);
            runtime.start(storeReadiness, coreRequiredStores, safeDiagnostics);
            return runtime;
        } catch (RuntimeException | Error failure) {
            if (runtime != null) {
                try {
                    runtime.close();
                } catch (RuntimeException | Error closeFailure) {
                    failure.addSuppressed(closeFailure);
                }
            } else if (admission != null) {
                Throwable cleanupFailure = null;
                try {
                    admission.revokeAndDrain().toCompletableFuture().join();
                } catch (RuntimeException | Error closeFailure) {
                    cleanupFailure = accumulate(cleanupFailure, closeFailure);
                }
                try {
                    admission.closeDelegatesAfterDrain();
                } catch (RuntimeException | Error closeFailure) {
                    cleanupFailure = accumulate(cleanupFailure, closeFailure);
                }
                try {
                    safeDatabase.close();
                } catch (RuntimeException | Error closeFailure) {
                    cleanupFailure = accumulate(cleanupFailure, closeFailure);
                }
                if (cleanupFailure != null) {
                    failure.addSuppressed(cleanupFailure);
                }
            } else {
                closeOwnedResources(safeExecutionLane, supportingLanes, safeDatabase, failure);
            }
            throw failure;
        }
    }

    private static Set<String> requireReadyStores(
            CampaignStoreManifest.Stores stores,
            Map<String, FeatureStoreReadiness> readiness
    ) {
        Map<String, FeatureStoreReadiness> safeReadiness = Map.copyOf(
                Objects.requireNonNull(readiness, "readiness"));
        Set<String> coreRequiredStores = new java.util.LinkedHashSet<>(stores.owners());
        coreRequiredStores.removeAll(SUPPORTING_STORE_OWNERS);
        if (!safeReadiness.keySet().equals(stores.owners())
                || coreRequiredStores.stream()
                        .anyMatch(owner -> safeReadiness.get(owner) != FeatureStoreReadiness.READY)) {
            throw new StorePreparationException(safeReadiness);
        }
        return Set.copyOf(coreRequiredStores);
    }

    static final class StorePreparationException extends IllegalStateException {

        private final Map<String, FeatureStoreReadiness> readiness;

        private StorePreparationException(Map<String, FeatureStoreReadiness> readiness) {
            super("Campaign runtime core storage is not ready");
            this.readiness = Map.copyOf(readiness);
        }

        Map<String, FeatureStoreReadiness> readiness() {
            return readiness;
        }
    }

    private void start(
            Map<String, FeatureStoreReadiness> storeReadiness,
            Set<String> coreRequiredStores,
            Diagnostics diagnostics
    ) {
        CompletionStage<StartupResult> startupReady = components.start(storeReadiness)
                .thenCompose(this::verifyPersistenceWriteRollbackOffUi);
        startupReady.whenComplete((result, failure) -> {
            if (failure != null) {
                state.compareAndSet(State.STARTING, State.FAILED);
                foundationReadiness.completeExceptionally(failure);
                preparedReadiness.completeExceptionally(failure);
                return;
            }
            FoundationReadiness completed =
                    new FoundationReadiness(
                            storeReadiness, coreRequiredStores,
                            result.scene().status(), result.encounterInitialized(),
                            result.persistenceWriteRollbackVerified());
            completed.degradedStores().forEach((owner, readiness) -> diagnostics.failure(
                    new DiagnosticId("campaign-runtime.store-degraded."
                            + owner + "." + readiness.name()
                                    .toLowerCase(java.util.Locale.ROOT)
                                    .replace('_', '-')),
                    SupportingStoreDegradedException.class));
            preparedFoundation = completed;
            if (!completed.foundationPrepared()) {
                state.compareAndSet(State.STARTING, State.FAILED);
                foundationReadiness.complete(completed);
                preparedReadiness.completeExceptionally(
                        new IllegalStateException("Campaign foundation preparation was rejected: " + completed));
                return;
            }
            admission.pauseAndDrain().whenComplete((ignored, drainFailure) -> {
                if (drainFailure != null) {
                    state.compareAndSet(State.STARTING, State.FAILED);
                    foundationReadiness.completeExceptionally(drainFailure);
                    preparedReadiness.completeExceptionally(drainFailure);
                    return;
                }
                state.compareAndSet(State.STARTING, State.FOUNDATION_PREPARED);
                foundationReadiness.complete(completed);
            });
        });
    }

    private CompletionStage<StartupResult> verifyPersistenceWriteRollbackOffUi(StartupResult startup) {
        CompletableFuture<StartupResult> verified = new CompletableFuture<>();
        try {
            persistenceProbeLane.execute(() -> {
                try {
                    database.verifyTransactionalWriteRollback();
                    verified.complete(new StartupResult(
                            startup.encounterInitialized(), startup.scene(), true));
                } catch (java.sql.SQLException failure) {
                    verified.completeExceptionally(failure);
                }
            });
        } catch (RuntimeException | Error failure) {
            verified.completeExceptionally(failure);
        }
        return verified;
    }

    /**
     * Storage preparation, typed Encounter and Scene initialization, and a rolled-back write probe.
     *
     * <p>This remains narrower than Campaign core readiness: survivor journeys, safe rendering, and
     * visible shell publication remain the switch coordinator's gate.
     */
    CompletionStage<FoundationReadiness> foundationReadiness() {
        return foundationReadiness;
    }

    CompletionStage<PreparedReadiness> preparedReadiness() {
        return preparedReadiness;
    }

    <T> CandidatePreparation<T> prepareCandidate(Supplier<T> preparation) {
        WorkflowAdmissionController.AcceptedResult<T> accepted = admission.runWhilePaused(preparation);
        return new CandidatePreparation<>(accepted.value(), accepted.drained());
    }

    record CandidatePreparation<T>(T value, CompletionStage<Void> drained) {
        CandidatePreparation {
            value = Objects.requireNonNull(value, "value");
            drained = Objects.requireNonNull(drained, "drained");
        }
    }

    PreparedReadiness prepareBoundShell(AppShell shell, Scene candidateScene) {
        FoundationReadiness foundation = preparedFoundation;
        if (foundation == null) {
            throw new IllegalStateException("Campaign foundation is not prepared");
        }
        AppShell safeShell = Objects.requireNonNull(shell, "shell");
        Scene safeScene = Objects.requireNonNull(candidateScene, "candidateScene");
        Pane navigation = safeShell.lookup(".nav-sidebar") instanceof Pane pane ? pane : null;
        int navigationEntries = navigation == null ? 0 : (int) navigation.getChildrenUnmodifiable().stream()
                .filter(ToggleButton.class::isInstance)
                .count();
        boolean sceneJourney = navigation != null && navigation.getChildrenUnmodifiable().stream()
                .filter(ToggleButton.class::isInstance)
                .map(ToggleButton.class::cast)
                .anyMatch(button -> "Szenen".equals(button.getAccessibleText()));
        PreparedShellFacts facts = new PreparedShellFacts(
                navigationEntries,
                sceneJourney,
                safeShell.getScene() == safeScene && safeScene.getRoot() == safeShell,
                safeScene.getWidth() > 0 && safeScene.getHeight() > 0
                        && safeShell.getLayoutBounds().getWidth() > 0
                        && safeShell.getLayoutBounds().getHeight() > 0);
        SemanticSurvivorFacts survivors = new SemanticSurvivorFacts(
                components.scene().model().current().focusedSceneId() > 0L,
                foundation.encounterInitialized(),
                components.party().activeParty().current().status()
                        == features.party.api.ReadStatus.SUCCESS,
                components.party().travelPositions().current().status()
                        == features.party.api.ReadStatus.SUCCESS);
        boolean writeRollbackVerified = foundation.persistenceWriteRollbackVerified();
        PreparedReadiness completed = new PreparedReadiness(
                foundation, facts, survivors, writeRollbackVerified);
        if (!completed.ready() || !state.compareAndSet(State.FOUNDATION_PREPARED, State.PREPARED)) {
            IllegalStateException rejection = new IllegalStateException(
                    "Campaign prepared-shell qualification failed: state="
                            + state.get() + ", foundation=" + foundation + ", facts=" + facts
                            + ", survivors=" + survivors
                            + ", persistenceWriteRollbackVerified=" + writeRollbackVerified);
            state.compareAndSet(State.FOUNDATION_PREPARED, State.FAILED);
            preparedReadiness.completeExceptionally(rejection);
            throw rejection;
        }
        preparedReadiness.complete(completed);
        return completed;
    }

    void activatePublishedShell(AppShell shell) {
        AppShell safeShell = Objects.requireNonNull(shell, "shell");
        if (safeShell.getScene() == null
                || safeShell.getScene().getWindow() == null
                || !safeShell.getScene().getWindow().isShowing()) {
            throw new IllegalStateException("Campaign shell was not visibly published from PREPARED state");
        }
        admission.resumeWith(() -> {
            if (!state.compareAndSet(State.PREPARED, State.ACTIVE)) {
                throw new IllegalStateException("Campaign shell was not in PREPARED state");
            }
        });
    }

    private static final class SupportingStoreDegradedException extends IllegalStateException {
    }

    CompletionStage<Void> quiescence() {
        return quiescence;
    }

    State state() {
        return state.get();
    }

    Components components() {
        State current = state.get();
        if (current != State.FOUNDATION_PREPARED
                && current != State.PREPARED
                && current != State.ACTIVE) {
            throw new IllegalStateException(
                    "Campaign runtime components are not foundation-ready: " + current);
        }
        return components;
    }

    CompletionStage<Void> pauseAndDrain() {
        return admission.pauseAndDrain();
    }

    void resumeAdmission() {
        if (state.get() != State.ACTIVE) {
            throw new IllegalStateException("Only an ACTIVE Campaign can resume after a reversible pause");
        }
        admission.resume();
    }

    CompletionStage<Void> quiesceAsync() {
        State prior = state.getAndUpdate(current ->
                current == State.CLOSED || current == State.QUIESCING ? current : State.QUIESCING);
        if (prior == State.CLOSED || prior == State.QUIESCING) {
            return quiescence;
        }

        IllegalStateException closedBeforeReady =
                new IllegalStateException("Campaign runtime closed before readiness completed");
        foundationReadiness.completeExceptionally(closedBeforeReady);
        preparedReadiness.completeExceptionally(closedBeforeReady);
        admission.revokeAndDrain().whenComplete((ignored, drainFailure) ->
                closureExecutor.execute(() -> {
                    Throwable failure = drainFailure;
                    failure = components.close(failure);
                    try {
                        admission.closeDelegatesAfterDrain();
                    } catch (RuntimeException | Error closeFailure) {
                        failure = accumulate(failure, closeFailure);
                    }
                    try {
                        database.close();
                    } catch (RuntimeException | Error databaseFailure) {
                        failure = accumulate(failure, databaseFailure);
                    }
                    state.set(State.CLOSED);
                    if (failure == null) {
                        quiescence.complete(null);
                    } else {
                        quiescence.completeExceptionally(failure);
                    }
                    closureExecutor.shutdown();
                }));
        return quiescence;
    }

    void quiesce() {
        quiesceAsync().toCompletableFuture().join();
    }

    @Override
    public void close() {
        quiesce();
    }

    static Throwable closeOwnedResources(
            ExecutionLane executionLane,
            List<ExecutionLane> supportingLanes,
            SqliteDatabase database,
            Throwable initialFailure
    ) {
        Throwable failure = initialFailure;
        Set<ExecutionLane> closed = Collections.newSetFromMap(new IdentityHashMap<>());
        failure = closeLane(executionLane, closed, failure);
        for (ExecutionLane lane : supportingLanes) {
            failure = closeLane(lane, closed, failure);
        }
        try {
            database.close();
        } catch (RuntimeException | Error databaseFailure) {
            failure = accumulate(failure, databaseFailure);
        }
        return failure;
    }

    private static Throwable closeLane(
            ExecutionLane lane,
            Set<ExecutionLane> closed,
            Throwable failure
    ) {
        if (!closed.add(lane)) {
            return failure;
        }
        try {
            lane.close();
        } catch (RuntimeException | Error laneFailure) {
            return accumulate(failure, laneFailure);
        }
        return failure;
    }

    private static Throwable accumulate(Throwable current, Throwable next) {
        if (current == null) {
            return next;
        }
        current.addSuppressed(next);
        return current;
    }

    private static Components createComponents(
            CampaignStoreManifest.Stores stores,
            Map<String, FeatureStoreReadiness> storeReadiness,
            InstallationRuntime.SharedReferences sharedReferences,
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
            UiDispatcher uiDispatcher
    ) {
        CreaturesServiceAssembly.Component creatures = CreaturesServiceAssembly.create(
                sharedReferences.creatures(), executionLane, creatureReadLane,
                sessionPreparationIoLane, uiDispatcher, diagnostics);
        EncounterTableServiceAssembly.Component encounterTables = EncounterTableServiceAssembly.create(
                stores.encounterTables(), executionLane, uiDispatcher, diagnostics);
        PartyServiceAssembly.Component party = PartyServiceAssembly.create(
                stores.party(), executionLane, sessionPreparationIoLane, uiDispatcher, diagnostics);
        ItemsServiceAssembly.CatalogComponent items = ItemsServiceAssembly.createCatalog(
                sharedReferences.items(), itemReadLane, diagnostics);
        WorldPlannerServiceAssembly.Component world = WorldPlannerServiceAssembly.create(
                stores.worldPlanner(), creatures.references(), encounterTables.references(),
                executionLane, uiDispatcher, diagnostics);
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
        DungeonFeature.Component dungeon = storeReadiness.get("dungeon") == FeatureStoreReadiness.READY
                ? DungeonFeature.create(
                        stores.dungeon(), party.application(), executionLane, uiDispatcher, diagnostics)
                : null;
        HexServiceAssembly.Component hex = storeReadiness.get("hex") == FeatureStoreReadiness.READY
                ? HexServiceAssembly.create(
                        stores.hex(), party.travelPositions(), party.application(),
                        executionLane, uiDispatcher, diagnostics)
                : null;
        TravelFeature.Component travel = dungeon != null && hex != null
                ? TravelFeature.create(
                        party.travelPositions(), dungeon.travelContext(), hex.travelModel(), uiDispatcher)
                : null;
        SessionGenerationApi generation =
                storeReadiness.get("session-generation") == FeatureStoreReadiness.READY
                        ? SessionGenerationServiceAssembly.create(
                                stores.sessionGeneration(), sessionGenerationCpuLane,
                                sessionGenerationIoLane, diagnostics)
                        : SessionGenerationServiceAssembly.unavailable();
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
                creatures, encounterTables, party, items, world, encounter, dungeon, hex, travel,
                generation, session, scene);
    }

    record Components(
            CreaturesServiceAssembly.Component creatures,
            EncounterTableServiceAssembly.Component encounterTables,
            PartyServiceAssembly.Component party,
            ItemsServiceAssembly.CatalogComponent items,
            WorldPlannerServiceAssembly.Component world,
            EncounterServiceAssembly.Component encounter,
            DungeonFeature.Component dungeon,
            HexServiceAssembly.Component hex,
            TravelFeature.Component travel,
            SessionGenerationApi generation,
            SessionPlannerServiceAssembly session,
            SceneFeature.Component scene
    ) {
        private CompletionStage<StartupResult> start(
                Map<String, FeatureStoreReadiness> storeReadiness
        ) {
            creatures.application().refreshReferenceIndex(new RefreshCreatureReferenceIndexCommand());
            PartyServiceAssembly.start(party);
            world.start();
            CompletionStage<Void> encounterReady = encounter.start();
            if (dungeon != null) {
                dungeon.start();
            }
            if (hex != null) {
                hex.start();
            }
            if (travel != null) {
                travel.start();
            }
            CompletionStage<SceneMutationResult> sceneReady =
                    scene.application().execute(new SceneCommand.Initialize());
            return encounterReady.thenCombine(
                    sceneReady, (ignored, sceneResult) -> new StartupResult(true, sceneResult, false));
        }

        private Throwable close(Throwable initialFailure) {
            Throwable failure = initialFailure;
            java.util.ArrayList<AutoCloseable> closeableComponents = new java.util.ArrayList<>();
            closeableComponents.add(scene);
            closeableComponents.add(session);
            if (travel != null) {
                closeableComponents.add(travel);
            }
            if (hex != null) {
                closeableComponents.add(hex);
            }
            for (AutoCloseable component : closeableComponents) {
                try {
                    component.close();
                } catch (RuntimeException | Error closeFailure) {
                    failure = accumulate(failure, closeFailure);
                } catch (Exception closeFailure) {
                    failure = accumulate(failure, closeFailure);
                }
            }
            return failure;
        }
    }

    private record StartupResult(
            boolean encounterInitialized,
            SceneMutationResult scene,
            boolean persistenceWriteRollbackVerified
    ) {
        private StartupResult {
            scene = Objects.requireNonNull(scene, "scene");
        }
    }
}
