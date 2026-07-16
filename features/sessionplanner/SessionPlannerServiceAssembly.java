package features.sessionplanner;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import platform.diagnostics.Diagnostics;
import platform.diagnostics.NoopDiagnostics;
import platform.execution.DirectExecutionLane;
import platform.execution.ExecutionLane;
import platform.persistence.SqliteDatabase;
import platform.ui.DirectUiDispatcher;
import platform.ui.UiDispatcher;
import shell.api.ShellContribution;
import features.encounter.api.EncounterApi;
import features.encounter.api.EncounterPlanBudgetModel;
import features.encounter.api.SavedEncounterPlanListModel;
import features.party.api.PartyApi;
import features.party.api.ActivePartyModel;
import features.party.api.AdventuringDayCalculationModel;
import features.sessionplanner.domain.session.repository.SessionPlanRepository;
import features.sessionplanner.adapter.javafx.SessionPlannerContribution;
import features.sessionplanner.adapter.sqlite.repository.SqliteSessionPlanRepository;
import features.sessionplanner.api.SessionPlannerApi;
import features.sessionplanner.api.SessionPlannerCatalogModel;
import features.sessionplanner.api.SessionPlannerCurrentSessionModel;
import features.sessionplanner.api.SessionPlannerParticipantsModel;
import features.sessionplanner.api.SessionPlannerSceneTimelineModel;
import features.sessionplanner.api.SessionPlannerStatePanelModel;
import features.worldplanner.api.WorldPlannerSnapshotModel;
import features.sessionplanner.application.SessionPlannerApplicationService;
import features.sessionplanner.application.SessionPlannerForeignFacts;
import features.sessionplanner.application.SessionPlannerProjection;
import features.sessionplanner.application.SessionPlannerPublishedState;

public final class SessionPlannerServiceAssembly {

    private final Runtime runtime;

    public SessionPlannerServiceAssembly(
            SessionPlanRepository repository,
            PartyApi party,
            ActivePartyModel activeParty,
            AdventuringDayCalculationModel dayCalculation,
            EncounterApi encounters,
            SavedEncounterPlanListModel savedPlans,
            EncounterPlanBudgetModel planBudget,
            @Nullable WorldPlannerSnapshotModel worldPlanner
    ) {
        this(repository, party, activeParty, dayCalculation, encounters, savedPlans, planBudget, worldPlanner,
                DirectExecutionLane.INSTANCE, DirectUiDispatcher.INSTANCE, NoopDiagnostics.INSTANCE);
    }

    public static SessionPlannerServiceAssembly create(
            SqliteDatabase database,
            PartyApi party,
            ActivePartyModel activeParty,
            AdventuringDayCalculationModel dayCalculation,
            EncounterApi encounters,
            SavedEncounterPlanListModel savedPlans,
            EncounterPlanBudgetModel planBudget,
            @Nullable WorldPlannerSnapshotModel worldPlanner,
            ExecutionLane executionLane,
            UiDispatcher uiDispatcher,
            Diagnostics diagnostics
    ) {
        return new SessionPlannerServiceAssembly(
                new SqliteSessionPlanRepository(Objects.requireNonNull(database, "database")),
                party,
                activeParty,
                dayCalculation,
                encounters,
                savedPlans,
                planBudget,
                worldPlanner,
                executionLane,
                uiDispatcher,
                diagnostics);
    }

    public SessionPlannerServiceAssembly(
            SessionPlanRepository repository,
            PartyApi party,
            ActivePartyModel activeParty,
            AdventuringDayCalculationModel dayCalculation,
            EncounterApi encounters,
            SavedEncounterPlanListModel savedPlans,
            EncounterPlanBudgetModel planBudget,
            @Nullable WorldPlannerSnapshotModel worldPlanner,
            ExecutionLane executionLane,
            UiDispatcher uiDispatcher,
            Diagnostics diagnostics
    ) {
        SessionPlanRepository safeRepository = Objects.requireNonNull(repository, "repository");
        SessionPlannerForeignFacts facts = new SessionPlannerForeignFacts(
                party, activeParty, dayCalculation, encounters, savedPlans, planBudget, worldPlanner);
        SessionPlannerPublishedState publishedState =
                new SessionPlannerPublishedState(
                        safeRepository,
                        facts,
                        new SessionPlannerProjection(),
                        Objects.requireNonNull(uiDispatcher, "uiDispatcher"));
        SessionPlannerApplicationService application = new SessionPlannerApplicationService(
                safeRepository,
                facts,
                publishedState,
                Objects.requireNonNull(executionLane, "executionLane"),
                Objects.requireNonNull(diagnostics, "diagnostics"));
        facts.subscribeLocationRefresh(application::refreshForeignFacts);
        runtime = new Runtime(
                publishedState,
                application);
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

    public ShellContribution contribution() {
        return new SessionPlannerContribution(
                runtime.applicationService(),
                currentSessionModel(),
                catalogModel(),
                participantsModel(),
                sceneTimelineModel(),
                statePanelModel());
    }

    private record Runtime(
            SessionPlannerPublishedState publishedState,
            SessionPlannerApplicationService applicationService
    ) {
    }
}
