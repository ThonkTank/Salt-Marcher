package src.view.leftbartabs.sessionplanner;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ServiceRegistry;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.sessionplanner.SessionPlannerApplicationService;
import src.domain.sessionplanner.SessionPlannerEncounterApplicationService;
import src.domain.sessionplanner.SessionPlannerLootApplicationService;
import src.domain.sessionplanner.SessionPlannerParticipantApplicationService;
import src.domain.sessionplanner.SessionPlannerRestApplicationService;
import src.domain.sessionplanner.published.SessionPlannerCurrentSessionModel;
import src.domain.sessionplanner.published.SessionPlannerEncountersModel;
import src.domain.sessionplanner.published.SessionPlannerParticipantsModel;
import src.domain.sessionplanner.published.SessionPlannerStatePanelModel;

final class SessionPlannerBinder {

    private final ShellRuntimeContext runtimeContext;

    SessionPlannerBinder(ShellRuntimeContext runtimeContext) {
        this.runtimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
    }

    ShellBinding bind() {
        ServiceRegistry services = runtimeContext.services();
        SessionPlannerApplicationService planner =
                services.require(SessionPlannerApplicationService.class);
        SessionPlannerParticipantApplicationService participants =
                services.require(SessionPlannerParticipantApplicationService.class);
        SessionPlannerEncounterApplicationService encounters =
                services.require(SessionPlannerEncounterApplicationService.class);
        SessionPlannerRestApplicationService rests =
                services.require(SessionPlannerRestApplicationService.class);
        SessionPlannerLootApplicationService loot =
                services.require(SessionPlannerLootApplicationService.class);
        SessionPlannerCurrentSessionModel sessionModel =
                services.require(SessionPlannerCurrentSessionModel.class);
        SessionPlannerParticipantsModel participantsModel =
                services.require(SessionPlannerParticipantsModel.class);
        SessionPlannerEncountersModel encountersModel =
                services.require(SessionPlannerEncountersModel.class);
        SessionPlannerStatePanelModel statePanelModel =
                services.require(SessionPlannerStatePanelModel.class);
        SessionPlannerContributionModel contributionModel = new SessionPlannerContributionModel();
        SessionPlannerIntentHandler intentHandler = new SessionPlannerIntentHandler(
                planner,
                participants,
                encounters,
                rests,
                loot);
        SessionPlannerControlsView controlsView = new SessionPlannerControlsView();
        SessionPlannerTimelineMainView timelineView = new SessionPlannerTimelineMainView();
        SessionPlannerLootMainView lootView = new SessionPlannerLootMainView();
        SessionPlannerMainView mainView = new SessionPlannerMainView(timelineView, lootView);
        SessionPlannerStateView stateView = new SessionPlannerStateView();

        controlsView.bind(contributionModel);
        timelineView.bind(contributionModel);
        lootView.bind(contributionModel);
        stateView.bind(contributionModel);
        controlsView.onViewInputEvent(intentHandler::consume);
        timelineView.onViewInputEvent(intentHandler::consume);
        lootView.onViewInputEvent(intentHandler::consume);

        sessionModel.subscribe(contributionModel::applySession);
        participantsModel.subscribe(contributionModel::applyParticipants);
        encountersModel.subscribe(contributionModel::applyEncounters);
        statePanelModel.subscribe(contributionModel::applyStatePanel);
        contributionModel.applySession(sessionModel.current());
        contributionModel.applyParticipants(participantsModel.current());
        contributionModel.applyEncounters(encountersModel.current());
        contributionModel.applyStatePanel(statePanelModel.current());
        return new Binding(controlsView, mainView, stateView);
    }

    private record Binding(
            Node controls,
            Node main,
            Node state
    ) implements ShellBinding {

        @Override
        public String title() {
            return "Session Planner";
        }

        @Override
        public String navigationLabel() {
            return "Planner";
        }

        @Override
        public Map<ShellSlot, Node> slotContent() {
            return Map.of(
                    ShellSlot.COCKPIT_CONTROLS, controls,
                    ShellSlot.COCKPIT_MAIN, main,
                    ShellSlot.COCKPIT_STATE, state);
        }
    }
}
