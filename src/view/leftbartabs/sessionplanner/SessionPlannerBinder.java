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
import src.domain.sessionplanner.published.AttachSessionEncounterCommand;
import src.domain.sessionplanner.published.ClearSessionRestGapCommand;
import src.domain.sessionplanner.published.LoadSessionPlannerQuery;
import src.domain.sessionplanner.published.MoveSessionEncounterDownCommand;
import src.domain.sessionplanner.published.MoveSessionEncounterUpCommand;
import src.domain.sessionplanner.published.RefreshSessionPlannerCommand;
import src.domain.sessionplanner.published.RemoveSessionEncounterCommand;
import src.domain.sessionplanner.published.RemoveSessionLootPlaceholderCommand;
import src.domain.sessionplanner.published.SessionPlannerModel;
import src.domain.sessionplanner.published.SessionPlannerRestKind;
import src.domain.sessionplanner.published.SetSessionRestGapCommand;

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
        intentHandler.onPublishedEventRequested(event -> applyPublishedEvent(planner, event));
    }

    private static void bindControls(
            SessionPlannerContributionModel contributionModel,
            SessionPlannerIntentHandler intentHandler,
            SessionPlannerControlsView controlsView
    ) {
        controlsView.onViewInputEvent(intentHandler::consume);
        intentHandler.onRestGapResolutionRequested(gapIndex -> resolveGap(contributionModel, gapIndex));
        controlsView.showParty(contributionModel.partyProperty().get());
        controlsView.showBudget(contributionModel.budgetProperty().get());
        controlsView.showRestAdvice(contributionModel.restAdviceProperty().get());
        controlsView.showGoldBudget(contributionModel.goldBudgetProperty().get());
        controlsView.showAvailablePlans(contributionModel.availablePlansProperty().get());
        controlsView.statusTextProperty().bind(contributionModel.statusTextProperty());
        contributionModel.partyProperty().addListener((ignored, before, after) -> controlsView.showParty(after));
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
        timelineView.showTimeline(
                contributionModel.plannedEncountersProperty().get(),
                contributionModel.restGapsProperty().get());
        lootView.showLootPlaceholders(contributionModel.lootPlaceholdersProperty().get());
        contributionModel.plannedEncountersProperty().addListener(
                (ListChangeListener<SessionPlannerContributionModel.EncounterModel>) change ->
                        timelineView.showTimeline(
                                contributionModel.plannedEncountersProperty().get(),
                                contributionModel.restGapsProperty().get()));
        contributionModel.restGapsProperty().addListener(
                (ListChangeListener<SessionPlannerContributionModel.RestGapModel>) change ->
                        timelineView.showTimeline(
                                contributionModel.plannedEncountersProperty().get(),
                                contributionModel.restGapsProperty().get()));
        contributionModel.lootPlaceholdersProperty().addListener(
                (ListChangeListener<SessionPlannerContributionModel.LootModel>) change ->
                        lootView.showLootPlaceholders(contributionModel.lootPlaceholdersProperty().get()));
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
            case IMPORT_PLAN -> planner.attachEncounter(new AttachSessionEncounterCommand(event.planId()));
            case REMOVE_ENCOUNTER -> planner.removeEncounter(new RemoveSessionEncounterCommand(event.encounterToken()));
            case MOVE_ENCOUNTER_UP -> planner.moveEncounterUp(new MoveSessionEncounterUpCommand(event.encounterToken()));
            case MOVE_ENCOUNTER_DOWN -> planner.moveEncounterDown(new MoveSessionEncounterDownCommand(event.encounterToken()));
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

    private static SessionPlannerContributionModel.RestGapModel resolveGap(
            SessionPlannerContributionModel contributionModel,
            int gapIndex
    ) {
        if (gapIndex < 0 || gapIndex >= contributionModel.restGapsProperty().size()) {
            return new SessionPlannerContributionModel.RestGapModel(-1, 0L, 0L, "", false);
        }
        return contributionModel.restGapsProperty().get(gapIndex);
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
            planner.refreshSession(new RefreshSessionPlannerCommand());
        }
    }
}
