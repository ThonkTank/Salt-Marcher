package features.sessionplanner;

import features.encounter.api.EncounterApi;
import features.encounter.api.SavedEncounterPlanListModel;
import features.party.api.PartyApi;
import features.sessiongeneration.api.SessionGenerationApi;
import features.sessionplanner.adapter.javafx.SessionPlannerContribution;
import features.sessionplanner.adapter.javafx.SessionPlannerWorkspaceApplyObservation;
import features.sessionplanner.adapter.sqlite.repository.SqliteSessionPlanRepository;
import features.sessionplanner.api.PreparedSceneCatalogModel;
import features.sessionplanner.api.SessionPlannerApi;
import features.sessionplanner.api.SessionPlannerWorkspaceModel;
import features.sessionplanner.application.SessionPlannerApplicationService;
import features.sessionplanner.application.SessionPlannerWorkspaceAssembler;
import features.sessionplanner.application.SessionPlannerWorkspacePublicationCoordinator;
import features.sessionplanner.application.SessionPlannerWorkspaceSource;
import features.sessionplanner.application.SessionPreparationCoordinator;
import features.sessionplanner.application.SessionPreparedSessionStore;
import features.sessionplanner.domain.session.repository.SessionPlanRepository;
import features.worldplanner.api.WorldPlannerSnapshotModel;
import org.jspecify.annotations.Nullable;
import platform.diagnostics.Diagnostics;
import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Measurement;
import platform.execution.ExecutionLane;
import platform.execution.RetryableRelease;
import platform.persistence.FeatureStoreDefinition;
import platform.persistence.FeatureStoreHandle;
import platform.ui.UiDispatcher;
import shell.api.ShellContribution;

import java.util.Objects;

public final class SessionPlannerServiceAssembly implements AutoCloseable {

    private static final DiagnosticId JAVAFX_APPLY =
            new DiagnosticId("sessionplanner.javafx.workspace-apply");
    private static final String GENERATION_UNAVAILABLE_MESSAGE =
            "Automatische Generierung ist nicht verfügbar; manuelle Session-Planung bleibt möglich.";

    private final Runtime runtime;
    private final Diagnostics diagnostics;
    private final SessionGenerationApi generation;
    private final java.util.List<java.util.function.Supplier<Runnable>> foreignSubscriptionSources;
    private final java.util.List<Runnable> foreignSubscriptions = new java.util.ArrayList<>();
    private int nextForeignSubscription;
    private volatile boolean closing;
    private boolean closed;

    public static FeatureStoreDefinition storeDefinition() {
        return SqliteSessionPlanRepository.storeDefinition();
    }

    public static SessionPlannerServiceAssembly create(
            FeatureStoreHandle store,
            PartyApi party,
            EncounterApi encounters,
            SavedEncounterPlanListModel savedPlans,
            @Nullable WorldPlannerSnapshotModel worldPlanner,
            SessionGenerationApi generation,
            ExecutionLane authoredExecutionLane,
            ExecutionLane preparationCpuLane,
            ExecutionLane preparationIoLane,
            UiDispatcher uiDispatcher,
            Diagnostics diagnostics
    ) {
        SqliteSessionPlanRepository repository = new SqliteSessionPlanRepository(store);
        return new SessionPlannerServiceAssembly(
                repository, repository, repository, party, encounters, savedPlans, worldPlanner,
                generation, authoredExecutionLane, preparationCpuLane, preparationIoLane,
                uiDispatcher, diagnostics);
    }

