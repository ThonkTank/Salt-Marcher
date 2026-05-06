package src.view.leftbartabs.sessionplanner;

import java.util.Map;
import java.util.Objects;
import javafx.collections.ListChangeListener;
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

        bindRequests(planner, intentHandler);
        bindControls(contributionModel, intentHandler, controlsView);
        bindMain(contributionModel, intentHandler, timelineView, lootView);
        bindState(contributionModel, stateView);

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

    private static void bindControls(
            SessionPlannerContributionModel contributionModel,
            SessionPlannerIntentHandler intentHandler,
            SessionPlannerControlsView controlsView
    ) {
        controlsView.onViewInputEvent(intentHandler::consume);
        controlsView.showSession(contributionModel.sessionProperty().get());
        controlsView.showParty(contributionModel.partyProperty().get());
        controlsView.showSessionParticipants(contributionModel.sessionParticipantsProperty().get());
        controlsView.showActivePartyMembers(contributionModel.activePartyMembersProperty().get());
        controlsView.showBudget(contributionModel.budgetProperty().get());
        controlsView.showRestAdvice(contributionModel.restAdviceProperty().get());
        controlsView.showGoldBudget(contributionModel.goldBudgetProperty().get());
        controlsView.showAvailablePlans(contributionModel.availablePlansProperty().get());
        controlsView.statusTextProperty().bind(contributionModel.statusTextProperty());
        contributionModel.sessionProperty().addListener((ignored, before, after) -> controlsView.showSession(after));
        contributionModel.partyProperty().addListener((ignored, before, after) -> controlsView.showParty(after));
        contributionModel.sessionParticipantsProperty().addListener(
                (ListChangeListener<SessionPlannerContributionModel.SessionParticipantModel>) change ->
                        controlsView.showSessionParticipants(contributionModel.sessionParticipantsProperty().get()));
        contributionModel.activePartyMembersProperty().addListener(
                (ListChangeListener<SessionPlannerContributionModel.PartyMemberModel>) change ->
                        controlsView.showActivePartyMembers(contributionModel.activePartyMembersProperty().get()));
        contributionModel.budgetProperty().addListener((ignored, before, after) -> controlsView.showBudget(after));
        contributionModel.restAdviceProperty().addListener((ignored, before, after) -> controlsView.showRestAdvice(after));
        contributionModel.goldBudgetProperty().addListener((ignored, before, after) -> controlsView.showGoldBudget(after));
        contributionModel.availablePlansProperty().addListener(
                (ListChangeListener<SessionPlannerContributionModel.AvailablePlanModel>) change ->
                        controlsView.showAvailablePlans(contributionModel.availablePlansProperty().get()));
    }

    private static void bindMain(
            SessionPlannerContributionModel contributionModel,
            SessionPlannerIntentHandler intentHandler,
            SessionPlannerTimelineMainView timelineView,
            SessionPlannerLootMainView lootView
    ) {
        timelineView.onViewInputEvent(intentHandler::consume);
        lootView.onViewInputEvent(intentHandler::consume);
        intentHandler.replaceEncounters(contributionModel.plannedEncountersProperty().get());
        intentHandler.replaceRestGaps(contributionModel.restGapsProperty().get());
        timelineView.showTimeline(
                contributionModel.plannedEncountersProperty().get(),
                contributionModel.restGapsProperty().get());
        lootView.showLootPlaceholders(contributionModel.lootPlaceholdersProperty().get());
        contributionModel.plannedEncountersProperty().addListener(
                (ListChangeListener<SessionPlannerContributionModel.EncounterModel>) change ->
                {
                    intentHandler.replaceEncounters(contributionModel.plannedEncountersProperty().get());
                    timelineView.showTimeline(
                            contributionModel.plannedEncountersProperty().get(),
                            contributionModel.restGapsProperty().get());
                });
        contributionModel.restGapsProperty().addListener(
                (ListChangeListener<SessionPlannerContributionModel.RestGapModel>) change ->
                {
                    intentHandler.replaceRestGaps(contributionModel.restGapsProperty().get());
                    timelineView.showTimeline(
                            contributionModel.plannedEncountersProperty().get(),
                            contributionModel.restGapsProperty().get());
                });
        contributionModel.lootPlaceholdersProperty().addListener(
                (ListChangeListener<SessionPlannerContributionModel.LootModel>) change ->
                        lootView.showLootPlaceholders(contributionModel.lootPlaceholdersProperty().get()));
    }

    private static void bindState(
            SessionPlannerContributionModel contributionModel,
            SessionPlannerStateView stateView
    ) {
        stateView.showState(contributionModel.stateProperty().get());
        contributionModel.stateProperty().addListener((ignored, before, after) -> stateView.showState(after));
    }

    private static void applyPublishedEvent(
            SessionPlannerApplicationService planner,
            SessionPlannerPublishedEvent event
    ) {
        if (event == null) {
            planner.refreshSession(new RefreshSessionPlannerCommand());
            return;
        }
        switch (event.kind()) {
            case REFRESH_SESSION -> planner.refreshSession(new RefreshSessionPlannerCommand());
            case CREATE_SESSION -> planner.createSession(new CreateSessionPlanCommand());
            case ADD_PARTICIPANT -> planner.addParticipant(new AddSessionParticipantCommand(event.characterId()));
            case REMOVE_PARTICIPANT -> planner.removeParticipant(new RemoveSessionParticipantCommand(event.characterId()));
            case SET_ENCOUNTER_DAYS -> planner.setEncounterDays(new SetSessionEncounterDaysCommand(event.encounterDays()));
            case ATTACH_PLAN -> planner.attachEncounter(new AttachSessionEncounterCommand(event.planId()));
            case REMOVE_ENCOUNTER -> planner.removeEncounter(new RemoveSessionEncounterCommand(event.encounterToken()));
            case MOVE_ENCOUNTER_UP -> planner.moveEncounterUp(new MoveSessionEncounterUpCommand(event.encounterToken()));
            case MOVE_ENCOUNTER_DOWN -> planner.moveEncounterDown(new MoveSessionEncounterDownCommand(event.encounterToken()));
            case SELECT_ENCOUNTER -> planner.selectEncounter(new SelectSessionEncounterCommand(event.encounterToken()));
            case SET_ENCOUNTER_ALLOCATION ->
                    planner.setEncounterAllocation(new SetSessionEncounterAllocationCommand(
                            event.encounterToken(),
                            event.budgetPercentage()));
            case SET_REST_GAP -> planner.setRestGap(new SetSessionRestGapCommand(
                    event.leftEncounterId(),
                    event.rightEncounterId(),
                    toRestKind(event.restSelection())));
            case CLEAR_REST_GAP -> planner.clearRestGap(new ClearSessionRestGapCommand(
                    event.leftEncounterId(),
                    event.rightEncounterId()));
            case ADD_LOOT_PLACEHOLDER -> planner.addLootPlaceholder(new AddSessionLootPlaceholderCommand());
            case REMOVE_LOOT_PLACEHOLDER ->
                    planner.removeLootPlaceholder(new RemoveSessionLootPlaceholderCommand(event.lootToken()));
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
