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
import src.domain.sessionplanner.published.RefreshSessionPlannerCommand;
import src.domain.sessionplanner.published.RemoveSessionEncounterCommand;
import src.domain.sessionplanner.published.RemoveSessionLootPlaceholderCommand;
import src.domain.sessionplanner.published.RemoveSessionParticipantCommand;
import src.domain.sessionplanner.published.SelectSessionEncounterCommand;
import src.domain.sessionplanner.published.SessionPlannerCurrentSessionModel;
import src.domain.sessionplanner.published.SessionPlannerEncountersModel;
import src.domain.sessionplanner.published.SessionPlannerParticipantsModel;
import src.domain.sessionplanner.published.SessionPlannerRestKind;
import src.domain.sessionplanner.published.SessionPlannerStatePanelModel;
import src.domain.sessionplanner.published.SetSessionEncounterAllocationCommand;
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
        if (event == null) {
            return;
        }
        SessionPlannerPublishedEvent.Mutation mutation = event.mutation();
        if (mutation instanceof SessionPlannerPublishedEvent.CreateSessionMutation) {
            planner.createSession(new CreateSessionPlanCommand());
            return;
        }
        if (mutation instanceof SessionPlannerPublishedEvent.AddParticipantMutation addParticipant) {
            planner.addParticipant(new AddSessionParticipantCommand(addParticipant.characterId()));
            return;
        }
        if (mutation instanceof SessionPlannerPublishedEvent.RemoveParticipantMutation removeParticipant) {
            planner.removeParticipant(new RemoveSessionParticipantCommand(removeParticipant.characterId()));
            return;
        }
        if (mutation instanceof SessionPlannerPublishedEvent.SetEncounterDaysMutation encounterDays) {
            planner.setEncounterDays(new SetSessionEncounterDaysCommand(encounterDays.encounterDays()));
            return;
        }
        if (mutation instanceof SessionPlannerPublishedEvent.AttachPlanMutation attachPlan) {
            planner.attachEncounter(new AttachSessionEncounterCommand(attachPlan.planId()));
            return;
        }
        if (mutation instanceof SessionPlannerPublishedEvent.RemoveEncounterMutation removeEncounter) {
            planner.removeEncounter(new RemoveSessionEncounterCommand(removeEncounter.encounterToken()));
            return;
        }
        if (mutation instanceof SessionPlannerPublishedEvent.MoveEncounterMutation moveEncounter) {
            if (moveEncounter.direction() == SessionPlannerPublishedEvent.Direction.DOWN) {
                planner.moveEncounterDown(new MoveSessionEncounterDownCommand(moveEncounter.encounterToken()));
                return;
            }
            planner.moveEncounterUp(new MoveSessionEncounterUpCommand(moveEncounter.encounterToken()));
            return;
        }
        if (mutation instanceof SessionPlannerPublishedEvent.SelectEncounterMutation selectEncounter) {
            planner.selectEncounter(new SelectSessionEncounterCommand(selectEncounter.encounterToken()));
            return;
        }
        if (mutation instanceof SessionPlannerPublishedEvent.SetEncounterAllocationMutation allocation) {
            planner.setEncounterAllocation(new SetSessionEncounterAllocationCommand(
                    allocation.encounterToken(),
                    allocation.budgetPercentage()));
            return;
        }
        if (mutation instanceof SessionPlannerPublishedEvent.SetRestGapMutation setRestGap) {
            planner.setRestGap(new SetSessionRestGapCommand(
                    setRestGap.leftEncounterId(),
                    setRestGap.rightEncounterId(),
                    toRestKind(setRestGap.restSelection())));
            return;
        }
        if (mutation instanceof SessionPlannerPublishedEvent.ClearRestGapMutation clearRestGap) {
            planner.clearRestGap(new ClearSessionRestGapCommand(
                    clearRestGap.leftEncounterId(),
                    clearRestGap.rightEncounterId()));
            return;
        }
        if (mutation instanceof SessionPlannerPublishedEvent.AddLootPlaceholderMutation) {
            planner.addLootPlaceholder(new AddSessionLootPlaceholderCommand());
            return;
        }
        if (mutation instanceof SessionPlannerPublishedEvent.RemoveLootPlaceholderMutation removeLootPlaceholder) {
            planner.removeLootPlaceholder(new RemoveSessionLootPlaceholderCommand(removeLootPlaceholder.lootToken()));
        }
    }

    private static SessionPlannerRestKind toRestKind(SessionPlannerPublishedEvent.RestSelection selection) {
        return switch (selection == null ? SessionPlannerPublishedEvent.RestSelection.NONE : selection) {
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
            planner.refreshSession(new RefreshSessionPlannerCommand());
        }
    }
}
