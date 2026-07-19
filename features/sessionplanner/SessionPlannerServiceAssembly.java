package features.sessionplanner;

import features.encounter.api.EncounterApi;
import features.encounter.api.EncounterPlanBudgetModel;
import features.encounter.api.SavedEncounterPlanListModel;
import features.party.api.ActivePartyModel;
import features.party.api.AdventuringDayCalculationModel;
import features.party.api.PartyApi;
import features.sessiongeneration.api.SessionGenerationApi;
import features.sessionplanner.adapter.javafx.SessionPlannerContribution;
import features.sessionplanner.adapter.sqlite.repository.SqliteSessionPlanRepository;
import features.sessionplanner.api.PreparedSceneCatalogModel;
import features.sessionplanner.api.SessionPlannerApi;
import features.sessionplanner.api.SessionPlannerCatalogModel;
import features.sessionplanner.api.SessionPlannerCurrentSessionModel;
import features.sessionplanner.api.SessionPlannerParticipantsModel;
import features.sessionplanner.api.SessionPlannerSceneTimelineModel;
import features.sessionplanner.api.SessionPlannerStatePanelModel;
import features.sessionplanner.api.SessionPreparationModel;
import features.sessionplanner.application.SessionPlannerApplicationService;
import features.sessionplanner.application.SessionPlannerForeignFacts;
import features.sessionplanner.application.SessionPlannerProjection;
import features.sessionplanner.application.SessionPlannerPublishedState;
import features.sessionplanner.application.SessionPreparationCoordinator;
import features.sessionplanner.application.SessionPreparationPublishedState;
import features.sessionplanner.application.SessionPreparedSessionStore;
import features.sessionplanner.domain.session.repository.SessionPlanRepository;
import features.worldplanner.api.WorldPlannerSnapshotModel;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import platform.diagnostics.Diagnostics;
import platform.execution.ExecutionLane;
import platform.persistence.SqliteDatabase;
import platform.ui.UiDispatcher;
import shell.api.ShellContribution;

public final class SessionPlannerServiceAssembly {

    private final Runtime runtime;

    public static SessionPlannerServiceAssembly create(
            SqliteDatabase database,
            PartyApi party,
            ActivePartyModel activeParty,
            AdventuringDayCalculationModel dayCalculation,
            EncounterApi encounters,
            SavedEncounterPlanListModel savedPlans,
            EncounterPlanBudgetModel planBudget,
            @Nullable WorldPlannerSnapshotModel worldPlanner,
            SessionGenerationApi generation,
            ExecutionLane executionLane,
            UiDispatcher uiDispatcher,
            Diagnostics diagnostics
    ) {
        SqliteSessionPlanRepository repository = new SqliteSessionPlanRepository(
                Objects.requireNonNull(database, "database"));
        return new SessionPlannerServiceAssembly(
                repository, repository, party, activeParty, dayCalculation, encounters,
                savedPlans, planBudget, worldPlanner, generation, executionLane, uiDispatcher, diagnostics);
    }

    public SessionPlannerServiceAssembly(
            SessionPlanRepository repository,
            SessionPreparedSessionStore preparedSessions,
            PartyApi party,
            ActivePartyModel activeParty,
            AdventuringDayCalculationModel dayCalculation,
            EncounterApi encounters,
            SavedEncounterPlanListModel savedPlans,
            EncounterPlanBudgetModel planBudget,
            @Nullable WorldPlannerSnapshotModel worldPlanner,
            SessionGenerationApi generation,
            ExecutionLane executionLane,
            UiDispatcher uiDispatcher,
            Diagnostics diagnostics
    ) {
        SessionPlanRepository safeRepository = Objects.requireNonNull(repository, "repository");
        ExecutionLane safeExecutionLane = Objects.requireNonNull(executionLane, "executionLane");
        Diagnostics safeDiagnostics = Objects.requireNonNull(diagnostics, "diagnostics");
        UiDispatcher safeUiDispatcher = Objects.requireNonNull(uiDispatcher, "uiDispatcher");
        EncounterApi safeEncounters = Objects.requireNonNull(encounters, "encounters");
        SessionPlannerForeignFacts facts = new SessionPlannerForeignFacts(
                party, activeParty, dayCalculation, safeEncounters, savedPlans, planBudget, worldPlanner);
        SessionPlannerPublishedState publishedState = new SessionPlannerPublishedState(
                safeRepository, facts, new SessionPlannerProjection(), safeUiDispatcher);
        SessionPreparationPublishedState preparationState = new SessionPreparationPublishedState(safeUiDispatcher);
        SessionPreparationCoordinator coordinator = new SessionPreparationCoordinator(
                safeRepository,
                Objects.requireNonNull(preparedSessions, "preparedSessions"),
                facts,
                publishedState,
                preparationState,
                Objects.requireNonNull(generation, "generation"),
                safeEncounters,
                safeExecutionLane,
                safeDiagnostics);
        SessionPlannerApplicationService application = new SessionPlannerApplicationService(
                safeRepository, facts, publishedState, coordinator, safeExecutionLane, safeDiagnostics);
        facts.subscribeLocationRefresh(application::refreshForeignFacts);
        facts.subscribePartyRefresh(application::refreshPartyFacts);
        runtime = new Runtime(publishedState, preparationState, application);
    }

    public SessionPlannerApi application() {
        return runtime.applicationService();
    }

    public SessionPlannerCurrentSessionModel currentSessionModel() {
        return runtime.publishedState().currentSessionModel();
    }

    public SessionPlannerCatalogModel catalogModel() {
        return runtime.publishedState().catalogModel();
    }

    public SessionPlannerParticipantsModel participantsModel() {
        return runtime.publishedState().participantsModel();
    }

    public SessionPlannerSceneTimelineModel sceneTimelineModel() {
        return runtime.publishedState().sceneTimelineModel();
    }

    public SessionPlannerStatePanelModel statePanelModel() {
        return runtime.publishedState().statePanelModel();
    }

    public SessionPreparationModel preparationModel() {
        return runtime.preparationState().model();
    }

    public PreparedSceneCatalogModel preparedScenes() {
        return runtime.publishedState().preparedSceneCatalogModel();
    }

    public ShellContribution contribution() {
        return new SessionPlannerContribution(
                runtime.applicationService(), currentSessionModel(), catalogModel(), participantsModel(),
                sceneTimelineModel(), statePanelModel(), preparationModel());
    }

    private record Runtime(
            SessionPlannerPublishedState publishedState,
            SessionPreparationPublishedState preparationState,
            SessionPlannerApplicationService applicationService
    ) {
    }
}
