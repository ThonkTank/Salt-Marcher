package src.view.dropdowns.adventuringday;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.CalculateAdventuringDayQuery;
import src.domain.party.published.LoadAdventuringDaySummaryQuery;

final class AdventuringDayTopBarBinder {

    private final ShellRuntimeContext runtimeContext;

    AdventuringDayTopBarBinder(ShellRuntimeContext runtimeContext) {
        this.runtimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
    }

    ShellBinding bind() {
        PartyApplicationService party = runtimeContext.services().require(PartyApplicationService.class);
        AdventuringDayTopBarPresentationModel presentationModel = new AdventuringDayTopBarPresentationModel();
        AdventuringDayTopBarIntentHandler intentHandler = new AdventuringDayTopBarIntentHandler(presentationModel);
        AdventuringDayTopBarView view = new AdventuringDayTopBarView();
        bindRequests(party, presentationModel, intentHandler);
        view.triggerTextProperty().bind(presentationModel.triggerTextProperty());
        view.setCalculationProvider((levels, totalGroupXp) -> toCalculation(intentHandler.calculate(levels, totalGroupXp)));
        view.showPanel(toPanelContent(presentationModel.panelProperty().get()));
        presentationModel.panelProperty().addListener((ignored, before, after) -> view.showPanel(toPanelContent(after)));
        view.onOpen(intentHandler::onOpen);
        intentHandler.onOpen();
        return new Binding(view);
    }

    private static void bindRequests(
            PartyApplicationService party,
            AdventuringDayTopBarPresentationModel presentationModel,
            AdventuringDayTopBarIntentHandler intentHandler
    ) {
        intentHandler.onRefreshRequested(() ->
                presentationModel.applySummaryResult(party.loadAdventuringDaySummary(new LoadAdventuringDaySummaryQuery())));
        intentHandler.onCalculationRequested((levels, totalGroupXp) ->
                presentationModel.applyCalculationResult(
                        totalGroupXp,
                        party.calculateAdventuringDay(new CalculateAdventuringDayQuery(levels, totalGroupXp))));
    }

    private static AdventuringDayTopBarView.PanelContent toPanelContent(
            AdventuringDayTopBarPresentationModel.PanelModel model
    ) {
        AdventuringDayTopBarPresentationModel.PanelModel safeModel = model == null
                ? AdventuringDayTopBarPresentationModel.PanelModel.loadingModel()
                : model;
        return new AdventuringDayTopBarView.PanelContent(
                safeModel.loading(),
                safeModel.error(),
                safeModel.empty(),
                safeModel.activePartyLevels());
    }

    private static AdventuringDayCalculatorView.Calculation toCalculation(
            AdventuringDayTopBarPresentationModel.CalculationModel model
    ) {
        AdventuringDayTopBarPresentationModel.CalculationModel safeModel = model == null
                ? AdventuringDayTopBarPresentationModel.CalculationModel.empty(0)
                : model;
        return new AdventuringDayCalculatorView.Calculation(
                toBudget(safeModel.budget()),
                toProgress(safeModel.progress()));
    }

    private static AdventuringDayCalculatorView.Budget toBudget(
            AdventuringDayTopBarPresentationModel.BudgetModel model
    ) {
        AdventuringDayTopBarPresentationModel.BudgetModel safeModel = model == null
                ? new AdventuringDayTopBarPresentationModel.BudgetModel(0, 0, 0, 0, 0)
                : model;
        return new AdventuringDayCalculatorView.Budget(
                safeModel.totalXp(),
                safeModel.perThirdXp(),
                safeModel.firstShortRestXp(),
                safeModel.secondShortRestXp(),
                safeModel.characterCount());
    }

    private static AdventuringDayCalculatorView.Progress toProgress(
            AdventuringDayTopBarPresentationModel.ProgressModel model
    ) {
        AdventuringDayTopBarPresentationModel.ProgressModel safeModel = model == null
                ? new AdventuringDayTopBarPresentationModel.ProgressModel(
                        0,
                        0,
                        0,
                        0,
                        0.0,
                        0,
                        0,
                        List.of(),
                        List.of())
                : model;
        return new AdventuringDayCalculatorView.Progress(
                safeModel.totalGroupXp(),
                safeModel.perCharacterAwardedXp(),
                safeModel.partySize(),
                safeModel.fullDays(),
                safeModel.totalDays(),
                safeModel.shortRests(),
                safeModel.longRests(),
                safeModel.levelProgressions().stream()
                        .map(AdventuringDayTopBarBinder::toLevelProgress)
                        .toList(),
                safeModel.events().stream()
                        .map(AdventuringDayTopBarBinder::toProgressEvent)
                        .toList());
    }

    private static AdventuringDayCalculatorView.LevelProgress toLevelProgress(
            AdventuringDayTopBarPresentationModel.LevelProgressModel model
    ) {
        AdventuringDayTopBarPresentationModel.LevelProgressModel safeModel = model == null
                ? new AdventuringDayTopBarPresentationModel.LevelProgressModel(1, 1, 0, 0)
                : model;
        return new AdventuringDayCalculatorView.LevelProgress(
                safeModel.startLevel(),
                safeModel.endLevel(),
                safeModel.characterCount(),
                safeModel.levelUps());
    }

    private static AdventuringDayCalculatorView.ProgressEvent toProgressEvent(
            AdventuringDayTopBarPresentationModel.ProgressEventModel model
    ) {
        AdventuringDayTopBarPresentationModel.ProgressEventModel safeModel = model == null
                ? new AdventuringDayTopBarPresentationModel.ProgressEventModel(
                        0,
                        AdventuringDayTopBarPresentationModel.ProgressEventTypeModel.LONG_REST,
                        0,
                        0,
                        0,
                        false)
                : model;
        return new AdventuringDayCalculatorView.ProgressEvent(
                safeModel.groupXp(),
                toProgressEventType(safeModel.type()),
                safeModel.dayNumber(),
                safeModel.newLevel(),
                safeModel.affectedCharacters(),
                safeModel.partialDay());
    }

    private static AdventuringDayCalculatorView.ProgressEventType toProgressEventType(
            AdventuringDayTopBarPresentationModel.ProgressEventTypeModel type
    ) {
        return switch (type == null ? AdventuringDayTopBarPresentationModel.ProgressEventTypeModel.LONG_REST : type) {
            case LEVEL_UP -> AdventuringDayCalculatorView.ProgressEventType.LEVEL_UP;
            case SHORT_REST -> AdventuringDayCalculatorView.ProgressEventType.SHORT_REST;
            case LONG_REST -> AdventuringDayCalculatorView.ProgressEventType.LONG_REST;
        };
    }

    private record Binding(Node topBar) implements ShellBinding {

        @Override
        public String title() {
            return "Adventuring Day";
        }

        @Override
        public Map<ShellSlot, Node> slotContent() {
            return Map.of(ShellSlot.TOP_BAR, topBar);
        }
    }
}
