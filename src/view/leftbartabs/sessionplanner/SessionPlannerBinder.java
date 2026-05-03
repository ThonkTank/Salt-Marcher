package src.view.leftbartabs.sessionplanner;

import java.util.Map;
import java.util.Objects;
import javafx.collections.ListChangeListener;
import javafx.scene.Node;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.sessionplanner.SessionPlannerApplicationService;
import src.domain.sessionplanner.published.ApplySessionPlannerCommand;
import src.domain.sessionplanner.published.LoadSessionPlannerQuery;
import src.domain.sessionplanner.published.SessionPlannerModel;
import src.domain.sessionplanner.published.SessionPlannerRestKind;

final class SessionPlannerBinder {

    private final ShellRuntimeContext runtimeContext;

    SessionPlannerBinder(ShellRuntimeContext runtimeContext) {
        this.runtimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
    }

    ShellBinding bind() {
        SessionPlannerApplicationService planner =
                runtimeContext.services().require(SessionPlannerApplicationService.class);
        SessionPlannerModel sessionModel = planner.loadSession(new LoadSessionPlannerQuery());
        SessionPlannerContributionModel contributionModel = new SessionPlannerContributionModel();
        SessionPlannerIntentHandler intentHandler = new SessionPlannerIntentHandler();
        SessionPlannerControlsView controlsView = new SessionPlannerControlsView();
        SessionPlannerTimelineMainView timelineView = new SessionPlannerTimelineMainView();
        SessionPlannerLootMainView lootView = new SessionPlannerLootMainView();
        SessionPlannerMainView mainView = new SessionPlannerMainView(timelineView, lootView);

        bindRequests(planner, intentHandler);
        bindControls(contributionModel, intentHandler, controlsView);
        bindMain(contributionModel, intentHandler, timelineView, lootView);

        sessionModel.subscribe(contributionModel::apply);
        contributionModel.apply(sessionModel.current());
        return new Binding(planner, controlsView, mainView);
    }

    private static void bindRequests(
            SessionPlannerApplicationService planner,
            SessionPlannerIntentHandler intentHandler
    ) {
        intentHandler.onPublishedEventRequested(event -> planner.applySession(toCommand(event)));
    }

    private static void bindControls(
            SessionPlannerContributionModel contributionModel,
            SessionPlannerIntentHandler intentHandler,
            SessionPlannerControlsView controlsView
    ) {
        controlsView.onViewInputEvent(intentHandler::consume);
        controlsView.showParty(contributionModel.partyProperty().get());
        controlsView.showBudget(contributionModel.budgetProperty().get());
        controlsView.showRestAdvice(contributionModel.restAdviceProperty().get());
        controlsView.showGoldBudget(contributionModel.goldBudgetProperty().get());
        controlsView.showAvailablePlans(contributionModel.availablePlans());
        controlsView.statusTextProperty().bind(contributionModel.statusTextProperty());
        contributionModel.partyProperty().addListener((ignored, before, after) -> controlsView.showParty(after));
        contributionModel.budgetProperty().addListener((ignored, before, after) -> controlsView.showBudget(after));
        contributionModel.restAdviceProperty().addListener((ignored, before, after) -> controlsView.showRestAdvice(after));
        contributionModel.goldBudgetProperty().addListener((ignored, before, after) -> controlsView.showGoldBudget(after));
        contributionModel.availablePlans().addListener(
                (ListChangeListener<SessionPlannerContributionModel.AvailablePlanModel>) change ->
                        controlsView.showAvailablePlans(contributionModel.availablePlans()));
    }

    private static void bindMain(
            SessionPlannerContributionModel contributionModel,
            SessionPlannerIntentHandler intentHandler,
            SessionPlannerTimelineMainView timelineView,
            SessionPlannerLootMainView lootView
    ) {
        timelineView.onViewInputEvent(intentHandler::consume);
        lootView.onViewInputEvent(intentHandler::consume);
        timelineView.showTimeline(contributionModel.plannedEncounters(), contributionModel.restGaps());
        lootView.showLootPlaceholders(contributionModel.lootPlaceholders());
        contributionModel.plannedEncounters().addListener(
                (ListChangeListener<SessionPlannerContributionModel.EncounterModel>) change ->
                        timelineView.showTimeline(contributionModel.plannedEncounters(), contributionModel.restGaps()));
        contributionModel.restGaps().addListener(
                (ListChangeListener<SessionPlannerContributionModel.RestGapModel>) change ->
                        timelineView.showTimeline(contributionModel.plannedEncounters(), contributionModel.restGaps()));
        contributionModel.lootPlaceholders().addListener(
                (ListChangeListener<SessionPlannerContributionModel.LootModel>) change ->
                        lootView.showLootPlaceholders(contributionModel.lootPlaceholders()));
    }

    private static ApplySessionPlannerCommand refreshCommand() {
        return new ApplySessionPlannerCommand(
                ApplySessionPlannerCommand.Action.REFRESH,
                0L,
                0L,
                -1,
                SessionPlannerRestKind.NONE,
                0L);
    }

    private static ApplySessionPlannerCommand toCommand(SessionPlannerPublishedEvent event) {
        if (event == null) {
            return refreshCommand();
        }
        SessionPlannerPublishedEvent safeEvent = event;
        if (safeEvent.kind() == SessionPlannerPublishedEvent.Kind.REFRESH) {
            return refreshCommand();
        }
        return new ApplySessionPlannerCommand(
                toAction(safeEvent.kind()),
                safeEvent.planId(),
                safeEvent.encounterToken(),
                safeEvent.gapIndex(),
                toRestKind(safeEvent.restSelection()),
                safeEvent.lootToken());
    }

    private static ApplySessionPlannerCommand.Action toAction(SessionPlannerPublishedEvent.Kind kind) {
        return switch (kind == null ? SessionPlannerPublishedEvent.Kind.REFRESH : kind) {
            case REFRESH -> ApplySessionPlannerCommand.Action.REFRESH;
            case IMPORT_PLAN -> ApplySessionPlannerCommand.Action.IMPORT_ENCOUNTER_PLAN;
            case REMOVE_ENCOUNTER -> ApplySessionPlannerCommand.Action.REMOVE_ENCOUNTER;
            case MOVE_ENCOUNTER_UP -> ApplySessionPlannerCommand.Action.MOVE_ENCOUNTER_UP;
            case MOVE_ENCOUNTER_DOWN -> ApplySessionPlannerCommand.Action.MOVE_ENCOUNTER_DOWN;
            case SET_REST_GAP -> ApplySessionPlannerCommand.Action.SET_REST_GAP;
            case CLEAR_REST_GAP -> ApplySessionPlannerCommand.Action.CLEAR_REST_GAP;
            case ADD_LOOT_PLACEHOLDER -> ApplySessionPlannerCommand.Action.ADD_LOOT_PLACEHOLDER;
            case REMOVE_LOOT_PLACEHOLDER -> ApplySessionPlannerCommand.Action.REMOVE_LOOT_PLACEHOLDER;
        };
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
            Node main
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
                    ShellSlot.COCKPIT_MAIN, main);
        }

        @Override
        public void onActivate() {
            planner.applySession(refreshCommand());
        }
    }
}
