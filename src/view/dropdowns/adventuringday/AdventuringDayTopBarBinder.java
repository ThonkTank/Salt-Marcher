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
        AdventuringDayTopBarContributionModel presentationModel = new AdventuringDayTopBarContributionModel();
        AdventuringDayTopBarIntentHandler intentHandler = new AdventuringDayTopBarIntentHandler(presentationModel);
        AdventuringDayTopBarView view = new AdventuringDayTopBarView();
        bindRequests(party, presentationModel);
        view.triggerTextProperty().bind(presentationModel.triggerTextProperty());
        view.onViewInputEvent(intentHandler::consume);
        view.showPanel(toPanelContent(presentationModel.panelProperty().get()));
        presentationModel.panelProperty().addListener((ignored, before, after) -> view.showPanel(toPanelContent(after)));
        view.showCalculation(toCalculation(presentationModel.calculationProperty().get()));
        presentationModel.calculationProperty()
                .addListener((ignored, before, after) -> view.showCalculation(toCalculation(after)));
        intentHandler.consume(AdventuringDayTopBarViewInputEvent.opened());
        return new Binding(view);
    }

    private static void bindRequests(
            PartyApplicationService party,
            AdventuringDayTopBarContributionModel presentationModel
    ) {
        presentationModel.refreshRequestTokenProperty().addListener((ignored, before, after) ->
                presentationModel.applySummaryResult(party.loadAdventuringDaySummary(new LoadAdventuringDaySummaryQuery())));
        presentationModel.calculationRequestTokenProperty().addListener((ignored, before, after) -> {
            presentationModel.applyCalculationResult(
                    presentationModel.requestedTotalGroupXp(),
                    party.calculateAdventuringDay(new CalculateAdventuringDayQuery(
                            List.copyOf(presentationModel.requestedLevelsProperty()),
                            presentationModel.requestedTotalGroupXp())));
        });
    }

    private static AdventuringDayTopBarView.PanelContent toPanelContent(
            AdventuringDayTopBarContributionModel.PanelModel model
    ) {
        AdventuringDayTopBarContributionModel.PanelModel safeModel = model == null
                ? AdventuringDayTopBarContributionModel.PanelModel.loadingModel()
                : model;
        return new AdventuringDayTopBarView.PanelContent(
                safeModel.loading(),
                safeModel.error(),
                safeModel.empty(),
                safeModel.activePartyLevels());
    }

    private static AdventuringDayCalculatorTopBarView.Calculation toCalculation(
            AdventuringDayTopBarContributionModel.CalculationModel model
    ) {
        AdventuringDayTopBarContributionModel.CalculationModel safeModel = model == null
                ? AdventuringDayTopBarContributionModel.CalculationModel.empty(0)
                : model;
        return new AdventuringDayCalculatorTopBarView.Calculation(
                toBudget(safeModel.budget()),
                toProgress(safeModel.progress()));
    }

    private static AdventuringDayCalculatorTopBarView.Budget toBudget(
            AdventuringDayTopBarContributionModel.BudgetModel model
    ) {
        AdventuringDayTopBarContributionModel.BudgetModel safeModel = model == null
                ? new AdventuringDayTopBarContributionModel.BudgetModel(0, 0, 0, 0, 0)
                : model;
        return new AdventuringDayCalculatorTopBarView.Budget(
                safeModel.totalXp(),
                safeModel.perThirdXp(),
                safeModel.firstShortRestXp(),
                safeModel.secondShortRestXp(),
                safeModel.characterCount());
    }

    private static AdventuringDayCalculatorTopBarView.Progress toProgress(
            AdventuringDayTopBarContributionModel.ProgressModel model
    ) {
        AdventuringDayTopBarContributionModel.ProgressModel safeModel = model == null
                ? new AdventuringDayTopBarContributionModel.ProgressModel(
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
        return new AdventuringDayCalculatorTopBarView.Progress(
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

    private static AdventuringDayCalculatorTopBarView.LevelProgress toLevelProgress(
            AdventuringDayTopBarContributionModel.LevelProgressModel model
    ) {
        AdventuringDayTopBarContributionModel.LevelProgressModel safeModel = model == null
                ? new AdventuringDayTopBarContributionModel.LevelProgressModel(1, 1, 0, 0)
                : model;
        return new AdventuringDayCalculatorTopBarView.LevelProgress(
                safeModel.startLevel(),
                safeModel.endLevel(),
                safeModel.characterCount(),
                safeModel.levelUps());
    }

    private static AdventuringDayCalculatorTopBarView.ProgressEvent toProgressEvent(
            AdventuringDayTopBarContributionModel.ProgressEventModel model
    ) {
        AdventuringDayTopBarContributionModel.ProgressEventModel safeModel = model == null
                ? new AdventuringDayTopBarContributionModel.ProgressEventModel(
                        0,
                        AdventuringDayTopBarContributionModel.ProgressEventTypeModel.LONG_REST,
                        0,
                        0,
                        0,
                        false)
                : model;
        return new AdventuringDayCalculatorTopBarView.ProgressEvent(
                safeModel.groupXp(),
                toProgressEventType(safeModel.type()),
                safeModel.dayNumber(),
                safeModel.newLevel(),
                safeModel.affectedCharacters(),
                safeModel.partialDay());
    }

    private static AdventuringDayCalculatorTopBarView.ProgressEventType toProgressEventType(
            AdventuringDayTopBarContributionModel.ProgressEventTypeModel type
    ) {
        return switch (type == null ? AdventuringDayTopBarContributionModel.ProgressEventTypeModel.LONG_REST : type) {
            case LEVEL_UP -> AdventuringDayCalculatorTopBarView.ProgressEventType.LEVEL_UP;
            case SHORT_REST -> AdventuringDayCalculatorTopBarView.ProgressEventType.SHORT_REST;
            case LONG_REST -> AdventuringDayCalculatorTopBarView.ProgressEventType.LONG_REST;
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
