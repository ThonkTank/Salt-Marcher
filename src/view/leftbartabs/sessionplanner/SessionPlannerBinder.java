package src.view.leftbartabs.sessionplanner;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.sessionplanner.SessionPlannerApplicationService;
import src.domain.sessionplanner.published.ApplySessionPlannerCommand;
import src.domain.sessionplanner.published.SessionPlannerEncounterAllocationCommand;
import src.domain.sessionplanner.published.SessionPlannerEncounterPlanRef;
import src.domain.sessionplanner.published.SessionPlannerEncounterRef;
import src.domain.sessionplanner.published.SessionPlannerCurrentSessionModel;
import src.domain.sessionplanner.published.SessionPlannerEncountersModel;
import src.domain.sessionplanner.published.SessionPlannerLootRef;
import src.domain.sessionplanner.published.SessionPlannerParticipantRef;
import src.domain.sessionplanner.published.SessionPlannerParticipantsModel;
import src.domain.sessionplanner.published.SessionPlannerRestGapChange;
import src.domain.sessionplanner.published.SessionPlannerRestGapRef;
import src.domain.sessionplanner.published.SessionPlannerRestKind;
import src.domain.sessionplanner.published.SessionPlannerStatePanelModel;
import src.domain.sessionplanner.published.SetSessionEncounterDaysCommand;

final class SessionPlannerBinder {

    private final ShellRuntimeContext runtimeContext;

    SessionPlannerBinder(ShellRuntimeContext runtimeContext) {
        this.runtimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
    }

    ShellBinding bind() {
        SessionPlannerApplicationService planner =
                runtimeContext.services().require(SessionPlannerApplicationService.class);
        SessionPlannerCurrentSessionModel sessionModel =
                runtimeContext.services().require(SessionPlannerCurrentSessionModel.class);
        SessionPlannerParticipantsModel participantsModel =
                runtimeContext.services().require(SessionPlannerParticipantsModel.class);
        SessionPlannerEncountersModel encountersModel =
                runtimeContext.services().require(SessionPlannerEncountersModel.class);
        SessionPlannerStatePanelModel statePanelModel =
                runtimeContext.services().require(SessionPlannerStatePanelModel.class);
        SessionPlannerContributionModel contributionModel = new SessionPlannerContributionModel();
        SessionPlannerIntentHandler intentHandler = new SessionPlannerIntentHandler();
        SessionPlannerControlsView controlsView = new SessionPlannerControlsView();
        SessionPlannerTimelineMainView timelineView = new SessionPlannerTimelineMainView();
        SessionPlannerLootMainView lootView = new SessionPlannerLootMainView();
        SessionPlannerMainView mainView = new SessionPlannerMainView(timelineView, lootView);
        SessionPlannerStateView stateView = new SessionPlannerStateView();

        controlsView.bind(contributionModel);
        timelineView.bind(contributionModel);
        lootView.bind(contributionModel);
        stateView.bind(contributionModel);
        bindRequests(planner, intentHandler);
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
        return new Binding(planner, controlsView, mainView, stateView);
    }

    private static void bindRequests(
            SessionPlannerApplicationService planner,
            SessionPlannerIntentHandler intentHandler
    ) {
        intentHandler.onPublishedEventRequested(event -> applyPublishedEvent(planner, event));
    }

    private static void applyPublishedEvent(
            SessionPlannerApplicationService planner,
            SessionPlannerPublishedEvent event
    ) {
        if (planner != null && event != null) {
            planner.apply(toCommand(event.mutation()));
        }
    }

    private static ApplySessionPlannerCommand toCommand(SessionPlannerPublishedEvent.Mutation mutation) {
        return switch (mutation) {
            case SessionPlannerControlsViewInputEvent.CreateSessionTrigger ignored ->
                    ApplySessionPlannerCommand.createSession();
            case SessionPlannerControlsViewInputEvent.AddParticipantInput addParticipant ->
                    ApplySessionPlannerCommand.addParticipant(new SessionPlannerParticipantRef(addParticipant.participantToAddId()));
            case SessionPlannerControlsViewInputEvent.RemoveParticipantInput removeParticipant ->
                    ApplySessionPlannerCommand.removeParticipant(new SessionPlannerParticipantRef(removeParticipant.participantToRemoveId()));
            case SessionPlannerPublishedEvent.SetEncounterDaysMutation encounterDays ->
                    ApplySessionPlannerCommand.encounterDays(new SetSessionEncounterDaysCommand(encounterDays.encounterDays()));
            case SessionPlannerControlsViewInputEvent.AttachPlanInput attachPlan ->
                    ApplySessionPlannerCommand.attachEncounter(new SessionPlannerEncounterPlanRef(attachPlan.planIdToAttach()));
            case SessionPlannerTimelineMainViewInputEvent.RemoveEncounterInput removeEncounter ->
                    ApplySessionPlannerCommand.removeEncounter(new SessionPlannerEncounterRef(removeEncounter.encounterTokenToRemove()));
            case SessionPlannerTimelineMainViewInputEvent.MoveEncounterInput moveEncounter ->
                    moveEncounter.movesDown()
                            ? ApplySessionPlannerCommand.moveEncounterDown(new SessionPlannerEncounterRef(moveEncounter.encounterToken()))
                            : ApplySessionPlannerCommand.moveEncounterUp(new SessionPlannerEncounterRef(moveEncounter.encounterToken()));
            case SessionPlannerTimelineMainViewInputEvent.SelectEncounterInput selectEncounter ->
                    ApplySessionPlannerCommand.selectEncounter(new SessionPlannerEncounterRef(selectEncounter.selectedEncounterToken()));
            case SessionPlannerTimelineMainViewInputEvent.SetEncounterAllocationInput allocation ->
                    ApplySessionPlannerCommand.allocation(new SessionPlannerEncounterAllocationCommand(
                            allocation.encounterToken(),
                            allocation.targetAllocationPercentage()));
            case SessionPlannerTimelineMainViewInputEvent.RestGapInput restGap ->
                    restGap.clearsRestGap()
                            ? ApplySessionPlannerCommand.clearRestGap(new SessionPlannerRestGapRef(
                                    restGap.leftEncounterId(),
                                    restGap.rightEncounterId()))
                            : ApplySessionPlannerCommand.restGap(new SessionPlannerRestGapChange(
                                    restGap.leftEncounterId(),
                                    restGap.rightEncounterId(),
                                    toRestKind(restGap.restSelection())));
            case SessionPlannerLootMainViewInputEvent.AddLootPlaceholderTrigger ignored ->
                    ApplySessionPlannerCommand.addLootPlaceholder();
            case SessionPlannerLootMainViewInputEvent.RemoveLootPlaceholderInput removeLoot ->
                    ApplySessionPlannerCommand.removeLoot(new SessionPlannerLootRef(removeLoot.lootToken()));
        };
    }

    private static SessionPlannerRestKind toRestKind(SessionPlannerTimelineMainViewInputEvent.RestSelection selection) {
        return switch (SessionPlannerTimelineMainViewInputEvent.RestSelection.normalized(selection)) {
            case NONE -> SessionPlannerRestKind.NONE;
            case SHORT_REST -> SessionPlannerRestKind.SHORT_REST;
            case LONG_REST -> SessionPlannerRestKind.LONG_REST;
        };
    }

    private record Binding(
            SessionPlannerApplicationService planner,
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

        @Override
        public void onActivate() {
            planner.refreshSession();
        }
    }
}
