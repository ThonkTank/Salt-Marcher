package src.view.dropdowns.adventuringday;

import java.util.ArrayList;
import java.util.List;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.beans.property.ReadOnlyStringWrapper;
import javafx.beans.value.ObservableValue;

final class AdventuringDayTopBarContributionModel {

    private final ReadOnlyStringWrapper triggerText = new ReadOnlyStringWrapper("Rastbudget \u25be");
    private final ReadOnlyObjectWrapper<PanelModel> panel = new ReadOnlyObjectWrapper<>();

    private List<Integer> activePartyLevels = List.of();
    private List<RowModel> rows = List.of();
    private boolean progressModeSelected;
    private String totalGroupXpText = "";
    private PartySourceMode sourceMode = PartySourceMode.ACTIVE_PARTY;
    private boolean activePartyChangedSinceCustomEdit;
    private boolean activePartyRefreshFailed;
    private CalculationModel calculation = CalculationModel.empty(0);
    private int pendingCalculationTotalGroupXp;

    AdventuringDayTopBarContributionModel() {
        rebuildPanel();
    }

    ObservableValue<String> triggerTextProperty() {
        return triggerText.getReadOnlyProperty();
    }

    ObservableValue<PanelModel> panelProperty() {
        return panel.getReadOnlyProperty();
    }

    CalculationRequest applyViewInput(
            boolean useActivePartyRequested,
            boolean addRowRequested,
            boolean clearRequested,
            boolean progressModeSelected,
            String totalGroupXpText,
            List<RowModel> eventRows
    ) {
        this.progressModeSelected = progressModeSelected;
        this.totalGroupXpText = safe(totalGroupXpText);
        List<RowModel> safeEventRows = eventRows == null ? List.of() : List.copyOf(eventRows);
        if (useActivePartyRequested) {
            sourceMode = PartySourceMode.ACTIVE_PARTY;
            activePartyChangedSinceCustomEdit = false;
            activePartyRefreshFailed = false;
            rows = AdventuringDayRows.rowsFromLevels(activePartyLevels);
        } else if (addRowRequested) {
            sourceMode = PartySourceMode.CUSTOM;
            rows = AdventuringDayRows.appendDefaultRow(safeEventRows);
        } else if (clearRequested) {
            sourceMode = PartySourceMode.CUSTOM;
            rows = List.of();
        } else {
            if (sourceMode == PartySourceMode.ACTIVE_PARTY
                    && !safeEventRows.equals(AdventuringDayRows.rowsFromLevels(activePartyLevels))) {
                sourceMode = PartySourceMode.CUSTOM;
            }
            rows = safeEventRows;
        }
        int totalGroupXp = AdventuringDayXpText.parseNonNegativeInt(totalGroupXpText);
        calculation = CalculationModel.empty(totalGroupXp);
        rebuildPanel();
        List<Integer> levels = AdventuringDayRows.expandedLevels(rows);
        if (levels.isEmpty()) {
            return null;
        }
        pendingCalculationTotalGroupXp = totalGroupXp;
        return new CalculationRequest(levels, totalGroupXp);
    }

    void applySummaryResult(List<Integer> summaryLevels, int remainingToShortRest, int remainingToLongRest, boolean successful) {
        if (!successful) {
            triggerText.set("Rastbudget nicht verf\u00fcgbar \u25be");
            activePartyRefreshFailed = true;
            rebuildPanel();
            return;
        }
        applySummary(summaryLevels, remainingToShortRest, remainingToLongRest);
    }

    void applyCalculationResult(CalculationModel result, boolean successful) {
        int totalGroupXp = pendingCalculationTotalGroupXp;
        pendingCalculationTotalGroupXp = 0;
        if (!successful || result == null) {
            calculation = CalculationModel.empty(totalGroupXp);
            rebuildPanel();
            return;
        }
        calculation = result;
        rebuildPanel();
    }

