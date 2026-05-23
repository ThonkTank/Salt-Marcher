package src.view.dropdowns.adventuringday;

import java.util.ArrayList;
import java.util.List;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;

final class AdventuringDayTopBarContentModel {

    private final ReadOnlyObjectWrapper<PanelModel> panel = new ReadOnlyObjectWrapper<>();

    private List<RowModel> rows = List.of();
    private boolean progressModeSelected;
    private String totalGroupXpText = "";
    private String partySummaryText = "Aktive Party";
    private boolean useActivePartyButtonDisabled = true;
    private boolean clearButtonDisabled = true;
    private CalculationModel calculation = CalculationModel.empty(0);

    AdventuringDayTopBarContentModel() {
        rebuildPanel();
    }

    ReadOnlyObjectProperty<PanelModel> panelProperty() {
        return panel.getReadOnlyProperty();
    }

    List<RowModel> rows() {
        return rows;
    }

    boolean progressModeSelected() {
        return progressModeSelected;
    }

    String totalGroupXpText() {
        return totalGroupXpText;
    }

    CalculationModel calculation() {
        return calculation;
    }

    void showProjection(
            List<RowModel> nextRows,
            boolean nextProgressModeSelected,
            String nextTotalGroupXpText,
            String nextPartySummaryText,
            boolean nextUseActivePartyButtonDisabled,
            boolean nextClearButtonDisabled,
            CalculationModel nextCalculation
    ) {
        rows = nextRows == null ? List.of() : List.copyOf(nextRows);
        progressModeSelected = nextProgressModeSelected;
        totalGroupXpText = safe(nextTotalGroupXpText);
        partySummaryText = safe(nextPartySummaryText);
        useActivePartyButtonDisabled = nextUseActivePartyButtonDisabled;
        clearButtonDisabled = nextClearButtonDisabled;
        calculation = nextCalculation == null ? CalculationModel.empty(0) : nextCalculation;
        rebuildPanel();
    }

    void showCalculation(CalculationModel nextCalculation) {
        calculation = nextCalculation == null ? CalculationModel.empty(0) : nextCalculation;
        rebuildPanel();
    }

    private void rebuildPanel() {
        panel.set(new PanelModel(
                rows,
                progressModeSelected,
                totalGroupXpText,
                partySummaryText,
                useActivePartyButtonDisabled,
                clearButtonDisabled,
                selectedPresentation()));
    }

    private CalculationPresentation selectedPresentation() {
        int totalGroupXp = parseNonNegativeInt(totalGroupXpText);
        if (expandedLevels(rows).isEmpty()) {
            return emptyPresentation(progressModeSelected, totalGroupXp);
        }
        return progressModeSelected ? progressPresentation(calculation) : budgetPresentation(calculation);
    }

    private static CalculationPresentation emptyPresentation(boolean progressSelected, int totalGroupXp) {
        if (progressSelected) {
            return new CalculationPresentation(List.of("Gesamt-XP: " + xp(totalGroupXp)), List.of());
        }
        return new CalculationPresentation(List.of("Tag gesamt: " + xp(0)), List.of());
    }

    private static CalculationPresentation budgetPresentation(CalculationModel sourceCalculation) {
        BudgetModel budget = sourceCalculation == null || sourceCalculation.budget() == null
                ? new BudgetModel(0, 0, 0, 0, 0)
                : sourceCalculation.budget();
        return new CalculationPresentation(
                List.of(
                        "Tag gesamt: " + xp(budget.totalXp()),
                        "Pro Drittel: ca. " + xp(budget.perThirdXp()),
                        "Short Rest 1: nach " + xp(budget.firstShortRestXp()),
                        "Short Rest 2: nach " + xp(budget.secondShortRestXp())),
                List.of(
                        "Short Rest 1: " + xp(budget.firstShortRestXp()),
                        "Short Rest 2: " + xp(budget.secondShortRestXp()),
                        "Long Rest: " + xp(budget.totalXp())));
    }

    private static CalculationPresentation progressPresentation(CalculationModel sourceCalculation) {
        ProgressModel progress = sourceCalculation == null || sourceCalculation.progress() == null
                ? new ProgressModel(0, 0, 0, 0, 0.0, 0, 0, List.of(), List.of())
                : sourceCalculation.progress();
        return new CalculationPresentation(
                List.of(
                        "Gesamt-XP: " + xp(progress.totalGroupXp()),
                        "XP pro Charakter: " + format(progress.perCharacterAwardedXp()),
                        "Adventuring Days: " + formatDays(progress.totalDays())
                                + " (" + progress.fullDays() + " voll)",
                        "Short Rests: " + progress.shortRests(),
                        "Long Rests: " + progress.longRests(),
                        "Level-ups: " + formatLevelProgress(progress.levelProgressions())),
                progressEventLines(progress.events()));
    }

    private static List<String> progressEventLines(List<ProgressEventModel> events) {
        if (events == null || events.isEmpty()) {
            return List.of();
        }
        java.util.ArrayList<String> lines = new java.util.ArrayList<>();
        for (ProgressEventModel event : events) {
            lines.add(formatProgressEvent(event));
        }
        return List.copyOf(lines);
    }

