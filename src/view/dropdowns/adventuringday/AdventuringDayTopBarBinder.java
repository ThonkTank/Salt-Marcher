package src.view.dropdowns.adventuringday;

import java.text.NumberFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import javafx.scene.Node;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.CalculateAdventuringDayQuery;
import src.domain.party.published.LoadAdventuringDayCalculationModelQuery;
import src.domain.party.published.LoadAdventuringDaySummaryQuery;

@SuppressWarnings("PMD.TooManyMethods")
final class AdventuringDayTopBarBinder {

    private static final String XP_SUFFIX = " XP";

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
        view.showPanel(presentationModel.panelProperty().get());
        presentationModel.panelProperty().addListener((ignored, before, after) -> view.showPanel(after));
        view.showCalculation(toCalculationContent(presentationModel.calculationProperty().get()));
        presentationModel.calculationProperty()
                .addListener((ignored, before, after) -> view.showCalculation(toCalculationContent(after)));
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

    private static AdventuringDayTopBarView.CalculationContent toCalculationContent(
            AdventuringDayTopBarContributionModel.CalculationModel model
    ) {
        AdventuringDayTopBarContributionModel.CalculationModel safeModel = model == null
                ? AdventuringDayTopBarContributionModel.CalculationModel.empty(0)
                : model;
        AdventuringDayTopBarContributionModel.BudgetModel budget = safeBudgetModel(safeModel.budget());
        AdventuringDayTopBarContributionModel.ProgressModel progress = safeProgressModel(safeModel.progress());
        return new AdventuringDayTopBarView.CalculationContent(
                budgetSummaryLines(budget),
                budgetTimelineLines(budget),
                progressSummaryLines(progress),
                progressTimelineLines(progress));
    }

    private static AdventuringDayTopBarContributionModel.BudgetModel safeBudgetModel(
            AdventuringDayTopBarContributionModel.BudgetModel model
    ) {
        return model == null
                ? new AdventuringDayTopBarContributionModel.BudgetModel(0, 0, 0, 0, 0)
                : model;
    }

    private static AdventuringDayTopBarContributionModel.ProgressModel safeProgressModel(
            AdventuringDayTopBarContributionModel.ProgressModel model
    ) {
        return model == null
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
    }

    private static List<String> budgetSummaryLines(
            AdventuringDayTopBarContributionModel.BudgetModel budget
    ) {
        return List.of(
                "Tag gesamt: " + formatInt(budget.totalXp()) + XP_SUFFIX,
                "Pro Drittel: ca. " + formatInt(budget.perThirdXp()) + XP_SUFFIX,
                "Short Rest 1: nach " + formatInt(budget.firstShortRestXp()) + XP_SUFFIX,
                "Short Rest 2: nach " + formatInt(budget.secondShortRestXp()) + XP_SUFFIX);
    }

    private static List<String> budgetTimelineLines(
            AdventuringDayTopBarContributionModel.BudgetModel budget
    ) {
        return List.of(
                "Short Rest 1: " + formatInt(budget.firstShortRestXp()) + XP_SUFFIX,
                "Short Rest 2: " + formatInt(budget.secondShortRestXp()) + XP_SUFFIX,
                "Long Rest: " + formatInt(budget.totalXp()) + XP_SUFFIX);
    }

    private static List<String> progressSummaryLines(
            AdventuringDayTopBarContributionModel.ProgressModel progress
    ) {
        return List.of(
                "Gesamt-XP: " + formatInt(progress.totalGroupXp()) + XP_SUFFIX,
                "XP pro Charakter: " + formatInt(progress.perCharacterAwardedXp()),
                "Adventuring Days: " + formatDays(progress.totalDays()) + " (" + progress.fullDays() + " voll)",
                "Short Rests: " + progress.shortRests(),
                "Long Rests: " + progress.longRests(),
                "Level-ups: " + formatLevelProgress(progress.levelProgressions()));
    }

    private static List<String> progressTimelineLines(
            AdventuringDayTopBarContributionModel.ProgressModel progress
    ) {
        return progress.events().stream()
                .map(AdventuringDayTopBarBinder::formatProgressEvent)
                .toList();
    }

    private static String formatProgressEvent(AdventuringDayTopBarContributionModel.ProgressEventModel model) {
        AdventuringDayTopBarContributionModel.ProgressEventModel safeModel = model == null
                ? new AdventuringDayTopBarContributionModel.ProgressEventModel(
                        0,
                        AdventuringDayTopBarContributionModel.ProgressEventTypeModel.LONG_REST,
                        0,
                        0,
                        0,
                        false)
                : model;
        String prefix = "Tag " + safeModel.dayNumber() + ", " + formatInt(safeModel.groupXp()) + XP_SUFFIX + ": ";
        String suffix = safeModel.partialDay() ? " (teilweiser Tag)" : "";
        return switch (safeModel.type()) {
            case LEVEL_UP -> prefix + "Level-up auf " + safeModel.newLevel()
                    + " für " + safeModel.affectedCharacters() + " Charakter"
                    + (safeModel.affectedCharacters() == 1 ? "" : "e") + suffix;
            case SHORT_REST -> prefix + "Short Rest" + suffix;
            case LONG_REST -> prefix + "Long Rest" + suffix;
        };
    }

    private static String formatLevelProgress(
            List<AdventuringDayTopBarContributionModel.LevelProgressModel> progressions
    ) {
        if (progressions == null || progressions.isEmpty()) {
            return "keine";
        }
        return progressions.stream()
                .map(AdventuringDayTopBarBinder::formatLevelProgressEntry)
                .collect(Collectors.joining(", "));
    }

    private static String formatLevelProgressEntry(
            AdventuringDayTopBarContributionModel.LevelProgressModel progression
    ) {
        AdventuringDayTopBarContributionModel.LevelProgressModel safeProgression = progression == null
                ? new AdventuringDayTopBarContributionModel.LevelProgressModel(1, 1, 0, 0)
                : progression;
        String suffix = safeProgression.levelUps() > 0
                ? " -> L" + safeProgression.endLevel()
                : " bleibt";
        return safeProgression.characterCount() + "x L" + safeProgression.startLevel() + suffix;
    }

    private static String formatInt(int value) {
        NumberFormat format = NumberFormat.getIntegerInstance(Locale.GERMANY);
        return format.format(Math.max(0, value));
    }

    private static String formatDays(double value) {
        NumberFormat format = NumberFormat.getNumberInstance(Locale.GERMANY);
        format.setMinimumFractionDigits(0);
        format.setMaximumFractionDigits(2);
        return format.format(value);
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