    private void applySummary(List<Integer> summaryLevels, int remainingToShortRest, int remainingToLongRest) {
        if (summaryLevels == null || summaryLevels.isEmpty()) {
            activePartyLevels = List.of();
            if (sourceMode == PartySourceMode.ACTIVE_PARTY) {
                rows = List.of();
                activePartyChangedSinceCustomEdit = false;
                activePartyRefreshFailed = false;
            }
            triggerText.set("Kein Rastbudget \u25be");
            rebuildPanel();
            return;
        }
        List<Integer> nextActivePartyLevels = AdventuringDayRows.sanitizeLevels(summaryLevels);
        boolean changed = !nextActivePartyLevels.equals(activePartyLevels);
        activePartyLevels = nextActivePartyLevels;
        activePartyRefreshFailed = false;
        if (sourceMode == PartySourceMode.ACTIVE_PARTY) {
            rows = AdventuringDayRows.rowsFromLevels(activePartyLevels);
            activePartyChangedSinceCustomEdit = false;
        } else if (changed) {
            activePartyChangedSinceCustomEdit = true;
        }
        triggerText.set("SR " + AdventuringDayXpText.format(remainingToShortRest)
                + " \u00b7 LR " + AdventuringDayXpText.format(remainingToLongRest) + " \u25be");
        rebuildPanel();
    }

    private void rebuildPanel() {
        panel.set(new PanelModel(
                rows,
                progressModeSelected,
                totalGroupXpText,
                partySummaryText(),
                activePartyLevels.isEmpty(),
                rows.isEmpty(),
                selectedPresentation()));
    }

    private String partySummaryText() {
        String sourceLabel = sourceMode == PartySourceMode.CUSTOM ? "Eigene Gruppe" : "Aktive Party";
        if (sourceMode == PartySourceMode.ACTIVE_PARTY && activePartyRefreshFailed) {
            sourceLabel += activePartyLevels.isEmpty() ? " · Laden fehlgeschlagen" : " · Letzter Stand";
        } else if (sourceMode == PartySourceMode.CUSTOM && activePartyChangedSinceCustomEdit) {
            sourceLabel += " · Aktive Party geändert";
        }
        int characterCount = AdventuringDayRows.expandedLevels(rows).size();
        return characterCount == 0 ? sourceLabel : sourceLabel + ": " + characterCount + " Charaktere";
    }

    private CalculationPresentation selectedPresentation() {
        return AdventuringDayCalculationPresentationFactory.presentation(
                progressModeSelected,
                AdventuringDayXpText.parseNonNegativeInt(totalGroupXpText),
                AdventuringDayRows.expandedLevels(rows).isEmpty(),
                calculation);
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }

    record CalculationRequest(List<Integer> levels, int totalGroupXp) {

        CalculationRequest {
            levels = levels == null ? List.of() : List.copyOf(levels);
            totalGroupXp = Math.max(0, totalGroupXp);
        }
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
            calculation = calculation == null ? AdventuringDayCalculationPresentationFactory.empty(false, 0) : calculation;
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

        static CalculationPresentation empty(boolean progressModeSelected, int totalGroupXp) {
            return AdventuringDayCalculationPresentationFactory.empty(progressModeSelected, totalGroupXp);
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
        LONG_REST
    }

    private enum PartySourceMode {
        ACTIVE_PARTY,
        CUSTOM
    }

}

final class AdventuringDayRows {

    private AdventuringDayRows() {
    }

    static List<AdventuringDayTopBarContributionModel.RowModel> appendDefaultRow(
            List<AdventuringDayTopBarContributionModel.RowModel> existingRows
    ) {
        List<AdventuringDayTopBarContributionModel.RowModel> nextRows =
                new ArrayList<>(existingRows == null ? List.of() : existingRows);
        nextRows.add(new AdventuringDayTopBarContributionModel.RowModel(1, "1"));
        return List.copyOf(nextRows);
    }

    static List<AdventuringDayTopBarContributionModel.RowModel> rowsFromLevels(List<Integer> levels) {
        if (levels == null || levels.isEmpty()) {
            return List.of();
        }
        int[] countsByLevel = new int[21];
        for (Integer level : sanitizeLevels(levels)) {
            countsByLevel[level]++;
        }
        List<AdventuringDayTopBarContributionModel.RowModel> nextRows = new ArrayList<>();
        for (int level = 1; level < countsByLevel.length; level++) {
            int count = countsByLevel[level];
            if (count > 0) {
                nextRows.add(new AdventuringDayTopBarContributionModel.RowModel(level, Integer.toString(count)));
            }
        }
        return List.copyOf(nextRows);
    }

    static List<Integer> expandedLevels(List<AdventuringDayTopBarContributionModel.RowModel> rowModels) {
        if (rowModels == null || rowModels.isEmpty()) {
            return List.of();
        }
        List<Integer> levels = new ArrayList<>();
        for (AdventuringDayTopBarContributionModel.RowModel row : rowModels) {
            int count = AdventuringDayXpText.parseNonNegativeInt(row == null ? "" : row.countText());
            int level = row == null ? 1 : row.level();
            for (int index = 0; index < count; index++) {
                levels.add(level);
            }
        }
        return List.copyOf(levels);
    }

