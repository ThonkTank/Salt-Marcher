package features.sessionplanner;

import features.encounter.api.EncounterApi;
import features.encounter.api.SavedEncounterPlanListModel;
import features.party.api.PartyApi;
import features.sessiongeneration.api.SessionGenerationApi;
import features.sessionplanner.adapter.javafx.SessionPlannerContribution;
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
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import platform.diagnostics.Diagnostics;
import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Measurement;
import platform.execution.ExecutionLane;
import platform.persistence.SqliteDatabase;
import platform.ui.UiDispatcher;
import shell.api.ShellContribution;

public final class SessionPlannerServiceAssembly {

    private static final DiagnosticId JAVAFX_APPLY =
            new DiagnosticId("sessionplanner.javafx.workspace-apply");

    private final Runtime runtime;
    private final Diagnostics diagnostics;

    public static SessionPlannerServiceAssembly create(
            SqliteDatabase database,
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
        SqliteSessionPlanRepository repository = new SqliteSessionPlanRepository(
                Objects.requireNonNull(database, "database"));
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
        SessionPlannerWorkspaceAssembler assembler = new SessionPlannerWorkspaceAssembler(
                Objects.requireNonNull(workspaceSource, "workspaceSource"), safeParty, safeEncounters,
                Objects.requireNonNull(generation, "generation"), worldPlanner, ioLane, diagnostics);
        SessionPlannerWorkspacePublicationCoordinator publication =
                new SessionPlannerWorkspacePublicationCoordinator(
                        assembler, safeEncounters, Objects.requireNonNull(uiDispatcher, "uiDispatcher"),
                        diagnostics);
        SessionPreparationCoordinator preparation = new SessionPreparationCoordinator(
                safeRepository,
                Objects.requireNonNull(preparedSessions, "preparedSessions"),
                safeParty,
                publication,
                generation,
                safeEncounters,
                cpuLane,
                ioLane,
                diagnostics);
        SessionPlannerApplicationService application = new SessionPlannerApplicationService(
                safeRepository, publication, preparation, authoredLane, diagnostics);
        safeParty.activeParty().subscribe(ignored -> application.refreshPartyFacts());
        safeSavedPlans.subscribe(ignored -> application.refreshForeignFacts());
        if (worldPlanner != null) {
            worldPlanner.subscribe(ignored -> application.refreshForeignFacts());
        }
        runtime = new Runtime(publication, application);
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
        return new SessionPlannerContribution(runtime.applicationService(), workspaceModel(), durationNanos ->
                diagnostics.measurement(new Measurement(
                        JAVAFX_APPLY,
                        runtime.publication().current().preparation().attemptId(),
                        durationNanos,
                        1,
                        0)));
    }

    private record Runtime(
            SessionPlannerWorkspacePublicationCoordinator publication,
            SessionPlannerApplicationService applicationService
    ) {
    }
}