    private static String formatProgressEvent(ProgressEventModel model) {
        ProgressEventModel safeModel = model == null
                ? new ProgressEventModel(0, ProgressEventTypeModel.LONG_REST, 0, 0, 0, false)
                : model;
        String prefix = "Tag " + safeModel.dayNumber() + ", " + xp(safeModel.groupXp()) + ": ";
        String suffix = safeModel.partialDay() ? " (teilweiser Tag)" : "";
        return switch (safeModel.type()) {
            case LEVEL_UP -> prefix + "Level-up auf " + safeModel.newLevel()
                    + " für " + safeModel.affectedCharacters() + " Charakter"
                    + (safeModel.affectedCharacters() == 1 ? "" : "e") + suffix;
            case SHORT_REST -> prefix + "Short Rest" + suffix;
            case LONG_REST -> prefix + "Long Rest" + suffix;
        };
    }

    private static String formatLevelProgress(List<LevelProgressModel> progressions) {
        if (progressions == null || progressions.isEmpty()) {
            return "keine";
        }
        StringBuilder builder = new StringBuilder();
        for (LevelProgressModel progression : progressions) {
            if (!builder.isEmpty()) {
                builder.append(", ");
            }
            builder.append(formatLevelProgressEntry(progression));
        }
        return builder.toString();
    }

    private static String formatLevelProgressEntry(LevelProgressModel progression) {
        LevelProgressModel safeProgression = progression == null
                ? new LevelProgressModel(1, 1, 0, 0)
                : progression;
        String suffix = safeProgression.levelUps() > 0 ? " -> L" + safeProgression.endLevel() : " bleibt";
        return safeProgression.characterCount() + "x L" + safeProgression.startLevel() + suffix;
    }

    private static String xp(int value) {
        return format(value) + " XP";
    }

    static List<Integer> expandedLevels(List<RowModel> rowModels) {
        if (rowModels == null || rowModels.isEmpty()) {
            return List.of();
        }
        List<Integer> levels = new ArrayList<>();
        for (RowModel row : rowModels) {
            int count = parseNonNegativeInt(row == null ? "" : row.countText());
            int level = row == null ? 1 : row.level();
            for (int index = 0; index < count; index++) {
                levels.add(level);
            }
        }
        return List.copyOf(levels);
    }

    static int parseNonNegativeInt(String rawValue) {
        String safeValue = rawValue == null ? "" : rawValue.trim();
        if (safeValue.isEmpty()) {
            return 0;
        }
        try {
            return Math.max(0, Integer.parseInt(safeValue));
        } catch (NumberFormatException exception) {
            return 0;
        }
    }

    private static String format(int value) {
        return Integer.toString(Math.max(0, value));
    }

    private static String formatDays(double value) {
        double rounded = Math.round(value * 100.0) / 100.0;
        if (rounded == Math.rint(rounded)) {
            return Integer.toString((int) rounded);
        }
        return Double.toString(rounded);
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }

    record PanelModel(
            List<RowModel> rows,
            boolean progressModeSelected,
            String totalGroupXpText,
            String partySummaryText,
            boolean useActivePartyButtonDisabled,
            boolean clearButtonDisabled,
            CalculationPresentation calculation
    ) {

        PanelModel {
            rows = rows == null ? List.of() : List.copyOf(rows);
            totalGroupXpText = safe(totalGroupXpText);
            partySummaryText = safe(partySummaryText);
            calculation = calculation == null ? emptyPresentation(false, 0) : calculation;
        }
    }

    record RowModel(int level, String countText) {

        RowModel {
            level = Math.max(1, Math.min(20, level));
            countText = safe(countText);
        }
    }

    record CalculationPresentation(List<String> summaryLines, List<String> timelineLines) {

        CalculationPresentation {
            summaryLines = summaryLines == null ? List.of() : List.copyOf(summaryLines);
            timelineLines = timelineLines == null ? List.of() : List.copyOf(timelineLines);
        }
    }

    record CalculationModel(BudgetModel budget, ProgressModel progress) {

        static CalculationModel empty(int totalGroupXp) {
            return new CalculationModel(
                    new BudgetModel(0, 0, 0, 0, 0),
                    new ProgressModel(totalGroupXp, 0, 0, 0, 0.0, 0, 0, List.of(), List.of()));
        }
    }

    record BudgetModel(
            int totalXp,
            int perThirdXp,
            int firstShortRestXp,
            int secondShortRestXp,
            int characterCount
    ) {
    }

    record ProgressModel(
            int totalGroupXp,
            int perCharacterAwardedXp,
            int partySize,
            int fullDays,
            double totalDays,
            int shortRests,
            int longRests,
            List<LevelProgressModel> levelProgressions,
            List<ProgressEventModel> events
    ) {

        ProgressModel {
            levelProgressions = levelProgressions == null ? List.of() : List.copyOf(levelProgressions);
            events = events == null ? List.of() : List.copyOf(events);
        }
    }

    record LevelProgressModel(
            int startLevel,
            int endLevel,
            int characterCount,
            int levelUps
    ) {
    }

    record ProgressEventModel(
            int groupXp,
            ProgressEventTypeModel type,
            int dayNumber,
            int newLevel,
            int affectedCharacters,
            boolean partialDay
    ) {
    }

    enum ProgressEventTypeModel {
        LEVEL_UP,
        SHORT_REST,
        LONG_REST;

        static ProgressEventTypeModel fromName(String name) {
            return switch (name) {
                case "LEVEL_UP" -> LEVEL_UP;
                case "SHORT_REST" -> SHORT_REST;
                default -> LONG_REST;
            };
        }
    }
}