    static List<Integer> sanitizeLevels(List<Integer> levels) {
        if (levels == null || levels.isEmpty()) {
            return List.of();
        }
        List<Integer> normalized = new ArrayList<>();
        for (Integer level : levels) {
            if (level != null) {
                normalized.add(Math.max(1, Math.min(20, level)));
            }
        }
        return List.copyOf(normalized);
    }
}

final class AdventuringDayCalculationPresentationFactory {

    private AdventuringDayCalculationPresentationFactory() {
    }

    static AdventuringDayTopBarContributionModel.CalculationPresentation presentation(
            boolean progressModeSelected,
            int totalGroupXp,
            boolean emptyRows,
            AdventuringDayTopBarContributionModel.CalculationModel calculation
    ) {
        if (emptyRows) {
            return empty(progressModeSelected, totalGroupXp);
        }
        return progressModeSelected ? progressPresentation(calculation) : budgetPresentation(calculation);
    }

    static AdventuringDayTopBarContributionModel.CalculationPresentation empty(
            boolean progressModeSelected,
            int totalGroupXp
    ) {
        if (progressModeSelected) {
            return new AdventuringDayTopBarContributionModel.CalculationPresentation(
                    List.of("Gesamt-XP: " + AdventuringDayXpText.xp(totalGroupXp)),
                    List.of());
        }
        return new AdventuringDayTopBarContributionModel.CalculationPresentation(
                List.of("Tag gesamt: " + AdventuringDayXpText.xp(0)),
                List.of());
    }

    private static AdventuringDayTopBarContributionModel.CalculationPresentation budgetPresentation(
            AdventuringDayTopBarContributionModel.CalculationModel calculation
    ) {
        AdventuringDayTopBarContributionModel.BudgetModel safeBudget =
                calculation == null || calculation.budget() == null
                        ? new AdventuringDayTopBarContributionModel.BudgetModel(0, 0, 0, 0, 0)
                        : calculation.budget();
        return new AdventuringDayTopBarContributionModel.CalculationPresentation(
                List.of(
                        "Tag gesamt: " + AdventuringDayXpText.xp(safeBudget.totalXp()),
                        "Pro Drittel: ca. " + AdventuringDayXpText.xp(safeBudget.perThirdXp()),
                        "Short Rest 1: nach " + AdventuringDayXpText.xp(safeBudget.firstShortRestXp()),
                        "Short Rest 2: nach " + AdventuringDayXpText.xp(safeBudget.secondShortRestXp())),
                List.of(
                        "Short Rest 1: " + AdventuringDayXpText.xp(safeBudget.firstShortRestXp()),
                        "Short Rest 2: " + AdventuringDayXpText.xp(safeBudget.secondShortRestXp()),
                        "Long Rest: " + AdventuringDayXpText.xp(safeBudget.totalXp())));
    }

    private static AdventuringDayTopBarContributionModel.CalculationPresentation progressPresentation(
            AdventuringDayTopBarContributionModel.CalculationModel calculation
    ) {
        AdventuringDayTopBarContributionModel.ProgressModel safeProgress =
                calculation == null || calculation.progress() == null
                        ? new AdventuringDayTopBarContributionModel.ProgressModel(0, 0, 0, 0, 0.0, 0, 0, List.of(), List.of())
                        : calculation.progress();
        return new AdventuringDayTopBarContributionModel.CalculationPresentation(
                List.of(
                        "Gesamt-XP: " + AdventuringDayXpText.xp(safeProgress.totalGroupXp()),
                        "XP pro Charakter: " + AdventuringDayXpText.format(safeProgress.perCharacterAwardedXp()),
                        "Adventuring Days: " + AdventuringDayXpText.formatDays(safeProgress.totalDays())
                                + " (" + safeProgress.fullDays() + " voll)",
                        "Short Rests: " + safeProgress.shortRests(),
                        "Long Rests: " + safeProgress.longRests(),
                        "Level-ups: " + formatLevelProgress(safeProgress.levelProgressions())),
                safeProgress.events().stream()
                        .map(AdventuringDayCalculationPresentationFactory::formatProgressEvent)
                        .toList());
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
        String prefix = "Tag " + safeModel.dayNumber() + ", " + AdventuringDayXpText.xp(safeModel.groupXp()) + ": ";
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
                .map(AdventuringDayCalculationPresentationFactory::formatLevelProgressEntry)
                .reduce((left, right) -> left + ", " + right)
                .orElse("keine");
    }

