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
import src.domain.sessionplanner.published.SessionPlannerParticipantsModel;
import src.domain.sessionplanner.published.SessionPlannerSceneTimelineModel;
import src.domain.sessionplanner.published.SessionPlannerStatePanelModel;
import src.domain.sessionplanner.published.PreparedSceneCatalog;
import src.domain.sessionplanner.published.PreparedSceneSource;
import src.domain.worldplanner.published.WorldPlannerSnapshotModel;

public final class SessionPlannerServiceAssembly {

    private final Runtime runtime;
    private final PreparedSceneSource preparedScenes;

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
        SessionPlanRepository safeRepository = Objects.requireNonNull(repository, "repository");
        SessionPlannerForeignFacts facts = new SessionPlannerForeignFacts(
                party, activeParty, dayCalculation, encounters, savedPlans, planBudget, worldPlanner);
        SessionPlannerPublishedState publishedState =
                new SessionPlannerPublishedState(safeRepository, facts, new SessionPlannerProjection());
        facts.subscribeLocationRefresh(publishedState::publishLoadedCurrentSession);
        runtime = new Runtime(
                publishedState,
                new SessionPlannerApplicationService(safeRepository, facts, publishedState));
        preparedScenes = () -> {
            try {
                java.util.List<PreparedSceneCatalog.PreparedScene> scenes = new java.util.ArrayList<>();
                for (var summary : safeRepository.listSessions()) {
                    var plan = safeRepository.loadById(summary.sessionId()).orElse(null);
                    if (plan == null) {
                        continue;
                    }
                    for (var scene : plan.encounters()) {
                        scenes.add(new PreparedSceneCatalog.PreparedScene(
                                plan.sessionId(), plan.displayName(), scene.encounterId(), scene.sceneTitle(),
                                scene.sceneNotes(), scene.locationId(), scene.encounterPlanId(), plan.participantRefs()));
                    }
                }
                return new PreparedSceneCatalog(scenes, "");
            } catch (IllegalStateException exception) {
                return new PreparedSceneCatalog(java.util.List.of(), "Vorbereitete Szenen konnten nicht geladen werden.");
            }
        };
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

    public PreparedSceneSource preparedScenes() {
        return preparedScenes;
    }

    private record Runtime(
            SessionPlannerPublishedState publishedState,
            SessionPlannerApplicationService applicationService
    ) {
    }
}
