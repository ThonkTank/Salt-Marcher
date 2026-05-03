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
import src.domain.party.published.LoadAdventuringDayCalculationModelQuery;
import src.domain.party.published.LoadAdventuringDaySummaryQuery;

final class AdventuringDayTopBarBinder {

    private final ShellRuntimeContext runtimeContext;

    AdventuringDayTopBarBinder(ShellRuntimeContext runtimeContext) {
        this.runtimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
    }

    ShellBinding bind() {
        PartyApplicationService party = runtimeContext.services().require(PartyApplicationService.class);
        var summaryModel = party.loadAdventuringDaySummaryModel(new LoadAdventuringDaySummaryQuery());
        var calculationModel = party.loadAdventuringDayCalculationModel(new LoadAdventuringDayCalculationModelQuery());
        AdventuringDayTopBarContributionModel presentationModel = new AdventuringDayTopBarContributionModel();
        AdventuringDayTopBarIntentHandler intentHandler = new AdventuringDayTopBarIntentHandler(presentationModel);
        AdventuringDayTopBarView view = new AdventuringDayTopBarView();
        bindRequests(party, intentHandler);
        view.triggerTextProperty().bind(presentationModel.triggerTextProperty());
        view.onViewInputEvent(intentHandler::consume);
        view.showPanel(toPanelContent(presentationModel.panelProperty().get()));
        presentationModel.panelProperty().addListener((ignored, before, after) -> view.showPanel(toPanelContent(after)));
        view.showCalculation(toCalculation(presentationModel.calculationProperty().get()));
        presentationModel.calculationProperty()
                .addListener((ignored, before, after) -> view.showCalculation(toCalculation(after)));
        summaryModel.subscribe(presentationModel::applySummaryResult);
        calculationModel.subscribe(result ->
                presentationModel.applyCalculationResult(intentHandler.drainPendingTotalGroupXp(), result));
        presentationModel.applySummaryResult(summaryModel.current());
        presentationModel.applyCalculationResult(0, calculationModel.current());
        return new Binding(view);
    }

    private static void bindRequests(
            PartyApplicationService party,
            AdventuringDayTopBarIntentHandler intentHandler
    ) {
        intentHandler.onPublishedEventRequested(event -> {
            if (event == null) {
                return;
            }
            intentHandler.storePendingTotalGroupXp(event.totalGroupXp());
            party.calculateAdventuringDay(new CalculateAdventuringDayQuery(
                    List.copyOf(event.levels()),
                    event.totalGroupXp()));
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

    private static AdventuringDayTopBarView.Calculation toCalculation(
            AdventuringDayTopBarContributionModel.CalculationModel model
    ) {
        AdventuringDayTopBarContributionModel.CalculationModel safeModel = model == null
                ? AdventuringDayTopBarContributionModel.CalculationModel.empty(0)
                : model;
        return new AdventuringDayTopBarView.Calculation(
                toBudget(safeModel.budget()),
                toProgress(safeModel.progress()));
    }

    private static AdventuringDayTopBarView.Budget toBudget(
            AdventuringDayTopBarContributionModel.BudgetModel model
    ) {
        AdventuringDayTopBarContributionModel.BudgetModel safeModel = model == null
                ? new AdventuringDayTopBarContributionModel.BudgetModel(0, 0, 0, 0, 0)
                : model;
        return new AdventuringDayTopBarView.Budget(
                safeModel.totalXp(),
                safeModel.perThirdXp(),
                safeModel.firstShortRestXp(),
                safeModel.secondShortRestXp(),
                safeModel.characterCount());
    }

    private static AdventuringDayTopBarView.Progress toProgress(
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
        return new AdventuringDayTopBarView.Progress(
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

    private static AdventuringDayTopBarView.LevelProgress toLevelProgress(
            AdventuringDayTopBarContributionModel.LevelProgressModel model
    ) {
        AdventuringDayTopBarContributionModel.LevelProgressModel safeModel = model == null
                ? new AdventuringDayTopBarContributionModel.LevelProgressModel(1, 1, 0, 0)
                : model;
        return new AdventuringDayTopBarView.LevelProgress(
                safeModel.startLevel(),
                safeModel.endLevel(),
                safeModel.characterCount(),
                safeModel.levelUps());
    }

    private static AdventuringDayTopBarView.ProgressEvent toProgressEvent(
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
        return new AdventuringDayTopBarView.ProgressEvent(
                safeModel.groupXp(),
                toProgressEventType(safeModel.type()),
                safeModel.dayNumber(),
                safeModel.newLevel(),
                safeModel.affectedCharacters(),
                safeModel.partialDay());
    }

    private static AdventuringDayTopBarView.ProgressEventType toProgressEventType(
            AdventuringDayTopBarContributionModel.ProgressEventTypeModel type
    ) {
        return switch (type == null ? AdventuringDayTopBarContributionModel.ProgressEventTypeModel.LONG_REST : type) {
            case LEVEL_UP -> AdventuringDayTopBarView.ProgressEventType.LEVEL_UP;
            case SHORT_REST -> AdventuringDayTopBarView.ProgressEventType.SHORT_REST;
            case LONG_REST -> AdventuringDayTopBarView.ProgressEventType.LONG_REST;
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
