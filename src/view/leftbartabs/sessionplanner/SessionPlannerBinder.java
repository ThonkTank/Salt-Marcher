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
        SessionPlannerControlsContentModel controlsContentModel = new SessionPlannerControlsContentModel();
        SessionPlannerTimelineMainContentModel timelineMainContentModel = new SessionPlannerTimelineMainContentModel();
        SessionPlannerStateContentModel stateContentModel = new SessionPlannerStateContentModel();
        SessionPlannerContributionModel contributionModel = new SessionPlannerContributionModel(
                controlsContentModel,
                timelineMainContentModel,
                stateContentModel);
        SessionPlannerIntentHandler intentHandler = new SessionPlannerIntentHandler(
                planner,
                participants,
                encounters,
                rests,
                loot);
        SessionPlannerControlsView controlsView = new SessionPlannerControlsView();
        SessionPlannerTimelineMainView timelineView = new SessionPlannerTimelineMainView();
        SessionPlannerStateView stateView = new SessionPlannerStateView();

        controlsView.bind(controlsContentModel);
        timelineView.bind(timelineMainContentModel);
        stateView.bind(stateContentModel);
        controlsView.onViewInputEvent(intentHandler::consume);
        timelineView.onViewInputEvent(intentHandler::consume);

        contributionModel.bindReadback(sessionModel, participantsModel, encountersModel, statePanelModel);
        return new Binding(controlsView, timelineView, stateView);
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
