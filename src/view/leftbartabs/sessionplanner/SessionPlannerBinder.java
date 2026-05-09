package src.view.leftbartabs.sessionplanner;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.sessionplanner.SessionPlannerApplicationService;
import src.domain.sessionplanner.published.AddSessionLootPlaceholderCommand;
import src.domain.sessionplanner.published.AddSessionParticipantCommand;
import src.domain.sessionplanner.published.AttachSessionEncounterCommand;
import src.domain.sessionplanner.published.ClearSessionRestGapCommand;
import src.domain.sessionplanner.published.CreateSessionPlanCommand;
import src.domain.sessionplanner.published.MoveSessionEncounterDownCommand;
import src.domain.sessionplanner.published.MoveSessionEncounterUpCommand;
import src.domain.sessionplanner.published.RemoveSessionEncounterCommand;
import src.domain.sessionplanner.published.RemoveSessionLootPlaceholderCommand;
import src.domain.sessionplanner.published.RemoveSessionParticipantCommand;
import src.domain.sessionplanner.published.SelectSessionEncounterCommand;
import src.domain.sessionplanner.published.SessionPlannerEncounterAllocationCommand;
import src.domain.sessionplanner.published.SessionPlannerCurrentSessionModel;
import src.domain.sessionplanner.published.SessionPlannerEncountersModel;
import src.domain.sessionplanner.published.SessionPlannerRestKind;
import src.domain.sessionplanner.published.SessionPlannerParticipantsModel;
import src.domain.sessionplanner.published.SessionPlannerStatePanelModel;
import src.domain.sessionplanner.published.SetSessionEncounterDaysCommand;
import src.domain.sessionplanner.published.SetSessionRestGapCommand;

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
        return new Binding(controlsView, mainView, stateView);
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
            applyMutation(planner, event.mutation());
        }
    }

    private static void applyMutation(
            SessionPlannerApplicationService planner,
            SessionPlannerPublishedEvent.Mutation mutation
    ) {
        switch (mutation) {
            case SessionPlannerControlsViewInputEvent.CreateSessionTrigger ignored ->
                    planner.createSession(new CreateSessionPlanCommand());
            case SessionPlannerControlsViewInputEvent.AddParticipantInput addParticipant ->
                    planner.addParticipant(new AddSessionParticipantCommand(addParticipant.participantToAddId()));
            case SessionPlannerControlsViewInputEvent.RemoveParticipantInput removeParticipant ->
                    planner.removeParticipant(new RemoveSessionParticipantCommand(removeParticipant.participantToRemoveId()));
            case SessionPlannerPublishedEvent.SetEncounterDaysMutation encounterDays ->
                    planner.setEncounterDays(new SetSessionEncounterDaysCommand(encounterDays.encounterDays()));
            case SessionPlannerControlsViewInputEvent.AttachPlanInput attachPlan ->
                    planner.attachEncounter(new AttachSessionEncounterCommand(attachPlan.planIdToAttach()));
            case SessionPlannerTimelineMainViewInputEvent.RemoveEncounterInput removeEncounter ->
                    planner.removeEncounter(new RemoveSessionEncounterCommand(removeEncounter.encounterTokenToRemove()));
            case SessionPlannerTimelineMainViewInputEvent.MoveEncounterInput moveEncounter ->
                    applyMove(planner, moveEncounter);
            case SessionPlannerTimelineMainViewInputEvent.SelectEncounterInput selectEncounter ->
                    planner.selectEncounter(new SelectSessionEncounterCommand(selectEncounter.selectedEncounterToken()));
            case SessionPlannerTimelineMainViewInputEvent.SetEncounterAllocationInput allocation ->
                    planner.setEncounterAllocation(new SessionPlannerEncounterAllocationCommand(
                            allocation.encounterToken(),
                            allocation.targetAllocationPercentage()));
            case SessionPlannerTimelineMainViewInputEvent.RestGapInput restGap ->
                    applyRestGap(planner, restGap);
            case SessionPlannerLootMainViewInputEvent.AddLootPlaceholderTrigger ignored ->
                    planner.addLootPlaceholder(new AddSessionLootPlaceholderCommand());
            case SessionPlannerLootMainViewInputEvent.RemoveLootPlaceholderInput removeLoot ->
                    planner.removeLootPlaceholder(new RemoveSessionLootPlaceholderCommand(removeLoot.lootToken()));
        }
    }

    private static void applyMove(
            SessionPlannerApplicationService planner,
            SessionPlannerTimelineMainViewInputEvent.MoveEncounterInput moveEncounter
    ) {
        if (moveEncounter.movesDown()) {
            planner.moveEncounterDown(new MoveSessionEncounterDownCommand(moveEncounter.encounterToken()));
            return;
        }
        planner.moveEncounterUp(new MoveSessionEncounterUpCommand(moveEncounter.encounterToken()));
    }

    private static void applyRestGap(
            SessionPlannerApplicationService planner,
            SessionPlannerTimelineMainViewInputEvent.RestGapInput restGap
    ) {
        if (restGap.clearsRestGap()) {
            planner.clearRestGap(new ClearSessionRestGapCommand(
                    restGap.leftEncounterId(),
                    restGap.rightEncounterId()));
            return;
        }
        planner.setRestGap(new SetSessionRestGapCommand(
                restGap.leftEncounterId(),
                restGap.rightEncounterId(),
                toRestKind(restGap.restSelection())));
    }

    private static SessionPlannerRestKind toRestKind(SessionPlannerTimelineMainViewInputEvent.RestSelection selection) {
        return switch (SessionPlannerTimelineMainViewInputEvent.RestSelection.normalized(selection)) {
            case NONE -> SessionPlannerRestKind.NONE;
            case SHORT_REST -> SessionPlannerRestKind.SHORT_REST;
            case LONG_REST -> SessionPlannerRestKind.LONG_REST;
        };
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
