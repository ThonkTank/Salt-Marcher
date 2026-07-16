package src.domain.sessionplanner;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.published.EncounterPlanBudgetModel;
import src.domain.encounter.published.SavedEncounterPlanListModel;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.AdventuringDayCalculationModel;
import src.domain.sessionplanner.model.session.repository.SessionPlanRepository;
import src.domain.sessionplanner.published.SessionPlannerCatalogModel;
import src.domain.sessionplanner.published.SessionPlannerCurrentSessionModel;
import src.domain.sessionplanner.published.SessionPlannerGenerationModel;
import src.domain.sessionplanner.published.SessionPlannerParticipantsModel;
import src.domain.sessionplanner.published.SessionPlannerSceneTimelineModel;
import src.domain.sessionplanner.published.SessionPlannerStatePanelModel;
import src.domain.worldplanner.published.WorldPlannerSnapshotModel;
import src.domain.sessiongeneration.SessionGenerationApplicationService;

public final class SessionPlannerServiceAssembly {

    private final Runtime runtime;

    public SessionPlannerServiceAssembly(
            SessionPlanRepository repository,
            PartyApplicationService party,
            ActivePartyModel activeParty,
            AdventuringDayCalculationModel dayCalculation,
            EncounterApplicationService encounters,
            SavedEncounterPlanListModel savedPlans,
            EncounterPlanBudgetModel planBudget,
            @Nullable WorldPlannerSnapshotModel worldPlanner
    ) {
        this(repository, party, activeParty, dayCalculation, encounters, savedPlans, planBudget, worldPlanner, null);
    }

    public SessionPlannerServiceAssembly(
            SessionPlanRepository repository,
            PartyApplicationService party,
            ActivePartyModel activeParty,
            AdventuringDayCalculationModel dayCalculation,
            EncounterApplicationService encounters,
            SavedEncounterPlanListModel savedPlans,
            EncounterPlanBudgetModel planBudget,
            @Nullable WorldPlannerSnapshotModel worldPlanner,
            @Nullable SessionGenerationApplicationService generation
    ) {
        SessionPlanRepository safeRepository = Objects.requireNonNull(repository, "repository");
        SessionPlannerForeignFacts facts = new SessionPlannerForeignFacts(
                party, activeParty, dayCalculation, encounters, savedPlans, planBudget, worldPlanner);
        SessionPlannerPublishedState publishedState =
                new SessionPlannerPublishedState(safeRepository, facts, new SessionPlannerProjection());
        SessionPlannerGenerationWorkflow generationWorkflow =
                new SessionPlannerGenerationWorkflow(generation, encounters, facts);
        facts.subscribeLocationRefresh(publishedState::publishLoadedCurrentSession);
        runtime = new Runtime(
                publishedState,
                generationWorkflow,
                new SessionPlannerApplicationService(safeRepository, facts, publishedState, generationWorkflow));
    }

    public SessionPlannerApplicationService application() {
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

    public SessionPlannerGenerationModel generationModel() {
        return runtime.generationWorkflow().model();
    }

    private record Runtime(
            SessionPlannerPublishedState publishedState,
            SessionPlannerGenerationWorkflow generationWorkflow,
            SessionPlannerApplicationService applicationService
    ) {
    }
}