    private static String formatLevelProgressEntry(
            AdventuringDayTopBarContributionModel.LevelProgressModel progression
    ) {
        AdventuringDayTopBarContributionModel.LevelProgressModel safeProgression = progression == null
                ? new AdventuringDayTopBarContributionModel.LevelProgressModel(1, 1, 0, 0)
                : progression;
        String suffix = safeProgression.levelUps() > 0 ? " -> L" + safeProgression.endLevel() : " bleibt";
        return safeProgression.characterCount() + "x L" + safeProgression.startLevel() + suffix;
    }
}

final class AdventuringDayRowProjection {

    List<AdventuringDayTopBarContributionModel.RowModel> normalizeRows(
            List<AdventuringDayTopBarViewInputEvent.RowInput> rowInputs
    ) {
        if (rowInputs == null || rowInputs.isEmpty()) {
            return List.of();
        }
        List<AdventuringDayTopBarContributionModel.RowModel> nextRows = new ArrayList<>();
        for (AdventuringDayTopBarViewInputEvent.RowInput rowInput : rowInputs) {
            if (rowInput != null) {
                int level = rowInput.level() == null ? 1 : Math.max(1, Math.min(20, rowInput.level()));
                nextRows.add(new AdventuringDayTopBarContributionModel.RowModel(level, rowInput.countText()));
            }
        }
        return List.copyOf(nextRows);
    }
}

final class AdventuringDayCalculationMapper {

    AdventuringDayTopBarContributionModel.CalculationModel map(AdventuringDayCalculation calculation) {
        return new AdventuringDayTopBarContributionModel.CalculationModel(
                new AdventuringDayTopBarContributionModel.BudgetModel(
                        calculation.budget().totalBudgetXp(),
                        calculation.budget().perThirdXp(),
                        calculation.budget().firstShortRestXp(),
                        calculation.budget().secondShortRestXp(),
                        calculation.budget().characterCount()),
                new AdventuringDayTopBarContributionModel.ProgressModel(
                        calculation.progress().totalGroupXp(),
                        calculation.progress().perCharacterAwardedXp(),
                        calculation.progress().partySize(),
                        calculation.progress().fullDays(),
                        calculation.progress().totalDays(),
                        calculation.progress().shortRests(),
                        calculation.progress().longRests(),
                        calculation.progress().levelProgressions().stream()
                                .map(progress -> new AdventuringDayTopBarContributionModel.LevelProgressModel(
                                        progress.startLevel(),
                                        progress.endLevel(),
                                        progress.characterCount(),
                                        progress.levelUps()))
                                .toList(),
                        calculation.progress().events().stream()
                                .map(event -> new AdventuringDayTopBarContributionModel.ProgressEventModel(
                                        event.groupXp(),
                                        mapEventType(event.type()),
                                        event.dayNumber(),
                                        event.newLevel(),
                                        event.affectedCharacters(),
                                        event.partialDay()))
                                .toList()));
    }

    private static AdventuringDayTopBarContributionModel.ProgressEventTypeModel mapEventType(Object type) {
        if (type == null) {
            return AdventuringDayTopBarContributionModel.ProgressEventTypeModel.LONG_REST;
        }
        return switch (type.toString()) {
            case "LEVEL_UP" -> AdventuringDayTopBarContributionModel.ProgressEventTypeModel.LEVEL_UP;
            case "SHORT_REST" -> AdventuringDayTopBarContributionModel.ProgressEventTypeModel.SHORT_REST;
            default -> AdventuringDayTopBarContributionModel.ProgressEventTypeModel.LONG_REST;
        };
    }
}

final class AdventuringDayXpText {

    private static final String XP_SUFFIX = " XP";

    private AdventuringDayXpText() {
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

    static String xp(int value) {
        return format(value) + XP_SUFFIX;
    }

    static String format(int value) {
        return Integer.toString(Math.max(0, value));
    }

    static String formatDays(double value) {
        double rounded = Math.round(value * 100.0) / 100.0;
        if (rounded == Math.rint(rounded)) {
            return Integer.toString((int) rounded);
        }
        return Double.toString(rounded);
    }
}