    public SessionPlannerServiceAssembly(
            SessionPlanRepository repository,
            SessionPlannerWorkspaceSource workspaceSource,
            SessionPreparedSessionStore preparedSessions,
            PartyApi party,
            EncounterApi encounters,
            SavedEncounterPlanListModel savedPlans,
            @Nullable WorldPlannerSnapshotModel worldPlanner,
            SessionGenerationApi generation,
            ExecutionLane authoredExecutionLane,
            ExecutionLane preparationCpuLane,
            ExecutionLane preparationIoLane,
            UiDispatcher uiDispatcher,
            Diagnostics diagnostics
    ) {
        SessionPlanRepository safeRepository = Objects.requireNonNull(repository, "repository");
        PartyApi safeParty = Objects.requireNonNull(party, "party");
        EncounterApi safeEncounters = Objects.requireNonNull(encounters, "encounters");
        SavedEncounterPlanListModel safeSavedPlans = Objects.requireNonNull(savedPlans, "savedPlans");
        ExecutionLane authoredLane = Objects.requireNonNull(authoredExecutionLane, "authoredExecutionLane");
        ExecutionLane cpuLane = Objects.requireNonNull(preparationCpuLane, "preparationCpuLane");
        ExecutionLane ioLane = Objects.requireNonNull(preparationIoLane, "preparationIoLane");
        this.diagnostics = Objects.requireNonNull(diagnostics, "diagnostics");
        this.generation = Objects.requireNonNull(generation, "generation");
        SessionPlannerWorkspaceAssembler assembler = new SessionPlannerWorkspaceAssembler(
                Objects.requireNonNull(workspaceSource, "workspaceSource"), safeParty, safeEncounters,
                this.generation, worldPlanner, ioLane, diagnostics);
        SessionPlannerWorkspacePublicationCoordinator publication =
                new SessionPlannerWorkspacePublicationCoordinator(
                        assembler, safeEncounters, Objects.requireNonNull(uiDispatcher, "uiDispatcher"),
                        diagnostics);
        SessionPreparationCoordinator preparation = new SessionPreparationCoordinator(
                safeRepository,
                Objects.requireNonNull(preparedSessions, "preparedSessions"),
                safeParty,
                publication,
                this.generation,
                safeEncounters,
                cpuLane,
                ioLane,
                authoredLane,
                diagnostics);
        SessionPlannerApplicationService application = new SessionPlannerApplicationService(
                safeRepository, publication, preparation, authoredLane, diagnostics);
        runtime = new Runtime(publication, application);
        java.util.ArrayList<java.util.function.Supplier<Runnable>> subscriptionSources =
                new java.util.ArrayList<>();
        subscriptionSources.add(() -> safeParty.activeParty().subscribe(
                ignored -> runWhileOpen(application::refreshPartyFacts)));
        subscriptionSources.add(() -> safeSavedPlans.subscribe(
                ignored -> runWhileOpen(application::refreshForeignFacts)));
        if (worldPlanner != null) {
            subscriptionSources.add(() -> worldPlanner.subscribe(
                    ignored -> runWhileOpen(application::refreshForeignFacts)));
        }
        foreignSubscriptionSources = java.util.List.copyOf(subscriptionSources);
    }

    /**
     * Acquires foreign observation handles after the complete Campaign component graph owns this assembly.
     * A retry resumes at the first acquisition that did not return a handle.
     */
    public synchronized void start() {
        if (closing || closed) {
            throw new IllegalStateException("Session Planner is closing or closed");
        }
        while (nextForeignSubscription < foreignSubscriptionSources.size()) {
            Runnable release = Objects.requireNonNull(
                    foreignSubscriptionSources.get(nextForeignSubscription).get(),
                    "foreign subscription release");
            foreignSubscriptions.add(release);
            nextForeignSubscription++;
        }
    }

    public SessionPlannerApi application() {
        return runtime.applicationService();
    }

    public SessionPlannerWorkspaceModel workspaceModel() {
        return runtime.publication().model();
    }

    public PreparedSceneCatalogModel preparedScenes() {
        return runtime.publication().preparedScenes();
    }

    public ShellContribution contribution() {
        return contribution(ignored -> { });
    }

    public ShellContribution contribution(
            java.util.function.Consumer<SessionPlannerWorkspaceApplyObservation> observer
    ) {
        java.util.function.Consumer<SessionPlannerWorkspaceApplyObservation> safeObserver =
                Objects.requireNonNull(observer, "observer");
        return new SessionPlannerContribution(
                runtime.applicationService(), workspaceModel(),
                generation.available(),
                generation.available() ? "" : GENERATION_UNAVAILABLE_MESSAGE,
                observation -> {
            diagnostics.measurement(new Measurement(
                    JAVAFX_APPLY,
                    observation.snapshot().preparation().attemptId(),
                    observation.durationNanos(),
                    observation.materializedUnitCount(),
                    0));
            safeObserver.accept(observation);
                });
    }

    private void runWhileOpen(Runnable callback) {
        if (!closing && !closed) {
            callback.run();
        }
    }

    @Override
    public synchronized void close() {
        if (closed) {
            return;
        }
        closing = true;
        RetryableRelease.releaseAll(foreignSubscriptions);
        closed = true;
    }

    private record Runtime(
            SessionPlannerWorkspacePublicationCoordinator publication,
            SessionPlannerApplicationService applicationService
    ) {
    }
}
